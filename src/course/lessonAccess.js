/** A test run, an attempt, or reading a lesson is not a checkpoint pass. */
export function isCheckpointPassed(step, index, state = {}) {
  if (!step) return false;
  const passed = step.tests ? state?.behaviorChecks : state?.buildSteps;
  return Array.isArray(passed) && passed.includes(index);
}

/** Skipping permits navigation but never counts as a verified pass. */
export function isCheckpointSkipped(index, state = {}) {
  return Array.isArray(state?.skippedCheckpoints) && state.skippedCheckpoints.includes(index);
}

/**
 * The earliest checkpoint neither passed nor explicitly skipped limits navigation. Its own
 * lesson remains open so the learner can read, write, and pass that checkpoint.
 * A requested lesson is locked only when its index is greater than this gate.
 */
export function getLessonGate(chapter, state = {}) {
  const sections = chapter?.sections || [];
  const steps = chapter?.guide?.steps || [];
  let gate = null;
  steps.forEach((step, stepIndex) => {
    if (isCheckpointPassed(step, stepIndex, state) || isCheckpointSkipped(stepIndex, state)) return;
    const lessonIndex = sections.findIndex(section => section.id === step.sectionId);
    // Course contracts validate mappings separately. A removed section cannot
    // become a negative navigation target in an older or incomplete guide.
    if (lessonIndex < 0) return;
    if (!gate || lessonIndex < gate.lessonIndex) gate = { lessonIndex, stepIndex };
  });
  return gate;
}
