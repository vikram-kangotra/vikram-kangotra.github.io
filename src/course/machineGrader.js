/* global Uint8Array, Uint32Array, DataView, Map, Set */
import { buildProject } from './projectCompiler';
import { kernelProjectFiles } from './kernelProject';
import { helperIds, machineAddress, machineTestLayout as L, machineTestLoader, routineTestSource, testFlagBits } from './machineTestHarness';

// Test code is executed by the same pinned native x86 emulator as the visible
// lab. This is an educational checker, not a tamper-proof certification system:
// learner code owns the guest and can overwrite its measurement mailbox.
const normalize = value => String(value).replace(/\0/g, '').replace(/\s+/g, ' ').trim();
const abortError = () => new DOMException('Machine tests cancelled.', 'AbortError');
function checkAbort(signal) { if (signal?.aborted) throw abortError(); }
let runtime;
async function loadRuntime(signal) {
  checkAbort(signal);
  if (window.V86 || window.V86Starter) return;
  if (!runtime) runtime = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = '/course/v86/libv86.js'; script.async = true;
    const timer = setTimeout(() => { script.remove(); runtime = null; reject(new Error('The x86 runtime did not load within 30 seconds.')); }, 30000);
    script.onload = () => { clearTimeout(timer); if (window.V86 || window.V86Starter) resolve(); else { runtime = null; reject(new Error('The x86 runtime is unavailable.')); } };
    script.onerror = () => { clearTimeout(timer); runtime = null; reject(new Error('Could not load the x86 runtime.')); };
    document.head.appendChild(script);
  });
  await new Promise((resolve, reject) => {
    const abort = () => reject(abortError()); signal?.addEventListener('abort', abort, { once: true });
    runtime.then(resolve, reject).finally(() => signal?.removeEventListener('abort', abort));
  });
  checkAbort(signal);
}
function compileRoutine(files, testCase, addresses, cookie, signal) {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const worker = new Worker('/course/grader/worker.js'); let finished = false;
    const finish = (error, result) => { if (finished) return; finished = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); worker.terminate(); if (error) reject(error); else resolve(result); };
    const abort = () => finish(abortError());
    const timer = setTimeout(() => finish(new Error('Machine-test assembly exceeded 30 seconds. Check macros and repetitions.')), 30000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = event => finish(new Error(event.message || 'The machine-test compiler could not start.'));
    worker.onmessage = ({ data }) => data?.ok ? finish(null, new Uint8Array(data.disk)) : finish(new Error(data?.error || 'The machine-test harness could not assemble.'));
    try { worker.postMessage({ files, source: routineTestSource(testCase.input, addresses, cookie, Object.hasOwn(files, 'data.inc')), loader: machineTestLoader }); }
    catch (error) { finish(error); }
  });
}
const registerOrder = ['eax', 'ebx', 'ecx', 'edx', 'esi', 'edi', 'ebp', 'esp'];
function readRegisters(view, offset) {
  const result = {};
  registerOrder.forEach((name, index) => { result[name] = view.getUint32(offset + index * 4, true); result[name.slice(1)] = result[name] & 0xffff; });
  for (const prefix of ['a', 'b', 'c', 'd']) { result[`${prefix}l`] = result[`${prefix}x`] & 255; result[`${prefix}h`] = result[`${prefix}x`] >>> 8; }
  return result;
}
function readFlags(word) { return Object.fromEntries(Object.entries(testFlagBits).map(([name, bit]) => [name, !!(word & (1 << bit))])); }
function assertion(label, expected, actual, hint) { return { label, expected, actual, passed: JSON.stringify(expected) === JSON.stringify(actual), hint: hint || 'Trace the instructions that produce this value, then test the boundary again.' }; }
const asHex = value => `0x${(value >>> 0).toString(16).toUpperCase()}`;
function registerAssertions(expected, actual, resolve, label = '') {
  return Object.entries(expected || {}).map(([name, value]) => {
    const number = typeof value === 'string' ? resolve(value) : value;
    const bits = name.startsWith('e') ? 32 : /[lh]$/.test(name) ? 8 : 16;
    const normalized = bits === 32 ? number >>> 0 : number & ((1 << bits) - 1);
    return assertion(`${label}${name.toUpperCase()}`, asHex(normalized), actual[name] === undefined ? 'unavailable' : asHex(actual[name]), 'Inspect the operand width and which register your instruction actually changes.');
  });
}
function flagAssertions(expected, actual, label = '') {
  return Object.entries(expected || {}).map(([name, value]) => assertion(`${label}${name} flag`, value, actual[name], 'Capture flags immediately after the instruction being tested. Signed overflow and unsigned carry are different conditions.'));
}
function caseAddresses(testCase) {
  const values = ['__grade_data_before', '__grade_data_after',
    ...(testCase.expect?.memory || []).map(memory => memory.address),
    ...Object.values(testCase.expect?.registers || {}).filter(value => typeof value === 'string'),
    ...(testCase.expect?.observations || []).flatMap(observation => Object.values(observation.registers || {}).filter(value => typeof value === 'string')),
  ];
  const addresses = [...new Set(values.map(machineAddress))];
  if (addresses.length > 64) throw new Error('A machine test may inspect at most 64 memory locations.');
  return addresses;
}
function captureRoutine(machine, addresses) {
  const raw = machine.read_memory(L.complete, 0x2000); const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const offsets = new Map(addresses.map((address, index) => [address, view.getUint32(L.addresses - L.complete + index * 4, true)]));
  const observations = [];
  const count = Math.min(view.getUint16(L.count - L.complete, true), L.maxObservations);
  for (let index = 0; index < count; index += 1) {
    const offset = L.observations - L.complete + index * 40;
    observations.push({ helper: Object.keys(helperIds).find(name => helperIds[name] === view.getUint16(offset, true)) || 'unknown', registers: readRegisters(view, offset + 4), flags: readFlags(view.getUint32(offset + 36, true)) });
  }
  const length = Math.min(view.getUint16(L.length - L.complete, true), L.maxOutput);
  return { registers: readRegisters(view, L.registers - L.complete), flags: readFlags(view.getUint32(L.flags - L.complete, true)), observations,
    output: machine.screen_adapter.get_text_screen().join('\n'),
    helperOutput: String.fromCharCode(...raw.subarray(L.output - L.complete, L.output - L.complete + length)),
    guard: [...raw.subarray(L.guard - L.complete, L.guard - L.complete + L.guardSize)], offsets,
    memory: (address, size) => [...machine.read_memory(offsets.get(machineAddress(address)), size)],
  };
}
function evaluateRoutine(machine, testCase, addresses) {
  const state = captureRoutine(machine, addresses); const expected = testCase.expect || {};
  const assertions = [assertion('Routine returned to its caller', true, true),
    assertion('Stack restored after RET', '0x7C00', asHex(state.registers.sp), 'Balance every push, pop, argument cleanup, and return. Lesson entry SP is 0x7BFE; RET restores the caller to 0x7C00.'),
    assertion('Stack boundary guard preserved', true, state.guard.every(value => value === L.guardValue), 'Your stack or memory writes reached reserved bytes below the lesson stack.'),
    ...registerAssertions(expected.registers, state.registers, address => state.offsets.get(machineAddress(address))),
    ...flagAssertions(expected.flags, state.flags),
    assertion('Data boundary guards preserved', true, ['__grade_data_before', '__grade_data_after'].every(address => state.memory(address, 16).every(byte => byte === 0xa7)), 'A write escaped your data declarations. Check its width, count, and final address.')];
  if (expected.output !== undefined) assertions.push(assertion('Actual VGA output', normalize(expected.output), normalize(state.output), 'Follow the values reaching putc, print_hex16, or puts. Printing a constant does not satisfy the register and memory checks.'));
  for (const memory of expected.memory || []) {
    const address = machineAddress(memory.address);
    if (!Array.isArray(memory.bytes) || memory.bytes.length > 512) throw new Error('Invalid memory assertion size.');
    assertions.push(assertion(`Memory at ${address}`, memory.bytes.map(byte => asHex(byte)).join(' '), state.memory(address, memory.bytes.length).map(byte => asHex(byte)).join(' '), 'Check the effective address, element width, and whether neighboring bytes should remain unchanged.'));
  }
  if (expected.observations) {
    assertions.push(assertion('Number of output helper calls', expected.observations.length, state.observations.length));
    expected.observations.forEach((observation, index) => {
      const actual = state.observations[index]; const label = `Call ${index + 1} / ${observation.helper}: `;
      assertions.push(assertion(`${label}helper`, observation.helper, actual?.helper || 'not reached'));
      assertions.push(...registerAssertions(observation.registers, actual?.registers || {}, address => state.offsets.get(machineAddress(address)), label));
      assertions.push(...flagAssertions(observation.flags, actual?.flags || {}, label));
    });
  }
  return { name: testCase.name, passed: assertions.every(item => item.passed), assertions };
}
function execute(disk, { signal, cookie, capture, onReady, onTimeout, timeoutMs = 10000 }) {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const V86 = window.V86 || window.V86Starter;
    let machine; let interval; let ready = false; let entered = false; let finished = false; let serial = '';
    const finish = async (error, value) => {
      if (finished) return; finished = true; clearTimeout(timer); clearInterval(interval); signal?.removeEventListener('abort', abort);
      try { if (machine) await machine.destroy(); } catch { /* the deadline or abort still ends this case */ }
      if (error) reject(error); else resolve(value);
    };
    const abort = () => finish(abortError());
    let timer = setTimeout(() => finish(new Error('The test emulator did not initialize within 30 seconds.')), 30000);
    const inspectMailbox = () => {
      if (!ready || finished) return;
      const bytes = machine.read_memory(L.complete, 8);
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      // A short routine can enter and finish between samples. Completion wins.
      if (view.getUint32(0, true) === (cookie >>> 0)) {
        finish(null, capture(machine, serial));
        return;
      }
      if (!entered && view.getUint32(4, true) === ((cookie ^ 0x13579bdf) >>> 0)) {
        entered = true;
        clearTimeout(timer);
        timer = setTimeout(() => deadline('execution'), timeoutMs);
      }
    };
    const deadline = phase => {
      if (finished) return;
      try {
        // Account for progress made just before a delayed polling callback.
        inspectMailbox();
        if (finished || (phase === 'boot' && entered)) return;
        finish(null, { timeout: true, phase, ...(onTimeout?.(machine, phase) || {}) });
      } catch (error) { finish(error); }
    };
    signal?.addEventListener('abort', abort, { once: true });
    try {
      machine = new V86({ wasm_path: '/course/v86/v86.wasm', memory_size: 32 * 1024 * 1024, vga_memory_size: 2 * 1024 * 1024,
        bios: { url: '/course/v86/seabios.bin' }, vga_bios: { url: '/course/v86/vgabios.bin' }, hda: { buffer: disk.buffer },
        autostart: false, fastboot: true, boot_order: 0x213, disable_keyboard: true, disable_mouse: true, disable_speaker: true });
      machine.add_listener('serial0-output-byte', byte => { serial = (serial + String.fromCharCode(byte)).slice(-8192); });
      machine.add_listener('emulator-ready', () => {
        if (finished) { Promise.resolve(machine.destroy()).catch(() => {}); return; } ready = true; clearTimeout(timer);
        try { onReady?.(machine); } catch (error) { finish(error); return; }
        // Firmware and the loader have their own budget. The learner's ten
        // seconds start only when its entry marker is actually observed.
        timer = setTimeout(() => deadline('boot'), 30000);
        try { machine.run(); } catch (error) { finish(error); }
      });
      if (!finished) interval = setInterval(() => {
        if (!ready || finished) return;
        try { inspectMailbox(); } catch (error) { finish(error); }
      }, 25);
    } catch (error) { finish(error); }
  });
}
function timeoutCase(testCase, phase = 'execution') {
  return { name: testCase.name, passed: false, assertions: [phase === 'boot'
    ? assertion('Boot reached the checkpoint entry within 30 seconds', true, false, 'Firmware, the loader, or the entry stub did not reach the checkpoint. The lesson routine or C function has not been observed running. Retry the test; if this repeats, inspect the boot path and browser performance before changing the exercise algorithm.')
    : assertion('Execution completed within the time limit', true, false, 'The checkpoint entry was reached. Check for an infinite loop, a missing RET, an unbalanced stack, a CPU fault, or HLT before returning.')] };
}
function cookieValue() { const values = new Uint32Array(1); crypto.getRandomValues(values); return (values[0] | 0x10000) >>> 0; }

