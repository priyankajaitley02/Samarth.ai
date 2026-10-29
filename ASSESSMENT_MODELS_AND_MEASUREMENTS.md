# SamarthApp AI Models and Assessment Measurements

This note explains what the inspected project code currently configures and
calculates. It describes software behavior, not a medical interpretation or
validation of the methods.

## AI and computer-vision models

There is not one AI model for every assessment. The project combines language
models, computer-vision models, and conventional signal-processing code.

| Model or service | Project use | What the code shows |
|---|---|---|
| Gemini `gemini-3.6-flash` | NeuroBot's question-and-answer screening and generated report | `backend/.env` currently sets both `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` to `gemini-3.6-flash`. The report service sends screening answers to Gemini and asks for a summary, a Low/Medium/High risk level, reasoning, and recommendations. The service skips failover when primary and fallback names are equal, so this configuration does not provide a different-model fallback. If environment settings are absent, the service's primary default is `gemini-2.5-flash`. The API key remains server-side. |
| LLM Worker API (model not identified in source) | Combined analysis of saved assessments, via the backend AI analysis service | `backend/src/services/aiService.js` posts a compiled assessment prompt to `LLM_API_URL` using `LLM_API_KEY`. The source does not identify the provider's actual model. Its exact model cannot be confirmed from this repository code alone. |
| MediaPipe Face Mesh | Eye-movement video analysis in `ml_service` | Tracks eye landmarks frame-to-frame. The service derives eye positions, movement velocity, saccades, fixation, pursuit, and blink-related measurements. The code names the MediaPipe Face Mesh solution, but does not pin a separate model artifact/version. |
| Face-api.js TinyFaceDetector and FaceLandmark68Net | Face detection and landmark features in the frontend ML service | The code loads these model families from `/models`; the repository code does not establish the exact weight files or training versions. |
| TensorFlow.js pose detection: BlazePose and MoveNet | Pose/gait/balance features in selected frontend assessment and therapy services | The code selects BlazePose Full in gait/balance/postural services and MoveNet Lightning or Thunder in some therapy flows. These are not used to calculate the EEG or IMU tremor FFT metrics described below. |

The conventional tremor, EEG, and foot-pressure calculations described below
do not call Gemini. They are implemented as deterministic signal-processing
and threshold calculations. A language model may summarize assessment data
afterward, but that is a separate step.

## Tremor: frequency and amplitude

The backend buffers sensor samples and uses FFT/PSD calculations to estimate a
dominant oscillation frequency and an amplitude-like value. For ESP32 batches,
it first derives gyro magnitude from `gx`, `gy`, and `gz`. The configured
default sampling rate is 200 Hz, with analysis windows of up to 1,024 samples
(about 5.12 seconds at 200 Hz); at least 400 samples are required in one
single-sample path.

Why the metrics are calculated:

- **Frequency (Hz)** estimates how many oscillation cycles occur per second.
  The code uses it to assign a tremor-type label.
- **Amplitude-like magnitude** estimates the size/strength of the oscillation
  in the incoming sensor scale. It contributes to a software score.
- The computed measurements are broadcast live and can be saved with a
  tremor assessment. They are not, by themselves, a diagnosis.

The frequency-to-label mapping in `backend/src/services/tremorService.js` is:

| Dominant frequency | Code label |
|---|---|
| No positive frequency | `None` |
| Below 2 Hz | `Very Slow` |
| 2 Hz to below 4 Hz | `Slow Tremor` |
| 4 Hz to below 7 Hz | `Resting` |
| 7 Hz to below 12 Hz | `Postural` |
| 12 Hz or higher | `Action/Intention` |

These are labels assigned by this code, not validated clinical cutoffs.
Notably, the `Resting` label is assigned from frequency alone; the code path
does not establish that the person's hand was actually at rest. Clinical
tremor classification also depends on the task/posture, sensor placement,
signal quality, and professional assessment.

The service computes a heuristic score:

```text
frequencyFactor = min(100, frequencyHz * 8.33)
amplitudeFactor = min(100, amplitude)
score = 0.4 * frequencyFactor + 0.6 * amplitudeFactor
```

In the live path, the code labels scores of 40 or greater `Moderate`, and
lower scores `Mild`. The sample scale is not calibrated to a documented
physical unit in this code, and the two ingestion paths estimate amplitude
differently (FFT magnitude versus square root of PSD). Therefore, the numeric
amplitude and severity labels should not be treated as standardized clinical
measurements without device calibration and validation.

## EEG bands, spikes, and hyperventilation

### Why calculate frequency bands?

EEG is a time-varying electrical signal. Converting a window to a frequency
representation lets software summarize how much signal energy falls within
selected frequency ranges. Broad EEG-band names are useful descriptors of
frequency content; a band's value alone does not identify a disease or a
person's mental state.

The FFT-based `computeBandPowers` function in
`backend/src/services/neuroService.js` uses these ranges:

| Band | Code frequency range |
|---|---:|
| Delta | 0.5 to below 4 Hz |
| Theta | 4 to below 8 Hz |
| Alpha | 8 to below 13 Hz |
| Beta | 13 to below 30 Hz |
| Gamma | 30 to below 45 Hz |

It sums squared FFT magnitudes in each range and divides by the FFT length.
The source does not supply a calibration that converts these outputs to
physical EEG power units. Electrode placement/reference, sampling rate,
amplifier calibration, artifacts, and the processing window all affect
interpretation.

