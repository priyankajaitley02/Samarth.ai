export const completeAssessment = (currentAssessment, completedAssessments) => ({
  currentAssessment,
  completedAssessments: currentAssessment
    ? [...new Set([...completedAssessments, currentAssessment])]
    : completedAssessments
});
