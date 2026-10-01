import { bootProgram } from './assemblyPrograms';

const intel = { title: 'Intel Software Developer Manuals: basic architecture and instruction reference', url: 'https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html' };
const nasmLanguage = { title: 'NASM manual: data declarations, operands, and effective addresses', url: 'https://www.nasm.us/doc/nasm03.html' };
const nasmBinary = { title: 'NASM manual: flat binaries and the ORG directive', url: 'https://www.nasm.us/doc/nasm09.html' };

const memoryExample = bootProgram(`    mov ax, [sample]
    call print_hex16
    call newline
    xor ax, ax
    mov al, [sample + 1]
    call print_hex16`, 'sample: dw 0x1234');
const memoryStarter = bootProgram(`    ; Reconstruct the word from its two bytes.
    mov al, [packet]
    mov ah, [packet]       ; Repair the second address.
    mov [copy], ax
    mov ax, [copy]
    call print_hex16`, 'packet: db 0xef, 0xbe\ncopy: dw 0');
const memorySolution = bootProgram(`    mov al, [packet]
    mov ah, [packet + 1]
    mov [copy], ax
    mov ax, [copy]
    call print_hex16`, 'packet: db 0xef, 0xbe\ncopy: dw 0');

const addressingExample = bootProgram(`    mov bx, values
    xor di, di
    lea si, [bx + di + 2]
    mov ax, [si]
    call print_hex16`, 'values: dw 0x1111, 0x2222, 0x3333');
const addressingStarter = bootProgram(`    ; BP is a byte offset. Each array element is a word.
    mov bp, values
    mov si, 2             ; Fetch element index 2, counting from 0.
    mov ax, [ds:bp + si]
    call print_hex16`, 'values: dw 0x1111, 0x2222, 0x3333');
const addressingSolution = bootProgram(`    mov bp, values
    mov si, 4             ; index 2 * 2 bytes per word
    mov ax, [ds:bp + si]
    call print_hex16`, 'values: dw 0x1111, 0x2222, 0x3333');

const branchExample = bootProgram(`    mov ax, 0xffff
    cmp ax, 1
    ja .unsigned_above
    jmp .signed_test
.unsigned_above:
    mov al, 'U'
    call putc
.signed_test:
    mov ax, 0xffff
    cmp ax, 1
    jl .signed_less
    jmp .done
.signed_less:
    mov al, 'S'
    call putc
.done:`);
const branchStarter = bootProgram(`    mov ax, -1
    cmp ax, 1
    jb .less              ; The problem asks for SIGNED comparison.
    mov si, other_text
    jmp .report
.less:
    mov si, less_text
.report:
    call puts`, 'less_text: db "LESS", 0\nother_text: db "OTHER", 0');
const branchSolution = bootProgram(`    mov ax, -1
    cmp ax, 1
    jl .less
    mov si, other_text
    jmp .report
.less:
    mov si, less_text
.report:
    call puts`, 'less_text: db "LESS", 0\nother_text: db "OTHER", 0');

const loopExample = bootProgram(`    mov si, values
    mov cx, 4
    xor ax, ax
    jcxz .done
.again:
    add ax, [si]
    add si, 2
    dec cx
    jnz .again
.done:
    call print_hex16`, 'values: dw 1, 2, 3, 4');
const loopStarter = bootProgram(`    mov si, values
    mov cx, 4
    xor ax, ax
    jcxz .done
.again:
    add ax, [si]
    add si, 1             ; Repair the stride for a WORD array.
    dec cx
    jnz .again
.done:
    call print_hex16`, 'values: dw 2, 4, 6, 8');
const loopSolution = bootProgram(`    mov si, values
    mov cx, 4
    xor ax, ax
    jcxz .done
.again:
    add ax, [si]
    add si, 2
    dec cx
    jnz .again
.done:
    call print_hex16`, 'values: dw 2, 4, 6, 8');

