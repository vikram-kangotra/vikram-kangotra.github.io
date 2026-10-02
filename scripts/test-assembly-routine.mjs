import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readCourseModule } from './course-loader.mjs';

const { prepareGuidedBuild } = await readCourseModule('src/course/guidedBuild.js');
const { bootProgram, routineProgram } = await readCourseModule('src/course/assemblyPrograms.js');
const { assemblyCaseInitialization, routineTestSource, machineTestLoader } = await readCourseModule('src/course/machineTestHarness.js');
const directory = await mkdtemp(join(tmpdir(), 'assembly-routine-'));
const source = 'jmp .code\ntimes 2048 db 0\n.code:\nmov al, \'H\'\ncall putc\n';
const files = Object.freeze({ 'lesson.asm': source, 'data.inc': 'large_data: times 1024 db 0\n', 'personal-notes.txt': 'Keep my own project intact.' });
const input = { registers: { bx: 0x1234 }, memory: [{ address: 'large_data', bytes: [65] }], flags: { carry: true } };
const prepared = prepareGuidedBuild(files, 'assembly', input);
assert.deepEqual(files, { 'lesson.asm': source, 'data.inc': 'large_data: times 1024 db 0\n', 'personal-notes.txt': 'Keep my own project intact.' });
for (const path of Object.keys(files)) assert.equal(prepared[path], files[path]);
const manifest = JSON.parse(prepared['build.json']);
assert.deepEqual(manifest, { type: 'assembly-routine', entry: '__lesson_routine.asm', loader: '__lesson_boot.asm' });
assert.equal(prepared[manifest.loader], machineTestLoader);
assert(prepared[manifest.entry].includes(assemblyCaseInitialization(input)));
assert.match(prepared[manifest.entry], /org 0x8000/);
assert.doesNotMatch(prepared[manifest.entry], /times 510-/);

async function compile(name, project, entries) {
  const folder = join(directory, name); await mkdir(folder);
  for (const [path, text] of Object.entries(project)) await writeFile(join(folder, path), text);
  const result = {};
  for (const [entry, output] of entries) {
    execFileSync(process.env.NASM || 'nasm', ['-Wall', '-Werror', '-w-reloc-abs-word', '-w-reloc-abs-dword', '-f', 'bin', entry, '-o', output], { cwd: folder });
    result[output] = await readFile(join(folder, output));
  }
  return result;
}
const binaries = await compile('large-preview', prepared, [[manifest.loader, 'boot.bin'], [manifest.entry, 'lesson.bin']]);
assert.equal(binaries['boot.bin'].length, 512);
assert.equal(binaries['boot.bin'].readUInt16LE(510), 0xaa55);
assert(binaries['lesson.bin'].length > 3072 && binaries['lesson.bin'].length < 16384);
const graded = await compile('large-grade', { ...files, 'grade.asm': routineTestSource(input, ['large_data'], 0x12345678, true) }, [['grade.asm', 'grade.bin']]);
assert(graded['grade.bin'].length > binaries['lesson.bin'].length && graded['grade.bin'].length <= 16384, 'The same large learner program fits both Run and instrumented Submit');
const maximum = await compile('maximum-preview', { 'lesson.asm': routineProgram("mov al, 'H'\ncall putc", 'times 16384-($-$$) db 0') }, [['lesson.asm', 'lesson.bin']]);
assert.equal(maximum['lesson.bin'].length, 16384);
const rawBoot = await compile('raw-boot', { 'boot.asm': bootProgram("mov al, 'H'\ncall putc") }, [['boot.asm', 'boot.bin']]);
assert.equal(rawBoot['boot.bin'].length, 512, 'Explicit boot-sector exercises keep their BIOS sector contract');
assert.equal(rawBoot['boot.bin'].readUInt16LE(510), 0xaa55);

const setup = { 'lesson.asm': 'call print_hex16', 'playground-inputs.inc': 'mov ax, 0x5678' };
const copied = prepareGuidedBuild(setup, 'assembly', undefined, 'playground-inputs.inc');
assert.match(copied[manifest.entry], /%include "playground-inputs.inc"/);
await compile('copied-inputs', copied, [[manifest.entry, 'lesson.bin']]);
for (const path of ['__lesson_boot.asm', '__lesson_routine.asm']) assert.throws(() => prepareGuidedBuild({ ...files, [path]: 'learner source' }, 'assembly'), /reserved/);
assert.throws(() => prepareGuidedBuild({}, 'assembly'), /Create lesson.asm/);
assert.throws(() => prepareGuidedBuild(setup, 'assembly', undefined, '../inputs.inc'), /missing or has an invalid name/);
assert.deepEqual(prepareGuidedBuild(files, 'kernel'), files, 'Kernel projects are unaffected');
console.log(`PASS assembly routines: ${binaries['lesson.bin'].length}-byte ordinary Run and ${graded['grade.bin'].length}-byte instrumented Submit compile, 16-KiB payload boundary, isolated loader, unchanged raw boot sectors, supplied inputs, and saved-source preservation.`);
console.log(`Native artifacts: ${directory}`);
