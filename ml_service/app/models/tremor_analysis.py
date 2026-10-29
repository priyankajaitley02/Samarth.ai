import mediapipe as mp
import numpy as np
import cv2
from scipy.fft import fft
from scipy.signal import find_peaks, butter, filtfilt, welch
import logging
from typing import List, Dict, Tuple, Union, Optional

logger = logging.getLogger(__name__)

class TremorAnalyzer:
    def __init__(self):
        # Initialize MediaPipe hands detector with improved settings
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,  # Focus on one hand for better accuracy
            min_detection_confidence=0.7,  # Increased from 0.5
            min_tracking_confidence=0.7    # Increased from 0.5
        )
        self.positions = []
        self.fps = 30  # Standard webcam frame rate
        
        # Improved constants for tremor detection
        self.MIN_FRAMES = 10  # Increased minimum frames for better frequency resolution
        self.FILTER_LOW = 0.5  # Lowered to catch slower tremors
        self.FILTER_HIGH = 20.0  # Limited to medically relevant range
        self.PEAK_HEIGHT_RATIO = 0.1  # More strict peak detection
        self.PEAK_PROMINENCE_RATIO = 0.05  # Increased for better peak discrimination
        self.MIN_AMPLITUDE_THRESHOLD = 2.0  # Increased to reduce false positives
        self.VELOCITY_SCALE_FACTOR = 1.2  # More accurate amplitude scaling
        
        # Tracking multiple landmarks for comprehensive analysis
        self.TRACKED_LANDMARKS = [4, 8, 12, 16, 20]  # Thumb, index, middle, ring, pinky tips
        
        # Frequency bands for medical tremor classification (Hz)
        self.FREQ_BANDS = {
            'Very Slow': (0, 2),
            'Slow Tremor': (2, 4),
            'Resting': (4, 7),   # Parkinsonian tremors typically 4-6 Hz
            'Postural': (7, 12),  # Essential tremors typically 8-10 Hz
            'Action/Intention': (12, 20)
        }
        
        # Improved medical severity scale
        self.SEVERITY_SCALE = [
            ('None', 0, 5),
            ('Mild', 5, 20),
            ('Moderate', 20, 40),
            ('Severe', 40, 60),
            ('Very Severe', 60, 100)
        ]
        
    def process_frame(self, frame) -> Optional[Dict[str, Tuple[int, int]]]:
        """
        Process a single frame and extract multiple hand landmarks.
        Returns a dictionary of landmark positions.
        """
        if frame is None:
            logger.warning("Received empty frame")
            return None
            
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.hands.process(rgb_frame)
        
        if not results.multi_hand_landmarks:
            logger.warning("No hand landmarks detected in frame")
            return None
            
        height, width, _ = frame.shape
        landmarks = {}
        
        # Track multiple landmarks for more comprehensive analysis
        for hand_landmarks in results.multi_hand_landmarks:
            for idx in self.TRACKED_LANDMARKS:
                landmark = hand_landmarks.landmark[idx]
                landmarks[f'landmark_{idx}'] = (
                    int(landmark.x * width), 
                    int(landmark.y * height)
                )
            
            # Also track palm center (calculated from wrist and knuckles)
            wrist = hand_landmarks.landmark[0]
            palm_x = int(wrist.x * width)
            palm_y = int(wrist.y * height)
            landmarks['palm'] = (palm_x, palm_y)
            
            # We only process the first detected hand
            break
            
        return landmarks

    def analyze_tremor(self, data) -> Dict:
        """
        Enhanced tremor analysis using multiple signal processing techniques.
        
        Args:
            data: List of landmark positions captured over time
            
        Returns:
            Dictionary containing tremor metrics
        """
        logger.info(f"Starting tremor analysis with {len(data)} frames")
        
        if len(data) < self.MIN_FRAMES:
            logger.warning(f"Insufficient frames for analysis: {len(data)} < {self.MIN_FRAMES}")
            return self._get_default_metrics()

        try:
            # Extract the primary landmark (index fingertip) for main analysis
            positions = []
            for frame_data in data:
                # Try both direct position tuples and dictionary formats
                if isinstance(frame_data, tuple) and len(frame_data) >= 2:
                    positions.append(frame_data)
                elif isinstance(frame_data, dict) and 'landmark_8' in frame_data:
                    # Index finger tip (landmark 8)
                    positions.append(frame_data['landmark_8'])
                elif isinstance(frame_data, dict) and len(frame_data) > 0:
                    # Take the first available landmark
                    positions.append(next(iter(frame_data.values())))
            
            if not positions:
                logger.error("Could not extract valid position data")
                return self._get_default_metrics()
                
            positions_array = np.array(positions)
            x_coords = positions_array[:, 0]
            y_coords = positions_array[:, 1]
            
            # Perform multiple preprocessing steps for cleaner signal
            
            # 1. Remove outliers (points that deviate significantly)
            x_mean, x_std = np.mean(x_coords), np.std(x_coords)
            y_mean, y_std = np.mean(y_coords), np.std(y_coords)
            
            valid_indices = np.where(
                (np.abs(x_coords - x_mean) < 3 * x_std) & 
                (np.abs(y_coords - y_mean) < 3 * y_std)
            )[0]
            
            if len(valid_indices) < self.MIN_FRAMES:
                logger.warning("Too many outliers removed, using original data")
                valid_indices = np.arange(len(x_coords))
                
            x_coords = x_coords[valid_indices]
            y_coords = y_coords[valid_indices]
            
            # 2. Compute velocities and accelerations for feature extraction
            dx = np.diff(x_coords)
            dy = np.diff(y_coords)
            
            # Calculate Euclidean distance between consecutive points
            velocities = np.sqrt(dx**2 + dy**2)
            
            # 3. Calculate accelerations (rate of change of velocity)
            accelerations = np.diff(np.concatenate([[0], velocities]))
            
            # Extract movement statistics
            mean_velocity = np.mean(velocities)
            max_velocity = np.max(velocities)
            mean_accel = np.mean(np.abs(accelerations))
            std_velocity = np.std(velocities)
            
            logger.info(f"Movement stats - Mean velocity: {mean_velocity:.2f}, "
                        f"Max velocity: {max_velocity:.2f}, "
                        f"Std velocity: {std_velocity:.2f}, "
                        f"Mean acceleration: {mean_accel:.2f}")

            # Check if there's enough movement to analyze
            if mean_velocity < self.MIN_AMPLITUDE_THRESHOLD and max_velocity < 10:
                logger.info("Insufficient movement detected for reliable analysis")
                return self._get_default_metrics()

            # 4. Normalize signals to account for different hand positions
            x_norm = (x_coords - np.mean(x_coords)) / (np.std(x_coords) + 1e-6)
            y_norm = (y_coords - np.mean(y_coords)) / (np.std(y_coords) + 1e-6)

            # 5. Apply bandpass filter to focus on tremor-relevant frequencies
            nyquist = self.fps / 2.0
            low = min(0.99, max(0.01, self.FILTER_LOW / nyquist))
            high = min(0.99, max(low + 0.01, self.FILTER_HIGH / nyquist))
            
            b, a = butter(4, [low, high], btype='band')  # 4th order for steeper cutoff
            x_filtered = filtfilt(b, a, x_norm)
            y_filtered = filtfilt(b, a, y_norm)
            
            # 6. Calculate displacement vector magnitude (combines both dimensions)
            displacement = np.sqrt(x_filtered**2 + y_filtered**2)
            
            # 7. Apply window function to reduce spectral leakage
            window = np.hanning(len(displacement))
            windowed = displacement * window
            
            # 8. Multi-method frequency analysis for robustness
            
            # Method 1: FFT for overall spectrum
            fft_result = np.abs(fft(windowed))[:len(windowed)//2]
            frequencies = np.linspace(0, self.fps/2, len(windowed)//2)
            
            # Method 2: Welch's method for improved noise handling
            freqs_welch, psd_welch = welch(
                displacement, 
                fs=self.fps, 
                nperseg=min(256, len(displacement)//2),
                scaling='spectrum'
            )
            
            # 9. Improved peak detection with adaptive parameters
            # Use results from both methods for validation
            
            # For FFT result
            peak_height = np.max(fft_result) * self.PEAK_HEIGHT_RATIO
            peak_prominence = np.max(fft_result) * self.PEAK_PROMINENCE_RATIO
            
            # Find peaks with stricter criteria
            peaks, properties = find_peaks(
                fft_result,
                height=peak_height,
                distance=3,  # Minimum distance between peaks (in samples)
                prominence=peak_prominence,
                width=1  # Minimum peak width
            )
            
            # Also find peaks in Welch PSD for validation
            welch_peaks, _ = find_peaks(
                psd_welch,
                height=np.max(psd_welch) * self.PEAK_HEIGHT_RATIO,
                distance=2,
                prominence=np.max(psd_welch) * self.PEAK_PROMINENCE_RATIO
            )
            
            logger.info(f"Found {len(peaks)} peaks in FFT and {len(welch_peaks)} peaks in Welch PSD")
            
            if len(peaks) == 0 and len(welch_peaks) == 0:
                if mean_velocity > 10:
                    # Fallback: Estimate frequency from movement statistics
                    logger.info("No spectral peaks found but significant movement detected, using statistical estimation")
                    tremor_frequency = 2.0 + (mean_velocity / 20.0) + (mean_accel / 40.0)
                    tremor_amplitude = min(75, mean_velocity * 1.5 + std_velocity)
                else:
                    logger.info("No tremor detected")
                    return self._get_default_metrics()
            else:
                # 10. Calculate dominant frequency considering both methods
                if len(peaks) > 0:
                    # Get peak heights from FFT
                    peak_heights = fft_result[peaks]
                    dominant_peak_idx = peaks[np.argmax(peak_heights)]
                    fft_frequency = frequencies[dominant_peak_idx]
                    
                    # Check if it's a valid tremor frequency
                    if 0.5 <= fft_frequency <= 20:
                        tremor_frequency = fft_frequency
                    else:
                        # Fallback to secondary peaks if primary is outside medical range
                        valid_peaks = [p for p in peaks if 0.5 <= frequencies[p] <= 20]
                        if valid_peaks:
                            secondary_peak = valid_peaks[np.argmax(fft_result[valid_peaks])]
                            tremor_frequency = frequencies[secondary_peak]
                        else:
                            # No valid FFT peaks, check Welch method
                            if len(welch_peaks) > 0:
                                welch_frequency = freqs_welch[welch_peaks[np.argmax(psd_welch[welch_peaks])]]
                                tremor_frequency = welch_frequency
                            else:
                                # Last resort: statistical estimation
                                tremor_frequency = 2.0 + (mean_velocity / 20.0)
                else:
                    # Use Welch peaks if FFT peaks not found
                    if len(welch_peaks) > 0:
                        welch_frequency = freqs_welch[welch_peaks[np.argmax(psd_welch[welch_peaks])]]
                        tremor_frequency = welch_frequency
                    else:
                        # Fallback to statistics
                        tremor_frequency = 2.0 + (mean_velocity / 20.0)
                
                # 11. Calculate amplitude more reliably
                # Use multiple features for better estimation
                
                # Base amplitude on filtered signal magnitude
                filtered_amplitude = np.std(displacement) * 100
                
                # Scale by velocity statistics for better correlation with clinical measures
                velocity_component = std_velocity * 1.2
                
                # Consider acceleration component for better detection of rapid tremors
                accel_component = mean_accel * 0.8
                
                # Combine components with appropriate weights
                raw_amplitude = (
                    0.5 * filtered_amplitude + 
                    0.3 * velocity_component + 
                    0.2 * accel_component
                )
                
                # Scale to clinical range (0-80)
                tremor_amplitude = min(80, max(0, raw_amplitude))
                
                # Ensure minimum amplitude for clearly detectable tremors
                if mean_velocity > 15 and tremor_amplitude < 15:
                    tremor_amplitude = 15 + (mean_velocity / 5)
            
            # 12. Classify tremor type based on frequency bands
            tremor_type = self._get_tremor_type(tremor_frequency)
            
            # 13. Determine severity considering both amplitude and frequency
            # Some tremor types are clinically more significant at lower amplitudes
            severity_modifier = 1.0
            if tremor_type == 'Resting':
                # Resting tremors are clinically significant at lower amplitudes
                severity_modifier = 1.2
            elif tremor_type == 'Very Slow':
                # Very slow tremors may need higher amplitude to be significant
                severity_modifier = 0.9
                
            adjusted_amplitude = tremor_amplitude * severity_modifier
            severity = self._get_severity(adjusted_amplitude)
            
            # 14. Calculate additional metrics for comprehensive analysis
            
            # Regularity: measure of how consistent the tremor pattern is
            if len(peaks) > 1:
                # Calculate coefficient of variation of peak spacings
                peak_spacings = np.diff(frequencies[peaks])
                regularity = 1.0 - min(1.0, np.std(peak_spacings) / (np.mean(peak_spacings) + 1e-6))
            else:
                regularity = 0.5  # Default mid-value when insufficient peaks
            
            # Tremor stability: measure of how stable the tremor is over time
            # Using a windowed approach to detect amplitude variations
            if len(displacement) > 20:
                window_size = min(20, len(displacement) // 3)
                windows = [displacement[i:i+window_size] for i in range(0, len(displacement)-window_size, window_size//2)]
                window_stds = [np.std(w) for w in windows]
                stability = 1.0 - min(1.0, np.std(window_stds) / (np.mean(window_stds) + 1e-6))
            else:
                stability = 0.5  # Default mid-value when insufficient data
                
            # 15. Confidence score based on analysis quality
            confidence = self._calculate_confidence(
                len(data),
                mean_velocity, 
                len(peaks),
                regularity,
                stability
            )
            
            logger.info(f"Tremor analysis complete - Frequency: {tremor_frequency:.2f} Hz, "
                      f"Amplitude: {tremor_amplitude:.2f}, Type: {tremor_type}, "
                      f"Severity: {severity}, Confidence: {confidence:.2f}")
            
            # 16. Return comprehensive metrics
            result = {
                'tremor_frequency': float(tremor_frequency),
                'tremor_amplitude': float(tremor_amplitude),
                'tremor_type': tremor_type,
                'severity': severity,
                'peak_count': len(peaks),
                'regularity': float(regularity),
                'stability': float(stability),
                'confidence': float(confidence)
            }
            
            # Add clinical insight based on tremor characteristics
            result['clinical_insight'] = self._get_clinical_insight(
                tremor_frequency,
                tremor_type,
                tremor_amplitude,
                severity
            )
            
            return result
                
        except Exception as e:
            logger.error(f"Error in tremor analysis: {str(e)}", exc_info=True)
            return self._get_default_metrics()

    def _get_tremor_type(self, frequency: float) -> str:
        """
        Determine tremor type from frequency using medical classification bands.
        
        Args:
            frequency: Tremor frequency in Hz
            
        Returns:
            String describing tremor type
        """
        for tremor_type, (min_freq, max_freq) in self.FREQ_BANDS.items():
            if min_freq <= frequency < max_freq:
                return tremor_type
        return 'None'

    def _get_severity(self, amplitude: float) -> str:
        """
        Determine severity level from amplitude using clinical scale.
        
        Args:
            amplitude: Tremor amplitude (0-100 scale)
            
        Returns:
            String describing severity
        """
        for label, min_val, max_val in self.SEVERITY_SCALE:
            if min_val <= amplitude < max_val:
                return label
        return 'Very Severe'  # For values >= max scale value

    def _calculate_confidence(self, 
                             num_frames: int, 
                             mean_velocity: float, 
                             num_peaks: int,
                             regularity: float,
                             stability: float) -> float:
        """
        Calculate a confidence score for the analysis results.
        
        Args:
            num_frames: Number of frames analyzed
            mean_velocity: Mean velocity of movement
            num_peaks: Number of frequency peaks detected
            regularity: Regularity of tremor pattern
            stability: Stability of tremor over time
            
        Returns:
            Confidence score from 0.0 to 1.0
        """
        # Frame count factor (more frames = more reliable)
        frames_factor = min(1.0, num_frames / 60)
        
        # Movement factor (some movement needed, but not too much)
        movement_factor = 1.0 - min(1.0, abs(mean_velocity - 20) / 20)
        
        # Peak detection factor (at least one clear peak is good)
        peak_factor = min(1.0, num_peaks / 3)
        
        # Higher regularity and stability indicate more reliable analysis
        pattern_factor = (regularity + stability) / 2
        
        # Calculate overall confidence with appropriate weights
        confidence = (
            0.2 * frames_factor +
            0.3 * movement_factor +
            0.3 * peak_factor +
            0.2 * pattern_factor
        )
        
        return min(1.0, max(0.0, confidence))

    def _get_clinical_insight(self, 
                             frequency: float, 
                             tremor_type: str,
                             amplitude: float,
                             severity: str) -> str:
        """
        Provide clinical insight based on tremor characteristics.
        
        Args:
            frequency: Tremor frequency in Hz
            tremor_type: Classified tremor type
            amplitude: Tremor amplitude
            severity: Tremor severity
            
        Returns:
            String with clinical insight
        """
        if tremor_type == 'None' or severity == 'None':
            return "No significant tremor detected."
            
        if tremor_type == 'Resting' and frequency >= 4 and frequency <= 7:
            return "Resting tremor (4-7 Hz) may indicate parkinsonian conditions."
            
        if tremor_type == 'Postural' and frequency >= 7 and frequency <= 12:
            return "Postural tremor (7-12 Hz) may suggest essential tremor."
            
        if tremor_type == 'Action/Intention' and frequency > 12:
            return "Action/Intention tremor may indicate cerebellar dysfunction."
            
        if tremor_type == 'Very Slow' and frequency < 2:
            return "Very slow tremor (<2 Hz) may suggest cerebellar or drug-induced tremor."
            
        if tremor_type == 'Slow Tremor' and frequency >= 2 and frequency < 4:
            return "Slow tremor (2-4 Hz) may indicate cerebellar pathology or metabolic disorders."
            
        return f"{tremor_type} tremor with {severity.lower()} intensity detected."

    def _get_default_metrics(self) -> Dict:
        """Return default metrics when analysis fails or no tremor is detected."""
        return {
            'tremor_frequency': 0,
            'tremor_amplitude': 0,
            'tremor_type': 'None',
            'severity': 'None',
            'peak_count': 0,
            'regularity': 0,
            'stability': 0,
            'confidence': 0,
            'clinical_insight': "No tremor detected or insufficient data for analysis."
        }

    def add_position(self, position):
        """Add a position to the analysis buffer."""
        if position:
            self.positions.append(position)
            
    def clear_positions(self):
        """Clear the position buffer."""
        self.positions = []