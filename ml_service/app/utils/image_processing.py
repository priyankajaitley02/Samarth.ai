import cv2
import numpy as np
from PIL import Image
import io

def read_image_file(file_contents: bytes) -> np.ndarray:
    """Convert uploaded file contents to OpenCV image."""
    nparr = np.frombuffer(file_contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return img

def convert_to_rgb(image: np.ndarray) -> np.ndarray:
    """Convert BGR image to RGB."""
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

def normalize_landmarks(landmarks, image_width, image_height):
    """Normalize landmarks to 0-1 range."""
    normalized = []
    for landmark in landmarks:
        normalized.append({
            'x': landmark.x / image_width,
            'y': landmark.y / image_height,
            'z': landmark.z
        })
    return normalized