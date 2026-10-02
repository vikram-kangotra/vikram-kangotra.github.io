import assert from 'node:assert/strict';
import { readCourseModule } from './course-loader.mjs';

const { guidedKernel } = await readCourseModule('src/course/guidedKernel.js');
const { kernelProjectFiles } = await readCourseModule('src/course/kernelProject.js');
const { prepareKernelCheckpointBuild } = await readCourseModule('src/course/kernelCheckpointBuild.js');
const { chapters } = await readCourseModule('src/course/index.js');
const { guidedAssemblyBySlug } = await readCourseModule('src/course/guidedAssembly.js');
const { makeProjectGuide } = await readCourseModule('src/course/guidedBuild.js');

assert.equal(guidedKernel.steps.length, 8);
assert.equal(guidedKernel.steps[0].sectionId, 'stage-one');
assert.equal(guidedKernel.file, 'boot/stage1.asm');
assert(!guidedKernel.steps.some(step => step.sectionId === 'contract'));
assert(chapters.find(chapter => chapter.slug === 'bootloading').sections.some(section => section.id === 'contract'), 'Machine contract remains a lesson');
const projectPaths = Object.keys(kernelProjectFiles).filter(path => path !== 'README.md').sort();
let source = { ...guidedKernel.initialFiles };
for (const [index, step] of guidedKernel.steps.entries()) {
  for (const path of step.filesToCreate || []) source[path] = kernelProjectFiles[path];
  const required = step.tests.requiredFiles;
  const supplied = Object.keys(step.tests.scaffoldFiles || {});
  assert(required.length > 0);
  assert(required.every(path => !/\.(md|txt)$/i.test(path)));
  assert.deepEqual([...required, ...supplied].sort(), projectPaths);
  assert.equal(supplied.length > 0, index < 5);
  const saved = structuredClone(source);
  const built = prepareKernelCheckpointBuild(Object.freeze(source), step.tests);
  assert.deepEqual(source, saved, 'Build cannot insert fixture files into the learner draft');
  for (const path of required) assert.equal(built[path], source[path]);
  for (const path of supplied) {
    const futureDraft = { ...source, [path]: 'An unfinished future file' };
    assert.equal(prepareKernelCheckpointBuild(futureDraft, step.tests)[path], kernelProjectFiles[path]);
    assert.equal(futureDraft[path], 'An unfinished future file', 'Future draft must remain saved');
  }
  for (const path of required) {
    const incomplete = { ...source }; delete incomplete[path];
    assert.throws(() => prepareKernelCheckpointBuild(incomplete, step.tests), /Write these project files/);
  }
  source = { ...source };
}
assert.throws(() => prepareKernelCheckpointBuild({ 'boot.asm': 'code' }, { requiredFiles: ['boot.asm'], scaffoldFiles: { 'boot.asm': 'answer' } }), /cannot supply/);
assert.throws(() => prepareKernelCheckpointBuild({ 'README.md': 'An explanation' }, guidedKernel.steps[0].tests), /boot\/stage1.asm/);
let count = 0;
for (const chapter of chapters) {
  const guide = guidedAssemblyBySlug[chapter.slug] || (chapter.slug === 'bootloading' ? guidedKernel : makeProjectGuide(chapter));
  for (const step of guide.steps) {
    count++;
    assert.notEqual(step.runnable, false, `${chapter.slug}: every checkpoint is executable`);
    assert(['routine', 'kernel', 'c-function'].includes(step.tests?.kind), `${chapter.slug}: test contract required`);
    assert(step.tests.cases?.length > 0, `${chapter.slug}: actual cases required`);
  }
}
assert.equal(count, 65);
console.log(`PASS ${count} executable checkpoints; 8 progressive boot builds; source ownership, missing-file failures, future-draft isolation, and lesson-only machine contract.`);
