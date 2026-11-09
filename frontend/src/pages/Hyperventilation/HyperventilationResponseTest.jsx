import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Typography, Paper, CircularProgress } from '@mui/material';
import HyperventilationSignalGraph from './HyperventilationSignalGraph';
import HyperventilationCautionModal from './HyperventilationCautionModal';
import HyperventilationTestResults from './HyperventilationTestResults';
import useHyperventilationEEGStream from './useHyperventilationEEGStream';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api.js';

const DEFAULT_PHASES = [
  { name: 'baseline', min: 10, max: 30, default: 10 },
  { name: 'hyperventilation', min: 15, max: 30, default: 15 },
  { name: 'recovery', min: 10, max: 30, default: 10 }
];

const HyperventilationResponseTest = ({ userId: propUserId } = {}) => {
  const { user } = useAuth();
  const [testId, setTestId] = useState(null);
  const [phaseIndex, setPhaseIndex] = useState(-1); // -1 = intro, 0..2 phases, 3 = complete
  const [timers, setTimers] = useState(DEFAULT_PHASES.map(p => p.default));
  const [countdown, setCountdown] = useState(0);
  const [runningPhase, setRunningPhase] = useState(false);
  const [showCaution, setShowCaution] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const { eegData, bands, spikeDetected, connected, connect, disconnect } = useHyperventilationEEGStream(testId); // Only EEG
  const [creating, setCreating] = useState(false);
  const [requestError, setRequestError] = useState('');

  ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

  const bandsChartData = {
    labels: ['delta', 'theta', 'alpha', 'beta', 'gamma'],
    datasets: [{
      label: 'Band Power',
      data: [bands?.delta || 0, bands?.theta || 0, bands?.alpha || 0, bands?.beta || 0, bands?.gamma || 0],
      backgroundColor: ['#3f51b5','#2196f3','#4caf50','#ff9800','#9c27b0']
    }]
  };

  useEffect(() => {
    let t = null;
    if (runningPhase && countdown > 0) {
      t = setTimeout(() => setCountdown(c => c - 1), 1000);
    } else if (runningPhase && countdown === 0) {
      // auto-end phase
      handlePhaseAction('end');
    }
    return () => clearTimeout(t);
  }, [runningPhase, countdown]);

  const createTest = async () => {
    try {
      setCreating(true);
      setRequestError('');
      setShowCaution(false); // Close modal after agreement
      const actualUserId = propUserId || user?.id || user?._id;
      const { data } = await api.post('/tests/hyperventilation/start', { userId: actualUserId });

      if (data?.testId) {
        setTestId(data.testId);
        // connect ws after test created with explicit testId to avoid stale state
        connect(data.testId);
        setPhaseIndex(0);
      } else {
        throw new Error('The server did not return a test ID.');
      }
    } catch (error) {
      console.error('Unable to start hyperventilation test:', error);
      setRequestError(error.response?.data?.message || 'Unable to start the test. Please check your connection and sign in again.');
    } finally { setCreating(false); }
  };

  const handlePhaseAction = async (action) => {
    if (phaseIndex < 0 || phaseIndex > 2) return;
    const phase = DEFAULT_PHASES[phaseIndex].name;
    const ts = new Date().toISOString();
    try {
      await api.post('/tests/hyperventilation/phase', { testId, phase, action, timestamp: ts });
      setRequestError('');
    } catch (error) {
      console.error('Unable to update hyperventilation phase:', error);
      setRequestError(error.response?.data?.message || 'Unable to save the phase update. Please retry before continuing.');
      return;
    }

    if (action === 'start') {
      setCountdown(timers[phaseIndex]);
      setRunningPhase(true);
    } else if (action === 'end') {
      setRunningPhase(false);
      // advance to next phase or complete
      if (phaseIndex < 2) setPhaseIndex(phaseIndex + 1);
      else setPhaseIndex(3);
    }
  };

  const stopTest = async () => {
    let completed = false;
    try {
      setLoadingResults(true);
      const { data: json } = await api.post('/tests/hyperventilation/complete', { testId });
      console.log('Complete test response:', json);
      
      if (json?.success && json.summary) {
        console.log('Setting test results:', json.summary);
        setTestResults(json.summary);
        completed = true;
        setRequestError('');
      } else if (json?.success === false) {
        console.error('Test completion failed:', json.message, json.debug);
        setRequestError(json.message || 'The server could not save the completed test.');
        setTestResults(null);
      } else {
        console.error('Unexpected response format or error:', json);
        setRequestError('The server returned an unexpected response. Please retry completing the test.');
        setTestResults(null);
      }
    } catch (error) {
      console.error('stopTest error:', error);
      const message = error.response?.data?.message || error.message;
      setRequestError('Test completion failed: ' + message);
      setTestResults(null);
    } finally {
      setLoadingResults(false);
      setRunningPhase(false);
      if (completed) {
        setPhaseIndex(3);
        disconnect();
      }
    }
  };

  return (
    <Box>
      <HyperventilationCautionModal
        open={showCaution}
        onProceed={createTest}
        onCancel={() => setShowCaution(false)}
      />
      <Paper sx={{ p: 2 }}>
        {requestError && <Alert severity="error" sx={{ mb: 2 }}>{requestError}</Alert>}
        {phaseIndex === -1 && (
          <Box>
            <Typography variant="h5">Hyperventilation Response Test</Typography>
            <Typography sx={{ mt: 1 }}>This test records EEG through three phases to observe any provoked abnormalities. This is not a diagnostic test.</Typography>
            <Typography sx={{ mt: 1, color: 'error.main' }}>Safety: Stop immediately if you feel dizzy, faint, or unwell.</Typography>
            <Button variant="contained" sx={{ mt: 2 }} onClick={() => setShowCaution(true)} disabled={creating}>Start Test</Button>
          </Box>
        )}

        {phaseIndex >= 0 && phaseIndex <= 2 && (
          <Box>
            <Typography variant="h6">Phase: {DEFAULT_PHASES[phaseIndex].name}</Typography>
            <Typography>Time remaining: {new Date(countdown * 1000).toISOString().substr(14, 5)}</Typography>
            <Typography sx={{ mt: 1 }} color={runningPhase ? 'success.main' : 'text.secondary'}>
              {runningPhase
                ? `Saving the electrode waveform for this phase. ${eegData.length} samples captured.`
                : 'The live waveform is stored when you press Start Phase. End Test then builds the report from those saved samples.'}
            </Typography>
            {DEFAULT_PHASES[phaseIndex].name === 'hyperventilation' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="h5" color="error">Breathe deeply and rapidly for the next {timers[phaseIndex]} seconds</Typography>
                <Button variant="contained" color="error" sx={{ mt: 1 }} onClick={() => { setCountdown(0); handlePhaseAction('end'); }}>STOP IMMEDIATELY</Button>
              </Box>
            )}

            <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1 }}>
                <HyperventilationSignalGraph eegData={eegData} connected={connected} />
              </Box>

              <Paper sx={{ width: 320, p: 2 }}>
                <Typography variant="subtitle1">Band Powers</Typography>
                <div style={{ height: 160 }}>
                  <Bar data={bandsChartData} options={{ plugins: { legend: { display: false } }, maintainAspectRatio: false }} />
                </div>
                <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2">Spike</Typography>
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: spikeDetected ? 'red' : 'grey.400', boxShadow: spikeDetected ? '0 0 8px red' : 'none', transition: 'all 200ms' }} />
                  </Box>
                </Box>
              </Paper>
            </Box>

            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              {!runningPhase ? (
                <Button variant="contained" onClick={() => handlePhaseAction('start')}>Start Phase</Button>
              ) : (
                <Button variant="outlined" onClick={() => handlePhaseAction('end')}>End Phase</Button>
              )}
              <Button onClick={stopTest} color="error" disabled={loadingResults}>End Test</Button>
            </Box>
          </Box>
        )}

        {phaseIndex === 3 && (
          <Box>
            {loadingResults ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <CircularProgress />
                <Typography>Processing your test results...</Typography>
              </Box>
            ) : testResults ? (
              <HyperventilationTestResults summary={testResults} />
            ) : (
              <Box>
                <Typography variant="h6">Test Complete</Typography>
                <Typography sx={{ mt: 2 }}>Results are being processed. Please wait.</Typography>
              </Box>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default HyperventilationResponseTest;
