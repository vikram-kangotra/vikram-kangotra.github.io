// Two runnable, self-contained explanations of the saves used by console.asm.
// The code is a lesson.asm body under the supplied 16-bit real-mode startup.
const intel = { label: 'Intel instruction reference', url: 'https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html', section: 'PUSHA/PUSHAD, POPA/POPAD, PUSHF/PUSHFD and POPF/POPFD' };
const nasm = { label: 'NASM assembler directives', url: 'https://www.nasm.us/doc/nasm08.html#section-8.1', section: 'BITS and operand-size overrides' };
const node = (id, title, subtitle, explanation, facts = []) => ({ id, title, subtitle, explanation, facts });

const registerExperiment = `bits 16
; Put this complete experiment in lesson.asm. No printing helpers are called.
; The supplied caller has already established SS:SP and its return address.
    mov eax, 0x11223344
    mov ebx, 0x55667788
    mov ecx, 0x99aabbcc
    mov edx, 0xddeeff00
    mov esi, 0x13579bdf
    mov edi, 0x2468ace0
    mov ebp, 0x0badf00d

    pushad                  ; Save eight dwords, including the original ESP.
    mov eax, 0              ; Borrow all seven ordinary register values.
    mov ebx, 0
    mov ecx, 0
    mov edx, 0
    mov esi, 0
    mov edi, 0
    mov ebp, 0
    popad                   ; Restore seven values; skip the saved ESP slot.
; Inspect the seven original patterns again. SP has its entry value.
; MOV, PUSHAD and POPAD have left the incoming arithmetic flags and DF alone.
; The supplied wrapper adds RET after this body and then halts.
`;

const flagsExperiment = `bits 16
; Put this separate experiment in lesson.asm. No output helper is needed.
    pushfd                  ; Keep the caller's flags, including DF and IF.

    mov eax, 0
    cmp eax, 0              ; ZF=1, PF=1, CF=0, AF=0, SF=0, OF=0.
    stc                     ; Set CF=1 without changing the other flags.
    std                     ; Set DF=1. There are no string operations here.
    pushfd
    pop ebx                 ; EBX records the seeded flags image.

    pushfd                  ; Keep that seeded image for the inner restore.
    clc                     ; Clear CF.
    cld                     ; Clear DF.
    mov eax, 1
    add eax, 1              ; EAX=2; the six arithmetic status flags are zero.
    pushfd
    pop ecx                 ; ECX records the changed flags image.

    popfd                   ; Restore the seeded flags from the inner save.
    pushfd
    pop edx                 ; EDX records the restored image; EDX equals EBX.
    popfd                   ; Restore the caller's original flags and DF.
; EAX=2. EBX and EDX agree. ECX records the deliberately different state.
; Every save has been consumed, and IF has kept its incoming value throughout.
; The supplied wrapper adds RET, then CLI/HLT; use the snapshots for comparison.
`;

const slots = [
  ['EDI', '0x7BDE', '+0', '0x2468ACE0', 'Load EDI; advance SP by four'],
  ['ESI', '0x7BE2', '+4', '0x13579BDF', 'Load ESI; advance SP by four'],
  ['EBP', '0x7BE6', '+8', '0x0BADF00D', 'Load EBP; advance SP by four'],
  ['saved ESP', '0x7BEA', '+12', '0x00007BFE', 'Skip four bytes; keep following the current stack'],
  ['EBX', '0x7BEE', '+16', '0x55667788', 'Load EBX; advance SP by four'],
  ['EDX', '0x7BF2', '+20', '0xDDEEFF00', 'Load EDX; advance SP by four'],
  ['ECX', '0x7BF6', '+24', '0x99AABBCC', 'Load ECX; advance SP by four'],
  ['EAX', '0x7BFA', '+28', '0x11223344', 'Load EAX; advance SP to 0x7BFE'],
];

