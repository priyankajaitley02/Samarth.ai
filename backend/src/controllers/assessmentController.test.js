import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ document: null }));

vi.mock('../models/Assessment.js', () => ({
  default: class {
    constructor(document) {
      state.document = document;
    }

    async save() {
      return { _id: 'saved-assessment', ...state.document };
    }
  }
}));

import { saveAssessment } from './assessmentController.js';

describe('saveAssessment', () => {
  beforeEach(() => {
    state.document = null;
  });

  it('associates the result with the authenticated user, not the submitted userId', async () => {
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await saveAssessment({
      user: { _id: { toString: () => 'authenticated-user' } },
      body: {
        userId: 'different-user',
        type: 'RESPONSE_TIME',
        data: { averageResponseTime: 450 },
        metrics: { averageResponseTime: 450 }
      }
    }, response);

    expect(state.document.userId).toBe('authenticated-user');
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json.mock.calls[0][0].success).toBe(true);
  });
});
