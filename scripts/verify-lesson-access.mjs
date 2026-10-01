import assert from 'node:assert/strict';
import { readCourseModule } from './course-loader.mjs';

const { isCheckpointPassed, isCheckpointSkipped, getLessonGate } = await readCourseModule('src/course/lessonAccess.js');
const tested = { sectionId: 'code', tests: { kind: 'routine' } };
const draft = { sectionId: 'plan', runnable: false };

assert.equal(isCheckpointPassed(tested, 0), false);
assert.equal(isCheckpointPassed(tested, 0, { buildSteps: [0] }), false, 'Output/draft records cannot replace behavior checks');
assert.equal(isCheckpointPassed(tested, 0, { behaviorChecks: [0] }), true);
assert.equal(isCheckpointPassed(draft, 0, { behaviorChecks: [0] }), false, 'A draft review needs its own pass record');
assert.equal(isCheckpointPassed(draft, 0, { buildSteps: [0] }), true);
assert.equal(isCheckpointPassed(tested, 0, { behaviorChecks: ['0'] }), false);
assert.equal(isCheckpointPassed(tested, 0, { behaviorChecks: '0' }), false);
assert.equal(isCheckpointPassed(undefined, 0, { buildSteps: [0] }), false);

const fixture = {
  sections: [{ id: 'intro' }, { id: 'plan' }, { id: 'explain' }, { id: 'code' }, { id: 'after' }],
  // Deliberately not in reading order: checkpoint indices belong to the guide.
  guide: { steps: [tested, draft] },
};
assert.deepEqual(getLessonGate(fixture), { lessonIndex: 1, stepIndex: 1 });
assert.deepEqual(getLessonGate(fixture, { buildSteps: [1] }), { lessonIndex: 3, stepIndex: 0 });
assert.equal(getLessonGate(fixture, { buildSteps: [1], behaviorChecks: [0] }), null);
for (const field of ['buildAttempts', 'buildRuns', 'openBuilds', 'lessons']) {
  assert.deepEqual(getLessonGate(fixture, { [field]: [0, 1, 2, 3, 4], read: true, complete: true, assembly: true }), { lessonIndex: 1, stepIndex: 1 }, `${field} must not unlock a checkpoint`);
}
assert.equal(getLessonGate({ sections: [], guide: { steps: [] } }), null);
assert.equal(getLessonGate({ sections: [{ id: 'intro' }] }), null);
assert.equal(getLessonGate({ sections: [{ id: 'intro' }], guide: { steps: [{ sectionId: 'removed' }] } }), null);
assert.deepEqual(getLessonGate({ ...fixture, guide: { steps: [{ sectionId: 'removed' }, tested, draft] } }), { lessonIndex: 1, stepIndex: 2 }, 'An orphan checkpoint must not shadow a valid gate');

const { chapters } = await readCourseModule('src/course/index.js');
const { guidedAssemblyBySlug } = await readCourseModule('src/course/guidedAssembly.js');
const { guidedKernel } = await readCourseModule('src/course/guidedKernel.js');
const { makeProjectGuide } = await readCourseModule('src/course/guidedBuild.js');
let checkpointCount = 0;
const course = chapters.map(chapter => ({
  ...chapter,
  guide: guidedAssemblyBySlug[chapter.slug] || (chapter.slug === 'bootloading' ? guidedKernel : makeProjectGuide(chapter)),
}));
for (const chapter of course) {
  assert.equal(new Set(chapter.sections.map(section => section.id)).size, chapter.sections.length, `${chapter.slug}: section ids must be unique`);
  assert(chapter.guide.steps.length > 0, `${chapter.slug}: guide must have a checkpoint`);
  for (const [index, step] of chapter.guide.steps.entries()) {
    assert(chapter.sections.some(section => section.id === step.sectionId), `${chapter.slug} checkpoint ${index}: missing section ${step.sectionId}`);
    checkpointCount += 1;
  }
  const complete = { buildSteps: [], behaviorChecks: [] };
  chapter.guide.steps.forEach((step, index) => complete[step.tests ? 'behaviorChecks' : 'buildSteps'].push(index));
  assert.equal(getLessonGate(chapter, complete), null, `${chapter.slug}: every passed checkpoint should unlock all lessons`);
}

