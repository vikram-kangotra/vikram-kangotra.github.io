const intel = { label: 'Intel instruction-set reference', url: 'https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html', section: 'Volume 2: ADD, ADC, MOV, MOVS and instruction encoding' };
const nasm = { label: 'NASM language reference', url: 'https://www.nasm.us/doc/nasm03.html', section: 'Operands, data declarations and effective addresses' };
const p = (title, ...paragraphs) => ({ type: 'prose', title, paragraphs });
const code = (title, source, notes) => ({ type: 'code', title, language: 'asm', code: source, notes });

const decode = `mov ax, 0x1234
mov bx, 3
add ax, bx
call print_hex16
call newline
ret
`;
const wideSum = `xor ax, ax
xor dx, dx
mov si, values
mov cx, count
jcxz .done
.next:
    add ax, [si]
    adc dx, 0
    lea si, [si+2]
    loop .next
.done:
call print_hex16
call newline
mov ax, dx
call print_hex16
call newline
ret
`;
const move = `mov si, buffer
mov di, buffer+2
mov cx, 4
call move_bytes
mov si, buffer
call puts
call newline
ret

; DS=ES=0; source and destination ranges fit within this segment.
; Input SI=source, DI=destination, CX=count. Clobbers AX, SI, DI, CX and arithmetic FLAGS.
; Returns with DF=0. Caller owns both ranges.
move_bytes:
    cld
    jcxz .return
    cmp di, si
    jbe .forward
    mov ax, si
    add ax, cx
    cmp di, ax
    jae .forward
    add si, cx
    add di, cx
    dec si
    dec di
    std
    rep movsb
    cld
    ret
.forward:
    rep movsb
.return:
    ret
`;

