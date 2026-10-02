import { outputCheckpointTests } from './outputCheckpointTests';

const putc = `putc:
    pushfd
    pushad
    push ds
    push es
    cld
    mov ah, 0x0e
    mov bx, 0x0007
    int 0x10
    pop es
    pop ds
    popad
    popfd
    ret
`;
const newline = `newline:
    pushfd
    pushad
    mov al, 13
    call putc
    mov al, 10
    call putc
    popad
    popfd
    ret
`;
const puts = `puts:
    pushfd
    pushad
    cld
.next:
    lodsb
    test al, al
    jz .done
    call putc
    jmp .next
.done:
    popad
    popfd
    ret
`;
const hex = `print_hex16:
    pushfd
    pushad
    mov dx, ax
    mov cx, 4
.digit:
    rol dx, 4
    mov al, dl
    and al, 0x0f
    add al, '0'
    cmp al, '9'
    jbe .emit
    add al, 7
.emit:
    call putc
    loop .digit
    popad
    popfd
    ret
`;
const data = 'message: times 64 db 0\n';
const implementations = [putc, putc + '\n' + newline, putc + '\n' + newline + '\n' + puts, putc + '\n' + newline + '\n' + puts + '\n' + hex];
function step(index, sectionId, title, instructions, expectedOutput, hints, prompt, answer, explanation, body) {
  const tests = outputCheckpointTests[index];
  return { sectionId, title, instructions: `${instructions} Machine contract: ${tests.contract}`, expectedOutput, hints,
    prediction: { prompt, answer, explanation }, tests, filesToCreate: ['console.asm', 'lesson.asm', 'data.inc'],
    reference: { body, data, files: { 'console.asm': implementations[index] } },
  };
}

export const guidedOutput = {
  file: 'console.asm', learnerHelpers: true,
  intro: 'Build your own output library in console.asm, keeping each completed function as you add the next. lesson.asm is your caller for Run. Submit calls the checkpoint function directly with varied inputs. The lab supplies machine startup and a stack; you implement every printing function in this chapter.',
  initialFiles: {
    'console.asm': '; Implement putc here, then add newline, puts and print_hex16.\nputc:\n    ; Save state, invoke BIOS teletype, restore state.\n    ret\n',
    'lesson.asm': '; Run uses the sample input shown in the current checkpoint.\n; Change this caller to try the function you are building.\n    call putc\n',
    'data.inc': data,
    'build.json': '{"type":"assembly-routine","learnerHelpers":true}',
  },
  steps: [
    step(0, 'putc-checkpoint', 'Build putc around BIOS teletype',
      'Implement putc in console.asm. Read the character from AL, preserve the caller state, select BIOS teletype and page zero, and return after displaying the character. Use lesson.asm to call putc with different characters during Run.', 'A',
      ['Save FLAGS before clearing DF or changing any flags.', 'PUSHAD saves all eight 32-bit general registers; save DS and ES separately.', 'Set AH to 0x0E and BX to 0x0007, issue INT 0x10, then restore saved state in reverse order.'],
      'How many bytes do PUSHFD, PUSHAD, PUSH DS and PUSH ES save altogether in this 16-bit routine?', 40,
      'PUSHFD saves four bytes, PUSHAD saves 32, and each segment push saves two. The near CALL return offset occupies two additional bytes.', '    call putc'),
    step(1, 'newline-checkpoint', 'Build newline from two character calls',
      'Keep putc and add newline to console.asm. Emit carriage return and line feed in that order while preserving every input register and FLAGS. Change lesson.asm to call newline. During Run, try a caller that prints a character before and after it; Submit checks actual cursor coordinates, including the last row.', '',
      ['Carriage return is decimal 13; line feed is decimal 10.', 'Save the original AX before putting either control byte in AL.', 'The cursor must end at column zero. At row 24, the BIOS scrolls and keeps the cursor at row 24.'],
      'After CR followed by LF from row 3, column 17, which row contains the cursor?', 4,
      'CR sets column zero; LF advances the row to four. The pair leaves the cursor at row four, column zero.', '    call newline'),
    step(2, 'puts-checkpoint', 'Build a preserving string-output loop',
      'Keep your earlier helpers and add puts to console.asm. Read the zero-terminated string at DS:SI, check each byte before printing, and preserve the original pointer and FLAGS. Keep a 64-byte message buffer in data.inc. Change lesson.asm to call puts; the sample supplies SI=message, a preservation sentinel in the upper half of ESI, and HELLO in that buffer.', 'HELLO',
      ['Save the original FLAGS before CLD, so callers with DF set get it back.', 'LODSB advances SI after reading a byte. Test AL for zero before calling putc.', 'Restore the saved registers and FLAGS on the empty-string path as well as after a long string.'],
      'How many LODSB executions are needed for HELLO followed by its zero terminator?', 6,
      'The loop reads five printable bytes and a sixth byte containing zero. The terminator ends the loop before another putc call.', '    call puts'),
    step(3, 'hex-checkpoint', 'Build four-digit hexadecimal formatting',
      'Keep all three earlier helpers and implement print_hex16 in console.asm. Print exactly four uppercase digits derived from AX, preserving the supplied word and all caller state. Change lesson.asm to call print_hex16. Test zero, a value below 16, a mixed-digit word, and FFFF.', '0000',
      ['Copy AX into a working register before using AL for characters.', 'Rotate a 16-bit copy left four bits, mask the low nibble, and convert it to ASCII.', 'Digits 0 through 9 add 48; values 10 through 15 add 55. Repeat four times even when the leading nibble is zero.'],
      'What decimal value must be added to nibble value 10 to produce ASCII A (65)?', 55,
      '65 minus 10 is 55. One implementation first adds 48, then adds seven when the result is above ASCII 9.', '    call print_hex16'),
  ],
};
