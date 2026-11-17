export const selectAssessmentComponent = ({
  assessmentId,
  disorder,
  defaultComponent,
  alzheimerGaitComponent
}) => (
  assessmentId === 'gaitAnalysis' && disorder === 'alzheimers'
    ? alzheimerGaitComponent
    : defaultComponent
);
