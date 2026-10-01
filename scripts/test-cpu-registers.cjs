// Run with Node against the bundled real v86 WASM and BIOS; no browser, native
// compiler, or network is required. Small preassembled fixtures keep this test
// independent of the course's compiler and display code.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { V86 } = require('../public/course/v86/libv86.js');
const root = path.resolve(__dirname, '..');
const assets = path.join(root, 'public/course/v86');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const machines = new Set();

async function waitFor(predicate, message) {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (predicate()) return;
    await delay(20);
  }
  throw new Error(`Timed out: ${message}`);
}

function boot(bytes) {
  const disk = new Uint8Array(16 * 1024 * 1024);
  disk.set(bytes); disk[510] = 0x55; disk[511] = 0xaa;
  const machine = new V86({
    wasm_path: path.join(assets, 'v86.wasm'), memory_size: 32 * 1024 * 1024,
    vga_memory_size: 2 * 1024 * 1024,
    bios: { url: path.join(assets, 'seabios.bin') },
    vga_bios: { url: path.join(assets, 'vgabios.bin') },
    hda: { buffer: disk.buffer }, boot_order: 0x213, autostart: true,
    disable_keyboard: true, disable_mouse: true, disable_speaker: true,
  });
  machines.add(machine);
  return machine;
}

async function destroy(machine) { await machine.destroy(); machines.delete(machine); }

(async () => {
  const source = fs.readFileSync(path.join(root, 'src/course/cpuRegisters.js'), 'utf8');
  const { readCpuRegisters } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  assert.throws(() => readCpuRegisters(null), /until the x86 machine is ready/);
  assert.throws(() => readCpuRegisters({ v86: { cpu: {} } }), /supported CPU register interface/);
  console.log('PASS unavailable CPU is reported explicitly');

  // Real mode: far JMP 07C0:0005; MOV EAX,FEDCBA98; MOV AX,8000;
  // ADD AX,8000; CLI; HLT. Partial writes retain the upper EAX word, and
  // the last ADD requires v86 to evaluate lazy CF/ZF/OF flags correctly.
  const real = boot([0xea, 0x05, 0x00, 0xc0, 0x07, 0x66, 0xb8, 0x98, 0xba, 0xdc, 0xfe,
    0xb8, 0x00, 0x80, 0x05, 0x00, 0x80, 0xfa, 0xf4]);
  await waitFor(() => real.v86?.cpu?.sreg[1] === 0x7c0 && real.v86.cpu.in_hlt[0], 'real-mode lesson halt');
  await real.stop();
  const state = readCpuRegisters(real);
  assert.equal(state.registers.eax, 0xfedc0000);
  assert.equal(state.segments.cs, 0x07c0);
  assert.equal(state.eip, 0x0013);
  assert.equal(state.linearIp, 0x7c13);
  assert.equal(state.eflags & 0x8c5, 0x845); // OF, ZF, PF, CF; no SF.
  assert.notEqual(real.v86.cpu.flags[0], state.eflags, 'fixture must exercise lazy arithmetic flags');
  assert.equal(state.protectedMode, false);
  assert.equal(state.code32, false); assert.equal(state.stack32, false);
  assert.equal(state.paging, false); assert.equal(state.virtual8086, false);
  assert.equal(state.halted, true); assert.equal(state.cpl, 0);
  assert.equal(real.is_running(), false);
  assert(Number.isFinite(state.capturedAt));
  console.log('PASS real CPU partial writes, lazy flags, CS offset, and halted snapshot');
  await destroy(real);

  // NASM fixture: CLI; set DS=0; LGDT [7C58]; set CR0.PE; far JMP 08:7C1C.
  // In 32-bit code, load flat selector 10 into DS/ES/SS, ESP=90000,
  // EBX=87654321, EAX=7FFFFFFF; ADD EAX,1; HLT. GDT at 7C40 contains
  // null, flat 32-bit code, flat 32-bit data; GDTR contains limit 23/base 7C40.
  const protectedBytes = 'fa 31 c0 8e d8 0f 01 16 58 7c 0f 20 c0 66 83 c8 01 0f 22 c0 66 ea 1c 7c 00 00 08 00 66 b8 10 00 8e d8 8e c0 8e d0 bc 00 00 09 00 bb 21 43 65 87 b8 ff ff ff 7f 83 c0 01 f4 eb fe 90 90 90 90 90 00 00 00 00 00 00 00 00 ff ff 00 00 00 9a cf 00 ff ff 00 00 00 92 cf 00 17 00 40 7c 00 00';
  const protectedMachine = boot(protectedBytes.split(' ').map(byte => parseInt(byte, 16)));
  await waitFor(() => protectedMachine.v86?.cpu?.is_32[0] && protectedMachine.v86.cpu.in_hlt[0]
    && (protectedMachine.v86.cpu.reg32[3] >>> 0) === 0x87654321, 'protected-mode kernel halt');
  await protectedMachine.stop();
  const kernel = readCpuRegisters(protectedMachine);
  assert.equal(kernel.registers.eax, 0x80000000);
  assert.equal(kernel.registers.ebx, 0x87654321);
  assert.equal(kernel.registers.esp, 0x90000);
  assert.equal(kernel.segments.cs, 8); assert.equal(kernel.segments.ss, 16);
  assert.equal(kernel.segments.ds, 16); assert.equal(kernel.segments.es, 16);
  assert.equal(kernel.protectedMode, true); assert.equal(kernel.code32, true);
  assert.equal(kernel.stack32, true); assert.equal(kernel.paging, false);
  assert.equal(kernel.eflags & 0x8c1, 0x880); // Signed overflow and negative, no carry/zero.
  assert.equal(kernel.eip, kernel.linearIp);
  console.log('PASS protected-mode values, unsigned EAX/EBX, selectors, and 32-bit stack');
  await destroy(protectedMachine);

  // Real-mode busy loop: CLI; MOV EAX,12345678; XOR ECX,ECX;
  // INC ECX; JMP back. Pausing must freeze the CPU; resuming must continue it.
  const busy = boot([0xfa, 0x66, 0xb8, 0x78, 0x56, 0x34, 0x12, 0x66, 0x31, 0xc9,
    0x66, 0x41, 0xeb, 0xfc]);
  await waitFor(() => (busy.v86?.cpu?.reg32[0] >>> 0) === 0x12345678 && busy.v86.cpu.reg32[1] > 100, 'running counter');
  await busy.stop();
  const paused = readCpuRegisters(busy);
  assert.equal(paused.halted, false, 'user pause is not a CPU HLT');
  assert.equal(busy.is_running(), false);
  await delay(50);
  assert.equal(readCpuRegisters(busy).registers.ecx, paused.registers.ecx);
  await busy.run();
  await waitFor(() => busy.is_running() && (busy.v86.cpu.reg32[1] >>> 0) !== paused.registers.ecx, 'resumed counter advances');
  await busy.stop();
  const resumed = readCpuRegisters(busy);
  assert.notEqual(resumed.registers.ecx, paused.registers.ecx);
  assert.equal(paused.registers.eax, 0x12345678, 'old snapshot owns its values');
  assert.equal(paused.registers.ecx, paused.registers.ecx >>> 0);
  console.log('PASS pause freezes state, resume continues execution, snapshots own copied values');
  await destroy(busy);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await Promise.all([...machines].map(machine => destroy(machine).catch(() => {})));
});

// A stuck firmware/emulator must not leave the test command running forever.
const deadline = setTimeout(() => { console.error('CPU register test exceeded 75 seconds'); process.exit(1); }, 75000);
deadline.unref();
