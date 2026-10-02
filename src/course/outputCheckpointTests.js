// Each case calls the learner's named function directly. Screen bytes and BIOS
// cursor coordinates keep spaces, leading zeroes and CR/LF behavior observable.
const sentinels = { eax: 0xa1b2cc41, ebx: 0xb2c31234, ecx: 0xc3d45678, edx: 0xd4e59abc, esi: 0x10203040, edi: 0x50607080, ebp: 0x11223344 };
const flags = index => ({ carry: !!(index & 1), parity: !(index & 1), auxiliary: !!(index & 1), zero: !(index & 1), sign: !!(index & 1), interrupt: false, direction: !!(index & 1), overflow: !!(index & 1) });
const textMemory = (text, offset = 0) => [...text].map((char, i) => ({ address: 0xb8000 + offset + i * 2, bytes: [char.charCodeAt(0)] }));
const cursor = (column, row) => ({ address: 0x450, bytes: [column, row] });
function sample(name, index, registers, output, { memory = [], expectedMemory = [], segments = index === 0 ? { ds: 0, es: 0 } : { ds: 0x1200, es: 0x2300 }, row = 0, column = output.length } = {}) {
  const values = { ...sentinels, ...registers };
  return { name, input: { registers: values, flags: flags(index), segments, memory }, expect: {
    registers: { ...values, esp: 0x7c00 }, flags: flags(index), segments, output,
    memory: [...textMemory(output), cursor(column, row), ...expectedMemory],
  } };
}
const contract = 'Preserve EAX, EBX, ECX, EDX, ESI, EDI, EBP, DS, ES and the supplied FLAGS, including DF. Return with a balanced stack. Startup establishes 16-bit real mode on a 386-or-newer CPU and active text page zero in mode 3. Submit invokes your named function in console.asm directly; the lab supplies no printing functions.';
const routine = (entry, detail, cases) => ({ kind: 'routine', learnerHelpers: true, entry,
  contract: `${detail} ${contract}`,
  scope: 'Runs your helper on native x86 in the emulator with varied inputs. Checks actual VGA characters, cursor coordinates, registers, flags, segments, return and memory guards. The cases cover this documented real-mode interface; Unicode, graphics modes and invalid pointers are outside its contract.', cases });

export const outputCheckpointTests = [
  routine('putc', 'Input AL is one printable ASCII character. Emit it at the current cursor through BIOS teletype; configure AH=0x0E and BX=0x0007 inside your helper.',
    ['A', 'z', '0', ' ', '?'].map((char, index) => sample(`Character ${char === ' ' ? 'space' : char}`, index, { eax: 0xa1b2cc00 + char.charCodeAt(0) }, char))),
  routine('newline', 'Move the cursor to column zero on the following row by emitting CR (13) then LF (10). At the last screen row, scroll once and remain on row 24.',
    [[5, 0], [0, 3], [79, 23], [17, 24]].map(([column, row], index) => sample(`Cursor (${row}, ${column})`, index, {}, '', {
      memory: [cursor(column, row)], row: Math.min(24, row + 1), column: 0,
    }))),
  routine('puts', 'Input DS:SI addresses a zero-terminated string in message (reserve 64 bytes in data.inc). Emit bytes before the first zero; an empty string emits nothing. Traverse forward even when entry DF=1, then restore DF and SI. Inputs fit within the segment.',
    ['HELLO', '', 'X', 'A  B', 'ZERO\0HIDDEN', 'A longer string: 0123456789'].map((text, index) => {
      const bytes = [...text].map(char => char.charCodeAt(0)).concat(0);
      const output = text.split('\0')[0];
      return sample(index === 1 ? 'Empty string with DF set' : `String ${JSON.stringify(text)}`, index, { esi: 'message + 0x12340000' }, output, {
        memory: [{ address: 'message', bytes }], expectedMemory: [{ address: 'message', bytes }], segments: { ds: 0, es: 0x2300 },
      });
    })),
  routine('print_hex16', 'Input AX is an unsigned word. Emit exactly four uppercase hexadecimal digits, including leading zeroes. Work from the supplied AX and keep the original word available while extracting each nibble.',
    [0, 9, 10, 15, 16, 0x0abc, 0x1234, 0xffff].map((value, index) => sample(`Word 0x${value.toString(16).toUpperCase().padStart(4, '0')}`, index, { eax: 0xa1b20000 + value }, value.toString(16).toUpperCase().padStart(4, '0')))),
];
