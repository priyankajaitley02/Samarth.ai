import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/tremorService.js', () => ({
  tremorService: {
    getLatestRaw: vi.fn(),
    ingestBatch: vi.fn(),
    ingestSample: vi.fn()
  }
}));

vi.mock('../services/tremorAnalyzer.js', () => ({
  tremorAnalyzer: {
    addSamples: vi.fn(),
    addViewer: vi.fn(),
    removeViewer: vi.fn()
  }
}));

import { tremorService } from '../services/tremorService.js';
import { tremorAnalyzer } from '../services/tremorAnalyzer.js';
import { registerTremorWs } from './tremor.js';

describe('tremor device WebSocket', () => {
  let routes;

  beforeEach(() => {
    vi.clearAllMocks();
    routes = new Map();
    registerTremorWs({
      ws: (path, handler) => routes.set(path, handler)
    });
  });

  function connectDevice(deviceId = 'test-glove') {
    const listeners = {};
    const ws = {
      readyState: 1,
      on(event, handler) {
        listeners[event] = listeners[event] || [];
        listeners[event].push(handler);
      },
      ping: vi.fn(),
      send: vi.fn()
    };

    routes.get('/api/tremor/device')(ws, {
      headers: {},
      query: { deviceId },
      socket: { remoteAddress: '127.0.0.1' }
    });

    return {
      listeners,
      ws,
      close() {
        for (const handler of listeners.close || []) handler();
      }
    };
  }

  it('accepts a plain-text gz sample from the ESP32', async () => {
    const connection = connectDevice('gz-sensor');

    await connection.listeners.message[0](Buffer.from('-0.69'));

    expect(tremorService.ingestSample).toHaveBeenCalledWith(
      'gz-sensor',
      -0.69,
      expect.any(Number)
    );
    expect(tremorService.ingestBatch).not.toHaveBeenCalled();
    expect(tremorAnalyzer.addSamples).not.toHaveBeenCalled();
    connection.close();
  });

  it('continues to accept structured JSON sample batches', async () => {
    const connection = connectDevice();
    const batch = {
      sampleRate: 200,
      samples: [{ timestamp_us: 1234567890, gx: 0.1, gy: 0.2, gz: 0.3 }]
    };

    await connection.listeners.message[0](Buffer.from(JSON.stringify(batch)));

    expect(tremorAnalyzer.addSamples).toHaveBeenCalledWith(
      'test-glove',
      batch.samples,
      200
    );
    expect(tremorService.ingestBatch).toHaveBeenCalledWith(
      'test-glove',
      batch.samples,
      200
    );
    expect(tremorService.ingestSample).not.toHaveBeenCalled();
    connection.close();
  });
});
