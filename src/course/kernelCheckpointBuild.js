/** Build a checkpoint copy without changing any saved learner files. */
export function prepareKernelCheckpointBuild(files, tests = {}) {
  const required = tests.requiredFiles || [];
  const scaffold = tests.scaffoldFiles || {};
  const missing = required.filter(path => typeof files[path] !== 'string' || !files[path].trim());
  if (missing.length) throw new Error(`Write these project files before running this checkpoint: ${missing.join(', ')}.`);
  if (required.some(path => Object.hasOwn(scaffold, path))) {
    throw new Error('A checkpoint cannot supply a file that the learner must implement.');
  }
  // Future stages use the published dependency fixtures even when the learner
  // has an experimental draft of them. Current and earlier required sources
  // always come from the learner; the fixtures never enter project storage.
  return { ...files, ...scaffold };
}
