import { beforeEach, describe, expect, it, vi } from 'vitest';

const { service } = vi.hoisted(() => ({
  service: {
    getLatestRaw: vi.fn(),
    saveAssessment: vi.fn()
  }
}));

vi.mock('../services/tremorService.js', () => ({ tremorService: service }));

import { tremorController } from './tremorController.js';

describe('tremorController.save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves the authenticated user metrics and merges captured sensor samples', async () => {
    service.getLatestRaw.mockResolvedValue({
      sampleRate: 200,
      samples: [{ timestamp_us: 123456, gx: 0.1, gy: 0.2, gz: 0.3 }]
    });
    const savedAssessment = {
      _id: 'saved-tremor',
      userId: 'authenticated-user',
      createdAt: new Date('2026-11-13T00:00:00Z'),
      metrics: { overall: { tremorScore: 15 } }
    };
    service.saveAssessment.mockResolvedValue({ success: true, data: savedAssessment });

    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await tremorController.save({
      user: { _id: { toString: () => 'authenticated-user' } },
      query: {},
      body: {
        userId: 'untrusted-user',
        deviceId: 'glove-1',
        metrics: {
          tremor_frequency: 4.5,
          rawData: { frequencies: [4.5], amplitudes: [0.2], timestamps: [new Date()] }
        }
      }
    }, response);

    expect(service.getLatestRaw).toHaveBeenCalledWith('glove-1');
    expect(service.saveAssessment).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'authenticated-user',
      metrics: expect.objectContaining({
        rawData: expect.objectContaining({
          frequencies: [4.5],
          sampleRate: 200,
          samples: [{ timestamp_us: 123456, gx: 0.1, gy: 0.2, gz: 0.3 }]
        })
      })
    }));
    expect(response.status).toHaveBeenCalledWith(201);
    expect(response.json.mock.calls[0][0]).toMatchObject({
      success: true,
      data: { id: 'saved-tremor', metrics: { overall: { tremorScore: 15 } } }
    });
  });

  it('does not report success when persistence fails', async () => {
    service.getLatestRaw.mockResolvedValue(null);
    service.saveAssessment.mockRejectedValue(new Error('database unavailable'));
    const response = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };

    await tremorController.save({
      user: { _id: { toString: () => 'authenticated-user' } },
      query: {},
      body: { metrics: { tremor_frequency: 4.5 } }
    }, response);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json.mock.calls[0][0]).toMatchObject({
      success: false,
      error: 'database unavailable'
    });
  });
});
