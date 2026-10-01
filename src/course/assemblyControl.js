import { bootProgram } from './assemblyPrograms';

const intel = { title: 'Intel SDM: Volume 1 architecture and Volume 2 instruction reference', url: 'https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html' };
const nasmSyntax = { title: 'NASM: operands, effective addresses, constants, and expressions', url: 'https://www.nasm.us/doc/nasm03.html' };
const nasmDirectives = { title: 'NASM: BITS and assembler directives', url: 'https://www.nasm.us/doc/nasm08.html' };
const asm = (filename, source) => ({ language: 'asm', filename, source });
const stackExample = bootProgram(`    mov ax, 0x1234
    push ax
    mov ax, 0x5678
    push ax
    pop bx
    pop ax
    call print_hex16
    mov al, ' '
    call putc
    mov ax, bx
    call print_hex16`);
const stackStarter = bootProgram(`    mov ax, 0x1122
    push ax
    mov ax, 0x3344
    push ax
    ; TODO: restore the first value to AX, the second to BX.
    pop ax
    pop bx
    call print_hex16
    mov al, ' '
    call putc
    mov ax, bx
    call print_hex16`);
const stackSolution = stackStarter.replace('    pop ax\n    pop bx', '    pop bx\n    pop ax');

const callsExample = bootProgram(`    mov ax, 3
    mov bx, 4
    call .sum
    call print_hex16
    jmp .finished
.sum:
    add ax, bx
    ret
.finished:`);
const callsStarter = bootProgram(`    mov bx, 0xbeef
    push word 7
    push word 6
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
    mov bx, [bp+4] ; TODO: read the second argument.
    add ax, bx
    pop bx
    pop bp
    ret
.finished:`);
const callsSolution = callsStarter.replace('mov bx, [bp+4] ; TODO: read the second argument.', 'mov bx, [bp+6] ; Second argument; preserve caller BX.');

const bitsExample = bootProgram(`    mov ax, 0x00a5
    and ax, 0x000f
    or ax, 0x0010
    xor ax, 0x0003
    call print_hex16`);
const bitsStarter = bootProgram(`    mov ax, 0x01d3
    shr ax, 4
    and ax, 0x000f
    call print_hex16
    mov al, ' '
    call putc
    mov ax, -9
    shr ax, 1 ; TODO: preserve the signed meaning of AX.
    call print_hex16
    mov al, ' '
    call putc
    mov ax, 1000
    xor dx, dx
    mov bx, 64
    div bx
    call print_hex16
    mov al, ' '
    call putc
    mov ax, dx
    call print_hex16`);
const bitsSolution = bitsStarter.replace('shr ax, 1 ; TODO: preserve the signed meaning of AX.', 'sar ax, 1 ; Signed arithmetic shift: -9 becomes -5.');

const debugExample = bootProgram(`    mov si, message
    call puts`, 'message: db "TRACE OK", 0');
const debugStarter = bootProgram(`    mov si, message
.next:
    lodsb
    test al, al
    jz .finished
    mov ah, 0x0f ; TODO: select the service that prints AL.
    mov bx, 0x0007
    int 0x10
    jmp .next
.finished:`, 'message: db "OS READY", 0');
const debugSolution = debugStarter.replace('mov ah, 0x0f ; TODO: select the service that prints AL.', 'mov ah, 0x0e ; BIOS teletype output.');