export const outputMechanicsSections = [
  {
    id: 'pushad-popad',
    title: 'Unpack PUSHAD and POPAD one stack slot at a time',
    paragraphs: [
      'Recall the stack chapter: a stack is ordinary RAM used with a last-in, first-out rule. A push reserves bytes below the current top and writes a copy there. A pop reads the top object and releases its bytes. In this real-mode lab, SS identifies the stack segment and SP gives its offset; the physical address is SS × 16 + SP. Released bytes can remain visible until another operation reuses them. The supplied startup has already made this memory usable before it calls your lesson.',
      'PUSHAD means push all double, and POPAD means pop all double. Here double refers to a doubleword: 32 bits, or four bytes. The A identifies the group of general-purpose registers. NASM also offers the word forms PUSHA and POPA, which save and consume two-byte entries under BITS 16. A word has 16 bits; a doubleword has 32. Our processor supports the wider register operations while continuing to execute in real mode. BITS 16 gives NASM the encoding defaults, and it emits an operand-size prefix for PUSHAD and POPAD.',
      'PUSHAD first remembers the original ESP value internally. It then saves EAX, ECX, EDX, EBX, that original ESP, EBP, ESI, and EDI, in that order. Each item occupies four bytes, so the complete block uses 8 × 4 = 32 bytes. The saved ESP describes the boundary before the first of these saves. By the time the instruction reaches the ESP slot, several other pushes have already moved the live stack pointer. Keeping the original value gives that slot a precise meaning.',
      'The last saved register, EDI, ends up at the lowest address and therefore at the new top. POPAD walks the block upward: restore EDI, restore ESI, restore EBP, skip the saved ESP slot, then restore EBX, EDX, ECX, and EAX. It consumes the skipped slot by advancing the stack pointer four bytes. It never assigns that slot to ESP. The ordinary pointer movement across all eight slots restores the entry boundary when the matching block is intact.',
      'For the worked layout, let SS=0 and ESP=0x00007BFE immediately before PUSHAD. Afterward SP=0x7BDE. The dword at 0x7BEA contains 0x00007BFE even though the current SP is 0x7BDE. When POPAD reaches that dword, it advances from 0x7BEA to 0x7BEE and continues with EBX. Finally SP reaches 0x7BFE. The two-byte return offset already stored at 0x7BFE has remained outside the 32-byte register block throughout.',
      'Neither PUSHAD nor POPAD changes the arithmetic flags or DF. Their register block contains no FLAGS image and no segment registers. If the code between them changes flags, restoring the general registers leaves those changed flags in place. Likewise, DS or ES must be protected separately when the interface requires them to survive. A pair also assumes the current stack still points to its own saved block: an unmatched push before POPAD shifts every restore to the wrong bytes.',
      'Run the experiment below as a complete replacement for lesson.asm. The distinct register patterns make swapped slots and lost upper halves easy to recognize. MOV clears the working registers without changing flags, which keeps this experiment focused on the register block. It makes no screen output. Open the workspace, choose Run, open Registers, and select the 32-bit display to inspect the complete EAX, EBX, ECX, EDX, ESI, EDI and EBP values. This display choice leaves BITS 16 and the CPU execution mode unchanged. Each register should have its seeded value again. Your lesson finishes with its entry SP, and the wrapper RET then releases its own return word before the final halt.',
    ],
    teaching: {
      goal: 'Explain every register slot consumed by PUSHAD and POPAD, including the original ESP snapshot.',
      bridge: 'Individual PUSH and POP operations let us protect one value. The printing helpers need a consistent way to protect several full-width register values together.',
      check: {
        prompt: 'PUSHAD begins at SP=0x7BFE and leaves SP=0x7BDE. When POPAD reaches the dword at 0x7BEA, what happens to the stored 0x00007BFE?',
        answer: 'That slot is skipped. The current SP advances from 0x7BEA to 0x7BEE so POPAD can continue with EBX. ESP does not receive the stored dword. The remaining restores eventually move SP back to 0x7BFE.',
      },
      takeaway: 'The saved block has a fixed layout: seven register restores plus one four-byte skip consume the eight dwords.',
      diagramAfter: 4,
    },
    aid: {
      kind: 'memory', title: 'The eight dwords in increasing address order',
      intro: 'Select a slot to follow POPAD upward from the new top. The original stack pointer is 0x00007BFE and SS is zero.',
      nodes: slots.map(([register, address, offset, value, action], index) => node(`slot-${index}`, `${address}: ${register}`, `${offset} from the new top`, `${action}. The saved value in this example is ${value}.`, [{ label: 'Width', value: '4 bytes' }, { label: 'Saved value', value }])),
      caption: 'PUSHAD creates these slots in the opposite order, starting with EAX. The existing near return offset begins at 0x7BFE, immediately above the final EAX slot.',
    },
    code: { language: 'asm', filename: 'lesson.asm', source: registerExperiment },
    deepDive: {
      title: 'Separate the live registers from their saved copies',
      paragraphs: [
        'PUSHAD leaves EAX, EBX, ECX, EDX, ESI, EDI, and EBP unchanged while writing their copies into RAM. The subsequent MOV instructions change the live registers. Their earlier copies remain available in the stack block until POPAD reads them. For example, EAX=0x11223344 is stored at addresses 0x7BFA through 0x7BFD as bytes 44 33 22 11. That little-endian byte order is independent of the ordering of the eight register slots.',
        'The skipped ESP slot also explains why POPAD cannot repair arbitrary stack-pointer damage. It begins reading wherever the current SS:SP points. If you abandon the original block or overwrite its contents, the instruction has no separate record of where your intended snapshot lives. Keep every extra temporary save balanced before consuming the block.',
      ],
      example: {
        title: 'Save, borrow, recover',
        intro: 'Use the exact register patterns in the runnable example and begin with SP=0x7BFE.',
        steps: [
          { title: 'Create the snapshot', explanation: 'PUSHAD writes eight dwords and leaves the original seven register values in place.', state: 'SP=7BDE; saved EAX at 7BFA is 11223344' },
          { title: 'Borrow the registers', explanation: 'Seven MOV instructions replace the live values with zero. The saved bytes and stack pointer stay unchanged.', state: 'Live EAX=00000000; saved EAX=11223344; SP=7BDE' },
          { title: 'Consume the saved block', explanation: 'POPAD restores EDI, ESI and EBP, advances over saved ESP, then restores EBX, EDX, ECX and EAX.', state: 'EAX=11223344; EBP=0BADF00D; SP=7BFE' },
          { title: 'Return through the older frame', explanation: 'The supplied near RET can now read the two-byte return offset left by the wrapper CALL.', state: 'SP=7C00 after the wrapper receives control' },
        ],
        conclusion: 'The register copies have served their lifetime. Their old bytes may remain in RAM, while SP once again exposes the caller continuation.',
      },
      pitfalls: [
        { title: 'Pairing PUSHAD with POPA', text: 'PUSHAD reserves 32 bytes. POPA consumes only 16 in this BITS 16 code, so it loads partial words and leaves half the block active. The following RET would encounter saved data instead of the intended continuation.' },
        { title: 'Using POP ESP for the skipped slot', text: 'Loading the saved pointer halfway through restoration would redirect later reads past the remaining saved registers. POPAD deliberately advances over that slot.' },
        { title: 'Expecting a saved result to survive', text: 'If your calculation changes EAX after PUSHAD, POPAD restores the old EAX. A function returning a new EAX value needs a preservation plan that leaves that result available.' },
      ],
      transfer: 'Change only the seeded EDI value to 0x10203040. Predict the four bytes at the new stack top and the EDI value after POPAD. The top bytes become 40 30 20 10, and EDI returns to 0x10203040.',
    },
    topics: [{
      id: 'register-save-layout', sectionId: 'pushad-popad', title: 'Read the whole register block at once',
      intro: ['The offsets below are byte distances from SP immediately after PUSHAD. Each row occupies four consecutive bytes.'],
      blocks: [
        { type: 'table', caption: 'PUSHAD layout and POPAD actions for entry ESP=0x00007BFE', columns: ['Saved item', 'Address', 'Offset', 'Value', 'POPAD action'], rows: slots },
        { type: 'prose', title: 'Derive an address from a slot number', paragraphs: ['Number the rows from zero at EDI. A row begins at the new top plus four times its row number. EAX is row seven, so its offset is 7 × 4 = 28 bytes. Its four bytes occupy offsets 28 through 31; offset 32 begins the older object above this block.'] },
        { type: 'steps', title: 'Move the same layout to another stack address', items: [
          { title: 'Choose the boundary before PUSHAD', text: 'For this separate paper trace, let SS=0 and SP=0x7000 immediately before PUSHAD. Subtract 32 bytes to find the new top, 0x6FE0.' },
          { title: 'Locate two different saved values', text: 'The saved ESP slot starts at 0x6FE0+12=0x6FEC and contains the original value 0x00007000. Saved EAX starts at 0x6FE0+28=0x6FFC. The slot address and the saved value answer different questions.' },
          { title: 'Check the full extent', text: 'The final EAX byte occupies 0x6FFF. POPAD consumes through that byte and leaves SP=0x7000. The slot offsets stayed constant while every absolute address moved.' },
        ] },
      ],
      references: [intel, nasm],
    }],
  },
  {
    id: 'pushfd-popfd',
    title: 'Save and restore the flags with PUSHFD and POPFD',
    paragraphs: [
      'A flag is a bit of processor state with a defined meaning. EFLAGS groups these bits into a 32-bit register; FLAGS names its lower 16-bit portion. Some bits describe a calculation, such as zero or carry. Others control later execution, such as the direction used by string instructions. A caller can still need these bits after a printing routine borrows registers and performs its own arithmetic.',
      'PUSHFD means push flags double, and POPFD means pop flags double. PUSHFD reserves four bytes at SS:SP and writes a flags image into them. An image is a copied bit pattern stored in ordinary memory. PUSHFD leaves the live arithmetic flags and DF unchanged. POPFD reads the four-byte image at the current top, releases those bytes, and applies the permitted bits to EFLAGS. It does not restore any general register. PUSHF and POPF use a two-byte image instead; keep the chosen widths consistent.',
      'Read the eight bits used by this chapter in the diagram. CF describes unsigned carry or borrow for addition and subtraction; OF describes signed overflow. ZF reports a zero result, SF copies the result sign bit, PF reports even parity in the low result byte, and AF records carry or borrow across the bit-3 boundary. DF chooses the direction in which string instructions move their pointers. IF controls maskable hardware interrupt delivery. The effect of each instruction on these bits matters: for example, MOV leaves them alone, ADD calculates status flags, and CLD changes DF.',
      'Suppose the meaningful low bits are CF=1, PF=1, ZF=1 and DF=1, while AF, SF, IF and OF are zero. With the usual reserved bit 1 set and the other bits zero for this paper example, the image is 0x00000447: 0x400 for DF, 0x40 for ZF, 0x4 for PF, 0x1 for CF, and 0x2 for the reserved bit. A PUSHFD starting at SP=0x7BFE moves SP to 0x7BFA and writes 47 04 00 00 at consecutive addresses. POPFD consumes those same four bytes in one operation.',
      'Saving before a change is essential. PUSHFD followed by CLD keeps a copy of the incoming DF and establishes DF=0 for the routine. CLD followed by PUSHFD can only save the already-cleared DF. Similarly, once CMP or ADD has replaced the arithmetic flags, a later save cannot recover the caller’s earlier comparison. At the other end, complete flag-changing cleanup before the final POPFD. An ADD SP instruction after restoration would immediately replace the restored arithmetic flags.',
      'The runnable experiment keeps two nested saves with separate purposes. The outer PUSHFD retains the caller environment. Inside it, CMP, STC and STD create a known set of status bits and DF; another PUSHFD retains that demonstration state. EBX records the seeded image, ECX records deliberately changed flags, and EDX records the image recovered by the inner POPFD. The final POPFD restores the original environment, including the incoming DF. No instruction in the experiment changes IF deliberately, and no string instruction or helper is called while DF is temporarily set.',
      'Open the workspace, choose Run, open Registers, and select the 32-bit display to inspect the three complete snapshots in EBX, ECX and EDX. The display width does not change BITS 16 or the CPU mode. EBX and EDX should agree. In both, masking with 0x00000CD5 selects the demonstrated status bits and DF and gives 0x00000445. The same mask on ECX gives zero after the ADD result of two. EAX remains two because restoring flags leaves its arithmetic result in place. IF, bit 9, has the incoming value in all three snapshots. Use the saved register values for this comparison: after the lesson returns, the supplied wrapper deliberately executes CLI before halting, so its final live IF can differ from the value restored by your last POPFD.',
      'These instructions obey architectural rules for control bits. PUSHFD stores RF and VM as zero in its image; POPFD cannot restore every possible EFLAGS bit from arbitrary data. In ordinary real mode it can restore the arithmetic flags, DF and IF used here, while RF, VM, VIF and VIP have special behavior. Protected and virtual-8086 execution add privilege rules, including restrictions on IF and the I/O privilege level. Our examples use the existing real-mode environment and preserve its image; they do not construct an arbitrary machine-control state.',
    ],
    teaching: {
      goal: 'Relate the bits of a flags image to four stack bytes and prove that the intended earlier state is restored.',
      bridge: 'PUSHAD protects the general-register values. The caller may also need the condition flags and direction flag that the helper is about to change.',
      check: {
        prompt: 'A caller enters with DF=1. A helper executes CLD, PUSHFD, performs its work, then POPFD. Which DF comes back, and how should the save be reordered?',
        answer: 'DF comes back as zero because the image was captured after CLD. Move PUSHFD before CLD so the saved image contains the incoming DF=1, and restore that image after the private work.',
      },
      takeaway: 'Capture the flags before private changes, keep track of the image’s four bytes, and restore it after flag-changing cleanup.',
      diagramAfter: 3,
    },
    aid: {
      kind: 'bits', title: 'The status and control bits these helpers preserve',
      intro: 'Bit positions count from zero at the least significant end. Select a flag to connect its name with the state that a caller may still need.',
      nodes: [
        node('cf', 'CF: carry', 'Bit 0; mask 0x001', 'For ADD and SUB, this bit reports an unsigned carry or borrow. STC sets CF and CLC clears it.'),
        node('pf', 'PF: parity', 'Bit 2; mask 0x004', 'PF is one when the low result byte has an even number of one bits. A zero byte has zero one bits, so it has even parity.'),
        node('af', 'AF: auxiliary carry', 'Bit 4; mask 0x010', 'For addition and subtraction, AF reports carry or borrow across the boundary between bits 3 and 4. It is relevant to decimal-adjust operations and still belongs to the saved status.'),
        node('zf', 'ZF: zero', 'Bit 6; mask 0x040', 'ZF is one when the operation’s result is zero. After CMP it lets JE test equality.'),
        node('sf', 'SF: sign', 'Bit 7; mask 0x080', 'SF copies the most significant bit of the result at the operation’s width. Signed branches interpret it together with other flags where required.'),
        node('if', 'IF: interrupt enable', 'Bit 9; mask 0x200', 'IF permits maskable hardware interrupts when set. Software INT instructions still execute with IF clear. This experiment keeps the incoming IF throughout its work.'),
        node('df', 'DF: direction', 'Bit 10; mask 0x400', 'String instructions advance their pointers when DF=0 and decrease them when DF=1. CLD clears it; STD sets it. Our helpers restore whichever direction their caller supplied.'),
        node('of', 'OF: overflow', 'Bit 11; mask 0x800', 'For addition and subtraction, OF identifies a signed result outside the representable range at the chosen width. It answers a different numerical question from CF.'),
      ],
      caption: 'These positions are part of EFLAGS. Other positions have separate control, reserved, or mode-dependent meanings, so keep an existing image when preserving the environment.',
    },
    code: { language: 'asm', filename: 'lesson.asm', source: flagsExperiment },
    deepDive: {
      title: 'Trace two saved flag images without mixing their owners',
      paragraphs: [
        'PUSHFD followed immediately by POP EBX transfers the flags image to EBX and balances that temporary stack use. Ordinary POP EBX changes the destination and stack pointer without applying the image to EFLAGS. PUSHFD followed by POPFD instead restores the flag register. The object stored on the stack is the same kind of dword; the consuming instruction decides where its bits go.',
        'Use CMP EAX,0 after MOV EAX,0 to obtain defined arithmetic flags for this experiment. XOR EAX,EAX would also clear EAX, but its AF result is architecturally undefined. CMP avoids making a prediction about an undefined flag. When ADD later computes 1+1, its result is two: there is no carry, auxiliary carry, signed overflow, sign bit or zero result, and the low byte has odd parity.',
      ],
      example: {
        title: 'Snapshots and stack depth in the runnable experiment',
        intro: 'Assume the lesson begins at SP=0x7BFE. IF retains its input value, and the masks below select arithmetic status plus DF only.',
        steps: [
          { title: 'Retain the outer environment', explanation: 'The first PUSHFD saves the caller image. No other operation will consume that image until the last POPFD.', state: 'SP=7BFA; outer image at 7BFA' },
          { title: 'Seed and record the demonstration flags', explanation: 'CMP produces ZF=PF=1 and clears the other arithmetic flags. STC sets CF; STD sets DF. PUSHFD / POP EBX captures this image without leaving an extra slot active.', state: 'SP=7BFA; EBX & 00000CD5 = 00000445' },
          { title: 'Keep the inner image and make a change', explanation: 'A second lasting PUSHFD takes SP to 0x7BF6. CLC, CLD and ADD produce the changed state. PUSHFD / POP ECX records it and returns SP to 0x7BF6.', state: 'EAX=00000002; ECX & 00000CD5 = 00000000' },
          { title: 'Recover the inner image', explanation: 'POPFD releases the slot at 0x7BF6 and restores the seeded flags. PUSHFD / POP EDX captures their restored image.', state: 'SP=7BFA; EDX=EBX; CF=PF=ZF=DF=1' },
          { title: 'Recover the original environment', explanation: 'The final POPFD consumes the outer image and returns the flags to the incoming state. The experiment’s register snapshots remain available for inspection.', state: 'SP=7BFE; entry DF and IF restored; EAX=2' },
        ],
        conclusion: 'The inner restore demonstrates the mechanism. The outer restore makes the experiment return with the caller’s flag environment intact.',
      },
      flowchart: {
        title: 'A save belongs to the state captured at that instant',
        intro: 'Every arrow is executed once; the two restoration steps consume different saved images.',
        nodes: [
          { id: 'outer', label: 'Save incoming FLAGS', detail: 'PUSHFD reserves the outer four-byte image.' },
          { id: 'seed', label: 'Seed CF, PF, ZF and DF', detail: 'CMP, STC and STD establish the state recorded in EBX.' },
          { id: 'inner', label: 'Save the seeded image', detail: 'A second lasting PUSHFD creates the inner four-byte image.' },
          { id: 'change', label: 'Change the flags', detail: 'CLC, CLD and ADD create the state recorded in ECX.' },
          { id: 'restore', label: 'Restore the inner image', detail: 'POPFD restores the seeded flags; record them in EDX and compare EDX with EBX.' },
          { id: 'return', label: 'Restore incoming FLAGS', kind: 'terminal', detail: 'The final POPFD consumes the outer image. The lesson may now return with its entry DF and IF.' },
        ],
        edges: [{ from: 'outer', to: 'seed' }, { from: 'seed', to: 'inner' }, { from: 'inner', to: 'change' }, { from: 'change', to: 'restore' }, { from: 'restore', to: 'return' }],
        caption: 'The short PUSHFD / POP-register observation pairs are balanced within these steps and leave the two lasting saves undisturbed.',
      },
      pitfalls: [
        { title: 'Restoring the wrong object', text: 'After PUSHFD followed by PUSHAD, the register block lies on top of the flags image. POPAD must consume that block before POPFD can reach the intended flags. Reversing these restores loads unrelated register bits as control state and shifts later reads.' },
        { title: 'Mixing PUSHFD and POPF widths', text: 'The first instruction reserves four bytes and the second consumes two in this BITS 16 program. Two bytes remain active. Even if several low flags look right, the return offset is no longer at the top.' },
        { title: 'Changing flags after the final restore', text: 'Instructions such as ADD SP,4 perform arithmetic and overwrite status flags. Release arithmetic-managed storage before the final POPFD; plain MOV and the matching register POP instructions leave the restored arithmetic flags alone.' },
      ],
      transfer: 'Change ADD EAX,1 to ADD EAX,0xFFFFFFFF after the existing MOV EAX,1. The result becomes zero with CF=PF=AF=ZF=1, SF=OF=0 and DF=0. Predict ECX masked by 0xCD5 as 0x55; the unchanged inner restore should still make EDX equal EBX.',
    },
    topics: [{
      id: 'flags-image-bytes', sectionId: 'pushfd-popfd', title: 'Follow one flags image through four memory bytes',
      intro: ['For this isolated layout, start at SS=0, SP=0x7BFE and use EFLAGS image 0x00000447. The runnable experiment keeps IF and other environment bits from its caller, so its full image can contain additional set bits.'],
      blocks: [{ type: 'table', caption: 'PUSHFD stores the least significant byte at the new top', columns: ['Address', 'Byte', 'Part of the image', 'Meaning in this example'], rows: [
        ['0x7BFA', '47', 'Bits 7..0', 'ZF, PF, CF and reserved bit 1 are set'],
        ['0x7BFB', '04', 'Bits 15..8', 'DF is set; IF and OF are clear'],
        ['0x7BFC', '00', 'Bits 23..16', 'Zero in this chosen image'],
        ['0x7BFD', '00', 'Bits 31..24', 'Zero in this chosen image'],
        ['0x7BFE', 'Existing return word', 'Outside the image', 'POPFD exposes this word again by restoring SP=0x7BFE'],
      ] },
      { type: 'prose', title: 'Turn selected bit positions into a mask', paragraphs: ['A one-bit mask for position n has numeric value 2 to the power n. Combine the masks for CF, PF, AF, ZF, SF, DF and OF: 0x001 + 0x004 + 0x010 + 0x040 + 0x080 + 0x400 + 0x800 = 0xCD5. These positions are distinct, so addition and bitwise OR give the same combined mask.'] },
      { type: 'steps', title: 'Decode the captured images', items: [
        { title: 'Select the bits deliberately varied', text: 'AND the recorded EBX image with 0xCD5 on paper or in a calculator. The seeded CF, PF, ZF and DF contribute 0x001+0x004+0x040+0x400=0x445. Apply the same mask to EDX and expect the same result.' },
        { title: 'Decode the changed image', text: 'The selected bits in ECX are zero after ADD computes two with DF clear. Other bits, such as reserved bit 1, can still be set in the full register value.' },
        { title: 'Check IF separately', text: 'Mask each image with 0x200. Each result is zero if incoming IF was clear, or 0x200 if it was set. Keeping IF outside 0xCD5 lets the arithmetic experiment have the same expected masked result in either environment.' },
      ] }],
      references: [intel, { label: 'Intel basic architecture', url: 'https://cdrdv2-public.intel.com/819711/253665-sdm-vol-1.pdf', section: 'EFLAGS register and flag-control instructions' }, nasm],
    }],
  },
];