export const assemblyHandbook = {
  'assembly-first-instructions': [{
    id: 'decode-instructions-byte-by-byte', sectionId: 'source-and-machine-code', title: 'Decode instruction bytes and account for every operand',
    intro: ['A listing connects source to the actual instruction stream. Start with a short program whose bytes you can derive by hand, then change exactly one operand. This makes instruction length, byte order, register selection, and the current decoding mode observable.'],
    blocks: [
      p('Construct a tiny instruction stream', 'Take three instructions in 16-bit mode: `mov ax, 0x1234`, `mov bx, 3`, and `add ax, bx`. The immediate MOV form encodes its destination register in the low three bits of the opcode. AX uses register number zero, so its opcode is B8. BX uses register number three, so its opcode is BB. Each opcode is followed by a two-byte immediate in least-significant-byte-first order. Together the two MOV instructions occupy six bytes.', 'The register ADD uses opcode 01 followed by a ModR/M byte. The ModR/M byte has a two-bit mode, a three-bit reg field, and a three-bit r/m field. Mode 11 selects a register operand. For opcode 01, reg identifies the source and r/m identifies the destination. Choose reg=011 for BX and r/m=000 for AX: binary 11011000 is hexadecimal D8. This gives `01 D8`. Another legal ADD encoding can represent the same operation using a different direction form; inspect the assembler listing to identify the chosen form.', 'The CPU needs an instruction boundary and a decoding mode to interpret these bytes. Starting at a byte in the middle of an immediate produces a different stream. In 32-bit default operand size, B8 consumes a four-byte immediate. An operand-size prefix changes that width. A source directive such as BITS 16 tells the assembler which defaults to assume; changing that directive alone leaves the CPU execution mode unchanged.'),
      { type: 'table', caption: 'Eight original bytes, three instructions, one data-flow chain', columns: ['Offset', 'Bytes', 'Interpretation', 'State after execution'], rows: [['0', 'B8 34 12', 'MOV immediate word into AX', 'AX=1234'], ['3', 'BB 03 00', 'MOV immediate word into BX', 'AX=1234, BX=0003'], ['6', '01 D8', 'ADD BX into AX', 'AX=1237, BX=0003']] },
      { type: 'bits', caption: 'The D8 ModR/M byte', width: 8, fields: [ { name: 'mod', high: 7, low: 6, description: '11 selects a register as the r/m operand.' }, { name: 'reg', high: 5, low: 3, description: '011 names BX for this 16-bit ADD form.' }, { name: 'r/m', high: 2, low: 0, description: '000 names AX when mod is 11.' }], value: '0xD8' },
      code('Run the decoded data flow', decode, ['The helper consumes AX and prints four hexadecimal digits. Its call and the final RET add more instructions beyond the eight bytes decoded above. Expect 1237.']),
      p('Extend decoding to a memory operand', 'For a 16-bit memory form, the r/m field selects an addressing combination. With mod=00, r/m=000 means `[BX+SI]`; r/m=110 instead introduces a direct 16-bit displacement. With mod=01 a signed eight-bit displacement follows; mod=10 adds a sixteen-bit displacement. The special direct-address case explains why `[BP]` requires a displacement encoding, commonly a zero byte. Operand size answers how many bytes to load; address size answers how to calculate the address.', 'Treat an encoding change as a hypothesis. Change the immediate from 0x1234 to 0x5634 and predict that only the high immediate byte changes. Change BX to CX and predict that the MOV opcode changes to B9 and the ADD register field becomes 001. Assemble and compare offsets before booting. A listing proves byte generation; running proves the result under a specific machine state.'),
      { type: 'exercise', title: 'Predict a register substitution', prompt: 'Use the supplied routine, substitute CX for BX, and load CX with 0x0102.', tasks: ['Derive the first eight bytes.', 'Predict AX after addition.', 'Run the routine and compare the listing and screen.'], solution: ['The stream is B8 34 12 B9 02 01 01 C8. The new ModR/M byte has mode 11, reg 001, and r/m 000.', '0x1234 + 0x0102 = 0x1336. AX prints 1336. The immediate bytes are 02 01, and instruction lengths remain 3, 3, and 2.'], checks: ['First instruction begins at offset 0; ADD begins at offset 6.', 'The listing and printed value agree.'], mode: 'assembly', starterFiles: { 'lesson.asm': decode, 'data.inc': '' }, solutionFiles: { 'lesson.asm': decode.replaceAll('bx', 'cx').replace('mov cx, 3', 'mov cx, 0x0102'), 'data.inc': '' }, activeFile: 'lesson.asm' },
    ], references: [intel, nasm],
  }],
  'assembly-arithmetic': [{
    id: 'wide-sum-carry-chain', sectionId: 'add-with-carry', title: 'Build and prove a 32-bit sum from 16-bit operations',
    intro: ['A wide sum consists of a low word and a high word. Every carry out of the low word represents another 65536 in the mathematical total. ADC transfers that information into the high word while the loop maintains a precise invariant.'],
    blocks: [
      p('Choose the representation and the invariant', 'Represent the total as `65536 × DX + AX`. Initialize both words to zero. After processing k unsigned input words, require that this expression equals their mathematical sum, provided the complete sum fits in 32 bits. Each `ADD AX,[SI]` computes the low sixteen bits and leaves a carry in CF if the addition crossed 65535. `ADC DX,0` adds that carry to the high word.', 'The instructions form one dependency chain. CF is live between ADD and ADC. An instruction such as `ADD SI,2` would overwrite it. Place ADC immediately after the low-word addition. After consuming the carry, pointer arithmetic may change the flags freely for this algorithm. LEA offers a way to advance SI without changing arithmetic flags; its result is an effective offset with no memory read.', 'For n unsigned sixteen-bit inputs, the maximum sum is n×65535. With CX as the count and n at most 65535, this product is 4294836225, which fits below 2^32. A larger count or wider input format needs another overflow policy. The input range must also fit in owned memory; register capacity alone gives no permission to walk an arbitrarily large array.'),
      { type: 'trace', caption: 'Sum FFFF, 0001, 0001, 0002', columns: ['Input', 'Low ADD result', 'CF into ADC', 'DX after ADC', 'Full total'], rows: [['FFFF', 'FFFF', '0', '0000', '0000FFFF'], ['0001', '0000', '1', '0001', '00010000'], ['0001', '0001', '0', '0001', '00010001'], ['0002', '0003', '0', '0001', '00010003']] },
      code('An empty-array-safe accumulator', wideSum, ['Declare `values: dw 0xffff,1,1,2` and `count equ ($-values)/2` in data.inc. The display prints low word 0003, then high word 0001. Read the full number as high:low = 0001:0003.', 'JCXZ skips the body when count is zero. A LOOP instruction placed only at the end would enter the body once before wrapping a zero count to 65535.']),
      p('Prove each loop step', 'Assume the old total is H×65536+L and the next input is x. There are unique values q and r with L+x=q×65536+r, where q is zero or one and 0≤r<65536. ADD places r in AX and q in CF. ADC changes H to H+q, so the new representation is H×65536+L+x. Advancing SI by two reaches the next word, and decrementing CX records one fewer unprocessed input. Initialization, preservation, and termination together prove the sum.', 'The machine does not remember which operands were intended to be signed. For a signed multiword sum, each signed input must be extended through the high word before addition, and overflow must be interpreted at the width of the complete representation. Feeding 0xffff to this unsigned routine contributes 65535. Treating that word as negative one requires a different high-word contribution.', 'Test values that create a carry on the first or last iteration, several carries across the sequence, no carries, and an empty array. A normal small array can hide a missing ADC forever. Preserve any registers promised by a public function interface, and document whether the returned value is DX:AX or stored through a pointer.'),
      { type: 'exercise', title: 'Find the lost carry', prompt: 'A variant puts ADD SI,2 between ADD AX,[SI] and ADC DX,0.', tasks: ['Find a two-element input that exposes the error.', 'Explain which instruction last wrote CF.', 'Repair the ordering and test an empty array.'], solution: ['FFFF followed by 0001 should produce DX:AX=0001:0000. At the second iteration, the low addition sets CF. An ordinary nonwrapping pointer increment then clears CF, so ADC receives zero and leaves the high word incorrect.', 'Consume CF immediately with ADC, or use an instruction that preserves CF in the intervening slot. The reference places ADC directly after ADD.', 'JCXZ reaches the display with both accumulators zero when count is zero; memory remains untouched.'], checks: ['FFFF + 0001 produces low 0000 and high 0001.', 'Four FFFF words produce high 0003 and low FFFC.'], mode: 'assembly', starterFiles: { 'lesson.asm': wideSum.replace('    adc dx, 0\n    lea si, [si+2]', '    add si, 2\n    adc dx, 0'), 'data.inc': 'values: dw 0xffff,1,1,2\ncount equ ($-values)/2\n' }, solutionFiles: { 'lesson.asm': wideSum, 'data.inc': 'values: dw 0xffff,1,1,2\ncount equ ($-values)/2\n' }, activeFile: 'lesson.asm' },
    ], references: [intel],
  }],
  'assembly-memory': [{
    id: 'overlapping-memory-copy-direction', sectionId: 'owned-memory', title: 'Implement overlapping memory movement and prove the direction',
    intro: ['Copying bytes becomes a dependency problem when the source and destination overlap. Before each write, identify which original source bytes future iterations still need. The direction of traversal determines whether those bytes survive.'],
    blocks: [
      p('Draw the ranges before writing the loop', 'Let the source occupy offsets [S,S+n) and the destination occupy [D,D+n). If D≤S, forward copying reads a source byte before any earlier destination write can destroy it. If D≥S+n, the ranges are disjoint and forward copying also works. The remaining case, S<D<S+n, places the destination inside the source at a higher address. Copy from the last byte toward the first.', 'Consider a seven-byte buffer containing `a b c d e f 0`. Move four bytes from offset zero to offset two. A forward loop first writes a to offset two and b to offset three. The next reads then see those newly written bytes, producing a b a b a b 0. A backward loop first moves d from offset three to five, then c from two to four, b from one to three, and a from zero to two. The correct result is a b a b c d 0.', 'The terminating zero is outside this four-byte movement. It stays at offset six, allowing the output helper to print ababcd. A string API and a byte-range API have different length conventions. State explicitly whether a requested length includes a terminator. A byte copy should obey its count even when a zero byte appears in the middle.'),
      { type: 'trace', caption: 'Backward traversal preserves every unread original byte', columns: ['Step', 'Read offset', 'Write offset', 'Buffer after write'], rows: [['Initial', '', '', 'a b c d e f 0'], ['1', '3: d', '5', 'a b c d e d 0'], ['2', '2: c', '4', 'a b c d c d 0'], ['3', '1: b', '3', 'a b c b c d 0'], ['4', '0: a', '2', 'a b a b c d 0']] },
      code('A bounded real-mode move routine', move, ['Put `buffer: db "abcdef",0` in data.inc. Build & run prints ababcd.', 'The routine uses sixteen-bit offsets and requires DS=ES=0. Both ranges and their one-past-end addresses must fit in the segment. It assumes the caller already checked ownership and bounds.', 'STD makes MOVSB decrement SI and DI. CLD restores the documented return convention. REP uses CX as the count and a zero count performs no movement.']),
      p('Separate address arithmetic from bounds validation', 'The overlap test calculates S+n in AX. This small routine assumes that sum fits in sixteen bits. If it wraps, the comparison can select an unsafe direction. A reusable checked interface needs a wider length/address calculation or a proof such as n≤limit−S before computing the endpoint. Apply the same proof to D. The requirement includes physical ownership: a numerically valid offset can still refer to the boot stack, firmware data, or executing instructions.', 'Real-mode segment aliases add another complication. Two different segment:offset pairs can name overlapping physical bytes even when their offsets appear disjoint. This implementation fixes both segment bases at zero, so the offset comparison matches physical order. A general far-memory copy must compare normalized physical ranges and handle segment boundaries.', 'MOVSB reads DS:SI and writes ES:DI. A caller that changes ES silently changes the destination even though DI looks correct. The routine also clobbers AX, SI, DI, CX, and arithmetic FLAGS; it returns with DF clear. Documenting those effects lets the caller reload SI before printing the result. If an ABI promises preserved registers, add matching saves and restores and account for their stack cost.', 'The algorithm takes O(n) byte operations and O(1) additional storage. A temporary n-byte buffer also handles overlap but increases memory requirements. Wider copies can improve throughput after proving alignment and residual-byte handling. First establish correctness for counts zero and one, identical pointers, left overlap, right overlap, and disjoint ranges.'),
      { type: 'exercise', title: 'Build an overlap test matrix', prompt: 'Use the seven-byte buffer and test one direction at a time, restoring the initial bytes before each run.', tasks: ['Run the original right-overlap example.', 'Move four bytes from buffer+2 into buffer.', 'Test count zero and identical source/destination.', 'Explain why a terminating zero outside the destination range remains in place.'], solution: ['The original right overlap prints ababcd. Copying four bytes from offset two to zero produces c d e f e f 0, so the output is cdefef.', 'Count zero preserves abcdef. Identical source and destination also preserves the bytes; either direction would work, and this implementation chooses forward.', 'The copy only writes offsets in [D,D+n). Offset six remains zero in both four-byte examples, so puts stops there. Increasing the length changes that proof and requires checking capacity again.'], checks: ['Right overlap: ababcd.', 'Left overlap: cdefef.', 'Zero count and same-pointer copy: abcdef.', 'DF is clear on every return path.'], mode: 'assembly', starterFiles: { 'lesson.asm': move, 'data.inc': 'buffer: db "abcdef",0\n' }, solutionFiles: { 'lesson.asm': move.replace('mov si, buffer\nmov di, buffer+2', 'mov si, buffer+2\nmov di, buffer'), 'data.inc': 'buffer: db "abcdef",0\n' }, activeFile: 'lesson.asm' },
    ], references: [intel, nasm],
  }],
};