export const assemblyControl = [
  {
    id: 'A09', slug: 'assembly-stack', title: 'The stack is memory with a moving boundary',
    subtitle: 'Learn how the stack saves temporary values, why their order matters, and how a routine returns safely.',
    phase: 'x86 Assembly', minutes: 100,
    prerequisites: ['Read hexadecimal addresses and little-endian words', 'Distinguish a register value from memory at an address', 'Follow conditional branches and register changes'],
    outcomes: ['Draw a byte-accurate stack trace using SS and SP', 'Balance temporary storage across every control-flow path', 'Explain why a POP does not erase memory', 'Keep operand width separate from stack-address width', 'Use BP to inspect a frame without changing its ownership'],
    sections: [
      {
        id: 'ownership', title: "Why a program needs a stack",
        paragraphs: [
  "Suppose a calculation needs AX, but AX already contains a value you will need later. You could choose a spare memory address for the old value. With several nested calculations, though, keeping track of all those addresses becomes awkward. A stack gives us a simple rule: add a temporary value at one end, then remove the most recently added value first. The memory itself is ordinary RAM; the rule and a stack pointer make it a stack.",
  "On our 16-bit path, SS chooses the stack segment and SP marks the current top. PUSH makes room below SP and writes a value into that room. POP reads the top value and moves SP back up. Notice what grows downward: the addresses used for new values. Existing values stay at their original addresses. We will draw those addresses explicitly so that “top” does not depend on which way a diagram is drawn.",
  "There is already one value on the stack when your lesson begins. The setup code starts with SP = 0x7c00 and calls lesson. That call saves a two-byte return address, leaving SP = 0x7bfe. Your temporary values must go below that saved address. When your instructions finish, restoring SP to its entry value lets the supplied return instruction find its way back. For now the lab supplies this small memory region; later you will choose and protect a kernel stack yourself."
], teaching: {
  "goal": "Explain where a saved value goes and what the stack pointer tells you.",
  "bridge": "You can already read and write memory. Now we need a convenient way to keep temporary values while other work happens.",
  "check": {
    "prompt": "A lesson starts at SP = 0x7bfe. You save one word, do some work, and restore that word. Where must SP be immediately before the lesson returns, and what lives there?",
    "answer": "SP must be back at 0x7bfe. The word there is the return address saved by the setup code. Restoring the pointer makes that existing word the next value consumed by RET."
  },
  "takeaway": "The stack pointer marks a boundary in memory; balanced temporary work returns it to the caller’s boundary.",
  "diagramAfter": 2
},
        callout: { title: 'Your starting point in the lab', text: 'The setup has already made SS, DS, and ES zero, cleared DF, and called your lesson. That call leaves SP at 0x7bfe. Printing helpers return with your general registers and FLAGS restored, though they use extra stack space while running.' }
      },
      {
        id: 'push-bytes', title: 'Walk one PUSH at byte granularity',
        paragraphs: [
  "Start with SP = 0x7bfe and AX = 0x2468. In this lesson, PUSH AX saves a two-byte word. First subtract two from SP: the new top is 0x7bfc. Then place AX at that address. x86 stores the low byte first, so 0x7bfc receives 0x68 and 0x7bfd receives 0x24. AX itself is unchanged. We now have two copies of the value: one in a register and one in memory.",
  "Imagine replacing AX with 0x1357 and pushing again. SP becomes 0x7bfa. Reading upward through memory now gives bytes 57 13 68 24. The newest word is at the lowest address. The earlier saved word and the caller’s return address have not moved. This is why a useful drawing includes addresses alongside values; a list of values alone hides which one POP will read next.",
  "Trace a push using three entries: the old SP, the new SP, and the exact addresses written. At your first stack checkpoint, save the value that the lab supplies, temporarily overwrite its register, and recover it afterward. The important relationship is between the incoming value and the saved copy. Once you can explain one saved word, a second word will introduce the ordering rule."
], teaching: {
  "goal": "Calculate both the new stack pointer and the bytes written by PUSH.",
  "bridge": "We know why the stack exists. Let us follow one value into it, byte by byte.",
  "check": {
    "prompt": "With SS = 0 and SP = 0x7000, you push AX = 0xCAFE as a word. Give the new SP and the two stored bytes in increasing address order.",
    "answer": "SP becomes 0x6ffe. Address 0x6ffe contains FE and address 0x6fff contains CA. The processor stores the low byte at the lower address and leaves AX unchanged."
  },
  "takeaway": "For a word push, reserve two bytes first, then write the word at the new top.",
  "diagramAfter": 2
}, code: asm('two-words.asm', stackExample)
      },
      {
        id: 'pop-bytes', title: 'POP releases bytes; it does not scrub them',
        paragraphs: [
  "Continue the previous example: the newest word is 0x1357 at SP = 0x7bfa, and the older word 0x2468 lies just above it. POP BX reads 0x1357 into BX, then advances SP by two. POP AX reads the next word, 0x2468, and advances SP again. We have recovered the two values and returned SP to 0x7bfe. This order is called last in, first out.",
  "The destination register determines where the recovered value goes. If we use POP AX followed by POP BX instead, the same words leave the stack in the same order, but they end up in different registers. Stack balance and value ordering are therefore two separate questions. A program can return safely and still print the values in the wrong order.",
  "For these register-destination POP instructions, no old stack byte is erased. SP simply moves past it. A later call or push may reuse that address. Keeping a pointer to a popped temporary is therefore unreliable even if a debugger still shows its old bytes. You will meet the same idea in C when we discuss why a function cannot return a usable pointer to one of its expired local variables."
], teaching: {
  "goal": "Recover saved values in the right order and explain what happens to their old memory bytes.",
  "bridge": "PUSH gave us a saved copy. POP lets us bring that copy back into a register.",
  "check": {
    "prompt": "Push the words 10, 20, and 30, in that order. Then pop into DX, BX, and AX. Which value reaches each register? Does POP clear the old memory?",
    "answer": "DX receives 30, BX receives 20, and AX receives 10. Each register POP advances SP after reading its word; it does not clear the old memory bytes. Those bytes can now be reused."
  },
  "takeaway": "Removing a stack value changes its lifetime and the pointer, not necessarily the bytes left in RAM.",
  "diagramAfter": 2
}
      },
      {
        id: 'width', title: 'Count bytes, not the number of stack instructions',
        paragraphs: [
  "So far every saved value has been a word. The operand tells you how much space an instruction uses: PUSH AX saves two bytes, while PUSH EAX saves four on the i386-compatible processor used here. In a 16-bit program, NASM can encode the wider operation with a size override. The processor remains in real mode; the saved value simply has a different width.",
  "Try the accounting before trying the code. PUSH EAX takes SP from 0x7bfe to 0x7bfa. POP AX then consumes only two bytes, leaving SP = 0x7bfc. There has been one push and one pop, but two bytes are still active on the stack. If RET runs now, it will take those leftover bytes as its return offset. The eventual symptom may look like a bad jump, even though the first mistake was mismatched storage sizes.",
  "Operand width and stack-address width are separate. In this ordinary real-mode environment, SP still supplies the stack offset even for a four-byte operand. Also distinguish the width of an immediate in an instruction encoding from the width pushed: a compact immediate may be sign-extended into a word. Use the listing to inspect encodings, and use byte counts to check stack layout. We will choose stack descriptors and alignment explicitly when we enter protected mode."
], teaching: {
  "goal": "Check stack balance by counting bytes rather than instructions.",
  "bridge": "The push/pop pattern is familiar. We now need to include the width of each saved value.",
  "check": {
    "prompt": "Starting from SP = 0x7200, a routine pushes one dword and one word, then pops two words. What is SP, and how much space remains to release?",
    "answer": "The pushes reserve six bytes and the pops release four. SP is 0x71fe, two bytes below its starting value. Two more bytes must be released before the original top is restored."
  },
  "takeaway": "Matching the number of pushes and pops is useful only when their byte widths also match.",
  "diagramAfter": 2
},
        code: asm('mixed-width-observation.asm', bootProgram(`    mov eax, 0x12345678
    push eax
    pop ax
    call print_hex16
    mov al, ' '
    call putc
    pop bx
    mov ax, bx
    call print_hex16`))
      },
      {
        id: 'segments', title: 'SS:SP is an address, and BP usually selects SS',
        paragraphs: [
  "SP tells us an offset, while SS supplies the stack segment. For the real-mode addresses in this course, combine them as SS × 16 + SP. If SS is 0x1800 and SP is 0x0100, the stack top is at physical 0x18100. With SS = 0 the arithmetic looks simpler, but it is the same operation. Writing both parts in a trace keeps a hidden assumption from becoming a debugging puzzle later.",
  "The BP register is especially useful for reading stack memory. A classic 16-bit effective address involving BP normally uses SS. An address based on BX or SI normally uses DS. Thus MOV AX, [BP] and MOV AX, [BX] can read different physical locations even when BP and BX contain the same number. Our early lab sets DS and SS to zero, which makes this distinction easy to overlook.",
  "Classic 16-bit addressing has no bare [SP] form. To inspect a stack slot, we can use BP as a temporary reference. But saving the caller’s BP with PUSH BP creates another word on the stack. If we then copy SP into BP, [BP] refers to that saved BP, and the previously topmost word is at [BP+2]. This small example is the beginning of a stack frame: name a stable reference, then derive each offset from actual bytes."
], teaching: {
  "goal": "Turn a stack offset into an address and choose a legal operand for reading it.",
  "bridge": "The stack is still memory, so the addressing rules from earlier chapters still apply.",
  "check": {
    "prompt": "DS = 0x1000, SS = 0x1800, and BX = BP = 0x20. Which physical address does [BX] use, and which does [BP] use?",
    "answer": "[BX] uses DS, giving 0x10020. [BP] uses SS, giving 0x18020. Equal offset values do not imply equal physical addresses when the default segments differ."
  },
  "takeaway": "A memory operand selects both an offset calculation and a segment.",
  "diagramAfter": 2
}
      },
      {
        id: 'frame', title: 'Build a frame that has a stable ruler',
        paragraphs: [
  "Imagine a routine that needs two local words and also calls other routines. SP will move as the work proceeds. We can keep a stable reference by saving the old BP and then copying SP into BP. The sequence PUSH BP followed by MOV BP, SP makes [BP] the saved caller BP. In our 16-bit near-call layout, [BP+2] is the return offset. These meanings follow from the sequence we just performed.",
  "Now reserve four bytes by subtracting four from SP. The two local words occupy [BP-2] and [BP-4]. From lesson entry SP = 0x7bfe, saving BP gives BP = 0x7bfc; reserving locals gives SP = 0x7bf8. The first local is at 0x7bfa and the second at 0x7bf8. A later balanced call can temporarily move SP without changing these BP-relative addresses.",
  "To finish, move SP back to BP, then pop the saved BP. The first operation releases the local area; the second restores the caller’s register and leaves the return address on top. Releasing locals does not copy their values anywhere. If a value must survive the call, put it in an agreed result register or longer-lived storage before releasing the frame. BP is a ruler we maintain with instructions, not a special object the CPU builds automatically."
], teaching: {
  "goal": "Build a stable map of saved state and local variables around BP.",
  "bridge": "A moving SP is good for adding values. A stable reference makes several existing values easier to find.",
  "check": {
    "prompt": "After a word-sized PUSH BP and MOV BP,SP, you reserve six local bytes. Where are the three local words relative to BP, and does allocating them move BP?",
    "answer": "The local words are at BP-2, BP-4, and BP-6. The allocation moves SP down by six, while BP stays fixed. That stable reference is why the offsets remain useful during later stack operations."
  },
  "takeaway": "Derive frame offsets from the layout you built; BP only remains useful while you keep it stable.",
  "diagramAfter": 2
}, code: asm('local-frame.asm', bootProgram(`    push bp
    mov bp, sp
    sub sp, 4
    mov word [bp-2], 0x55aa
    mov ax, [bp-2]
    call print_hex16
    mov sp, bp
    pop bp`))
      },
      {
        id: 'balance', title: 'Every exit path must repay the same stack debt',
        paragraphs: [
  "Suppose a routine saves BX, checks an input, and branches to an error exit. If the ordinary path restores BX but the error exit goes straight to RET, the saved BX is still on top. RET does exactly what it is designed to do: it consumes that word as an instruction offset. The CPU has no label on the word saying “saved register.” Our instructions must leave the right kind of value in the right place.",
  "Use a running byte count to understand the paths. Start at zero when the routine enters. A word push changes the count to -2; six local bytes take it to -8; releasing the locals returns it to -2; the matching pop returns it to zero. Every path reaching RET should have restored its entry depth. At a branch merge, also check what the remaining slots mean: equal depth alone does not guarantee the same values occupy them.",
  "A shared cleanup label often makes this easier to read. Each outcome prepares its result and then reaches the same local release and register restoration. When you try a deliberately broken version, predict which word RET will consume before running. The experiment then teaches a cause and effect, rather than merely producing an unexplained blank screen. Keep your working version available while trying the variation."
], teaching: {
  "goal": "Follow stack cleanup through both sides of a branch.",
  "bridge": "A straight-line trace is only the beginning. A function must also return correctly when it takes another path.",
  "check": {
    "prompt": "A routine saves BX and CX. One exit pops only CX before RET. Which saved value becomes the attempted return address, and why?",
    "answer": "Saved BX is now at the top. Popping CX released the newest word, but the older BX word still lies above the real return address. RET therefore consumes BX’s saved bits as its destination."
  },
  "takeaway": "For every return path, account for both stack depth and the meaning of the topmost word.",
  "diagramAfter": 2
}
      },
      {
        id: 'observation', title: 'Observe stack values without invalidating the experiment',
        paragraphs: [
  "Printing is itself a call, and calls use the stack. This matters if the quantity you want to print is SP. To observe SP before a helper begins, first copy it into a register with MOV AX, SP, then call print_hex16. The helper prints the saved snapshot in AX. It does not somehow print the changing value of SP inside its own execution.",
  "For example, capture the lesson-entry SP and print it. Next push a word, capture SP again, and print that new snapshot. You should see a two-byte decrease between the snapshots. During each printing call the stack temporarily grows further, but the helper restores it before returning. Separate three things in your drawing: the current pointer, the earlier pointer value copied into AX, and any memory slot containing another saved copy.",
  "Our teaching helpers preserve general registers and FLAGS so they are convenient observation tools. An arbitrary routine or BIOS service may preserve less. When you insert a diagnostic call, ask which values the surrounding code still needs. This habit becomes particularly useful between CMP and a conditional jump: a helper that changes flags can accidentally change the very branch you are investigating."
], teaching: {
  "goal": "Observe a stack value at the moment you actually want to measure.",
  "bridge": "Our trace predicts stack movement. Now let us choose observations that correspond to the trace.",
  "check": {
    "prompt": "SP is 0x7100. You copy it into AX, then push BX, then call a preserving print_hex16 helper. Which pointer value is printed?",
    "answer": "The helper prints 0x7100, the earlier snapshot in AX. SP had already moved to 0x70fe before the call and moves again temporarily during the call. Copying a value does not create a live link to its source."
  },
  "takeaway": "A diagnostic prints the state you captured, which may differ from the state at the moment of printing.",
  "diagramAfter": 2
}, code: asm('capture-stack-pointer.asm', bootProgram(`    mov ax, sp
    call print_hex16
    push ax
    mov al, ' '
    call putc
    mov ax, sp
    call print_hex16
    pop ax`))
      },
      {
        id: 'limits', title: 'A correct tiny trace still needs capacity bounds',
        paragraphs: [
  "A staircase can take you back to its starting floor and still travel a long way before returning. Stack use has a similar distinction. A recursive routine may restore every byte correctly as it returns, yet run out of space while it is still descending into more calls. To estimate capacity, count the frames that are alive at the same time, including saved registers, local storage, and return addresses.",
  "Suppose each additional call needs a two-byte return offset, a two-byte saved BP, and four bytes of locals. Each active level adds eight bytes. Ten such levels need eighty bytes, before counting their caller or any temporary printing work. Interrupts can create further frames while existing ones are still live. A depth estimate must therefore state which calls and asynchronous events can occur together.",
  "Our small lab uses shallow calls in a reserved region below the boot sector. Later, paging will let us leave an unmapped guard page beside a kernel stack so an overrun can fault near its cause. Handling that fault still needs a usable stack of its own. For now, make the maximum intended depth part of your explanation and use bounded experiments. A correct return path and a sufficient memory region are both necessary."
], teaching: {
  "goal": "Estimate how much stack a nested operation needs, even when every call is balanced.",
  "bridge": "Restoring the stack proves we can finish cleanly. We must also have enough room to reach that finish.",
  "check": {
    "prompt": "A routine adds twelve bytes for each active recursive call, including its return address. How much do five simultaneous levels use, and why does eventual cleanup not reduce that peak?",
    "answer": "They use sixty bytes simultaneously. Cleanup happens while calls return, after the deepest point has already been reached. Capacity must cover the peak active depth, not just the zero net use at the end."
  },
  "takeaway": "Stack balance describes the end of an operation; stack capacity must cover its busiest moment.",
  "diagramAfter": 2
}
      },
      {
        id: 'practice', title: "Bring the stack ideas together",
        paragraphs: [
  "The chapter checkpoints build one experiment in stages. First recover one saved value, then observe two values coming back in reverse order, and finally choose destinations that let you display the original order. Keep the actual saved values flowing through memory and registers. The display should follow from that data movement; a literal replacement would leave the central idea unexplained.",
  "Before editing the final stage, draw the incoming return address, then add a row for each word you push. Read your drawing from the current top to predict each pop. Only after choosing the destination registers should you decide which register to present to the printing helper first. This separates the stack’s removal order from your program’s display order.",
  "After the checkpoint passes, try three different words in the playground. Restore them into three registers and print them in the order they originally arrived. Then add a branch that sometimes skips one print, while still restoring all saved values. Explain where both paths meet and why the next return is safe. You have now learned the storage mechanism that makes nested procedures possible."
], teaching: {
  "goal": "Use your stack drawing to restore values in the order the caller needs.",
  "bridge": "You can now explain stack addresses, widths, and cleanup. Let us use those ideas in one small program.",
  "check": {
    "prompt": "You push A, then B, then C, but want to display A first. Must you change the stack’s removal order? Describe another approach.",
    "answer": "The removal order remains C, B, A. Pop into separate registers or other suitable storage, then choose to display the register holding A first. Storage order and presentation order can be arranged separately."
  },
  "takeaway": "A trace lets you separate storing, recovering, displaying, and cleaning up values.",
  "diagramAfter": 2
}
      }
    ],
    lab: 'boot',
    assembly: { example: stackExample, starter: stackStarter, solution: stackSolution, expectedOutput: '1122 3344', title: 'Recover values in the intended order', instructions: 'Keep both pushes. Change the POP destinations so AX recovers 0x1122 and BX recovers 0x3344, then print both through the supplied helpers. Preserve the wrapper return address and entry SP.', hints: ['The last word pushed is the first word popped.', 'The second pushed value belongs in BX; the first belongs in AX.', 'Immediately before the wrapper RET, SP must again be 0x7bfe.'], question: { prompt: 'What is SP immediately after the two word pushes, before either POP or helper call? Enter hex or decimal.', answer: 0x7bfa, explanation: 'The wrapper CALL makes entry SP 0x7bfe. Two 16-bit pushes subtract four more bytes: 0x7bfa.' } },
    challenge: { title: 'Make the stack trace agree with the machine', brief: 'Repair the same complete BIOS program used by the Assembly challenge. Preserve the two pushed values and prove balanced stack ownership.', language: 'asm', starter: stackStarter, solution: stackSolution, tasks: ['Draw every byte from 0x7bfa through 0x7bff after both pushes.', 'Repair the POP destinations and run until VGA shows 1122 3344.', 'Explain why POP does not erase the previous stack contents.', 'Extend the program to three values and keep both sides of a conditional branch balanced.'], hints: ['Read from the newest stack slot first.', 'Two pushes own four bytes below the entry pointer.', 'The wrapper return address is an existing caller-owned word.'], explanation: 'POP BX recovers 0x3344 first; POP AX then recovers 0x1122. Both words are released, leaving SP at 0x7bfe. The helpers print actual register values while preserving the caller state promised by their interface.', checks: ['The original pushes are retained and real VGA output is correct.', 'The trace includes little-endian byte order and the wrapper return word.', 'The minimum pointer before observation is 0x7bfa.', 'Every path restores SP to its lesson-entry value.'] },
    reflection: { prompt: 'A teammate proves that a routine executes one PUSH and one POP and concludes that it cannot damage the stack. Construct two counterexamples and describe the stronger proof you would require.', rubric: ['Distinguishes number of operations from operand widths', 'Considers branches or incorrect value destinations', 'Explains caller-owned return data', 'States a byte-level invariant at every return'], modelAnswer: 'PUSH EAX followed by POP AX has a net two-byte allocation in this 16-bit stack environment. A conditional path can skip the POP entirely. Even balanced operations can restore the wrong saved register. I would track byte deltas and slot meanings along every control-flow path, show agreement at merges, and prove that the caller return word and required saved registers are intact at RET. Capacity of the deepest call chain is a separate proof.' },
    sources: [intel, nasmSyntax, nasmDirectives],
    nextBuild: 'Use the same stack accounting to explain how CALL can remember a continuation and how arguments become stable frame offsets.'
  },
  {
    id: 'A10', slug: 'assembly-calls', title: 'Calls, returns, and agreements between routines',
    subtitle: 'Follow a call out and back, pass values to a routine, and learn the agreement that lets C and assembly work together.',
    phase: 'x86 Assembly', minutes: 115,
    prerequisites: ['Trace 16-bit PUSH and POP at byte granularity', 'Read BP-relative stack operands', 'Follow branches without confusing a label with a stored pointer'],
    outcomes: ['Trace near CALL and RET through nested routines', 'Separate instruction semantics from a calling convention', 'Pass arguments through registers and stack slots', 'Preserve caller-owned registers and clean arguments exactly once', 'Translate a 16-bit teaching frame into the ideas behind 32-bit cdecl'],
    sections: [
      {
        id: 'continuation', title: "How a routine remembers where to return",
        paragraphs: [
  "Imagine reading an explanation that asks you to look at a diagram, then return to the next sentence. You need to remember where to continue. A near CALL does this for code: it pushes the offset of the instruction immediately after itself, then transfers execution to another location in the same code segment. That saved offset is the return address. A 16-bit near RET reads the word at the top of the stack into IP, the instruction pointer, and releases the word.",
  "Follow two calls in our lab. The setup code begins with SP = 0x7c00 and calls lesson, leaving its return address at 0x7bfe. If lesson immediately calls a second routine, another return address appears at 0x7bfc. The inner RET consumes this newer word and resumes lesson with SP = 0x7bfe. Later, lesson returns using the older word. Draw both saved offsets separately: each belongs to a different unfinished call.",
  "A JMP changes execution location without saving this continuation. Replacing CALL with JMP therefore changes the stack layout that the destination receives. If that destination later executes RET, it consumes whatever word is already at the top. The processor does not search for a matching function name. CALL and RET cooperate through the bytes we leave on the stack, which is why our previous work on stack balance matters."
], teaching: {
  "goal": "Trace where a routine returns and how two nested calls keep their places.",
  "bridge": "The stack can save a value while other work happens. A call uses that same mechanism to save a place in the program.",
  "check": {
    "prompt": "A three-byte near CALL begins at offset 0x2000. Which offset must it save so the caller can continue? Why would saving 0x2000 be wrong?",
    "answer": "It saves 0x2003, the first byte after the call. Returning to 0x2000 would execute the call again instead of continuing with the caller’s next instruction."
  },
  "takeaway": "Each call saves its own continuation; a return uses the continuation currently at the top.",
  "diagramAfter": 2
}
      },
      {
        id: 'direct-call', title: "Give a small routine an input and a result",
        paragraphs: [
  "Suppose AX contains 8 and BX contains 5. We can agree that a small addition routine reads these two registers and returns their sum in AX. After the call, AX is 13 and BX is still 5. This agreement is the routine’s interface: inputs in AX and BX, result in AX, BX preserved, arithmetic flags changed. CALL itself does not choose any of those registers; it only provides the control transfer and return address.",
  "The displayed example uses its own numbers to show the complete flow. At the checkpoint, the lab supplies the input registers before your instructions begin, so use those incoming values rather than replacing them with the example’s constants. Write your routine, call it, then print the returned AX through the supplied helper. When a local routine sits later in the same lesson body, normal execution must jump around it after the call has finished. Otherwise the CPU can fall into its body again and reach RET with the wrong return address on top.",
  "NASM labels beginning with a dot are local to the preceding non-local label. This lets us give the routine and the continuation clear names within lesson. Now change the reasoning example to AX = 0xffff and BX = 1. A word-sized addition returns zero because only sixteen result bits fit; carry records the unsigned overflow. The interface must tell its caller whether to use just AX or also a status flag. Printing a value is an observation of that interface, not a substitute for computing it."
], teaching: {
  "goal": "Describe a small routine in terms of its inputs, result, and control flow.",
  "bridge": "We can now leave the main flow and come back. Let us give the called routine a useful job.",
  "check": {
    "prompt": "A routine returns the sum in AX and preserves BX. With AX = 12 and BX = 9 at entry, what should the caller observe? What would printing a literal 21 fail to demonstrate?",
    "answer": "The caller should observe AX = 21 and BX = 9. Printing a literal might match this one display, but it would not demonstrate that the routine reads its arguments or returns a result that changes when the inputs change."
  },
  "takeaway": "An interface explains how information enters and leaves a routine.",
  "diagramAfter": 2
}, code: asm('register-call.asm', callsExample)
      },
      {
        id: 'call-encoding', title: 'A destination and a saved return address are different numbers',
        paragraphs: [
  "A label tells the assembler where a routine is located. For a direct near call, the instruction often stores a relative displacement: the signed distance from the end of the call instruction to the destination. The CPU adds that distance to the next instruction offset. It also saves that next offset on the stack. One number chooses where to go; the other remembers where to come back.",
  "Take a three-byte call beginning at offset 0x1000 and targeting 0x1010. The following instruction starts at 0x1003. Subtract 0x1003 from 0x1010 to obtain the displacement 0x000d. The encoding stores that displacement as bytes 0d 00, while the stack receives the return offset 0x1003. If you inspect the listing and the stack, you should therefore expect different numbers. Their difference is part of how the instruction works.",
  "Use labels when writing the program so NASM can recalculate the displacement as instructions move. An indirect near CALL can instead take its destination from a register or memory, while still saving a return offset. A far call changes more state and has a different frame and return instruction. Our current trace concerns a word-sized near call within one code segment; we will expand that model when segment and privilege changes become necessary."
], teaching: {
  "goal": "Distinguish a CALL instruction’s displacement from the return offset it saves.",
  "bridge": "We understand the call at source level. Now we can connect its labels to the actual bytes.",
  "check": {
    "prompt": "A three-byte near CALL begins at 0x2400 and targets 0x2413. Calculate its displacement and saved return offset.",
    "answer": "The next instruction is at 0x2403. The displacement is 0x2413 − 0x2403 = 0x0010, while the saved return offset is 0x2403. RET uses the saved offset, not the displacement."
  },
  "takeaway": "Calculate a relative destination from the end of the instruction; save that same end as the continuation.",
  "diagramAfter": 2
}
      },
      {
        id: 'register-contract', title: 'Decide who must preserve each register',
        paragraphs: [
  "Suppose a caller keeps a loop counter in CX and calls a routine that also wants to use CX. Without an agreement, the two pieces of code can silently destroy each other’s work. A calling convention solves this by assigning responsibility. A caller-saved register may change during the call, so the caller saves any value it still needs. A callee-saved register must be restored by the called routine if it uses that register.",
  "A result register has a reason to change: it carries the answer back. In our addition interface, AX carries the result while BX is promised unchanged. The routine may leave BX alone or save its incoming value, use BX temporarily, and restore the saved value before every return. Preserving BX means preserving whatever the caller supplied. Loading one familiar constant before returning would only appear correct for a caller that happened to use that constant.",
  "The lab’s printing helpers deliberately preserve general registers and FLAGS to make experiments easier to observe. Most interfaces promise less, so read each routine’s agreement rather than extending that helper behavior to all calls. Test preservation with several recognizable incoming values and with inputs that reach different exits. Later, the compiler’s application binary interface, or ABI, will formalize these agreements across separately compiled C and assembly files."
], teaching: {
  "goal": "Choose who is responsible for a register value that must survive a call.",
  "bridge": "A routine needs temporary working space. Its caller may still need some of the registers it already holds.",
  "check": {
    "prompt": "CX is caller-saved. Your loop needs CX after calling a routine that may change it. Who should protect it? How would the answer change if CX were callee-saved?",
    "answer": "With a caller-saved convention, the loop’s caller code must save its needed CX value before the call and recover it afterward. With a callee-saved convention, the called routine must return with the incoming CX restored on every exit."
  },
  "takeaway": "Register preservation is a shared agreement about responsibility, not an automatic effect of CALL.",
  "diagramAfter": 2
}
      },
      {
        id: 'arguments', title: "Find arguments by drawing their slots",
        paragraphs: [
  "Let us design a word-sized sum(a, b). The caller pushes b first, then a, and calls the routine. At callee entry, the newest word is the return address, followed by a and then b at increasing addresses. Why push in that order? It gives the first argument a predictable position nearest the return address. The processor does not know the argument names; the caller and callee agree on their order.",
  "Now save the caller’s BP with PUSH BP and copy SP into BP. Starting from this new reference, [BP] contains saved BP, [BP+2] contains the return offset, [BP+4] contains a, and [BP+6] contains b. Each step advances by two because every item here is a word. Draw four boxes before memorizing any offset. Saving BX afterward moves SP down again but does not move BP, so those positive argument offsets remain correct.",
  "For a separate example, pass a = 9 and b = 2. If the callee accidentally reads [BP+4] twice, it computes 18 instead of 11. The program can return normally and still be wrong because it read the wrong slot. At the checkpoint, take the supplied argument values through this layout and identify each actual memory read. That turns an offset repair into an explanation of how information reaches the calculation."
], teaching: {
  "goal": "Locate two stack arguments by deriving their offsets from the saved frame.",
  "bridge": "Registers are convenient arguments, but a routine may need more inputs. The stack gives us another way to pass them.",
  "check": {
    "prompt": "After PUSH BP and MOV BP,SP, a word argument is at BP+4. The callee then pushes CX and DX. Does that argument move to BP+8? Explain.",
    "answer": "No. The pushes move SP and write below the frame, while BP remains fixed. The argument stays at BP+4. Its offset would change only if we changed the reference register or built a different original frame."
  },
  "takeaway": "A stable frame pointer makes argument locations independent of later balanced pushes.",
  "diagramAfter": 2
}, code: asm('two-stack-arguments.asm', callsStarter)
      },
      {
        id: 'cleanup', title: 'Arguments need exactly one cleanup owner',
        paragraphs: [
  "Imagine the caller begins at SP = 0x7000. Two word arguments take it to 0x6ffc, and the call places its return address at 0x6ffa. After the callee has restored any saved registers, its plain RET removes that return word. Execution resumes in the caller with SP = 0x6ffc. The argument words are still there. Releasing four argument bytes restores SP to 0x7000.",
  "Our teaching convention gives this cleanup job to the caller, which performs ADD SP, 4 after the call. That instruction changes the stack pointer, not the result in AX, and it does not erase the old memory. Another convention could use RET 4 in the callee: it returns and then releases four additional bytes. Both approaches can work, but the caller and callee must choose the same agreement. Cleaning twice moves past the caller’s original top; cleaning neither leaves argument data where a later return may expect a continuation.",
  "There is one more interaction to notice. ADD SP, 4 changes arithmetic flags. If the sum routine leaves carry as an additional result, ordinary caller cleanup can overwrite it before a branch reads it. Decide how a status result will survive: capture it first or use an agreed register or memory location. This is why a calling convention needs to describe the whole boundary, including the instructions immediately around a call."
], teaching: {
  "goal": "Explain what RET removes and who releases the remaining arguments.",
  "bridge": "The callee can now read its arguments. We must also return the caller’s stack to its starting shape.",
  "check": {
    "prompt": "A caller pushes three word arguments. The callee uses plain RET and restores its own saved registers. How many argument bytes must the caller release? Would RET 6 plus the same caller cleanup be correct?",
    "answer": "The caller must release six bytes. If the callee instead used RET 6, those six argument bytes would already have been released; another six-byte cleanup would go past the caller’s starting stack top."
  },
  "takeaway": "Every stack allocation needs one cleanup owner, and the cleanup must preserve any result still needed.",
  "diagramAfter": 2
}
      },
      {
        id: 'frames-locals', title: 'Separate parameters, saved registers, and local storage',
        paragraphs: [
  "A local variable is temporary storage belonging to one active call. Begin with saved BP at [BP] and the return offset at [BP+2]. If we next push BX, its saved value occupies [BP-2]. Reserving another word with SUB SP, 2 creates a local at [BP-4]. Negative offsets are therefore not automatically unused space. Their meaning comes from the order in which we built the frame.",
  "Suppose we store an intermediate result at [BP-2] by mistake. The arithmetic may finish correctly, but POP BX later restores that intermediate result instead of the caller’s original BX. To clean up this layout correctly, release the local word, recover BX, recover BP, then return. Moving SP directly to BP discards both the local and the saved BX slot; it does not copy the saved value back into BX. A shorter-looking cleanup sequence still needs to restore every promised register.",
  "A nested call uses additional stack space below the current top. It can use a pointer to one of our locals while our frame is still alive, if that is part of the interface. Once our routine returns, the local’s storage can be reused by another call. Returning its address does not extend its lifetime. This connects the bytes in today’s stack drawing to the rules that later make C pointers safe or unsafe."
], teaching: {
  "goal": "Keep local variables separate from saved registers and arguments.",
  "bridge": "Our frame contains arguments and saved state. A routine can reserve extra space for work that lasts only during this call.",
  "check": {
    "prompt": "Your frame saves BX at BP-2 and reserves a local word at BP-4. A nested call returns with balanced stack use. Must the local’s BP-relative address change?",
    "answer": "No. Balanced nested work occurs below the current SP, and BP still identifies the same frame. The local remains at BP-4 while this caller’s frame is alive, provided the callee respects the agreed memory and register preservation rules."
  },
  "takeaway": "Name every slot before using it: arguments, saved registers, and locals have different jobs.",
  "diagramAfter": 2
}
      },
      {
        id: 'cdecl', title: 'Translate the frame into a 32-bit C interface',
        paragraphs: [
  "Consider a C declaration for a function taking two ordinary unsigned integers and returning their sum. On the i386 System V path, these arguments are passed on the stack, EAX returns the integer result, and the caller releases the arguments. EBX, ESI, EDI, and EBP must survive the call. EAX, ECX, and EDX can change. These rules let a C file call an assembly file without either author reading the other’s implementation.",
  "The same frame drawing now uses four-byte slots. A conventional PUSH EBP followed by MOV EBP, ESP gives saved EBP at [EBP], a four-byte return address at [EBP+4], and the first two arguments at [EBP+8] and [EBP+12]. The sample below is an ELF32 object-file routine for a protected-mode C build. It is not a boot sector. Assemble it as ELF32 and link it with a compatible C caller; changing BITS alone would not create the required CPU environment.",
  "At this boundary, the exact target ABI also defines stack alignment and the direction flag. Modern i386 System V code normally aligns the stack to sixteen bytes before a call; the pushed return address changes the alignment seen at entry. Keep DF clear as required when crossing the C boundary. As you add wider or floating-point arguments, structures, or variadic functions, consult their additional ABI rules. A useful next experiment is to compile a tiny matching C function and compare its generated frame with your drawing."
], teaching: {
  "goal": "Recompute the frame when moving from a 16-bit teaching routine to a 32-bit C interface.",
  "bridge": "Our small convention shows why callers and callees need an agreement. A compiler ABI supplies one for an entire target platform.",
  "check": {
    "prompt": "A conventional 32-bit frame has a four-byte saved EBP and a four-byte return address. Where does its first stack argument begin, and why does the 16-bit offset not carry over?",
    "answer": "It begins at EBP+8. The saved EBP occupies offsets 0–3 and the return address occupies 4–7. In the teaching 16-bit frame each of those items occupied two bytes, so the corresponding first argument began at BP+4."
  },
  "takeaway": "An ABI turns byte widths, register roles, and alignment into a shared interface.",
  "diagramAfter": 2
}, code: asm('sum32.asm — ELF32 unit, not a boot image', `bits 32
section .text
global sum32
; C declaration: unsigned sum32(unsigned a, unsigned b);
sum32:
    push ebp
    mov ebp, esp
    mov eax, [ebp+8]
    add eax, [ebp+12]
    pop ebp
    ret
`)
      },
      {
        id: 'interrupts', title: "Why an interrupt needs a different return",
        paragraphs: [
  "Our printing helpers eventually ask BIOS for a service through INT. In ordinary real mode, this entry saves FLAGS, CS, and IP so the service can later restore both the execution location and its flags. With word-sized entries, the most recently saved IP lies at the current stack top, followed by CS and FLAGS. Compare those three words with the single return offset saved by a near CALL.",
  "IRET consumes the interrupt frame, restoring the instruction offset, code segment, and flags. A plain near RET only consumes one offset. Substituting RET could appear to jump toward a plausible instruction, but it leaves the other saved words and the wrong machine state behind. When a helper calls BIOS, the active stack may therefore contain the helper’s normal call return, its saved registers, and a BIOS interrupt frame at the same time.",
  "Draw each frame with the operation that created it and the operation that will consume it. Later, protected-mode exceptions may also supply error codes, and a privilege change can switch stacks and save additional state. We will add those cases when we build the IDT. The idea you can use now is simple: a return instruction is correct only for the frame shape its entry mechanism produced."
], teaching: {
  "goal": "Match the return instruction to the kind of frame that created it.",
  "bridge": "An ordinary call saves a continuation. An interrupt must remember more of the interrupted machine state.",
  "check": {
    "prompt": "A real-mode BIOS service has IP, CS, and FLAGS saved on entry. Why is popping only IP insufficient even if execution reaches a familiar address?",
    "answer": "The saved CS and FLAGS still need restoring, and their words must be removed from the frame. Restoring only IP leaves an incomplete machine state and the wrong stack top. IRET consumes the complete interrupt frame in its required order."
  },
  "takeaway": "Choose a return by understanding its entry frame, not by the name given to the routine.",
  "diagramAfter": 2
}
      },
      {
        id: 'practice', title: "Put the whole calling agreement into practice",
        paragraphs: [
  "Your final routine receives two stack arguments and returns their word-sized sum. The caller also keeps a recognizable value in BX so we can observe whether the callee preserves it. Start by drawing the arguments, return address, saved BP, and saved BX. Then use that drawing to choose the two argument reads. The actual inputs may vary during checking, so your result and restored BX must come from the incoming state.",
  "Before running, explain the path back to the caller. Which instruction releases each saved register? Which one consumes the return offset? Which caller instruction releases the arguments? Once this account is complete, use the displayed sum and preservation value to compare prediction with execution. A correct sum alone would miss a damaged BX; a preserved BX alone would miss reading the same argument twice.",
  "For an independent experiment, use inputs whose mathematical sum exceeds 0xffff and predict the returned low word. If you want to report overflow as well, decide how that status survives cleanup before editing the routine. Finally, keep a working copy and deliberately omit argument cleanup in the playground. Trace the first word that the outer return would consume. Explaining that failure is evidence that you understand the agreement, even before you run the broken variant."
], teaching: {
  "goal": "Build a small procedure whose result, preservation, and stack cleanup all agree with its interface.",
  "bridge": "We have learned each part of a call separately. The chapter task now brings the parts together.",
  "check": {
    "prompt": "A sum routine works for several inputs but always restores BX by loading one constant. Has it satisfied a callee-saved BX contract? Design a better check.",
    "answer": "No. It must restore the BX value present on each call, whatever that value is. Call it with two different recognizable BX values, including a path that exercises any early exit, and compare the returned BX with its corresponding entry value."
  },
  "takeaway": "Test a procedure’s result, preserved state, and cleanup as separate parts of one agreement.",
  "diagramAfter": 2
}
      }
    ], lab: 'boot',
    assembly: { example: callsExample, starter: callsStarter, solution: callsSolution, expectedOutput: '000D BEEF', title: 'Repair a stack-argument contract', instructions: 'The caller passes 6 and 7 and expects BX to stay 0xbeef. Repair the callee so the VGA display is 000D BEEF. Keep the saved registers, plain RET, and caller-owned argument cleanup.', hints: ['The caller pushes the second argument before the first.', 'After PUSH BP: saved BP is +0, return IP is +2, first argument is +4.', 'The extra PUSH BX moves SP, but does not move BP or its positive argument offsets.'], question: { prompt: 'After PUSH BP / MOV BP,SP, how many bytes above BP is the second 16-bit argument?', answer: 6, explanation: 'Saved BP uses offsets 0–1, the return IP uses 2–3, and the first argument uses 4–5. The second begins at +6.' } },
    challenge: { title: 'Prove a call boundary', brief: 'Repair the complete runnable program, then diagram its stack at caller entry, callee entry, after the prologue, and after cleanup.', language: 'asm', starter: callsStarter, solution: callsSolution, tasks: ['Repair the second argument load and obtain 000D BEEF.', 'Mark every return address, argument, and saved register in a byte-level frame.', 'Explain which code owns argument cleanup.', 'Run an alternate input pair and describe overflow without changing the calling convention.'], hints: ['The return address is inserted after both argument pushes.', 'BP anchors the frame before BX is saved.', 'RET and ADD SP,4 have separate cleanup jobs.'], explanation: 'The second operand is at [BP+6], not [BP+4]. Saving BX permits its temporary use while preserving the caller sentinel. POP BX and POP BP undo the prologue; RET removes the continuation; ADD SP,4 removes the two caller-owned arguments.', checks: ['Actual VGA output contains the sum and unchanged sentinel.', 'Frame offsets derive from slot widths rather than memorization.', 'Arguments are released exactly once.', 'The explanation distinguishes near RET, far returns, and IRET.'] },
    reflection: { prompt: 'Your assembly sum routine works in the real-mode lab. A teammate changes BITS 16 to BITS 32 and links it to C without changing any offsets or prologue. Review the failure modes and describe a valid migration plan.', rubric: ['Separates emitted instruction mode from CPU state', 'Recomputes frame widths and argument offsets', 'Specifies saved registers, result register, and cleanup owner', 'Includes target ABI and stack alignment'], modelAnswer: 'BITS changes encoding defaults, not the CPU execution environment. A real 32-bit C bridge needs a protected-mode entry and a compatible ELF32 target. A conventional four-byte EBP frame places arguments at +8 and +12. The routine must satisfy the target ABI’s callee-saved registers, EAX result convention, caller cleanup, stack alignment, and DF requirement. I would compare compiler-generated code for the exact declaration, link a small caller, and test both results and preservation sentinels.' },
    sources: [intel, nasmSyntax, nasmDirectives, { title: 'i386 System V ABI source and specification', url: 'https://gitlab.com/x86-psABIs/i386-ABI' }],
    nextBuild: 'Use explicit register contracts while manipulating bit fields and multi-register arithmetic results.'
  },
  {
    id: 'A11', slug: 'assembly-bits', title: 'Bit fields, shifts, and wider arithmetic',
    subtitle: 'Read and change selected bits, predict shifts, and understand why multiplication and division use two registers.',
    phase: 'x86 Assembly', minutes: 125,
    prerequisites: ['Convert between binary, hexadecimal, and signed two’s-complement values', 'Use flags for conditional branches', 'Understand register-width and helper-preservation contracts'],
    outcomes: ['Extract and update fields without damaging neighboring bits', 'Distinguish TEST from destructive AND', 'Predict logical shifts, arithmetic shifts, and rotations', 'Prepare AX or DX:AX for unsigned and signed division', 'Detect invalid divisions before relying on an exception handler'],
    sections: [
      {
        id: 'fields', title: "Read several meanings from one word",
        paragraphs: [
  "Suppose a device description needs a mode number, four yes-or-no flags, and another small value. It can store all of them in one 16-bit word by assigning each a range of bits. Such a range is a bit field. The processor still sees ordinary bits; the format gives those bits meaning. This is common in page-table entries, disk metadata, and device control words, so we need to learn how to read one field without accidentally changing or including its neighbors.",
  "Number positions from bit 0 at the least significant end. A mask is a pattern whose selected positions are one and whose other positions are zero. Consider the worked word 0x6B92. Its bits 7 through 4 contain the field 9, while the low nibble contains 2 and the upper byte contains 0x6B. Applying mask 0x00F0 keeps the desired positions, producing 0x0090. The field’s numerical value is still shifted left four positions; moving it down by four produces 0x0009. Isolating a position and obtaining the unshifted value are two separate steps.",
  "Hexadecimal helps because each digit corresponds to four bits, but a field can start or end between hex digits too. Write its width and low-bit position before constructing a mask. For example, a three-bit field beginning at bit 5 uses positions 5, 6, and 7 and can encode values 0 through 7. The bit-field diagram shows how meanings share a word. If that word is stored in memory, little-endian byte order is a separate question about which byte occupies the lower address; it does not renumber the significance of bits within the value."
], teaching: {
  "goal": "Identify a field’s bit positions and extract its numerical value without confusing position with value.",
  "bridge": "You can already read register values. We will now treat selected groups of their bits as separate pieces of information.",
  "check": {
    "prompt": "The word is 0xCA76, and you want bits 7 through 4 as an ordinary small integer. What value remains after masking, what is the final extracted value, and which operation is still needed between those two answers?",
    "answer": "Masking with 0x00F0 leaves 0x0070. The field value is 7, so the isolated pattern must be shifted right four positions to become 0x0007. Treating 0x70 as the field value would be off by a factor of sixteen."
  },
  "takeaway": "Extracting a field means selecting its bits and then moving their value to the expected position.",
  "diagramAfter": 2
}
      },
      {
        id: 'logic', title: "Choose whether to clear, set, or toggle a bit",
        paragraphs: [
  "Start with one destination bit rather than a whole hexadecimal word. AND keeps a bit only when both input bits are one: a zero mask bit clears the destination, while a one mask bit preserves it. OR sets a destination bit wherever the mask has a one and preserves it wherever the mask has a zero. XOR toggles the destination wherever the mask has a one. Once these four input combinations make sense for one position, applying the operation to a word is sixteen independent copies of the same rule.",
  "Trace a worked sequence on 0x00B6. AND with 0x000F keeps the low nibble, leaving 0x0006. OR with 0x0020 sets bit 5, producing 0x0026. XOR with 0x0003 flips bits 1 and 0, giving 0x0025. Predict each intermediate value, not only the final one. Setting and toggling differ particularly on repeated calls: OR with a bit mask leaves an already-set bit set, while applying XOR with that mask twice restores the original bit. Choose the operation from the intended behavior, such as “enable” or “invert,” rather than from a familiar mnemonic.",
  "These instructions also change flags. CF and OF become zero; SF, ZF, and PF reflect the result; AF is undefined. Thus XOR AX, AX produces zero and establishes new flags, whereas MOV AX, 0 preserves the old flags. If a nearby branch is supposed to use a previous comparison, inserting a logical operation can change its meaning even when the register value looks harmless. Practice by choosing a word with neighboring bits already set, then check that your chosen mask changes only the intended positions."
], teaching: {
  "goal": "Predict AND, OR, and XOR one bit at a time and account for their flag effects.",
  "bridge": "A mask identifies the positions we care about. The logical instruction decides what happens to each selected bit.",
  "check": {
    "prompt": "AX starts at 0x0048. Predict two consecutive applications of OR AX, 0x0008, then separately two consecutive applications of XOR AX, 0x0008. Which sequence implements “ensure bit 3 is enabled”?",
    "answer": "OR leaves AX at 0x0048 after both applications because bit 3 was already one. XOR first clears that bit, giving 0x0040, then sets it again, restoring 0x0048. OR implements the enable request; XOR implements a change of state each time."
  },
  "takeaway": "AND clears or preserves, OR sets or preserves, and XOR toggles or preserves; their flag writes are part of the operation.",
  "diagramAfter": 2
}, code: asm('three-mask-operations.asm', bitsExample)
      },
      {
        id: 'test', title: "Ask about bits without overwriting the value",
        paragraphs: [
  "Suppose AX holds a packed device state and you want to know whether one permission bit is set. AND can isolate that bit, but storing the result in AX destroys every neighboring field. TEST performs the same bitwise AND for its flag effects and discards the numerical result, leaving both operands unchanged. A following JZ checks whether the masked result was zero; JNZ checks whether it was nonzero. The branch reads the flags established by TEST, while AX still contains the complete state.",
  "A multi-bit mask changes the question. With mask 0x0012, TEST asks whether any of bits 4 and 1 are present. Input 0x0010 passes that “any” test even though bit 1 is absent. To ask whether both are present, isolate the selected bits in a temporary register and compare the temporary value with the full mask. To ask whether neither is present, TEST followed by a zero check is enough. Write the intended predicate as a sentence before choosing a branch; a nonzero masked value is not evidence that every selected bit is one.",
  "Preserving the data does not mean preserving the flags. Like AND, TEST clears CF and OF and derives SF, ZF, and PF from its temporary result; AF is undefined. Keep the deciding branch close enough that you can identify which instruction last wrote its flags. Practice with three inputs: one containing only the first selected bit, one containing both, and one containing neither. Those cases explain the difference between any and all more clearly than repeatedly testing a value that satisfies both."
], teaching: {
  "goal": "Distinguish “any,” “all,” and “none” predicates while preserving the packed word.",
  "bridge": "Logical instructions can update a word. Often we only want to make a decision about it and keep the original for later use.",
  "check": {
    "prompt": "The mask is 0x0024 and the input is 0x0020. Predict the “any selected bit,” “all selected bits,” and “no selected bits” answers. Does TEST change the input word?",
    "answer": "“Any” is true because bit 5 is selected and set. “All” is false because selected bit 2 is clear. “None” is false because the masked result is nonzero. TEST leaves the input word intact and reports the temporary AND through flags."
  },
  "takeaway": "TEST preserves the word while establishing a predicate; define whether that predicate means any, all, or none.",
  "diagramAfter": 2
}, code: asm('test-does-not-store.asm', bootProgram(`    mov ax, 0x0004
    test ax, 0x0005
    jz .none
    mov al, 'Y'
    jmp .show
.none:
    mov al, 'N'
.show:
    call putc`))
      },
      {
        id: 'replace-field', title: "Replace one field while preserving its neighbors",
        paragraphs: [
  "Imagine bits 7 through 4 contain a mode value that must change from 0xB to 3. Simply OR-ing the new value over the old one will not work: OR can set bits, but it cannot remove the old one bits. Replacement has three conceptual steps. Clear the destination field, make sure the candidate value fits the field, then position and merge that candidate. Every position outside the field should emerge unchanged.",
  "Use 0xD6B9 as an independent worked example. Clearing bits 7 through 4 leaves 0xD609. The new four-bit value 3 becomes 0x0030 when shifted into that field. Combining the cleared word with the positioned value gives 0xD639. The upper byte 0xD6 and the low nibble 9 survive. The diagram walks through the same mechanism using its own values; compare which regions remain fixed in both examples. A good test starts with nonzero neighbors so an overly broad clearing mask cannot hide.",
  "Decide what an out-of-range candidate means before using a mask on it. A four-bit field can hold 0 through 15. Masking candidate 0x13 down to four bits inserts 3; that is a truncation policy. If the interface instead requires rejecting 0x13, check the range before modifying the destination. The instruction sequence should implement that choice rather than accidentally make it.",
  "These examples operate on CPU registers and ordinary RAM. A memory-mapped device register may have bits that clear when written as one, reads that acknowledge events, or required access widths. A read-modify-write sequence that preserves a mathematical bit pattern can still perform the wrong device operation. Before applying this technique to hardware, read the register’s access rules and identify which writes the device actually accepts."
], teaching: {
  "goal": "Explain why replacing a field requires clearing its old bits before merging the positioned new value.",
  "bridge": "We can inspect a field. Now we will change its value without changing the other meanings packed into the word.",
  "check": {
    "prompt": "You replace bits 7 through 4 of 0x82F5 with 1. What final word should result? Why would OR-ing 0x0010 directly into the original word fail?",
    "answer": "The final word should be 0x8215. Direct OR leaves the old field at 0xF because its bits are already set; OR cannot clear them. Clearing the field first permits the new value 1 to replace rather than accumulate with the old value."
  },
  "takeaway": "Field replacement clears old state, applies a defined input-range policy, and merges only the new field bits.",
  "diagramAfter": 2
}, code: asm('replace-a-nibble.asm', bootProgram(`    mov ax, 0x01d3
    mov bx, 2
    and ax, 0xff0f
    and bx, 0x000f
    shl bx, 4
    or ax, bx
    call print_hex16`))
      },
      {
        id: 'shifts', title: "Move bits while choosing what enters the empty positions",
        paragraphs: [
  "SHL moves each bit toward a higher-numbered position and inserts zeros at the low end. SHR moves bits toward lower positions and inserts zeros at the high end. SAR also moves right, but fills new high positions with copies of the original sign bit. The operand width stays fixed, so bits that leave the register are no longer part of its stored value. Calling a left shift “multiply by two” is useful only when you also account for the value range and the loss of high bits.",
  "Take the 16-bit pattern 0xFFED, which represents signed −19. A logical right shift by one gives 0x7FF6, because a zero enters the high position. An arithmetic right shift gives 0xFFF6, which represents −10. Repeating the sign bit keeps a negative two’s-complement interpretation, but a negative odd value rounds downward toward negative infinity. Signed division of −19 by 2 instead gives quotient −9 and remainder −1, because IDIV truncates the quotient toward zero. The diagram uses another negative odd input to show the same difference.",
  "For a one-bit shift, CF receives the bit shifted out, and SF, ZF, and PF describe the resulting value. OF has an operation-specific rule for a count of one: SAR clears it, SHR uses the original high bit, and SHL compares the new high bit with the bit shifted out. Do not extend these one-bit overflow rules to larger counts. An effective count of zero does not change the operand or flags. Before replacing arithmetic with a shift, state the signedness, accepted range, and rounding rule you need; the same bits can support different numerical interpretations."
], teaching: {
  "goal": "Predict SHL, SHR, and SAR and explain why arithmetic right shift can differ from signed division.",
  "bridge": "Field extraction used a shift to move positions. We will now examine the information a shift discards and how it fills the vacated bits.",
  "check": {
    "prompt": "AX represents −7 as 0xFFF9. Predict SHR AX, 1, SAR AX, 1, and signed division by 2. Explain the difference between the two signed results.",
    "answer": "SHR gives 0x7FFC, a positive pattern. SAR gives 0xFFFC, or −4. Signed division gives quotient −3 and remainder −1. SAR rounds the negative odd value downward, while IDIV truncates toward zero; both preserve different intended numerical rules."
  },
  "takeaway": "A shift specifies movement and fill bits; its arithmetic meaning also depends on width, signedness, and rounding.",
  "diagramAfter": 2
}
      },
      {
        id: 'counts-rotates', title: "Interpret the count before predicting the result",
        paragraphs: [
  "For the i386-or-later machine used here, counts for these 16-bit and 32-bit shift operands are masked to five bits. The effective count is count AND 31. Consequently a requested count of 32 becomes zero, while 33 becomes one. This differs from the original 8086 behavior. Apply the count rule before moving any bits: SHL AX, CL with CL=32 leaves AX unchanged and does not establish new flags, even though an imagined thirty-two-step shift would have discarded every original bit.",
  "Now consider large nonzero effective counts on a 16-bit operand. Shifting AX=1 left by 16 produces a zero word, but the carry flag for SHL or SHR is undefined when the count is at least the operand width. OF is defined only for a one-bit shift; it is undefined for larger nonzero counts. Undefined means your program cannot rely on one result, even if the emulator repeatedly displays that value. Keep a result column and a separate flag-guarantee column when predicting counts 0, 1, 15, 16, and 32.",
  "A rotate handles the departing bit differently. ROL wraps a high bit back to the low end, while ROR wraps a low bit to the high end. For a byte, rotating 10000101 left by one gives 00001011. The high one wraps around instead of disappearing. Rotates do not update SF, ZF, or PF, so a following JZ still sees an earlier zero flag. Through-carry rotates RCL and RCR add CF to the rotation ring and have their own count details; do not apply a plain shift’s interpretation to them. Practice first with one-bit rotates, drawing the returning bit explicitly."
], teaching: {
  "goal": "Apply i386 count masking and distinguish discarded bits from bits that rotate back into the operand.",
  "bridge": "A one-bit shift is straightforward. Larger counts introduce architecture rules that a mathematical sketch alone does not capture.",
  "check": {
    "prompt": "On this i386-class machine AX=0x0003 and CL=33 before SHL AX, CL. What effective count and result do you predict? If CL were 32 instead, would ZF be recomputed from AX?",
    "answer": "33 AND 31 is 1, so the result is 0x0006. With CL=32 the effective count is zero: AX remains 0x0003 and ZF remains whatever it was before the instruction. A zero-count shift does not perform a new zero test."
  },
  "takeaway": "Compute the architectural count first, and distinguish a defined register result from flags the instruction leaves unchanged or undefined.",
  "diagramAfter": 2
}
      },
      {
        id: 'multiply', title: "Keep both halves when a product grows wider",
        paragraphs: [
  "A product of two 16-bit unsigned values can require 32 bits. The one-operand instruction MUL with a 16-bit source therefore uses AX as an implicit input and returns the full product in DX:AX. The colon means concatenation: DX supplies the upper sixteen bits and AX the lower sixteen. Numerically, the pair represents DX × 65536 + AX. It does not mean adding the two register values or treating DX as an unrelated scratch result.",
  "For a worked example, 400 × 200 is 80000, or 0x00013880. MUL returns DX=0x0001 and AX=0x3880. Reading only AX would report 14464 and lose the upper contribution of 65536. A program that deliberately wants a result modulo 65536 may choose the low half, but a size calculation or full product needs the missing information. If you print both halves, preserve the low half before moving the high half into the formatter’s AX input, and check what the printing helper promises to preserve.",
  "Unsigned MUL sets CF and OF when the high half is nonzero and clears them when it is zero; other arithmetic status flags are undefined. Signed IMUL has several forms. Its one-operand form also gives a double-width result, but overflow asks whether the complete product fits the signed low-half range—that is, whether the high half is just the low half’s sign extension. Two- and three-operand IMUL retain a single-width destination and report signed overflow through CF and OF. Read the operand form as part of the instruction, then choose a value near its boundary to test your explanation."
], teaching: {
  "goal": "Read the complete DX:AX product and interpret overflow according to the multiplication form.",
  "bridge": "Shifts showed how a fixed-width destination can lose bits. Multiplication provides forms that explicitly preserve a wider result.",
  "check": {
    "prompt": "Unsigned multiplication produces DX=0x0002 and AX=0x0010. What complete decimal product does the pair represent, and are CF and OF set for MUL?",
    "answer": "The complete product is 2 × 65536 + 16 = 131088. The upper half is nonzero, so unsigned MUL sets CF and OF. Printing only AX would show 16 and discard nearly the entire result."
  },
  "takeaway": "A double-width product is one number split across two registers; overflow meaning depends on the signedness and instruction form.",
  "diagramAfter": 2
}, code: asm('wide-product.asm', bootProgram(`    mov ax, 300
    mov bx, 300
    mul bx
    mov bx, ax
    mov ax, dx
    call print_hex16
    mov al, ' '
    call putc
    mov ax, bx
    call print_hex16`))
      },
      {
        id: 'divide', title: "Prepare the whole dividend before unsigned division",
        paragraphs: [
  "For DIV with a 16-bit divisor, the dividend is the entire unsigned pair DX:AX. The quotient replaces AX and the remainder replaces DX. If the intended dividend is an ordinary 16-bit value already in AX, clear DX so the pair represents exactly that value. With AX=1234, DX=0, and divisor 80, the quotient is 15 and the remainder is 34: 1234 = 15 × 80 + 34. The remainder must be nonnegative and smaller than the divisor.",
  "Leaving DX=1 changes that example’s dividend to 65536 + 1234 = 66770. This is not a minor rounding difference; it is a different input. A sufficiently large high half makes the quotient too large for AX. DIV signals both a zero divisor and an unrepresentable quotient with a divide-error exception. It does not complete and then set a recoverable overflow flag. Arithmetic flags after division are undefined, so testing CF afterward cannot establish success.",
  "For a nonzero unsigned 16-bit divisor d, the quotient fits if and only if the original high half DX is less than d. You can derive this rather than memorize it. If DX is at least d, then the dividend is at least d × 65536, requiring a quotient of at least 65536. If DX is at most d−1, even the largest low half gives a dividend no greater than d × 65536−1, so the quotient is at most 65535. Check zero and the high-half condition before DIV. In this early lab, explicit rejection is easier to inspect than an exception path whose handler you have not built yet."
], teaching: {
  "goal": "Trace unsigned DX:AX division and prove the preconditions for a quotient that fits AX.",
  "bridge": "Multiplication creates two halves. Division reads two halves even when you intended to divide only the value visible in AX.",
  "check": {
    "prompt": "An unsigned word division has DX=3 and divisor=3, with any AX value. Can its quotient fit in AX? How does the argument change when DX=2?",
    "answer": "With DX=3, the dividend is at least 3 × 65536, so division by 3 requires a quotient of at least 65536 and faults. With DX=2 and any 16-bit AX, the dividend is below 3 × 65536, so a quotient at most 65535 fits. The divisor is nonzero in both cases."
  },
  "takeaway": "DIV consumes the complete high:low dividend; validate a nonzero divisor and the quotient range before executing it.",
  "diagramAfter": 2
}
      },
      {
        id: 'signed-divide', title: "Sign-extend a signed numerator before IDIV",
        paragraphs: [
  "A signed 16-bit value in AX must keep its meaning when expanded into the 32-bit pair DX:AX. CWD performs that sign extension: it fills DX with zeros when AX’s sign bit is zero and with ones when the sign bit is one. For AX representing −23, CWD produces DX:AX=0xFFFF:0xFFE9. Clearing DX instead would construct positive 65513, so the later signed division would be solving a different problem. Conversely, CWD is inappropriate when an unsigned AX value with its top bit set is meant to remain positive.",
  "IDIV with a word divisor interprets both the double-width dividend and divisor as signed. The quotient truncates toward zero, and the remainder has the dividend’s sign unless it is zero. Dividing −23 by +5 gives quotient −4 and remainder −3, satisfying −23 = (−4 × 5) + (−3). Compare this with a right shift of a negative odd value: SAR rounds downward, so it is not automatically an equivalent replacement for signed division by a power of two.",
  "The quotient still has to fit signed AX, from −32768 through 32767. A zero divisor faults, and the single-word minimum divided by −1 also faults because +32768 is outside that range. If DX:AX is an arbitrary double-width signed input rather than a sign-extended word, proving representability needs a full signed range argument; the unsigned DX<divisor test is not a shortcut for it. Before running, write the dividend, divisor, expected quotient, and remainder as signed decimal values, then check their hexadecimal encodings separately."
], teaching: {
  "goal": "Construct a signed double-width dividend and explain quotient rounding, remainder sign, and signed overflow.",
  "bridge": "Unsigned division prepares a zero high half for a one-word numerator. Negative signed inputs need a different extension.",
  "check": {
    "prompt": "You want signed −31 divided by +7. What high half should CWD create, and what quotient and remainder should IDIV produce? Verify them with an equation.",
    "answer": "CWD makes DX=0xFFFF because the numerator is negative. The quotient is −4 and the remainder is −3: −31 = (−4 × 7) + (−3). Truncation toward zero chooses −4, and the negative remainder keeps the identity true."
  },
  "takeaway": "CWD preserves a signed word’s meaning in DX:AX; IDIV then requires signed quotient bounds and truncates toward zero.",
  "diagramAfter": 2
}, code: asm('signed-division.asm', bootProgram(`    mov ax, -9
    cwd
    mov bx, 2
    idiv bx
    call print_hex16
    mov al, ' '
    call putc
    mov ax, dx
    call print_hex16`))
      },
      {
        id: 'practice', title: "Build an arithmetic report you can explain",
        paragraphs: [
  "The checkpoint combines the operations you have been building into a small report. Read its supplied input values and required result order before editing. Keep the field-extraction result, append the signed-shift result, then produce the unsigned quotient and remainder. Do not start by writing the expected output as text. Assign each displayed word to the register value computed by its operation, and record when that value must be saved before another instruction or output setup reuses the register.",
  "Make a paper trace with columns for the packed input, extracted field, shifted value, dividend pair, quotient, and remainder. Use the checkpoint’s actual inputs when solving it, and a separate set of values when checking whether your explanation generalizes. For an independent division example, 725 divided by 32 gives quotient 22 and remainder 21. The formatter displays those bit patterns in hexadecimal, but changing notation does not change the identity 725 = 22 × 32 + 21. Keep arithmetic interpretation separate from display base.",
  "At the section boundary, choose Submit to build, boot, and test your routine automatically. Compare each output with the trace; Run remains available for optional experiments without submitting. If one word differs, follow that value from its input through its transformation and display setup rather than changing every operation. In a playground copy, substitute a logical shift for an arithmetic shift on a negative input and predict which output should change. Extend another copy with explicit rejection of a zero divisor and an unsigned high half too large for the divisor. These experiments turn a matching report into evidence that you understand why each result appears."
], teaching: {
  "goal": "Combine field extraction, a signed shift, and checked division while tracing where each printed value comes from.",
  "bridge": "Each instruction is now understandable on its own. The final checkpoint asks you to keep those meanings intact as results move through one routine.",
  "check": {
    "prompt": "A report prints the right quotient but the wrong remainder. Before DIV you predicted 847 divided by 50. What two numerical results should you trace, and why should you inspect output setup as well as DIV?",
    "answer": "The quotient should be 16 and the remainder 47 because 847 = 16 × 50 + 47. After DIV they occupy AX and DX. Printing may require moving values through AX or AL, so an overwritten or incorrectly selected register can spoil the report even when the division produced both correct results."
  },
  "takeaway": "Trace each displayed value from its supplied input through the arithmetic and into the formatter, then test variations that distinguish the intended operation.",
  "diagramAfter": 2
}
      }
    ], lab: 'boot',
    assembly: { example: bitsExample, starter: bitsStarter, solution: bitsSolution, expectedOutput: '000D FFFB 000F 0028', title: 'Keep the signed shift signed', instructions: 'Repair the signed -9 shift in the arithmetic pipeline. The four hexadecimal results must be 000D FFFB 000F 0028. Keep the field extraction, unsigned division, input values, and register-based output.', hints: ['SHR fills the top bit with zero.', 'SAR copies the sign bit and rounds a negative odd value downward.', 'DIV BX uses DX:AX, returns quotient AX and remainder DX; the supplied helper preserves DX.'], question: { prompt: 'What is the decimal remainder after unsigned 1000 divided by 64?', answer: 40, explanation: '15 × 64 = 960, leaving 40. The screen represents that remainder as hexadecimal 0028.' } },
    challenge: { title: 'Review an arithmetic contract', brief: 'Repair the complete pipeline and justify every input width, signed interpretation, and result half.', language: 'asm', starter: bitsStarter, solution: bitsSolution, tasks: ['Produce the exact four-word output using the computed registers.', 'Trace why bits 7..4 of 0x01d3 produce 0x000d.', 'Explain why SAR -9,1 differs from signed division by two.', 'Design explicit failure branches for zero-divisor and unsigned quotient-overflow cases.'], hints: ['A field needs both masking and positioning.', 'The sign bit is part of the chosen numerical interpretation.', 'Check division preconditions before DIV; its flags do not report failure.'], explanation: 'SAR preserves the sign when shifting -9 and yields -5, encoded as FFFB. The existing extraction yields D. With DX cleared, unsigned 1000/64 produces quotient F and remainder 28. Helpers preserve the arithmetic registers so the displayed remainder is the actual DIV result.', checks: ['All four observed words match the stated numerical interpretation.', 'The explanation distinguishes TEST from destructive AND.', 'The signed rounding counterexample uses -9 concretely.', 'Division checks cover both zero and an unrepresentable quotient.'] },
    reflection: { prompt: 'Review these claims: TEST x,mask proves all selected bits are set; SHR and SAR both divide by two; DIV reports overflow through OF. Give a minimal counterexample or correction for each.', rubric: ['Distinguishes any-bit and all-bits predicates', 'Uses a negative odd signed value and explains rounding', 'Names DX:AX, quotient width, and divide-error behavior', 'Avoids relying on undefined flags'], modelAnswer: 'TEST x,mask followed by JNZ only proves at least one selected bit is set; x=1 and mask=3 disproves the all-bits claim. SHR of FFF7 yields 7FFB, while SAR yields FFFB (-5), and IDIV by two yields -4 with remainder -1. DIV consumes DX:AX and faults on zero divisor or an oversized quotient; OF is not a valid error report. I would specify the desired predicate and signedness, validate division inputs, and branch only on architecturally defined flags.' },
    sources: [intel, nasmSyntax],
    nextBuild: 'Read the actual emitted bytes and diagnose a BIOS printing loop before building a bootloader that must establish its own environment.'
  },
  {
    id: 'A12', slug: 'assembly-debugging', title: 'Read the bytes, explain the machine',
    subtitle: 'Learn how to investigate a blank screen, connect source to machine bytes, and explain what your program actually did.',
    phase: 'x86 Assembly', minutes: 130,
    prerequisites: ['Trace calls, stack frames, flags, and conditional branches', 'Read pointers and little-endian values', 'Understand that assembler directives and CPU instructions are different'],
    outcomes: ['Relate source labels to emitted bytes and loaded addresses', 'Read a NASM listing without mistaking data for executed instructions', 'Diagnose BIOS service and string-direction mistakes', 'Design experiments that distinguish competing explanations', 'State exactly what must change before 32-bit protected-mode code can execute'],
    sections: [
      {
        id: 'evidence', title: 'Begin with an observation, not a diagnosis',
        paragraphs: [
  "Suppose you press Run and no new character appears. It is tempting to say that the emulator is stuck, but that conclusion goes beyond the observation. The source may not have built. The program may have returned without asking for output. A branch may bypass the output call, or firmware may receive a valid request that does something else. Debugging begins by asking which of these explanations the available evidence can distinguish.",
  "We will build a small output path in stages. First use the known putc helper to make one character visible. Next replace that helper call with direct firmware requests. Finally repeat the request for bytes read from a string. Each working stage provides a baseline—a small behavior whose inputs and result you understand—against which the next stage can be compared. The first checkpoint asks you to write that baseline yourself; the complete wrapper is supplied by the workbench.",
  "Follow the architecture diagram from source to emitted bytes, from bytes to guest entry, and from entry to the output interface. An assembler error belongs to the first boundary. A wrong service number belongs to the last. A boot signature can help firmware recognize an image without proving that control reaches your routine. Separating these stages prevents a successful observation at one stage from being mistaken for proof of all the others.",
  "For each experiment, write a prediction, change one thing, run the fresh build, and compare the result. If two explanations predict the same screen, another identical run adds little information. A marker, a byte inspection, or a controlled change to an input can separate them. Your aim is to explain the smallest working or failing program, then carry that explanation into the next stage."
], teaching: {
  "goal": "Choose an observation that separates a failed build from a program that ran without printing.",
  "bridge": "You can now write routines with registers, memory, branches, and calls. We will use those ideas to explain a failure instead of guessing at it.",
  "check": {
    "prompt": "Your edited source has an assembler error, but an older message remains on the display. What does the message prove about the new source?",
    "answer": "Nothing about its execution: the failed assembly produced no new runnable program. The screen can still show an earlier run. Tie each observation to the source revision and build that produced it."
  },
  "takeaway": "Preserve the difference between what you observed and the explanation you are testing.",
  "diagramAfter": 2
}, code: asm('known-output-baseline.asm', debugExample)
      },
      {
        id: 'listing', title: 'Ask the assembler what it actually emitted',
        paragraphs: [
  "An assembler listing connects each source line with the bytes and offsets it produced. A disassembler starts from bytes and interprets them as instructions under a selected decoding mode. These tools answer different questions. The listing can explain which label or directive produced a value; a disassembler cannot recover all of that source intent just from the binary.",
  "In this course, lesson.asm in the editor is a routine fragment. The build combines it with a boot wrapper, helpers, optional data, padding, and the signature. For a local listing, assemble that complete wrapper with all its includes available. In the command example, lesson.asm is the local filename of that complete prepared source, not an instruction to assemble the editor fragment as an independent boot sector. Apply the 512-byte size and final 55 AA checks to the completed image.",
  "For a separate miniature, MOV AL, 'Z' can emit B0 5A: an opcode selecting an immediate byte move into AL, followed by the character value. The comparison diagram connects that line to a listing entry and to byte decoding. Disassembling the whole sector in 16-bit mode with displayed origin 0x7c00 helps relate file offsets to addresses, but it also tries to interpret padding and strings as instructions. Decodable bytes do not prove that execution reaches them.",
  "Open the browser's Bytes view after a fresh build and find a known character or string in the actual assembled sector. Then compare its position with the address used by your routine. Changing the source makes the earlier binary stale; rebuild before drawing conclusions from it. Practice explaining one line with all three artifacts: what the source requested, what the listing emitted, and what the guest would decode at that instruction boundary."
], teaching: {
  "goal": "Connect a source instruction to the bytes emitted for the complete boot image.",
  "bridge": "Once we know a build succeeded, the next question is what the assembler actually put into its output.",
  "check": {
    "prompt": "A two-line lesson routine assembles into a few bytes. Why is checking that routine-only output for a 512-byte length and a 55 AA ending the wrong test?",
    "answer": "The editor routine is only one component. The complete wrapper supplies entry setup, helpers, data placement, padding, and the boot signature. Sector-size and signature checks apply to that assembled boot image, not to the fragment alone."
  },
  "takeaway": "Inspect the artifact at the scope you are claiming: a routine, an object, and a boot image are different things.",
  "diagramAfter": 2
}, code: { language: 'sh', filename: 'inspect-a-boot-sector.sh', source: 'nasm -f bin -l lesson.lst lesson.asm -o lesson.bin\nwc -c lesson.bin\nod -An -tx1 -j510 -N2 lesson.bin\nndisasm -b 16 -o 0x7c00 lesson.bin\n' }
      },
      {
        id: 'bytes', title: 'The CPU has no built-in code-versus-string marker',
        paragraphs: [
  "A hex dump does not contain a separate type tag saying “instruction” or “string.” In our 16-bit decoding example, B8 34 12 means MOV AX, 0x1234 when fetched at the correct instruction boundary. DB could emit exactly those three bytes without using the MOV mnemonic. The processor sees the same bytes either way; comments and source directives are no longer present.",
  "The memory diagram uses another small example: B0 5A followed by the bytes for cat and a zero terminator. If control begins at B0, the first two bytes load Z into AL. If execution then continues directly into the intended text, the CPU tries to decode those bytes as instructions. The error is in the control-flow layout, not in the fact that the text was declared using DB.",
  "Labels let the assembler calculate addresses; they do not create barriers or function boundaries. A local routine placed in the middle of a fall-through path needs an explicit way for ordinary execution to avoid entering it accidentally. The workbench's outer path calls your lesson and then halts; that wrapper does not make every label you place inside the lesson safe automatically.",
  "The final zero is also just a byte until a routine gives it meaning. A null-terminated reader treats zero as an end marker, whereas a counted reader stops after its supplied length. Look at the Bytes view and locate both character storage and the terminator, then state which stopping rule your consumer uses. This turns “the string looks wrong” into a question about actual bytes, starting address, and traversal behavior."
], teaching: {
  "goal": "Explain why a data declaration does not prevent the CPU from executing those bytes.",
  "bridge": "The listing exposes a byte stream. The CPU needs control flow, rather than source labels, to distinguish the path through it.",
  "check": {
    "prompt": "The source places DB \"cat\", 0 directly after an instruction that falls through. Does the label on that declaration make the processor skip its bytes? What establishes the next instruction instead?",
    "answer": "No. A label names an address for assembly; it does not insert a runtime skip. The instruction pointer and decoding mode determine which bytes become instructions. An explicit branch or a layout that control flow cannot enter is needed."
  },
  "takeaway": "Code and data are uses of bytes determined by program structure and machine state.",
  "diagramAfter": 2
}
      },
      {
        id: 'origin', title: 'ORG changes address arithmetic, not the loading mechanism',
        paragraphs: [
  "ORG tells NASM the address origin to assume while calculating labels in a flat binary. It does not copy the file into memory and does not prepend thousands of bytes of padding. In this environment, firmware performs the load at physical 0x7c00. Our wrapper's segment setup then makes the assembled addresses usable under a simple convention.",
  "Suppose a message begins 0x40 bytes into the file. With ORG 0x7c00, its label evaluates to 0x7c40. MOV SI, message loads that number into SI. With DS zero, the real-mode calculation DS × 16 + SI selects physical 0x7c40, where the loaded message resides. The diagram changes DS while keeping the label constant, showing why a correct origin alone cannot guarantee a correct memory access.",
  "Now imagine changing only ORG to zero while the firmware still loads at 0x7c00. An absolute message label may become 0x0040, so DS=0 reads the wrong physical byte. Yet a relative branch within the program may still work: its source and destination shift by the same assumed origin, leaving their difference unchanged. This mixture of working jumps and broken pointers is useful evidence, rather than a contradiction.",
  "Alternative segment conventions are valid when designed coherently. For these lessons, keep the wrapper's normalized code segment, zero data segments, and matching origin. When investigating an address, write down file offset, origin, physical load address, segment value, and effective offset separately. Combine them only after each is known. Changing ORG until a symptom disappears can hide a mismatch that returns as soon as the layout changes."
], teaching: {
  "goal": "Derive a data byte’s physical address from file position, assembly origin, and runtime segment state.",
  "bridge": "Seeing the expected bytes is not enough. The pointer must name the place where firmware actually loaded them.",
  "check": {
    "prompt": "A label lies at file offset 0x50 in a sector assembled with ORG 0x7c00. DS is 0x0100 and SI receives that label. Which physical address does DS:SI select?",
    "answer": "The label value is 0x7c50. DS contributes 0x0100 × 16 = 0x1000, so the physical address is 0x8c50. With the course’s intended DS=0 it would instead be 0x7c50."
  },
  "takeaway": "Assembly-time address assumptions and runtime address formation must agree.",
  "diagramAfter": 2
}
      },
      {
        id: 'relative', title: 'Calculate a relative branch from the following instruction',
        paragraphs: [
  "A short JMP contains an opcode and a signed one-byte displacement. The CPU first has the position immediately after that instruction, then adds the displacement to obtain the target. This makes the distance independent of the absolute load origin when both instruction and target move together.",
  "Walk through the diagram's example. A two-byte branch starts at offset 0x20, so its relative base is 0x22. The target is 0x19. Subtracting gives −9, whose eight-bit representation is F7; the emitted bytes are EB F7. Decoding them in the intended mode adds −9 to 0x22 and reaches 0x19. Subtracting from 0x20 instead would produce a target two bytes away from the one you wanted.",
  "The tiny encoding EB FE applies the same rule. FE represents −2, so a two-byte instruction adds −2 to its following address and reaches its own start. NASM can express this as JMP SHORT $, where the dollar symbol denotes the current assembly position. It is not a variable that the CPU reads at runtime. A short displacement must fit −128 through 127; forcing SHORT beyond that range should produce an assembly error rather than a guessed truncated address.",
  "At the checkpoint, make your first small visible observation using the supplied helper, then find the character byte in the completed image. When investigating a later branch, inspect its start, length, encoded displacement, and expected target together. Use the correct disassembly mode and instruction boundary. A plausible decode under a different mode is a different interpretation of the same bytes, not evidence that the running CPU used it."
], teaching: {
  "goal": "Calculate and check a short-jump displacement using the address after the instruction.",
  "bridge": "An absolute label depends on origin. A relative branch instead records the distance between two instruction positions.",
  "check": {
    "prompt": "A two-byte short jump begins at 0x7c30 and targets 0x7c2d. What signed displacement is required, and which byte encodes it?",
    "answer": "The following instruction address is 0x7c32. The difference is 0x7c2d − 0x7c32 = −5, encoded as FB in eight-bit two’s complement. EB FB therefore lands at the target."
  },
  "takeaway": "A relative branch measures from the next instruction, not from its opcode byte.",
  "diagramAfter": 2
}
      },
      {
        id: 'bios-service', title: 'INT 0x10 is a dispatcher, not a print instruction',
        paragraphs: [
  "INT 0x10 is often described informally as a way to print, but the interrupt instruction itself does not know what a character is. It transfers through vector 0x10. In this real-mode BIOS environment, firmware interprets that vector as its video interface, then reads AH to decide which video service was requested. Other register inputs depend on the selected service.",
  "The teletype service, AH=0x0e, uses AL as a character value and the selected display-page input for the known text-mode path. AH=0x0f instead queries the current video mode and returns information. Both can assemble and execute normally. A string loop repeatedly selecting the query service might traverse every byte and return while showing no text at all. Its behavior is consistent with its instructions even though it differs from the author's intent.",
  "Follow the diagram's independent Z example from prepared registers to interrupt entry to display effect. The course initializes the text mode and uses page zero; BX is supplied for that chosen firmware path. Prepare the required inputs for each request instead of assuming that an earlier firmware call left every register unchanged. Our putc helper deliberately preserves general registers and flags around its implementation, which is a stronger promise than a raw INT instruction provides by itself.",
  "The next checkpoint asks you to replace the helper with two direct character requests. Build the first request before adding the second. In a separate experiment, switch only the service selector to the query value and predict why the output changes, then restore the printing request. You are learning to identify the whole interface—entry, operation, inputs, outputs, and preserved state—before a later kernel invents interfaces of its own."
], teaching: {
  "goal": "Explain a direct BIOS video request by identifying its dispatcher, service selector, and arguments.",
  "bridge": "The helper baseline establishes output. We can now replace that helper with the firmware operation it prepares.",
  "check": {
    "prompt": "A program loads AL with “R”, sets AH to 0x0f, and executes INT 0x10. Why can this finish successfully without printing R?",
    "answer": "INT 0x10 selects the BIOS video interface, while AH=0x0f requests the current video mode. That is a valid query, not a character-output request. Correctly executing the selected operation therefore need not print anything."
  },
  "takeaway": "A valid interface call can perform the wrong operation when its selector or arguments are wrong.",
  "diagramAfter": 2
}, code: asm('wrong-video-service.asm', debugStarter)
      },
      {
        id: 'strings', title: 'LODSB combines memory access with an implicit pointer update',
        paragraphs: [
  "LODSB combines two actions. In our 16-bit address-size form, it reads the byte at DS:SI into AL, then updates SI by one. The direction flag, DF, chooses the direction: clear means increment, set means decrement. CLD clears DF and STD sets it. Reading only the mnemonic as “load the next byte” hides the question of what next means in the current machine state.",
  "The diagram traces the bytes for cat followed by zero with DF clear. Three loads read the characters; a fourth reads the terminator and advances SI once more. LODSB does not itself test for zero or print. A later TEST of AL establishes the zero flag, and a conditional branch decides whether to stop before requesting output. Separating those operations explains why a valid memory load can still be followed by a wrong branch or service call.",
  "A zero-terminated representation is usable only when the terminating byte is reachable within the memory the routine is permitted to read. In these exercises, the supplied buffer includes it. For a broader routine, add a maximum length or another valid boundary so a missing terminator cannot trigger an unbounded scan. Reverse traversal needs its own stopping rule: starting at the last character with DF set does not make the original trailing zero limit the backward walk.",
  "As a separate bounded experiment, choose a short array with a known count, start at its final byte, and predict each read while walking backward. Use the preservation promises of any output helper you call; puts deliberately establishes forward direction internally and is not a generic reverse reader. Restore the caller's required clear direction flag before returning. Your final forward-string checkpoint will reuse these ideas with supplied strings of different lengths."
], teaching: {
  "goal": "Trace the byte read, pointer update, and stopping test of a LODSB-based traversal.",
  "bridge": "Direct requests print chosen characters. A string loop obtains those characters from memory and needs an explicit stopping rule.",
  "check": {
    "prompt": "DS is zero, SI is 0x8102, DF is set, and three bytes at 0x8100 through 0x8102 are A, B, C. After three LODSB operations, which characters were loaded and what is SI? Why is a fourth load different?",
    "answer": "The loads read C, B, A, leaving SI=0x80ff. The updated pointer alone has not accessed 0x80ff; a fourth LODSB would access a byte outside the stated three-byte region."
  },
  "takeaway": "A traversal proof must account for both the address used now and the state that selects the next address.",
  "diagramAfter": 2
}, code: asm('bounded-reverse-traversal.asm', bootProgram(`    mov si, letters+3
    mov cx, 4
    std
.again:
    lodsb
    call putc
    loop .again
    cld`, 'letters: db "ABCD"'))
      },
      {
        id: 'experiments', title: 'Make a failing program answer a narrow question',
        paragraphs: [
  "Suppose the output service is now correct but your string variation still appears blank. Ask a narrow question first: did control reach the load? A distinct literal marker before that point can provide evidence. A second marker after it can identify whether execution passed the boundary. If both appear, the next questions concern the loaded value, the stopping branch, and the request built from it.",
  "Markers are not invisible observers. Loading a marker into AL destroys the character you might have wanted to inspect. Arithmetic used while formatting a number can overwrite flags. A helper with documented preservation makes some observations easier, but its caller still must preserve any value overwritten while preparing the helper's arguments. Capture state at the exact instruction boundary that your question names.",
  "Now vary one factor: starting pointer, direction flag, service selector, or terminator. Before running, describe the outcome that would support your explanation. For a termination experiment, retain a maximum iteration count and report exhaustion so failure remains bounded. Accidentally finding a zero somewhere else in memory does not establish that the original string was valid.",
  "Record the smallest source reproducing the defect, the source snapshot that actually built, and one change that repairs it. Then undo that change to see the predicted failure again. This short cycle turns a fix into an explanation. It also makes your later OS debugging useful to another learner, who can reproduce the same boundary without inheriting an entire broken kernel."
], teaching: {
  "goal": "Choose a diagnostic marker that narrows a failure without destroying the state being inspected.",
  "bridge": "You now have several plausible causes for blank output. A controlled experiment can separate them.",
  "check": {
    "prompt": "You want to inspect ZF immediately after TEST AL, AL, but insert ADD BX, 1 before reporting it. Why can the reported flag answer the wrong question?",
    "answer": "ADD changes the arithmetic flags, including ZF. The later observation describes ADD’s result rather than the earlier TEST. Save the relevant state at the observation point or use a diagnostic path with a known preservation contract."
  },
  "takeaway": "A diagnostic operation is part of the program and can change the evidence it is meant to collect.",
  "diagramAfter": 2
}
      },
      {
        id: 'halt', title: 'A halted guest is not necessarily a broken emulator',
        paragraphs: [
  "After a routine prints its result and returns, our workbench's wrapper deliberately enters a halt path. The unchanged display is useful: it leaves the result available for inspection. Printing the same message forever would create activity without adding evidence that the computation was correct.",
  "HLT suspends ordinary instruction execution until an event allowed by the current architecture state resumes or resets the processor. With maskable interrupts disabled by CLI, the usual timer interrupt does not wake the simple course halt path. Reset and non-maskable events are separate possibilities. A short jump to its own address, by contrast, continues fetching and executing instructions even if no visible output changes.",
  "The comparison diagram shows these possibilities alongside a path that never reached output. Screen contents alone cannot distinguish them. An instruction trace, debugger step, or controlled interrupt experiment can provide the missing execution evidence. The website's machine status and blank-output hints should be read at their stated strength; a powered-on guest is not a promise that useful instructions are running continuously.",
  "Do not add STI merely to make a halted demonstration appear active. Enabling interrupts assumes that the current vector table, stack, handlers, and devices can support the resulting entries. Firmware real mode and a newly constructed protected-mode kernel have different setups. In the next module, we will decide when those promises are ready before changing the interrupt policy."
], teaching: {
  "goal": "Distinguish a deliberately halted program from a busy loop using execution evidence.",
  "bridge": "A successful one-shot program may stop changing the screen. That observation is compatible with several CPU states.",
  "check": {
    "prompt": "One program prints once and executes CLI followed by HLT. Another prints once and jumps to itself forever. Why can their displays match, and what is different about their execution?",
    "answer": "Neither path changes the display after printing. The jump loop keeps executing instructions; HLT suspends ordinary instruction execution until an eligible event. With maskable interrupts disabled, the normal timer IRQ does not resume that halt path."
  },
  "takeaway": "A stable display describes device output, not the processor’s complete execution state.",
  "diagramAfter": 2
}
      },
      {
        id: 'mode', title: 'BITS 32 does not switch the processor into protected mode',
        paragraphs: [
  "BITS is an instruction to NASM, not an instruction executed by the CPU. It chooses default operand and address sizes used while encoding subsequent source. The processor decodes the resulting bytes according to its current execution environment. If those assumptions disagree, successfully assembled source can execute with different instruction boundaries or operands from the ones you expected.",
  "For a concrete example, a 32-bit encoding of a move with a 32-bit immediate contains more immediate bytes than its default 16-bit counterpart. If real-mode decoding treats part of that intended immediate as the next opcode, the mistake affects more than the value in one register: it changes the path through the byte stream. Explicit size prefixes affect instruction encodings, but a BITS directive by itself is not a request to enter protected mode.",
  "The upcoming protected-mode transition establishes processor state: valid segment descriptors, a loaded GDT pointer, the protection-enable bit in CR0, and a far transfer that loads the intended code descriptor. The chosen descriptor's attributes give 32-bit code its defaults. Compatible data segments and a valid stack then prepare entry into C. Paging is a separate mechanism and need not already be enabled for our initial flat protected-mode entry.",
  "You already understand the pieces needed to study this transition. Descriptor bytes are packed fields; table pointers have memory layouts; a far transfer changes more state than a relative branch; C relies on a calling convention. Keep the current debugging exercises in their supplied real-mode environment. We will combine the new state changes only after their prerequisites and observation points are explicit."
], teaching: {
  "goal": "Explain why an assembler bitness directive must agree with the processor’s actual decoding state.",
  "bridge": "We have learned to connect bytes to execution. A mode mismatch breaks that connection even when assembly succeeds.",
  "check": {
    "prompt": "A real-mode boot sector contains BITS 32 before some instructions but never changes processor state. Which component changed its assumptions, and which did not?",
    "answer": "NASM changed its default encoding assumptions. The CPU still decodes under its real-mode environment. The directive emits no architectural mode transition, so the resulting byte stream may not mean what the author intended when executed."
  },
  "takeaway": "A build-time description of the target environment does not create that environment at runtime.",
  "diagramAfter": 2
}
      },
      {
        id: 'handoff', title: 'Remove the training wrapper one promise at a time',
        paragraphs: [
  "The final checkpoint brings the stages together. The normal data buffer contains OS READY followed by zero, but the task is to implement a forward string traversal, not to memorize eight character requests. The tests also provide a shorter string and an empty string. Your routine must read the supplied buffer, stop at the first zero, preserve its contents, and produce the corresponding real BIOS output.",
  "Reason about the loop before running it. Establish the starting pointer and direction, load one byte, decide whether it is the end marker, and request output only for a nonzero character. The BIOS service selector must describe the desired operation on each iteration. An empty string should reach the return path without asking to print even one character. The checkpoint brief and Peek answer are available when you need a more explicit comparison; the reading gives you the mechanism to explain that comparison.",
  "Then follow the handoff diagram and name what the workbench still did for you. It supplied entry setup, normalized segments, a usable stack, clear DF, the selected text mode, helper routines, a return path, image padding, and a boot signature. These are established machine conditions, not conveniences that assembly source gets automatically. The next chapter transfers those responsibilities into your own files one stage at a time, then adds disk loading and the environment required by C.",
  "Keep a small record of this result: the working source and binary, a byte-level explanation of one pointer or service request, and a failing variation with one known cause. Demonstrating the shorter and empty cases shows that you understood the representation. Explaining why the deliberate defect fails shows that the instructions, addresses, and machine state now form a model you can use beyond this one program."
], teaching: {
  "goal": "Demonstrate a general forward string reader and identify which boot responsibilities the workbench still supplies.",
  "bridge": "Your output path now connects addresses, traversal, branches, firmware requests, and a deliberate return. We can use it as a foundation for owning the boot path.",
  "check": {
    "prompt": "Your routine prints the visible default message by emitting fixed character literals. Why can that fail the checkpoint when the screen first looks correct?",
    "answer": "The tests replace message with another string and with an empty string. A correct routine reads the supplied bytes, stops before printing the terminator, and leaves the buffer unchanged. Fixed output only matches one example."
  },
  "takeaway": "A general implementation follows its supplied representation, rather than reproducing one visible result.",
  "diagramAfter": 2
}
      }
    ], lab: 'boot',
    assembly: { example: debugExample, starter: debugStarter, solution: debugSolution, expectedOutput: 'OS READY', title: 'Repair a real firmware request', instructions: 'This loop reads the right null-terminated string but asks BIOS for the wrong service. Make the real VGA display show OS READY by repairing the service selector. Keep the string traversal and INT 0x10 call.', hints: ['INT 0x10 dispatches several different video services.', 'AH = 0x0f asks for the current video mode; it does not print AL.', 'AH = 0x0e requests teletype output. Keep DF clear and SI pointed at the first character.'], question: { prompt: 'What numeric value must AH contain for BIOS teletype output? Enter decimal or hex.', answer: 14, explanation: 'The BIOS teletype selector is hexadecimal 0x0e, which is decimal 14.' } },
    challenge: { title: 'Explain why an apparently stuck machine prints nothing', brief: 'Repair the complete BIOS program, retain a failing variant, and connect the changed instruction to actual emitted bytes and output.', language: 'asm', starter: debugStarter, solution: debugSolution, tasks: ['Run the broken challenge and record the exact observation.', 'Repair AH and obtain OS READY on the real emulated VGA display.', 'Locate the stored message and corrected service encoding in the assembled bytes.', 'Demonstrate a separately bounded DF experiment and restore DF before returning.', 'Write the initialization obligations that the next bootloader must take over.'], hints: ['Separate successful compilation from correct behavior.', 'A blank screen can be the final state of a normally halted program.', 'Keep the machine mode, ORG, segment state, and disassembler mode consistent.'], explanation: 'The loop originally requests video-mode information with AH=0x0f, so no character output is requested. AH=0x0e uses AL as the teletype character. DS:SI and DF established by the wrapper make LODSB walk the stored string forward, the zero terminator ends the loop, and the wrapper then halts normally.', checks: ['The repair is observed on actual VGA rather than inferred from source text.', 'The evidence distinguishes assembled bytes from the current editor buffer.', 'The explanation includes AH, AL, DS:SI, DF, and the termination condition.', 'The handoff distinguishes BITS directives from a protected-mode transition.'] },
    reflection: { prompt: 'The screen is blank, the emulator says powered on, and the boot sector has a valid 55 aa signature. Propose three competing explanations and one discriminating experiment for each. Explain what none of these observations proves.', rubric: ['Treats blank output as an observation rather than an automatic hang diagnosis', 'Separates source, emitted bytes, and actual execution', 'Uses bounded experiments with known observation effects', 'Explains boot signature and CPU-mode limits'], modelAnswer: 'One explanation is that the BIOS call selects a nonprinting service; a literal character sent through known-good AH=0x0e separates that case from an unavailable output path. Another is a wrong DS:SI or DF; a bounded byte dump or fixed-length traversal tests the pointer and direction without scanning arbitrary RAM. A third is that execution never reaches the loop; distinct markers around the control transfer or instruction stepping test that path. The signature only establishes two bytes, powered-on does not prove progress, and successful assembly does not prove correct addressing or CPU mode.' },
    sources: [intel, nasmSyntax, nasmDirectives, { title: 'NASM: command-line options and listing files', url: 'https://www.nasm.us/doc/nasm02.html' }, { title: 'NASM: flat binary output and ORG', url: 'https://www.nasm.us/doc/nasm09.html' }, { title: 'SeaBIOS implementation of video interrupt services', url: 'https://github.com/coreboot/seabios/blob/master/vgasrc/vgabios.c' }],
    nextBuild: 'Build a boot sector without the training wrapper, load a second stage, and enter a freestanding C kernel with every environment assumption explicit.'
  }
];
