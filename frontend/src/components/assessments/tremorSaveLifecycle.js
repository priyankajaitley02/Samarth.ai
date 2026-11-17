export async function finalizeTremorAssessment({ capture, stop, save, onSaved }) {
  const snapshot = capture();
  stop();

  const response = await save(snapshot);
  const result = response?.data;
  if (!result?.success || !result.data) {
    throw new Error(result?.error || result?.message || 'Failed to save tremor assessment');
  }

  onSaved?.(result.data);
  return result.data;
}
