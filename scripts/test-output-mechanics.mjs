// Compile the displayed lesson examples with NASM, then run them on the bundled
// v86 WASM/BIOS. Probes use only MOV and balanced PUSHFD/POP or PUSH/POP pairs:
// observing the examples must not change their registers, flags, or stack.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCourseModule } from './course-loader.mjs';

const require = createRequire(import.meta.url);
const { V86 } = require('../public/course/v86/libv86.js');
const { outputMechanicsSections } = await readCourseModule('src/course/assemblyOutputMechanics.js');
const { machineTestLoader } = await readCourseModule('src/course/machineTestHarness.js');
const { prepareGuidedBuild } = await readCourseModule('src/course/guidedBuild.js');
const { readCpuRegisters } = await readCourseModule('src/course/cpuRegisters.js');
const assets = fileURLToPath(new URL('../public/course/v86/', import.meta.url));
const artifacts = await mkdtemp(join(tmpdir(), 'output-mechanics-'));
const registers = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
const segments = ['es', 'cs', 'ss', 'ds'];
const sentinels = { eax: 0x11223344, ebx: 0x55667788, ecx: 0x99aabbcc, edx: 0xddeeff00, esi: 0x13579bdf, edi: 0x2468ace0, ebp: 0x0badf00d };
const entrySP = 0x7bfe;
const meaningfulFlags = 0xed5; // CF, PF, AF, ZF, SF, IF, DF, OF.
const cases = [];
const machines = new Set();

assert.deepEqual(outputMechanicsSections.map(section => section.id), ['pushad-popad', 'pushfd-popfd']);
for (const section of outputMechanicsSections) {
  assert.equal(section.code.filename, 'lesson.asm', 'The executable example is the source displayed in the lesson');
  assert.equal(section.code.language, 'asm');
}

async function assemble(name, source) {
  const sourcePath = join(artifacts, `${name}.asm`);
  const binaryPath = join(artifacts, `${name}.bin`);
  await writeFile(sourcePath, source);
  execFileSync(process.env.NASM || 'nasm', ['-Wall', '-Werror', '-w-reloc-abs-word', '-w-reloc-abs-dword', '-f', 'bin', sourcePath, '-o', binaryPath], { cwd: artifacts });
  return readFile(binaryPath);
}
const loader = await assemble('boot', machineTestLoader);
assert.equal(loader.length, 512);

function startMachine(payload, boot = loader) {
  const disk = new Uint8Array(16 * 1024 * 1024);
  disk.set(boot); disk.set(payload, 512);
  const machine = new V86({
    wasm_path: join(assets, 'v86.wasm'), memory_size: 32 * 1024 * 1024,
    vga_memory_size: 2 * 1024 * 1024,
    bios: { url: join(assets, 'seabios.bin') }, vga_bios: { url: join(assets, 'vgabios.bin') },
    hda: { buffer: disk.buffer }, boot_order: 0x213, autostart: true,
    disable_keyboard: true, disable_mouse: true, disable_speaker: true,
  });
  machines.add(machine);
  return machine;
}

