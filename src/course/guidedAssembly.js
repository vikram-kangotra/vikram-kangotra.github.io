import { guidedOutput } from './guidedOutput';
import { assemblyCheckpointTests } from './checkpointTests';

// Progressive checkpoints. References are available on request;
// they are never the starting draft. Each reference is a lesson body, not a bootloader.
// Data declarations belong in the companion data.inc file and follow the hidden scaffold.
const initial = '; Write your lesson instructions here.\n';
const checkpoint = (sectionId, title, instructions, expectedOutput, hints, prompt, answer, explanation, body, data) => ({
  sectionId, title, instructions, expectedOutput, hints,
  prediction: { prompt, answer, explanation },
  reference: { body, ...(data ? { data } : {}) },
});
const chapter = (intro, steps) => ({
  file: 'lesson.asm', intro, initial,
  initialFiles: { 'lesson.asm': initial, ...(steps.some((step) => step.reference.data) ? { 'data.inc': '' } : {}) },
  steps,
});

export const guidedAssemblyBySlug = {
  'assembly-output': guidedOutput,
  'assembly-first-instructions': chapter(
    'Start with an empty lesson.asm. You will make one character visible, add a second character, then revise the same two-character program. The hidden scaffold supplies putc, which reads AL, and newline; you only write the instructions you have reached in the reading.', [
      checkpoint('why-printing-is-explicit', 'Make one character visible',
        'Write a move that puts the character H in AL, then call putc once. Before running, explain why the move alone would leave the display unchanged. Keep these two instructions for the next checkpoint.', 'H',
        ['MOV names its destination first.', 'Use a quoted character as the value copied into AL.', 'The output helper is invoked with CALL putc; it reads the current AL.'],
        'What is the decimal ASCII value in AL after loading the character H?', 72,
        'ASCII H is hexadecimal 48, which is decimal 72. Printing is a separate operation from storing that value in AL.',
        `    mov al, 'H'
    call putc`),
      checkpoint('build-your-first-program', 'Extend the same program to two characters',
        'Keep the H you already print. Add a second move and printing call so I follows it. Add a newline after both characters. Trace AL and the accumulated screen text after each instruction.', 'HI',
        ['The second move must happen after the first printing call.', 'Changing AL does not change a character that was already drawn.', 'Call the lowercase helper newline after printing both letters.'],
        'How many calls to putc are needed to print the two non-newline characters H and I?', 2,
        'Each putc call prints one current AL value. A separate newline helper moves the cursor afterward.',
        `    mov al, 'H'
    call putc
    mov al, 'I'
    call putc
    call newline`),
      checkpoint('evidence-and-transfer', 'Revise your two-character program',
        'Change the two character values in your accumulated draft so the screen says OK. Keep one move and one output call for each character. Explain the difference between changing a register and changing already displayed output.', 'OK',
        ['First decide which character must be loaded before the first output call.', 'The first character is O and the second is K.', 'You do not need to change the scaffold or add BIOS setup.'],
        'For mov ax,65 / mov bx,ax / mov ax,66, what decimal value remains in BX?', 65,
        'MOV copies the current bits. The later write to AX does not modify the independent register BX.',
        `    mov al, 'O'
    call putc
    mov al, 'K'
    call putc
    call newline`),
    ]),
  'assembly-numbers': chapter(
    'Build a short representation ledger in lesson.asm. Add one printed value at a time; print_hex16 reads AX and writes four hexadecimal digits, while newline separates your observations.', [
      checkpoint('one-value-many-spellings', 'Give one value two descriptions',
        'Load decimal 42 into AX and display it with print_hex16. Predict its four hexadecimal digits first. Then, in a separate run, spell the same input as hexadecimal and confirm that the display does not change.', '002A',
        ['A decimal literal has no 0x prefix.', 'One hexadecimal digit groups four bits.', 'The helper formats AX; it does not print the source spelling of your number.'],
        'What decimal value is represented by hexadecimal 0x2a?', 42,
        'The digits mean 2 × 16 + 10 = 42. Leading zero digits do not change that value.',
        `    mov ax, 42
    call print_hex16`),
      checkpoint('derive-negative-values', 'Add a signed interpretation',
        'Keep the existing 42 result. Add a newline, then load sixteen-bit minus one into AX and print that pattern on the next line. Explain how the formatter displays a sixteen-bit pattern as hexadecimal digits.', '002A\nFFFF',
        ['The formatter shows the sixteen stored bits in hexadecimal.', 'Every bit is one in the sixteen-bit representation of -1.', 'Write a fresh AX value before the second print call; use newline to separate the results.'],
        'What unsigned decimal value has the same sixteen-bit pattern as signed -1?', 65535,
        'The all-ones pattern is 2^16 - 1 = 65535 when interpreted without a sign.',
        `    mov ax, 42
    call print_hex16
    call newline
    mov ax, -1
    call print_hex16`),
      checkpoint('make-an-interpretation-ledger', 'Complete the three-value ledger',
        'Revise the first input from 42 to decimal 65. Keep the -1 line and append a third line containing the sixteen-bit representation of -128. Predict each pattern before running the completed ledger.', '0041\nFFFF\nFF80',
        ['Decimal 65 has hexadecimal representation 41.', 'A negative sixteen-bit value is represented modulo 65536.', 'For -128, subtract 128 from 65536 before converting to hexadecimal.'],
        'What unsigned decimal value has the same eight-bit pattern as signed -2?', 254,
        'The eight-bit pattern is FE. Its unsigned value is 256 - 2 = 254; signed interpretation subtracts 256.',
        `    mov ax, 65
    call print_hex16
    call newline
    mov ax, -1
    call print_hex16
    call newline
    mov ax, -128
    call print_hex16
    call newline`),
    ]),
  'assembly-registers': chapter(
    'Keep one evolving register experiment. First change a byte, then inspect a preserved upper word, and finally construct a word from its two byte names. The supplied printing routines preserve the full general registers.', [
      checkpoint('trace-overlapping-writes', 'Change only the low byte',
        'The harness supplies AX (0x5678 in the sample). Replace AL with 0xef and print AX. Predict which two hexadecimal digits must remain unchanged; do not reload the complete word to manufacture the answer.', '56EF',
        ['AL names bits 7 through 0 of AX.', 'AH names the other byte of AX.', 'A byte write does not clear the neighboring byte.'],
        'After the AL write, what decimal value remains in AH?', 86,
        'AH remains hexadecimal 56. That is 5 × 16 + 6 = 86.',
        `    mov al, 0xef
    call print_hex16`),
      checkpoint('observe-a-wide-register', 'Preserve and inspect EAX’s upper half',
        'The harness now supplies EAX (0x12345678 in the sample). Replace only AX with 0xbeef. Print the low word, then shift EAX right by 16 and print its remaining low word on another line. Explain why writing all of EAX for the replacement would destroy the second result.', 'BEEF\n1234',
        ['Use AX as the replacement destination to preserve the upper sixteen bits.', 'print_hex16 observes AX and preserves the rest of EAX.', 'The shift moves the original upper word into the printer’s sixteen-bit view.'],
        'Before the shift, what decimal value is in EAX bits 31 through 16?', 4660,
        'Those bits remain 0x1234, which is decimal 4660, because the AX write changes only the low sixteen bits.',
        `    mov ax, 0xbeef
    call print_hex16
    call newline
    shr eax, 16
    call print_hex16`),
      checkpoint('repair-and-generalize', 'Construct the final word from two byte writes',
        'Keep the two existing observations from the supplied EAX. Append a newline, clear AX, then set AH and AL separately so the third printed word is 3412. Describe which shared bit positions each byte instruction writes.', 'BEEF\n1234\n3412',
        ['The high byte supplies the first two hexadecimal digits.', 'AH must receive 0x34 and AL must receive 0x12.', 'Keep the earlier AX-sized replacement so EAX’s original upper word survives.'],
        'Start with EAX=0x89ABCDEF, then write AX=0x1234 and AH=0x56. What decimal value is in AL?', 52,
        'The final EAX is 89AB5634. AH changes bits 15:8 only; AL remains hexadecimal 34, which is decimal 52.',
        `    mov ax, 0xbeef
    call print_hex16
    call newline
    shr eax, 16
    call print_hex16
    call newline
    mov ax, 0
    mov ah, 0x34
    mov al, 0x12
    call print_hex16
    call newline`),
    ]),
  'assembly-arithmetic': chapter(
    'Start with a small sum, extend the same draft to observe carry at a boundary, then use that carry to update a second word. Inspect both the computed value and the flags.', [
      checkpoint('unsigned-carry', 'Compute a sum with ADD',
        'The harness supplies AX (decimal 41 in the sample). Add one and print the resulting word. Keep the actual ADD in your program. Use Run and the Registers view if you want to inspect its effect on CF.', '002A',
        ['The immediate value 1 is added to the old AX.', 'A sixteen-bit destination can hold 42 without discarding an upper bit.', 'The printed number is hexadecimal even though the input literal is decimal.'],
        'Immediately after this sixteen-bit ADD, what is CF: 0 or 1?', 0,
        '41 + 1 fits in sixteen unsigned bits, so no carry leaves the high end.',
        `    add ax, 1
    call print_hex16`),
      checkpoint('capture-flags-before-clobbering', 'Observe a carry-producing boundary',
        'The harness supplies AX (0xffff in the sample). After adding one, capture CF in BL before doing other arithmetic. Print the retained AX result, then print the captured carry on another line after widening BL to AX. Do not substitute a constant for the observed carry.', '0000\n0001',
        ['SETC writes a zero or one byte according to CF.', 'The printing helpers preserve registers and FLAGS in this lab.', 'MOVZX can widen the saved byte without preserving unrelated old bits in AX.'],
        'Immediately after 0xffff + 1 in sixteen bits, what is CF?', 1,
        'The mathematical result is 0x10000. AX retains 0000 and the extra high bit is represented by CF=1.',
        `    add ax, 1
    setc bl
    call print_hex16
    call newline
    movzx ax, bl
    call print_hex16`),
      checkpoint('boundary-tests-and-explanations', 'Carry into a second word',
        'Turn the boundary experiment into a two-word increment. The harness supplies DX:AX (0001:FFFF in the sample). Add one to AX, preserve the low result, and use ADC to carry into DX. Replace the carry-report line with high-word then low-word output.', '0002\n0000',
        ['ADC adds both its explicit operand and the current CF.', 'MOV can preserve the low word without changing pending flags.', 'Print DX first, then the saved low word, so the pair reads high then low.'],
        'Immediately after the sixteen-bit ADD AX,1 with old AX=0xFFFF, what is OF: 0 or 1?', 0,
        'The signed inputs are -1 and +1, yielding zero, which fits. CF is one, but OF is zero.',
        `    add ax, 1
    mov bx, ax
    adc dx, 0
    mov ax, dx
    call print_hex16
    call newline
    mov ax, bx
    call print_hex16
    call newline`),
    ]),
  'assembly-memory': chapter(
    'Write instructions in lesson.asm and declare your bytes in data.inc. Keep the same packet across checkpoints: first read one byte, then reconstruct the word, then store and reload a separate copy.', [
      checkpoint('label-or-value', 'Load a byte from owned data',
        'In data.inc, declare packet as bytes 0xef, 0xbe. In lesson.asm, clear AX, load the first packet byte into AL through a bracketed memory operand, and print AX. Do not load the packet label itself as the answer.', '00EF',
        ['DB emits bytes; packet names the first byte’s address.', 'Brackets request a memory read at that address.', 'Clearing AX first gives its untouched high byte a known zero value.'],
        'What is the decimal value of the first byte loaded from packet?', 239,
        'The byte EF is 14 × 16 + 15 = 239. It is the byte stored at packet.',
        `    xor ax, ax
    mov al, [packet]
    call print_hex16`, 'packet: db 0xef, 0xbe'),
      checkpoint('partial-register', 'Reconstruct the neighboring high byte',
        'Keep your low-byte load. Add a load into AH from the next packet address, then print the complete AX word. Explain why reusing the first address for both loads produces the wrong word.', 'BEEF',
        ['Addresses count bytes, so the second byte is at packet + 1.', 'Little-endian layout places the low byte at the lower address.', 'Writing AH leaves AL unchanged.'],
        'How many bytes beyond packet is the high byte of this word stored?', 1,
        'A sixteen-bit word occupies two consecutive bytes. Its high byte is at the first address plus one.',
        `    xor ax, ax
    mov al, [packet]
    mov ah, [packet+1]
    call print_hex16`, 'packet: db 0xef, 0xbe'),
      checkpoint('memory-explain', 'Store a copy, clear the register, and recover it',
        'Add copy: dw 0 to data.inc. After reconstructing AX, store it into copy. Clear AX to show that the register and memory are independent, then reload the word from copy and print it. Keep both original byte loads.', 'BEEF',
        ['A store puts the bracketed destination on the left.', 'The AX operand supplies the store width.', 'Reloading [copy] after clearing AX retrieves the stored word.'],
        'A word contains 0x0201. You store byte 0xAA at its first address. What unsigned decimal value does a word load now return?', 682,
        'The bytes become AA 02. The word is 0x02AA = 2 × 256 + 170 = 682.',
        `    mov al, [packet]
    mov ah, [packet+1]
    mov [copy], ax
    xor ax, ax
    mov ax, [copy]
    call print_hex16`, 'packet: db 0xef, 0xbe\ncopy: dw 0'),
    ]),
  'assembly-addressing': chapter(
    'Use one three-word array in data.inc throughout the chapter. In lesson.asm, advance from its first element to an indexed element, then make both the byte stride and segment choice explicit.', [
      checkpoint('default-segment', 'Use a base register to read the first element',
        'Declare values as words 0x1111, 0x2222, 0x3333 in data.inc. Put the values address in BX, read the word through BX into AX, and print it. Identify the default segment used by that memory operand.', '1111',
        ['MOV BX, values loads an address; MOV AX, [BX] loads contents.', 'BX-based sixteen-bit addressing normally uses DS.', 'The scaffold establishes DS=0, matching these data-label addresses.'],
        'How many bytes does the complete three-word array occupy?', 6,
        'Each word occupies two bytes, so three words occupy six consecutive bytes.',
        `    mov bx, values
    mov ax, [bx]
    call print_hex16`, 'values: dw 0x1111, 0x2222, 0x3333'),
      checkpoint('array-stride', 'Add the byte offset of element one',
        'Keep BX as the array base. Add SI as a byte offset that selects element index 1, counting from zero. Read through the combined address and print the second word. Derive the offset from the element width.', '2222',
        ['The second element follows one complete word.', 'A word is two bytes, so index 1 becomes a two-byte offset.', 'BX + SI is a legal sixteen-bit address form.'],
        'What byte offset from values selects element index 1?', 2,
        'The offset is index × element size: 1 × 2 = 2 bytes.',
        `    mov bx, values
    mov si, 2
    mov ax, [bx+si]
    call print_hex16`, 'values: dw 0x1111, 0x2222, 0x3333'),
      checkpoint('addressing-evidence', 'Select element two with an explicit data segment',
        'Revise the base register to BP and select element index 2. Because BP changes the default segment, explicitly select DS in the memory operand. Keep the same array and print the actual loaded word.', '3333',
        ['Element index 2 starts after two two-byte words.', 'BP-based operands default to SS, even if DS happens to equal SS today.', 'A segment override chooses the segment; it does not change the register’s value.'],
        'With DS=0x1234 and effective offset 0x0040, what is the physical byte address in decimal? Assume ordinary real mode below one MiB.', 74624,
        '0x1234 × 16 + 0x0040 = 0x12380 = 74624.',
        `    mov bp, values
    mov si, 4
    mov ax, [ds:bp+si]
    call print_hex16`, 'values: dw 0x1111, 0x2222, 0x3333'),
    ]),
  'assembly-branches': chapter(
    'Build one decision in lesson.asm. Start with equality, revise it to signed ordering, then give the two paths explicit string results in data.inc. Each run should follow a real conditional branch.', [
      checkpoint('equality', 'Choose a character using equality',
        'The harness supplies AX (1 in the sample). Compare it with 1. Branch to an equal path that prints E; make the other path print N. Arrange the control flow so only one result is printed. Predict whether CMP changes AX.', 'E',
        ['CMP changes flags as if it subtracted; it does not write AX.', 'JE follows the equality result in ZF.', 'Use a join label so the first path does not fall into the second.'],
        'What decimal value remains in AX immediately after CMP AX,1 when AX started at 1?', 1,
        'CMP discards the subtraction result and leaves both explicit operands unchanged.',
        `    cmp ax, 1
    je .equal
    mov al, 'N'
    jmp .show
.equal:
    mov al, 'E'
.show:
    call putc`),
      checkpoint('signed', 'Revise the decision for signed less-than',
        'The harness supplies AX (signed -1 in the sample). Compare it with 1. Replace the equality decision with a signed less-than decision. Print L for less and O otherwise. Keep both paths; the test suite also supplies equal, positive, and negative boundary inputs.', 'L',
        ['The register pattern for -1 is also a large unsigned value.', 'JL expresses signed less-than; JB expresses unsigned below.', 'Changing the meaning of the comparison requires changing the branch condition.'],
        'After CMP AX,1 with AX initialized to signed -1, what signed value remains in AX?', -1,
        'CMP updates flags without changing AX, so the input remains -1.',
        `    cmp ax, 1
    jl .less
    mov al, 'O'
    jmp .show
.less:
    mov al, 'L'
.show:
    call putc`),
      checkpoint('branch-debug', 'Report the selected path as a string',
        'Keep the signed comparison of the supplied AX and its two paths. Declare null-terminated LESS and OTHER messages in data.inc. Replace each path’s character assignment with the address of its matching string in SI, then call puts once at the join.', 'LESS',
        ['The supplied puts helper reads a null-terminated string at DS:SI.', 'The branch chooses an address; the shared output call prints the selected bytes.', 'Each stored message needs a zero terminator.'],
        'AL is 0x80. CMP AL,1 discards an eight-bit subtraction result. What is that truncated result as an unsigned decimal number?', 127,
        '0x80 - 1 truncates to 0x7f, or 127. CMP leaves AL unchanged. Signed less-than still accounts for overflow.',
        `    cmp ax, 1
    jl .less
    mov si, other_text
    jmp .report
.less:
    mov si, less_text
.report:
    call puts`, 'less_text: db "LESS", 0\nother_text: db "OTHER", 0'),
    ]),
  'assembly-loops': chapter(
    'Grow one bounded loop. First repeat a visible action, then replace that action with a word-array accumulation, and finally test the completed loop with new data. Keep the zero-entry case safe.', [
      checkpoint('while-shape', 'Repeat a visible action three times',
        'The harness supplies the remaining count in CX (3 in the sample). Before each iteration, test whether the count is zero. If not, print A, decrement the count, and jump back. Keep the test before the output so an initial zero would print nothing.', 'AAA',
        ['Use an entry label before the zero test and an exit label after the backward jump.', 'The body must decrease the remaining count.', 'The helper preserves CX, so the counter survives a printing call.'],
        'With the initial count 3, how many times does this guarded body print A?', 3,
        'The body runs for remaining counts 3, 2, and 1. The test exits when the count reaches zero.',
        `
.again:
    cmp cx, 0
    je .done
    mov al, 'A'
    call putc
    dec cx
    jmp .again
.done:`),
      checkpoint('worked-trace', 'Turn repetition into an array sum',
        'Replace the repeated character with addition into AX. In data.inc, declare values as words 1,2,3,4. Use SI to read each element, advance by the size of one word, and decrease the supplied CX (4 in the sample). Guard a zero starting count and print only the final sum.', '000A',
        ['Initialize the sum to zero before the loop.', 'The pointer advances two bytes after each word load.', 'The exit must reach the final printer even when the input count is zero.'],
        'After three completed iterations, how many bytes beyond values does SI point?', 6,
        'Each iteration advances SI by two bytes, so three advances total six.',
        `    mov si, values
    xor ax, ax
    jcxz .done
.again:
    add ax, [si]
    add si, 2
    dec cx
    jnz .again
.done:
    call print_hex16`, 'values: dw 1, 2, 3, 4'),
      checkpoint('loop-proof', 'Change the data and defend the boundaries',
        'Keep your accumulation loop. Replace the array with words 2,4,6,8 and predict the new sum. The test suite supplies counts zero, one, two, and four with varied array contents. Explain why the two-byte stride and zero-entry guard are both necessary.', '0014',
        ['The new decimal sum is 20, displayed in hexadecimal.', 'Changing the data should not require changing the stride.', 'A body-then-LOOP loop with zero CX wraps the counter if it lacks an entry guard.'],
        'A body-then-LOOP loop starts with sixteen-bit CX=0 and no entry guard. If its body always reaches LOOP without changing CX, how many times does the body execute before exit?', 65536,
        'The first LOOP decrements zero to FFFF. The counter then traverses the remaining values until zero: 65,536 total body executions.',
        `    mov si, values
    xor ax, ax
    jcxz .done
.again:
    add ax, [si]
    add si, 2
    dec cx
    jnz .again
.done:
    call print_hex16`, 'values: dw 2, 4, 6, 8'),
    ]),
  'assembly-stack': chapter(
    'Use one stack experiment whose pushes and pops remain balanced at every checkpoint. The hidden wrapper calls your lesson with SS=0 and SP=0x7bfe; keep its existing return address untouched.', [
      checkpoint('pop-bytes', 'Save one word and recover it',
        'The harness supplies AX (0x1122 in the sample). Push it. Overwrite AX with zero, then pop the saved word back into AX and print it. Account for the two owned stack bytes before running.', '1122',
        ['PUSH AX subtracts two from SP and stores a word.', 'The overwritten register value does not change the saved memory word.', 'The POP must release that word before the hidden wrapper returns.'],
        'What is SP immediately after this one word push, before any helper call?', 0x7bfc,
        'Lesson entry is 0x7bfe. A sixteen-bit push reserves two bytes, leaving 0x7bfc.',
        `    push ax
    xor ax, ax
    pop ax
    call print_hex16`),
      checkpoint('observation', 'Add a second word and observe LIFO order',
        'The harness supplies AX as the first word and BX as the second (0x1122 and 0x3344 in the sample). Push AX, then BX. Pop the newest word into AX and the earlier word into BX. Print AX, a space, then BX. Draw the four data bytes and the pre-existing return address.', '3344 1122',
        ['The second push goes below the first in memory.', 'The first POP reads the most recently pushed word.', 'Both POPs must finish before you return; helpers use their own temporary stack space.'],
        'What is SP after both words have been popped, before the first printing call?', 0x7bfe,
        'Two word pushes reserve four bytes and two word pops release four, restoring the lesson-entry SP.',
        `    push ax
    push bx
    pop ax
    pop bx
    call print_hex16
    mov al, ' '
    call putc
    mov ax, bx
    call print_hex16`),
      checkpoint('practice', 'Recover insertion order without changing the pushes',
        'Keep the two pushes and the output sequence. Change which register receives each pop so the earlier value is printed first. Explain why the values change order while the final stack depth remains identical.', '1122 3344',
        ['The newest value must go into the register printed second.', 'Recover 0x3344 into BX before recovering 0x1122 into AX.', 'Ordering correctness and balanced stack ownership are separate properties.'],
        'What is SP immediately after the two word pushes, before either POP or helper call? Enter hex or decimal.', 0x7bfa,
        'The wrapper CALL makes entry SP 0x7bfe. Two sixteen-bit pushes subtract four more bytes: 0x7bfa.',
        `    push ax
    push bx
    pop bx
    pop ax
    call print_hex16
    mov al, ' '
    call putc
    mov ax, bx
    call print_hex16`),
    ]),
  'assembly-calls': chapter(
    'Write your own small sum routine inside lesson.asm. Begin with register inputs, revise its interface to stack arguments, and finally add a preservation promise. Keep a jump around the routine so normal execution cannot fall into it.', [
      checkpoint('direct-call', 'Call a routine with register inputs',
        'The harness supplies AX and BX (3 and 4 in the sample). Call a local routine that adds BX into AX, and print the returned sum. The local routine must use RET. Arrange a jump past its body after printing so the surrounding lesson can finish normally.', '0007',
        ['Use a local label such as .sum for the callee.', 'CALL supplies a continuation; RET consumes it.', 'A final local label after the callee lets you skip its body on the caller’s normal path.'],
        'With lesson-entry SP=0x7bfe, what is SP inside .sum immediately after its near CALL and before any callee pushes?', 0x7bfc,
        'The near sixteen-bit CALL pushes a two-byte continuation, taking SP from 0x7bfe to 0x7bfc.',
        `    call .sum
    call print_hex16
    jmp .finished
.sum:
    add ax, bx
    ret
.finished:`),
      checkpoint('cleanup', 'Move the two inputs onto the stack',
        'The harness supplies the first argument in AX and the second in DX (6 and 7 in the sample). Push DX, then AX, and call your sum routine. Build a BP frame in the callee, read the two arguments, and return their sum in AX. Keep plain RET and have the caller release both arguments before printing.', '000D',
        ['After PUSH BP / MOV BP,SP, the first argument is at BP+4.', 'The second word follows at BP+6.', 'The caller removes four argument bytes; the callee only restores its frame and return address.'],
        'How many bytes of arguments must the caller release after this two-word call?', 4,
        'Two sixteen-bit arguments occupy two bytes each. Their four bytes remain after the callee’s ordinary RET.',
        `    push dx
    push ax
    call .sum
    add sp, 4
    call print_hex16
    jmp .finished
.sum:
    push bp
    mov bp, sp
    mov ax, [bp+4]
    add ax, [bp+6]
    pop bp
    ret
.finished:`),
      checkpoint('practice', 'Preserve a caller-owned register',
        'Keep your stack-argument convention. The harness also supplies a caller-owned BX sentinel (0xbeef in the sample). Let the callee temporarily use BX to hold its second argument. Save and restore BX inside the callee. Print the returned sum followed by the caller’s BX sentinel.', '000D BEEF',
        ['Save BX after establishing BP so the positive argument offsets stay fixed.', 'Restore BX before restoring BP and executing RET.', 'Keep caller cleanup exactly once; a preserved register does not release arguments.'],
        'After PUSH BP / MOV BP,SP, how many bytes above BP is the second sixteen-bit argument?', 6,
        'Saved BP uses offsets 0–1, the return IP uses 2–3, and the first argument uses 4–5. The second begins at +6.',
        `    push dx
    push ax
    call .sum
    add sp, 4
    call print_hex16
    mov al, ' '
    call putc
    mov ax, bx
    call print_hex16
    jmp .finished
.sum:
    push bp
    mov bp, sp
    push bx
    mov ax, [bp+4]
    mov bx, [bp+6]
    add ax, bx
    pop bx
    pop bp
    ret
.finished:`),
    ]),
  'assembly-bits': chapter(
    'Grow one arithmetic report from a single mask result into a four-result pipeline. Add operations only after their section; retain the preceding results so each new observation has a clear cause.', [
      checkpoint('logic', 'Keep only a low nibble',
        'The harness supplies AX (0x00a5 in the sample). Use AND to retain only its lowest four bits, then print the resulting word. Predict which bits are cleared before writing the mask.', '0005',
        ['A one in an AND mask preserves the corresponding destination bit.', 'The lowest four positions are selected by hexadecimal 000f.', 'Use AND to compute the result from the supplied input.'],
        'What decimal value remains after 0x00a5 AND 0x000f?', 5,
        'The mask clears the high nibble A and preserves the low nibble 5.',
        `    and ax, 0x000f
    call print_hex16`),
      checkpoint('shifts', 'Extract a field and preserve a signed shift',
        'The harness supplies the field source in AX and a signed word in DX (0x01d3 and -9 in the sample). Extract AX bits 7..4 and print them. Then append a space, copy DX into AX, and shift it right by one while preserving its sign. Print each computed AX value.', '000D FFFB',
        ['Shift the selected nibble to the low position and mask it to four bits.', 'SAR replicates the sign bit; SHR fills with zero.', 'Arithmetic right shift of negative odd values rounds downward, unlike IDIV’s truncation toward zero.'],
        'What signed decimal value results from sixteen-bit SAR of -9 by one?', -5,
        'Arithmetic right shift preserves the sign and rounds down, so -9 becomes -5, whose pattern is FFFB.',
        `    shr ax, 4
    and ax, 0x000f
    call print_hex16
    mov al, ' '
    call putc
    mov ax, dx
    sar ax, 1
    call print_hex16`),
      checkpoint('practice', 'Append quotient and remainder',
        'Keep the field and signed-shift results. The harness additionally supplies an unsigned dividend in SI and a nonzero divisor in BX (1000 and 64 in the sample). Append their division. Prepare the entire DX:AX dividend from SI, then print quotient and remainder separated by spaces. The output helpers preserve DX while you print AX.', '000D FFFB 000F 0028',
        ['Clear DX when constructing this unsigned sixteen-bit numerator.', 'DIV BX consumes DX:AX, returns quotient in AX and remainder in DX.', 'Print the remainder from DX after the quotient; do not replace it with a guessed constant.'],
        'What is the decimal remainder after unsigned 1000 divided by 64?', 40,
        '15 × 64 = 960, leaving 40. The screen represents that remainder as hexadecimal 0028.',
        `    shr ax, 4
    and ax, 0x000f
    call print_hex16
    mov al, ' '
    call putc
    mov ax, dx
    sar ax, 1
    call print_hex16
    mov al, ' '
    call putc
    mov ax, si
    xor dx, dx
    div bx
    call print_hex16
    mov al, ' '
    call putc
    mov ax, dx
    call print_hex16`),
    ]),
  'assembly-debugging': chapter(
    'Build your output path in three small stages: one known helper call, direct firmware requests, then a string-reading BIOS loop. Keep each working checkpoint so a later failure has a precise comparison.', [
      checkpoint('relative', 'Establish one visible observation',
        'Write a two-instruction observation that puts O in AL and calls putc. Run it once, then find your character literal in the emitted bytes. This is the baseline you will retain while replacing the helper’s hidden work.', 'O',
        ['A character value in AL is not visible until an output operation uses it.', 'Only your short lesson body belongs in lesson.asm.', 'The scaffold supplies the helper and the final halt; neither needs to be copied into your draft.'],
        'What decimal ASCII value represents the character O?', 79,
        'ASCII O is hexadecimal 4f: 4 × 16 + 15 = 79.',
        `    mov al, 'O'
    call putc`),
      checkpoint('bios-service', 'Replace the helper with two firmware requests',
        'Replace CALL putc with a direct BIOS teletype request for O. Then add a second direct request for S. Establish AH, AL, and page zero for each call. Predict the effect of deliberately selecting AH=0x0f in a separate run, then restore printing.', 'OS',
        ['INT 0x10 selects the video dispatcher, while AH chooses its service.', 'Teletype output uses AH=0x0e and the character in AL.', 'Reload the inputs for each firmware request; do not depend on undocumented returned register values.'],
        'How many non-newline characters does your pair of successful teletype requests print?', 2,
        'Each request prints its current AL character: first O, then S.',
        `    mov al, 'O'
    mov ah, 0x0e
    mov bx, 0x0007
    int 0x10
    mov al, 'S'
    mov ah, 0x0e
    mov bx, 0x0007
    int 0x10`),
      checkpoint('handoff', 'Build a forward string loop',
        'Declare message as the null-terminated string OS READY in data.inc. Replace the two repeated requests with a forward LODSB loop that exits on the terminator and prints each nonzero byte through INT 0x10. Keep DS and DF assumptions explicit in your explanation; the scaffold establishes DS=0 and DF=0.', 'OS READY',
        ['Load SI with the message address before the first LODSB.', 'Test AL and exit before requesting output for the terminator.', 'Select AH=0x0e on each iteration. A halt after the completed message is the expected final state.'],
        'What numeric value must AH contain for BIOS teletype output? Enter decimal or hex.', 14,
        'The BIOS teletype selector is hexadecimal 0x0e, which is decimal 14.',
        `    mov si, message
.next:
    lodsb
    test al, al
    jz .finished
    mov ah, 0x0e
    mov bx, 0x0007
    int 0x10
    jmp .next
.finished:`, 'message: db "OS READY", 0'),
    ]),
};

// Publish the same explicit input/output contract to the learner and the real
// machine grader. The first test case supplies the ordinary Run inputs.
for (const [slug, guide] of Object.entries(guidedAssemblyBySlug)) {
  guide.steps.forEach((step, index) => {
    step.tests = step.tests || assemblyCheckpointTests[slug][index];
    if (!step.instructions.includes(' Machine contract:')) step.instructions += ` Machine contract: ${step.tests.contract}`;
  });
}
