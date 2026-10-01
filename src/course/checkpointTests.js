// Public, deterministic machine contracts. The grader executes every case on the
// x86 emulator; these are behavior tests, not source-text or opcode matching.
// Inputs are installed immediately before CALL lesson. All routines must return
// with their stack balanced and leave the grader's memory guards intact.
const hex = n => (n & 0xffff).toString(16).toUpperCase().padStart(4, '0');
const word = n => [n & 255, (n >>> 8) & 255];
const words = ns => ns.flatMap(word);
const textBytes = s => [...s].map(c => c.charCodeAt(0)).concat(0);
const signed = n => (n & 0x8000) ? (n & 0xffff) - 65536 : n & 0xffff;
const addFlags = (a, b) => {
  const result = (a + b) & 0xffff;
  return { carry: a + b > 65535, overflow: ((~(a ^ b) & (a ^ result)) & 0x8000) !== 0, zero: result === 0, sign: !!(result & 0x8000) };
};
const observed = (helper, registers, flags) => ({ helper, ...(registers ? { registers } : {}), ...(flags ? { flags } : {}) });
const printed = (...values) => values.map(ax => observed('print_hex16', { ax }));
const sample = (name, input, expect, hint) => ({ name, input, expect, ...(hint ? { hint } : {}) });
const routine = (contract, cases, scope = 'Checks the declared inputs, actual output, specified CPU state, return path, stack balance, and memory guards. Other implementation choices remain yours.') => ({ kind: 'routine', contract, scope, cases });
const scalar = (name, output, registers, observations) => sample(name, {}, { output, registers, ...(observations ? { observations } : {}) });

