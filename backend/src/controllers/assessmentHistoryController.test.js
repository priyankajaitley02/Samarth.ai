import { describe, expect, it } from 'vitest';
import {
  formatAssessmentHistoryRecord,
  normalizeAssessmentType
} from './assessmentHistoryController.js';

describe('assessment history normalization', () => {
  it('maps persisted enum values to the types used by the results UI', () => {
    expect(normalizeAssessmentType('EYE_MOVEMENT')).toBe('eyeMovement');
    expect(normalizeAssessmentType('RESPONSE_TIME')).toBe('responseTime');
    expect(normalizeAssessmentType('CONVERSATIONAL_SCREENING')).toBe('neurobot');
    expect(normalizeAssessmentType('HYPERVENTILATION_TEST')).toBe('hyperventilation');
  });

  it('keeps Eye Movement metrics visible when stored inside a generic record', () => {
    const result = formatAssessmentHistoryRecord({
      type: 'EYE_MOVEMENT',
      timestamp: '2025-01-01T00:00:00.000Z',
      metrics: { metrics: { overall: { score: 82 } } }
    });

    expect(result.type).toBe('eyeMovement');
    expect(result.metrics.overall.score).toBe(82);
  });

  it('uses the source collection type for specialized records without an explicit type', () => {
    const result = formatAssessmentHistoryRecord({
      timestamp: '2025-01-01T00:00:00.000Z',
      metrics: { averageResponseTime: '420ms' }
    }, 'responseTime');

    expect(result.type).toBe('responseTime');
    expect(result.metrics.averageResponseTime).toBe('420ms');
  });

  it('leaves already-normalized assessment types unchanged', () => {
    expect(normalizeAssessmentType('responseTime')).toBe('responseTime');
    expect(normalizeAssessmentType('tremor')).toBe('tremor');
  });
});
