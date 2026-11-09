import test from 'node:test';
import assert from 'node:assert/strict';
import { completeAssessment } from './assessmentCompletion.js';

test('completing an assessment records it without selecting the next assessment', () => {
  assert.deepEqual(
    completeAssessment('stroop', ['eyeMovement']),
    {
      currentAssessment: 'stroop',
      completedAssessments: ['eyeMovement', 'stroop']
    }
  );
});

test('completing an assessment does not duplicate its completion entry', () => {
  assert.deepEqual(
    completeAssessment('stroop', ['stroop']),
    {
      currentAssessment: 'stroop',
      completedAssessments: ['stroop']
    }
  );
});