export const assemblyCheckpointTests = {
  'assembly-first-instructions': [
    routine('No supplied value is required. Load the character yourself; return with AL holding H.', [scalar('One character', 'H', { al: 72 }, [observed('putc', { al: 72 })])], 'A first-instruction contract: verifies the actual character, AL, a printing call, and safe return. It does not claim to assess a general algorithm.'),
    routine('Load H and I yourself. The helpers preserve registers. Finish with AL holding I.', [scalar('Two characters', 'HI', { al: 73 }, [observed('putc', { al: 72 }), observed('putc', { al: 73 }), observed('newline')])]),
    routine('Load O and K yourself. Finish with AL holding K.', [scalar('Revised characters', 'OK', { al: 75 }, [observed('putc', { al: 79 }), observed('putc', { al: 75 }), observed('newline')])]),
  ],
  'assembly-numbers': [
    routine('Load each literal yourself and pass its stored pattern in AX to print_hex16.', [scalar('Decimal representation', '002A', { ax: 42 }, printed(42))]),
    routine('Print 42, then the sixteen-bit pattern of -1. Leave the final pattern in AX.', [scalar('Two interpretations', '002A\nFFFF', { ax: 65535 }, [observed('print_hex16', { ax: 42 }), observed('newline'), observed('print_hex16', { ax: 65535 })])]),
    routine('Print the three patterns in order. Leave -128 represented in AX.', [scalar('Three-value ledger', '0041\nFFFF\nFF80', { ax: 65408 }, [observed('print_hex16', { ax: 65 }), observed('newline'), observed('print_hex16', { ax: 65535 }), observed('newline'), observed('print_hex16', { ax: 65408 }), observed('newline')])]),
  ],
  'assembly-registers': [
    routine('Input: AX is supplied by the harness. Change only AL to 0xEF. Print and return the resulting word; preserve AH.', [0x5678, 0xab01, 0].map((ax, i) => sample(['Sample word', 'Different high byte', 'Zero high byte'][i], { registers: { ax } }, { output: hex((ax & 0xff00) | 0xef), registers: { ax: (ax & 0xff00) | 0xef } }, 'A byte write must retain the supplied high byte. Do not reload the sample AX value.'))),
    routine('Input: EAX is supplied. Replace AX with 0xBEEF, print it, then shift EAX right by 16 and print the preserved upper word. Return the shifted EAX.', [0x12345678, 0x89abcdef, 0xffff0000].map((eax, i) => sample(['Sample wide value', 'Different upper half', 'All upper bits set'][i], { registers: { eax } }, { output: `BEEF\n${hex(eax >>> 16)}`, registers: { eax: eax >>> 16 } }, 'An AX write preserves EAX bits 31:16; an EAX write replaces them.'))),
    routine('Input: EAX is supplied as before. Preserve the first two observations, then construct 0x3412 with separate AH and AL writes. Return AX=0x3412.', [0x12345678, 0x89abcdef].map((eax, i) => sample(i ? 'Different upper half' : 'Sample wide value', { registers: { eax } }, { output: `BEEF\n${hex(eax >>> 16)}\n3412`, registers: { eax: 0x3412, ah: 0x34, al: 0x12 } }))),
  ],
  'assembly-arithmetic': [
    routine('Input: AX is the supplied sixteen-bit value. Add one, print and return AX. Preserve the resulting ADD flags through the end of the routine. The helpers preserve FLAGS.', [41, 65535, 32767, 0].map(ax => sample(`Increment ${hex(ax)}`, { registers: { ax } }, { output: hex(ax + 1), registers: { ax: (ax + 1) & 65535 }, flags: addFlags(ax, 1) }, 'Compute from the supplied input. CF is unsigned carry; OF reports signed overflow.'))),
    routine('Input: AX is supplied. Add one, capture CF in BL, print the sum then the captured carry. Return AX=BL=the captured carry while retaining the ADD flags.', [65535, 32767, 41].map(ax => {
      const flags = addFlags(ax, 1), carry = Number(flags.carry);
      return sample(`Capture carry from ${hex(ax)}`, { registers: { ax } }, { output: `${hex(ax + 1)}\n${hex(carry)}`, registers: { ax: carry, bl: carry }, flags }, 'Capture carry from the operation before changing flags; do not assume every test overflows.');
    })),
    routine('Input: DX:AX is a supplied two-word unsigned value. Increment it, keep the low result in BX, and return DX:AX as the new pair. Print high then low. Preserve the ADC flags.', [[1, 65535], [65535, 65535], [32767, 65535], [0x1234, 1]].map(([dx, ax]) => {
      const low = (ax + 1) & 65535, carry = ax === 65535 ? 1 : 0, high = (dx + carry) & 65535;
      return sample(`Increment ${hex(dx)}:${hex(ax)}`, { registers: { dx, ax } }, { output: `${hex(high)}\n${hex(low)}`, registers: { dx: high, ax: low, bx: low }, flags: addFlags(dx, carry) }, 'Only an unsigned carry from the low word increments the high word. Keep that carry until ADC consumes it.');
    })),
  ],
  'assembly-memory': [
    routine('Declare packet as two bytes in data.inc. Tests replace those bytes before entry. Read the first byte, return AX with a zero high byte, and do not alter packet.', [[0xef, 0xbe], [0x12, 0x34], [0, 0xff]].map(bytes => sample(`Packet ${bytes.map(b => b.toString(16)).join(' ')}`, { memory: [{ address: 'packet', bytes }] }, { output: hex(bytes[0]), registers: { ax: bytes[0] }, memory: [{ address: 'packet', bytes }] }, 'Read the byte at packet; loading a fixed sample or the label address will fail other inputs.'))),
    routine('Declare packet as two bytes. Tests replace them. Read its low and high bytes into AX, print the word, and leave packet unchanged.', [[0xef, 0xbe], [0x12, 0x34], [0xff, 0]].map(bytes => sample(`Reconstruct ${hex(bytes[0] | (bytes[1] << 8))}`, { memory: [{ address: 'packet', bytes }] }, { output: hex(bytes[0] | (bytes[1] << 8)), registers: { ax: bytes[0] | (bytes[1] << 8) }, memory: [{ address: 'packet', bytes }] }))),
    routine('Declare packet (two bytes) and copy (one word). Tests set packet and prefill copy with unrelated bytes. Copy the word, clear AX, reload it, and return AX. Packet must remain unchanged.', [[0xef, 0xbe], [0x12, 0x34], [0, 0xff]].map(bytes => sample(`Store and recover ${hex(bytes[0] | (bytes[1] << 8))}`, { memory: [{ address: 'packet', bytes }, { address: 'copy', bytes: [0xa5, 0x5a] }] }, { output: hex(bytes[0] | (bytes[1] << 8)), registers: { ax: bytes[0] | (bytes[1] << 8) }, memory: [{ address: 'packet', bytes }, { address: 'copy', bytes }] }, 'The copy must actually reach memory; correct screen text alone is insufficient.'))),
  ],
  'assembly-addressing': [0, 1, 2].map(index => routine(`Declare values as three words. Tests replace all three. Read element index ${index}, print and return it in AX; leave the array unchanged. Derive the byte offset from the word size.`, [[0x1111, 0x2222, 0x3333], [0xabcd, 0x0012, 0xef01], [0, 0xffff, 0x8000]].map(values => sample(`Select word ${index} from ${values.map(hex).join(', ')}`, { memory: [{ address: 'values', bytes: words(values) }] }, { output: hex(values[index]), registers: { ax: values[index] }, memory: [{ address: 'values', bytes: words(values) }] }, 'Array indices count elements, but the effective address counts bytes.')), index === 2 ? 'Checks the loaded word and unchanged array across varied data, safe return, and stack guards. DS and SS are both zero here; the explicit segment override is a reasoning task, not independently proved by these runs.' : undefined)),
  'assembly-branches': [
    routine('Input: AX is supplied. Compare with 1 and print E for equality, N otherwise. Both paths are tested; do not replace AX with the sample.', [1, 0, 2, 0xffff].map(ax => sample(`Compare ${hex(ax)} with 1`, { registers: { ax } }, { output: ax === 1 ? 'E' : 'N', registers: { al: (ax === 1 ? 'E' : 'N').charCodeAt(0) } }, 'A matching sample does not prove the other path. Test the supplied AX before selecting the character.'))),
    routine('Input: AX is a supplied signed sixteen-bit value. Print L when it is less than 1, O otherwise.', [0xffff, 1, 0x8000, 0x7fff, 0].map(ax => sample(`Signed comparison: ${signed(ax)}`, { registers: { ax } }, { output: signed(ax) < 1 ? 'L' : 'O', registers: { al: (signed(ax) < 1 ? 'L' : 'O').charCodeAt(0) } }, 'Use a signed condition that accounts for SF and OF. Unsigned below is a different relation.'))),
    routine('Input: AX is a supplied signed word. Select LESS or OTHER using a comparison with 1. Print via puts and preserve the input AX; the helper preserves it.', [0xffff, 1, 0x8000, 0x7fff, 0].map(ax => sample(`Signed string selection: ${signed(ax)}`, { registers: { ax } }, { output: signed(ax) < 1 ? 'LESS' : 'OTHER', registers: { ax } }, 'Choose from both string addresses using the supplied signed input.'))),
  ],
  'assembly-loops': [
    routine('Input: CX is the supplied repetition count. Print A exactly CX times and return CX=0. Zero is a valid input and must print nothing.', [3, 0, 1, 5].map(cx => sample(`Repeat ${cx} times`, { registers: { cx } }, { output: 'A'.repeat(cx), registers: { cx: 0 } }, 'Check the count before entering the body. Zero must return without printing.'))),
    ...[0, 1].map(stage => routine('Declare values as four words. Input: CX is the supplied count (0 through 4); tests replace the array. Sum exactly that many words modulo 65536, print and return AX, and finish with CX=0. Leave values unchanged.', [
      { values: stage ? [2, 4, 6, 8] : [1, 2, 3, 4], cx: 4 },
      { values: [9, 10, 11, 12], cx: 0 },
      { values: [0x1234, 0x5678, 0x9abc, 0xdef0], cx: 1 },
      { values: [65535, 2, 32768, 32768], cx: 4 },
      { values: [7, 9, 1000, 2000], cx: 2 },
    ].map(({ values, cx }) => {
      const sum = values.slice(0, cx).reduce((a, b) => a + b, 0) & 65535;
      return sample(`Sum ${cx} supplied words`, { registers: { cx }, memory: [{ address: 'values', bytes: words(values) }] }, { output: hex(sum), registers: { ax: sum, cx: 0 }, memory: [{ address: 'values', bytes: words(values) }] }, 'Honor the supplied count, advance by two bytes per word, and handle zero before dereferencing.');
    }))),
  ],
  'assembly-stack': [
    routine('Input: AX is supplied. Push it, clear AX, then pop it back. Print and return the original AX with the entry stack depth restored.', [0x1122, 0xa55a, 0].map(ax => sample(`Recover ${hex(ax)}`, { registers: { ax } }, { output: hex(ax), registers: { ax } }, 'Recover the caller-provided word; a hardcoded replacement is not a stack round trip.'))),
    ...[false, true].map(inOrder => routine(`Inputs: AX is the first word and BX the second. Push AX then BX. Pop into ${inOrder ? 'BX then AX' : 'AX then BX'} and print ${inOrder ? 'first then second' : 'second then first'}. Return AX and BX both containing the last printed word. Balance every push.`, [[0x1122, 0x3344], [0xabcd, 0x5a5a], [0, 0xffff]].map(([ax, bx]) => {
      const first = inOrder ? ax : bx, last = inOrder ? bx : ax;
      return sample(`Stack words ${hex(ax)}, ${hex(bx)}`, { registers: { ax, bx } }, { output: `${hex(first)} ${hex(last)}`, registers: { ax: last, bx: last } }, 'Stack order and stack balance are separate obligations. Keep the wrapper return address untouched.');
    }))),
  ],
  'assembly-calls': [
    routine('Inputs: AX and BX are supplied words. Call your local .sum routine, which returns their sum in AX. Print and return that value. BX must remain unchanged; the stack must balance.', [[3, 4], [0, 0], [65535, 1], [0x1234, 0x4321]].map(([ax, bx]) => sample(`Register arguments ${ax} + ${bx}`, { registers: { ax, bx } }, { output: hex(ax + bx), registers: { ax: (ax + bx) & 65535, bx } }, 'Compute from both supplied arguments and preserve the caller-owned register.'))),
    routine('Inputs: AX is the first argument, DX the second. Push DX then AX, call your BP-framed routine, and let the caller release four argument bytes. Print and return the sum in AX; restore BP.', [[6, 7], [0, 0], [65535, 1], [0x1234, 0x4321]].map(([ax, dx]) => sample(`Stack arguments ${ax} + ${dx}`, { registers: { ax, dx, bp: 0x3456 } }, { output: hex(ax + dx), registers: { ax: (ax + dx) & 65535, bp: 0x3456 } }, 'Read the pushed arguments using the frame offsets and restore BP. Cleanup belongs to exactly one caller/callee.'))),
    routine('Inputs: AX and DX are the arguments, BX is a supplied preservation sentinel. Push DX then AX. Your callee may use BX but must restore it. Print the sum followed by BX, then return AX=BX=the original sentinel and restore BP.', [[6, 7, 0xbeef], [65535, 1, 0xa55a], [20, 22, 0x1234]].map(([ax, dx, bx]) => sample(`Preserve ${hex(bx)} while adding ${ax} + ${dx}`, { registers: { ax, dx, bx, bp: 0x3456 } }, { output: `${hex(ax + dx)} ${hex(bx)}`, registers: { ax: bx, bx, bp: 0x3456 } }, 'Save the actual incoming BX; restoring a fixed BEEF constant fails other callers.'))),
  ],
  'assembly-bits': [
    routine('Input: AX is supplied. Mask it to its lowest four bits, print and return AX. AND clears CF and OF; preserve its result flags.', [0xa5, 0xfff0, 0x123e, 0xffff].map(ax => sample(`Mask ${hex(ax)}`, { registers: { ax } }, { output: hex(ax & 15), registers: { ax: ax & 15 }, flags: { carry: false, overflow: false, zero: (ax & 15) === 0, sign: false } }, 'Apply the mask to the supplied word, not only the sample literal.'))),
    routine('Inputs: AX contains the field source; DX contains a signed sixteen-bit value. Print source bits 7..4, then SAR DX’s value by one through AX and print it. Return the shifted AX and preserve DX.', [[0x1d3, -9], [0xab20, 9], [0x8000, -32768], [0xffff, -1]].map(([ax, value]) => {
      const dx = value & 65535, result = (value >> 1) & 65535;
      return sample(`Field ${hex(ax)}, signed shift ${value}`, { registers: { ax, dx } }, { output: `${hex((ax >>> 4) & 15)} ${hex(result)}`, registers: { ax: result, dx }, flags: { carry: !!(dx & 1), overflow: false, zero: result === 0, sign: !!(result & 0x8000) } }, 'SAR preserves the sign and exposes the discarded low bit in CF.');
    })),
    routine('Inputs: AX=field source, DX=signed-shift input, SI=unsigned dividend, BX=nonzero divisor. Print field, signed shift, quotient, remainder. Build DX:AX with a zero high word before DIV. Return AX=DX=remainder and preserve BX.', [[0x1d3, -9, 1000, 64], [0xab20, 9, 0, 7], [0xffff, -1, 65535, 255], [0x8a70, -32768, 17, 32]].map(([ax, value, si, bx]) => {
      const quotient = Math.floor(si / bx), remainder = si % bx;
      return sample(`Divide ${si} by ${bx}`, { registers: { ax, dx: value & 65535, si, bx } }, { output: `${hex((ax >>> 4) & 15)} ${hex(value >> 1)} ${hex(quotient)} ${hex(remainder)}`, registers: { ax: remainder, dx: remainder, bx } }, 'DIV consumes the entire DX:AX numerator. Its flags are undefined and are deliberately not graded.');
    })),
  ],
  'assembly-debugging': [
    routine('Load and print O through the supplied helper; return AL=O.', [scalar('Helper baseline', 'O', { al: 79 }, [observed('putc', { al: 79 })])]),
    routine('Issue two BIOS teletype calls for O and S, then return with a balanced stack. BIOS output registers are not part of the contract.', [sample('Direct BIOS output', {}, { output: 'OS' })], 'Checks real firmware output, return path, stack balance, and memory guards. It intentionally does not assume undocumented BIOS register preservation.'),
    routine('Declare message as a zero-terminated buffer with room for at least 9 bytes. Tests replace its contents, including the empty string. Start SI at message, walk forward, stop at the first zero, and leave the bytes unchanged.', ['OS READY', '', 'X86'].map(message => {
      const bytes = [...textBytes(message), ...Array(8 - message.length).fill(0)];
      return sample(message ? `Print ${message}` : 'Empty string', { memory: [{ address: 'message', bytes }] }, { output: message, memory: [{ address: 'message', bytes }] }, 'The terminator must be checked before printing. Use the supplied bytes rather than a fixed output string.');
    })),
  ],
};