function kernelInstrumentedFiles(files, cookie) {
  let manifest;
  try { manifest = JSON.parse(files['build.json']); } catch { throw new Error('A C machine test requires a valid kernel32 build.json.'); }
  if (manifest.type !== 'kernel32' || !Array.isArray(manifest.sources)) throw new Error('This checkpoint requires your complete kernel32 project.');
  const wrapper = '__course_kernel_test.c';
  if (Object.hasOwn(files, wrapper)) throw new Error(`${wrapper} is reserved for the machine-test harness.`);
  const result = { ...files };
  for (const path of manifest.sources.filter(path => /\.c$/i.test(path))) result[path] = `#define kernel_main __course_student_kernel_main\n#line 1 "${path}"\n${files[path]}`;
  result[wrapper] = `typedef unsigned int u32;
extern void __course_student_kernel_main(void);
void kernel_main(void) {
    volatile u32 *proof = (volatile u32 *)${L.complete}u;
    proof[1] = ${((cookie ^ 0x13579bdf) >>> 0)}u;
    __course_student_kernel_main();
    proof[0] = ${cookie}u;
}
`;
  result['build.json'] = JSON.stringify({ ...manifest, sources: [...manifest.sources, wrapper] });
  return result;
}
function kernelState(machine) {
  // The memory API is public; these CPU fields are explicitly pinned to the
  // bundled v86 0.5.462. Fail clearly if an emulator upgrade changes the layout.
  const cpu = machine.v86?.cpu;
  if (!cpu?.cr || !cpu?.cpl || typeof cpu.get_eflags !== 'function') throw new Error('This v86 version does not expose the pinned CPU inspection interface.');
  const vga = Uint8Array.from({ length: 4000 }, (_, index) => cpu.read8(0xb8000 + index)); const rows = [];
  for (let row = 0; row < 25; row += 1) { let text = ''; for (let column = 0; column < 80; column += 1) text += String.fromCharCode(vga[(row * 80 + column) * 2] || 32); rows.push(text.trimEnd()); }
  return { protectedMode: !!(cpu.cr[0] & 1), pagingEnabled: !!(cpu.cr[0] & 0x80000000), ring: cpu.cpl[0], segments: { es: cpu.sreg[0], cs: cpu.sreg[1], ss: cpu.sreg[2], ds: cpu.sreg[3] }, esp: cpu.reg32[4] >>> 0, flags: readFlags(cpu.get_eflags()), output: rows.join('\n'), vga };
}
function evaluateKernel(machine, testCase, cookie, serial) {
  const state = kernelState(machine); const expected = testCase.expect || {};
  const marker = machine.read_memory(L.complete + 4, 4); const entered = new DataView(marker.buffer, marker.byteOffset, 4).getUint32(0, true) === ((cookie ^ 0x13579bdf) >>> 0);
  const assertions = [assertion('Learner kernel_main was called and returned', true, entered, 'Your assembly entry must call kernel_main and the C routine must return to its caller.'), assertion('CR0.PE (protected mode)', true, state.protectedMode), assertion('CPU privilege level', 0, state.ring)];
  if (expected.output !== undefined) assertions.push(assertion('Actual VGA memory text', normalize(expected.output), normalize(state.output), 'Check the VGA addresses and character bytes written by your C code.'));
  for (const [name, value] of Object.entries(expected.segments || {})) assertions.push(assertion(`${name.toUpperCase()} selector`, asHex(value), asHex(state.segments[name])));
  if (expected.stack) assertions.push(assertion('ESP is inside the reserved kernel stack', true, state.esp >= expected.stack.min && state.esp <= expected.stack.max, `Expected ESP in ${asHex(expected.stack.min)} through ${asHex(expected.stack.max)}; observed ${asHex(state.esp)}.`));
  if (expected.serial !== undefined) assertions.push(assertion('Actual COM1 serial output', normalize(expected.serial), normalize(serial), 'Initialize the UART and write the requested bytes from the running C kernel.'));
  if (expected.pagingEnabled !== undefined) assertions.push(assertion('CR0.PG (paging enabled)', expected.pagingEnabled, state.pagingEnabled));
  if (expected.interruptsEnabled !== undefined) assertions.push(assertion('Interrupt flag', expected.interruptsEnabled, state.flags.interrupt));
  if (expected.directionFlag !== undefined) assertions.push(assertion('Direction flag', expected.directionFlag, state.flags.direction));
  for (const memory of expected.memory || []) {
    if (!Number.isInteger(memory.address) || memory.address < 0 || memory.address + memory.bytes.length > 32 * 1024 * 1024 || memory.bytes.length > 512) throw new Error('Invalid kernel physical-memory assertion.');
    assertions.push(assertion(`Physical memory at ${asHex(memory.address)}`, memory.bytes, Array.from({ length: memory.bytes.length }, (_, index) => machine.v86.cpu.read8(memory.address + index))));
  }
  return { name: testCase.name, passed: assertions.every(item => item.passed), assertions };
}