**Implementation limitation:** The hyperventilation completion controller has
a separate function also named `calculateBandPowers`. That function does not
perform a frequency transform: it classifies centered sample magnitudes into
value ranges (5-40, 40-80, 80-130, 130-300, and 300+) and reports percentages.
Those are sample-amplitude bins labelled with EEG band names, not FFT-derived
frequency-band power. The live stream's FFT-based values and this completion
path should not be assumed to have identical meaning.

### Spike indicators

Spike logic is also implementation-specific:

- The serial EEG stream's detector in `neuroService.js` looks for a recent
  sample above `mean + 5 * standard deviation` and a preceding-sample slope
  above `2 * standard deviation`. It broadcasts a boolean `spikeDetected`.
- The hyperventilation completion controller counts centered samples whose
  absolute value exceeds `2.5 * standard deviation` as spikes. This is a
  different rule and can count individual samples rather than distinct
  waveform events.

These are software heuristics; the repository does not establish a
clinically validated EEG spike detector. The frontend's boolean indicator
does not include spike locations.

### Why the breathing phases exist

The hyperventilation interface defines baseline, hyperventilation, and
recovery phases. The code compares selected measurements across phases,
including band-labelled values and spike counts, to describe how the signal
changes during and after the breathing challenge. The intended comparison is
within the same session rather than treating one isolated value as a
diagnosis.

The source contains heuristic comparisons (for example, alpha change over
10/15 percentage points and spike-count changes over 5/10) and also stores a
separate risk level based on total counted spikes (`>5` moderate, `>10` high).
These rules are not shown in the repository as clinically validated
thresholds, and some values called band powers come from the sample-magnitude
binning described above. The code's labels must not be interpreted as a
diagnosis of epilepsy.

Hyperventilation can provoke symptoms and alter physiology. This activity
should only be performed under an appropriate clinical protocol and
supervision; do not use this document as instructions to perform it.

## Foot pressure in gait assessment

The pressure-related code is part of gait/foot analysis, not the tremor or EEG
pipeline. `backend/src/services/sensorMetricsService.js` processes six FSR
(force-sensitive resistor) readings per foot. It uses these readings to
estimate:

- relative loading by sensor and by heel, midfoot, and forefoot zones;
- heel-strike and toe-contact/toe-off event intervals;
- left/right loading asymmetry;
- medial-versus-lateral loading (labelled pronation/supination tendency); and
- an approximate center-of-pressure path.

This helps describe where and when each foot is loaded during recorded steps.
The code uses heuristic event thresholds such as 60% of peak heel reading for
heel strike, 50% of peak toe reading for toe contact, and a sensor reading
over 50 for active contact. `backend/src/services/hybridMetricsMerger.js`
also displays a heel/forefoot reference range of 25-35% / 65-75%.

The code does not establish calibration from FSR counts to physical pressure
units, and the reference range's clinical source is not provided here.
Consequently, describe these as relative sensor readings and software
comparisons, not calibrated pressure or a diagnosis.

## Eye-movement testing

The eye-movement test records four target-following phases:

- Calibration: 3 seconds, look straight ahead.
- Saccadic: 6 seconds, follow a jumping dot.
- Pursuit: 6 seconds, follow a moving dot.
- Fixation: 3 seconds, focus on a central dot.

The Python `EyeTracker` uses MediaPipe Face Mesh landmarks and frame-to-frame
changes to calculate metrics such as movement velocity, saccade count,
fixation count, blink count, eye aspect ratio, pursuit smoothness, and a
software accuracy score. Its code assumes 30 frames per second when
converting landmark displacement to velocity. Example implementation
thresholds include 100 for saccade velocity, an eye-aspect-ratio blink
threshold of 0.25, 200 ms for saccade latency, and 0.85 for pursuit
smoothness.

These measurements describe eye movement while following the task targets.
The repository includes heuristic indicator labels, but they are not a
standalone clinical diagnosis. Threshold definitions are not completely
uniform across frontend configuration and Python analysis; camera frame rate,
lighting, head motion, calibration, and landmark tracking can affect results.

## Report generation and interpretation

The NeuroBot Gemini service receives the screening answers and requests a
structured screening report. It validates that the response contains the
expected summary, risk-level string, reasoning, and recommendations, then
returns/persists that result with a generation status. Gemini is generating
language from the supplied answers; it is not the algorithm calculating the
FFT, pressure, or camera measurements.

The separate assessment-wide AI service sends collected assessment metrics
to the configured LLM Worker API. Its exact model is not named in the checked
source, so it cannot be identified here.

An AI-generated report is an aid to summarizing screening information, not a
confirmed diagnosis. Its output depends on the quality and validity of the
measurements and screening answers provided. A qualified clinician must
interpret concerning symptoms or results.

## Source files reviewed

- `backend/.env`
- `backend/src/services/neuroBot.service.js`
- `backend/src/services/aiService.js`
- `backend/src/services/tremorService.js`
- `backend/src/services/tremorAnalyzer.js`
- `backend/src/services/neuroService.js`
- `backend/src/controllers/hyperventilationTestController.js`
- `backend/src/services/sensorMetricsService.js`
- `backend/src/services/hybridMetricsMerger.js`
- `ml_service/app/main.py`
- `ml_service/app/models/eye_tracking.py`
- `frontend/src/components/assessments/EyeMovement/constants/assessmentConfig.js`
- `frontend/src/services/mlService.js`
