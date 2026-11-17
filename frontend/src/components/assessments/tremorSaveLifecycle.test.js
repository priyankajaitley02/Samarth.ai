import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeTremorAssessment } from './tremorSaveLifecycle.js';

test('captures metrics, stops collection, saves, and confirms only after success', async () => {
  const events = [];
  const saved = { id: 'assessment-id' };

  const result = await finalizeTremorAssessment({
    capture: () => {
      events.push('capture');
      return { metrics: { tremor_frequency: 4.5 } };
    },
    stop: () => events.push('stop'),
    save: async snapshot => {
      events.push('save');
      assert.equal(snapshot.metrics.tremor_frequency, 4.5);
      return { data: { success: true, data: saved } };
    },
    onSaved: data => {
      events.push('confirm');
      assert.equal(data, saved);
    }
  });

  assert.equal(result, saved);
  assert.deepEqual(events, ['capture', 'stop', 'save', 'confirm']);
});

test('does not confirm completion when persistence fails', async () => {
  const events = [];

  await assert.rejects(finalizeTremorAssessment({
    capture: () => {
      events.push('capture');
      return { metrics: {} };
    },
    stop: () => events.push('stop'),
    save: async () => {
      events.push('save');
      return { data: { success: false, error: 'database unavailable' } };
    },
    onSaved: () => events.push('confirm')
  }), /database unavailable/);

  assert.deepEqual(events, ['capture', 'stop', 'save']);
});

test('does not confirm completion when the save request rejects', async () => {
  const events = [];

  await assert.rejects(finalizeTremorAssessment({
    capture: () => {
      events.push('capture');
      return { metrics: {} };
    },
    stop: () => events.push('stop'),
    save: async () => {
      events.push('save');
      throw new Error('network unavailable');
    },
    onSaved: () => events.push('confirm')
  }), /network unavailable/);

  assert.deepEqual(events, ['capture', 'stop', 'save']);
});