function functionTestFiles(files, tests, cookie) {
  if (typeof tests.file !== 'string' || !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(tests.file) || tests.file.split('/').some(part => part === '.' || part === '..') || !files[tests.file]?.trim()) throw new Error(`Write your function implementation in ${tests.file || 'the exercise file'} before testing.`);
  // The known boot scaffold isolates a function contract from the unfinished
  // learner kernel. Only the named exercise and its included headers are used.
  const result = { ...files, ...kernelProjectFiles };
  result['tests/limits.h'] = '#ifndef COURSE_LIMITS_H\n#define COURSE_LIMITS_H\n#define CHAR_BIT 8\n#define SCHAR_MIN (-127-1)\n#define SCHAR_MAX 127\n#define UCHAR_MAX 255\n#define CHAR_MIN SCHAR_MIN\n#define CHAR_MAX SCHAR_MAX\n#define SHRT_MIN (-32767-1)\n#define SHRT_MAX 32767\n#define USHRT_MAX 65535\n#define INT_MIN (-2147483647-1)\n#define INT_MAX 2147483647\n#define UINT_MAX 4294967295U\n#define LONG_MIN INT_MIN\n#define LONG_MAX INT_MAX\n#define ULONG_MAX UINT_MAX\n#define LLONG_MIN (-9223372036854775807LL-1)\n#define LLONG_MAX 9223372036854775807LL\n#define ULLONG_MAX 18446744073709551615ULL\n#endif\n';
  result['kernel/main.c'] = `#include <stdint.h>
#include <stddef.h>
#include <stdbool.h>
static volatile uint32_t *__course_proof = (volatile uint32_t *)${L.complete}u;
static volatile uint32_t *__course_records = (volatile uint32_t *)${L.observations}u;
static void __course_record(uint32_t actual, uint32_t expected) {
    uint32_t n = __course_proof[2];
    if (n < 128u) {
        __course_records[n*4u] = __course_proof[3];
        __course_records[n*4u+1u] = actual;
        __course_records[n*4u+2u] = expected;
        __course_records[n*4u+3u] = (actual == expected);
    }
    __course_proof[2] = n + 1u;
}
#define COURSE_ASSERT_EQ(actual, expected) __course_record((uint32_t)(actual), (uint32_t)(expected))
#define COURSE_ASSERT(condition) __course_record(!!(condition), 1u)
${tests.prelude || ''}
#include "../${tests.file}"
${tests.postlude || ''}
${tests.cases.map((testCase, index) => `static void __course_case_${index}(void) {\n${testCase.body}\n}`).join('\n')}
void kernel_main(void) {
    __course_proof[0] = 0u;
    __course_proof[1] = ${((cookie ^ 0x13579bdf) >>> 0)}u;
    __course_proof[2] = 0u;
${tests.cases.map((_, index) => `    __course_proof[3] = ${index}u; __course_case_${index}();`).join('\n')}
    __course_proof[0] = ${cookie}u;
}
`;
  const manifest = JSON.parse(result['build.json']);
  result['build.json'] = JSON.stringify({ ...manifest, include: [...manifest.include, 'exercises', 'tests'] });
  return result;
}
function evaluateFunction(machine, tests) {
  const headerBytes = machine.read_memory(L.complete, 16); const header = new DataView(headerBytes.buffer, headerBytes.byteOffset, headerBytes.byteLength);
  const total = header.getUint32(8, true);
  const data = machine.read_memory(L.observations, Math.min(total, 128) * 16); const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const cases = tests.cases.map(testCase => ({ name: testCase.name, passed: true, assertions: [] }));
  for (let index = 0; index < Math.min(total, 128); index += 1) {
    const caseIndex = view.getUint32(index * 16, true);
    if (!cases[caseIndex]) throw new Error('The test program corrupted its case index.');
    cases[caseIndex].assertions.push(assertion(`Assertion ${cases[caseIndex].assertions.length + 1}`, asHex(view.getUint32(index * 16 + 8, true)), asHex(view.getUint32(index * 16 + 4, true)), tests.cases[caseIndex].hint));
  }
  for (const testCase of cases) {
    if (!testCase.assertions.length) testCase.assertions.push(assertion('At least one assertion executed', true, false));
    if (total > 128) testCase.assertions.push(assertion('Assertion record limit', 'At most 128 assertions', total));
    testCase.passed = testCase.assertions.every(item => item.passed);
  }
  return cases;
}
async function runFunctionTests(files, tests, signal, onProgress) {
  const cookie = cookieValue();
  onProgress?.({ phase: 'test', message: `Compiling ${tests.cases.length} function cases for native x86`, index: 0, total: tests.cases.length });
  try {
    const built = await buildProject(functionTestFiles(files, tests, cookie), { signal, onProgress });
    const result = await execute(built.disk, { signal, cookie, capture: machine => ({ cases: evaluateFunction(machine, tests) }), onTimeout: (machine, phase) => {
      const bytes = machine.read_memory(L.complete, 16); const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      const entered = view.getUint32(4, true) === ((cookie ^ 0x13579bdf) >>> 0);
      const active = entered ? view.getUint32(12, true) : 0;
      const partial = entered ? evaluateFunction(machine, tests) : tests.cases.map(testCase => timeoutCase(testCase, phase));
      return { cases: partial.map((testCase, index) => index < active ? testCase : index === active ? timeoutCase(tests.cases[index], phase) : { name: testCase.name, passed: false, assertions: [assertion('Case reached', true, false, phase === 'boot' ? 'The test kernel did not reach the checkpoint entry, so its learner cases have not run. Retry or investigate startup before editing the function.' : 'An earlier case did not complete; fix it, then rerun the suite.')] }) };
    } });
    if (result.timeout) return result.cases;
    return result.cases;
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    return [{ name: 'Compile and execute exercise', passed: false, assertions: [assertion('Native x86 function tests', 'Completed function assertions', error.message, 'Fix the compiler diagnostic in your exercise file. These tests use the known teaching boot scaffold.')] }];
  }
}

