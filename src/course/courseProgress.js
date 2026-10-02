export const BOOT_CHECKPOINT_VERSION = 2;

const checkpointFields = ['openBuilds', 'buildAttempts', 'buildSteps', 'buildRuns', 'behaviorChecks', 'skippedCheckpoints'];

function migrateBootCheckpoints(state, record) {
  if (record.bootCheckpointVersion !== BOOT_CHECKPOINT_VERSION) {
    for (const field of checkpointFields) {
      // The old contract-only checkpoint was removed. Its five following
      // source drafts now require executable checks; only the final three
      // checkpoints previously verified a running kernel.
      const firstRetained = ['buildSteps', 'buildRuns', 'behaviorChecks'].includes(field) ? 6 : 1;
      state[field] = state[field].filter(index => index >= firstRetained && index <= 8).map(index => index - 1);
    }
    state.complete = false;
  }
  state.bootCheckpointVersion = BOOT_CHECKPOINT_VERSION;
}

export function parseCourseProgress(raw) {
  let value;
  try { value = JSON.parse(raw || '{}'); } catch { return {}; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const clean = {};
  Object.entries(value).forEach(([slug, record]) => {
    if (!/^[a-z0-9-]+$/.test(slug) || slug === 'constructor' || slug === 'prototype' || !record || typeof record !== 'object') return;
    const state = {};
    ['complete', 'read', 'lab', 'assembly'].forEach((key) => { state[key] = record[key] === true; });
    ['code', 'reflection'].forEach((key) => { if (typeof record[key] === 'string') state[key] = record[key].slice(0, 200000); });
    if (Array.isArray(record.lessonIds)) state.lessonIds = record.lessonIds.filter(id => typeof id === 'string' && /^[a-z0-9-]+$/.test(id)).slice(0, 1000);
    ['checks', 'rubric', 'lessons', ...checkpointFields].forEach((key) => { state[key] = Array.isArray(record[key]) ? record[key].filter((i) => Number.isInteger(i) && i >= 0 && i < 100) : []; });
    if (slug === 'bootloading') migrateBootCheckpoints(state, record);
    // Older output-only completions remain readable, but must not appear as
    // completed behavioral verification in the curriculum or course overview.
    const required = slug === 'assembly-output' ? [0, 1, 2, 3] : slug.startsWith('assembly-') ? [0, 1, 2] : slug === 'bootloading' ? [0, 1, 2, 3, 4, 5, 6, 7] : [0];
    if (!required.every(index => state.behaviorChecks.includes(index))) state.complete = false;
    if (['bootloading', 'capstone'].includes(slug) && !state.assembly) state.complete = false;
    clean[slug] = state;
  });
  return clean;
}

// Every new write is already in the current checkpoint order, even when the
// learner has never saved progress before or browser storage is unavailable.
export function versionCourseProgressPatch(slug, patch) {
  return slug === 'bootloading' ? { ...patch, bootCheckpointVersion: BOOT_CHECKPOINT_VERSION } : patch;
}
