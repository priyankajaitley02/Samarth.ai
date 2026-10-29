import { useState, useRef, useEffect } from 'react';
import { Box, Paper, Alert, Button } from '@mui/material';
import { CheckCircle } from '@mui/icons-material';
import AssessmentLayout from '../common/AssessmentLayout';
import { specializedAssessments } from '../../services/api';

const ResponseTime = ({ userId, onComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isAssessing, setIsAssessing] = useState(false);
  const [error, setError] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [showStimulus, setShowStimulus] = useState(false);
  const [responses, setResponses] = useState([]);
  const [round, setRound] = useState(0);
  const [saveStatus, setSaveStatus] = useState({ saving: false, error: null, success: false });
  const stimulusStartTime = useRef(null);
  const assessmentStartTime = useRef(null);
  const timeoutRef = useRef(null);
  const totalRounds = 5;

  const startAssessment = () => {
    setIsAssessing(true);
    setError(null);
    setResponses([]);
    setRound(0);
    setShowStimulus(false);
    assessmentStartTime.current = Date.now();
    scheduleNextStimulus();
  };

  const scheduleNextStimulus = () => {
    // Random delay between 1-3 seconds
    const delay = Math.random() * 2000 + 1000;
    timeoutRef.current = setTimeout(() => {
      stimulusStartTime.current = Date.now();
      setShowStimulus(true);
    }, delay);
  };

  const handleResponse = () => {
    if (!showStimulus) {
      // Early response - penalize
      setError('Too early! Wait for the green color.');
      return;
    }

    const responseTime = Date.now() - stimulusStartTime.current;
    const newResponses = [...responses, responseTime];
    setResponses(newResponses);
    setShowStimulus(false);
    setRound(prev => prev + 1);

    // Calculate and update metrics
    const currentMetrics = calculateMetrics(newResponses);
    setMetrics(currentMetrics);

    if (round + 1 >= totalRounds) {
      // Stop assessment but don't auto-save
      stopAssessmentAndShowResults(newResponses);
    } else {
      scheduleNextStimulus();
    }
  };

  const calculateMetrics = (responseData) => {
    if (responseData.length === 0) return null;

    const sortedTimes = [...responseData].sort((a, b) => a - b);
    const averageTime = responseData.reduce((a, b) => a + b, 0) / responseData.length;
    
    return {
      averageResponseTime: averageTime.toFixed(2),
      fastestResponse: sortedTimes[0].toFixed(2),
      slowestResponse: sortedTimes[sortedTimes.length - 1].toFixed(2),
      totalRounds: responseData.length,
      completedRounds: round + 1,
      duration: ((Date.now() - assessmentStartTime.current) / 1000).toFixed(1),
      assessmentType: 'responseTime'
    };
  };

  const stopAssessmentAndShowResults = (finalResponses = responses) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsAssessing(false);
    setShowStimulus(false);

    if (finalResponses.length > 0) {
      const finalMetrics = calculateMetrics(finalResponses);
      setMetrics(finalMetrics);
      // Don't save automatically - user will click the Complete Assessment button
    }
  };

  const stopAssessment = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsAssessing(false);
    setShowStimulus(false);
  };

  // New function to handle saving assessment
  const handleSaveAssessment = async () => {
    if (!metrics) return;
    
    try {
      setSaveStatus({ saving: true, error: null, success: false });
      
      const assessmentData = {
        userId,
        type: 'responseTime',
        timestamp: new Date().toISOString(),
        metrics: metrics,
        responses: responses // Include raw response times
      };
      
      console.log('Assessment completed:', assessmentData);
      
      const response = await specializedAssessments.responseTime.save(assessmentData);
      
      if (!response.data || !response.data.success) {
        throw new Error(response.data?.error || 'Failed to save response time assessment');
      }
      
      console.log('Response time assessment saved successfully:', response.data);
      setSaveStatus({ saving: false, error: null, success: true });
      
      // Call onComplete with the assessment data
      if (onComplete) {
        onComplete({
          ...assessmentData,
          id: response.data.data?._id || response.data.data?.id
        });
      }
      
      return response.data;
    } catch (error) {
      console.error('Error saving response time assessment:', error);
      setSaveStatus({ saving: false, error: error.message, success: false });
      return null;
    }
  };

  // Add a function to render the save status
  const renderSaveStatus = () => {
    if (saveStatus.saving) {
      return (
        <Alert severity="info" sx={{ mt: 2 }}>
          Saving assessment results...
        </Alert>
      );
    }
    if (saveStatus.error) {
      return (
        <Alert severity="error" sx={{ mt: 2 }}>
          Failed to save: {saveStatus.error}
        </Alert>
      );
    }
    if (saveStatus.success) {
      return (
        <Alert severity="success" sx={{ mt: 2 }}>
          Assessment saved successfully!
        </Alert>
      );
    }
    return null;
  };

  return (
    <AssessmentLayout
      title="Response Time Assessment"
      description={`Test your reaction time by clicking as soon as you see the green color appear. You will have ${totalRounds} rounds.`}
      isLoading={isLoading}
      isAssessing={isAssessing}
      error={error}
      onStart={startAssessment}
      onStop={stopAssessment}
      metrics={metrics}
    >
      {isAssessing ? (
        <Paper
          onClick={handleResponse}
          sx={{
            width: '100%',
            maxWidth: 400,
            height: 300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            bgcolor: showStimulus ? 'success.light' : 'background.paper',
            transition: 'background-color 0.1s ease-out'
          }}
        >
          <Box sx={{ textAlign: 'center', color: 'text.primary' }}>
            {showStimulus ? 'Click Now!' : 'Wait for green...'}
          </Box>
        </Paper>
      ) : (
        <Paper
          sx={{
            width: '100%',
            maxWidth: 400,
            height: 300,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2
          }}
        >
          {!metrics ? (
            <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
              Click Start Assessment to begin
            </Box>
          ) : (
            <>
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <h3>Your Results</h3>
                <p>Average: {metrics.averageResponseTime}ms</p>
                <p>Fastest: {metrics.fastestResponse}ms</p>
                <p>Slowest: {metrics.slowestResponse}ms</p>
                <p>Rounds: {metrics.completedRounds}/{metrics.totalRounds}</p>
              </Box>
              
              {renderSaveStatus()}
              
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<CheckCircle />}
                  onClick={handleSaveAssessment}
                  disabled={saveStatus.saving || saveStatus.success}
                >
                  {saveStatus.saving ? 'Saving...' : 
                   saveStatus.success ? 'Assessment Completed' : 
                   'Complete Assessment'}
                </Button>
              </Box>
            </>
          )}
        </Paper>
      )}
    </AssessmentLayout>
  );
};

export default ResponseTime;