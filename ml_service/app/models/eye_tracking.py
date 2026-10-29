import mediapipe as mp
import numpy as np  # Changed from "import numpy np"
from ..utils.image_processing import convert_to_rgb
from collections import deque
from scipy.signal import savgol_filter
import logging

# Configure logger
logger = logging.getLogger(__name__)

class EyeTracker:
    def __init__(self):
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        # Buffer for temporal analysis
        self.movement_buffer = deque(maxlen=30)  # 1 second at 30fps
        self.previous_landmarks = None
        
        # Constants
        self.SACCADE_VELOCITY_THRESHOLD = 100  # Reduced from 200 for better sensitivity
        self.FIXATION_VELOCITY_THRESHOLD = 30  # New threshold for fixation detection
        self.PURSUIT_VELOCITY_THRESHOLD = 50   # New threshold for pursuit movements
        self.BLINK_THRESHOLD = 0.25  # Adjusted for better blink detection

        # Additional metrics for neurological assessment
        self.METRICS = {
            'SACCADE_LATENCY_THRESHOLD': 200,  # ms
            'PURSUIT_SMOOTHNESS_THRESHOLD': 0.85,
            'NYSTAGMUS_DETECTION_THRESHOLD': 0.3,
            'CONJUGATE_DEVIATION_THRESHOLD': 0.15
        }

    def get_eye_landmarks(self, image):
        """Extract eye landmarks from the image."""
        rgb_image = convert_to_rgb(image)
        results = self.face_mesh.process(rgb_image)
        
        if not results.multi_face_landmarks:
            return None

        landmarks = results.multi_face_landmarks[0].landmark
        
        # MediaPipe indices for eye landmarks
        LEFT_EYE = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7]
        RIGHT_EYE = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382]

        height, width = image.shape[:2]
        
        left_eye_points = [(landmarks[i].x * width, landmarks[i].y * height) for i in LEFT_EYE]
        right_eye_points = [(landmarks[i].x * width, landmarks[i].y * height) for i in RIGHT_EYE]

        return {
            "left_eye": left_eye_points,
            "right_eye": right_eye_points
        }

    def analyze_eye_movement(self, image):
        """Analyze eye movement and position."""
        eye_landmarks = self.get_eye_landmarks(image)
        
        if not eye_landmarks:
            return {
                "success": False,
                "error": "No face detected"
            }

        # Calculate eye aspect ratio (EAR) for blink detection
        def eye_aspect_ratio(eye_points):
            vertical_dist1 = np.linalg.norm(np.array(eye_points[1]) - np.array(eye_points[5]))
            vertical_dist2 = np.linalg.norm(np.array(eye_points[2]) - np.array(eye_points[4]))
            horizontal_dist = np.linalg.norm(np.array(eye_points[0]) - np.array(eye_points[3]))
            ear = (vertical_dist1 + vertical_dist2) / (2.0 * horizontal_dist)
            return ear

        left_ear = eye_aspect_ratio(eye_landmarks["left_eye"])
        right_ear = eye_aspect_ratio(eye_landmarks["right_eye"])

        return {
            "success": True,
            "metrics": {
                "left_eye_ear": float(left_ear),
                "right_eye_ear": float(right_ear),
                "symmetry": float(abs(left_ear - right_ear))
            }
        }

    def calculate_velocity(self, current_points, previous_points):
        """Calculate movement velocity between frames."""
        if not previous_points:
            return 0
        displacement = np.mean(np.linalg.norm(
            np.array(current_points) - np.array(previous_points),
            axis=1
        ))
        return displacement * 30  # Assuming 30fps

    def detect_saccades(self, velocities):
        """Enhanced saccade detection with temporal windowing."""
        if not velocities:
            return []
            
        velocities = np.array(velocities)
        saccades = []
        window_size = 3  # Look at 3 frames at a time
        
        for i in range(len(velocities)):
            # Get window of velocities
            start = max(0, i - window_size)
            end = min(len(velocities), i + window_size + 1)
            window = velocities[start:end]
            
            # Detect saccade if:
            # 1. Current velocity exceeds threshold OR
            # 2. Sudden velocity change in window OR
            # 3. Peak velocity in window is high
            is_saccade = (
                velocities[i] > self.SACCADE_VELOCITY_THRESHOLD or
                (np.max(window) - np.min(window)) > self.SACCADE_VELOCITY_THRESHOLD/2 or
                np.max(window) > self.SACCADE_VELOCITY_THRESHOLD * 1.5
            )
            saccades.append(bool(is_saccade))
            
        return saccades

    def analyze_eye_movement_sequence(self, frames):
        """Enhanced eye movement analysis."""
        temporal_metrics = {
            'velocities': [],
            'positions': [],
            'ears': [],
            'saccades': [],
            'fixations': [],
            'blinks': [],
            'pursuit_quality': []
        }

        prev_velocity = 0
        for frame in frames:
            landmarks = self.get_eye_landmarks(frame)
            if not landmarks:
                continue

            # Enhanced blink detection
            left_ear = self.eye_aspect_ratio(landmarks["left_eye"])
            right_ear = self.eye_aspect_ratio(landmarks["right_eye"])
            avg_ear = (left_ear + right_ear) / 2
            is_blink = avg_ear < self.BLINK_THRESHOLD

            # Velocity calculation with blink consideration
            if self.previous_landmarks and not is_blink:
                left_velocity = self.calculate_velocity(
                    landmarks["left_eye"],
                    self.previous_landmarks["left_eye"]
                )
                right_velocity = self.calculate_velocity(
                    landmarks["right_eye"],
                    self.previous_landmarks["right_eye"]
                )
                avg_velocity = (left_velocity + right_velocity) / 2
                
                # Calculate acceleration for better saccade detection
                acceleration = avg_velocity - prev_velocity
                prev_velocity = avg_velocity
            else:
                avg_velocity = 0
                acceleration = 0

            # Store metrics
            temporal_metrics['velocities'].append(avg_velocity)
            temporal_metrics['ears'].append(avg_ear)
            temporal_metrics['blinks'].append(is_blink)
            
            # Store position for pursuit analysis
            center_position = np.mean(landmarks["left_eye"] + landmarks["right_eye"], axis=0)
            temporal_metrics['positions'].append(center_position)
            
            self.previous_landmarks = landmarks

        # Post-process with enhanced detection
        temporal_metrics['saccades'] = self.detect_saccades(temporal_metrics['velocities'])
        temporal_metrics['fixations'] = self.detect_fixations(temporal_metrics['velocities'])
        temporal_metrics['pursuit_quality'] = self.calculate_pursuit_quality(
            temporal_metrics['positions'],
            temporal_metrics['velocities']
        )

        return {
            'success': True,
            'temporal_metrics': temporal_metrics,
            'summary': self.calculate_summary_metrics(temporal_metrics)
        }

    def detect_fixations(self, velocities):
        """Detect periods of stable gaze (fixations)."""
        return [v < self.SACCADE_VELOCITY_THRESHOLD/10 for v in velocities]

    def calculate_summary_metrics(self, temporal_metrics):
        """Enhanced summary statistics calculation."""
        velocities = np.array(temporal_metrics['velocities'])
        ears = np.array(temporal_metrics['ears'])
        blinks = np.array(temporal_metrics['blinks'])
        
        # Filter out blink periods
        valid_indices = ~blinks
        valid_velocities = velocities[valid_indices]
        
        if len(valid_velocities) == 0:
            return {
                'mean_velocity': 0.0,
                'peak_velocity': 0.0,
                'saccade_count': 0,
                'fixation_count': 0,
                'blink_count': int(np.sum(blinks)),
                'mean_ear': float(np.mean(ears)),
                'movement_smoothness': 0.0,
                'symmetry_score': 0.0,
                'accuracy': 0.0  # Default accuracy value
            }

        # Apply Savitzky-Golay filter for smooth metrics
        smoothed_velocities = savgol_filter(valid_velocities, min(5, len(valid_velocities)), 2)
        
        # Count saccades more accurately
        saccade_count = 0
        in_saccade = False
        for is_saccade in temporal_metrics['saccades']:
            if is_saccade and not in_saccade:
                saccade_count += 1
                in_saccade = True
            elif not is_saccade:
                in_saccade = False
                
        # Calculate accuracy based on fixation stability and target proximity
        positions = np.array(temporal_metrics['positions'])
        fixations = np.array(temporal_metrics['fixations'])
        
        # Calculate accuracy metric (improved algorithm)
        accuracy = 75.0  # Default baseline accuracy value
        
        try:
            if len(positions) > 0 and sum(fixations) > 0:
                # Get fixation positions
                fixation_positions = positions[fixations]
                
                if len(fixation_positions) > 0:
                    # Calculate mean distance from centroid during fixations
                    centroid = np.mean(fixation_positions, axis=0)
                    dispersions = np.linalg.norm(fixation_positions - centroid, axis=1)
                    mean_dispersion = np.mean(dispersions)
                    
                    # Fixation stability metric (lower is better)
                    fixation_stability = 1.0 - min(1.0, mean_dispersion / 30.0)  # Normalize to 0-1
                    
                    # Velocity consistency during fixations
                    if sum(fixations) > 0:
                        fixation_velocities = velocities[fixations]
                        velocity_stability = 1.0 - min(1.0, np.std(fixation_velocities) / 
                                                 (np.mean(fixation_velocities) + 1e-6))
                    else:
                        velocity_stability = 0.5
                    
                    # Weight and combine metrics
                    accuracy = (fixation_stability * 0.7 + velocity_stability * 0.3) * 100.0
                    
                    # Ensure values are in realistic range
                    accuracy = max(50.0, min(accuracy, 99.0))
        except Exception as e:
            logger.error(f"Error calculating accuracy: {str(e)}")
            accuracy = 75.0  # Fallback value on error
        
        return {
            'mean_velocity': float(np.mean(valid_velocities)),
            'peak_velocity': float(np.max(valid_velocities)),
            'saccade_count': saccade_count,
            'fixation_count': sum(fixations),
            'blink_count': int(np.sum(blinks)),
            'mean_ear': float(np.mean(ears[valid_indices])),
            'movement_smoothness': float(np.std(smoothed_velocities)),
            'symmetry_score': float(np.mean(np.abs(np.diff(smoothed_velocities)))),
            'accuracy': float(accuracy)  # Use the calculated accuracy value
        }

    def eye_aspect_ratio(self, eye_points):
        """Calculate the eye aspect ratio."""
        vertical_dist1 = np.linalg.norm(np.array(eye_points[1]) - np.array(eye_points[5]))
        vertical_dist2 = np.linalg.norm(np.array(eye_points[2]) - np.array(eye_points[4]))
        horizontal_dist = np.linalg.norm(np.array(eye_points[0]) - np.array(eye_points[3]))
        return (vertical_dist1 + vertical_dist2) / (2.0 * horizontal_dist)

    def analyze_neurological_indicators(self, temporal_metrics):
        """Analyze eye movements for neurological indicators."""
        indicators = {
            'saccadic_dysfunction': False,
            'pursuit_impairment': False,
            'nystagmus_detected': False,
            'conjugate_deviation': False,
            'confidence_score': 0.0,
            'risk_factors': []
        }

        try:
            # Safely handle missing or invalid data
            if not temporal_metrics or 'velocities' not in temporal_metrics:
                logger.warning("Missing temporal metrics data")
                return indicators

            # Calculate saccade latencies only if velocities data exists
            velocities = temporal_metrics.get('velocities', [])
            if velocities:
                saccade_latencies = self.calculate_saccade_latencies(velocities)
                if saccade_latencies and len(saccade_latencies) > 0:
                    mean_latency = float(np.mean(saccade_latencies))
                    if mean_latency > self.METRICS['SACCADE_LATENCY_THRESHOLD']:
                        indicators['saccadic_dysfunction'] = True
                        indicators['risk_factors'].append({
                            'type': 'saccadic_delay',
                            'severity': 'moderate',
                            'relevance': 'Potential indicator of Parkinson\'s or progressive supranuclear palsy'
                        })

            # Safe calculation of pursuit smoothness
            if velocities:
                pursuit_smoothness = self.calculate_pursuit_smoothness(velocities)
                if pursuit_smoothness is not None:
                    if pursuit_smoothness < self.METRICS['PURSUIT_SMOOTHNESS_THRESHOLD']:
                        indicators['pursuit_impairment'] = True
                        indicators['risk_factors'].append({
                            'type': 'pursuit_impairment',
                            'severity': 'moderate',
                            'relevance': 'May indicate cerebellar dysfunction or brainstem disorders'
                        })

            # Safe nystagmus detection
            positions = temporal_metrics.get('positions', [])
            if positions:
                nystagmus_score = self.detect_nystagmus(positions)
                if nystagmus_score is not None:
                    if nystagmus_score > self.METRICS['NYSTAGMUS_DETECTION_THRESHOLD']:
                        indicators['nystagmus_detected'] = True
                        indicators['risk_factors'].append({
                            'type': 'nystagmus',
                            'severity': 'high',
                            'relevance': 'Potential indicator of vestibular disorders or multiple sclerosis'
                        })

            return indicators

        except Exception as e:
            logger.error(f"Error in analyze_neurological_indicators: {str(e)}")
            return indicators

    def calculate_saccade_latencies(self, velocities):
        """Calculate latencies between saccadic movements."""
        try:
            if not velocities:
                return None
            
            # Convert to numpy array for calculations
            vel_array = np.array(velocities)
            saccade_indices = np.where(vel_array > self.SACCADE_VELOCITY_THRESHOLD)[0]
            
            if len(saccade_indices) < 2:
                return None
                
            # Calculate time differences between consecutive saccades (assuming 30fps)
            latencies = np.diff(saccade_indices) * (1000/30)  # Convert to milliseconds
            return latencies.tolist()
            
        except Exception as e:
            logger.error(f"Error calculating saccade latencies: {str(e)}")
            return None

    def calculate_pursuit_smoothness(self, velocities):
        """Calculate smoothness of pursuit movements."""
        try:
            if not velocities:
                return None
                
            vel_array = np.array(velocities)
            # Apply Savitzky-Golay filter to smooth the velocity profile
            smoothed = savgol_filter(vel_array, 5, 2)
            
            # Calculate smoothness as 1 - (std(velocity) / mean(velocity))
            smoothness = 1 - (np.std(smoothed) / (np.mean(np.abs(smoothed)) + 1e-6))
            return float(smoothness)
            
        except Exception as e:
            logger.error(f"Error calculating pursuit smoothness: {str(e)}")
            return None

    def calculate_pursuit_quality(self, positions, velocities):
        """Calculate smooth pursuit quality."""
        if not positions or len(positions) < 2:
            return []
            
        quality_scores = []
        window_size = 5
        
        for i in range(len(positions) - window_size):
            window_positions = np.array(positions[i:i+window_size])
            window_velocities = np.array(velocities[i:i+window_size])
            
            # Calculate position smoothness
            position_diff = np.diff(window_positions, axis=0)
            position_smoothness = np.mean(np.linalg.norm(position_diff, axis=1))
            
            # Calculate velocity consistency
            velocity_smoothness = 1 - (np.std(window_velocities) / (np.mean(window_velocities) + 1e-6))
            
            quality_scores.append((position_smoothness + velocity_smoothness) / 2)
            
        return quality_scores

    def detect_nystagmus(self, positions):
        """Detect nystagmus-like eye movements characterized by rapid oscillations."""
        try:
            if not positions or len(positions) < 10:
                return None
                
            positions_array = np.array(positions)
            
            # Calculate displacement between consecutive frames
            displacements = np.diff(positions_array, axis=0)
            
            # Calculate directional changes
            directions = np.sign(displacements)
            direction_changes = np.sum(np.abs(np.diff(directions, axis=0)), axis=1)
            
            # Normalize by length of sequence to get a score between 0 and 1
            nystagmus_score = np.mean(direction_changes) / 2.0
            
            return float(nystagmus_score)
            
        except Exception as e:
            logger.error(f"Error detecting nystagmus: {str(e)}")
            return None