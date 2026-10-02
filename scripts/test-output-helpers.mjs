import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readCourseModule } from './course-loader.mjs';

const { guidedOutput: guide } = await readCourseModule('src/course/guidedOutput.js');
const { outputCheckpointTests } = await readCourseModule('src/course/outputCheckpointTests.js');
const { routineTestSource, machineAddress, machineTestLoader, assemblyCaseInitialization } = await readCourseModule('src/course/machineTestHarness.js');
const { prepareGuidedBuild } = await readCourseModule('src/course/guidedBuild.js');
const root = await mkdtemp(join(tmpdir(), 'output-helper-contracts-'));
const names = ['putc', 'newline', 'puts', 'print_hex16'];
assert.deepEqual(guide.steps.map(step => step.tests.entry), names);
assert.equal(guide.file, 'console.asm');
assert.equal(guide.learnerHelpers, true);
assert.equal(JSON.parse(guide.initialFiles['build.json']).learnerHelpers, true);
assert.deepEqual(guide.steps.map(step => step.tests.cases.length), [5, 4, 6, 8]);

async function compile(folder, path, target) {
  execFileSync(process.env.NASM || 'nasm', ['-Wall', '-Werror', '-w-reloc-abs-word', '-w-reloc-abs-dword', '-f', 'bin', path, '-o', target], { cwd: folder });
  return readFile(join(folder, target));
}
let cases = 0;
for (const [index, step] of guide.steps.entries()) {
  const tests = step.tests;
  assert.equal(tests, outputCheckpointTests[index]);
  assert.equal(tests.kind, 'routine');
  assert.equal(tests.learnerHelpers, true);
  const files = { ...step.reference.files, 'lesson.asm': step.reference.body, 'data.inc': step.reference.data };
  const before = structuredClone(files);
  assert.match(files['console.asm'], new RegExp(`^${names[index]}:`, 'm'));
  for (const name of names.slice(0, index + 1)) assert.match(files['console.asm'], new RegExp(`^${name}:`, 'm'), 'Each new helper retains earlier learner implementations');
  for (const name of names.slice(index + 1)) assert.doesNotMatch(files['console.asm'], new RegExp(`^${name}:`, 'm'), 'Later answers are not dependencies of the current checkpoint');
  for (const [caseIndex, test] of tests.cases.entries()) {
    cases++;
    const { esp, ...preserved } = test.expect.registers;
    assert.deepEqual(preserved, test.input.registers, 'Every full general-register sentinel must survive');
    assert.equal(esp, 0x7c00, 'The full stack pointer returns to its caller position');
    assert.deepEqual(test.expect.flags, test.input.flags, 'Every caller FLAGS bit must survive');
    assert.deepEqual(test.expect.segments, test.input.segments, 'Caller DS and ES must survive');
    for (const name of ['eax', 'ebx', 'ecx', 'edx', 'esi', 'edi', 'ebp']) assert(Object.hasOwn(test.expect.registers, name), `${tests.entry}: missing ${name} preservation assertion`);
    for (const flag of ['carry', 'parity', 'auxiliary', 'zero', 'sign', 'interrupt', 'direction', 'overflow']) assert.equal(typeof test.expect.flags[flag], 'boolean');
    assert(test.expect.memory.some(memory => machineAddress(memory.address) === String(0x450)), 'Cursor coordinates need an exact memory assertion');
    const folder = join(root, `${tests.entry}-${caseIndex}`); await mkdir(folder);
    for (const [path, source] of Object.entries(files)) await writeFile(join(folder, path), source);
    const addresses = [...new Set(['__grade_data_before', '__grade_data_after', ...test.expect.memory.map(memory => machineAddress(memory.address)), ...Object.values(test.expect.registers).filter(value => typeof value === 'string').map(machineAddress)])];
    const source = routineTestSource(test.input, addresses, 0x11223344, true, tests);
    assert.match(source, new RegExp(`call ${tests.entry}\\s`), 'The grader calls the implementation directly');
    assert.match(source, /%include "console.asm"/);
    assert.doesNotMatch(source, /%include "lesson.asm"/, 'Direct helper grading is independent of the exploratory caller');
    assert.doesNotMatch(source, /^(putc|newline|puts|print_hex16):/m, 'No supplied helper can shadow the learner implementation');
    await writeFile(join(folder, 'grade.asm'), source);
    const payload = await compile(folder, 'grade.asm', 'grade.bin');
    assert(payload.length > 0 && payload.length <= 16384);
    if (caseIndex === 0) {
      const build = prepareGuidedBuild(Object.freeze(files), 'assembly', test.input, undefined, tests);
      assert.deepEqual(files, before, 'Preparing Run leaves saved source unchanged');
      const manifest = JSON.parse(build['build.json']);
      assert.equal(manifest.learnerHelpers, true);
      assert.match(build[manifest.entry], /%include "console.asm"/);
      assert.doesNotMatch(build[manifest.entry], /^(putc|newline|puts|print_hex16):/m);
      for (const [path, text] of Object.entries(build)) await writeFile(join(folder, path), text);
      assert((await compile(folder, manifest.entry, 'run.bin')).length <= 16384);
      const loader = await compile(folder, manifest.loader, 'boot.bin');
      assert.equal(loader.length, 512); assert.equal(loader.readUInt16LE(510), 0xaa55);
      assert.equal(build[manifest.loader], machineTestLoader);
      // Copying to the playground preserves ownership in its file manifest.
      const copy = prepareGuidedBuild({ ...files, 'build.json': build['build.json'] }, 'assembly', test.input);
      assert.equal(JSON.parse(copy['build.json']).learnerHelpers, true);
      assert.match(copy[manifest.entry], /%include "console.asm"/);
      const nullManifest = prepareGuidedBuild({ ...files, 'build.json': 'null' }, 'assembly', test.input, undefined, tests);
      assert.equal(JSON.parse(nullManifest['build.json']).learnerHelpers, true, 'A null saved manifest does not block the chapter-owned build mode');
      await writeFile(join(folder, 'lesson.asm'), 'This unfinished Run caller is not valid assembly.\n');
      assert.deepEqual(await compile(folder, 'grade.asm', 'invalid-caller.bin'), payload, 'An invalid exploratory caller cannot change the direct helper test');
      await unlink(join(folder, 'lesson.asm'));
      assert.deepEqual(await compile(folder, 'grade.asm', 'missing-caller.bin'), payload, 'A missing exploratory caller cannot block the direct helper test');
      await writeFile(join(folder, 'console.asm'), '; no implementation\n');
      assert.throws(() => execFileSync(process.env.NASM || 'nasm', ['-f', 'bin', 'grade.asm', '-o', 'missing.bin'], { cwd: folder, stdio: 'pipe' }), error => error.stderr.toString().includes(`symbol \`${tests.entry}\``) || /not defined/.test(error.stderr.toString()), 'Missing implementations cannot fall back to a hidden helper');
    }
  }
}
assert.equal(cases, 23);
const newline = guide.steps[1].tests.cases;
assert(newline.some(test => test.input.memory.some(memory => memory.address === 0x450 && memory.bytes[0] > 0)), 'Newline cases distinguish CR from LF');
assert(newline.some(test => test.input.memory.some(memory => memory.address === 0x450 && memory.bytes[1] === 24)), 'Newline tests the bottom-row scroll case');
const puts = guide.steps[2].tests.cases;
assert(puts.some(test => test.expect.output === '' && test.input.flags.direction), 'Empty strings must preserve an incoming set DF');
assert(puts.some(test => test.input.flags.direction && test.expect.output.length > 0), 'Nonempty strings must advance forward when DF is set');
assert(puts.some(test => test.input.memory.some(memory => memory.bytes.indexOf(0) < memory.bytes.length - 1)), 'Bytes after the first terminator must stay invisible');
assert.deepEqual(guide.steps[3].tests.cases.map(test => test.expect.output), ['0000', '0009', '000A', '000F', '0010', '0ABC', '1234', 'FFFF']);
assert.throws(() => routineTestSource({}, [], 1, false, { learnerHelpers: true, entry: 'lesson' }), /Unknown output-helper entry/);
assert.throws(() => prepareGuidedBuild({ 'lesson.asm': 'call putc' }, 'assembly', {}, undefined, { learnerHelpers: true }), /console.asm/);
assert.throws(() => assemblyCaseInitialization({ segments: { cs: 0 } }), /Invalid segment input/);
assert.throws(() => assemblyCaseInitialization({ segments: { ds: 65536 } }), /Invalid segment input/);
assert.throws(() => assemblyCaseInitialization({ registers: { esi: 'message; injected' } }), /Unsupported machine-test address/);
console.log(`PASS ${cases} native output-helper cases; four direct implementation entries, register/FLAGS/segment/cursor contracts, learner-only dependencies, ordinary Run, copied manifests, and missing-implementation rejection.`);
console.log(`Native artifacts: ${root}`);
