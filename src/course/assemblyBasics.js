import { bootProgram } from './assemblyPrograms';

const intel = { title: 'Intel architecture manuals: Volume 1, programming environment; Volume 2, instruction reference', url: 'https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html' };
const nasmLanguage = { title: 'NASM manual: source lines, constants, operands, and data declarations', url: 'https://www.nasm.us/doc/nasm03.html' };
const nasmBits = { title: 'NASM manual: BITS and assembler directives', url: 'https://www.nasm.us/doc/nasm08.html' };

const firstExample = bootProgram(`    ; Each MOV sets the input for the next printing call.
    mov al, 'H'
    call putc
    mov al, 'I'
    call putc
    call newline`);
const firstStarter = bootProgram(`    ; Goal: print OK. Both instructions are valid, but order matters.
    mov al, 'K'
    call putc
    mov al, 'O'
    call putc
    call newline`);
const firstSolution = bootProgram(`    mov al, 'O'
    call putc
    mov al, 'K'
    call putc
    call newline`);

const numbersExample = bootProgram(`    mov ax, 42
    call print_hex16
    call newline
    mov ax, 0x2a
    call print_hex16
    call newline
    mov ax, 0b00101010
    call print_hex16
    call newline`);
const numbersStarter = bootProgram(`    ; Goal: 0041, FFFF, FF80 on three lines.
    mov ax, 41       ; Intended: decimal sixty-five.
    call print_hex16
    call newline
    mov ax, 255      ; Intended: sixteen-bit minus one.
    call print_hex16
    call newline
    mov ax, 128      ; Intended: sixteen-bit minus 128.
    call print_hex16
    call newline`);
const numbersSolution = bootProgram(`    mov ax, 65
    call print_hex16
    call newline
    mov ax, -1
    call print_hex16
    call newline
    mov ax, -128
    call print_hex16
    call newline`);

const registersExample = bootProgram(`    mov ax, 0xabcd
    call print_hex16
    call newline
    mov al, 0x12
    call print_hex16
    call newline
    mov ah, 0x34
    call print_hex16
    call newline`);
const registersStarter = bootProgram(`    ; Keep the original upper word of EAX while replacing its low word.
    mov eax, 0x12345678
    mov eax, 0xbeef   ; This replaces too many bits.
    call print_hex16
    call newline
    shr eax, 16
    call print_hex16
    call newline
    ; Now construct AX=3412 using its two byte registers.
    mov ax, 0
    mov ah, 0x12
    mov al, 0x34
    call print_hex16
    call newline`);
const registersSolution = bootProgram(`    mov eax, 0x12345678
    mov ax, 0xbeef
    call print_hex16
    call newline
    shr eax, 16
    call print_hex16
    call newline
    mov ax, 0
    mov ah, 0x34
    mov al, 0x12
    call print_hex16
    call newline`);

const arithmeticExample = bootProgram(`    mov ax, 0x7fff
    add ax, 1
    setc bl           ; Capture the unsigned carry as 0 or 1.
    seto cl           ; Capture signed overflow independently.
    call print_hex16
    call newline
    movzx ax, bl
    call print_hex16
    call newline
    movzx ax, cl
    call print_hex16
    call newline`);
const arithmeticStarter = bootProgram(`    ; DX:AX is the 32-bit value 0001:FFFF.
    ; Goal: increment it, then print its high and low words.
    mov dx, 0x0001
    mov ax, 0xffff
    add ax, 1
    mov bx, ax        ; MOV preserves the pending carry flag.
    add dx, 0        ; This loses the carry from the low word.
    mov ax, dx
    call print_hex16
    call newline
    mov ax, bx
    call print_hex16
    call newline`);
const arithmeticSolution = bootProgram(`    mov dx, 0x0001
    mov ax, 0xffff
    add ax, 1
    mov bx, ax
    adc dx, 0
    mov ax, dx
    call print_hex16
    call newline
    mov ax, bx
    call print_hex16
    call newline`);