async function execute(section, flags, variant = '') {
  const label = `${section.id}-${flags.toString(16)}${variant ? `-${variant}` : ''}`;
  const expectedRegisters = { ...sentinels, ...(variant === 'edi-transfer' ? { edi: 0x10203040 } : {}) };
  const probes = [];
  function snapshot(name, frame = false) {
    const address = 0x5000 + probes.length * 128;
    probes.push({ name, address, frame });
    const lines = registers.map((register, index) => `mov [cs:${address + index * 4}], ${register}`);
    lines.push('pushfd', `pop dword [cs:${address + 32}]`);
    segments.forEach((segment, index) => lines.push(`mov [cs:${address + 36 + index * 2}], ${segment}`));
    // SS:BP addresses the original top after these two temporary dword saves.
    lines.push('push eax', 'push ebp', 'mov bp, sp', 'mov eax, [ss:bp+8]', `mov [cs:${address + 44}], eax`, 'pop ebp', 'pop eax');
    if (frame) {
      lines.push('push eax');
      for (let index = 0; index < 8; index++) lines.push(`mov eax, [ss:${entrySP - 32 + index * 4}]`, `mov [cs:${address + 64 + index * 4}], eax`);
      lines.push('pop eax');
    }
    return `\n; Non-destructive test probe: ${name}\n${lines.join('\n')}\n`;
  }
  let source = section.code.source;
  if (variant === 'edi-transfer') {
    assert.match(source, /mov edi, 0x2468ace0/i);
    source = source.replace(/mov edi, 0x2468ace0/i, 'mov edi, 0x10203040');
    assert.match(section.deepDive.transfer, /0x10203040/, 'The variant follows the published transfer exercise');
  }
  if (variant === 'carry-transfer') {
    assert.match(source, /add eax, 1/i);
    source = source.replace(/add eax, 1/i, 'add eax, 0xffffffff');
    assert.match(section.deepDive.transfer, /0xFFFFFFFF/, 'The variant follows the published transfer exercise');
  }
  if (section.id === 'pushad-popad') {
    assert.equal([...source.matchAll(/^\s*pushad\s*(?:;[^\n]*)?$/gmi)].length, 1);
    assert.equal([...source.matchAll(/^\s*popad\s*(?:;[^\n]*)?$/gmi)].length, 1);
    source = source.replace(/^(\s*pushad\s*(?:;[^\n]*)?)$/mi, (_, instruction) => snapshot('seeded') + instruction + snapshot('saved-frame', true));
    source = source.replace(/^(\s*popad\s*(?:;[^\n]*)?)$/mi, (_, instruction) => snapshot('scratch')
      + (variant === 'discarded-esp' ? `mov dword [ss:${entrySP - 20}], 0xdeadbeef\n` : '')
      + instruction + snapshot('restored'));
  } else {
    let step = 0;
    source = source.replace(/^(\s*(?:pushfd|popfd|pop (?:ebx|ecx|edx))\s*(?:;[^\n]*)?)$/gmi, instruction => instruction + snapshot(`stack-${step++}`));
    assert.equal(step, 10, 'Observe every saved FLAGS image and register capture in the displayed example');
  }
  const entry = snapshot('entry');
  const finished = snapshot('finished');
  const returned = snapshot('returned');
  const fixture = `bits 16
org 0x8000
jmp 0:start
start:
cli
xor ax, ax
mov ds, ax
mov es, ax
mov ss, ax
mov esp, 0x7c00
; Mask hardware IRQs so IF can be exercised without asynchronous BIOS work.
mov al, 0xff
out 0x21, al
out 0xa1, al
mov ax, 0x1200
mov ds, ax
mov ax, 0x2300
mov es, ax
${Object.entries(sentinels).map(([register, value]) => `mov ${register}, ${value}`).join('\n')}
push dword ${flags}
popfd
call lesson
${returned}
mov dword [cs:0x4ff0], 0x504f5041
cli
halt:
hlt
jmp halt
lesson:
${entry}
${source}
${finished}
ret
`;
  const payload = await assemble(label, fixture);
  assert(payload.length <= 16384, 'The example and probes fit the real course loader');
  const machine = startMachine(payload);
  const deadline = Date.now() + 20000;
  const complete = () => machine.v86?.cpu && Buffer.from(machine.read_memory(0x4ff0, 4)).readUInt32LE() === 0x504f5041;
  while (!complete() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert(complete(), `${label}: example must return to its caller`);
  await machine.stop();
  const states = Object.fromEntries(probes.map(({ name, address, frame }) => {
    const bytes = Buffer.from(machine.read_memory(address, 96));
    return [name, {
      registers: Object.fromEntries(registers.map((register, index) => [register, bytes.readUInt32LE(index * 4)])),
      flags: bytes.readUInt32LE(32),
      segments: Object.fromEntries(segments.map((segment, index) => [segment, bytes.readUInt16LE(36 + index * 2)])),
      topDword: bytes.readUInt32LE(44), topBytes: Array.from(bytes.subarray(44, 48)),
      ...(frame ? { frame: Array.from({ length: 8 }, (_, index) => bytes.readUInt32LE(64 + index * 4)), frameBytes: Array.from(bytes.subarray(64, 96)) } : {}),
    }];
  }));
  await machine.destroy(); machines.delete(machine);
  assert.equal(states.entry.registers.esp, entrySP);
  assert.equal(states.entry.flags & meaningfulFlags, flags & meaningfulFlags);
  assert.deepEqual(states.entry.segments, { es: 0x2300, cs: 0, ss: 0, ds: 0x1200 });
  for (const state of Object.values(states)) assert.deepEqual(state.segments, states.entry.segments, 'General-register and flag instructions leave every segment register unchanged');
  assert.equal(states.finished.registers.esp, entrySP, 'All explicit stack operations balance before RET');
  assert.equal(states.returned.registers.esp, 0x7c00, 'The original two-byte return offset is consumed by RET');
  assert.equal(states.finished.flags, states.entry.flags, 'The example preserves incoming ordinary FLAGS including IF and DF');
  assert.deepEqual(states.returned.registers, { ...states.finished.registers, esp: 0x7c00 });
  assert.equal(states.returned.flags, states.finished.flags);
  if (section.id === 'pushad-popad') {
    assert.deepEqual(states.seeded.registers, { ...expectedRegisters, esp: entrySP });
    assert.equal(states['saved-frame'].registers.esp, entrySP - 32);
    assert.deepEqual(states['saved-frame'].frame, [expectedRegisters.edi, sentinels.esi, sentinels.ebp, entrySP, sentinels.ebx, sentinels.edx, sentinels.ecx, sentinels.eax], 'PUSHAD stores eight dwords in the documented top-to-bottom order, including the original ESP');
    assert.deepEqual(states['saved-frame'].frameBytes.slice(28), [0x44, 0x33, 0x22, 0x11], 'Saved EAX uses the documented little-endian bytes at 0x7BFA');
    assert.deepEqual(states['saved-frame'].topBytes, variant === 'edi-transfer' ? [0x40, 0x30, 0x20, 0x10] : [0xe0, 0xac, 0x68, 0x24], 'EDI occupies the new top with the predicted little-endian bytes');
    assert.deepEqual(states.scratch.registers, { ...Object.fromEntries(Object.keys(sentinels).map(name => [name, 0])), esp: entrySP - 32 }, 'The lesson actually destroys all seven temporary register values before POPAD');
    assert.deepEqual(states.restored.registers, states.seeded.registers, variant === 'discarded-esp' ? 'POPAD discards the poisoned saved ESP value and advances across its four-byte slot' : 'POPAD restores every full-width sentinel');
    for (const state of Object.values(states)) assert.equal(state.flags, states.entry.flags, 'MOV, PUSHAD, and POPAD do not alter arithmetic flags or DF');
  } else {
    const result = states.finished.registers;
    assert.equal(result.eax, variant === 'carry-transfer' ? 0 : 2, 'POPFD leaves the arithmetic result in EAX intact');
    assert.equal(result.edx, result.ebx, 'The second FLAGS capture exactly matches the saved baseline');
    assert.equal(result.ebx & 0xcd5, 0x445, 'CMP zero, STC, and STD establish PF/ZF/CF/DF');
    assert.equal(result.ecx & 0xcd5, variant === 'carry-transfer' ? 0x55 : 0, 'The captured arithmetic flags and DF match the selected ADD result');
    for (const register of ['ebx', 'ecx', 'edx']) assert.equal(result[register] & 0x200, flags & 0x200, 'Changing arithmetic flags and DF leaves IF untouched');
    for (const register of ['esi', 'edi', 'ebp']) assert.equal(result[register], sentinels[register]);
    const stack = Object.entries(states).filter(([name]) => name.startsWith('stack-')).map(([, state]) => state.registers.esp);
    assert.deepEqual(stack, [-4, -8, -4, -8, -12, -8, -4, -8, -4, 0].map(offset => entrySP + offset), 'Every FLAGS image consumes one dword and every matching POP consumes exactly that image');
    for (const name of ['stack-0', 'stack-2', 'stack-6', 'stack-8']) assert.equal(states[name].topDword, states.entry.flags, 'The outer caller image stays available until its final restore');
    for (const name of ['stack-1', 'stack-3', 'stack-5', 'stack-7']) assert.equal(states[name].topDword, result.ebx, 'The inner saved image has the same bytes as the seeded/restored register snapshots');
    assert.equal(states['stack-4'].topDword, result.ecx, 'The temporary changed-state image matches ECX');
    if (!(flags & 0x200)) assert.deepEqual(states['stack-1'].topBytes, [0x47, 0x04, 0x00, 0x00], 'The paper example is the actual little-endian 0x00000447 flags image when IF is clear');
  }
  cases.push({ label, payloadBytes: payload.length, states });
  console.log(`PASS ${label}: displayed source, stack snapshots, full registers, segments, and caller FLAGS`);
}

async function runOrdinaryWrapper(section) {
  const label = `${section.id}-ordinary-run`;
  const files = {
    'lesson.asm': section.code.source,
    'console.asm': '; Neither mechanics example calls a printing helper.\n',
    'data.inc': '',
  };
  const build = prepareGuidedBuild(files, 'assembly', undefined, undefined, { learnerHelpers: true });
  assert.equal(build['lesson.asm'], section.code.source, 'Ordinary Run compiles the unchanged displayed example');
  const manifest = JSON.parse(build['build.json']);
  assert.equal(manifest.type, 'assembly-routine');
  for (const [name, source] of Object.entries(build)) await writeFile(join(artifacts, name), source);
  const payload = await assemble(label, build[manifest.entry]);
  const boot = await assemble(`${label}-loader`, build[manifest.loader]);
  const machine = startMachine(payload, boot);
  const expectedEAX = section.id === 'pushad-popad' ? sentinels.eax : 2;
  const finished = () => machine.v86?.cpu?.in_hlt[0] && (machine.v86.cpu.reg32[0] >>> 0) === expectedEAX;
  const deadline = Date.now() + 20000;
  while (!finished() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
  assert(finished(), `${label}: actual course startup must reach its normal lesson halt`);
  await machine.stop();
  const state = readCpuRegisters(machine);
  assert.equal(state.registers.esp, 0x7c00, 'The real BIOS/startup provides zero upper ESP bits and a balanced wrapper return');
  for (const segment of ['cs', 'ds', 'es', 'ss']) assert.equal(state.segments[segment], 0);
  assert.equal(state.eflags & 0x600, 0, 'The incoming DF is restored; the wrapper deliberately clears IF before HLT');
  if (section.id === 'pushad-popad') {
    for (const [register, value] of Object.entries(sentinels)) assert.equal(state.registers[register], value);
  } else {
    assert.equal(state.registers.edx, state.registers.ebx);
    assert.equal(state.registers.ebx & 0xcd5, 0x445);
    assert.equal(state.registers.ecx & 0xcd5, 0);
    for (const register of ['ebx', 'ecx', 'edx']) assert.equal(state.registers[register] & 0x200, 0x200, 'Snapshot IF reflects the actual STI startup even though the final live IF is clear');
  }
  await machine.destroy(); machines.delete(machine);
  cases.push({ label, payloadBytes: payload.length, state });
  console.log(`PASS ${label}: unchanged example with real startup, wrapper return, zero upper ESP, and final CLI/HLT`);
}

const deadline = setTimeout(() => { console.error('Output mechanics checks exceeded 120 seconds'); process.exit(1); }, 120000);
deadline.unref();
try {
  if (!process.argv.includes('--run-only')) {
    for (const section of outputMechanicsSections) for (const flags of [0x2, 0xed7]) await execute(section, flags);
    await execute(outputMechanicsSections[0], 0xed7, 'discarded-esp');
    await execute(outputMechanicsSections[0], 0xed7, 'edi-transfer');
    await execute(outputMechanicsSections[1], 0xed7, 'carry-transfer');
  }
  for (const section of outputMechanicsSections) await runOrdinaryWrapper(section);
  await writeFile(join(artifacts, 'results.json'), JSON.stringify({ ok: true, cases }, null, 2));
  console.log(`PASS ${cases.length} native NASM / real v86 lesson executions. Artifacts: ${artifacts}`);
} finally {
  clearTimeout(deadline);
  await Promise.all([...machines].map(machine => machine.destroy().catch(() => {})));
}