export async function runCheckpointTests({ files, guide, signal, onProgress }) {
  checkAbort(signal);
  const tests = guide?.step?.tests;
  if (!tests || !['routine', 'kernel', 'c-function'].includes(tests.kind) || !Array.isArray(tests.cases) || !tests.cases.length) {
    return { passed: false, kind: 'manual', summary: 'This project does not yet have an automated behavior contract.', scope: 'Record the boot observation alongside the chapter’s requested correctness evidence.', cases: [] };
  }
  if (tests.cases.length > 24) throw new Error('A checkpoint may run at most twenty-four machine-test cases.');
  const snapshot = { ...files }; const cases = [];
  await loadRuntime(signal);
  if (tests.kind === 'c-function') cases.push(...await runFunctionTests(snapshot, tests, signal, onProgress));
  for (let index = 0; tests.kind !== 'c-function' && index < tests.cases.length; index += 1) {
    checkAbort(signal);
    const testCase = tests.cases[index]; const cookie = cookieValue();
    onProgress?.({ phase: 'test', message: `Case ${index + 1}/${tests.cases.length}: ${testCase.name}`, index, total: tests.cases.length });
    try {
      let result;
      if (tests.kind === 'routine') {
        if (typeof snapshot['lesson.asm'] !== 'string') throw new Error('Create lesson.asm for this routine.');
        const addresses = caseAddresses(testCase); const disk = await compileRoutine(snapshot, testCase, addresses, cookie, signal);
        result = await execute(disk, { signal, cookie, capture: machine => evaluateRoutine(machine, testCase, addresses) });
      } else {
        const built = await buildProject(kernelInstrumentedFiles(snapshot, cookie), { signal, onProgress });
        result = await execute(built.disk, { signal, cookie, capture: (machine, serial) => evaluateKernel(machine, testCase, cookie, serial) });
      }
      cases.push(result.timeout ? timeoutCase(testCase, result.phase) : result);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      cases.push({ name: testCase.name, passed: false, assertions: [assertion('Build and execute this case', 'A completed x86 execution', error.message, 'Read the source diagnostic and fix this case before rerunning the test suite.')] });
      // Compiler/runtime setup failures affect every remaining case. Preserve
      // the diagnostic instead of downloading or compiling the same failure.
      break;
    }
  }
  checkAbort(signal);
  const passed = cases.length === tests.cases.length && cases.every(testCase => testCase.passed);
  const successful = cases.filter(testCase => testCase.passed).length;
  return { passed, kind: tests.kind, summary: `${successful}/${tests.cases.length} machine cases passed.`, scope: tests.scope || 'Tests cover the stated inputs and machine assertions. Review additional cases that your program needs to support.', cases };
}
