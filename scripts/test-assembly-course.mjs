import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readCourseModule } from './course-loader.mjs';

const { chapters } = await readCourseModule('src/course/index.js');
const lessons = chapters.filter((chapter) => chapter.assembly);
assert(lessons.length >= 12, 'Keep the established complete boot-sector examples');
const workspace = await mkdtemp(join(tmpdir(), 'os-assembly-course-'));
const cases = [];
try {
  for (const chapter of lessons) {
    const lab = chapter.assembly;
    assert(chapter.sections.length >= 8, `${chapter.slug}: granular lessons`);
    assert(Number.isSafeInteger(lab.question.answer), `${chapter.slug}: numeric prediction`);
    assert(lab.expectedOutput.trim(), `${chapter.slug}: observable outcome`);
    assert.equal(chapter.challenge.starter, lab.starter);
    assert.equal(chapter.challenge.solution, lab.solution);
    for (const variant of ['example', 'starter', 'solution']) {
      const path = join(workspace, `${chapter.slug}-${variant}.asm`);
      await writeFile(path, lab[variant]);
      execFileSync('nasm', ['-f', 'bin', '-w+error', path, '-o', `${path}.bin`], { stdio: 'pipe' });
      const bytes = await readFile(`${path}.bin`);
      assert.equal(bytes.length, 512);
      assert.equal(bytes.readUInt16LE(510), 0xaa55);
    }
    cases.push({ slug: chapter.slug, example: lab.example, starter: lab.starter, solution: lab.solution, expected: lab.expectedOutput.replace(/\s+/g, ' ').trim(), answer: lab.question.answer });
    console.log(`PASS ${chapter.id} ${chapter.slug}: example, starter, solution assemble`);
  }
  if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(cases));
  console.log(`PASS ${lessons.length * 3} complete boot-sector examples across ${lessons.length} legacy labs; guided helper implementations have separate executable tests.`);
} finally { await rm(workspace, { recursive: true, force: true }); }
