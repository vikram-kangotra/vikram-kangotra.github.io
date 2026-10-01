// This adapter intentionally targets the bundled v86 0.5.462 CPU interface.
// Keep its real-machine tests alongside an emulator upgrade: these fields are
// not part of v86's stable public starter API.
const generalRegisters = ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi'];
const segmentRegisters = ['es', 'cs', 'ss', 'ds', 'fs', 'gs'];
const requiredViews = {
  reg32: 8, sreg: 6, instruction_pointer: 1, cr: 1,
  is_32: 1, stack_size_32: 1, in_hlt: 1, cpl: 1,
};

export function readCpuRegisters(machine) {
  const cpu = machine?.v86?.cpu;
  if (!cpu) throw new Error('CPU registers are unavailable until the x86 machine is ready.');
  if (typeof cpu.get_real_eip !== 'function' || typeof cpu.get_eflags !== 'function'
    || Object.entries(requiredViews).some(([name, length]) => !cpu[name] || cpu[name].length < length
      || Array.from({ length }, (_, index) => cpu[name][index]).some(value => !Number.isInteger(value)))) {
    throw new Error('This emulator does not expose the supported CPU register interface.');
  }

  // Arithmetic flags are evaluated lazily. Reading cpu.flags directly would
  // display old CF/ZF/OF values after instructions such as ADD and CMP.
  const eflags = cpu.get_eflags() >>> 0;
  return {
    registers: Object.fromEntries(generalRegisters.map((name, index) => [name, cpu.reg32[index] >>> 0])),
    segments: Object.fromEntries(segmentRegisters.map((name, index) => [name, cpu.sreg[index] & 0xffff])),
    // v86's instruction_pointer includes the cached CS base. Architectural
    // EIP is the offset within CS, including when its base is nonzero.
    eip: cpu.get_real_eip() >>> 0,
    linearIp: cpu.instruction_pointer[0] >>> 0,
    eflags,
    protectedMode: !!(cpu.cr[0] & 1),
    code32: !!cpu.is_32[0],
    stack32: !!cpu.stack_size_32[0],
    paging: !!(cpu.cr[0] & 0x80000000),
    halted: !!cpu.in_hlt[0],
    cpl: cpu.cpl[0],
    virtual8086: !!(eflags & 0x20000),
    capturedAt: Date.now(),
  };
}
