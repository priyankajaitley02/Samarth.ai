// Simple WebSocket broadcaster for hyperventilation test streams
import SignalFrame from '../models/SignalFrame.js';
import mongoose from 'mongoose';

const wsClients = new Map(); // Map of ws -> {testId, ws, phase}
const activePhaseByTest = new Map();
const pendingSaves = new Set();
let savedFrameCount = 0;

function epochTimestamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Date.now();
  // Accept timestamps that are already wall-clock milliseconds.
  if (Math.abs(n - Date.now()) < 1000 * 60 * 60 * 48) return n;
  return Date.now();
}

export function setActivePhase(testId, phase) {
  const key = String(testId || '');
  if (!key) return;
  if (phase) activePhaseByTest.set(key, phase);
  else activePhaseByTest.delete(key);
  for (const meta of wsClients.values()) {
    if (String(meta.testId) === key) meta.phase = phase || null;
  }
}

export function addClient(ws, testId) {
  const phase = activePhaseByTest.get(String(testId)) || null;
  console.log('HV WS client connected with testId:', testId, 'phase:', phase);
  wsClients.set(ws, { testId, ws, phase });
  ws.on('close', () => {
    wsClients.delete(ws);
    console.log('HV WS client disconnected, remaining clients:', wsClients.size);
  });
  try { ws.send(JSON.stringify({ success: true, message: 'connected to hyperventilation stream' })); } catch (e) { }
}

export function broadcast(payload) {
  const str = JSON.stringify(payload);
  const samples = Array.isArray(payload.eeg_raw)
    ? payload.eeg_raw.filter(sample => Number.isFinite(Number(sample))).map(Number)
    : [];
  const receivedAt = epochTimestamp(payload.timestamp);
  const savedForTest = new Set();

  for (const [ws, meta] of wsClients) {
    const { testId, phase } = meta;
    if (testId && samples.length > 0 && !savedForTest.has(String(testId))) {
      savedForTest.add(String(testId));
      const save = saveSignalFrame(testId, samples, receivedAt, phase);
      pendingSaves.add(save);
      save.catch(err => {
        console.error('Error saving signal frame for HV test:', err);
      }).finally(() => pendingSaves.delete(save));
    }
    try {
      ws.send(str);
    } catch (e) {
      try { ws.terminate(); } catch (e2) {}
      wsClients.delete(ws);
    }
  }
}

async function saveSignalFrame(testId, eegData, timestamp, phase) {
  try {
    if (!testId || typeof testId !== 'string' || testId.length !== 24) {
      console.error('[saveSignalFrame] Invalid testId, frame not saved:', testId);
      return;
    }
    const frame = new SignalFrame({
      testId: new mongoose.Types.ObjectId(testId),
      timestamp: epochTimestamp(timestamp),
      ...(phase ? { phase } : {}),
      eeg: eegData
    });
    await frame.save();
    savedFrameCount += 1;
    if (savedFrameCount === 1 || savedFrameCount % 25 === 0) {
      console.log('[saveSignalFrame] Saved', savedFrameCount, 'frames. Latest phase:', phase, 'samples:', eegData.length);
    }
  } catch (err) {
    console.error('[saveSignalFrame] Failed to save signal frame:', err.message, 'testId:', testId);
  }
}

export async function flushPendingSaves() {
  await Promise.allSettled([...pendingSaves]);
}

export function clientCount() { return wsClients.size; }
