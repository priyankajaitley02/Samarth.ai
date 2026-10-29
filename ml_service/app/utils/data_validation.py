import numpy as np

def validate_eye_tracking_data(metrics):
    """Validate eye tracking metrics for quality assurance."""
    validations = {
        'data_quality': True,
        'messages': []
    }

    # Check for excessive blinks
    blink_rate = sum(metrics['blinks']) / len(metrics['blinks'])
    if blink_rate > 0.3:  # More than 30% blinks
        validations['data_quality'] = False
        validations['messages'].append('Excessive blinking detected')

    # Check for data gaps
    if np.any(np.isnan(metrics['velocities'])):
        validations['data_quality'] = False
        validations['messages'].append('Missing data detected')

    # Check for unrealistic movements
    if np.max(metrics['velocities']) > 1000:  # Unrealistic velocity
        validations['data_quality'] = False
        validations['messages'].append('Unrealistic eye movements detected')

    return validations