export const assemblyMemory = [
  {
    id: 'A05',
    slug: 'assembly-memory',
    title: 'Memory: addresses, bytes, and the meaning of brackets',
    subtitle: 'Build a byte-by-byte model of loads and stores before using a pointer.',
    phase: 'x86 Assembly',
    minutes: 105,
    prerequisites: [
      'Trace a register instruction and distinguish AX, AH, and AL',
      'Convert a small hexadecimal value to bytes',
      'Run an assembly program and read its hexadecimal output'
    ],
    outcomes: [
      'Draw the exact bytes emitted by DB and DW in increasing address order',
      'Explain the difference between a label, a register value, and a memory operand',
      'Choose the width of a load or store and predict which neighboring bytes change',
      'Reconstruct a little-endian word without confusing memory order with printed notation',
      'Use an actual booted program to distinguish competing explanations of a memory bug'
    ],
    sections: [
      {
        id: 'memory-is-bytes',
        title: '1. Start with numbered byte locations',
        paragraphs: [
          "Imagine a row of byte-sized storage locations, each identified by a number. That number is an address. If address 0x0600 holds 0x2C, the address tells us where to look and 0x2C tells us what we find there. The distinction is similar to a page number and the words on that page: knowing one does not tell us the other.",
          "The x86 memory model we use here is byte-addressed. Moving from address 0x0600 to 0x0601 advances one byte. A sixteen-bit word occupies two consecutive locations, so three words occupy six bytes. The memory itself does not attach a type or element size to those locations; instructions decide whether to read one byte, two bytes, or a wider value.",
          "We can extend our register trace with columns for the address accessed and the bytes before and after. A load copies memory into a register. A store copies a register into memory. Neither operation creates a lasting connection between the two locations. Keeping the memory and register columns separate will help us follow a value as it moves through a program."
        ],
        teaching: {
          "goal": "Distinguish a byte’s address from the value stored there.",
          "bridge": "Registers hold temporary values; memory gives a program many more places to keep data.",
          "check": {
            "prompt": "Address 0x0620 contains byte 0x15. Which number identifies the location, and how many bytes farther on is address 0x0623?",
            "answer": "0x0620 identifies the location; 0x15 is its contents. Address 0x0623 is three byte locations farther on because addresses count bytes, regardless of the intended data type."
          },
          "takeaway": "An address identifies storage; its contents are a separate value.",
          "diagramAfter": 2
        }
      },
      {
        id: 'declarations',
        title: '2. DB and DW construct the image; they do not execute',
        paragraphs: [
          "NASM can place data into the binary as well as instructions. DB declares byte values; DW declares sixteen-bit words. A label before a declaration names the position of its first byte. For example, declaring a word 0x4A19 produces the bytes 19 4A at consecutive increasing addresses. We will explain this byte order in the next section.",
          "These declarations are processed while assembling. They do not run when execution reaches some imagined “variable creation” step. Once the image is loaded, its declared bytes are already present in memory. A later store can change those memory bytes, but it does not rewrite the source declaration in the editor. A fresh Run loads the newly built image again.",
          "The short layout example below combines several declarations so you can count their positions. The labels give useful names, but no hidden type tag or array length is inserted between them. Replacing one DW with the equivalent pair of DB values can produce exactly the same image. This makes a byte-level layout a good common language for assembly, file formats, and later C structures."
        ],
        teaching: {
          "goal": "Predict the bytes emitted by DB and DW data declarations.",
          "bridge": "Before a program can load useful data, we need a way to place known bytes in its image.",
          "check": {
            "prompt": "What bytes does item: dw 0x5B26 followed by end: db 0xC8 emit, and how far is end from item?",
            "answer": "The bytes are 26 5B C8. The word occupies two bytes, so end is two byte positions after item. The labels add names, not extra data."
          },
          "takeaway": "Data declarations construct bytes during assembly; loads and stores use those bytes during execution.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'data-layout.asm — declarations', source: 'first:  db 0x34, 0x12\nsecond: dw 0x5678\nlast:   db 0xaa\n; Increasing addresses contain: 34 12 78 56 AA\n; second - first = 2; last - first = 4\n' }
      },
      {
        id: 'little-endian',
        title: '3. Reconstruct a word from two bytes',
        paragraphs: [
          "For a sixteen-bit value, one byte contains the low eight bits and another contains the high eight. x86 stores the low byte at the lower address. This arrangement is called little-endian. If location p contains 0x26 and p + 1 contains 0x5B, a word load at p produces 0x5B26. Numerically, the result is 0x26 + 256 × 0x5B.",
          "The usual written number puts its most significant digit first, so a display of 5B26 and a memory dump of 26 5B agree. They show different arrangements: a numeric representation versus bytes in address order. Endianness concerns how several bytes form a value. It does not mean reversing the bits within an individual byte.",
          "Work the conversion in both directions. To store 0xC407, place 07 at the first address and C4 at the next. To read those bytes as two independent unsigned values instead, use two byte loads; their meanings become 7 and 196. The bytes have not changed. A parser must therefore know both the field width and its byte order before interpreting a sequence correctly."
        ],
        teaching: {
          "goal": "Reconstruct a word from bytes stored at increasing addresses.",
          "bridge": "DW gives us a concrete reason to learn how x86 orders a multibyte value in memory.",
          "check": {
            "prompt": "Memory at p and p + 1 contains 0x9A and 0x03. What word does a little-endian load produce, and why is it not 0x9A03?",
            "answer": "The lower address supplies the low byte, so the result is 0x039A. Its value is 0x9A + 256 × 0x03. Writing 0x9A03 would incorrectly give the first byte the high-byte weight."
          },
          "takeaway": "On x86, the least significant byte of a multibyte value lives at the lowest address.",
          "diagramAfter": 2
        }
      },
      {
        id: 'label-or-value',
        title: '4. MOV AX, label is different from MOV AX, [label]',
        paragraphs: [
          "Suppose a label item names offset 0x7D40 and the word stored there is 0x5B26. mov ax, item places the address 0x7D40 into AX. mov ax, [item] reads the word and places 0x5B26 into AX, assuming the expected data segment. The brackets are a request for memory access, not decoration around a variable name.",
          "The destination determines how much to read in these examples. AX requests two bytes; AL requests one. Thus mov al, [item + 1] reads the byte at the following address into AL. It does not automatically place that byte in AH simply because it came from the high-byte position of a stored word. Source address and destination bit position are independent choices.",
          "Actual label addresses move as code and data change, which is why the label is preferable to a memorized numeric location. Use the listing or Bytes view when you need to inspect the current placement. For the first memory checkpoint, the task identifies the supplied data and desired load. Your job is to choose whether the operand should provide a location or the contents found there."
        ],
        teaching: {
          "goal": "Choose between using a label’s address and reading the bytes at that address.",
          "bridge": "A label names a location; brackets tell NASM when that location is to be accessed.",
          "check": {
            "prompt": "A label data names offset 0x7D70 and holds bytes 08 91. Compare mov ax, data with mov ax, [data].",
            "answer": "The first copies the offset 0x7D70. The second reads two bytes and constructs 0x9108 using little-endian order. The difference comes from the brackets, while AX determines the two-byte width."
          },
          "takeaway": "A bare label supplies an address value; a bracketed operand accesses memory there.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'load-forms.asm — lesson body', source: 'mov ax, sample       ; numeric address / offset\nmov ax, [sample]     ; two bytes from memory\nmov al, [sample]     ; one byte; AH is unchanged\nmov al, [sample + 1] ; the following byte\n; Data declaration: sample: dw 0x1234\n' }
      },
      {
        id: 'load-store',
        title: '5. Loads and stores have opposite information flow',
        paragraphs: [
          "MOV still follows destination, source when memory is involved. In mov ax, [input], AX receives the word from input. In mov [output], ax, memory at output receives AX. These are called a load and a store respectively. As with register copies, the source keeps its value and there is no continuing connection between the two locations.",
          "An ordinary MOV cannot copy directly between two explicit memory operands. We use a temporary register: load from the first location, then store to the second. If input holds 0x7531 and output holds zero, the load changes AX while output remains zero. The store then changes output to 0x7531. Changing AX afterward leaves both memory words as they were.",
          "This two-step path is valuable for understanding as well as implementation. You can inspect the intermediate value and distinguish a wrong source address from a wrong destination address. Later, string instructions provide implicit memory-copy operations with their own pointer rules. Learning the explicit path first makes those compact instructions easier to reason about."
        ],
        teaching: {
          "goal": "Trace a value through a memory-to-register load and a register-to-memory store.",
          "bridge": "Once we can read memory, the same operand order lets us write it.",
          "check": {
            "prompt": "After loading 0x4682 from input into AX and storing AX into output, a program clears AX. Which copies of 0x4682 remain?",
            "answer": "Both input and output still contain 0x4682. Clearing AX changes only the register. A store copied the old value into output; it did not make output follow future AX changes."
          },
          "takeaway": "Loads and stores copy values at a moment in time.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'copy-word.asm — lesson body', source: 'mov ax, [source]\nmov [destination], ax\nmov ax, 0xffff\n; source: dw 0x1234\n; destination: dw 0\n; Both memory words are still 0x1234.\n' }
      },
      {
        id: 'operand-width',
        title: '6. The instruction chooses how many bytes to touch',
        paragraphs: [
          "A load or store also needs a width. With mov [item], ax, AX makes the width sixteen bits. With mov [item], 1, neither operand identifies whether one, two, or more bytes should be written. NASM therefore needs an explicit size such as byte or word for this otherwise ambiguous form.",
          "Assume item initially contains bytes 26 5B and a neighboring byte contains C8. A byte store of 0x77 at item gives 77 5B C8. A word store of 0x0077 at the same address gives 77 00 C8. A word store beginning at item + 1 touches the old high byte and the neighboring byte. The CPU follows the address and width; a previous DW declaration does not impose a runtime boundary.",
          "This is why memory debugging should draw a small region rather than display only the intended value. A nearby byte can reveal an over-wide store that happens to leave the target looking plausible. In later chapters, the same reasoning will protect adjacent descriptor fields, allocator metadata, and device registers. Correctness includes the bytes that should remain unchanged."
        ],
        teaching: {
          "goal": "Determine every byte touched by a memory operation.",
          "bridge": "The start address tells us where an access begins, but not where it ends.",
          "check": {
            "prompt": "The bytes at p, p + 1, and p + 2 are 11 22 33. What follows a word store of 0xABCD at p + 1?",
            "answer": "They become 11 CD AB. The store begins at p + 1 and writes two little-endian bytes, so p + 2 changes as well. The byte at p is outside the destination range."
          },
          "takeaway": "A memory access is a starting address plus a width, not just one location.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'width.asm — independent experiments', source: 'mov byte [value], 0xaa ; 34 12 becomes AA 12\n; On a fresh run instead try:\n; mov word [value], 0xaa ; 34 12 becomes AA 00\n; Data: value: dw 0x1234\n' }
      },
      {
        id: 'partial-register',
        title: '7. A byte load does not clear the rest of AX',
        paragraphs: [
          "If AX contains 0x7C90 and a byte load writes 0x25 into AL, AX becomes 0x7C25. Reading from memory does not change the meaning of the AL destination: only its eight bits are replaced. This often explains a hexadecimal output with an unexpected high byte. The load was correct, but the wider value was never fully initialized.",
          "For an unsigned byte, zero extension gives the intended wider number. You can clear AX before the load or use MOVZX to define the entire result directly. Those approaches have different flag effects: XOR changes arithmetic flags, whereas MOV and MOVZX do not. If flags are still needed from an earlier calculation, the initialization choice becomes part of the reasoning.",
          "A signed byte needs sign extension instead. For instance, byte 0xD8 represents unsigned 216 or signed −40. The wider forms are 0x00D8 and 0xFFD8 respectively. The memory location does not tell the instruction which meaning to preserve; the surrounding data format does. Decide the interpretation before choosing how to fill the high bits."
        ],
        teaching: {
          "goal": "Turn a byte load into a fully defined wider value.",
          "bridge": "A narrow memory access obeys the same overlapping-register rules we already learned.",
          "check": {
            "prompt": "AX starts at 0x5500 and a byte load puts 0x81 into AL. What is AX, and what would the unsigned widened value have been?",
            "answer": "AX becomes 0x5581 because AH remains 0x55. The intended unsigned widening would be 0x0081, so the high byte needs explicit zeroing or zero extension."
          },
          "takeaway": "A byte load defines one byte; a wider interpretation needs the remaining bits defined too.",
          "diagramAfter": 2
        }
      },
      {
        id: 'owned-memory',
        title: '8. A valid address expression is not permission to use it',
        paragraphs: [
          "A bare-metal computer contains many kinds of memory: your instructions, your data, the stack, firmware tables, and device regions. An encodable address does not tell us that a location is free to use. For these small experiments, declaring a data buffer in the image gives us a known region whose contents and size we can explain.",
          "Suppose a buffer begins at b and contains six bytes. Its valid byte positions are b through b + 5, often written as the half-open range [b, b + 6). A word load at b + 4 fits because it reads positions four and five. A word load at b + 5 does not fit, even though its starting byte is inside the buffer. The complete range matters.",
          "The lesson setup places code and initialized data in the boot image and uses a downward-growing stack below it. That organization makes the examples manageable; it does not reserve every nearby address for your routine. As our kernel grows, explicit memory maps and allocators will replace these small fixed regions. The underlying question remains the same: which component owns every byte this instruction may touch?"
        ],
        teaching: {
          "goal": "Check that an entire access fits inside the region reserved for its data.",
          "bridge": "Address syntax can be valid even when the selected bytes belong to something else.",
          "check": {
            "prompt": "A buffer owns eight bytes beginning at 0x0800. Is a word load starting at 0x0807 entirely inside it?",
            "answer": "No. The buffer includes 0x0800 through 0x0807, but the word load also reads 0x0808. Its first byte is valid and its second byte is outside the owned range."
          },
          "takeaway": "Check the whole accessed range, including the last byte.",
          "diagramAfter": 2
        }
      },
      {
        id: 'memory-experiment',
        title: '9. Repair a real byte reconstruction',
        paragraphs: [
          "The memory checkpoint asks you to build a word from supplied bytes, save it in another location, and read the saved value back. Each stage answers a different question. The first loads show whether you selected the right source bytes. The store shows whether you wrote the reconstructed word. The final reload shows whether the value really reached the destination memory.",
          "Use a separate paper example such as bytes 31 and 8A. Placing the first in AL and the second in AH gives AX = 0x8A31. A word store writes 31 followed by 8A; clearing AX and reloading that stored word gives 0x8A31 again. Reading the first source address twice would instead duplicate one byte, so an asymmetric pair makes that error easy to see.",
          "Apply the same reasoning to the input named in the checkpoint rather than replacing the calculation with a familiar output constant. The behavior tests vary machine inputs and inspect relevant results. Their report helps locate a mismatch, while your byte trace explains its cause. If the store stage is wrong, correct that stage before changing the output routine, which can only display the value it receives."
        ],
        teaching: {
          "goal": "Build a load–store–load path that follows the input bytes.",
          "bridge": "We can now combine address selection, byte order, and copy direction in one routine.",
          "check": {
            "prompt": "A pair of source bytes is 42 9D. A routine mistakenly loads both AL and AH from the first address. What word results, and which address choice needs correction?",
            "answer": "The result is 0x4242. The high-byte load needs to read the next source address, whose byte is 0x9D; choosing that address would assemble the word 0x9D42."
          },
          "takeaway": "Follow values through each stage so a wrong output can be traced to a particular access.",
          "diagramAfter": 2
        }
      },
      {
        id: 'memory-explain',
        title: '10. Explain the mechanism without running it',
        paragraphs: [
          "Consider a stored word 0x6D24. In increasing address order its bytes are 24 6D. Replacing the first byte with 0x90 gives 90 6D, so a later word load reads 0x6D90. A word store of 0x0090 would instead write 90 00 and produce a different result. The address is the same in both cases; the width changes the effect.",
          "This example is worth explaining without running it. First draw the bytes, then mark the store’s range, then reconstruct the value. Nothing needs to know that the label originally used DW. The declaration chose initial bytes, while the executed instruction chose which bytes changed. The same method works for a field inside a larger file header or a device structure.",
          "The next chapter keeps this byte model and examines how x86 finds the address in the first place. Brackets request an access, but the registers inside them follow particular encoding rules. We will also account for segment registers, so that a numerical offset becomes a concrete physical location in the real-mode machine."
        ],
        teaching: {
          "goal": "Explain how a byte store changes part of a stored word.",
          "bridge": "A small edit in memory brings together width, byte order, and register-independent storage.",
          "check": {
            "prompt": "A word contains 0x4C18. A byte store changes the byte at its second address to 0xA2. What word will a later load read?",
            "answer": "The original bytes are 18 4C. The second byte is the high byte, so the new bytes are 18 A2 and the word becomes 0xA218."
          },
          "takeaway": "Draw the bytes first when reasoning about partial updates to multibyte values.",
          "diagramAfter": 2
        }
      }
    ],
    lab: 'boot',
    challenge: {
      title: 'Rebuild and copy a little-endian word',
      brief: 'Repair the complete bootable program so two byte loads reconstruct BEEF, store that word into copy, and load it again for printing. Then test a second input pair.',
      language: 'asm', starter: memoryStarter, solution: memorySolution,
      tasks: ['Predict the starter’s output and explain the repeated byte.', 'Repair the second load without replacing the input with an immediate word.', 'Boot and observe BEEF, then test bytes 07 and A1 and observe A107.', 'Explain which two addresses the store modifies and why AL alone cannot hold the result.'],
      hints: ['A label names the first byte of its declaration.', 'AH and AL are separate eight-bit portions of AX.', 'The second byte lives one address after packet; the word store uses AX to establish its width.'],
      explanation: 'The first load fills AL with EF and the second fills AH with BE. AX is therefore BEEF. Storing AX emits EF then BE into copy, and the subsequent word load reconstructs the same value. Printing BEEF alone is only one observed case; the modified input checks whether your reasoning generalizes.',
      checks: ['The repaired source boots and displays BEEF.', 'The second input case displays A107 without changing the copying algorithm.', 'I can draw both memory bytes before and after the store.', 'I can distinguish a label value from a load through that label.']
    },
    assembly: {
      title: 'Byte reconstruction', example: memoryExample, starter: memoryStarter, solution: memorySolution, expectedOutput: 'BEEF',
      instructions: 'Build the byte reconstruction in three checkpoints: load one byte, add its high neighbor, then store and reload a copy that prints BEEF.',
      hints: ['Predict EFEF from the two original reads.', 'Use packet + 1 for the high byte.', 'Keep the store and reload so you exercise memory in both directions.'],
      question: { prompt: 'A word contains 0x0201. You store byte 0xAA at its first address. What unsigned decimal value does a word load now return?', answer: 682, explanation: 'The bytes become AA 02. The word is 0x02AA = 2 × 256 + 170 = 682.' }
    },
    reflection: {
      prompt: 'A learner says “MOV AL, [value] reads my word variable, so AX should now equal that word.” Diagnose the statement, give a concrete counterexample, and describe an experiment that separates the address, width, and partial-register issues.',
      rubric: ['Identifies the eight-bit load width from AL', 'Explains that AH keeps its previous value', 'Separates the label’s address from the memory contents', 'Uses concrete before/after bytes and register values'],
      modelAnswer: 'With AX=ABCD and value containing bytes 34 12, MOV AL,[value] reads only 34 and leaves AX=AB34. The label does not enforce the DW declaration’s width. MOV AX,[value] would read both bytes and produce 1234. MOV AX,value would instead load the address. I would run those three variants from the same initialized state and compare printed AX values and the emitted data bytes.'
    },
    sources: [intel, nasmLanguage],
    nextBuild: 'Keep the memory trace habit. Next translate a source-level address expression into a real-mode segment and offset.'
  },
  {
    id: 'A06',
    slug: 'assembly-addressing',
    title: 'Addressing: from BX + SI to a physical byte',
    subtitle: 'Follow an address from the registers inside brackets to a physical byte, then use it to select an array element.',
    phase: 'x86 Assembly',
    minutes: 115,
    prerequisites: ['Explain byte-addressed memory and little-endian words', 'Distinguish MOV AX,label from MOV AX,[label]', 'Trace loads, stores, and partial-register changes'],
    outcomes: ['Calculate real-mode addresses from segment:offset pairs', 'Use the legal sixteen-bit addressing combinations deliberately', 'Explain the BP default-segment rule and explicit segment overrides', 'Distinguish ORG, load location, and runtime segment state', 'Calculate an array element address without confusing indices with byte offsets'],
    sections: [
      {
        id: 'address-stages',
        title: '1. Address formation is a sequence of questions',
        paragraphs: [
          "In ordinary real-mode addressing, a memory reference has a segment and an offset. The segment value selects a base by multiplying by sixteen. The effective offset identifies a position relative to that base. For the low addresses used in these lessons, with paging disabled, adding them gives the physical address of the byte.",
          "For example, DS = 0x1200 gives a base of 0x12000. If BX = 0x0034, a byte load through [bx] normally uses DS and accesses 0x12034. BX by itself contains only the offset. Changing DS while keeping BX unchanged usually selects a different physical location, even though the instruction text looks identical.",
          "Follow the calculation in stages: compute the effective offset, select the segment, derive its base, then add the offset. Finally apply the operand width to identify every byte accessed. We keep these examples below one MiB and within segment limits so that address-line and boundary complications do not obscure the basic model. Protected mode will later change how the segment base is obtained."
        ],
        teaching: {
          "goal": "Calculate a real-mode address from its segment and effective offset.",
          "bridge": "Memory instructions need a rule for turning their operands into a byte location.",
          "check": {
            "prompt": "With DS = 0x1400 and BX = 0x0058, which physical byte does mov al, [bx] read under this lesson’s assumptions?",
            "answer": "DS contributes base 0x14000. Adding offset 0x0058 gives physical address 0x14058. AL makes the access one byte wide."
          },
          "takeaway": "Compute offset, segment base, and access width as separate steps.",
          "diagramAfter": 2
        }
      },
      {
        id: 'alias-pairs',
        title: '2. Different segment:offset pairs can name the same byte',
        paragraphs: [
          "A physical location can have more than one segment:offset representation. The pairs 1000:0020 and 1002:0000 both identify 0x10020. In the first, the base is 0x10000 and the offset adds 0x20. In the second, the base itself is 0x10020. Segment boundaries are therefore not automatically separate allocations of memory.",
          "The familiar boot address illustrates the same idea: 0000:7C00 and 07C0:0000 both reach physical 0x7C00. Firmware may enter the loaded sector using a representation that a bootloader should not blindly assume. Our setup normalizes the code location and establishes data and stack segments before calling your lesson. We will construct those steps in the bootloading module.",
          "An equivalent pair requires coordinated changes. Increasing a segment by one moves its base forward sixteen bytes, so the offset must decrease by sixteen to preserve the physical address, provided the new offset remains representable. Merely changing the segment notation in your explanation does not change the actual segment register used by the CPU."
        ],
        teaching: {
          "goal": "Show how two segment:offset pairs can identify the same physical byte.",
          "bridge": "Because real-mode bases advance in sixteen-byte steps, segments can overlap.",
          "check": {
            "prompt": "Find a segment:offset pair with segment 0x1801 that reaches the same byte as 1800:0030.",
            "answer": "The first address is 0x18000 + 0x30 = 0x18030. Segment 0x1801 has base 0x18010, so its offset must be 0x0020. Thus 1801:0020 is equivalent."
          },
          "takeaway": "Different visible address pairs may describe the same physical location.",
          "diagramAfter": 2
        }
      },
      {
        id: 'legal-forms',
        title: '3. Sixteen-bit address forms are a finite menu',
        paragraphs: [
          "For sixteen-bit addressing, x86 offers a specific menu: BX, BP, SI, DI, and the pairs BX + SI, BX + DI, BP + SI, BP + DI. Each can include a constant displacement; a direct constant address is also possible. This is why [bx + si + 4] can describe an address while [ax + cx] cannot use the same address-size encoding.",
          "The assembler is not a general expression evaluator that invents extra runtime calculations inside brackets. It can simplify constants and select an available encoding, but the CPU must have a form for the requested registers. If an algorithm needs AX + CX, calculate or copy that value into a legal address register before the memory access, while tracking the values and flags those extra instructions change.",
          "Later x86 address sizes add different forms, including scaled indexes. We stay with sixteen-bit forms here so that each address calculation remains explicit. For a word array, for instance, multiplying an index by two is a separate calculation rather than a sixteen-bit [si * 2] operand. Distinguishing the mathematical address from its machine encoding helps explain assembler errors constructively."
        ],
        teaching: {
          "goal": "Recognize the register combinations supported by 16-bit effective-address encoding.",
          "bridge": "The offset calculation resembles arithmetic, but its available forms come from the instruction encoding.",
          "check": {
            "prompt": "Why does [bx + di + 6] fit a 16-bit address form while [si + di] does not?",
            "answer": "BX + DI is one of the encoded base-and-index pairs, and six is an allowed displacement. The sixteen-bit addressing menu has no SI + DI pair, even though the sum is mathematically meaningful."
          },
          "takeaway": "A valid mathematical address expression still needs a supported machine encoding.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'effective-addresses.asm — forms', source: '; Encodable with a 16-bit address size:\nmov ax, [bx]\nmov ax, [si + 2]\nmov ax, [bx + di + 6]\nmov ax, [bp + si + 4]\n; Not encodable as 16-bit addresses:\n; mov ax, [ax]\n; mov ax, [bx + bp]\n; mov ax, [si * 2]\n' }
      },
      {
        id: 'default-segment',
        title: '4. BP changes the default segment selection',
        paragraphs: [
          "Ordinary sixteen-bit memory operands generally use DS, but forms containing BP default to SS. BP is commonly used to locate items on the stack, so this default makes stack-frame accesses convenient. The rule depends on BP appearing in the effective address, not on the name of the data or on the programmer’s intention.",
          "Imagine DS = 0x1000, SS = 0x1800, BX = BP = 0x0040, and SI = 2. Both [bx + si] and [bp + si] compute offset 0x0042. The first accesses physical 0x10042; the second accesses 0x18042. Identical offset numbers do not guarantee identical bytes when the segment choice differs.",
          "Our harness initially sets these segments to the same value, which can hide an accidental segment selection in a small experiment. Learn to annotate the default even when the current bases happen to match. Keep differing-segment examples as paper traces rather than changing SS casually in a live routine, where the active stack and return address also depend on it."
        ],
        teaching: {
          "goal": "Predict when a BP-based address uses SS instead of DS.",
          "bridge": "Once the offset is known, we must identify which segment supplies its base.",
          "check": {
            "prompt": "If DS and SS differ, can replacing BX with an equal-valued BP change the byte read by mov al, [register]? Explain.",
            "answer": "Yes. BX defaults to DS, while BP defaults to SS in these sixteen-bit forms. The offset can stay equal while the segment base changes, selecting another physical byte."
          },
          "takeaway": "An addressing register can influence both the offset and the default segment.",
          "diagramAfter": 2
        }
      },
      {
        id: 'segment-override',
        title: '5. An override selects a segment; it does not change its value',
        paragraphs: [
          "A segment override tells one memory operand which segment register to use. For example, [ds:bp + 2] calculates the offset from BP + 2 but chooses DS instead of BP’s usual SS default. The override is encoded as part of the instruction. It does not change BP or load a new value into DS.",
          "Suppose DS = 0x1100, SS = 0x2200, and BP = 0x0030. A byte read from [bp + 2] normally reaches 0x22032. A read from [ds:bp + 2] reaches 0x11032. The offset calculation is identical; only the selected base changes. Separating these stages is the clearest way to understand the effect.",
          "The checkpoint uses an override so a BP-based array access deliberately refers to data. This makes the address choice visible in source even when the harness has equal segment values. In a larger program, explicit overrides should express a real reason rather than compensate for unexplained state. They select among existing segment values; they cannot repair a segment register that was initialized incorrectly."
        ],
        teaching: {
          "goal": "Use an explicit segment selection without confusing it with a segment-register write.",
          "bridge": "Sometimes the desired data segment differs from the default chosen by the address form.",
          "check": {
            "prompt": "Does mov al, [es:si] alter ES? What two inputs determine the starting real-mode address?",
            "answer": "It does not alter ES. The current ES value supplies the base ES × 16, and the effective offset comes from SI. The instruction selects ES for this access rather than rewriting it."
          },
          "takeaway": "A segment override selects a base for one access; it does not initialize that base.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'segment-choice.asm — conceptual trace', source: '; Given DS=1000h, SS=2000h, BP=0030h, SI=2:\nmov ax, [bp + si]    ; SS:0032 -> physical 20032h\nmov ax, [ds:bp + si] ; DS:0032 -> physical 10032h\n; Each instruction reads two consecutive bytes.\n' }
      },
      {
        id: 'origin-contract',
        title: '6. ORG changes assembled addresses, not the CPU',
        paragraphs: [
          "ORG tells NASM which starting origin to assume when assigning addresses inside a flat binary. If the origin is 0x7C00 and a label is thirty-two bytes into the image, the label’s value is 0x7C20. The directive influences address calculations during assembly; it does not move the output file into memory or ask firmware to load it there.",
          "The loader’s placement and the segment setup must make those values useful at runtime. With DS = 0 and the image loaded at physical 0x7C00, the label value 0x7C20 addresses the intended byte. A different design could use another segment base and matching offsets. What matters is that all three parts agree: assembled values, actual load address, and address formation.",
          "Some relative branches can keep working despite a misplaced image because both endpoints move together. Absolute data references may fail first, producing misleading symptoms such as correct control flow with the wrong string. When a memory access surprises you, check the label’s assembled value and the actual segment base instead of treating ORG as a runtime relocation operation."
        ],
        teaching: {
          "goal": "Explain how ORG relates assembled label values to the loader’s placement.",
          "bridge": "Absolute label values must agree with where the image is actually placed.",
          "check": {
            "prompt": "With ORG 0x8000, a label lies 0x30 bytes after the image start. What value does it have, and does that prove the image was loaded at 0x8000?",
            "answer": "The label value is 0x8030. That proves only the assembler’s assumed origin. A loader must still place the bytes appropriately, and runtime segment values must make references reach them."
          },
          "takeaway": "ORG states an assembly-time assumption; the loader and CPU setup must make it true.",
          "diagramAfter": 2
        }
      },
      {
        id: 'lea',
        title: '7. LEA calculates an offset without reading memory',
        paragraphs: [
          "LEA means load effective address. It calculates the offset described by its bracketed expression and writes that offset to a register without reading memory at the result. If BX = 0x0200 and DI = 6, lea si, [bx + di + 2] gives SI = 0x0208. No data byte at 0x0208 is fetched by that instruction.",
          "Compare mov ax, [bx + di + 2]. That instruction uses the same offset expression to access a word in memory. LEA provides a location for later use; MOV retrieves contents from a location now. In these sixteen-bit examples, LEA produces the effective offset, not a segment-base-plus-offset physical address. The eventual memory access still chooses a segment.",
          "This separation is useful when stepping through arrays or passing a pointer to a routine. It also explains why brackets cannot always be read as “fetch the contents”: LEA is the instruction-specific exception being introduced here. LEA leaves arithmetic flags unchanged, which can be helpful when an address calculation must not replace a comparison’s result."
        ],
        teaching: {
          "goal": "Distinguish calculating an effective offset from loading the value stored there.",
          "bridge": "Sometimes an algorithm needs the address of an item before it needs the item itself.",
          "check": {
            "prompt": "BX is 0x0300 and SI is 4. Compare lea di, [bx + si] with mov di, [bx + si].",
            "answer": "LEA writes the offset 0x0304 into DI without reading memory. MOV reads a word using that offset and the selected segment, then writes the retrieved contents into DI."
          },
          "takeaway": "LEA computes an offset; an ordinary memory MOV accesses the bytes at an address.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'lea-versus-load.asm — lesson body', source: 'mov bx, values\nxor di, di\nlea si, [bx + di + 2] ; address of the second word\nmov ax, [si]         ; contents of the second word\ncall print_hex16\n; Data: values: dw 0x1111, 0x2222, 0x3333\n' }
      },
      {
        id: 'array-stride',
        title: '8. An array index is not yet a byte offset',
        paragraphs: [
          "For elements of size s bytes, zero-based element i begins at base + i × s. A word array uses s = 2. Its first, second, and third elements therefore begin at byte offsets 0, 2, and 4. The index 2 means the third element, while the byte offset 2 means the second word. Naming which quantity a register holds prevents this common mix-up.",
          "Imagine words 0x1203, 0x4506, and 0x7809. Their six bytes are 03 12 06 45 09 78. A load at offset four produces the third word. A load at offset one instead combines 12 and 06 into 0x0612. x86 can encode that unaligned read, but it is not an element of the intended array.",
          "For the checkpoint, derive the displacement from the requested element index and combine it with the requested address form and segment selection. The array’s length supplies another condition: the complete word must fit within its six bytes. Computing an address successfully is not the same as selecting a valid element."
        ],
        teaching: {
          "goal": "Convert an element index into the correct byte offset.",
          "bridge": "Once data is arranged as an array, each element’s width determines the distance to its neighbor.",
          "check": {
            "prompt": "A five-element word array begins at b. Where does zero-based element 3 begin, and which byte positions does it occupy?",
            "answer": "Its byte offset is 3 × 2 = 6. It occupies b + 6 and b + 7, which are the seventh and eighth bytes of the ten-byte array."
          },
          "takeaway": "An element index becomes a byte offset only after multiplying by the element size.",
          "diagramAfter": 2
        }
      },
      {
        id: 'offset-overflow',
        title: '9. Offsets have a width and a boundary',
        paragraphs: [
          "A sixteen-bit effective-address calculation retains sixteen bits of offset. If BX = 0xFFF8 and SI = 0x0018, their mathematical sum is 0x10010, but the effective offset is 0x0010. Only after that offset is formed do we combine it with the selected segment base. Adding all the terms as an unlimited integer would predict the wrong address.",
          "A starting offset is only part of a multibyte access. Near the end of a segment, a word can extend beyond the permitted range even when its first byte seems valid. Segment-limit and address-line behavior need mode-specific care, so the practical experiments here keep whole operands inside their segment and below one MiB. We will study A20 and mode transitions separately.",
          "The general lesson scales to larger code. An array index multiplied by its stride can overflow before a bounds comparison if the computation uses too narrow a type. A base plus a length can wrap as well. Reason about both the arithmetic that constructs an address and the range that the resulting access occupies. They are distinct opportunities for an error."
        ],
        teaching: {
          "goal": "Account for the width of an effective offset before adding the segment base.",
          "bridge": "The arithmetic used to find an address is finite-width arithmetic too.",
          "check": {
            "prompt": "With a sixteen-bit effective address, what offset results from 0xFFF4 + 0x0020? At what stage is the segment base added?",
            "answer": "The full sum is 0x10014, so the retained offset is 0x0014. The selected segment base is added after forming that sixteen-bit offset."
          },
          "takeaway": "Address arithmetic has a width; reason about its wraparound before interpreting the location.",
          "diagramAfter": 2
        }
      },
      {
        id: 'addressing-evidence',
        title: '10. Explain the bytes your address selected',
        paragraphs: [
          "When a program reads an unexpected word, “the pointer is wrong” is only a starting description. We can ask more precise questions: was the index converted into bytes, was the intended segment selected, did the offset wrap, and did the whole access fit? Each question identifies a stage that can be checked with a small trace.",
          "Distinct asymmetric words make useful examples. Repeated patterns such as 0x1111 can hide byte-order errors, while values such as 0x2A17 and 0x6C39 reveal which neighboring bytes were combined. Work out both the intended aligned read and an offset-one read on paper. The wrong result then becomes an explanation of the address mistake rather than an arbitrary hexadecimal surprise.",
          "At the checkpoint, the behavior tests exercise the address calculation with supplied states. Read a failing case as a concrete machine situation, then retrace the stages that should lead to its expected byte. The next chapter adds decisions: instead of only calculating and copying data, we will choose different instruction paths based on the values we find."
        ],
        teaching: {
          "goal": "Diagnose an address using offset, segment, width, and array bounds.",
          "bridge": "All the address-generation pieces can now explain one complete memory access.",
          "check": {
            "prompt": "Two words are 0x3A15 and 0x7C29. What word would a read at byte offset one produce, and what mistake might explain it?",
            "answer": "The bytes are 15 3A 29 7C, so the offset-one word is 0x293A. That result suggests a one-byte displacement or stride where a whole two-byte element was intended."
          },
          "takeaway": "Unexpected data often reveals the exact address calculation that selected it.",
          "diagramAfter": 2
        }
      }
    ],
    lab: 'boot',
    challenge: {
      title: 'Select the third word through a segmented address',
      brief: 'Repair the byte displacement used to load element index two from a word array. Keep the DS override and explain the BP default it replaces.',
      language: 'asm', starter: addressingStarter, solution: addressingSolution,
      tasks: ['Predict why the starter prints 2222.', 'Repair the offset so the machine prints 3333.', 'Test all three valid indices and explain the two-byte stride.', 'Calculate the same offset under unequal DS and SS values on paper.'],
      hints: ['Element indices count objects; offsets count bytes.', 'A word occupies two bytes, so index two begins four bytes after the base.', 'BP normally selects SS in these address forms; the explicit DS override selects the array’s segment.'],
      explanation: 'BP contains the base offset. SI must contain 2 × 2 = 4, the byte displacement of zero-based element two. The DS override makes the load use DS even though the effective address contains BP. With DS=0, the computed offset reaches the array stored in the boot image.',
      checks: ['The repaired program boots and prints 3333.', 'I tested offsets 0, 2, and 4 and can name their indices.', 'I can explain why ORG does not initialize DS.', 'I can calculate an example where BP and BX select different physical bytes.']
    },
    assembly: {
      title: 'Element address calculation', example: addressingExample, starter: addressingStarter, solution: addressingSolution, expectedOutput: '3333',
      instructions: 'Build your array reader one step at a time, then select element index two using a two-byte word stride and an explicit DS override.',
      hints: ['The third element has index two.', 'Its offset from the base is four bytes.', 'Keep [ds:bp + si] so segment selection stays explicit.'],
      question: { prompt: 'With DS=0x1234 and effective offset 0x0040, what is the physical byte address in decimal? Assume ordinary real mode and an address below one MiB.', answer: 74624, explanation: '0x1234 × 16 + 0x0040 = 0x12340 + 0x0040 = 0x12380 = 74624.' }
    },
    reflection: {
      prompt: 'A word load through [BX+SI] works. Replacing BX with BP produces different data even though BX and BP contain the same value. Explain how this is possible, what evidence you need, and two ways to preserve the intended address.',
      rubric: ['Identifies DS versus SS default selection', 'Computes both addresses using concrete segment values', 'Distinguishes an explicit override from changing a segment register', 'States the pointer’s segment contract rather than guessing'],
      modelAnswer: 'In sixteen-bit addressing, BX+SI defaults to DS and BP+SI defaults to SS. If DS=1000h, SS=2000h, BX=BP=30h, and SI=2, they access 10032h and 20032h. I would inspect both segment registers and the offset calculation. Keeping BX preserves the original default; using [ds:bp+si] explicitly preserves DS while retaining BP. Changing SS merely to make the numbers match could corrupt stack operations and is not an appropriate local repair.'
    },
    sources: [intel, nasmLanguage, nasmBinary],
    nextBuild: 'You can now say exactly where an operand comes from. Next decide which instruction executes after comparing two operands.'
  },
  {
    id: 'A07',
    slug: 'assembly-branches',
    title: 'Decisions: comparisons, flags, and conditional jumps',
    subtitle: 'Build an if/else from comparisons and jumps, and learn why signed and unsigned values can choose different paths.',
    phase: 'x86 Assembly',
    minutes: 115,
    prerequisites: ['Trace arithmetic results and the ZF, CF, SF, and OF flags', 'Interpret an eight-bit or sixteen-bit pattern as signed or unsigned', 'Read labels and distinguish data accesses from immediate values'],
    outcomes: ['Explain CMP as subtraction whose result is discarded', 'Choose signed or unsigned jump conditions based on the problem’s interpretation', 'Track which instruction last wrote every flag a branch reads', 'Translate if/else and short-circuit conditions into labels and jumps', 'Construct tests that expose equality, overflow, and inverted-condition bugs'],
    sections: [
      {
        id: 'instruction-pointer',
        title: '1. A decision changes the next instruction address',
        paragraphs: [
          "Suppose a program should print one message when a value is zero and another when it is nonzero. The processor does not have a special source-level if block. It has an instruction pointer and branch instructions that choose where execution continues. A conditional branch either jumps to its target or falls through to the next sequential instruction.",
          "A label gives a readable name to the target. The label itself does not execute; the first instruction at that position does. In a control-flow diagram, draw a box for each group of straight-line instructions and arrows for the possible next groups. The branch condition labels the arrow that is taken, while the other arrow represents fall-through.",
          "This picture makes two common mistakes visible. A branch can test the wrong condition, or the correct branch can land at a place whose later flow is wrong. For example, a true arm that falls directly into the false arm may print both messages. We will first learn how comparisons produce conditions, then how to arrange the paths around them."
        ],
        teaching: {
          "goal": "Represent a decision as a choice of the next instruction address.",
          "bridge": "The programs so far mostly follow one path; a useful routine often needs to choose between paths.",
          "check": {
            "prompt": "A conditional jump is not taken. Does execution stop, return to the caller, or continue elsewhere? Explain the usual next address.",
            "answer": "It falls through to the instruction immediately after the branch encoding. A separate halt, return, or jump would be needed for another behavior."
          },
          "takeaway": "A conditional jump chooses between its target and ordinary fall-through.",
          "diagramAfter": 2
        }
      },
      {
        id: 'cmp',
        title: '2. CMP computes flags as though it subtracted',
        paragraphs: [
          "CMP performs the flag calculation of a subtraction without storing the numerical result. cmp ax, bx asks what flags AX − BX would produce, while leaving both registers unchanged. This makes it possible to test a relationship and still use the original values afterward.",
          "If AX and BX are equal, their difference is zero, so ZF becomes one. If AX is below BX as an unsigned number, the subtraction needs a borrow, so CF becomes one. Signed ordering uses the combination of SF and OF. CMP itself does not choose an interpretation; the later conditional jump chooses which flags express the question we intend to ask.",
          "Operand order matters because subtraction is directional. With AX = 4 and BX = 9, cmp ax, bx describes 4 − 9; reversing the operands describes 9 − 4. Equality agrees in either direction, but less-than and greater-than do not. Read comparisons as complete sentences before selecting a jump mnemonic."
        ],
        teaching: {
          "goal": "Predict the flags from CMP without changing its operands.",
          "bridge": "A branch needs a condition; CMP obtains one by asking how two values differ.",
          "check": {
            "prompt": "AX is 12 and BX is 12. After cmp ax, bx, what happens to the registers and to ZF?",
            "answer": "AX and BX remain 12 because CMP discards the subtraction result. ZF becomes one because the computed difference is zero."
          },
          "takeaway": "CMP keeps the operands and replaces flags with those of their subtraction.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'compare.asm — trace', source: 'mov ax, 5\ncmp ax, 3   ; conceptual 5 - 3 = 2; AX stays 5\nje .equal   ; not taken, because ZF=0\n; ...\n.equal:\n' }
      },
      {
        id: 'equality',
        title: '3. Equality needs ZF, not a signedness choice',
        paragraphs: [
          "After CMP, ZF is one exactly when the compared patterns are equal. JE, jump if equal, tests that condition. JNE tests the opposite. The names JZ and JNZ refer to the same respective conditions: zero or nonzero. JE reads naturally after a comparison, while JZ can read naturally after an arithmetic result.",
          "Signedness does not change equality. The byte 0xF0 equals another 0xF0 whether both are described as unsigned 240 or signed −16. Ordering changes with interpretation, but equality of the bit patterns does not. This lets us handle many simple conditions before introducing separate signed and unsigned jump families.",
          "The flag still needs to come from the intended operation. A JZ immediately after CMP can test equality; the same JZ after an unrelated ADD tests whether that addition’s retained result was zero. The mnemonic does not remember the earlier comparison. Keep the producer and consumer close while learning so their relationship stays visible."
        ],
        teaching: {
          "goal": "Use ZF to choose an equality or inequality path.",
          "bridge": "Equality is the first comparison because it does not depend on signed interpretation.",
          "check": {
            "prompt": "After comparing equal bytes, a MOV copies a register and JE follows. Does MOV prevent JE from seeing the comparison’s equality result?",
            "answer": "No. MOV does not modify the arithmetic flags, so JE still reads the ZF set by CMP. An intervening flag-changing arithmetic instruction could make it test a different result."
          },
          "takeaway": "Equality is a ZF question, independent of signedness.",
          "diagramAfter": 2
        }
      },
      {
        id: 'unsigned',
        title: '4. Unsigned order uses carry and zero',
        paragraphs: [
          "For unsigned comparisons, the jump names use below and above. After CMP destination, source, JB means the first operand is below the second and tests CF = 1. JAE means above or equal and tests CF = 0. JBE includes equality by testing CF or ZF, while JA requires both flags to be zero.",
          "For example, compare an unsigned byte 220 with 30. The subtraction needs no unsigned borrow, so the first is above the second. Its top bit being set does not make it a negative count. Choosing a signed “less” jump would ask a different question because the same 220 pattern would be interpreted as −36.",
          "Boundary choices matter for array checks. If valid indexes are 0 through length − 1, an index equal to length must be rejected. An unsigned above-or-equal condition expresses that rejection. Writing a small table for below, equal, and above cases makes it clear whether the branch should include equality before any machine run is needed."
        ],
        teaching: {
          "goal": "Choose unsigned conditional jumps for counts and unsigned quantities.",
          "bridge": "Values such as array lengths need ordering according to their unsigned magnitude.",
          "check": {
            "prompt": "For an unsigned array index, valid indexes are below length 6. Should index 6 enter the body, and which comparison relationship rejects it?",
            "answer": "It should not enter. An index greater than or equal to the length is outside the valid range, so an unsigned above-or-equal rejection after comparing index with length handles both 6 and larger values."
          },
          "takeaway": "Choose below/above conditions when the operands represent unsigned magnitudes.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'unsigned-bound.asm — pattern', source: '; AX is an unsigned index; CX is an element count.\ncmp ax, cx\njae .out_of_bounds  ; reject index >= count\n; access is still subject to valid address arithmetic\njmp .done\n.out_of_bounds:\n; report / reject\n.done:\n' }
      },
      {
        id: 'signed',
        title: '5. Signed order must account for overflow',
        paragraphs: [
          "Signed jump names use less and greater. After CMP, JL tests SF ≠ OF, while JGE tests SF = OF. JLE includes equality through ZF, and JG requires a nonzero difference with SF = OF. The overflow flag is needed because a subtraction can wrap before its retained sign is inspected.",
          "Consider signed bytes −100 and 40. Their mathematical difference is −140, which is outside the byte’s signed range. The retained pattern is positive 116, so SF is zero even though the first value really is less. OF is one, making SF ≠ OF true. The signed condition corrects for the misleading retained sign.",
          "You do not need to memorize this as a mysterious Boolean formula. Start with the question “does the mathematical signed difference lie below zero?” If there is no overflow, SF answers it. If overflow flipped the sign, OF tells us to reverse that answer. The signed branch family packages this reasoning into one instruction."
        ],
        teaching: {
          "goal": "Derive signed ordering from SF and OF rather than the sign bit alone.",
          "bridge": "Negative values require a comparison that accounts for signed overflow.",
          "check": {
            "prompt": "Why would testing only SF after comparing signed bytes −110 and 30 give the wrong ordering?",
            "answer": "Their mathematical difference is −140, which wraps to positive 116 in a byte. SF is zero, but OF is one. JL tests SF ≠ OF and correctly recognizes that −110 is less than 30."
          },
          "takeaway": "Signed comparisons use overflow to interpret the retained sign correctly.",
          "diagramAfter": 2
        }
      },
      {
        id: 'flags-lifetime',
        title: '6. Flags are shared state with a short useful lifetime',
        paragraphs: [
          "Suppose CMP establishes that two values are equal. An ADD used to advance a pointer then replaces the flags before JE runs. JE now asks whether the pointer addition produced zero, not whether the original values matched. There is no association stored between a branch and a particular earlier CMP.",
          "A practical first style is to place CMP and its conditional jump next to each other. When an intervening instruction is necessary, check whether it preserves the relevant flags. MOV and LEA do; arithmetic such as ADD generally does not. DEC preserves CF but changes ZF, so whether it is safe depends on the exact condition still needed.",
          "For a longer-lived decision, capture the condition with SETcc or turn it into an explicit branch before unrelated work. When debugging, add a “last flag producer” column to the trace. That one annotation often explains a branch that seems to disagree with the comparison values visible in registers."
        ],
        teaching: {
          "goal": "Keep a comparison’s flags intact until the branch consumes them.",
          "bridge": "The correct jump can still make the wrong decision if it reads the wrong operation’s flags.",
          "check": {
            "prompt": "CMP sets ZF to one. Then DEC CX changes CX from 3 to 2, followed by JE. Which result does JE test?",
            "answer": "DEC leaves a nonzero result and sets ZF to zero, so JE is not taken. It tests DEC’s current ZF, not the earlier equality from CMP."
          },
          "takeaway": "A branch reads current flags, not the nearest comparison you intended it to mean.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'clobbered-condition.asm — counterexample', source: 'mov ax, 5\nmov bx, 1\ncmp ax, 5  ; ZF=1: AX equals 5\ndec bx     ; ZF=1 here by coincidence; try BX=2 instead\nje .equal  ; now reads DEC\'s ZF, not CMP\'s\n.equal:\n; Repair by moving the comparison immediately before JE.\n' }
      },
      {
        id: 'test',
        title: '7. TEST asks about bits without storing an AND result',
        paragraphs: [
          "TEST calculates a bitwise AND for the purpose of setting flags, then discards the result. test ax, mask leaves AX unchanged. If none of the selected bits are set, the temporary AND result is zero and ZF becomes one. This makes TEST useful for checking a status or permission bit without clearing the other bits in the original word.",
          "For example, with AX = 0x0028 and mask 0x0008, the temporary result is nonzero, so JNZ can take the “bit present” path. With mask 0x0004, the result is zero, so JZ can take the “bit absent” path. TEST clears CF and OF as part of its flag behavior, so it also replaces any earlier carry information.",
          "A multi-bit mask needs careful wording. A nonzero TEST result means at least one selected bit is set; it does not mean every selected bit is set. To ask whether all bits in a mask are present, compare an appropriately masked value with the full mask. Begin with the precise question, then select the operation that actually answers it."
        ],
        teaching: {
          "goal": "Inspect selected bits with TEST without modifying the original value.",
          "bridge": "Some decisions ask whether particular bits are set rather than which number is larger.",
          "check": {
            "prompt": "AX is 0x0010 and the mask is 0x0030. Does a nonzero TEST result prove both masked bits are set?",
            "answer": "No. The result is 0x0010, so at least one selected bit is set. Bit 5 is still clear. Proving all selected bits are set requires checking that the masked result equals 0x0030."
          },
          "takeaway": "TEST with a mask answers whether any selected bits survive the AND.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'bit-predicate.asm — pattern', source: 'test al, 1\njnz .odd          ; any bit in mask 01h is set\n; even path\njmp .done\n.odd:\n; odd path\n.done:\n' }
      },
      {
        id: 'if-else',
        title: '8. Lay out if/else and invert the condition deliberately',
        paragraphs: [
          "An if/else has a decision, a true arm, a false arm, and a place where execution rejoins. In assembly, labels and jumps establish those relationships. One common layout branches to the false arm when the condition fails, lets the true arm fall through, and ends the true arm with an unconditional jump over the false arm.",
          "For a signed “if x < limit” example, the first jump can reject x ≥ limit and land at the else label. This is an inverted condition, but it expresses the same decision because the taken arrow now names the opposite path. Drawing the two arrows before writing the mnemonic keeps the layout and the logical question connected.",
          "After either arm completes, both should reach the shared continuation with whatever values the next code expects. Forgetting the jump past the else arm makes the true path execute both arms. Testing only a false input can miss that bug entirely, because the false path already enters at the later label. Trace one input through each arm and one equality boundary."
        ],
        teaching: {
          "goal": "Arrange two mutually exclusive branches so execution reaches exactly one arm.",
          "bridge": "We can now connect a condition to a complete if/else layout.",
          "check": {
            "prompt": "A true arm falls directly into the false arm with no intervening jump. Why can the program look correct when tested only with a false condition?",
            "answer": "A false condition jumps straight to the false arm and runs only it. A true condition first executes the true arm and then falls into the false arm too. Testing both paths exposes the missing jump to the shared continuation."
          },
          "takeaway": "Control-flow layout must make the alternatives mutually exclusive.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'if-else.asm — lesson body', source: 'cmp ax, 10\njge .other\nmov al, \'L\'\njmp .report\n.other:\nmov al, \'H\'\n.report:\ncall putc\n' }
      },
      {
        id: 'branch-repair',
        title: '9. Repair signedness with an adversarial input',
        paragraphs: [
          "If both compared bytes are small positive numbers, signed and unsigned ordering often give the same answer. A wrong jump family can therefore pass a friendly example. Choose a pattern with its highest bit set and compare it with a small positive value. As unsigned it is large; as signed it is negative. The two interpretations now predict different paths.",
          "For example, compare byte pattern 0xE0 with 7. Unsigned, 224 is above 7. Signed, −32 is below 7. The checkpoint specifies which interpretation the routine must implement. Use that specification to choose the jump, then verify that the output corresponds to the selected path rather than merely replacing a message to match one display.",
          "A second pass should cover equality and a reversed ordering. These cases check the inclusiveness and direction of the chosen condition. When the tests report a failing input, write its signed and unsigned meanings side by side. This makes the reason for a branch correction visible and prepares you to review bounds checks later in C."
        ],
        teaching: {
          "goal": "Use a signedness-sensitive example to identify the wrong jump family.",
          "bridge": "A comparison bug needs an input for which the two possible interpretations disagree.",
          "check": {
            "prompt": "Give a byte value that is greater than 10 unsigned but less than 10 signed, and explain both meanings.",
            "answer": "For example, 0xD0 is unsigned 208 and signed −48. Thus it is greater than 10 unsigned and less than 10 signed. Its set top bit makes the interpretations differ."
          },
          "takeaway": "Use inputs that force competing interpretations to predict different behavior.",
          "diagramAfter": 2
        }
      },
      {
        id: 'branch-debug',
        title: '10. Debug a decision with a trace, not repeated guesses',
        paragraphs: [
          "Begin a branch trace with the operand width and intended interpretation. Then record the two actual values, the subtraction or test that produces flags, and the condition the jump reads. Finally follow the target or fall-through path. Each link is specific enough to check independently.",
          "For instance, a correct signed comparison can still fail if an intervening instruction changes flags, or if its target label points to the wrong arm. A correctly selected arm can still produce a wrong final result by falling through into the other arm. This is why changing jump mnemonics at random is less useful than finding the first link that disagrees with the intended behavior.",
          "Once both paths are understandable, repetition is a small next step. A loop uses a decision to either leave or return to earlier instructions. The challenge becomes keeping the meaning of the pointer, count, and accumulated result consistent every time the same label is reached. We will build that reasoning from a short array sum."
        ],
        teaching: {
          "goal": "Explain a branch by following its operands, flags, condition, and path.",
          "bridge": "We can turn a surprising decision into a short chain of answerable questions.",
          "check": {
            "prompt": "A comparison and jump choose the correct true arm, but both messages appear. Which stage of the trace should you inspect next?",
            "answer": "Inspect control flow after the true arm. It may fall into the false arm instead of jumping to the shared continuation. The operand interpretation and branch condition can be correct while the later layout is wrong."
          },
          "takeaway": "Debug decisions as a chain from input meaning to the complete executed path.",
          "diagramAfter": 2
        }
      }
    ],
    lab: 'boot',
    challenge: {
      title: 'Use the comparison the problem actually asks for',
      brief: 'Repair the signed less-than decision while leaving −1 and 1 as the compared words. Test equality and both signed extremes after the main case.',
      language: 'asm', starter: branchStarter, solution: branchSolution,
      tasks: ['Predict why the starter prints OTHER for −1 and 1.', 'Choose the signed branch and observe LESS.', 'Test −32768, 0, 1, and 32767 against one.', 'Explain how an instruction between CMP and the jump could invalidate the comparison.'],
      hints: ['The bit pattern for −1 in a word is FFFF.', 'JB uses unsigned borrow; JL uses the relationship between SF and OF.', 'Use JL immediately after CMP and keep the jump over the alternative path.'],
      explanation: 'CMP sets flags for FFFF−0001. As an unsigned word, FFFF is above one, so JB is false. As a signed word, FFFF means −1, so JL is true. The explicit jump from the other path to report prevents both assignments to SI from running.',
      checks: ['The repaired program boots and displays LESS.', 'Equality selects OTHER and negative cases select LESS.', 'I can derive the relevant flags for an overflow boundary case.', 'I can draw the taken and fall-through paths and identify the last flag writer.']
    },
    assembly: {
      title: 'Signed comparison repair', example: branchExample, starter: branchStarter, solution: branchSolution, expectedOutput: 'LESS',
      instructions: 'Grow your equality decision into signed ordering, then choose a stored string so signed -1 compared with 1 prints LESS.',
      hints: ['Do not alter the negative test input.', 'Signed less-than uses JL.', 'Equality must not enter the strict less-than path.'],
      question: { prompt: 'AL is 0x80. CMP AL, 1 discards an eight-bit subtraction result. What is that truncated result as an unsigned decimal number?', answer: 127, explanation: '0x80−1 truncates to 0x7F, or 127. CMP leaves AL unchanged. For signed operands −128 and 1, OF=1 and SF=0, so JL correctly sees SF≠OF.' }
    },
    reflection: {
      prompt: 'Why is “jump when the subtraction result has its sign bit set” not a correct general implementation of signed less-than? Give an eight-bit counterexample, derive SF and OF, and name the correct condition.',
      rubric: ['Uses a concrete signed-overflow comparison', 'Distinguishes mathematical and truncated results', 'Derives SF and OF rather than only naming JL', 'States that CMP does not store the subtraction result'],
      modelAnswer: 'Compare AL=80h (−128) with one. The mathematical difference is −129, but the eight-bit result is 7Fh, so SF=0 even though −128 is less than one. Signed overflow gives OF=1. JL tests SF≠OF and therefore takes the branch. CMP changes the flags while leaving AL=80h; it does not replace AL with 7Fh.'
    },
    sources: [intel, nasmLanguage],
    nextBuild: 'Keep a branch trace with your code. Next use a condition and a back edge to process an array safely.'
  },
  {
    id: 'A08',
    slug: 'assembly-loops',
    title: 'Loops: repeating work without losing your place',
    subtitle: 'Turn repeated instructions into an algorithm you can explain for zero, one, and many elements.',
    phase: 'x86 Assembly',
    minutes: 125,
    prerequisites: ['Choose equality, signed, and unsigned branch conditions', 'Track the last instruction that wrote branch flags', 'Calculate word-array byte offsets and explain segment selection'],
    outcomes: ['Translate while, do/while, and for loops into explicit paths', 'Predict zero-iteration behavior and the CX underflow trap', 'Track an array pointer, remaining count, and accumulator together', 'State and use a loop invariant and a termination argument', 'Build boundary experiments that distinguish count, stride, and overflow bugs'],
    sections: [
      {
        id: 'loop-structure',
        title: '1. A loop is a branch back to earlier code',
        paragraphs: [
          "Suppose we need the sum of several words in memory. Copying the same load-and-add lines for every element would tie the program to one array length. A loop reuses the body by branching back to it while work remains. Its four useful parts are initialization, the condition, the repeated body, and the update that moves toward completion.",
          "For our sum, SI can point to the next word, CX can count the words remaining, and AX can hold the accumulated total. These roles are choices made by the program. A body reads one word, adds it, advances the pointer by two bytes, and reduces the remaining count. The condition determines whether another such body is allowed.",
          "Start with the empty array: its sum should be zero and it should cause no element reads. That requirement tells us the first condition must prevent entering the body when the count is zero. Defining this small case early makes the loop’s shape follow from the problem rather than from a copied pattern that only happens to work for nonempty data."
        ],
        teaching: {
          "goal": "Identify initialization, condition, body, and update in a repeated computation.",
          "bridge": "A loop extends a decision by letting one path return to earlier instructions.",
          "check": {
            "prompt": "For an empty counted array, what should the initial accumulator contain, and how many memory reads should the loop perform?",
            "answer": "The accumulator should start at zero and the loop should read no elements. Checking the zero count before the first body preserves both properties."
          },
          "takeaway": "Design a loop from its state meanings and its zero-work case.",
          "diagramAfter": 2
        }
      },
      {
        id: 'while-shape',
        title: '2. A while loop tests before it touches the next element',
        paragraphs: [
          "A while-shaped loop tests before processing an item. For a remaining-count version, compare CX with zero and leave if equal. Otherwise process one item, advance the pointer, decrement the count, and jump back to the test. Every path into the body passes through the same question: is there still an item available?",
          "With an initial count of two, the test admits a body at CX = 2. The update leaves CX = 1, so the next test admits another body. The second update leaves zero, and the following test exits. With an initial zero, the first test exits immediately. The register always means “items still unprocessed,” which makes all three cases consistent.",
          "The top-tested form is explicit and easy to trace. It may use more visible instructions than another arrangement, but compactness is not the first objective. Once the state meaning is clear, we can rearrange the loop while preserving the same behavior. This is a useful way to learn optimization later: begin with something whose correctness you can explain.",
          "In this chapter’s checkpoints, the lab supplies the initial CX before calling your routine. Treat CX as an incoming argument: test and decrease the value you receive, rather than replacing it with the sample count. Loading CX with 3 yourself would make every run repeat three times, including a test that supplied zero. In a separate playground experiment you may choose your own starting count; in the checkpoint, the supplied input is what lets the same loop handle several amounts of work."
        ],
        teaching: {
          "goal": "Trace a top-tested loop that can execute zero times.",
          "bridge": "The empty case leads naturally to a condition checked before the body.",
          "check": {
            "prompt": "A top-tested remaining-count loop begins with CX = 3. List the count seen by each entry test, including the final exit test.",
            "answer": "The tests see 3, 2, 1, and 0. The first three admit a body; the final zero test exits without processing another item."
          },
          "takeaway": "A top-tested loop checks that work exists before touching the next item.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'while-sum.asm — lesson body', source: 'mov si, values\nmov cx, 4\nxor ax, ax\n.test:\n    cmp cx, 0\n    je .done\n    add ax, [si]\n    add si, 2\n    dec cx\n    jmp .test\n.done:\n    call print_hex16\n; Data: values: dw 1, 2, 3, 4\n' }
      },
      {
        id: 'do-while',
        title: '3. A do/while loop needs a reason its first iteration is valid',
        paragraphs: [
          "A do/while-shaped loop performs the body first and then decides whether to repeat. That is appropriate when at least one iteration is required. For an arbitrary element count, we must establish that an item exists before entering the body. An entry guard handles zero, while the bottom test handles the remaining iterations.",
          "In our sixteen-bit examples, JCXZ branches directly when CX is zero. It reads CX rather than ZF, so it can serve as that entry guard without a preceding comparison. At the bottom, DEC CX followed by JNZ uses the zero flag from the decrement to decide whether more work remains. The two decisions read different kinds of state.",
          "Without the guard, an initial zero still runs one body. DEC then wraps CX to 0xFFFF instead of finishing, and the loop continues through a huge count cycle. For memory traversal, the first read was already unjustified. The entry guard is therefore part of the algorithm’s behavior, not merely an optional shortcut for an unusual input."
        ],
        teaching: {
          "goal": "Add an entry guard when a bottom-tested loop must accept zero work.",
          "bridge": "Moving the test below the body changes what happens on the first iteration.",
          "check": {
            "prompt": "In a body-then-DEC/JNZ loop, what is the first updated CX when entry CX is zero? Why is checking only at the bottom too late?",
            "answer": "DEC changes zero to 0xFFFF, and JNZ repeats. The body has already executed once before that test, so a zero-length array has already been read incorrectly."
          },
          "takeaway": "A bottom test needs a justified first iteration or a separate entry guard.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'guarded-bottom-loop.asm — pattern', source: 'jcxz .done\n.again:\n    ; process one valid item\n    add si, 2\n    dec cx\n    jnz .again\n.done:\n' }
      },
      {
        id: 'loop-instruction',
        title: '4. LOOP hides a decrement, not a zero-entry check',
        paragraphs: [
          "LOOP decrements the count register selected by address size and branches if the new count is nonzero. With our sixteen-bit address size, it uses CX. Unlike DEC, LOOP leaves arithmetic flags unchanged. The instruction is compact notation for a particular control-flow step, not a complete source-level loop with automatic initialization and bounds checks.",
          "If CX begins at three before a conventional body-then-LOOP sequence, the bottom decrements give two, one, and zero, producing three body executions. If entry CX is zero and the body is entered anyway, the first decrement produces 0xFFFF. It takes a full sixteen-bit count cycle to reach zero again. A JCXZ entry guard avoids that behavior when zero work is valid.",
          "The choice between LOOP and separate instructions should begin with meaning, not a guess about speed. Implementations differ in performance, and a short encoding is not automatically the fastest. More importantly for this chapter, whichever form you choose must keep the pointer update, body count, and allowed memory range aligned."
        ],
        teaching: {
          "goal": "Explain LOOP as a decrement and conditional branch, including zero entry.",
          "bridge": "x86 provides a compact count-controlled instruction, but its behavior still needs a full trace.",
          "check": {
            "prompt": "A guarded body-then-LOOP starts with CX = 2. Does LOOP change the flags set by arithmetic inside the body? How many bodies run?",
            "answer": "Two bodies run. LOOP decrements CX and chooses its target without modifying arithmetic flags, so the body’s flag result survives that particular instruction."
          },
          "takeaway": "LOOP controls a count; it does not provide the initial zero check.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'loop-counter.asm — pattern', source: 'mov cx, 3\njcxz .done\n.again:\n    ; body executes exactly three times\n    loop .again\n.done:\n; Without the entry guard, an initial CX=0 is not zero iterations.\n' }
      },
      {
        id: 'for-index',
        title: '5. A for loop can count completed elements instead',
        paragraphs: [
          "An indexed loop starts i at zero and compares it with a fixed length before each body. If i is at least the length, the loop exits; otherwise it processes element i and increments i. For unsigned counts, an above-or-equal rejection expresses the condition. The meaning of i is now “elements already completed,” rather than “elements still remaining.”",
          "The index is not automatically a byte address. For words, element i lives at base + 2i. A program may calculate that offset each time or keep a separate pointer that advances by two. Because sixteen-bit addressing lacks a scaled [si * 2] form, a separate pointer often makes the early implementation easier to follow.",
          "Both count styles can implement the same sum. Choose one meaning for each register and keep it consistent at the loop label. If a value means an element count in one instruction and a byte displacement in the next, an explicit conversion should connect those uses. That clarity matters more than shaving one register from a tiny demonstration."
        ],
        teaching: {
          "goal": "Keep an element index distinct from a byte pointer.",
          "bridge": "A loop can count completed work instead of work remaining.",
          "check": {
            "prompt": "An index register contains 4 in a word array. If another register is the corresponding byte offset from the base, what must it contain?",
            "answer": "It must contain 8 because each word occupies two bytes. The values 4 and 8 describe the same element using different units: elements and bytes."
          },
          "takeaway": "Give each loop variable one clear meaning and one clear unit.",
          "diagramAfter": 2
        }
      },
      {
        id: 'invariant',
        title: '6. State what remains true at the top of every iteration',
        paragraphs: [
          "After k words have been processed, three facts should agree: SI points to base + 2k, CX equals the original count N minus k, and AX contains the sum of the first k words at the chosen accumulator width. This recurring relationship is called a loop invariant. It is simply a precise sentence about what the loop state means.",
          "Before the first body, k is zero. The pointer is at the base, the remaining count is N, and the sum is zero. One body adds word k, advances the pointer by two, and subtracts one from the count. The same sentence now holds for k + 1. When the remaining count is zero, k equals N and every intended word has been included once.",
          "We also need the loop to finish. Each admitted body must reduce a positive remaining count, and no path should skip or undo that update. Keeping the state relationship true is not enough if progress stops. Together, the repeating meaning and the decreasing count explain both what the loop computes and why it eventually exits."
        ],
        teaching: {
          "goal": "Describe the relationship that stays true at every loop entry.",
          "bridge": "A repeated label becomes understandable when the state has the same meaning every time we reach it.",
          "check": {
            "prompt": "After three iterations of a six-word sum, what should the pointer displacement and remaining count be? What should the accumulator represent?",
            "answer": "The pointer should be six bytes beyond the base, the remaining count should be three, and the accumulator should represent the sum of the first three words at its defined width."
          },
          "takeaway": "An invariant gives repeated execution a stable, checkable meaning.",
          "diagramAfter": 2
        }
      },
      {
        id: 'worked-trace',
        title: '7. Trace count, pointer, and sum together',
        paragraphs: [
          "Use the small word array 3, 5, 9. Before processing, the byte offset is zero, the remaining count is three, and the sum is zero. After one body those values are 2, 2, and 3. After two bodies they are 4, 1, and 8. After three they are 6, 0, and 17. A hexadecimal printer would show the final total as 0011.",
          "The final pointer is one past the array, at byte offset six. Calculating or holding that position is different from reading a word there. The exit condition must prevent a fourth access. This distinction will recur in C pointer loops and buffer APIs: an end position is useful as a boundary, but it does not name another element.",
          "Compare the table with the nearby code trace, which uses another short array. The numerical totals differ, but the relationship between completed elements, byte displacement, and remaining count is the same. That is the transferable part. A full-length run, a one-element run, and a zero-element run should all fit the same explanation.",
          "For the array-sum checkpoint, initialize SI to your array’s address and AX to the empty sum, zero. Keep CX as supplied by the lab: it says how many of the four stored words belong to this particular request. Four words of storage do not require four iterations. For example, a supplied count of one permits only the first word to contribute, while zero must reach the final printer without reading an element."
        ],
        teaching: {
          "goal": "Trace pointer, remaining count, and accumulated total together.",
          "bridge": "A concrete table shows whether the loop’s state matches its intended meaning.",
          "check": {
            "prompt": "For words 4 and 7, give the final sum, pointer displacement, and number of loads after a correct full traversal.",
            "answer": "The sum is 11, or 0x000B. The pointer advances four bytes, and exactly two word loads occur. A third load at the final pointer would exceed the array."
          },
          "takeaway": "Track how far the loop traveled as well as the final number it produced.",
          "diagramAfter": 2
        },
        code: { language: 'text', filename: 'trace.txt', source: 'completed k | SI - base | CX remaining | AX sum\n0           | 0         | 4            | 0000\n1           | 2         | 3            | 0002\n2           | 4         | 2            | 0006\n3           | 6         | 1            | 000C\n4           | 8         | 0            | 0014\n' }
      },
      {
        id: 'stride-bug',
        title: '8. A one-byte stride can produce plausible but wrong words',
        paragraphs: [
          "Suppose the array contains words 0x0012, 0x0034, and 0x0056. Its bytes are 12 00 34 00 56 00. A faulty loop that advances by one byte reads words at offsets zero, one, and two: 0x0012, 0x3400, and 0x0034. The resulting sum is wrong for a specific reason: the second read straddles the intended elements.",
          "Changing the count to make one example print a desired total does not repair that address pattern. The pointer must advance by the size of the item consumed by the body. For a word load, the next distinct array element is two bytes farther on. Restoring that relationship repairs the algorithm rather than adjusting its symptoms.",
          "An asymmetric test array helps expose these errors because its neighboring bytes form recognizable unexpected words. Test zero, one, and the full valid count after changing the stride. Counts above the allocated length require a separate rejection check; a raw loop does not receive hidden array bounds from the processor."
        ],
        teaching: {
          "goal": "Recognize a byte-stride error by reconstructing the words actually read.",
          "bridge": "A wrong pointer update can select valid bytes that belong to the wrong elements.",
          "check": {
            "prompt": "Words 0x1023 and 0x4056 occupy four bytes. What does a word read at offset one return?",
            "answer": "The bytes are 23 10 56 40, so the offset-one read returns 0x5610. It combines the high byte of the first element with the low byte of the second."
          },
          "takeaway": "A stride must match the size of the elements that the body consumes.",
          "diagramAfter": 2
        }
      },
      {
        id: 'accumulator-overflow',
        title: '9. Choose enough bits for the total',
        paragraphs: [
          "A sixteen-bit accumulator retains the low sixteen bits after every ADD. Summing 0xFFFE and 3 therefore leaves 1, with a carry from the second addition. If the problem wants a modulo-65,536 total, that is meaningful. If it wants the full unsigned sum 65,537, the accumulator must represent more than one word.",
          "A wider real-mode total can use DX:AX. Each element is added into AX, and ADC adds the low-word carry into DX. The ADC must consume the carry before another flag-changing operation, such as advancing SI with ADD, replaces it. This connects arithmetic ordering with loop ordering: the pointer update is correct only after the numerical carry has been preserved or used.",
          "Width should be chosen from the largest possible count and element, not only the sample array. A thirty-two-bit total may be sufficient for a bounded number of sixteen-bit items, but a more general routine needs that range argument stated. In the current exercise, follow the requested result width; treat a wider accumulator as a deliberate extension with its own expected outputs."
        ],
        teaching: {
          "goal": "Choose an accumulator wide enough for the intended total.",
          "bridge": "Correct traversal does not guarantee that the destination can hold the mathematical sum.",
          "check": {
            "prompt": "A sixteen-bit sum receives 0xFFFD and 5. What is the low word, and what high word is needed to represent the full unsigned total?",
            "answer": "The full sum is 65538 = 0x0001:0002. The low word is 0x0002 and the high word is 0x0001. Keeping only AX would lose the carried 65,536."
          },
          "takeaway": "The accumulator’s width is part of what it means to return a sum.",
          "diagramAfter": 2
        },
        code: { language: 'asm', filename: 'wide-accumulator.asm — body fragment', source: '; Initialize DX=0 and AX=0 before the loop.\nadd ax, [si]\nadc dx, 0      ; consume ADD\'s carry immediately\nadd si, 2      ; this also changes flags\ndec cx\njnz .again     ; reads DEC\'s zero flag\n' }
      },
      {
        id: 'counted-or-terminated',
        title: '10. Counted data and sentinel-terminated data have different exits',
        paragraphs: [
          "A counted array carries its length separately from its elements. A null-terminated string instead places a zero byte after its characters. A string loop must load the candidate byte and inspect it before deciding whether to print it. The zero is a sentinel: a reserved value that signals the end of meaningful content.",
          "If the sentinel is missing, an unbounded scan can continue into unrelated memory. A bounded scan combines a maximum readable length with the terminator test. It stops successfully when it finds zero, or reports exhaustion when no more permitted bytes remain. The length answers whether a read is allowed; the terminator answers whether the content has ended.",
          "Our early printing helper receives deliberately declared, terminated strings from the boot image. That controlled situation explains why its simple loop works; it does not make the helper a general parser for arbitrary disk or user data. Later interfaces will carry lengths explicitly, and the loop-state reasoning from this chapter will tell us exactly which next byte is permitted."
        ],
        teaching: {
          "goal": "Distinguish count-based termination from a sentinel-based scan.",
          "bridge": "Arrays and strings can tell a loop where to stop in different ways.",
          "check": {
            "prompt": "A four-byte readable region contains A, B, C, D with no zero. What should a bounded null scan do after the fourth byte?",
            "answer": "It should report that the bound was exhausted without a terminator and stop reading. The absence of zero does not authorize a fifth read outside the region."
          },
          "takeaway": "A content terminator and a memory bound answer different questions.",
          "diagramAfter": 2
        }
      },
      {
        id: 'loop-proof',
        title: '11. Explain why the loop reads the right items and finishes',
        paragraphs: [
          "A useful loop review begins with three small inputs: zero items, one item, and several items. For each, predict the number of reads, the final pointer displacement, and the final total. A total alone can miss an extra read that happened to add zero. Counting the accesses checks the traversal itself.",
          "Next explain why each body is allowed and why another iteration eventually becomes unnecessary. The entry condition establishes that an item exists, the body consumes exactly one item, the stride reaches the next item, and the count moves toward zero. The accumulator width explains whether the result is an exact mathematical sum or a wrapped one. These statements are more useful than saying the loop “runs the right number of times.”",
          "At the checkpoint, use a failed case to locate which part of this explanation broke. Once the loop works, we are ready to package repeated operations into reusable routines. That requires a place to save temporary values and return addresses. The next chapter introduces that place: the stack, which is ordinary memory managed by a moving pointer."
        ],
        teaching: {
          "goal": "Explain a loop using its zero case, progress, stride, and result range.",
          "bridge": "The chapter’s pieces now form a complete explanation of repeated memory processing.",
          "check": {
            "prompt": "Why might a sum test pass even though the loop reads one word beyond the intended array? Name a stronger observation.",
            "answer": "The extra word might happen to contain zero, leaving the sum unchanged. Recording the number of loads or checking the final pointer and permitted range can expose the extra access."
          },
          "takeaway": "Verify the traversal, the progress toward exit, and the numerical result together.",
          "diagramAfter": 2
        }
      }
    ],
    lab: 'boot',
    challenge: {
      title: 'Repair the stride and prove the zero case',
      brief: 'Repair a counted word-array sum. Preserve the entry guard, explain the invariant, and validate zero, one, and full-length inputs.',
      language: 'asm', starter: loopStarter, solution: loopSolution,
      tasks: ['Trace why the starter sums overlapping words and prints 0A06.', 'Repair the stride and observe 0014 for 2,4,6,8.', 'Test counts zero and one and predict both output and memory-read count.', 'State an invariant and explain why the loop terminates without reading a fifth word.'],
      hints: ['SI is a byte address, but the input elements are words.', 'Advance SI by two after every word load.', 'Keep JCXZ before the first load and DEC immediately before JNZ.'],
      explanation: 'The two-byte stride visits offsets 0,2,4,6 exactly once. CX decreases from four to zero, and the guard prevents a first read for count zero. AX accumulates 2+4+6+8=20, which print_hex16 displays as 0014. The final pointer is one past the last word and is not dereferenced.',
      checks: ['The repaired program boots and displays 0014.', 'Count zero displays 0000 without entering the body.', 'Count one displays 0002 with one memory read.', 'I can state the pointer/count/sum invariant and the finite decrement argument.']
    },
    assembly: {
      title: 'Counted array sum', example: loopExample, starter: loopStarter, solution: loopSolution, expectedOutput: '0014',
      instructions: 'Build a guarded loop, extend it to sum words, and use the final data 2,4,6,8 to obtain 0014 with a two-byte stride.',
      hints: ['Write the byte sequence 02 00 04 00 06 00 08 00.', 'The next word starts two bytes later.', 'After the final iteration SI may be one past the array, but no further load may use it.'],
      question: { prompt: 'A body-then-LOOP loop uses sixteen-bit CX, starts with CX=0, and has no entry guard. Assuming the body always reaches LOOP without changing CX, how many times does the body execute before exit?', answer: 65536, explanation: 'The first LOOP decrements zero to FFFF. The counter then traverses the remaining sixteen-bit values until it reaches zero, giving 65,536 total body executions.' }
    },
    reflection: {
      prompt: 'Explain why the repaired loop is correct for zero, one, and N elements. Include the relationship between SI, CX, AX, and the completed-iteration count, and state the assumptions under which the sum has the intended numerical meaning.',
      rubric: ['Explains that the entry guard prevents a zero-count read', 'States SI=base+2k, CX=N−k, and the first-k-elements sum', 'Shows preservation and termination', 'Separates modulo-65536 accumulation from a non-overflowing mathematical sum', 'Requires a valid range containing at least N words'],
      modelAnswer: 'Before iteration k, SI=base+2k, CX=N−k, and AX is the first k words’ sum modulo 65536. Initialization establishes this at k=0. A body adds word k, advances two bytes, and decrements CX, preserving the relationship for k+1. JCXZ exits before any read when N=0. Otherwise the positive remaining count decreases to zero, so exactly N words are read. The input range must contain those N words without address wrap. For the result to equal the mathematical unsigned sum, that sum must fit in AX; otherwise a wider accumulator or explicit overflow contract is required.'
    },
    sources: [intel, nasmLanguage],
    nextBuild: 'Use these invariants inside a callable routine. Next learn what CALL, RET, and the stack must preserve across that boundary.'
  }
];