// Only these already-implemented first-kernel invariants are automatically
// graded. Later OS chapters need their own explicit ABI and test fixtures.
export const kernelCheckpointTests = {
  kind: 'kernel',
  scope: 'Checks actual execution and return of the C entry, protected-mode CPU state, VGA text, and serial output. This first-kernel contract does not prove every BSS byte or a general allocator, scheduler, or filesystem.',
  contract: 'Boot your own disk and call kernel_main with a valid C stack. Enter protected mode with CR0.PE=1, paging disabled, flat CS=0x08 and DS=SS=0x10, IF=0, and DF=0. Write the three expected VGA lines and the first line to COM1, then return to the entry stub. Tests instrument a separate build to record that C entry and return really happened.',
  cases: [{
    name: 'Real C entry, output, and safe return',
    input: {},
    expect: {
      output: 'C KERNEL READY\n32-bit C running without an OS.\nTwo C files, one header, one linked kernel.',
      protectedMode: true,
      pagingEnabled: false,
      interruptsEnabled: false,
      directionFlag: false,
      segments: { cs: 0x08, ds: 0x10, ss: 0x10 },
      stack: { min: 0x60000, max: 0x70000 },
      serial: 'C KERNEL READY',
    },
    hint: 'A correct screen alone is insufficient: the boot path must establish the C machine contract, call the learner kernel, and return safely.',
  }],
};
