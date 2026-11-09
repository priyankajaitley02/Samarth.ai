import { beforeEach, describe, expect, it, vi } from 'vitest';

const { model } = vi.hoisted(() => ({
  model: { findOneAndUpdate: vi.fn() }
}));

vi.mock('../models/EyeMovementAssessment.js', () => ({ default: model }));

import { eyeMovementService } from './eyeMovementService.js';

describe('eyeMovementService.saveAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    model.findOneAndUpdate.mockResolvedValue({
      _id: 'eye-id',
      createdAt: new Date(),
      toObject: () => ({ userId: 'authenticated-user' })
    });
  });

  it('saves metrics idempotently and preserves genuine zero accuracy', async () => {
    await eyeMovementService.saveAssessment({
      userId: 'authenticated-user',
      assessmentId: 'assessment-uuid',
      metrics: {
        SACCADIC_TEST: {
          summary: { accuracy: 0 },
          temporal: { velocities: [] }
        }
      }
    });

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'authenticated-user', assessmentId: 'assessment-uuid' },
      { $set: expect.objectContaining({
        status: 'COMPLETED',
        metrics: expect.objectContaining({
          SACCADIC_TEST: expect.objectContaining({
            summary: { accuracy: 0 }
          }),
          overall: expect.objectContaining({ accuracyScore: 0 })
        })
      }) },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
  });

  it('does not save without an assessment idempotency key', async () => {
    await expect(eyeMovementService.saveAssessment({
      userId: 'authenticated-user',
      metrics: {}
    })).rejects.toThrow('Missing required fields');
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
