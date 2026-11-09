import { beforeEach, describe, expect, it, vi } from 'vitest';

const { savedAssessments } = vi.hoisted(() => ({ savedAssessments: [] }));

vi.mock('../models/StroopAssessment.js', () => ({
  default: class StroopAssessment {
    constructor(data) {
      this.data = data;
    }

    async save() {
      savedAssessments.push(this.data);
      return {
        _id: 'stroop-id',
        ...this.data,
        toObject: () => this.data
      };
    }
  }
}));

import { stroopService } from './stroopService.js';

describe('stroopService.saveAssessment', () => {
  beforeEach(() => {
    savedAssessments.length = 0;
  });

  it('calculates the saved accuracy from valid responses', async () => {
    await stroopService.saveAssessment({
      userId: 'authenticated-user',
      score: 1,
      total: 1,
      history: [
        { correct: true },
        { correct: true },
        { correct: true }
      ]
    });

    expect(savedAssessments[0]).toMatchObject({
      score: 3,
      total: 3,
      accuracy: 1
    });
  });

  it('returns zero accuracy when there are no valid responses', async () => {
    await stroopService.saveAssessment({
      userId: 'authenticated-user',
      score: 5,
      total: 6,
      history: [{ correct: 'yes' }, { selected: 'red' }]
    });

    expect(savedAssessments[0]).toMatchObject({
      score: 0,
      total: 0,
      accuracy: 0
    });
  });
});