export const assemblyBasics = [
  {
    id: 'A01',
    slug: 'assembly-first-instructions',
    title: 'Your first x86 instructions',
    subtitle: 'Learn where values live, how instructions change them, and how to make your first characters appear on screen.',
    phase: 'x86 Assembly',
    minutes: 90,
    prerequisites: ['No assembly experience required', 'A willingness to predict a result before pressing Run'],
    outcomes: [
      'Separate source text, machine-code bytes, CPU state, and screen output',
      'Read NASM destination-first syntax and trace MOV without guessing',
      'Explain the fetch, decode, and execute model without assuming every instruction takes one clock',
      'Modify and boot a real x86 program in the browser',
      'Distinguish a successful assembly from a correct program'
    ],
    sections: [
      {
        id: 'a-machine-you-can-question',
        title: '1. From your first instruction to a running machine',
        paragraphs: [
          "Imagine a computer that has just started. There is no terminal window, no standard library, and no operating system to run a print function for us. Yet the processor can already follow instructions. Our first task is to understand that small beginning: put a value somewhere the processor can use it, then ask a supplied routine to show us that value.",
          "At a coding checkpoint, the workspace opens beside the lesson so you can write x86 assembly, a readable notation for processor instructions. You can also choose Open workspace whenever you want to experiment. NASM, our assembler, translates that notation into machine-code bytes. A small setup program packages your instructions into a bootable image. The browser then runs those bytes on an emulated x86 computer. This is why editing, building, and running are separate actions: the machine runs the bytes from the most recent build, not the text currently under your cursor.",
          "You do not need to write the setup program yet. The early lessons provide it so that each new idea has a small, understandable experiment. We will first learn where a value lives, then how an instruction changes it, and finally how to print it. At a checkpoint you will assemble those pieces yourself. If the result surprises you, a short trace of the changes will help explain why."
        ],
        teaching: {
          "goal": "Explain how the instructions you write become a running program.",
          "bridge": "We begin with a single visible action, then build the knowledge needed to explain it.",
          "check": {
            "prompt": "You edit a number in the source after a successful run. Before building again, has the running machine received the new number? Explain the missing step.",
            "answer": "No. The editor contains source text, while the machine is executing the previously built bytes. Building translates the changed text into a new image; running that image gives the machine the new instruction."
          },
          "takeaway": "Source text, assembled bytes, and a running machine are three different things.",
          "diagramAfter": 2
        },
        callout: { title: 'How to use this lesson', text: 'Read a small explanation, trace its example, and add the next understood piece in the editor. At a coding checkpoint, use Run to experiment and Submit to test your code. Peek shows a worked answer whenever you need one, without replacing your own source.' }
      },
      {
        id: 'state-before-syntax',
        title: '2. What counts as machine state?',
        paragraphs: [
          "Suppose you want to remember the number 67 while calculating something else. A processor has small named storage locations called registers. AL names an eight-bit register view: it can hold one of 256 bit patterns. AX names a sixteen-bit view that includes AL. For now, picture AL as eight switches whose positions we can replace with an instruction.",
          "Registers are only part of the machine’s state, meaning the information that describes its current situation. Memory holds many more bytes, each with an address. The instruction pointer identifies where execution continues. Flags record facts about some calculations. The display has its own state too. Changing one of these does not automatically change the others: placing the character code for C in AL does not make a C appear on the screen.",
          "A trace makes these distinctions visible. Give it columns for the instruction, AL before, AL after, and new screen output. A register write changes the AL column. A call to our output helper reads AL and changes the output column. When the screen is blank, this separation gives us a useful question: did the program merely prepare a character, or did it also request an output operation?"
        ],
        teaching: {
          "goal": "Identify which part of the machine an instruction changes.",
          "bridge": "Now that we know how a program reaches the machine, we need a vocabulary for what it can change.",
          "check": {
            "prompt": "A trace starts with AL = 12 and a blank screen. One instruction replaces AL with 67. What can you fill in with certainty in the next row?",
            "answer": "AL after the instruction is 67. The write itself produces no screen output, so the display remains blank. A separate operation must interpret the value as a character and send it to the display."
          },
          "takeaway": "A value in a register is not the same thing as visible output.",
          "diagramAfter": 2
        }
      },
      {
        id: 'source-and-machine-code',
        title: '3. Text is for us; bytes are for the CPU',
        paragraphs: [
          "The processor does not read the word mov. It reads bytes whose bit patterns identify an operation and its inputs. For example, in this lesson’s environment, mov al, 0x43 becomes B0 43. The first byte selects the operation “put an immediate byte into AL”; the second supplies the value. Immediate means that the value is carried inside the instruction itself.",
          "NASM turns the readable line into those bytes before execution begins. Changing 0x43 to 0x44 changes the second byte in this example. Changing the comment changes neither byte, because a comment is an explanation for the reader rather than an instruction for the processor. Labels are names that the assembler resolves into positions or values; their spelling is not copied into the instruction stream as a command.",
          "The Bytes view contains more than your short routine. It also includes setup code, helper routines, data, padding, and the boot signature. A 512-byte image therefore does not mean that your two source lines expanded into hundreds of instructions. Also, x86 instructions have different lengths. To interpret an image correctly, we need a starting address and the correct decoding mode; splitting all the bytes into pairs would not work."
        ],
        teaching: {
          "goal": "Connect a simple assembly instruction to its encoded bytes.",
          "bridge": "We can name a state change; next we will see how the assembler describes it to the CPU.",
          "check": {
            "prompt": "The encoding of mov al, 0x46 is B0 46. Predict the bytes after changing only its immediate to 0x47, and after changing only its comment.",
            "answer": "Changing the immediate produces B0 47. Changing only the comment leaves B0 46 unchanged. The immediate is an input to the machine operation; the comment is discarded by the assembler."
          },
          "takeaway": "An encoding describes an operation and its operands; formatting and comments do not execute.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'instruction-versus-encoding.asm', source: '; Focused excerpt inside lesson: not a complete boot sector.\nmov al, 0x41    ; NASM emits B0 41 in this environment.\nmov al, 0x42    ; NASM emits B0 42.\n; A comment emits no instruction bytes.\n' }
      },
      {
        id: 'fetch-decode-execute',
        title: '4. Fetch, decode, execute, repeat',
        paragraphs: [
          "Imagine a bookmark placed at the next instruction. The processor fetches bytes at that position, decodes which operation they describe, reads its inputs, and performs the specified change. It then establishes where the next instruction begins. This fetch–decode–execute model is a useful way to reason about a program without needing to know the internal circuit design of a particular processor.",
          "For an ordinary register copy, the next instruction follows the bytes just decoded. For a jump, the next instruction is at the jump’s destination. For a call, the processor also remembers where it should continue when the called routine finishes. Thus program order is not simply “move to the next source line”: labels and comments have no execution step, and branches can choose a different position entirely.",
          "Real processors overlap work and may execute internal operations out of order while preserving the architectural results that software is promised. That does not make our trace useless: it tells us what the programmer must observe after the instructions take effect. It does mean that one trace row is not one clock tick. At this stage we ask what a program computes, not how many nanoseconds it takes."
        ],
        teaching: {
          "goal": "Trace how the processor chooses and executes successive instructions.",
          "bridge": "Once source becomes bytes, the instruction pointer gives those bytes an execution order.",
          "check": {
            "prompt": "A two-byte instruction begins at offset 0x0100 and does not branch. Where does the next instruction begin, and does that tell you how long the first took?",
            "answer": "It begins at 0x0102, immediately after the two encoded bytes. The length determines the next sequential address, not the execution time. Timing depends on the instruction and the implementation."
          },
          "takeaway": "Instruction length explains sequential addresses; it does not measure execution time.",
          "diagramAfter": 2
        }
      },
      {
        id: 'read-a-source-line',
        title: '5. Read a NASM line without skipping its operands',
        paragraphs: [
          "Consider a line such as mov al, 67 ; prepare C. The mnemonic mov names the operation. Its operands, AL and 67, identify where the value goes and where it comes from. NASM uses destination-first order here, so read the line as “AL receives 67.” The semicolon starts a comment; everything after it helps us understand the line without asking the CPU to do more work.",
          "A label such as again: names the current position in the program. A later jump can refer to again without our manually counting the bytes between them. Some lines contain only a label or a comment, which explains why source-line numbers are not instruction counts. Writing the colon explicitly also makes a label visually distinct from an instruction and helps avoid accidental names caused by misspellings.",
          "You will also encounter lines such as BITS 16 and ORG 0x7c00. These tell the assembler how to create the image. They are not requests that the running processor performs. BITS influences encoding defaults; ORG influences assembled address values. The setup code and loader establish the corresponding runtime conditions. We will take over those jobs later, after ordinary instructions feel familiar."
        ],
        teaching: {
          "goal": "Read a NASM source line as a label, operation, operands, and comment.",
          "bridge": "We have followed instruction bytes; now we can read the notation used to create them.",
          "check": {
            "prompt": "Read mov bl, al in words. Which operand changes? Does adding a label before the line create another CPU operation?",
            "answer": "BL receives a copy of AL, so BL is the destination that changes. AL remains available. A label names a position for the assembler; it does not add an executed operation."
          },
          "takeaway": "For these MOV forms, read the operands as “destination receives source.”",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'reading-a-line.asm', source: 'lesson:                 ; A label: a name for this position.\n    mov al, 65          ; Destination AL receives immediate 65.\n    call putc           ; Run the supplied character-output routine.\n; BITS and ORG belong to assembly-time setup, not this instruction trace.\n' }
      },
      {
        id: 'mov-means-copy',
        title: '6. MOV copies; it does not empty the source',
        paragraphs: [
          "The name MOV can suggest moving an object out of one box and into another. Its useful meaning here is copy. If AL contains 9 and we execute mov bl, al, BL becomes 9 and AL still contains 9. The instruction replaces the destination bits; it does not consume or erase the source. Both registers now hold the same pattern independently.",
          "Continue the example with mov al, 4. AL becomes 4, but BL remains 9. There is no continuing connection between the two registers. MOV copied the value at the moment the instruction ran; it did not create a reference that follows future changes. This distinction is the assembly version of the difference between remembering a value and referring to a storage location.",
          "The order of copies therefore matters. To exchange two values, overwriting the first register immediately can destroy the only copy of its old value. A spare register can temporarily preserve it. As you read a sequence, update only the destination of each MOV and keep the other columns unchanged. This small habit prevents surprisingly many errors when we later juggle addresses, counters, and output arguments."
        ],
        teaching: {
          "goal": "Predict a sequence of register copies without losing track of the source values.",
          "bridge": "Knowing the operand order lets us follow MOV as an actual change in state.",
          "check": {
            "prompt": "Start with AL = 6 and BL = 11. Execute mov bl, al, then mov al, bl. What are the final values, and why did this fail to exchange them?",
            "answer": "Both become 6. The first instruction replaces the only copy of 11 in BL. The second copies the new BL value, 6, back into AL. A temporary copy or an exchange instruction would be needed to retain both original values."
          },
          "takeaway": "A copy uses the source value now; it does not preserve an overwritten destination for later.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'copy-trace.asm', source: '; Predict every row before running your own instrumented version.\nmov ax, 65       ; AX=65; BX is not established by this line.\nmov bx, ax       ; AX=65; BX=65.\nmov ax, 66       ; AX=66; BX remains 65.\n' }
      },
      {
        id: 'why-printing-is-explicit',
        title: '7. An output routine is an interface',
        paragraphs: [
          "A character on a screen requires more work than a register copy. Something must interpret a character code and ask the display system to draw it. The early lessons supply a routine named putc for that purpose. Its input is the byte in AL. When you execute call putc, control enters that routine, it prints the character, and it returns to the instruction after the call.",
          "ASCII is a character encoding: an agreement that assigns a number to each supported character. For this first exercise, a small lookup is enough: A has decimal code 65, H has code 72, and I has code 73. NASM translates a quoted character such as 'H' into its code, so AL receives 72 rather than a picture of the letter. The register holds that number; putc interprets it to draw H. You do not need to memorize the lookup. The next chapter explains character encodings and number notation in more detail.",
          "Think through printing two different letters. First AL must contain the first character when putc reads it. Then AL must contain the second character when putc reads it again. If you prepare both values before making either call, the second preparation overwrites the first. Both calls then see the latest value. The calls do not remember an earlier assignment that has already been replaced.",
          "This arrangement is an interface: an agreement about how to ask a routine to do a job. Our helpers specify their input registers and preserve the general registers and flags used by these lessons. The newline helper moves the output position without requiring a character argument from you. You can now build a small routine from understood pieces: prepare one character, request its output, and repeat when the task needs another character."
        ],
        teaching: {
          "goal": "Use a character-output helper by supplying its input before each call.",
          "bridge": "MOV can prepare a value. A routine that understands that value can make it visible.",
          "check": {
            "prompt": "Predict the visible result of mov al, 'C'; mov al, 'D'; call putc; call putc. Which change in ordering would make two different letters appear?",
            "answer": "It prints DD because both calls read AL after it has become D. Placing the first call immediately after preparing C lets that call read C; preparing D afterward then gives the second call a different input."
          },
          "takeaway": "A routine reads its input when it runs, so prepare each input before the corresponding call.",
          "diagramAfter": 2
        },
        callout: { title: 'Predict the order', text: 'What prints if both MOV lines come before both CALL putc lines? Each call reads the final AL value, so two calls print that same character twice. Restore the intended interleaving and explain why it works.' }
      },
      {
        id: 'the-scaffold-contract',
        title: '8. What is ready before your first instruction?',
        paragraphs: [
          "Your routine begins in an environment prepared by the course. The BIOS has loaded a boot sector, and setup code has selected usable segment registers and stack storage before calling your lesson. This support code is often called a harness: it supplies the surrounding machinery needed to run a focused piece of code. It lets us study MOV without first writing a disk loader.",
          "In this harness, DS, ES, and SS are zero, the direction flag is clear, and lesson entry has SP = 0x7bfe because the call into the lesson has already saved a return address. These names will gain a detailed meaning in later chapters. For now, the practical point is that your routine has usable memory addressing, a working stack, and the documented output helpers. Those are deliberate setup choices, not guarantees about every newly started PC.",
          "When your code finishes, the surrounding program must be able to resume. A balanced stack and intact return address make that possible. The lesson body belongs in lesson.asm; the build inserts it into the prepared image. You are not expected to paste BITS, ORG, a boot signature, or another complete boot sector into that body. Later we will build those missing layers and explain each initial condition ourselves."
        ],
        teaching: {
          "goal": "Describe what the lesson setup provides and what your routine must leave intact.",
          "bridge": "The output call works because a small program has prepared the machine before your instructions begin.",
          "check": {
            "prompt": "Why can a small lesson use CALL even though it contains no stack initialization? Would the same omission necessarily work in a new bootloader?",
            "answer": "The course setup initialized the stack before calling the lesson. A new bootloader cannot assume that this particular setup has already happened; it must establish a suitable stack before relying on calls and pushes."
          },
          "takeaway": "Every small program depends on an environment; learning the environment tells you when the program can be reused.",
          "diagramAfter": 2
        }
      },
      {
        id: 'build-your-first-program',
        title: '9. Put the pieces together in your first routine',
        paragraphs: [
          "A two-character message is a useful first program because every instruction has an observable purpose. The register writes prepare the characters; the calls print them; a newline finishes the line. Before typing the entire sequence, write a tiny trace with one row per instruction. A row that prepares a character should change AL. A row that calls putc should add exactly that character to the output so far.",
          "Build the routine in the checkpoint’s file, using the exact message requested there. The short examples in the reading explain the pieces; the problem statement tells you which pieces to combine for this task. Once the source is complete, Run builds and boots a fresh image. An assembler error points to a problem in the source notation. A successful build with the wrong message points instead to the meaning or order of otherwise valid instructions.",
          "Compare the observed characters with your trace before editing again. If the first character is wrong, inspect the last assignment to AL before the first output call. If the second repeats the first, inspect whether AL changed between calls. This method gives each fix a reason. The checkpoint tests then confirm the required behavior; they complement your explanation rather than replace it."
        ],
        teaching: {
          "goal": "Build a short output routine by tracing one character at a time.",
          "bridge": "You now know the instruction, the output interface, and the environment needed for the first complete experiment.",
          "check": {
            "prompt": "Your trace predicts CD, but the screen shows CC. Which small part of the program would you inspect first, and what would you expect to find?",
            "answer": "Inspect the instructions between the two output calls. The second call appears to receive the same AL value as the first, so the update to D may be missing, misplaced, or writing a different register."
          },
          "takeaway": "Use the first difference between a trace and a run to choose the next line to inspect.",
          "diagramAfter": 2
        }
      },
      {
        id: 'evidence-and-transfer',
        title: '10. Explain your result and adapt the program',
        paragraphs: [
          "Seeing the requested message confirms that this built program produced that output in the current environment. To understand the program, go one step further: connect each character to the AL value at its output call. This explanation distinguishes a sequence you can adapt from a sequence you happened to copy. It also tells you which line to change when the desired message changes.",
          "Try the reasoning with a different pair of characters on paper. Replacing a character’s immediate changes the value supplied to that call; moving an assignment across a call changes which value the call sees. These are different edits with different consequences. The checkpoint asks you to apply the same mechanism to its own target, while the optional reference gives a worked answer if a step still feels unclear.",
          "We have deliberately treated a character as a small value without yet explaining its binary representation. That is our next question. Why can AL hold a character code? Why do 65 and 0x41 name the same pattern? Why does a number-printing helper display several digits while putc displays one character? Understanding bits, width, and interpretation will let us answer all three without guessing."
        ],
        teaching: {
          "goal": "Explain a working routine and adapt its reasoning to a new input.",
          "bridge": "A successful run becomes useful knowledge when you can explain why the instructions produced it.",
          "check": {
            "prompt": "A routine prints a character, then copies AL to BL. If the helper preserves AL, what relationship should hold between BL and the character that appeared?",
            "answer": "BL should contain the same character code that AL supplied to the output call. The visible glyph and the stored code are different representations of the same selected character; copying the code does not print another glyph."
          },
          "takeaway": "Explaining where a result came from makes it possible to change the program deliberately.",
          "diagramAfter": 2
        }
      }
    ],
    lab: 'boot',
    assembly: {
      example: firstExample, starter: firstStarter, solution: firstSolution,
      title: 'Make the machine say OK', expectedOutput: 'OK',
      instructions: 'Write the lesson instructions that print exactly OK, starting from the small routine you have built during the chapter. Use Run to experiment and Submit to check the resulting machine behavior. You may peek at a reference at any time; use it to understand the next instruction, then build and test that change in your own source.',
      hints: ['Read each MOV as “destination receives source”.', 'CALL putc reads AL at the moment that call executes.', 'Prepare O before the first call and K before the second call.'],
      question: { prompt: 'For mov ax,65 / mov bx,ax / mov ax,66, what decimal value remains in BX?', answer: 65, explanation: 'MOV copies the current bits. The later write to AX does not modify the independent register BX.' }
    },
    challenge: {
      title: 'Write, predict, and explain two visible state changes',
      brief: 'Repair the valid but misordered program to print OK. Then create a second version that prints the first character twice without writing its literal twice. Explain why the copied source is not consumed.',
      language: 'asm', starter: firstStarter, solution: firstSolution,
      tasks: ['Predict the starter output before running it.', 'Repair the order and boot the result in the Workspace.', 'Remove one MOV and predict what the next printing call observes.', 'Write a three-row AX/BX trace for the independent copy question.'],
      hints: ['Compilation proves encoding validity, not intended order.', 'A register keeps its value until something changes that register or an overlapping part of it.', 'The provided putc preserves registers, so a second call with no new input repeats the character.'],
      explanation: 'Each printing call consumes its input logically but does not erase AL. The repaired program loads O, prints it, loads K, and prints it. The machine check observes the actual emulated display; the written explanation establishes whether you can transfer the idea to a new sequence.',
      checks: ['The starter’s KO is explained before the repair.', 'The emulated display shows OK after compiling your current source.', 'The trace keeps BX=65 after AX becomes 66.', 'The explanation distinguishes MOV from the output helper.']
    },
    reflection: {
      prompt: 'A teammate writes mov al,65, boots successfully, sees no character, and concludes that the CPU is stuck. Explain two different reasons for an unchanged screen, then design an experiment that distinguishes them without changing the boot scaffold.',
      rubric: ['Separates a register write from an output side effect', 'Explains the deliberate halt after a finished lesson', 'Proposes an observation before and after the suspicious instruction', 'States what the helper preserves instead of assuming all calls are harmless'],
      modelAnswer: 'MOV changes AL and has no screen effect. The lesson may execute it and return into the deliberate halt loop, or control flow may fail to reach it. I would print a known character before the suspicious point and then call putc after setting AL=65. A preceding marker alone narrows the failure to the later path; both characters show the path executed. The provided helper preserves general-purpose registers and flags, so this instrumentation has a stated contract. A successful print still does not prove unrelated code paths.'
    },
    sources: [intel, nasmLanguage, nasmBits],
    nextBuild: 'Keep the working program. Next derive the relationship between bit patterns, decimal numbers, hexadecimal notation, and characters before doing arithmetic.'
  },
  {
    id: 'A02',
    slug: 'assembly-numbers',
    title: 'Bits, numbers, and their interpretations',
    subtitle: 'Derive binary, hexadecimal, width, ASCII, and two’s complement instead of memorizing conversions.',
    phase: 'x86 Assembly',
    minutes: 110,
    prerequisites: ['A01: MOV, explicit output, and the boot scaffold', 'Whole-number addition and subtraction'],
    outcomes: ['Convert small values between binary, decimal, and hexadecimal by place value', 'Distinguish the width of a stored bit pattern from the spelling of a literal', 'Derive unsigned and two’s-complement ranges for any width', 'Explain why a character code and a displayed numeral are different', 'Predict exactly what a sixteen-bit hexadecimal output routine shows'],
    sections: [
      {
        id: 'bits-have-positions',
        title: '1. A bit pattern begins with positions',
        paragraphs: [
          "A bit has two possible states, written 0 and 1. A byte contains eight bits. To represent numbers, we assign each position a weight. Starting at the right, the weights are 1, 2, 4, 8, 16, 32, 64, and 128. Each move left doubles the weight, just as each move left in decimal multiplies a position’s weight by ten.",
          "For the byte 00101100, the set positions contribute 32, 8, and 4. Their sum is 44. The leading zeros contribute nothing, but writing them makes the eight-bit width visible. Bit numbering starts at zero on the right: bit 0 has weight 1, and bit 7 has weight 128. A bit number identifies a position, not the value stored in that position.",
          "The representation becomes easier to reason about when you work in both directions. To write 44 in binary, choose the largest fitting weight, 32, leaving 12; then choose 8, leaving 4; then 4, leaving zero. The same weights reconstruct the original number. Later, individual bits will also represent permissions and hardware options, so being able to name one position precisely matters as much as converting the whole value."
        ],
        teaching: {
          "goal": "Calculate an unsigned value by adding the weights of its set bits.",
          "bridge": "Character codes are numbers; binary shows how a register stores those numbers.",
          "check": {
            "prompt": "Interpret 01010010 as an unsigned byte. Which bit positions contribute to its value?",
            "answer": "Bits 6, 4, and 1 are set. Their weights are 64, 16, and 2, giving 82. The leftmost displayed zero is bit 7, so it contributes no 128."
          },
          "takeaway": "Bit positions carry powers-of-two weights; the value is the sum of the selected weights.",
          "diagramAfter": 2
        },
        code: { language: 'text', filename: 'place-value.txt', source: 'bit position:  7   6   5   4   3   2   1   0\nweight:      128  64  32  16   8   4   2   1\npattern:       0   0   1   0   1   0   1   0\ncontribution:         32       8       2     = 42\n' }
      },
      {
        id: 'hex-as-grouped-binary',
        title: '2. Hexadecimal is compact binary bookkeeping',
        paragraphs: [
          "Hexadecimal gives us a compact way to write binary patterns. One hexadecimal digit represents sixteen possibilities, so it fits exactly four bits. The digits 0 through 9 have their familiar values; A through F represent ten through fifteen. A byte therefore needs two hexadecimal digits, while a sixteen-bit word needs four.",
          "Take 0x6D. The digit 6 becomes 0110 and D becomes 1101, giving 01101101. Numerically, the left digit contributes 6 × 16 = 96 and the right contributes 13, for a total of 109. The prefix 0x tells NASM and the reader to interpret the following digits in base sixteen. It does not become part of the register value.",
          "Grouping into four-bit pieces is useful beyond conversion. A mask such as 0x0F visibly selects the low four bits, and 0xF0 selects the high four. Addresses and machine-code bytes are commonly displayed in hexadecimal for this reason. Decimal remains useful for quantities such as the number of elements in an array. Choose the notation that makes the part you are reasoning about easiest to see."
        ],
        teaching: {
          "goal": "Convert between hexadecimal digits and groups of four bits.",
          "bridge": "Binary exposes every bit, but long runs of bits are difficult to read accurately.",
          "check": {
            "prompt": "Write 0xA7 in binary and decimal without using a converter.",
            "answer": "A is 1010 and 7 is 0111, giving 10100111. In decimal, 10 × 16 + 7 = 167. Each hexadecimal position corresponds to a group of four binary positions."
          },
          "takeaway": "One hexadecimal digit always describes four bits.",
          "diagramAfter": 2
        },
        callout: { title: 'Make the conversion in both directions', text: 'Convert 0xB6 into eight bits, then sum the weights. You should obtain 10110110 and decimal 182. Explain why the left hex digit supplies the upper four bits.' }
      },
      {
        id: 'one-value-many-spellings',
        title: '3. Three source spellings, one machine value',
        paragraphs: [
          "A source literal is the written form of a value in a program. In NASM, 44, 0x2c, and 0b00101100 are three literals for the same integer. The prefixes tell the assembler how to read the digits. After assembly, the CPU receives the resulting bits; it does not remember whether you originally preferred decimal, hexadecimal, or binary.",
          "This explains a common surprise with the printing helpers. If each of those values is placed in AX and sent to print_hex16, all three print as 002C. The helper chooses hexadecimal output. It does not reproduce the original source spelling. Four output digits also describe the helper’s sixteen-bit display width, not the number of significant digits in your source literal.",
          "When a result looks wrong, identify which conversion you are judging. The source notation is converted into a value by NASM. The value is stored in a register as bits. A later helper converts those bits into display characters. Mistaking the last stage for the first can make a correctly stored decimal value seem incorrect merely because it is displayed in hex."
        ],
        teaching: {
          "goal": "Recognize when different source literals assemble to the same value.",
          "bridge": "Now we can separate the way a number is written from the bits it represents.",
          "check": {
            "prompt": "Would mov ax, 52 and mov ax, 0x34 produce different AX values? What would print_hex16 display for either?",
            "answer": "Both set AX to the same value, decimal 52. The hexadecimal helper displays 0034 for either source spelling because it formats the stored bits, not the original text."
          },
          "takeaway": "Radix belongs to the written representation, not to a register’s stored value.",
          "diagramAfter": 2
        }
      },
      {
        id: 'width-is-a-capacity',
        title: '4. Width defines how many patterns fit',
        paragraphs: [
          "One bit gives two patterns. Adding another bit doubles that number, because every existing pattern can now end in either 0 or 1. After eight bits there are 2⁸ = 256 patterns. If we interpret them as unsigned integers starting at zero, the range is 0 through 255. Sixteen bits provide 65,536 patterns and the unsigned range 0 through 65,535.",
          "The largest value and the number of possible values differ by one because zero occupies a pattern. This matters when you choose a register for a counter. An eight-bit register can represent a count of 255, but the next increment cannot leave the mathematical value 256 in the same eight bits. A wider destination is needed if that value must be retained.",
          "Width also limits instruction operands. AL selects eight bits, AX sixteen, and EAX thirty-two. A large immediate written into a smaller destination cannot magically enlarge it; an assembler may warn about truncation or reject a particular form. Treat that feedback as a prompt to decide what result you intended. Width should follow the problem’s possible values, not just whichever register name is easiest to type."
        ],
        teaching: {
          "goal": "Derive the range that fits in a fixed number of bits.",
          "bridge": "Equivalent spellings still have to fit the destination chosen by the instruction.",
          "check": {
            "prompt": "How many different patterns fit in twelve bits, and what is the largest unsigned value?",
            "answer": "There are 2¹² = 4096 patterns. Starting at zero makes the largest unsigned value 4095, which is 0xFFF. The count of patterns is one larger than the maximum value."
          },
          "takeaway": "An n-bit unsigned value ranges from zero through 2ⁿ − 1.",
          "diagramAfter": 2
        }
      },
      {
        id: 'modular-numbers',
        title: '5. Finite width makes arithmetic modular',
        paragraphs: [
          "Imagine an eight-bit counter containing 250. Adding 10 gives the mathematical result 260, which needs nine bits. The eight-bit destination can retain only the low eight bits, leaving 4. This is wraparound: the stored value behaves like the remainder after division by 256. In symbols, an eight-bit result is calculated modulo 2⁸.",
          "The same idea explains subtraction past zero. With an eight-bit result, 2 − 5 leaves the pattern 253, or 0xFD. That pattern can later be interpreted as unsigned 253 or signed −3. The stored bits alone do not announce which interpretation was intended. Status flags, which we will study soon, preserve additional information about certain arithmetic results.",
          "Wraparound can be useful in a deliberately bounded counter, but it is not an automatic substitute for a larger result. If a program must count 260 objects accurately, storing 4 is a loss of information. Write down the full mathematical answer first, then the retained pattern. Seeing both makes it clear whether the reduced result meets the problem’s needs."
        ],
        teaching: {
          "goal": "Predict the low bits retained when a result exceeds its width.",
          "bridge": "The next question is what the machine does when arithmetic needs more bits than the destination owns.",
          "check": {
            "prompt": "An eight-bit destination holds 248 and receives an addition of 12. What mathematical result is produced, and what value fits in the destination?",
            "answer": "The mathematical result is 260. Removing one full group of 256 leaves the stored byte value 4, or 0x04. The extra high bit cannot remain inside the byte."
          },
          "takeaway": "Finite-width arithmetic retains a pattern; deciding whether that pattern is sufficient is the programmer’s job.",
          "diagramAfter": 2
        }
      },
      {
        id: 'signedness-is-an-interpretation',
        title: '6. The same bits can answer different questions',
        paragraphs: [
          "A register does not carry a permanent label saying positive, negative, character, or address. It holds bits. For an unsigned byte, all eight positions contribute positive powers of two. For a two’s-complement signed byte, the highest position instead has weight −128. The remaining positions keep their usual weights. This gives the signed range −128 through 127.",
          "Consider 11110110, or 0xF6. Unsigned, it is 246. Signed, its highest bit contributes −128 and the remaining set bits contribute 118, so its value is −10. Nothing in the register changes when we explain the pattern differently. The interpretation matters when we choose operations such as comparisons, sign extension, and signed division.",
          "Equality is the same under either interpretation: identical patterns are equal. Ordering need not be. The byte 0xF6 is above 0x05 as an unsigned number but below it as a signed number. This is why assembly provides different conditional jumps for signed and unsigned comparisons. We will learn those instructions after we understand how arithmetic supplies their flags."
        ],
        teaching: {
          "goal": "Interpret the same byte as both unsigned and two’s-complement signed.",
          "bridge": "Wraparound gave us a pattern for a negative result; we can now explain its signed meaning.",
          "check": {
            "prompt": "Interpret 0xE8 as an unsigned byte and as a signed byte. Explain the signed result from the range size.",
            "answer": "Unsigned 0xE8 is 232. Because its sign bit is set, the signed interpretation is 232 − 256 = −24. Subtracting 256 is another way to give bit 7 the negative weight instead of the unsigned positive weight."
          },
          "takeaway": "Signedness is a chosen interpretation of bits, reflected in the instructions that use them.",
          "diagramAfter": 2
        },
        code: { language: 'text', filename: 'same-byte-different-meaning.txt', source: 'bits        hex   unsigned   signed two’s complement\n00000000    00       0           0\n00000001    01       1           1\n01111111    7F     127         127\n10000000    80     128        -128\n11111110    FE     254          -2\n11111111    FF     255          -1\n' }
      },
      {
        id: 'derive-negative-values',
        title: '7. Derive a negative representation',
        paragraphs: [
          "To represent −k in n bits, choose the pattern that adds to k and leaves zero after wraparound. That pattern has unsigned value 2ⁿ − k. For example, in eight bits, −6 is 256 − 6 = 250, or 0xFA. Adding the patterns for 6 and −6 gives 256, whose low eight bits are zero.",
          "The familiar “invert and add one” method gives the same result. Start with 00000110 for 6, invert all eight bits to obtain 11111001, then add one to obtain 11111010. The width is essential: inversion must happen over the bits of the intended representation. In sixteen bits, −6 is 0xFFFA rather than 0x00FA.",
          "There is one more useful boundary to understand. The most negative signed byte is −128, whose pattern is 0x80. Its positive counterpart, +128, does not fit in a signed byte. Negating that pattern cannot produce a representable positive answer at the same width. This asymmetry comes from using one of the available patterns for zero; later it will explain an important signed-overflow case."
        ],
        teaching: {
          "goal": "Construct a negative two’s-complement value at a specified width.",
          "bridge": "Knowing the signed interpretation lets us derive negative encodings instead of memorizing them.",
          "check": {
            "prompt": "Derive the eight-bit and sixteen-bit representations of −12. Why is 0x00F4 not the sixteen-bit answer?",
            "answer": "Eight bits give 256 − 12 = 244 = 0xF4. Sixteen bits give 65536 − 12 = 65524 = 0xFFF4. The sixteen-bit pattern 0x00F4 has a clear sign bit and represents positive 244."
          },
          "takeaway": "A negative encoding only has a meaning together with its width.",
          "diagramAfter": 2
        }
      },
      {
        id: 'widening-and-truncation',
        title: '8. More bits require an explicit policy',
        paragraphs: [
          "Suppose the byte 0xF4 must become a sixteen-bit value. Merely saying “add eight bits” leaves an important question unanswered: which value are we trying to preserve? If the byte means unsigned 244, the answer is 0x00F4. Filling the new high bits with zeros is called zero extension.",
          "If the same byte means signed −12, the wider representation must be 0xFFF4. Filling the new positions with copies of the original sign bit is sign extension. A positive signed byte gets zero-filled high bits; a negative one gets one-filled high bits. These different choices preserve different numerical interpretations of the same original pattern.",
          "Going the other way discards information. Taking the low byte of 0x0174 leaves 0x74, even though the original unsigned value was 372. Truncation does not ask whether the larger value fits your intended range. Before narrowing, a program that needs an exact value must check that the discarded bits are compatible with the required interpretation. MOVZX and MOVSX will make the widening choice explicit in the register chapter."
        ],
        teaching: {
          "goal": "Choose zero extension or sign extension according to the value being preserved.",
          "bridge": "A value that fits in one register may need to move into a wider calculation.",
          "check": {
            "prompt": "A byte contains 0x92. What are its zero-extended and sign-extended sixteen-bit forms? What value does each preserve?",
            "answer": "Zero extension gives 0x0092 and preserves unsigned 146. Sign extension gives 0xFF92 and preserves signed −110, since 146 − 256 = −110."
          },
          "takeaway": "Widening needs a policy: preserve the unsigned value or preserve the signed value.",
          "diagramAfter": 2
        }
      },
      {
        id: 'characters-are-encoded-data',
        title: '9. A number is not its printed digits',
        paragraphs: [
          "ASCII assigns small numerical codes to characters. The letter C has code 67, while the digit character 3 has code 51. This is why mov al, 'C' and mov al, 67 can provide the same input to putc. The assembler turns the quoted character into its code; the output routine interprets that code as a request to draw a glyph.",
          "The number 37 is not stored as the two characters 3 and 7 unless we deliberately choose a textual representation. As a numeric byte, it is 0x25. As an ASCII string, the two digits are bytes 0x33 and 0x37. A number-printing routine must calculate the digits, convert each to a character code, and print them. Calling putc once with the numeric value 37 cannot perform that conversion.",
          "The hexadecimal helper illustrates the distinction. It takes the numerical value in AX and emits four characters representing its hexadecimal digits. A leading zero in the output is a character drawn by that formatting routine. It is different from a leading zero in a source literal and different again from an unused high bit in a register. Keeping these layers separate makes both output bugs and binary-file formats much easier to understand."
        ],
        teaching: {
          "goal": "Distinguish a numeric value from the character codes used to display its digits.",
          "bridge": "We can now return to the character output that started the course.",
          "check": {
            "prompt": "What is the difference between the numeric byte 9 and the ASCII byte for the character '9'?",
            "answer": "The numeric value 9 is 0x09. The ASCII code for the digit character 9 is 57, or 0x39. A character-output routine needs the latter to draw the digit; it does not automatically convert the former into decimal text."
          },
          "takeaway": "Printing a number requires converting its value into character codes.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'a-value-and-its-text.asm', source: '; Focused lesson excerpt: three ways to send the character A.\nmov al, 65\ncall putc\nmov al, 0x41\ncall putc\nmov al, \'A\'\ncall putc\n; All three calls display A; none displays the two digits 6 and 5.\n' }
      },
      {
        id: 'make-an-interpretation-ledger',
        title: '10. Connect the value, its bits, and its printed form',
        paragraphs: [
          "A displayed number is easier to understand when four questions are answered separately: how many bits are stored, what pattern they contain, how the program interprets that pattern, and how the output routine formats it. For the byte 0xF4, those answers could be eight bits, 11110100, signed −12, and hexadecimal display F4. Each answer describes a different aspect of the same state.",
          "This small ledger is especially helpful when widening. Starting from signed −12, a sixteen-bit calculation needs 0xFFF4, which print_hex16 shows as FFF4. Starting from unsigned 244, the wider value is 0x00F4 and prints as 00F4. The output difference follows from the earlier interpretation choice; the printer did not decide which signed value you meant.",
          "At the checkpoint, use this method to derive the requested values before editing their source literals. If a result is unexpected, inspect the first stage where the meaning diverges: source radix, destination width, extension, or output format. In the next chapter we will examine the registers themselves, including how a write to AL changes part of AX while leaving other bits untouched."
        ],
        teaching: {
          "goal": "Explain a value using its width, bits, interpretation, and display format.",
          "bridge": "All the number concepts now fit into one reusable way of reading machine state.",
          "check": {
            "prompt": "A signed byte 0xD0 is widened incorrectly to 0x00D0. Explain exactly which step lost the intended meaning.",
            "answer": "The original signed value is 208 − 256 = −48. Zero extension made the sixteen-bit value positive 208. Sign extension to 0xFFD0 was needed to preserve −48; the error happened during widening, before printing."
          },
          "takeaway": "Describe width and interpretation before judging whether a displayed pattern is correct.",
          "diagramAfter": 2
        }
      }
    ],
    lab: 'boot',
    assembly: {
      example: numbersExample, starter: numbersStarter, solution: numbersSolution,
      title: 'Repair three number interpretations', expectedOutput: '0041\nFFFF\nFF80',
      instructions: 'Build a routine that prints decimal 65, sixteen-bit negative one, and sixteen-bit negative 128 with print_hex16, one per line. Add and test one value at a time. Keep the formatter unchanged so each difference comes from the representation you chose.',
      hints: ['An unprefixed 41 is decimal, not hexadecimal.', 'The sixteen-bit pattern for −1 has all sixteen bits set.', 'For a negative sixteen-bit value −x, use the pattern whose unsigned value is 65536−x.'],
      question: { prompt: 'What unsigned decimal value has the same eight-bit pattern as signed −2?', answer: 254, explanation: 'The eight-bit pattern is FE. Its unsigned value is 256−2=254; the signed interpretation subtracts 256 again.' }
    },
    challenge: {
      title: 'Separate a value, its bits, and its text',
      brief: 'Repair the three valid instructions and explain each result with a width and an interpretation. Then choose one new negative value and predict its sixteen-bit hexadecimal display before running it.',
      language: 'asm', starter: numbersStarter, solution: numbersSolution,
      tasks: ['Predict all three wrong starter lines.', 'Repair the program to print 0041, FFFF, and FF80.', 'For −5, derive the eight-bit and sixteen-bit patterns independently.', 'Explain why putc with AL=5 does not format the numeral 5.'],
      hints: ['The original starter prints 0029, 00FF, and 0080.', 'Two’s-complement conversion needs a specified width.', 'The output helper chooses hexadecimal text; it does not choose the signedness of the underlying bits.'],
      explanation: 'The repair writes 65, −1, and −128 to AX. Their sixteen-bit patterns are 0041, FFFF, and FF80. These results separate source notation from stored representation and output formatting. For −5 the corresponding patterns are FB and FFFB, because preserving a negative signed value while widening requires sign extension.',
      checks: ['The current source produces all three expected output lines.', 'The explanation states sixteen bits for each AX value.', 'The learner derives FB and FFFB rather than copying them without a calculation.', 'The difference between a digit value and an ASCII digit code is explicit.']
    },
    reflection: {
      prompt: 'A file contains the byte FF. One developer calls it 255 and another calls it −1. Decide whether either must be wrong, then describe the two different sixteen-bit values a loader might construct and the information needed to choose between them.',
      rubric: ['Identifies one bit pattern with two valid interpretations', 'Derives 00FF for zero extension and FFFF for sign extension', 'Explains the format or ABI must state intended signedness', 'Distinguishes hexadecimal display from signed decimal formatting'],
      modelAnswer: 'Neither interpretation is inherently wrong. FF is unsigned 255 and signed eight-bit −1. Zero extension yields 00FF and preserves 255; sign extension yields FFFF and preserves −1. The file format or interface contract must specify which interpretation applies. The hexadecimal printer would show the chosen pattern without proving the interpretation was correct.'
    },
    sources: [intel, nasmLanguage],
    nextBuild: 'Carry the representation ledger into the register chapter. Learn exactly which bits change when a program names EAX, AX, AH, or AL.'
  },
  {
    id: 'A03',
    slug: 'assembly-registers',
    title: 'Registers, aliases, and operand width',
    subtitle: 'Explore how AL, AH, AX, and EAX share bits, then learn to change one part while keeping the rest.',
    phase: 'x86 Assembly',
    minutes: 110,
    prerequisites: ['A01: MOV and explicit output', 'A02: hexadecimal, operand width, zero extension, and sign extension'],
    outcomes: ['Trace AX, AH, and AL as overlapping views of one register', 'Predict the upper half of EAX after a sixteen-bit write', 'Distinguish a 32-bit operand in real mode from a CPU mode change', 'Use MOVZX and MOVSX according to a documented interpretation', 'State the special rule for 32-bit destinations in 64-bit mode without applying it to sixteen-bit real mode'],
    sections: [
      {
        id: 'names-select-bits',
        title: '1. Several names can select one underlying register',
        paragraphs: [
          "Several x86 names can refer to overlapping parts of one register. EAX selects thirty-two bits. AX selects its low sixteen. Within AX, AL selects the low byte and AH the high byte. These are views of shared storage, so writing one view can change what you see through another. They are not four independent variables.",
          "If EAX contains 0x2468ABCD, AX reads as 0xABCD, AH as 0xAB, and AL as 0xCD. A write to AL changes bits 7 through 0; a write to AH changes bits 15 through 8. Neither write touches EAX’s upper sixteen bits. The register diagram is a useful ruler: mark the exact positions named by the destination before predicting the result.",
          "This overlap explains how byte-oriented device operations can coexist with wider calculations. It also creates a common mistake: clearing AL does not clear AX, because AH still contains its previous bits. A complete register value must be initialized at the width that the following operation will read. We will use traces to make these partial updates explicit."
        ],
        teaching: {
          "goal": "Identify which bits AL, AH, AX, and EAX select.",
          "bridge": "Numbers have widths; register names tell an instruction which width and which positions to use.",
          "check": {
            "prompt": "EAX is 0x56789ABC. What values are visible through AX, AH, and AL?",
            "answer": "AX sees the low sixteen bits, 0x9ABC. AH sees their high byte, 0x9A. AL sees their low byte, 0xBC. All three names select portions of the same underlying pattern."
          },
          "takeaway": "Overlapping register names are views of shared bits.",
          "diagramAfter": 2
        },
        code: { language: 'text', filename: 'register-windows.txt', source: 'EAX bits: 31                         16 15          8 7           0\n          +----------------------------+-------------+-------------+\n          |       upper 16 bits        |     AH      |     AL      |\n          +----------------------------+-------------+-------------+\n                                       |<---------- AX ---------->|\n          |<------------------------- EAX ----------------------->|\n' }
      },
      {
        id: 'trace-overlapping-writes',
        title: '2. Build a trace that cannot hide a partial write',
        paragraphs: [
          "Start with AX = 0x6A2D. Executing mov al, 0x90 replaces the low byte and leaves the high byte alone, so AX becomes 0x6A90. Executing mov ah, 0x13 afterward replaces the high byte, producing 0x1390. The easiest trace writes AX as two byte columns: AH on the left and AL on the right.",
          "Read the destination carefully on every line. The immediate’s spelling does not choose the width; the register name does. A small value such as 1 can replace all of AX when the destination is AX, or only its low byte when the destination is AL. Thus mov ax, 1 gives 0x0001, whereas mov al, 1 can leave a nonzero AH from earlier work.",
          "As the trace gets longer, keep unchanged bytes visible instead of replacing the whole row from memory. This turns a vague feeling about “the register value” into a precise update rule. When the program later prints AX, the helper observes both bytes, including any high byte you forgot to initialize. An unexpected prefix in hexadecimal output often points directly to that oversight."
        ],
        teaching: {
          "goal": "Update a register trace correctly after byte-sized writes.",
          "bridge": "The alias map becomes practical when we use it to predict a sequence of writes.",
          "check": {
            "prompt": "AX starts as 0xB27E. After mov ah, 0x05 and mov al, 0xD1, what is AX? Show the intermediate value.",
            "answer": "Writing AH first gives 0x057E: only the left byte changes. Writing AL then gives 0x05D1: only the right byte changes."
          },
          "takeaway": "Trace partial writes by preserving every byte outside the destination view.",
          "diagramAfter": 2
        }
      },
      {
        id: 'eax-and-ax',
        title: '3. Sixteen-bit writes do not clear EAX’s upper half',
        paragraphs: [
          "Imagine EAX contains two separate sixteen-bit quantities: 0x2468 in the upper half and 0x1357 in the lower half. If the task asks us to replace only the lower quantity with 0x9ACE, mov ax, 0x9ace does exactly that. EAX becomes 0x24689ACE. The destination AX selects only the low sixteen bits.",
          "Using mov eax, 0x9ace instead replaces all thirty-two bits. EAX then becomes 0x00009ACE, and the old upper half is lost. The numerical size of the immediate does not restrict the write to its nonzero digits. The instruction’s operand width determines the whole destination region, including positions filled with zeros.",
          "This is a useful habit for later hardware work: translate the requirement into the set of bits that may change. Then choose an instruction that writes those bits while preserving the others. It is more reliable than first choosing a register name and hoping that an observation of its low half reveals whether the whole operation was correct."
        ],
        teaching: {
          "goal": "Preserve EAX’s upper sixteen bits while replacing AX.",
          "bridge": "The same overlap rule extends from bytes within AX to AX within EAX.",
          "check": {
            "prompt": "EAX begins as 0xCAFE2468. Compare its final value after mov ax, 0x1357 with its final value after mov eax, 0x1357.",
            "answer": "The AX write yields 0xCAFE1357, preserving the upper half. The EAX write yields 0x00001357 because it replaces all thirty-two destination bits."
          },
          "takeaway": "Operand width defines the write, even when the immediate has only a few nonzero digits.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'preserve-the-upper-word.asm', source: '; Focused excerpt, executed in the course real-mode environment.\nmov eax, 0x12345678\nmov ax, 0xbeef       ; EAX=1234BEEF; high word is preserved.\n; Replacing the previous instruction with MOV EAX,0xBEEF gives 0000BEEF.\n' }
      },
      {
        id: 'bitness-is-not-mode',
        title: '4. A 32-bit operand does not enter protected mode',
        paragraphs: [
          "Our early machine is in real mode, but the emulated processor supports 32-bit registers and instructions. A 16-bit code environment chooses default sizes for many instruction encodings. It does not mean that every instruction must manipulate only sixteen bits. NASM can encode a 32-bit operand such as EAX using the appropriate operand-size override.",
          "There are several separate ideas here. Operand size says how much data an operation reads or writes. Address size says how an effective address is calculated. Execution mode determines broader rules, including protection and address interpretation. Changing one instruction’s operand size does not create a protected-mode environment, page tables, or access to operating-system services.",
          "BITS 16 tells NASM which defaults to assume when it chooses encodings; it is not an instruction sent to the CPU. The assembler’s assumptions and the CPU’s actual decoding state need to agree. Later, our bootloader will perform a real mode transition and only then enter code assembled for its new defaults. For now, wider registers are simply available tools inside the real-mode environment we already have."
        ],
        teaching: {
          "goal": "Distinguish operand width from the processor’s execution mode.",
          "bridge": "Seeing EAX in an early boot lesson raises a natural question about what “16-bit” actually means.",
          "check": {
            "prompt": "A routine in this real-mode lesson executes mov eax, 0x10203040. Has that instruction enabled protected mode? Explain what actually changed.",
            "answer": "No. It wrote a thirty-two-bit operand into EAX using an encoding suitable for the current environment. A mode transition requires separate control-register and segment setup; an EAX operand does not perform it."
          },
          "takeaway": "Data width, address width, and CPU mode are related but distinct choices.",
          "diagramAfter": 2
        }
      },
      {
        id: 'register-families',
        title: '5. General-purpose does not mean interchangeable in every instruction',
        paragraphs: [
          "AX, BX, CX, DX, SI, DI, BP, and SP are the familiar sixteen-bit general-purpose registers in this part of x86. They often store ordinary values, addresses, or temporary results. The names come with historical roles, but a register such as BX is not permanently typed as an address and CX is not permanently typed as a count.",
          "Some instructions nevertheless use particular registers implicitly. LOOP uses a count register selected by address size; sixteen-bit MUL and DIV use AX and DX in prescribed ways; string instructions use pointer registers such as SI or DI. SP is the stack pointer, and BP commonly provides a stable reference to a stack frame. Those uses are properties of the instruction, not guesses we should make from a variable’s purpose.",
          "For each new instruction, ask both which operands are written explicitly and which registers are read or changed implicitly. This becomes especially important for operations that produce a result wider than one register. A calculation can corrupt a useful value even if that value’s register name never appeared in the source line. We will derive the implicit inputs and outputs when we reach those operations."
        ],
        teaching: {
          "goal": "Recognize general-purpose registers and the instructions that give some of them special roles.",
          "bridge": "We can choose register widths, but not every instruction accepts every register in the same role.",
          "check": {
            "prompt": "Why is it unsafe to assume that a register remains unchanged merely because its name is absent from an instruction’s operands?",
            "answer": "Some instructions have implicit registers. For example, a word-sized division reads the dividend from DX:AX and writes quotient and remainder there, even though only the divisor is written as an explicit operand."
          },
          "takeaway": "Learn an instruction’s implicit inputs and outputs alongside its visible operands.",
          "diagramAfter": 2
        }
      },
      {
        id: 'data-flow-and-liveness',
        title: '6. Decide when an old value is still needed',
        paragraphs: [
          "Suppose AX holds a value that you will need twice: once to print it and once to add it to a total. A value is live while some future operation still needs it. Replacing AX before its last use loses that value unless another copy exists. Thinking about liveness is simply asking, “Will I need these current bits again?”",
          "A temporary register can preserve the value while AX is reused. The copy should happen before the destructive write. For example, if AX holds 23, mov bx, ax preserves 23 in BX; loading a new argument into AX afterward leaves that copy available. Copying AX into BX after the new load would preserve the wrong value, even though both MOV instructions assemble correctly.",
          "Calling a routine creates another place where liveness matters. Our teaching helpers preserve the general registers they document, but an arbitrary routine may overwrite temporary registers. Read its interface before depending on a live value across the call. Later, calling conventions will turn these preservation choices into a consistent agreement between independently written routines."
        ],
        teaching: {
          "goal": "Keep a value available until its last required use.",
          "bridge": "Knowing which registers change lets us plan where values should live during a calculation.",
          "check": {
            "prompt": "AX contains a total you need after a call. The called routine documents that AX is overwritten and BX is preserved. When should you copy AX to BX, and why?",
            "answer": "Copy it before the call. That saves the live total in a location the callee promises to preserve. A copy after the call would save the callee’s replacement value instead."
          },
          "takeaway": "A value needs a safe home until its last use, including across calls.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'preserve-a-live-value.asm', source: '; AX holds a low word; DX holds a high word.\nmov bx, ax            ; BX now preserves the live low word.\nmov ax, dx\ncall print_hex16      ; Show high word; helper preserves registers.\ncall newline\nmov ax, bx\ncall print_hex16      ; Show the saved low word.\n' }
      },
      {
        id: 'explicit-widening',
        title: '7. MOVZX and MOVSX state how new bits are filled',
        paragraphs: [
          "Suppose AL contains 0xE2 and AX still has unrelated bits in AH. Reading AX now combines the new low byte with that old high byte. If the intention is to widen AL into a complete sixteen-bit value, we need an instruction that defines the new high bits too. MOVZX and MOVSX express the two common choices directly.",
          "movzx ax, al zero-extends the byte, producing 0x00E2 and preserving unsigned 226. movsx ax, al sign-extends it, producing 0xFFE2 and preserving signed −30. Neither instruction asks AL what kind of number it is. You choose the form that matches the interpretation established by the surrounding program.",
          "These instructions are useful when reading bytes from memory as well as from registers. A byte-sized sensor field might be an unsigned quantity, while a byte-sized displacement might be signed. Widening them the same way would silently change one meaning. Naming the source width and its interpretation first makes the correct instruction follow naturally."
        ],
        teaching: {
          "goal": "Use MOVZX or MOVSX to preserve the intended value when widening.",
          "bridge": "Register overlap shows why a byte write alone does not create a fully defined wider value.",
          "check": {
            "prompt": "AL holds 0xA5. Predict AX after MOVZX and after MOVSX, and give the preserved numerical value in each case.",
            "answer": "MOVZX gives 0x00A5, preserving unsigned 165. MOVSX gives 0xFFA5, preserving signed 165 − 256 = −91. Both define all sixteen result bits."
          },
          "takeaway": "MOVZX preserves an unsigned value; MOVSX preserves a signed value.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'make-extension-explicit.asm', source: 'mov bl, 0x80\nmovzx ax, bl     ; 0080: preserve unsigned 128.\ncall print_hex16\ncall newline\nmovsx ax, bl     ; FF80: preserve signed eight-bit -128.\ncall print_hex16\ncall newline\nmov ax, 0xa500\nmov al, bl       ; A580: a partial write, not either widening instruction.\ncall print_hex16\n' }
      },
      {
        id: 'observe-a-wide-register',
        title: '8. Inspect a 32-bit value with a 16-bit printer',
        paragraphs: [
          "The supplied print_hex16 helper displays AX, so a call shows only the low sixteen bits of EAX. If EAX is 0x24681357, that call prints 1357. The missing 2468 does not mean the upper half is zero; it means the observation does not include those bits. A test that watches only AX cannot detect every mistake made to EAX.",
          "One way to inspect the upper half is to copy EAX to a temporary 32-bit register, shift the copy right by sixteen, and print the resulting low word through AX. The shift moves the upper word into the position the printer can read. Using a copy matters if the original value is still needed. A shift performed on the original changes the state being studied.",
          "Label the displayed halves or write their order beside the trace. Showing low word then high word is different from writing a conventional hexadecimal number with its high digits first. In the register checkpoint, observing both halves is how you establish that a narrow write changed the requested portion while preserving the rest."
        ],
        teaching: {
          "goal": "Inspect both halves of a 32-bit value without losing the original prematurely.",
          "bridge": "A correct wide-register update needs an observation that can reveal the entire result.",
          "check": {
            "prompt": "EAX is 0x89AB7654 and the helper prints only AX. What does one call reveal, and what still needs a separate observation?",
            "answer": "It prints 7654 and reveals the low sixteen bits. The upper word 89AB still needs to be moved into a printable position or inspected separately. The first call cannot show whether that upper word was preserved."
          },
          "takeaway": "An observation must cover every part of the state that the requirement asks you to preserve.",
          "diagramAfter": 2
        }
      },
      {
        id: 'long-mode-caveat',
        title: '9. Keep the 64-bit zero-extension rule in its own mode',
        paragraphs: [
          "In 64-bit mode, RAX names a sixty-four-bit register and EAX names its low thirty-two bits. There is an additional architectural rule: writing a 32-bit general-purpose destination clears the upper thirty-two bits of the corresponding 64-bit register. Thus a write to EAX in that mode also determines the high half of RAX.",
          "That rule does not apply to all smaller views. A write to AX still changes only sixteen bits, and a write to AL still changes only eight. If RAX contains 0x1122334455667788, writing AX = 0xABCD produces 0x112233445566ABCD. Writing EAX = 0xABCD instead produces 0x000000000000ABCD in 64-bit mode.",
          "Our current real-mode exercises do not use RAX, so this is a preview rather than a new requirement for the checkpoint. Its purpose is to prevent a tempting but false generalization: “writing a smaller register clears the larger one.” The reliable habit is to state the exact width and execution mode. That habit will transfer directly when we eventually bring up a 64-bit kernel."
        ],
        teaching: {
          "goal": "Apply the 64-bit register zero-extension rule only where it belongs.",
          "bridge": "The overlap rules we have used are precise enough to compare with a later x86 execution mode.",
          "check": {
            "prompt": "In 64-bit mode, RAX is 0xFFFFFFFF12345678. Compare the result of writing AX = 0x0099 with writing EAX = 0x0099.",
            "answer": "The AX write yields 0xFFFFFFFF12340099, preserving all bits outside the low sixteen. The EAX write yields 0x0000000000000099 because 32-bit general-purpose writes clear the upper half in 64-bit mode."
          },
          "takeaway": "Register-write rules must be stated with their operand width and execution mode.",
          "diagramAfter": 2
        },
        callout: { title: 'Keep the two rules separate', text: 'In 64-bit mode, an EAX write clears RAX’s high thirty-two bits. An AX or AL write still preserves the bits outside its own smaller view. Naming the exact destination is what makes either prediction possible.' }
      },
      {
        id: 'repair-and-generalize',
        title: '10. Repair the write set, then test another initial value',
        paragraphs: [
          "A partial-register bug often looks like a simple wrong constant, but the real issue is the size or position of the write. Begin by drawing the initial register as bytes. Mark which bytes the task asks you to replace and which must survive. The destination register should select exactly the intended region, or the calculation must explicitly preserve the neighboring bits.",
          "After the edit, derive the entire register value on paper, not just the part that the output helper first displays. Then consider another initial upper half. If the method preserves only one memorized pattern rather than the original bits, this second example exposes it. The checkpoint tests use multiple machine states for the same reason: a correct operation should follow the input, not merely reproduce one familiar display.",
          "The result is a general way of thinking about machine instructions: identify the inputs, identify the exact destination bits, and keep track of values that still matter. Arithmetic adds a new dimension to that model. Its instructions can update both a numerical result and a set of status flags, so the next chapter will teach us to trace those two outputs together."
        ],
        teaching: {
          "goal": "Repair a partial-register update and explain why it works for another initial value.",
          "bridge": "We can now use the alias map, liveness, and full-width observations together.",
          "check": {
            "prompt": "A routine must replace the low byte while keeping the other three bytes of EAX. What two observations would make a convincing small test?",
            "answer": "Check that the new low byte equals the requested value, and that the remaining twenty-four bits equal their initial pattern. Repeat with a different nonzero pattern above the low byte so an accidental clear or hardcoded reconstruction becomes visible."
          },
          "takeaway": "Test both what should change and what should remain unchanged.",
          "diagramAfter": 2
        }
      }
    ],
    lab: 'boot',
    assembly: {
      example: registersExample, starter: registersStarter, solution: registersSolution,
      title: 'Repair two overlapping-register bugs', expectedOutput: 'BEEF\n1234\n3412',
      instructions: 'Preserve EAX’s high word while replacing its low word with BEEF, then construct AX=3412 using AH and AL. The program prints the low word, the surviving high word, and the byte-constructed AX.',
      hints: ['A write to EAX replaces all thirty-two bits. A write to AX replaces only its low sixteen.', 'AH is the upper byte of AX; AL is the lower byte.', 'The fixed right shift exposes the original EAX high word to the sixteen-bit printer.'],
      question: { prompt: 'Start with EAX=0x89ABCDEF, then write AX=0x1234 and AH=0x56. What decimal value is in AL?', answer: 52, explanation: 'The final EAX is 89AB5634. AH changes bits 15:8 only; AL remains hexadecimal 34, which is decimal 52.' }
    },
    challenge: {
      title: 'Preserve what you did not mean to replace',
      brief: 'Repair the two write-set mistakes. Then change the initial high word and demonstrate that the algorithm preserves the new value without hardcoding a replacement.',
      language: 'asm', starter: registersStarter, solution: registersSolution,
      tasks: ['Trace the starter’s entire EAX value before inspecting it.', 'Repair the low-word write and both byte assignments.', 'Run again with a different initial upper word as a transfer experiment.', 'Demonstrate why MOV AL,BL is not zero extension when AH starts nonzero.'],
      hints: ['The starter initially shows a plausible BEEF but loses the upper word.', 'A partial write preserves the unselected bits, even if their old value is inconvenient.', 'Initialize AX to A500 and BL to 80 before comparing MOV AL,BL with MOVZX AX,BL.'],
      explanation: 'MOV AX,BEEF preserves EAX bits 31:16. The printer exposes BEEF before SHR moves 1234 into AX. The byte writes then assign 34 to AH and 12 to AL. The same preservation should work for another high word; the fixed output check is a fixture, not proof of every possible input.',
      checks: ['The current source produces BEEF, 1234, and 3412.', 'The whole-register trace identifies exactly when the starter loses 1234.', 'A second initial high word survives without a new hardcoded constant.', 'Zero extension, sign extension, and partial writes are explained as different operations.']
    },
    reflection: {
      prompt: 'A routine writes AL and then returns AX as a result. It passes every test when AX starts at zero. Explain the hidden assumption, construct a counterexample, and propose two different repairs depending on whether the byte is signed or unsigned.',
      rubric: ['Identifies AH as stale state', 'Chooses a nonzero initial high byte to expose the bug', 'Uses explicit zero extension for unsigned values', 'Uses explicit sign extension for signed values and states the intended input width'],
      modelAnswer: 'Writing AL preserves AH, so an initially zero AX hides the bug. With AX=A500 and AL replaced by 80, the returned AX is A580. If AL is an unsigned byte, MOVZX AX,AL returns 0080. If AL is a signed eight-bit value, MOVSX AX,AL returns FF80. The interface must choose one interpretation; clearing arbitrary bits is not a substitute for that contract.'
    },
    sources: [intel, nasmBits, nasmLanguage],
    nextBuild: 'Keep the register ledger. Next add flags to it and distinguish unsigned carry from signed overflow with deliberately chosen boundary values.'
  },
  {
    id: 'A04',
    slug: 'assembly-arithmetic',
    title: 'Arithmetic, flags, carry, and overflow',
    subtitle: 'Learn what happens when a result runs out of bits, why carry differs from signed overflow, and how to add larger numbers in pieces.',
    phase: 'x86 Assembly',
    minutes: 130,
    prerequisites: ['A02: modular arithmetic and two’s complement', 'A03: register widths, aliases, and explicit extension'],
    outcomes: ['Trace ADD and SUB at a stated width', 'Derive CF, OF, ZF, and SF for useful boundary cases', 'Explain why INC and DEC are not interchangeable with ADD and SUB when carry matters', 'Propagate carry and borrow between words with ADC and SBB', 'Capture flags before an unrelated operation overwrites the evidence'],
    sections: [
      {
        id: 'two-results-of-arithmetic',
        title: '1. Arithmetic gives us a value and a set of flags',
        paragraphs: [
          "An ADD instruction produces more than the bits stored in its destination. It also updates status flags, small pieces of processor state that describe selected properties of the result. These flags let later instructions ask questions such as “was the result zero?” or “did an unsigned sum need another bit?” without repeating the calculation.",
          "For an eight-bit example, 250 + 10 has the mathematical result 260 but leaves 4 in the destination. The carry flag records that the unsigned result exceeded the byte’s capacity. A different flag, overflow, reports whether the signed interpretation fits. The stored result and the flags belong to the same operation, but they answer different questions.",
          "We will study carry, overflow, zero, and sign one at a time. For each example, write the full mathematical result, the retained pattern, and the relevant flags in separate columns. This avoids treating one flag as a universal “something went wrong” signal. Whether wraparound is a problem depends on the calculation the program intended to perform."
        ],
        teaching: {
          "goal": "Trace the destination value and status flags as separate outputs of arithmetic.",
          "bridge": "Register writes changed bits directly; arithmetic also reports facts about the calculation.",
          "check": {
            "prompt": "Why can a destination register containing 4 be insufficient to distinguish 2 + 2 from an eight-bit 250 + 10?",
            "answer": "Both leave the retained byte value 4. The second mathematical result is 260 and loses a high bit; the carry flag distinguishes that unsigned overflow from the ordinary sum 2 + 2."
          },
          "takeaway": "Arithmetic yields a stored result and status information that must be interpreted separately.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'width-changes-the-result.asm', source: 'mov al, 0xff\nadd al, 1        ; Eight-bit result 00; unsigned carry occurs.\nmov ax, 0x00ff\nadd ax, 1        ; Sixteen-bit result 0100; no unsigned carry.\n' }
      },
      {
        id: 'unsigned-carry',
        title: '2. Derive CF from an unsigned sum',
        paragraphs: [
          "For unsigned addition, the carry flag CF becomes one when the full sum exceeds the destination’s largest representable value. With an eight-bit destination, the limit is 255. Adding 200 and 90 gives 290, so the byte keeps 34 and CF is one. Adding 100 and 90 gives 190, which fits, so CF is zero.",
          "You can see the same rule in binary: CF receives the carry beyond the highest destination bit. The retained bits are still useful. Together, the byte and its carry describe a nine-bit unsigned result. This is the idea behind adding larger numbers in pieces: the carry from a low piece becomes an input to the next piece.",
          "A carry does not mean that the retained pattern is necessarily wrong for the task. A wrapping counter may intentionally keep only the low bits. A byte count that must represent the full sum needs either a wider result or an explicit overflow path. First identify the required range, then use CF to answer the corresponding unsigned question."
        ],
        teaching: {
          "goal": "Derive CF by checking whether an unsigned sum fits its width.",
          "bridge": "The first arithmetic question is whether an unsigned addition needs an extra bit.",
          "check": {
            "prompt": "For eight-bit addition, compute the retained result and CF for 180 + 100.",
            "answer": "The full sum is 280. The destination retains 280 − 256 = 24, or 0x18. CF is one because the unsigned sum needs a ninth bit."
          },
          "takeaway": "For ADD, CF records a carry beyond the destination’s unsigned range.",
          "diagramAfter": 2
        }
      },
      {
        id: 'unsigned-borrow',
        title: '3. Derive CF from an unsigned subtraction',
        paragraphs: [
          "When subtracting unsigned values, CF is one if the subtrahend is larger than the starting value. For a byte calculation, 7 − 12 needs a borrow and leaves the low-byte pattern 251, or 0xFB. The mathematical answer is −5, but unsigned byte arithmetic cannot store that number directly. CF reports the borrow while the destination keeps the wrapped pattern.",
          "Compare 12 − 7: the result is 5 and CF is zero. This makes subtraction useful for unsigned ordering. A comparison can perform the same flag calculation without keeping the numeric difference, allowing a conditional jump to ask whether the first operand was below the second. We will return to that idea in the branching chapter.",
          "The terminology can be confusing because the same flag is called carry even after subtraction. On x86, remember the actual rule: SUB sets CF when an unsigned borrow is needed. It is not the opposite of the addition rule, and it is not a signed-negative flag. Writing the mathematical subtraction first makes the correct interpretation straightforward."
        ],
        teaching: {
          "goal": "Use CF to recognize an unsigned subtraction that borrows past the top bit.",
          "bridge": "Subtraction has its own version of the carry question: did the calculation need a borrow?",
          "check": {
            "prompt": "After eight-bit 4 − 9, what are the retained pattern and CF? Does CF mean that every result with its sign bit set borrowed?",
            "answer": "The pattern is 251 = 0xFB and CF is one because 4 is below 9 unsigned. A set sign bit alone does not imply a borrow: for example, 200 − 1 gives 199 with CF zero."
          },
          "takeaway": "For SUB, CF answers whether the unsigned subtraction needed a borrow.",
          "diagramAfter": 2
        },
        code: { language: 'text', filename: 'unsigned-boundaries.txt', source: 'width  operation  retained result  CF  unsigned explanation\n8      FF + 01          00         1   256 does not fit\n8      7F + 01          80         0   128 fits\n8      00 - 01          FF         1   a borrow is needed\n8      05 - 03          02         0   no borrow is needed\n' }
      },
      {
        id: 'signed-overflow',
        title: '4. Derive OF from the signed range',
        paragraphs: [
          "An eight-bit signed value ranges from −128 through 127. Adding 100 and 40 gives mathematical 140, outside that range. The destination contains 0x8C, which a signed byte interprets as −116. OF, the overflow flag, is one because the stored signed result cannot represent the intended mathematical sum.",
          "Now compare unsigned capacity. The same sum, 140, fits within unsigned 0 through 255, so CF is zero. Conversely, adding byte patterns for −1 and +1 leaves zero with CF one and OF zero: unsigned 255 + 1 carried, while signed −1 + 1 fits perfectly. The two flags are deliberately independent because they answer different interpretations of the operation.",
          "For addition, signed overflow occurs when operands with the same sign produce a retained result with the opposite sign. For subtraction, it occurs when operands of different signs produce a result whose sign differs from the first operand. These bit rules follow from the signed range; deriving a few examples numerically is more useful than memorizing them without understanding why."
        ],
        teaching: {
          "goal": "Determine OF from the signed range rather than from the carry flag.",
          "bridge": "Unsigned capacity does not answer whether the same operation makes sense as signed arithmetic.",
          "check": {
            "prompt": "For an eight-bit signed calculation, add 90 and 60. Predict the retained pattern, CF, and OF.",
            "answer": "The sum is 150, or 0x96. It fits unsigned, so CF is zero. It exceeds signed maximum 127 and the retained byte reads as −106, so OF is one."
          },
          "takeaway": "CF answers an unsigned range question; OF answers a signed range question.",
          "diagramAfter": 2
        },
        callout: { title: 'One result, two overflow questions', text: 'For eight-bit FF+01, CF=1 and OF=0. For 7F+01, CF=0 and OF=1. Explain both from the respective unsigned and signed ranges before using either flag in a branch.' }
      },
      {
        id: 'zero-and-sign',
        title: '5. ZF and SF describe the retained result',
        paragraphs: [
          "The zero flag ZF is one when the retained result is all zeros. The sign flag SF copies the most significant bit of that result. For a byte result 0x80, ZF is zero and SF is one. For a result 0x00, ZF is one and SF is zero. These rules refer to the operand width used by the instruction.",
          "SF is useful for interpreting a representable signed result, but it is not a complete signed comparison by itself. If signed overflow occurred, the retained sign can disagree with the sign of the full mathematical answer. For example, an out-of-range positive sum may wrap into a pattern with its top bit set. That is why signed conditional jumps combine SF with OF.",
          "ZF also describes the retained value rather than the unlimited mathematical answer. An eight-bit sum of 255 and 1 leaves zero, so both ZF and CF become one. There is no contradiction: the low byte is zero and an unsigned carry occurred. Reading each flag as its own precise statement makes combinations like this easy to explain."
        ],
        teaching: {
          "goal": "Read ZF and SF from the retained result without overinterpreting them.",
          "bridge": "Carry and overflow describe lost range; zero and sign describe the bits that remain.",
          "check": {
            "prompt": "For eight-bit 240 + 16, what are the retained value, ZF, and SF?",
            "answer": "The mathematical sum is 256 and the retained byte is 0x00. Therefore ZF is one and SF is zero. The fact that the full sum was nonzero does not change the zero flag’s definition in terms of the retained result."
          },
          "takeaway": "ZF and SF describe the retained result at the instruction’s width.",
          "diagramAfter": 2
        },
        code: { language: 'text', filename: 'derive-each-flag.txt', source: 'Eight-bit operation   result   CF OF ZF SF\n7F + 01                 80      0  1  0  1\nFF + 01                 00      1  0  1  0\n80 - 01                 7F      0  1  0  0\n00 - 01                 FF      1  0  0  1\n05 - 05                 00      0  0  1  0\n' }
      },
      {
        id: 'capture-flags-before-clobbering',
        title: '6. Save a flag result before another operation replaces it',
        paragraphs: [
          "Flags are shared processor state, not a separate historical record for each instruction. If ADD produces a carry and a later SUB updates the flags, a subsequent carry test sees the SUB result. The earlier carry is no longer available merely because its ADD remains visible in the source. A trace should name which instruction last produced the flags being used.",
          "SETcc instructions let us capture a condition as an ordinary byte. For example, SETC stores one or zero according to CF, and SETO does the same for OF. These instructions do not change the arithmetic flags, so several conditions from one calculation can be saved in succession. Once captured, the bytes can survive later flag-changing arithmetic if their registers are preserved.",
          "MOV also leaves the arithmetic flags unchanged, which can make it suitable for rearranging values between a calculation and its flag consumer. A general function call, however, preserves flags only if its documented interface says so. Our supplied print helpers make that promise for these lessons. In your own routines, capturing the needed condition close to its producing instruction keeps the reasoning local."
        ],
        teaching: {
          "goal": "Save a flag result before later arithmetic changes it.",
          "bridge": "Flags are useful only while they still describe the operation we intend to inspect.",
          "check": {
            "prompt": "ADD sets CF to one. You execute SETC BL, then an unrelated ADD that clears CF. What do BL and CF now describe?",
            "answer": "BL remains one and records the first addition’s carry. CF is now zero and describes the later addition. Saving the condition converted temporary flag state into an ordinary byte value."
          },
          "takeaway": "Consume or capture flags before another instruction replaces the information you need.",
          "diagramAfter": 2
        }
      },
      {
        id: 'increment-and-decrement',
        title: '7. INC and DEC deliberately preserve CF',
        paragraphs: [
          "INC adds one to its operand, and DEC subtracts one. They update several status flags, but they preserve CF. That makes them different from ADD operand, 1 and SUB operand, 1. A program that only needs the new value may not notice the difference; a program that needs carry or borrow will.",
          "Suppose AX contains 0xFFFF and CF is initially zero. INC AX leaves AX = 0 and CF still zero. ADD AX, 1 also leaves AX = 0, but sets CF to one because the unsigned word addition carried. Thus INC cannot create the carry that a following ADC needs to extend this increment into a larger number.",
          "Preserving CF can also be useful. A loop may need to adjust a counter without disturbing a carry already in progress. The lesson is not that one instruction is better; it is that a valid substitution must preserve every result the surrounding program relies on. Those results include flags as well as the destination register."
        ],
        teaching: {
          "goal": "Explain why INC and DEC cannot replace every ADD or SUB by one.",
          "bridge": "Instructions can produce the same value while differing in their flag effects.",
          "check": {
            "prompt": "AX is 0xFFFF and CF is one. After INC AX, what are AX and CF, and why is CF not proof that this particular increment carried?",
            "answer": "AX becomes zero and CF remains one. INC preserves the old carry flag, so the one may have come from an earlier operation rather than this increment."
          },
          "takeaway": "Equivalent destination values do not imply equivalent flag behavior.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'same-value-different-flags.asm', source: 'clc                  ; Establish CF=0 explicitly.\nmov ax, 0xffff\ninc ax               ; AX=0000, but CF remains 0.\nsetc bl              ; BL=0.\n\nclc\nmov ax, 0xffff\nadd ax, 1            ; AX=0000 and CF=1.\nsetc cl              ; CL=1.\n' }
      },
      {
        id: 'add-with-carry',
        title: '8. ADC turns a carry into the next word’s input',
        paragraphs: [
          "Write a 32-bit unsigned value as two sixteen-bit halves, DX:AX, with DX holding the high word. Adding to AX handles the low portion, but its carry belongs in DX. ADC, add with carry, computes destination + source + CF. It lets the low operation’s extra bit become part of the next word’s calculation.",
          "For example, start at 0x0003:FFFF and add one. The low-word ADD leaves AX = 0 and CF = 1. Adding zero with carry to DX then produces DX = 4. The combined result is 0x0004:0000, exactly one above the original value. An ordinary ADD DX, 0 would ignore the pending carry and leave the high word wrong.",
          "The sequence depends on preserving CF between the low addition and ADC. A MOV used to save a result is suitable because it leaves flags unchanged. An unrelated arithmetic instruction may break the chain. Once you see the carry as an explicit input, the extension to three or more words is natural: each word consumes the carry from the previous word and produces the next one."
        ],
        teaching: {
          "goal": "Propagate a low-word carry into the high word of a larger addition.",
          "bridge": "We can now combine two word-sized operations into one wider arithmetic result.",
          "check": {
            "prompt": "Increment the two-word value 0x0007:FFFF by one. Explain the low result, the carry, and the high result.",
            "answer": "The low word becomes 0x0000 and produces CF = 1. The high step adds zero plus that carry to 0x0007, yielding 0x0008. The full result is 0x0008:0000."
          },
          "takeaway": "ADC carries the extra bit from one piece of an addition into the next piece.",
          "diagramAfter": 2
        }
      },
      {
        id: 'subtract-with-borrow',
        title: '9. SBB extends subtraction across the same boundary',
        paragraphs: [
          "SBB means subtract with borrow. It computes destination − source − CF. After a low-word SUB needs a borrow, SBB subtracts that extra one from the next word. The carry flag therefore connects the pieces of a multiword subtraction just as it connected a multiword addition.",
          "Consider 0x0005:0000 minus one. The low word wraps from 0 to 0xFFFF and sets CF. The high word must lose one to pay for that borrow, giving 4. SUB followed by SBB produces 0x0004:FFFF. If the high operation were an ordinary SUB by zero, the result would incorrectly stay in the next higher 65,536-value block.",
          "A borrow chain must stay connected. Preserve CF between consecutive pieces, and distinguish the intermediate borrow from the final borrow out of the whole number. A low word can borrow successfully from a nonzero high word while the complete unsigned subtraction still fits. The final flag describes whether even the highest piece needed an unavailable borrow."
        ],
        teaching: {
          "goal": "Propagate a low-word borrow through a multiword subtraction.",
          "bridge": "Subtraction uses the same two-piece idea with the opposite arithmetic operation.",
          "check": {
            "prompt": "Subtract one from 0x0002:0000. Does a borrow from the low word necessarily mean the entire 32-bit subtraction underflowed?",
            "answer": "The result is 0x0001:FFFF. The low word borrows, but the high word can supply it, so the full subtraction does not underflow. The final borrow after the high step is zero."
          },
          "takeaway": "Intermediate borrows connect pieces; only the final borrow describes underflow of the whole unsigned value.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'subtract-across-two-words.asm', source: 'mov dx, 0x0002\nmov ax, 0x0000\nsub ax, 1            ; AX=FFFF, CF=1.\nsbb dx, 0            ; DX=0001; final 32-bit result is 0001FFFF.\n; Observe the result after completing the borrow chain.\n' }
      },
      {
        id: 'boundary-tests-and-explanations',
        title: '10. Test the boundary, not just a friendly number',
        paragraphs: [
          "A multiword increment can appear correct for many inputs even if it never transfers carry. Starting with a low word of 3 does not test the transition into the high word. Starting with 0xFFFF does. A useful test deliberately places the machine at the point where the mechanism under study becomes necessary.",
          "Build a small set of cases around that point: a low word just below the boundary, exactly at it, and zero. For signed flags, choose cases around the positive and negative limits separately. For subtraction, include both a low-word borrow that the high word can satisfy and a borrow from an all-zero complete value. Work out the mathematical answer before deriving the retained pieces.",
          "At the checkpoint, explain why the repaired instruction works for these different states, not just why the displayed sample looks right. That explanation is a bridge to memory programming: a pointer, an array index, or a byte count is also a finite-width value. Understanding wraparound and flags now will help us reason about addresses and bounds rather than treating them as special magic numbers."
        ],
        teaching: {
          "goal": "Choose arithmetic examples that distinguish a correct carry chain from a plausible wrong one.",
          "bridge": "The arithmetic tools are in place; now we need examples that actually exercise their important behavior.",
          "check": {
            "prompt": "A proposed 32-bit increment updates only its low sixteen bits. Give an input that exposes the bug and predict the wrong and correct results.",
            "answer": "Use a value such as 0x0006:FFFF. Updating only the low word produces 0x0006:0000, but the correct increment is 0x0007:0000. The input forces a low-word carry, making the missing high-word update observable."
          },
          "takeaway": "Choose tests that force the mechanism you are trying to verify.",
          "diagramAfter": 2
        }
      }
    ],
    lab: 'boot',
    assembly: {
      example: arithmeticExample, starter: arithmeticStarter, solution: arithmeticSolution,
      title: 'Carry across a sixteen-bit boundary', expectedOutput: '0002\n0000',
      instructions: 'Increment the unsigned 32-bit number DX:AX=0001:FFFF using sixteen-bit operations. Repair the high-word instruction so the program prints 0002 and 0000. Preserve the low result while formatting the two words.',
      hints: ['The low-word ADD produces AX=0000 and CF=1.', 'MOV BX,AX preserves CF, so the next arithmetic instruction can still consume it.', 'ADC DX,0 adds the incoming carry to the high word.'],
      question: { prompt: 'Immediately after the sixteen-bit ADD AX,1 with old AX=0xFFFF, what is OF (0 or 1)?', answer: 0, explanation: 'For signed sixteen-bit arithmetic the inputs are −1 and +1, yielding zero, which fits. CF is one, but OF is zero.' }
    },
    challenge: {
      title: 'Repair a carry chain and design the counterexample',
      brief: 'Repair the broken wide increment, then show one input on which the original bug is invisible and one on which it is visible. Explain both CF and OF at the low-word boundary.',
      language: 'asm', starter: arithmeticStarter, solution: arithmeticSolution,
      tasks: ['Trace DX, AX, BX, and CF after each starter instruction.', 'Replace the instruction that ignores incoming carry and boot the repaired source.', 'Predict an increment with no low-word wrap and one with full-width wrap.', 'Adapt the reasoning to 00020000−1 using SUB and SBB.'],
      hints: ['The incorrect starter prints 0001 and 0000.', 'An input such as 00010002 produces no low carry and can hide the bug.', 'For subtraction, a set CF means a borrow that SBB subtracts from the next word.'],
      explanation: 'ADD AX,1 creates the low result and carry. MOV BX,AX preserves both the result and flags; ADC DX,0 consumes the carry and updates the high word. The captured low word is printed after the high word. A single successful output is evidence for this fixture, while the additional boundary traces test whether the reasoning generalizes.',
      checks: ['The current source produces 0002 and 0000.', 'The trace identifies the low-word carry before ADC replaces the flags.', 'CF=1 and OF=0 are independently derived for FFFF+1 at sixteen bits.', 'The subtraction transfer uses SBB and explains its incoming borrow.']
    },
    reflection: {
      prompt: 'A reviewer replaces ADD AX,1 with INC AX in a multiword counter because both produce the same low word. Write a counterexample with explicit initial CF, and explain why checking only the displayed low word failed to catch the regression.',
      rubric: ['Establishes the incoming CF rather than assuming it', 'Uses a low-word boundary such as FFFF', 'Explains INC preserves CF while ADD updates it', 'Checks the high word and final carry as well as the low word'],
      modelAnswer: 'Let CF=0, DX=0001, and AX=FFFF. ADD AX,1 produces AX=0000 and CF=1, so ADC DX,0 produces DX=0002. INC AX also produces AX=0000, but leaves CF=0, so the following ADC leaves DX=0001. A low-word-only display is identical in both programs. The test must inspect both words and relevant carry boundaries; the replacement changed the flag contract even though one visible value was unchanged.'
    },
    sources: [intel, nasmLanguage],
    nextBuild: 'Use the flag ledger to derive comparisons and conditional branches. Then combine branches, bounded loops, memory addressing, and stack frames into complete assembly routines.'
  }
];