const first = course.find(chapter => chapter.slug === 'assembly-first-instructions');
assert.deepEqual(getLessonGate(first), { lessonIndex: 6, stepIndex: 0 }, 'The first gate is section 7');
assert.deepEqual(getLessonGate(first, { buildSteps: [0, 1, 2] }), { lessonIndex: 6, stepIndex: 0 });
assert.deepEqual(getLessonGate(first, { behaviorChecks: [1, 2], read: true }), { lessonIndex: 6, stepIndex: 0 }, 'Later legacy passes cannot bypass the first missing checkpoint');
assert.deepEqual(getLessonGate(first, { behaviorChecks: [0] }), { lessonIndex: 8, stepIndex: 1 }, 'Passing section 7 unlocks section 8 and the section-9 checkpoint');
assert.deepEqual(getLessonGate(first, { behaviorChecks: [0, 1] }), { lessonIndex: 9, stepIndex: 2 });
assert.equal(getLessonGate(first, { behaviorChecks: [0, 1, 2] }), null);
assert.deepEqual(getLessonGate(first, { skippedCheckpoints: [0] }), { lessonIndex: 8, stepIndex: 1 }, 'Explicit skip unlocks later reading');
assert.equal(isCheckpointPassed(first.guide.steps[0], 0, { skippedCheckpoints: [0] }), false, 'A skip never counts as passed');
assert.equal(isCheckpointSkipped(0, { skippedCheckpoints: ['0'] }), false);
assert.equal(isCheckpointSkipped(0, { skippedCheckpoints: '0' }), false);
assert.deepEqual(getLessonGate(first, { skippedCheckpoints: [1, 2] }), { lessonIndex: 6, stepIndex: 0 }, 'Skipping later tasks cannot bypass an earlier one');
assert.equal(getLessonGate(first, { skippedCheckpoints: [0, 1, 2] }), null, 'All explicit skips permit reading without awarding any passes');
assert.deepEqual(getLessonGate(first, { skippedCheckpoints: [1], behaviorChecks: [0] }), { lessonIndex: 9, stepIndex: 2 }, 'Passes and deliberate skips both permit navigation');
const firstGate = getLessonGate(first);
assert.equal(6 > firstGate.lessonIndex, false, 'The checkpoint lesson itself stays accessible');
assert.equal(7 > firstGate.lessonIndex, true, 'Section 8 stays locked until section 7 passes');

// Progressive programs change at later checkpoints. Invalidation retains the
// earlier achievements instead of requiring H, HI, and OK simultaneously.
const passed = { buildSteps: [0, 1, 2], behaviorChecks: [0, 1, 2], buildRuns: [0, 1, 2] };
const editedSecond = Object.fromEntries(Object.entries(passed).map(([key, values]) => [key, values.filter(index => index < 1)]));
assert.equal(isCheckpointPassed(first.guide.steps[0], 0, editedSecond), true);
assert.deepEqual(getLessonGate(first, editedSecond), { lessonIndex: 8, stepIndex: 1 });
const editedFirst = Object.fromEntries(Object.keys(passed).map(key => [key, []]));
assert.deepEqual(getLessonGate(first, editedFirst), { lessonIndex: 6, stepIndex: 0 }, 'Earlier invalidation must relock later reading');

console.log(`PASS lesson access: pass semantics, ordered gates, safe orphan handling, first-chapter boundaries, explicit skips without pass credit, suffix invalidation; ${course.length} actual chapter guides / ${checkpointCount} valid checkpoint mappings.`);
