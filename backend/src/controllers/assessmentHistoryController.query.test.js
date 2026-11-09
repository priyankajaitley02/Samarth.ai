import { beforeEach, describe, expect, it, vi } from 'vitest';

const { models } = vi.hoisted(() => ({
  models: Object.fromEntries([
    'Assessment',
    'TremorAssessment',
    'SpeechPatternAssessment',
    'ResponseTimeAssessment',
    'NeckMobilityAssessment',
    'GaitAnalysisAssessment',
    'FingerTappingAssessment',
    'FacialSymmetryAssessment',
    'EyeMovementAssessment',
    'StroopAssessment',
    'HyperventilationAssessment',
    'NeuroBotAssessment',
    'EpilepsyTest',
    'Test',
    'Score'
  ].map(name => [name, { find: vi.fn() }]))
}));

vi.mock('../models/Assessment.js', () => ({ default: models.Assessment }));
vi.mock('../models/TremorAssessment.js', () => ({ default: models.TremorAssessment }));
vi.mock('../models/SpeechPatternAssessment.js', () => ({ default: models.SpeechPatternAssessment }));
vi.mock('../models/ResponseTimeAssessment.js', () => ({ default: models.ResponseTimeAssessment }));
vi.mock('../models/NeckMobilityAssessment.js', () => ({ default: models.NeckMobilityAssessment }));
vi.mock('../models/GaitAnalysisAssessment.js', () => ({ default: models.GaitAnalysisAssessment }));
vi.mock('../models/FingerTappingAssessment.js', () => ({ default: models.FingerTappingAssessment }));
vi.mock('../models/FacialSymmetryAssessment.js', () => ({ default: models.FacialSymmetryAssessment }));
vi.mock('../models/EyeMovementAssessment.js', () => ({ default: models.EyeMovementAssessment }));
vi.mock('../models/StroopAssessment.js', () => ({ default: models.StroopAssessment }));
vi.mock('../models/HyperventilationAssessment.js', () => ({ default: models.HyperventilationAssessment }));
vi.mock('../models/NeuroBotAssessment.js', () => ({ default: models.NeuroBotAssessment }));
vi.mock('../models/EpilepsyTest.js', () => ({ default: models.EpilepsyTest }));
vi.mock('../models/Test.js', () => ({ default: models.Test }));
vi.mock('../models/Score.js', () => ({ default: models.Score }));

import { getAssessmentHistory } from './assessmentHistoryController.js';

const query = (records) => ({
  sort: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(records)
});

describe('getAssessmentHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(models).forEach(model => model.find.mockReturnValue(query([])));
  });

  it('merges generic and specialized results for the authenticated user', async () => {
    models.Assessment.find.mockReturnValue(query([{
      _id: 'generic-eye-id',
      type: 'EYE_MOVEMENT',
      status: 'COMPLETED',
      timestamp: '2025-01-02T00:00:00.000Z',
      metrics: { accuracy: 80 }
    }]));
    models.ResponseTimeAssessment.find.mockReturnValue(query([{
      _id: 'response-id',
      type: 'responseTime',
      status: 'COMPLETED',
      timestamp: '2025-01-01T00:00:00.000Z',
      metrics: { averageResponseTime: '420ms' }
    }]));

    const response = { json: vi.fn() };
    await getAssessmentHistory({
      user: { _id: { toString: () => 'authenticated-user' } },
      query: { userId: 'different-user' }
    }, response);

    expect(models.Assessment.find).toHaveBeenCalledWith({
      userId: 'authenticated-user',
      status: 'COMPLETED'
    });
    expect(models.ResponseTimeAssessment.find).toHaveBeenCalledWith({
      userId: 'authenticated-user',
      status: 'COMPLETED'
    });
    expect(response.json.mock.calls[0][0].data.map(record => record.type)).toEqual([
      'eyeMovement',
      'responseTime'
    ]);
  });

  it('includes legacy eye-movement records without status in assessment history', async () => {
    models.EyeMovementAssessment.find.mockReturnValue(query([{
      _id: 'eye-id',
      type: 'eyeMovement',
      metrics: { overall: { compositeScore: 42 } },
      timestamp: '2025-01-03T00:00:00.000Z'
    }]));

    const response = { json: vi.fn() };
    await getAssessmentHistory({
      user: { _id: { toString: () => 'authenticated-user' } },
      query: {}
    }, response);

    expect(models.EyeMovementAssessment.find).toHaveBeenCalledWith({
      userId: 'authenticated-user',
      $or: [{ status: 'COMPLETED' }, { status: { $exists: false } }]
    });
    expect(response.json.mock.calls[0][0].data).toContainEqual(
      expect.objectContaining({ type: 'eyeMovement', metrics: { overall: { compositeScore: 42 } } })
    );
  });

  it('maps persisted Stroop root score fields into history metrics', async () => {
    models.StroopAssessment.find.mockReturnValue(query([{
      _id: 'stroop-id',
      type: 'stroop',
      score: 6,
      total: 6,
      accuracy: 1,
      status: 'COMPLETED',
      timestamp: '2025-01-03T00:00:00.000Z'
    }]));

    const response = { json: vi.fn() };
    await getAssessmentHistory({
      user: { _id: { toString: () => 'authenticated-user' } },
      query: { type: 'stroop' }
    }, response);

    expect(response.json.mock.calls[0][0].data[0].metrics).toEqual({
      score: 6,
      total: 6,
      accuracy: 1
    });
  });
});
