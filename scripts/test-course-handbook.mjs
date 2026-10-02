import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readCourseModule } from './course-loader.mjs';

const { chapters } = await readCourseModule('src/course/index.js');
// Validate raw registrations before index.js can filter an invalid destination.
const registered = new Set();
for (const name of ['architecture', 'memory', 'systems', 'assembly', 'architectureFurther', 'memoryFurther', 'systemsFurther']) {
  const module = await readCourseModule(`src/course/handbook/${name}.js`);
  for (const [slug, topics] of Object.entries(module[`${name}Handbook`])) {
    const chapter = chapters.find(item => item.slug === slug);
    assert(chapter, `unknown handbook chapter ${slug}`);
    for (const topic of topics) {
      assert(chapter.sections.some(section => section.id === topic.sectionId), `${topic.id}: unknown section ${topic.sectionId}`);
      assert(!registered.has(topic.id), `duplicate raw topic ${topic.id}`); registered.add(topic.id);
    }
  }
}
// Instruction lessons own their inline topics directly rather than registering
// them in a handbook map. Validate the raw destinations before publication too.
const { outputMechanicsSections } = await readCourseModule('src/course/assemblyOutputMechanics.js');
const outputChapter = chapters.find(chapter => chapter.slug === 'assembly-output');
for (const section of outputMechanicsSections) {
  assert(outputChapter.sections.some(item => item.id === section.id), `${section.id}: inline lesson must be published`);
  for (const topic of section.topics || []) {
    assert.equal(topic.sectionId, section.id, `${topic.id}: inline topic belongs to its raw section`);
    assert(!registered.has(topic.id), `duplicate raw topic ${topic.id}`);
    registered.add(topic.id);
  }
}
const ids = new Set();
const types = new Set(['prose', 'table', 'bits', 'code', 'steps', 'trace', 'flow', 'exercise']);
const counts = { topics: 0, diagrams: 0, exercises: 0, code: 0, runnable: 0 };
const text = value => assert.equal(typeof value, 'string');
const list = items => { assert(Array.isArray(items) && items.length); items.forEach(text); };
const { bootProgram } = await readCourseModule('src/course/assemblyPrograms.js');
const root = await mkdtemp(join(tmpdir(), 'os-handbook-test-'));

for (const chapter of chapters) for (const section of chapter.sections) for (const topic of section.topics || []) {
  assert(!ids.has(topic.id), `duplicate topic ${topic.id}`); ids.add(topic.id); counts.topics++;
  assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(topic.id));
  assert.equal(topic.sectionId, section.id); text(topic.title); list(topic.intro);
  assert(!JSON.stringify(topic).includes('\u2014'), `${topic.id}: em dash`);
  assert(topic.blocks.length >= 3, `${topic.id}: explanation needs multiple forms`);
  for (const source of topic.references || []) { assert(new URL(source.url).protocol === 'https:'); text(source.label); }
  for (const block of topic.blocks) {
    assert(types.has(block.type), `${topic.id}: unknown block ${block.type}`);
    if (block.type === 'prose') list(block.paragraphs);
    if (['table', 'trace'].includes(block.type)) {
      text(block.caption); list(block.columns); assert(block.rows.length); counts.diagrams++;
      for (const row of block.rows) { assert.equal(row.length, block.columns.length, topic.id); row.forEach(text); }
    }
    if (block.type === 'bits') {
      counts.diagrams++; assert([8,16,32,64].includes(block.width));
      const covered = new Set();
      for (const field of block.fields) {
        text(field.name); text(field.description); assert(field.low >= 0 && field.high < block.width && field.low <= field.high);
        for (let bit = field.low; bit <= field.high; ++bit) { assert(!covered.has(bit), `${topic.id}: overlapping bit ${bit}`); covered.add(bit); }
      }
      assert.equal(covered.size, block.width, `${topic.id}: missing bit`);
    }
    if (block.type === 'code') { text(block.title); text(block.code); list(block.notes); counts.code++; }
    if (block.type === 'steps') { text(block.title); assert(block.items.length); for (const step of block.items) { text(step.title); text(step.text); } }
    if (block.type === 'flow') {
      counts.diagrams++; text(block.title); text(block.intro); text(block.caption);
      const nodes = new Set(block.nodes.map(node => node.id)); assert.equal(nodes.size, block.nodes.length);
      for (const node of block.nodes) { text(node.detail); assert(node.label.length <= 36); if (node.kind === 'decision') { const edges = block.edges.filter(edge => edge.from === node.id); assert(edges.length >= 2 && edges.every(edge => edge.label)); } }
      for (const edge of block.edges) { assert(nodes.has(edge.from) && nodes.has(edge.to)); assert.notEqual(edge.from, edge.to); }
      const reached = new Set([block.nodes[0].id]);
      for (let i = 0; i < nodes.size; i++) for (const edge of block.edges) if (reached.has(edge.from)) reached.add(edge.to);
      assert.equal(reached.size, nodes.size, `${topic.id}: unreachable node`);
    }
    if (block.type === 'exercise') {
      counts.exercises++; text(block.title); text(block.prompt); list(block.tasks); list(block.solution); list(block.checks);
      if (block.mode === 'assembly') for (const kind of ['starterFiles', 'solutionFiles']) {
        const files = block[kind]; if (!files) continue;
        const folder = join(root, `${topic.id}-${kind}`); await mkdir(folder, { recursive: true });
        for (const [path, source] of Object.entries(files)) { await mkdir(dirname(join(folder, path)), { recursive: true }); await writeFile(join(folder, path), source); }
        await writeFile(join(folder, 'boot.asm'), bootProgram('%include "lesson.asm"', files['data.inc'] === undefined ? '' : '%include "data.inc"'));
        execFileSync('nasm', ['-f', 'bin', 'boot.asm', '-o', 'boot.bin'], { cwd: folder });
        const binary = await readFile(join(folder, 'boot.bin')); assert.equal(binary.length, 512); assert.equal(binary.readUInt16LE(510), 0xaa55); counts.runnable++;
      }
    }
  }
}
assert.deepEqual(ids, registered, 'Every registered topic must appear in a lesson');
console.log('PASS: handbook schemas, complete bit layouts, table shapes, connected diagrams, and NASM exercise binaries', counts);
