import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCourseModule } from './course-loader.mjs';

const { guidedAssemblyBySlug } = await readCourseModule('src/course/guidedAssembly.js');
const { guidedKernel } = await readCourseModule('src/course/guidedKernel.js');
const { machineAddress, routineTestSource, machineTestLoader, assemblyCaseInitialization } = await readCourseModule('src/course/machineTestHarness.js');
const { bootProgram } = await readCourseModule('src/course/assemblyPrograms.js');
const directory = await mkdtemp(join(tmpdir(), 'os-machine-contracts-'));
const normalize = value => String(value).replace(/\s+/g, ' ').trim();
let checkpoints = 0, cases = 0, parameterized = 0;
const runtimeCases = [];
for (const [slug, guide] of Object.entries(guidedAssemblyBySlug)) {
  for (const [stepIndex, step] of guide.steps.entries()) {
    checkpoints++;
    assert.equal(step.tests.kind, 'routine');
    assert(step.tests.contract && step.tests.scope);
    assert(step.instructions.includes(step.tests.contract));
    assert(step.tests.cases.length > 0 && step.tests.cases.length <= 12);
    assert.equal(normalize(step.tests.cases[0].expect.output), normalize(step.expectedOutput));
    if (step.tests.cases.length > 1) parameterized++;
    for (const [caseIndex, testCase] of step.tests.cases.entries()) {
      cases++;
      const folder = join(directory, `${slug}-${stepIndex}-${caseIndex}`); await mkdir(folder);
      await writeFile(join(folder, 'lesson.asm'), step.reference.body);
      if (step.reference.data) await writeFile(join(folder, 'data.inc'), step.reference.data);
      const addresses = [...new Set([
        ...(testCase.expect.memory || []).map(memory => machineAddress(memory.address)),
        ...Object.values(testCase.expect.registers || {}).filter(value => typeof value === 'string').map(machineAddress),
      ])];
      runtimeCases.push({ slug, stepIndex, caseIndex, folder, addresses, testCase });
      await writeFile(join(folder, 'machine.asm'), routineTestSource(testCase.input, addresses, 0x11223344, !!step.reference.data));
      execFileSync(process.env.NASM || 'nasm', ['-Wall', '-Werror', '-w-reloc-abs-word', '-w-reloc-abs-dword', '-f', 'bin', 'machine.asm', '-o', 'machine.bin'], { cwd: folder });
      // The ordinary Run and instrumented checks must start with the same inputs.
      if (caseIndex === 0) {
        const source = bootProgram(step.reference.body, step.reference.data || '', assemblyCaseInitialization(testCase.input));
        await writeFile(join(folder, 'run.asm'), source);
        execFileSync(process.env.NASM || 'nasm', ['-Wall', '-Werror', '-w-reloc-abs-word', '-w-reloc-abs-dword', '-f', 'bin', 'run.asm', '-o', 'run.bin'], { cwd: folder });
      }
    }
  }
}
await writeFile(join(directory, 'loader.asm'), machineTestLoader);
execFileSync(process.env.NASM || 'nasm', ['-f', 'bin', 'loader.asm', '-o', 'loader.bin'], { cwd: directory });
await writeFile(join(directory, 'contracts.json'), JSON.stringify(runtimeCases));
assert.equal(checkpoints, 36);
assert(parameterized >= 24, 'General operations must have varied inputs, not only sample literals.');
assert.equal(guidedKernel.steps.filter(step => step.runnable && step.tests?.kind === 'kernel').length, 3);
for (const step of guidedKernel.steps.filter(step => step.runnable)) {
  assert(step.tests.contract && step.tests.scope);
  assert(step.tests.cases[0].expect.protectedMode);
  assert.equal(normalize(step.tests.cases[0].expect.output), normalize(step.expectedOutput));
}
console.log(`PASS ${checkpoints} assembly checkpoint contracts, ${cases} compilable instrumented cases, ${parameterized} varied-input checkpoints, 36 ordinary-run sample images, and 3 explicit C entry contracts.`);
console.log(`Native artifacts: ${directory}`);
