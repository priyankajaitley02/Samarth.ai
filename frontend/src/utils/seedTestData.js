import api from '../services/api';
import { assessmentTypes } from '../services/assessmentService';

/**
 * Seeds mock assessment data for the currently logged-in user
 * @param {string} userId - The ID of the user to create assessments for
 * @returns {Promise<Array>} Array of created assessment objects
 */
export const seedTestAssessments = async (userId) => {
  if (!userId) {
    console.error('Cannot seed test data: No user ID provided');
    return [];
  }

  console.log(`Seeding test assessment data for user ${userId}...`);
  
  try {
    // Create an array to hold all created assessments
    const createdAssessments = [];
    
    // 1. Create a Tremor Assessment
    const tremorData = {
      userId,
      type: 'tremor',
      metrics: {
        tremor_frequency: 4.2 + Math.random(),
        tremor_amplitude: 0.5 + Math.random() * 0.3,
        tremor_type: 'Resting',
        severity: 'Mild',
        overall: {
          tremorScore: 7.5 + Math.random()
        }
      },
      data: {},
      timestamp: new Date(Date.now() - Math.random() * 1000000).toISOString()
    };
    
    // 2. Create a Speech Pattern Assessment
    const speechData = {
      userId,
      type: 'speechPattern',
      metrics: {
        clarity: { score: 8.2 + Math.random() },
        speechRate: { wordsPerMinute: 150 + Math.floor(Math.random() * 30) },
        volumeControl: { score: 7.0 + Math.random() },
        overallScore: 7.5 + Math.random()
      },
      data: {},
      timestamp: new Date(Date.now() - Math.random() * 2000000).toISOString()
    };
    
    // 3. Create a Response Time Assessment
    const responseTimeData = {
      userId,
      type: 'responseTime',
      metrics: {
        averageResponseTime: 350 + Math.random() * 50,
        fastestResponse: 280 + Math.random() * 20,
        slowestResponse: 450 + Math.random() * 100,
        accuracy: 92 + Math.random() * 8,
        consistency: 85 + Math.random() * 10,
        overall: {
          responseScore: 8.3 + Math.random()
        }
      },
      data: {},
      timestamp: new Date(Date.now() - Math.random() * 3000000).toISOString()
    };
    
    // 4. Create a Neck Mobility Assessment
    const neckMobilityData = {
      userId,
      type: 'neckMobility',
      metrics: {
        flexion: 50 + Math.random() * 10,
        extension: 55 + Math.random() * 8,
        rotation: 70 + Math.random() * 15,
        lateralBending: 40 + Math.random() * 10,
        overall: {
          mobilityScore: 8.2 + Math.random()
        }
      },
      data: {},
      timestamp: new Date(Date.now() - Math.random() * 4000000).toISOString()
    };
    
    // 5. Create a Finger Tapping Assessment
    const fingerTappingData = {
      userId,
      type: 'fingerTapping',
      metrics: {
        frequency: 5.5 + Math.random(),
        amplitude: 8.2 + Math.random(),
        rhythm: 7.8 + Math.random(),
        accuracy: 92 + Math.random() * 7,
        overallScore: 8.1 + Math.random()
      },
      data: {},
      timestamp: new Date(Date.now() - Math.random() * 5000000).toISOString()
    };
    
    // Submit them to the API
    console.log('Submitting test data...');
    const responses = await Promise.all([
      api.post('/assessments', tremorData),
      api.post('/assessments', speechData),
      api.post('/assessments', responseTimeData),
      api.post('/assessments', neckMobilityData),
      api.post('/assessments', fingerTappingData)
    ]);
    
    responses.forEach((response, index) => {
      if (response.data && response.data.data) {
        createdAssessments.push(response.data.data);
        console.log(`Created assessment ${index + 1} successfully`);
      }
    });
    
    console.log(`Created ${createdAssessments.length} test assessments!`);
    
    return createdAssessments;
  } catch (error) {
    console.error('Error seeding test data:', error);
    throw error;
  }
};

/**
 * Checks if user has any assessments, if not, seeds test data
 * @param {string} userId - The ID of the user to check
 * @returns {Promise<boolean>} True if seeded, false otherwise
 */
export const seedIfNoAssessments = async (userId) => {
  try {
    // Check if the user has any assessments
    const response = await api.get(`/assessments/history?userId=${userId}`);
    const assessments = response.data.data || [];
    
    if (assessments.length === 0) {
      console.log('No assessments found for user. Seeding test data...');
      await seedTestAssessments(userId);
      return true;
    } else {
      console.log(`Found ${assessments.length} existing assessments. No need to seed.`);
      return false;
    }
  } catch (error) {
    console.error('Error checking for existing assessments:', error);
    return false;
  }
};
