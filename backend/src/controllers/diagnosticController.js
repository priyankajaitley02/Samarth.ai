import Assessment from '../models/Assessment.js';
import TremorAssessment from '../models/TremorAssessment.js';
import SpeechPatternAssessment from '../models/SpeechPatternAssessment.js';
import ResponseTimeAssessment from '../models/ResponseTimeAssessment.js';
import NeckMobilityAssessment from '../models/NeckMobilityAssessment.js';
import GaitAnalysisAssessment from '../models/GaitAnalysisAssessment.js';
import FingerTappingAssessment from '../models/FingerTappingAssessment.js';
import FacialSymmetryAssessment from '../models/FacialSymmetryAssessment.js';
import EyeMovementAssessment from '../models/EyeMovementAssessment.js';
import mongoose from 'mongoose';

export const checkHealth = (req, res) => {
  try {
    // Check MongoDB connection status
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    res.status(200).json({
      success: true,
      message: 'API is running',
      version: '1.0',
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus,
        name: mongoose.connection.name || 'unknown'
      },
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
};

export const checkAssessments = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID is required' 
      });
    }
    
    // Check if user is allowed to view this data
    // For admin users or in development, we're more permissive
    const isAdmin = req.user.role === 'admin';
    const isDevEnv = process.env.NODE_ENV === 'development';
    const isOwnData = req.user._id.toString() === userId;
    
    if (!isAdmin && !isDevEnv && !isOwnData) {
      return res.status(403).json({ 
        success: false,
        message: 'You are not authorized to view this data' 
      });
    }
    
    // Query the Assessment collection
    const count = await Assessment.countDocuments({ userId });
    
    // Get a sample of documents for inspection (limited to 5)
    const samples = await Assessment.find({ userId }).limit(5).lean();
    
    // Get statistics by assessment type
    const assessmentsByType = await Assessment.aggregate([
      { $match: { userId } },
      { $group: {
        _id: '$type',
        count: { $sum: 1 },
        latestDate: { $max: '$timestamp' }
      }},
      { $sort: { count: -1 } }
    ]);
    
    // Check collection state
    const collectionInfo = await mongoose.connection.db.collection('assessments').stats();
    
    res.status(200).json({
      success: true,
      userId,
      count,
      samples,
      byType: assessmentsByType,
      collectionInfo: {
        documentCount: collectionInfo.count,
        storageSize: collectionInfo.storageSize,
        avgDocSize: collectionInfo.avgObjSize
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking assessments',
      error: error.message
    });
  }
};

export const checkSpecificAssessments = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Define models to check
    const models = {
      tremor: TremorAssessment,
      speechPattern: SpeechPatternAssessment,
      responseTime: ResponseTimeAssessment,
      neckMobility: NeckMobilityAssessment,
      gaitAnalysis: GaitAnalysisAssessment,
      fingerTapping: FingerTappingAssessment,
      facialSymmetry: FacialSymmetryAssessment,
      eyeMovement: EyeMovementAssessment
    };
    
    const results = {};
    
    // Check each model for the user's data
    for (const [type, Model] of Object.entries(models)) {
      try {
        const count = await Model.countDocuments({ userId });
        const sample = count > 0 ? await Model.findOne({ userId }).lean() : null;
        
        results[type] = {
          count,
          hasSample: !!sample,
          sample: sample ? { id: sample._id, timestamp: sample.timestamp } : null
        };
      } catch (modelError) {
        console.error(`Error checking ${type} assessments:`, modelError);
        results[type] = {
          error: modelError.message,
          count: 0,
          hasSample: false
        };
      }
    }
    
    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error checking specific assessments',
      error: error.message
    });
  }
};

export const migrateAssessmentData = async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    console.log(`Starting assessment data migration for user ${userId}...`);
    
    // Step 1: Find assessments across all collections
    const generalAssessments = await Assessment.find({ userId }).lean();
    
    const specializedCollections = {
      'tremor': TremorAssessment,
      'speechPattern': SpeechPatternAssessment,
      'responseTime': ResponseTimeAssessment,
      'neckMobility': NeckMobilityAssessment,
      'gaitAnalysis': GaitAnalysisAssessment,
      'fingerTapping': FingerTappingAssessment,
      'facialSymmetry': FacialSymmetryAssessment,
      'eyeMovement': EyeMovementAssessment
    };
    
    const stats = {
      general: generalAssessments.length,
      specialized: {},
      fixed: 0,
      errors: []
    };
    
    // Step 2: Check specialized collections
    for (const [type, Model] of Object.entries(specializedCollections)) {
      try {
        const specializedDocs = await Model.find({ userId }).lean();
        stats.specialized[type] = specializedDocs.length;
        
        // Ensure all specialized docs are also in general collection
        for (const doc of specializedDocs) {
          // Check if this doc exists in general collection
          const existsInGeneral = generalAssessments.some(
            gDoc => gDoc._id.toString() === doc._id.toString()
          );
          
          if (!existsInGeneral) {
            // Create a copy in the general collection
            const generalDoc = new Assessment({
              _id: doc._id,
              userId: doc.userId,
              type,
              data: doc.data || doc.metrics || {},
              metrics: doc.metrics || {},
              status: doc.status || 'COMPLETED',
              timestamp: doc.timestamp
            });
            
            await generalDoc.save();
            stats.fixed++;
          }
        }
      } catch (error) {
        console.error(`Error processing ${type} collection:`, error);
        stats.errors.push(`${type}: ${error.message}`);
      }
    }
    
    res.json({
      success: true,
      message: `Migration completed. Fixed ${stats.fixed} documents.`,
      stats
    });
  } catch (error) {
    console.error('Assessment migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during assessment migration',
      error: error.message
    });
  }
};

// Export the missing analyzeAssessmentSchema function
export const analyzeAssessmentSchema = async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    
    // Get a sample from each collection for this user
    const analysis = {
      generalCollection: {},
      specializedCollections: {}
    };
    
    // Analyze general collection
    const generalSample = await Assessment.findOne({ userId }).lean();
    if (generalSample) {
      analysis.generalCollection = {
        fields: Object.keys(generalSample),
        sample: generalSample
      };
    }
    
    // Analyze specialized collections
    const specializedCollections = {
      'tremor': TremorAssessment,
      'speechPattern': SpeechPatternAssessment,
      'responseTime': ResponseTimeAssessment,
      'neckMobility': NeckMobilityAssessment,
      'gaitAnalysis': GaitAnalysisAssessment,
      'fingerTapping': FingerTappingAssessment,
      'facialSymmetry': FacialSymmetryAssessment,
      'eyeMovement': EyeMovementAssessment
    };
    
    for (const [type, Model] of Object.entries(specializedCollections)) {
      const sample = await Model.findOne({ userId }).lean();
      if (sample) {
        analysis.specializedCollections[type] = {
          fields: Object.keys(sample),
          sample
        };
      }
    }
    
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error('Schema analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Error analyzing schema',
      error: error.message
    });
  }
};
