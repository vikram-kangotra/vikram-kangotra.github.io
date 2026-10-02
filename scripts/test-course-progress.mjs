import assert from 'node:assert/strict';
import { readCourseModule } from './course-loader.mjs';

const { BOOT_CHECKPOINT_VERSION, parseCourseProgress, versionCourseProgressPatch } = await readCourseModule('src/course/courseProgress.js');
const { getLessonGate } = await readCourseModule('src/course/lessonAccess.js');
const parseBoot = record => parseCourseProgress(JSON.stringify({ bootloading: record })).bootloading;
const checkpointFields = ['openBuilds', 'buildAttempts', 'buildSteps', 'buildRuns', 'behaviorChecks', 'skippedCheckpoints'];
const oldIndices = Array.from({ length: 9 }, (_, index) => index);
const indices = Array.from({ length: 8 }, (_, index) => index);
const legacy = {
  complete: true, read: true, assembly: true,
  code: '/* saved kernel source */', reflection: 'My boot observations',
  lessonIds: ['contract', 'stage-one', 'experiment'], lessons: [0, 1, 8], checks: [1], rubric: [2],
  ...Object.fromEntries(checkpointFields.map(field => [field, oldIndices])),
};
const unchanged = JSON.stringify(legacy);
const migrated = parseBoot(legacy);
assert.equal(JSON.stringify(legacy), unchanged, 'Migration does not mutate the supplied record');
assert.equal(migrated.bootCheckpointVersion, BOOT_CHECKPOINT_VERSION);
assert.equal(migrated.complete, false, 'Draft-only progress cannot complete the new machine-checked chapter');
for (const field of ['buildSteps', 'buildRuns', 'behaviorChecks']) assert.deepEqual(migrated[field], [5, 6, 7], `${field} preserves only runtime credit at its new index`);
for (const field of ['openBuilds', 'buildAttempts', 'skippedCheckpoints']) assert.deepEqual(migrated[field], indices, `${field} follows its original checkpoint`);
for (const field of ['code', 'reflection', 'lessonIds', 'lessons', 'checks', 'rubric', 'read', 'assembly']) assert.deepEqual(migrated[field], legacy[field], `${field} remains intact`);
assert.deepEqual(parseBoot(migrated), migrated, 'Saving and reloading never shifts migrated indices twice');

for (const oldIndex of oldIndices) {
  const result = parseBoot(Object.fromEntries(checkpointFields.map(field => [field, [oldIndex]])));
  for (const field of checkpointFields) {
    const firstRetained = ['buildSteps', 'buildRuns', 'behaviorChecks'].includes(field) ? 6 : 1;
    assert.deepEqual(result[field], oldIndex >= firstRetained ? [oldIndex - 1] : [], `${field}: old index ${oldIndex} maps to its exact successor or is retired`);
  }
}
const drafts = parseBoot({ complete: true, assembly: true, buildSteps: [0, 1, 2, 3, 4, 5], behaviorChecks: [0, 1, 2, 3, 4, 5], buildAttempts: [0, 1, 2, 3, 4, 5] });
assert.deepEqual(drafts.buildSteps, []);
assert.deepEqual(drafts.behaviorChecks, []);
assert.equal(drafts.complete, false);
const sections = ['stage-one', 'disk-read', 'stage-two', 'c-entry', 'kernel', 'linker', 'observe', 'experiment'].map(id => ({ id }));
const chapter = { sections, guide: { steps: sections.map(section => ({ sectionId: section.id, tests: { kind: 'kernel', cases: [{ input: {}, expect: { output: 'OK' } }] } })) } };
assert.deepEqual(getLessonGate(chapter, drafts), { lessonIndex: 0, stepIndex: 0 }, 'Prior draft credit cannot unlock the first executable checkpoint');
const skipped = parseBoot({ skippedCheckpoints: [0, 1, 2, 6], complete: true, assembly: true });
assert.deepEqual(skipped.skippedCheckpoints, [0, 1, 5]);
assert.deepEqual(getLessonGate(chapter, skipped), { lessonIndex: 2, stepIndex: 2 }, 'Skip navigation keeps the original surviving checkpoint identities');
assert.equal(skipped.complete, false, 'Skipped checkpoints never confer completion');

const completed = { bootCheckpointVersion: BOOT_CHECKPOINT_VERSION, complete: true, assembly: true, behaviorChecks: indices, buildSteps: indices };
assert.equal(parseBoot(completed).complete, true, 'All eight newly verified checkpoints retain completion');
assert.equal(parseBoot({ ...completed, assembly: false }).complete, false);
for (const index of indices) assert.equal(parseBoot({ ...completed, behaviorChecks: indices.filter(item => item !== index) }).complete, false, `Missing runtime check ${index} prevents completion`);
const firstWrite = versionCourseProgressPatch('bootloading', { behaviorChecks: [0], buildSteps: [0] });
assert.equal(firstWrite.bootCheckpointVersion, BOOT_CHECKPOINT_VERSION);
assert.deepEqual(parseBoot(firstWrite).behaviorChecks, [0], 'A brand-new learner pass is not mistaken for legacy contract credit');
const subsequent = { ...migrated, ...versionCourseProgressPatch('bootloading', { behaviorChecks: [0, ...migrated.behaviorChecks] }) };
assert.deepEqual(parseBoot(subsequent).behaviorChecks, [0, 5, 6, 7], 'A new pass survives alongside remapped runtime passes');
const patch = { behaviorChecks: [0], complete: true };
assert.deepEqual(versionCourseProgressPatch('assembly-registers', patch), patch);
assert.equal(Object.hasOwn(patch, 'bootCheckpointVersion'), false, 'Versioning does not mutate the caller patch');

const others = parseCourseProgress(JSON.stringify({
  'assembly-registers': { complete: true, behaviorChecks: [0, 1, 2], buildSteps: [0, 1, 2] },
  memory: { complete: true, behaviorChecks: [0], code: 'saved C' },
  capstone: { complete: true, behaviorChecks: [0], assembly: true },
}));
for (const record of Object.values(others)) {
  assert.equal(record.complete, true, 'Other chapter completion contracts remain unchanged');
  assert.equal(Object.hasOwn(record, 'bootCheckpointVersion'), false);
}
const outputProgress = behaviorChecks => parseCourseProgress(JSON.stringify({ 'assembly-output': { complete: true, behaviorChecks, buildSteps: [0, 1, 2, 3], skippedCheckpoints: [0, 1, 2, 3] } }))['assembly-output'];
assert.equal(outputProgress([0, 1, 2, 3]).complete, true, 'All four output helpers retain completion');
for (const index of [0, 1, 2, 3]) assert.equal(outputProgress([0, 1, 2, 3].filter(item => item !== index)).complete, false, `Missing output helper ${index} cannot be replaced by draft or skip credit`);
for (const raw of [null, '', 'null', '[]', '5', '{invalid']) assert.deepEqual(parseCourseProgress(raw), {});
const malformed = parseBoot({ buildSteps: [-1, '6', null, 6, 99, 100], openBuilds: [0, 8, 9, 99], skippedCheckpoints: 'all' });
assert.deepEqual(malformed.buildSteps, [5]);
assert.deepEqual(malformed.openBuilds, [7]);
assert.deepEqual(malformed.skippedCheckpoints, []);
console.log('PASS: boot checkpoint versioning, all legacy index mappings, draft-credit invalidation, saved source and reading preservation, skip gates, idempotent reloads, new-learner writes, all-eight-runtime completion, and four-helper completion.');
