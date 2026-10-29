import cv2
import numpy as np
import tempfile
import os

def save_video_to_temp(video_bytes):
    """Save video bytes to a temporary file."""
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.mp4')
    temp_file.write(video_bytes)
    temp_file.close()
    return temp_file.name

def extract_frames(video_path, max_frames=90):
    """Extract frames from a video file."""
    frames = []
    cap = cv2.VideoCapture(video_path)
    
    frame_count = 0
    while cap.isOpened() and frame_count < max_frames:
        ret, frame = cap.read()
        if not ret:
            break
        frames.append(frame)
        frame_count += 1
        
    cap.release()
    
    # Clean up the temporary file
    os.unlink(video_path)
    
    return frames