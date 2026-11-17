import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { createServer } from 'node:http';
import jwt from 'jsonwebtoken';

const { models, tremorService } = vi.hoisted(() => ({
  models: { findById: vi.fn() },
  tremorService: {
    getLatestRaw: vi.fn(),
    saveAssessment: vi.fn(),
    getHistory: vi.fn(),
    getBaseline: vi.fn(),
    ingestBatch: vi.fn(),
    ingestSample: vi.fn(),
    registerViewer: vi.fn(),
    unregisterViewer: vi.fn(),
    broadcastSensorData: vi.fn()
  }
}));

vi.mock('../models/User.js', () => ({ default: models }));
vi.mock('../services/tremorService.js', () => ({ tremorService }));
vi.mock('../services/tremorAnalyzer.js', () => ({
  tremorAnalyzer: { addSamples: vi.fn() }
}));

import { corsMiddleware } from '../middleware/cors.js';
import tremorRouter from './tremor.js';

describe('Tremor CORS and authenticated save route', () => {
  let server;
  let baseUrl;
  const originalJwtSecret = process.env.JWT_SECRET;
  const user = { _id: { toString: () => 'authenticated-user' } };

  beforeEach(async () => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'test-secret';
    models.findById.mockReturnValue({ select: vi.fn().mockResolvedValue(user) });
    tremorService.getLatestRaw.mockResolvedValue(null);
    tremorService.saveAssessment.mockResolvedValue({
      success: true,
      data: {
        _id: 'saved-tremor',
        userId: 'authenticated-user',
        createdAt: new Date('2026-11-16T00:00:00Z'),
        metrics: { tremor_frequency: 4.5 }
      }
    });

    const app = express();
    app.use(corsMiddleware);
    app.use(express.json());
    app.use('/api/tremor', tremorRouter);
    server = createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterEach(async () => {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  it('returns CORS headers on the tremor save preflight', async () => {
    const response = await fetch(`${baseUrl}/api/tremor/save`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type'
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(response.headers.get('access-control-allow-credentials')).toBe('true');
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
    expect(response.headers.get('access-control-allow-headers').toLowerCase()).toContain('authorization');
    expect(response.headers.get('access-control-allow-headers').toLowerCase()).toContain('content-type');
  });

  it('continues to allow the production frontend origin', async () => {
    const response = await fetch(`${baseUrl}/api/tremor/save`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://samarth-web.vercel.app',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type'
      }
    });

    expect(response.headers.get('access-control-allow-origin')).toBe('https://samarth-web.vercel.app');
  });

  it('passes an authenticated POST through to the Tremor controller', async () => {
    const token = jwt.sign({ userId: 'authenticated-user' }, process.env.JWT_SECRET);
    const response = await fetch(`${baseUrl}/api/tremor/save`, {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: 'untrusted-user',
        deviceId: 'glove-1',
        metrics: { tremor_frequency: 4.5, tremor_amplitude: 0.3 }
      })
    });

    expect(response.status).toBe(201);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(models.findById).toHaveBeenCalledWith('authenticated-user');
    expect(tremorService.saveAssessment).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'authenticated-user',
      metrics: { tremor_frequency: 4.5, tremor_amplitude: 0.3 }
    }));
    expect(await response.json()).toMatchObject({
      success: true,
      data: { id: 'saved-tremor' }
    });
  });
});
