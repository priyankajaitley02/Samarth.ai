import Assessment from '../models/Assessment.js';
import TremorAssessment from '../models/TremorAssessment.js';
import SpeechPatternAssessment from '../models/SpeechPatternAssessment.js';
import ResponseTimeAssessment from '../models/ResponseTimeAssessment.js';
import NeckMobilityAssessment from '../models/NeckMobilityAssessment.js';
import GaitAnalysisAssessment from '../models/GaitAnalysisAssessment.js';
import FingerTappingAssessment from '../models/FingerTappingAssessment.js';
import FacialSymmetryAssessment from '../models/FacialSymmetryAssessment.js';
import EyeMovementAssessment from '../models/EyeMovementAssessment.js';
import StroopAssessment from '../models/StroopAssessment.js';
import HyperventilationAssessment from '../models/HyperventilationAssessment.js';
import NeuroBotAssessment from '../models/NeuroBotAssessment.js';
import EpilepsyTest from '../models/EpilepsyTest.js';
import Test from '../models/Test.js';
import Score from '../models/Score.js';

const assessmentTypeAliases = new Map([
  ['GAIT_ANALYSIS', 'gaitAnalysis'],
  ['gait_analysis', 'gaitAnalysis'],
  ['BALANCE_ANALYSIS', 'balanceAnalysis'],
  ['POSTURAL_ANALYSIS', 'posturalAnalysis'],
  ['EYE_MOVEMENT', 'eyeMovement'],
  ['NECK_MOBILITY', 'neckMobility'],
  ['FACIAL_SYMMETRY', 'facialSymmetry'],
  ['TREMOR', 'tremor'],
  ['RESPONSE_TIME', 'responseTime'],
  ['SPEECH_PATTERN', 'speechPattern'],
  ['FINGER_TAPPING', 'fingerTapping'],
  ['HYPERVENTILATION_TEST', 'hyperventilation'],
  ['CONVERSATIONAL_SCREENING', 'neurobot'],
  ['conversationalBot', 'neurobot'],
  ['conversationalScreening', 'neurobot'],
  ['neurobot', 'neurobot'],
  ['word_list', 'wordlist'],
  ['wordlist', 'wordlist']
]);

export const normalizeAssessmentType = (type) => assessmentTypeAliases.get(type) || type;

export const formatAssessmentHistoryRecord = (record, fallbackType) => {
  const source = record.toObject ? record.toObject() : record;
  const type = normalizeAssessmentType(source.type || fallbackType);
  let metrics = source.metrics || source.summaryMetrics || {};

  if (type === 'stroop') {
    metrics = {
      ...metrics,
      score: source.score ?? metrics.score,
      total: source.total ?? metrics.total,
      accuracy: source.accuracy ?? metrics.accuracy
    };
  }

  if (type === 'eyeMovement' && !metrics.overall && metrics.metrics?.overall) {
    metrics = metrics.metrics;
  }

  return {
    ...source,
    type,
    timestamp: source.timestamp || source.startedAt || source.startTs || source.createdAt,
    metrics
  };
};

const historySources = [
  [TremorAssessment, 'tremor'],
  [SpeechPatternAssessment, 'speechPattern'],
  [ResponseTimeAssessment, 'responseTime'],
  [NeckMobilityAssessment, 'neckMobility'],
  [GaitAnalysisAssessment, 'gaitAnalysis'],
  [FingerTappingAssessment, 'fingerTapping'],
  [FacialSymmetryAssessment, 'facialSymmetry'],
  [EyeMovementAssessment, 'eyeMovement'],
  [StroopAssessment, 'stroop'],
  [HyperventilationAssessment, 'hyperventilation'],
  [NeuroBotAssessment, 'neurobot']
];

export const getAssessmentHistory = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const requestedType = req.query.type ? normalizeAssessmentType(req.query.type) : null;
    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 100;
    const queryLimit = Math.min(limit, 500);

    const queryTasks = [
      Assessment.find({ userId, status: 'COMPLETED' }).sort({ timestamp: -1 }).limit(queryLimit).lean(),
      ...historySources.map(([Model]) => {
        const statusFilter = Model === EyeMovementAssessment
          ? { $or: [{ status: 'COMPLETED' }, { status: { $exists: false } }] }
          : { status: 'COMPLETED' };
        return Model.find({ userId, ...statusFilter })
          .sort({ timestamp: -1 })
          .limit(queryLimit)
          .lean();
      }),
      Test.find({ userId, status: 'COMPLETED' }).sort({ endTs: -1, startTs: -1 }).limit(queryLimit).lean()
    ];

    if (userId.match(/^[a-f\d]{24}$/i)) {
      queryTasks.push(
        EpilepsyTest.find({ userId, status: 'completed' }).sort({ startedAt: -1 }).limit(queryLimit).lean()
      );
    }

    const queryResults = await Promise.all(queryTasks);
    const records = [];

    queryResults[0].forEach(record => records.push(formatAssessmentHistoryRecord(record)));
    historySources.forEach(([, fallbackType], index) => {
      queryResults[index + 1].forEach(record => records.push(formatAssessmentHistoryRecord(record, fallbackType)));
    });

    const testRecords = queryResults[historySources.length + 1];
    if (testRecords.length > 0) {
      const testIds = testRecords.map(test => test._id.toString());
      const scores = await Score.find({ testId: { $in: testIds } }).lean();
      const scoresByTest = new Map();
      scores.forEach(score => {
        const testScores = scoresByTest.get(score.testId) || {};
        testScores[score.metric] = score.value;
        scoresByTest.set(score.testId, testScores);
      });

      testRecords.forEach(test => records.push(formatAssessmentHistoryRecord({
        ...test,
        type: test.testType || 'wordlist',
        timestamp: test.endTs || test.startTs,
        metrics: scoresByTest.get(test._id.toString()) || test.metadata || {}
      }, 'wordlist')));
    }

    const epilepsyTests = queryResults[historySources.length + 2] || [];
    const persistedHyperventilationTestIds = new Set(
      queryResults[historySources.length - 1]
        .map(record => record.testId?.toString())
        .filter(Boolean)
    );
    epilepsyTests
      .filter(test => !persistedHyperventilationTestIds.has(test._id.toString()))
      .forEach(test => records.push(formatAssessmentHistoryRecord(test, 'hyperventilation')));

    const filteredRecords = records
      .filter(record => !requestedType || normalizeAssessmentType(record.type) === requestedType)
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, limit);

    return res.json({ success: true, data: filteredRecords });
  } catch (error) {
    console.error('Error getting assessment history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch assessment history'
    });
  }
};
