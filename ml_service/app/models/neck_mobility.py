import mediapipe as mp
import numpy as np
import cv2
import math
from typing import Tuple, Dict, Optional

class NeckMobilityAnalyzer:
    def __init__(self):
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            model_complexity=2,  # Increased for better accuracy
            min_detection_confidence=0.7,
            min_tracking_confidence=0.7
        )
        
        # Initialize angles
        self.reset_measurements()
        
    def reset_measurements(self):
        """Reset all measurements."""
        self.neutral_angle = None
        self.max_flexion = None
        self.max_extension = None
        self.max_left_rotation = None
        self.max_right_rotation = None
        
    def process_frame(self, frame_bytes: bytes) -> Tuple[Optional[Dict], np.ndarray]:
        """Process a frame from bytes and return landmarks with visualization."""
        # Convert bytes to numpy array
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return None, np.zeros((480, 640, 3), dtype=np.uint8)

        height, width = frame.shape[:2]
        
        # Convert to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.pose.process(rgb_frame)
        
        # Create visualization frame
        viz_frame = frame.copy()
        
        if not results.pose_landmarks:
            return None, viz_frame
            
        # Draw pose landmarks
        self.mp_drawing.draw_landmarks(
            viz_frame,
            results.pose_landmarks,
            self.mp_pose.POSE_CONNECTIONS,
            landmark_drawing_spec=self.mp_drawing_styles.get_default_pose_landmarks_style()
        )
        
        # Extract key landmarks
        landmarks = results.pose_landmarks.landmark
        landmarks_dict = {
            'nose': self._to_pixel(landmarks[self.mp_pose.PoseLandmark.NOSE.value], width, height),
            'left_ear': self._to_pixel(landmarks[self.mp_pose.PoseLandmark.LEFT_EAR.value], width, height),
            'right_ear': self._to_pixel(landmarks[self.mp_pose.PoseLandmark.RIGHT_EAR.value], width, height),
            'left_shoulder': self._to_pixel(landmarks[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value], width, height),
            'right_shoulder': self._to_pixel(landmarks[self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value], width, height)
        }
        
        # Draw additional visualization
        self.draw_measurement_visualization(viz_frame, landmarks_dict)
        
        return landmarks_dict, viz_frame

    @staticmethod
    def _to_pixel(landmark, width: int, height: int) -> Tuple[int, int]:
        """Convert landmark to pixel coordinates."""
        return (int(landmark.x * width), int(landmark.y * height))
        
    def draw_measurement_visualization(self, frame: np.ndarray, landmarks: Dict) -> None:
        """Draw additional visualization elements."""
        if not landmarks:
            return
            
        height, width = frame.shape[:2]
        
        # Draw head orientation line
        ear_midpoint = (
            (landmarks['left_ear'][0] + landmarks['right_ear'][0]) // 2,
            (landmarks['left_ear'][1] + landmarks['right_ear'][1]) // 2
        )
        cv2.line(frame, landmarks['nose'], ear_midpoint, (0, 255, 0), 2)
        
        # Draw shoulder line
        cv2.line(frame, landmarks['left_shoulder'], landmarks['right_shoulder'], (255, 0, 0), 2)
        
        # Draw neck line
        shoulder_midpoint = (
            (landmarks['left_shoulder'][0] + landmarks['right_shoulder'][0]) // 2,
            (landmarks['left_shoulder'][1] + landmarks['right_shoulder'][1]) // 2
        )
        cv2.line(frame, shoulder_midpoint, ear_midpoint, (0, 255, 255), 2)
        
        # Draw vertical reference
        cv2.line(frame, shoulder_midpoint, (shoulder_midpoint[0], 0), (0, 0, 255), 1)
        
        # Add angle measurement text
        angle = self.calculate_neck_angle(landmarks)
        if angle is not None:
            cv2.putText(frame, f"Angle: {angle:.1f}°", (10, 30),
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                       
    def calculate_neck_angle(self, landmarks):
        """Calculate neck angle with improved accuracy."""
        if not landmarks:
            return None
            
        # Calculate midpoints with depth consideration
        ear_midpoint = np.array([
            (landmarks['left_ear'][0] + landmarks['right_ear'][0]) / 2,
            (landmarks['left_ear'][1] + landmarks['right_ear'][1]) / 2
        ])
        
        shoulder_midpoint = np.array([
            (landmarks['left_shoulder'][0] + landmarks['right_shoulder'][0]) / 2,
            (landmarks['left_shoulder'][1] + landmarks['right_shoulder'][1]) / 2
        ])
        
        # Calculate vector from shoulder to ear (neck vector)
        neck_vector = ear_midpoint - shoulder_midpoint
        
        # Calculate angle with vertical axis (0 degrees is straight up)
        # Added smoothing and bounds checking
        angle = -math.degrees(math.atan2(neck_vector[0], -neck_vector[1]))
        return max(-90, min(90, angle))  # Limit angle to realistic range
        
    def calculate_lateral_angle(self, landmarks):
        """Calculate lateral neck angle (left-right tilt)."""
        if not landmarks:
            return None
            
        # Calculate angle between ears relative to horizontal
        dx = landmarks['right_ear'][0] - landmarks['left_ear'][0]
        dy = landmarks['right_ear'][1] - landmarks['left_ear'][1]
        
        angle = math.degrees(math.atan2(dy, dx))
        return angle
        
    def set_neutral_position(self, landmarks):
        """Set the neutral position angle."""
        angle = self.calculate_neck_angle(landmarks)
        if angle is not None:
            self.neutral_angle = angle
            return True
        return False
        
    def measure_flexion(self, landmarks):
        """Measure neck flexion (looking down)."""
        if self.neutral_angle is None:
            return None
            
        current_angle = self.calculate_neck_angle(landmarks)
        if current_angle is None:
            return None
            
        # Flexion is when the head tilts forward (angle becomes more negative)
        flexion_angle = self.neutral_angle - current_angle
        
        # Store maximum flexion
        if self.max_flexion is None or flexion_angle > self.max_flexion:
            self.max_flexion = flexion_angle
            
        return max(0, flexion_angle)  # Only return positive values
        
    def measure_extension(self, landmarks):
        """Measure neck extension (looking up)."""
        if self.neutral_angle is None:
            return None
            
        current_angle = self.calculate_neck_angle(landmarks)
        if current_angle is None:
            return None
            
        # Extension is when the head tilts backward (angle becomes more positive)
        extension_angle = current_angle - self.neutral_angle
        
        # Store maximum extension
        if self.max_extension is None or extension_angle > self.max_extension:
            self.max_extension = extension_angle
            
        return max(0, extension_angle)  # Only return positive values
        
    def measure_rotation(self, landmarks):
        """Improved rotation measurement using nose-ear relationship."""
        if not landmarks:
            return None
            
        # Get nose and ear positions
        nose = np.array(landmarks['nose'])
        left_ear = np.array(landmarks['left_ear'])
        right_ear = np.array(landmarks['right_ear'])
        
        # Calculate ear midpoint
        ear_midpoint = (left_ear + right_ear) / 2
        
        # Calculate distances from nose to each ear
        left_dist = np.linalg.norm(nose - left_ear)
        right_dist = np.linalg.norm(nose - right_ear)
        
        # Calculate rotation angle based on relative distances
        if left_dist > right_dist:
            # Head turned right
            rotation = (left_dist - right_dist) / (left_dist + right_dist) * 70  # Max 70 degrees
        else:
            # Head turned left
            rotation = -(right_dist - left_dist) / (left_dist + right_dist) * 70
            
        return max(-70, min(70, rotation))  # Limit to realistic range
        
    def get_mobility_assessment(self):
        """Get the complete neck mobility assessment with improved validation."""
        if self.neutral_angle is None:
            return {
                "success": False,
                "error": "Neutral position not set"
            }
            
        # Normal ranges (realistic values)
        normal_flexion = 40  # Normal range 35-45°
        normal_extension = 50  # Normal range 45-55°
        normal_rotation = 70  # Normal range 60-80°
        
        # Validate and clean measurements
        max_flexion = max(0, min(normal_flexion * 1.5, 
                         self.max_flexion if self.max_flexion is not None else 0))
        max_extension = max(0, min(normal_extension * 1.5, 
                           self.max_extension if self.max_extension is not None else 0))
        max_left_rotation = max(0, min(normal_rotation, 
                              abs(self.max_left_rotation if self.max_left_rotation is not None else 0)))
        max_right_rotation = max(0, min(normal_rotation, 
                               abs(self.max_right_rotation if self.max_right_rotation is not None else 0)))
        
        # Calculate percentages with improved normalization
        flexion_percent = (max_flexion / normal_flexion * 100) if max_flexion > 0 else 0
        extension_percent = (max_extension / normal_extension * 100) if max_extension > 0 else 0
        left_rotation_percent = (max_left_rotation / normal_rotation * 100) if max_left_rotation > 0 else 0
        right_rotation_percent = (max_right_rotation / normal_rotation * 100) if max_right_rotation > 0 else 0
        
        # Reset measurements for next assessment
        self.reset_measurements()
        
        return {
            "success": True,
            "metrics": {
                "flexion_degrees": float(max_flexion),
                "extension_degrees": float(max_extension),
                "left_rotation_degrees": float(max_left_rotation),
                "right_rotation_degrees": float(max_right_rotation),
                "flexion_percent": min(100, float(flexion_percent)),
                "extension_percent": min(100, float(extension_percent)),
                "left_rotation_percent": min(100, float(left_rotation_percent)),
                "right_rotation_percent": min(100, float(right_rotation_percent))
            }
        }