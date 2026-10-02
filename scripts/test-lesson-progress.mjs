import assert from 'node:assert/strict';
import { readCourseModule } from './course-loader.mjs';
const { resolveLessonProgress, lessonProgressPatch, isChapterComplete } = await readCourseModule('src/course/lessonProgress.js');
const chapter = { legacySectionIds: ['intro', 'walk', 'check'], sections: [{id:'intro'}, {id:'walk'}, {id:'bits',parentSectionId:'walk'}, {id:'trace',parentSectionId:'walk'}, {id:'check'}] };
const legacy = {lessons:[0,2], buildSteps:[0], behaviorChecks:[0], code:'saved code', reflection:'saved reasoning'};
const migrated = resolveLessonProgress(chapter,legacy);
assert.deepEqual(migrated.lessons,[0,4]);
assert.deepEqual(migrated.lessonIds,['intro','check']);
assert.deepEqual(legacy.lessons,[0,2], 'Migration never mutates saved state');
for(const field of ['buildSteps','behaviorChecks','code','reflection']) assert.deepEqual(migrated[field],legacy[field]);
const finishedOld = resolveLessonProgress(chapter,{read:true,complete:true,lessons:[]});
assert.deepEqual(finishedOld.lessonIds,['intro','walk','check']);
assert.equal(finishedOld.read,false,'New lessons start unread');
assert.equal(finishedOld.complete,false,'New reading is acknowledged before chapter completion');
const stable = resolveLessonProgress(chapter,{lessonIds:['trace','intro','removed','trace'],lessons:[1,2,3],read:true});
assert.deepEqual(stable.lessonIds,['intro','trace']);
assert.deepEqual(stable.lessons,[0,3]);
const patched = lessonProgressPatch(chapter,[0,1,2,3,4,999,-1]);
assert.equal(patched.read,true);
assert.equal(resolveLessonProgress(chapter,patched).read,true);
assert.deepEqual(lessonProgressPatch(chapter,[]),{lessons:[],lessonIds:[],read:false});
assert.deepEqual(resolveLessonProgress(chapter,{lessons:['2',99,-1]}).lessonIds,[]);
const inserted = {...chapter,sections:[{id:'new'},...chapter.sections]};
assert.deepEqual(resolveLessonProgress(inserted,patched).lessons,[1,2,3,4,5]);
assert.equal(resolveLessonProgress(inserted,patched).read,false);
const summary = {sectionIds:chapter.sections.map(section=>section.id),legacySectionIds:chapter.legacySectionIds};
assert.equal(isChapterComplete(summary,{complete:true,read:true}),false,'Overview excludes stale completion before a chapter is visited');
assert.equal(isChapterComplete(summary,{...patched,complete:true}),true);
assert.equal(isChapterComplete(summary,{...patched,complete:false}),false);
assert.equal(isChapterComplete({...summary,sectionIds:['new',...summary.sectionIds]},{...patched,complete:true}),false);
assert.equal(isChapterComplete({sectionIds:chapter.legacySectionIds,legacySectionIds:chapter.legacySectionIds},{read:true,complete:true}),true,'Unchanged legacy chapters retain completion');

// These two instruction lessons were inserted into an already published
// chapter. Numeric progress must keep the original identities, not shift by two.
const { chapters, chapterSummary } = await readCourseModule('src/course/index.js');
const { guidedOutput } = await readCourseModule('src/course/guidedOutput.js');
const { parseCourseProgress } = await readCourseModule('src/course/courseProgress.js');
const { getLessonGate, isCheckpointPassed } = await readCourseModule('src/course/lessonAccess.js');
const output = chapters.find(item => item.slug === 'assembly-output');
const additions = ['pushad-popad', 'pushfd-popfd'];
assert.equal(output.sections.length, 18);
assert.equal(output.legacySectionIds.length, 16);
assert.deepEqual(output.sections.filter(section => !additions.includes(section.id)).map(section => section.id), output.legacySectionIds);
assert.deepEqual(guidedOutput.steps.map(step => step.sectionId), ['putc-checkpoint', 'newline-checkpoint', 'puts-checkpoint', 'hex-checkpoint']);
assert.deepEqual([4, 9, 12].map(index => output.legacySectionIds[index]), ['putc-checkpoint', 'puts-checkpoint', 'hex-checkpoint']);
const passed = {
  complete: true, lessons: [4, 9, 12], buildSteps: [0, 1, 2, 3],
  behaviorChecks: [0, 1, 2, 3], buildRuns: [0, 1, 2, 3],
  code: 'Saved console.asm draft', reflection: 'Saved caller preservation notes',
};
const resolveOutput = record => resolveLessonProgress(output, parseCourseProgress(JSON.stringify({ 'assembly-output': record }))['assembly-output']);
const numericOutput = resolveOutput(passed);
assert.deepEqual(numericOutput.lessonIds, ['putc-checkpoint', 'puts-checkpoint', 'hex-checkpoint']);
assert.deepEqual(numericOutput.lessons, [6, 11, 14]);
const allOldOutput = resolveOutput({ ...passed, read: true });
assert.deepEqual(allOldOutput.lessonIds, output.legacySectionIds, 'Old read:true acknowledges precisely the original sixteen lessons');
assert.equal(allOldOutput.read, false);
assert.equal(allOldOutput.complete, false);
assert.deepEqual(output.sections.filter(section => !allOldOutput.lessonIds.includes(section.id)).map(section => section.id), additions, 'Only the two inserted instruction lessons start unread');
const stableOutput = resolveOutput({ ...passed, lessonIds: ['pushad-popad', 'putc-checkpoint', 'hex-checkpoint'], read: true });
assert.deepEqual(stableOutput.lessonIds, ['pushad-popad', 'putc-checkpoint', 'hex-checkpoint'], 'Current stable IDs survive unchanged instead of consulting stale numeric positions');
assert.deepEqual(resolveOutput(stableOutput), stableOutput, 'Reloading resolved output progress is idempotent');
for (const state of [numericOutput, allOldOutput, stableOutput]) {
  for (const field of ['buildSteps', 'behaviorChecks', 'buildRuns', 'code', 'reflection']) assert.deepEqual(state[field], passed[field], `Instruction reading additions retain ${field}`);
  for (const [index, step] of guidedOutput.steps.entries()) assert.equal(isCheckpointPassed(step, index, state), true, 'All four machine passes keep their checkpoint index');
  assert.equal(getLessonGate({ ...output, guide: guidedOutput }, state), null, 'New reading does not relock already passed machine checkpoints');
}
const outputSummary = chapterSummary(output);
assert.deepEqual(outputSummary.legacySectionIds, output.legacySectionIds, 'Overview receives the original reading identities too');
assert.equal(isChapterComplete(outputSummary, { ...passed, read: true }), false);
const allOutput = { ...allOldOutput, ...lessonProgressPatch(output, output.sections.map((_, index) => index)), complete: true };
assert.equal(isChapterComplete(outputSummary, allOutput), true, 'Finishing the two new lessons restores reading completion without rerunning passed helpers');
console.log('PASS: legacy numeric reading migration, stable-ID reordering, added lessons, saved drafts and checkpoint credit, explicit reset, malformed indices, and output chapter instruction-lesson migration');
