// Original worked examples; sources identify architectural facts and coverage.
const INTEL = 'https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html';
const OSTEP = 'https://pages.cs.wisc.edu/~remzi/OSTEP/';
const OSC = 'https://www.os-book.com/OS10/slide-dir/index.html';
const intel = section => ({ label: 'Intel Software Developer Manuals', url: INTEL, section });
const ostep = (file, section) => ({ label: 'Operating Systems: Three Easy Pieces', url: OSTEP + file, section });
const osc = section => ({ label: 'Operating System Concepts, tenth edition', url: OSC, section });
const p = (title, ...paragraphs) => ({ type: 'prose', title, paragraphs });
const table = (caption, columns, rows) => ({ type: 'table', caption, columns, rows });
const trace = (caption, columns, rows) => ({ type: 'trace', caption, columns, rows });
const code = (title, language, source, notes) => ({ type: 'code', title, language, code: source, notes });
const ex = (title, prompt, tasks, solution, checks) => ({ type: 'exercise', title, prompt, tasks, solution, checks });

export const architectureHandbook = {
  bootloading: [
    {
      id: 'boot-machine-state-ledger', sectionId: 'cpu', title: 'Track the complete machine state across a boot handoff',
      intro: ['A boot handoff is a contract about bytes and processor state. The destination needs an address, a decoding mode, usable memory, and defined inputs. Write those facts down before assigning a label such as stage2 or kernel_main.'],
      blocks: [
        p('Addresses are calculations', 'In real mode, an ordinary segment register supplies a base equal to its visible value multiplied by 16. The instruction offset is added to that base. Thus `07c0:0120` and `0000:7d20` name the same linear address, `0x7d20`. This aliasing means an ORG directive cannot initialize a CPU register. ORG changes the numbers the assembler puts in address expressions; a far jump and register loads establish the runtime coordinate system.', 'NASM source assembled with `org 0x7c00` expects ordinary labels near `0x7c00`. With DS=0, a data reference to a label at 0x7d20 reaches the intended bytes. With DS=0x07c0, that same offset reaches 0xf920. Choose a consistent origin and segment base even when two code-entry representations originally pointed at the same boot sector.', 'A20 affects access across the 1 MiB boundary in the legacy environment. The calculation `ffff:0010` produces 0x100000; with A20 masked, bit 20 is forced low and that access aliases address zero. A protected-mode segment limit alone does not enable A20. Before using memory above 1 MiB, establish and verify the platform A20 state.'),
        table('An explicit handoff ledger', ['Boundary', 'Defined state', 'Next stage establishes'], [
          ['BIOS → first sector', 'Loaded sector at physical 0x7c00; DL identifies drive in this boot path', 'CS representation, DS/ES, SS:SP, DF, saved drive'],
          ['Stage 1 → stage 2', 'Entry, disk layout, boot drive, live buffers', 'Kernel load, A20 policy, descriptors, protected mode'],
          ['Protected entry → C', 'Flat segment caches; paging and IRQ policy', 'Stack alignment, zeroed BSS, DF clear, arguments'],
          ['C → IRQ-enabled kernel', 'Tables, stubs, stacks, device state', 'Unmask owned sources; preserve their dependencies']
        ]),
        code('Establish a real-mode coordinate system', 'asm', `bits 16
org 0x7c00
    jmp 0x0000:canonical
canonical:
    cli
    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7c00
    cld
    mov [boot_drive], dl
    ; Continue with checked firmware disk calls.
boot_drive: db 0`, ['The far jump normalizes CS while labels retain origin 0x7c00.', 'CLI suppresses maskable interrupts; NMI and synchronous faults need separate consideration.', 'Reserve enough memory below 0x7c00 for the downward-growing stack.', 'This entry fragment omits disk loading, padding, and the boot signature.']),
        ex('Diagnose a double-applied base', 'A boot sector uses ORG 0x7c00, sets DS=0x07c0, and reads a label encoded as offset 0x7d10.', ['Calculate the accessed address.', 'Give two consistent origin/segment designs.', 'Explain why BITS cannot fix this.'], ['The address is 0x7c00 + 0x7d10 = 0xf910.', 'Use ORG 0x7c00 with DS=0, or use segment-relative label offsets with DS=0x07c0 and a consistent control-transfer design.', 'BITS selects emitted encodings; it does not modify segment bases or processor mode.'], ['The corrected access reaches physical 0x7d10.'])
      ], references: [intel('Real-address mode and protected-mode initialization'), osc('Chapter 1: bootstrap and computer-system organization')]
    },
    {
      id: 'boot-disk-memory-intervals', sectionId: 'disk-read', title: 'Prove disk reads fit both the image and physical memory',
      intro: ['The loader joins sector numbers on disk to byte addresses in RAM. A correct read needs valid intervals in both spaces, a supported firmware service, and a destination that remains alive until its contents are consumed.'],
      blocks: [
        table('One image, two independent layouts', ['Object', 'Disk interval, half-open', 'Physical interval, half-open'], [
          ['Stage 1', 'LBA [0,1), bytes [0,512)', '[0x7c00,0x7e00)'],
          ['Stage 2, 8 sectors', 'LBA [1,9), bytes [512,4608)', 'Example: [0x8000,0x9000)'],
          ['Kernel slot, 32 sectors', 'LBA [9,41), bytes [4608,20992)', 'Example: [0x10000,0x14000)'],
          ['BSS and stack', 'May have no file bytes', 'Reserve separately from live loaded ranges']
        ]),
        p('Bounds before requests', 'For an image containing N sectors, validate `lba <= N` and `count <= N - lba`. Subtraction prevents overflow from disguising an invalid request. Compute `count * 512` in a sufficiently wide type, then prove that the destination interval belongs to the loader. Firmware data, the interrupt-vector area, active stacks, boot code, and the disk packet itself create exclusions.', 'The BIOS extended-read interface uses a disk address packet. Its 16-byte form includes packet size, sector count, a segment:offset transfer-buffer pointer, and a 64-bit starting LBA. The packet’s address is another pointer passed to firmware. Confusing these pointers can overwrite the request while it is being used. Check service support, use conservative transfer chunks, avoid a 64 KiB transfer-buffer boundary crossing, and handle firmware failures.', 'If carry indicates failure, the loader cannot treat the requested buffer as a valid complete image. Preserve the request between bounded retry attempts. When retries are exhausted, stop with a diagnostic before parsing or jumping into the destination. A retry policy also needs a counter whose decrement and error path actually terminate.'),
        trace('A load with disjoint live ranges', ['Step', 'Operation', 'Invariant'], [
          ['1', 'Stack grows below 0x7c00; stage 1 occupies 0x7c00–0x7dff', 'Loading at 0x8000 preserves active code'],
          ['2', 'Read 8 sectors from LBA 1', '4096 bytes occupy 0x8000–0x8fff'],
          ['3', 'Enter stage 2 with saved drive', 'Further reads target the same boot device'],
          ['4', 'Read 32 sectors from LBA 9 to 0x10000', '16384 bytes fill the kernel slot'],
          ['5', 'Check image size and entry placement', 'Control transfers only to validated loaded bytes']
        ]),
        ex('A loader overwrites its future', 'A stage-2 stack has top 0x11000 and an 8 KiB budget. The kernel loads into [0x10000,0x14000).', ['Calculate the stack reservation.', 'Calculate the collision.', 'State a repair and the evidence it needs.'], ['Reserve [0xf000,0x11000).', 'The overlap [0x10000,0x11000) contains 4096 bytes.', 'Relocate a region into verified free RAM and update all entry/link assumptions. Changing a constant without proving ownership is insufficient.'], ['All simultaneously live regions are disjoint unless intentional sharing is documented.'])
      ], references: [osc('Chapter 1: bootstrap and storage structure'), intel('Real-address-mode addressing')]
    },
    {
      id: 'boot-c-entry-abi', sectionId: 'c-entry', title: 'Construct the environment a freestanding C function assumes',
      intro: ['A compiler translates functions under an ABI and target configuration. The entry stub must establish stack alignment, segment state, zero-initialized storage, argument layout, and permitted instruction features. Freestanding compilation still has a calling convention.'],
      blocks: [
        p('Make each compiler assumption true', 'Choose a 32-bit ABI configuration requiring 16-byte alignment immediately before CALL, flat segments, DF clear, and no floating-point or SIMD use until their machine state is initialized. CALL pushes four bytes, so the callee initially observes ESP modulo 16 equal to 12. Record this convention beside the actual compiler flags.', 'Zero-initialized globals usually live in BSS, whose file representation can omit their zero bytes. Clear the linker-defined BSS interval before entering C. The active stack must lie outside that interval so clearing does not erase its own return chain. CLD makes string operations move forward; repeat that obligation at every later assembly-to-C boundary.', 'Inspect unresolved symbols and generated instructions. Freestanding C can still call compiler support routines for arithmetic or memory operations. Supply required helpers, constructors, TLS, or stack-protector state when enabled, or configure the target appropriately. A successful compilation proves translation; the linked image and entry state establish execution.'),
        code('A bounded assembly-to-C entry', 'asm', `bits 32
global _start
extern __bss_start, __bss_end, kernel_main
section .text
_start:
    cli
    mov ax, 0x10
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov fs, ax
    mov gs, ax
    mov esp, 0x90000       ; reserved RAM, outside BSS
    and esp, -16
    xor ebp, ebp
    cld
    mov edi, __bss_start
    mov ecx, __bss_end
    sub ecx, edi
    xor eax, eax
    rep stosb
    call kernel_main      ; void kernel_main(void)
.stopped:
    cli
    hlt
    jmp .stopped`, ['CS must already describe flat 32-bit code. The snippet is not a complete mode switch.', 'The loader must reserve usable stack memory below 0x90000; the constant alone is not proof.', 'The BSS clear writes exactly end minus start bytes.', 'The halt loop defines behavior if kernel_main returns.']),
        table('Assumption and diagnostic', ['Requirement', 'Establishment', 'Typical failure'], [
          ['Writable aligned stack', 'Reserved RAM and ABI alignment', 'First nested call faults'],
          ['Zeroed BSS', 'Clear before C', 'Static counters begin with garbage'],
          ['DF clear', 'CLD', 'Copies proceed backward'],
          ['Feature state initialized', 'Target flags and CPU setup agree', '#UD or #NM'],
          ['Return policy', 'Stop or shutdown destination', 'RET enters accidental bytes']
        ]),
        ex('Account for every stack byte', 'ESP=0x90000. You must push one four-byte argument and CALL with 16-byte pre-call alignment.', ['Compute the result without padding.', 'Compute required padding.', 'Explain cleanup.'], ['Without padding, pre-call ESP=0x8fffc and entry ESP=0x8fff8.', 'Subtract 12 first, then push four: pre-call ESP=0x8fff0, entry ESP=0x8ffec.', 'Under the chosen caller-cleaned convention, add 16 after return to reclaim argument and padding.'], ['ESP modulo 16 equals zero immediately before CALL.'])
      ], references: [intel('CALL, CLD, REP STOS instruction definitions'), osc('Chapter 2: operating-system implementation')]
    },
    {
      id: 'boot-link-load-addresses', sectionId: 'linker', title: 'Distinguish file offsets, load addresses, and linked addresses',
      intro: ['The linker assigns symbol addresses. The loader copies file bytes. A shared layout or executable format must connect those operations, including memory that occupies no bytes in the file.'],
      blocks: [
        table('One small contiguous kernel', ['Region', 'Linked start', 'File bytes', 'Memory bytes'], [
          ['.text', '0x10000', '0x1800', '0x1800'], ['.rodata', '0x11800', '0x0300', '0x0300'],
          ['.data', '0x11b00', '0x0100', '0x0100'], ['.bss', '0x11c00', '0', '0x0800'],
          ['Total', '0x10000', '0x1c00', '0x2400; exclusive end 0x12400']
        ]),
        p('Derive the raw-image contract', 'With contiguous bytes, no relocation requirement, and origin 0x10000, the instruction linked at 0x10120 appears 0x120 bytes into the raw payload. If that payload begins at disk byte 4608, the instruction is stored at byte 4896. The loader puts it at physical 0x10120. Equality between linked and physical address is a deliberate choice while paging is disabled.', 'A higher-half kernel separates its linked virtual address from physical storage. It needs the required mappings before executing code whose address references depend on that layout. Raising the linker base alone leaves absolute pointers referring to unavailable memory. Keep file offset, physical location, virtual address, and mapping-activation instruction in one debugger ledger.', 'ELF program headers distinguish file size from memory size. A raw loader needs equivalent shared knowledge. Here 0x1c00 file bytes require fourteen sectors, while 0x2400 memory bytes must be reserved before adding stacks. Padding a disk slot does not initialize a larger BSS or validate its ownership.'),
        code('Assert independent file and memory bounds', 'text', `ENTRY(_start)
SECTIONS {
  . = 0x10000;
  __kernel_start = .;
  .text : { *(.text .text.*) }
  .rodata : { *(.rodata .rodata.*) }
  .data : { *(.data .data.*) }
  __file_end = .;
  .bss (NOLOAD) : {
    __bss_start = .;
    *(.bss .bss.*) *(COMMON)
    __bss_end = .;
  }
  __kernel_end = .;
  ASSERT(__file_end - __kernel_start <= 0x4000,
         "kernel exceeds 32-sector file slot")
  ASSERT(__kernel_end < 0x80000,
         "kernel reaches reserved stack region")
}`, ['Review orphan sections and target metadata in the real link map.', 'Inspect entry symbol, program headers, disassembly, and final raw length.', 'This fragment assumes the stated flat raw-image contract.']),
        ex('A valid file with an invalid memory plan', 'A kernel has 12 KiB of file-backed bytes and 48 KiB of BSS, loads at 0x10000, and shares RAM with a live buffer [0x1c000,0x20000).', ['Compute the kernel end.', 'Explain the passing 16 KiB file check.', 'Find the collision.'], ['The 60 KiB image ends at 0x1f000.', 'Twelve KiB fits the slot because BSS has no payload bytes.', 'The overlap is [0x1c000,0x1f000). Move a region or end the buffer lifetime before clearing BSS.'], ['File bounds and memory bounds are independently checked.'])
      ], references: [osc('Chapter 2: linking and loading'), intel('Linear and physical addressing')]
    }
  ],
  'descriptors-and-interrupts': [
    {
      id: 'gdt-descriptor-bits-and-bytes', sectionId: 'descriptor-contract', title: 'Build a GDT descriptor from its 64 individual bits',
      intro: ['A Global Descriptor Table is a byte array in memory. In legacy protected mode, each ordinary code or data descriptor occupies eight bytes and describes a segment’s base, inclusive limit, type, and privilege. A selector identifies an entry; the entry supplies the meaning. Construct one descriptor numerically before using a hexadecimal constant.'],
      blocks: [
        { type: 'bits', caption: 'Legacy code/data descriptor; bit 0 belongs to memory byte 0', width: 64, value: '0x00cf9a000000ffff', fields: [
          { name: 'Base 31:24', high: 63, low: 56, description: 'Highest eight bits of the 32-bit base.' },
          { name: 'G', high: 55, low: 55, description: 'Zero: byte-granular limit. One: 4 KiB units with twelve low effective-limit bits set.' },
          { name: 'D/B', high: 54, low: 54, description: 'Code default size, stack-pointer size, or expand-down upper bound, according to segment use.' },
          { name: 'L', high: 53, low: 53, description: '64-bit code flag. Zero in this 32-bit example.' },
          { name: 'AVL', high: 52, low: 52, description: 'Available to software.' },
          { name: 'Limit 19:16', high: 51, low: 48, description: 'Highest four bits of the encoded 20-bit limit.' },
          { name: 'P', high: 47, low: 47, description: 'Present; other validity checks still apply.' },
          { name: 'DPL', high: 46, low: 45, description: 'Descriptor privilege level, zero through three.' },
          { name: 'S', high: 44, low: 44, description: 'One for code/data; zero for a system descriptor.' },
          { name: 'Type', high: 43, low: 40, description: 'Executable, conforming/expand-down, readable/writable, accessed.' },
          { name: 'Base 23:16', high: 39, low: 32, description: 'Middle eight base bits.' },
          { name: 'Base 15:0', high: 31, low: 16, description: 'Lowest sixteen base bits.' },
          { name: 'Limit 15:0', high: 15, low: 0, description: 'Lowest sixteen encoded limit bits.' }
        ] },
        p('Derive the flat code descriptor', 'Choose base zero, effective limit 0xffffffff, present Ring 0 code, readable instructions, and 32-bit default decoding. The limit field has only twenty bits. Set G=1 and encoded limit=0xfffff. The effective inclusive limit is `(0xfffff << 12) | 0xfff = 0xffffffff`. An ordinary expand-up segment then permits offsets zero through 4 GiB minus one. Its size is limit plus one.', 'The access byte collects P, DPL, S, and Type. P contributes 0x80, DPL=0 contributes zero, S contributes 0x10, and executable readable code with accessed clear contributes 0x0a. The result is 0x9a. The next byte combines G=1, D=1, L=0, AVL=0, and the upper limit nibble 0xf into 0xcf. Together these fields produce `0x00cf9a000000ffff`.', 'Type bit 3 selects code when set. For code, bit 2 means conforming and bit 1 means readable. For data, bit 2 means expand-down and bit 1 means writable. Bit 0 is accessed and can be set by the processor when the descriptor is used. Readable code can be read through an appropriate data-segment register; it does not become writable. The corresponding writable flat data descriptor changes access 0x9a to 0x92.', 'A limit constrains the complete operand. With effective limit 0x1fff, a four-byte access at offset 0x1ffe extends through 0x2001 and fails. Expand-down segments instead permit offsets above their limit through an upper bound selected by B. The course’s initial flat data descriptors are ordinary expand-up segments, so their valid interval starts at zero.', 'The base always has byte granularity. G changes the limit interpretation, not the base scaling. This matters when constructing a small segment at an unaligned base: setting G does not round or multiply its base address. Separately, D/B does not make the segment larger by itself. For code it controls default decoding, for SS it selects SP versus ESP, and for expand-down data it selects the upper offset boundary.'),
        table('Eight bytes in increasing memory-address order', ['Offset', 'Byte', 'Meaning'], [
          ['+0', 'ff', 'Limit 7:0'], ['+1', 'ff', 'Limit 15:8'], ['+2', '00', 'Base 7:0'], ['+3', '00', 'Base 15:8'],
          ['+4', '00', 'Base 23:16'], ['+5', '9a', 'P=1, DPL=0, S=1, readable nonconforming code, A=0'],
          ['+6', 'cf', 'G=1, D=1, L=0, AVL=0, limit 19:16=0xf'], ['+7', '00', 'Base 31:24']
        ]),
        code('Pack fields without implementation-defined C bitfields', 'c', `#include <stdint.h>
static uint64_t segment_descriptor(uint32_t base, uint32_t limit20,
                                   uint8_t access, uint8_t flags4) {
    return ((uint64_t)(limit20 & 0xffffu))
         | ((uint64_t)(base & 0xffffu) << 16)
         | ((uint64_t)((base >> 16) & 0xffu) << 32)
         | ((uint64_t)access << 40)
         | ((uint64_t)((limit20 >> 16) & 0xfu) << 48)
         | ((uint64_t)(flags4 & 0xfu) << 52)
         | ((uint64_t)(base >> 24) << 56);
}
/* (0, 0xfffff, 0x9a, 0xc) gives 0x00cf9a000000ffff. */`, ['Validate limit20 and legal flag/type combinations before packing. Masks cannot validate the caller’s intent.', 'Convert to uint64_t before shifts beyond bit 31.', 'The packed value has the shown byte order when stored on little-endian x86. A cross-platform image tool should serialize the bytes explicitly.']),
        p('Decode unfamiliar bytes in the opposite direction', 'Suppose a debugger shows `ff 0f 00 00 20 92 40 00`. Reconstruct the base from byte groups: low base 0x0000, middle base 0x20, high base 0x00, giving 0x00200000. The encoded limit is 0x0fff. Byte 6 is 0x40, so G=0 and the effective limit remains 0x0fff. A data load at offset 0x350 reaches linear 0x00200350 if the segment is loaded and access checks pass. Paging, when enabled, translates that linear address afterward.', 'Changing only byte 6 to 0xc0 sets G while retaining the same encoded limit. The effective limit becomes `(0x0fff << 12) | 0xfff = 0x00ffffff`, expanding the segment from 4096 bytes to 16 MiB. A one-bit descriptor mistake can therefore expand an allowed range by a factor of 4096. Inspect the encoded and effective limit separately in diagnostics.', 'Descriptor changes do not allocate physical memory. A wide present segment can name linear addresses whose pages are absent, reserved, or owned by another subsystem. Segment permission is one check in the access path; page translation and the kernel’s ownership model supply additional conditions.'),
        ex('Construct a bounded data segment', 'Build present, writable Ring 0 data at base 0x12345000, byte limit 0x1fff, and B=1.', ['Calculate access and flags.', 'Write all eight bytes.', 'Compare four-byte accesses at offsets 0x1ffc and 0x1ffd.'], ['Access is 0x92; flags nibble is 0x4.', 'Bytes: ff 1f 00 50 34 92 40 12. Packed value: 0x1240923450001fff.', 'The first ends at 0x1fff and passes; the second reaches 0x2000 and fails.'], ['Reconstructed base is 0x12345000.', 'Effective size is 8192 bytes.'])
      ], references: [intel('Volume 3A: Segment Descriptors; Code- and Data-Segment Descriptor Types'), ostep('vm-segmentation.pdf', 'Chapter 16: segmentation')]
    },
    {
      id: 'gdt-selectors-gdtr-cache', sectionId: 'descriptor-contract', title: 'Follow a selector through GDTR and the hidden segment cache',
      intro: ['The visible segment register contains a 16-bit selector. Its hidden portion caches a descriptor’s base, limit, and access attributes. Updating table memory, loading GDTR, and reloading a segment register have different effects.'],
      blocks: [
        { type: 'bits', caption: 'A 16-bit segment selector', width: 16, fields: [
          { name: 'Index', high: 15, low: 3, description: 'Entry number; multiply by eight for its byte offset.' },
          { name: 'TI', high: 2, low: 2, description: 'Zero selects GDT, one the current LDT.' },
          { name: 'RPL', high: 1, low: 0, description: 'Requested privilege level used by the relevant checks.' }
        ] },
        table('Five-entry GDT at linear address 0x7000', ['Index', 'Address', 'Memory bytes', 'Usual selector'], [
          ['0', '0x7000', '00 00 00 00 00 00 00 00', 'Null 0x0000'],
          ['1', '0x7008', 'ff ff 00 00 00 9a cf 00', 'Kernel code 0x0008'],
          ['2', '0x7010', 'ff ff 00 00 00 92 cf 00', 'Kernel data 0x0010'],
          ['3', '0x7018', 'ff ff 00 00 00 fa cf 00', 'User code 0x001b'],
          ['4', '0x7020', 'ff ff 00 00 00 f2 cf 00', 'User data 0x0023']
        ]),
        p('Find an entry, including its final byte', 'For selector 0x23, index=4, TI=0, and RPL=3. The entry starts at `GDTR.base + 4 * 8 = 0x7020`. A fetch must fit the whole descriptor inside the inclusive table limit. Five entries occupy forty bytes, so GDTR.limit is 39, or 0x27. Entry 4 starts at table offset 32 and ends at 39, fitting exactly.', 'In this 32-bit environment, LGDT reads a six-byte pseudo-descriptor: two-byte limit followed by four-byte linear base. This table’s pseudo-descriptor bytes are `27 00 00 70 00 00`. With paging enabled, the base is a linear address requiring a valid mapping. The entries also need appropriate write policy for processor accessed-bit updates unless software pre-sets those bits.', 'LGDT changes GDTR without reloading any segment register. Each existing segment cache retains its interpretation until that register is reloaded. Editing a descriptor base in memory consequently has no immediate effect on a loaded DS. A later MOV to DS can suddenly change where the same instruction addresses memory. This is why a table migration needs a register-reload plan.'),
        trace('Observe the hidden cache directly', ['Step', 'Entry 2 base in RAM', 'Cached DS base', 'DS:0x20 reaches'], [
          ['Load DS=0x10', '0x00100000', '0x00100000', '0x00100020'],
          ['Edit descriptor', '0x00200000', '0x00100000', '0x00100020'],
          ['LGDT same table', '0x00200000', '0x00100000', '0x00100020'],
          ['Reload DS=0x10', '0x00200000', '0x00200000', '0x00200020']
        ]),
        p('Reload code and data state deliberately', 'CS cannot be loaded with MOV. A far control transfer supplies a selector and offset and causes code-descriptor checks. During the early mode switch, setting CR0.PE and executing a far jump establishes protected-mode CS state. The descriptor D bit controls default CPU decoding; the assembler’s BITS directive controls which bytes are emitted. Both sides must agree.', 'Selectors 0 through 3 refer to the null GDT entry. Loading a null selector into DS or ES is permitted, but using that unusable segment later faults. SS requires a valid stack descriptor, and CS cannot be null. Treat zero segment state as a deliberate unusable state only where the architecture permits it.', 'The GDT’s null slot consumes eight bytes even though ordinary memory accesses do not use it. That reserved slot makes selector index one equal 0x08. RPL bits can change a selector value without changing its index, so 0x08 and 0x0b still identify entry one. Their privilege checks can differ. Counting raw selector values as descriptor indices produces both wrong pointers and misleading fault diagnostics.'),
        code('Essential protected-mode reload sequence', 'asm', `bits 16
    cli
    lgdt [gdtr]
    mov eax, cr0
    or eax, 1
    mov cr0, eax
    jmp dword 0x08:protected_entry
bits 32
protected_entry:
    mov ax, 0x10
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov fs, ax
    mov gs, ax
    mov esp, 0x90000
    ; Continue with the declared stack and memory contract.
align 8
gdt:
    dq 0
    dq 0x00cf9a000000ffff
    dq 0x00cf92000000ffff
gdt_end:
gdtr:
    dw gdt_end - gdt - 1
    dd gdt`, ['Real-mode DS must make gdtr addressable, and link/load addresses must agree.', 'The far target uses a 32-bit offset and a descriptor with D=1.', 'CLI does not prevent descriptor faults. Install exception handling promptly.']),
        { type: 'flow', title: 'Loading DS creates a checked cache', intro: 'This path is for a non-null ordinary data selector; the null-selector special case has separate rules.', nodes: [
          { id: 'selector', label: 'Decode selector', detail: 'Extract index, TI, and RPL from the sixteen-bit value.', kind: 'process' },
          { id: 'locate', label: 'Locate table entry', detail: 'Use GDT or current LDT and require all eight bytes inside its limit.', kind: 'process' },
          { id: 'checks', label: 'Descriptor checks pass?', detail: 'Validate type, privilege, and presence under the MOV-to-DS rules.', kind: 'decision' },
          { id: 'fault', label: 'Deliver exception', detail: 'The failed load does not install the requested new descriptor.', kind: 'terminal' },
          { id: 'cache', label: 'Load selector and cache', detail: 'Record visible selector plus hidden base, limit, and access attributes.', kind: 'process' },
          { id: 'access', label: 'Use cached translation state', detail: 'Subsequent DS-relative accesses use this state until another reload.', kind: 'terminal' }
        ], edges: [{ from: 'selector', to: 'locate' }, { from: 'locate', to: 'checks' }, { from: 'checks', to: 'fault', label: 'No' }, { from: 'checks', to: 'cache', label: 'Yes' }, { from: 'cache', to: 'access' }], caption: 'Descriptor-table memory is consulted at the load boundary. Updating the memory bytes alone does not follow the cache-installation path.' },
        ex('One stale register, two destinations', 'You replace the GDT and reload DS but leave ES unchanged. The new data descriptor has a different base.', ['Predict a load through DS.', 'Predict REP MOVSB’s destination base.', 'Give a safe update protocol.'], ['DS uses its new cache.', 'REP MOVSB writes through the old ES cache.', 'Build a complete table, protect the transition, update GDTR, reload every affected segment, and deliberately reload CS. Preserve storage needed by all still-active references.'], ['Table-pointer changes and segment-cache changes are separate steps.'])
      ], references: [intel('Volume 3A: Segment Selectors, Segment Registers, Global Descriptor Table, Protected-Mode Initialization')]
    },
    {
      id: 'gdt-privilege-checks', sectionId: 'descriptor-contract', title: 'Calculate CPL, DPL, RPL, type, and presence checks',
      intro: ['Selecting an entry does not grant its privilege. Each operation checks current privilege, requested privilege, descriptor privilege, type, bounds, and presence according to its own rules.'],
      blocks: [
        p('Define each privilege number', 'CPL is current privilege, normally reflected in CS bits 1:0. DPL belongs to a descriptor. RPL belongs to a selector and can restrict a data access. Lower numbers mean greater privilege. A user program at CPL 3 cannot gain Ring 0 privilege by choosing RPL=0.', 'For loading an ordinary data segment into DS, ES, FS, or GS, `max(CPL,RPL) <= DPL` must hold along with valid type and presence. Loading SS instead requires RPL=CPL and DPL=CPL with writable data. A selector useful as a kernel data segment cannot automatically serve as a user stack.', 'A direct far jump to ordinary nonconforming code requires destination DPL=CPL and selector RPL<=CPL. A Ring 3 jump to the kernel code selector therefore fails. A gate provides a separately checked path to privileged code, including stack-switch rules. Conforming code has other rules and is outside this initial flat nonconforming design.'),
        table('Evaluate the operation first', ['Operation', 'Values', 'Result'], [
          ['CPL 3 loads DS=0x10', 'Kernel DPL=0, RPL=0', 'max(3,0)>0: #GP'],
          ['CPL 0 loads DS=0x23', 'User DPL=3, RPL=3', 'Privilege comparison passes'],
          ['CPL 0 loads SS=0x23', 'DPL=3, RPL=3', 'Both differ from CPL: #GP'],
          ['CPL 3 directly jumps to CS=0x08', 'Nonconforming target DPL=0', 'Direct jump cannot perform this privilege entry'],
          ['CPL 3 executes INT 0x80', 'DPL-3 gate targets Ring 0 code', 'Can enter after complete gate/stack checks'],
          ['Device IRQ arrives at CPL 3', 'Gate DPL=0', 'Hardware IRQ does not use software-INT DPL permission']
        ]),
        p('Read the vector together with the error code', 'An invalid table bound, type, or privilege commonly produces #GP. A non-present ordinary segment produces #NP, while a non-present stack segment produces #SS. Stack-switch failures can involve #TS. The exact instruction and failing check determine the vector, so retain both vector and error value.', 'A selector-style error code is not the original selector. Bit 0 is EXT; bit 1 indicates an IDT reference; bit 2 selects GDT versus LDT when IDT is clear; bits 15:3 contain the index. The RPL bits are absent. Zero can indicate that the fault is not attributed to a specific descriptor. A page-fault error code uses a separate format and must never be decoded as this structure.'),
        { type: 'bits', caption: 'Low sixteen bits of a selector-style error code', width: 16, fields: [
          { name: 'Index', high: 15, low: 3, description: 'Entry index in the indicated table.' },
          { name: 'TI', high: 2, low: 2, description: 'If IDT=0: zero for GDT, one for LDT.' },
          { name: 'IDT', high: 1, low: 1, description: 'One means the index refers to an IDT gate.' },
          { name: 'EXT', high: 0, low: 0, description: 'External-event indicator under the architectural exception rules.' }
        ] },
        ex('Decode the table, then inspect the entry', 'A selector-style exception error value is 0x0102.', ['Find the table and index.', 'Explain why it is not a selector.', 'Name evidence needed to find the exact cause.'], ['IDT bit is one; index is 0x0102 >> 3 = 32; EXT is zero.', 'Its low bits encode exception information; selector low bits encode RPL and TI.', 'Use the exception vector and instruction context, then inspect gate type/presence and its target descriptor.'], ['The reference is IDT vector 32.'])
      ], references: [intel('Volume 3A: Protection; Error Codes; interrupt gate privilege checks')]
    },
    {
      id: 'idt-populated-table-and-gate', sectionId: 'idt-layout', title: 'Populate an IDT and decode an interrupt gate byte by byte',
      intro: ['The Interrupt Descriptor Table maps an eight-bit vector to a controlled entry point. A legacy 32-bit interrupt or trap gate occupies eight bytes. The CPU scales the vector, checks the table bound and gate, validates the destination, and builds a return frame.'],
      blocks: [
        { type: 'bits', caption: 'IA-32 32-bit interrupt/trap gate', width: 64, value: '0x00108e0000081234', fields: [
          { name: 'Offset 31:16', high: 63, low: 48, description: 'Upper handler offset within target code segment.' },
          { name: 'P', high: 47, low: 47, description: 'Present gate.' },
          { name: 'DPL', high: 46, low: 45, description: 'Privilege permission for relevant software interrupt instructions.' },
          { name: 'Zero', high: 44, low: 44, description: 'Must be zero for this system gate format.' },
          { name: 'Type', high: 43, low: 40, description: '0xe: 32-bit interrupt gate. 0xf: 32-bit trap gate.' },
          { name: 'Reserved', high: 39, low: 32, description: 'Zero.' },
          { name: 'Selector', high: 31, low: 16, description: 'Executable destination segment selector.' },
          { name: 'Offset 15:0', high: 15, low: 0, description: 'Lower handler offset.' }
        ] },
        p('Assemble and locate a gate', 'For handler 0x00101234, selector 0x0008, present=1, DPL=0, and type 0xe, the low offset is 0x1234 and the high offset is 0x0010. The attribute byte is 0x8e. Memory bytes are `34 12 08 00 00 8e 10 00`. The gate supplies CS=0x08 and EIP=0x00101234; the code descriptor still supplies the target segment’s base, decoding mode, and privilege.', 'With IDTR.base=0x6000, vector 0x20 selects offset 0x100 and gate address 0x6100. A complete 256-entry table occupies 2048 bytes, so its inclusive limit is 0x07ff. A 32-bit LIDT operand for that table has bytes `ff 07 00 60 00 00`. Loading IDTR does not validate all gates, enable interrupts, or initialize a device controller.', 'Populate each vector intentionally. Diagnostic defaults are useful, but a shared destination needs distinct small vector stubs to preserve the vector number. An empty non-present gate causes an exception if referenced; it does not silently discard an event. Decide which vectors user code may invoke and keep that DPL policy explicit.'),
        table('Selected rows of a populated 256-entry table', ['Vector', 'Address at base 0x6000', 'Destination', 'Policy'], [
          ['0x00', '0x6000', 'divide_error_stub', '0x8e, Ring 0 interrupt gate'],
          ['0x03', '0x6018', 'breakpoint_stub', '0xef when deliberately Ring 3-callable'],
          ['0x08', '0x6040', 'double_fault_entry', 'Dedicated emergency entry strategy'],
          ['0x0d', '0x6068', 'general_protection_stub', '0x8e; CPU error code'],
          ['0x0e', '0x6070', 'page_fault_stub', '0x8e; capture CR2'],
          ['0x20', '0x6100', 'timer_irq_stub', '0x8e; remapped IRQ0'],
          ['0x21', '0x6108', 'keyboard_irq_stub', '0x8e; remapped IRQ1'],
          ['0x80', '0x6400', 'syscall_stub', '0xee for deliberate Ring 3 INT 0x80'],
          ['0xff', '0x67f8', 'unexpected_vector_255', 'Last eight bytes end at 0x67ff']
        ]),
        code('Store exact fixed-width gate fields', 'c', `#include <stdint.h>
struct __attribute__((packed)) idt_gate32 {
    uint16_t offset_lo, selector;
    uint8_t zero, attributes;
    uint16_t offset_hi;
};
_Static_assert(sizeof(struct idt_gate32) == 8, "gate size");
static void set_gate(struct idt_gate32 *g, uint32_t target,
                     uint16_t selector, uint8_t attributes) {
    g->offset_lo = (uint16_t)target;
    g->selector = selector;
    g->zero = 0;
    g->attributes = attributes;
    g->offset_hi = (uint16_t)(target >> 16);
}`, ['Target an assembly entry stub with the complete return protocol.', 'Build tables before exposing sources. Concurrent updates need a protocol because independent field writes can create torn gates.', 'Control attributes through kernel policy; a packing helper does not validate gate legality.']),
        p('Gate kind and exception class are independent', 'An interrupt gate clears live IF during entry. A trap gate preserves it. Both retain the interrupted EFLAGS in the return frame. IRETD restores saved state subject to architectural checks. Clearing IF blocks maskable interrupts, while synchronous faults and NMI remain relevant.', 'Fault, trap, and abort describe exception reporting and restart semantics. A page fault normally saves the faulting instruction address so a repaired mapping permits retry. INT3 reports a continuation after its breakpoint instruction. Double fault is an abort requiring an emergency policy. Choosing an interrupt gate for a page fault does not turn it into an interrupt-class event.', 'Gate DPL constrains software entry instructions according to their architectural rules. It does not prevent a device interrupt or processor exception from entering a Ring 0 gate while a user program runs. The gate’s target code descriptor controls the handler privilege. Separating these two DPL roles explains how a Ring 3-callable syscall gate can target Ring 0 code while ordinary device gates remain DPL 0.'),
        { type: 'flow', title: 'A vector crosses the entry boundary', intro: 'The concrete exception vector reports which architectural validation failed; this diagram groups checks for readability.', nodes: [
          { id: 'vector', label: 'Obtain event vector', detail: 'The processor identifies an exception, software request, or external delivery.', kind: 'process' },
          { id: 'gate', label: 'Read IDTR-selected gate', detail: 'Scale by eight in legacy 32-bit mode and validate table bounds.', kind: 'process' },
          { id: 'validate', label: 'Gate and target valid?', detail: 'Check gate type/presence, applicable DPL rules, and destination code.', kind: 'decision' },
          { id: 'failure', label: 'Enter exception delivery', detail: 'A failed entry produces an architectural exception and may escalate.', kind: 'terminal' },
          { id: 'stack', label: 'Choose stack and save frame', detail: 'Use TSS stack on privilege change, then save architectural return state.', kind: 'process' },
          { id: 'handler', label: 'Execute assembly stub', detail: 'Apply gate flag effects and enter the validated CS:EIP destination.', kind: 'terminal' }
        ], edges: [{ from: 'vector', to: 'gate' }, { from: 'gate', to: 'validate' }, { from: 'validate', to: 'failure', label: 'No' }, { from: 'validate', to: 'stack', label: 'Yes' }, { from: 'stack', to: 'handler' }], caption: 'The table identifies an entry destination, while stack construction creates the state required for IRETD.' },
        p('Test installation separately from event production', 'First inspect the bytes and IDTR base/limit while interrupts remain controlled. Then use INT3 through its deliberately configured vector to test a no-error synchronous round trip. Next trigger a real controlled exception whose frame you can predict, with recovery or terminal behavior already defined. Finally enable one device source and inspect its independent acknowledgement path. This sequence identifies whether a failure belongs to table construction, CPU entry, return, or controller delivery.'),
        ex('Split a high handler address correctly', 'Encode a Ring 3-callable interrupt gate targeting selector 0x08 and offset 0xc0123456.', ['Write the eight bytes.', 'Locate vector 0x80 at table base 0x6000.', 'Track live and saved IF when entering with IF=1.'], ['Bytes are 56 34 08 00 00 ee 12 c0.', 'The entry is at 0x6400.', 'Live IF clears; saved IF remains one for the return.'], ['0xee means present, DPL 3, type 0xe.'])
      ], references: [intel('Volume 3A: IDT; Interrupt and Exception Handling; Exception Classifications'), ostep('cpu-mechanisms.pdf', 'Chapter 6: controlled entry')]
    },
    {
      id: 'interrupt-hardware-frame-ledger', sectionId: 'frames', title: 'Calculate the exact 32-bit hardware frame before saving registers',
      intro: ['Hardware entry performs ordered stack writes. The frame depends on gate size, privilege change, and whether the delivered event supplies an error code. General-purpose registers are still the stub’s responsibility.'],
      blocks: [
        p('Start with same-privilege entry', 'Assume ordinary 32-bit protected mode, no virtual-8086 transition, a valid 32-bit gate, and a Ring 0 stack. Hardware saves EFLAGS, CS, and EIP, leaving saved EIP at the lowest address. Each occupies a four-byte stack slot; the selector uses only sixteen meaningful bits, so do not treat upper selector-slot padding as useful state.', 'If the actual exception supplies an error code, hardware pushes it last. Device IRQs and software INT do not gain an error code merely because their vector number matches an exception that normally has one. Thus `int 14` does not reproduce a page-fault hardware frame and can break a page-fault stub that expects the CPU error word.'),
        trace('Same-CPL page fault with old ESP=0x00801000', ['Write', 'Address', 'Value'], [
          ['1', '0x00800ffc', 'Old EFLAGS'], ['2', '0x00800ff8', 'Old CS in a four-byte slot'],
          ['3', '0x00800ff4', 'Faulting EIP'], ['4', '0x00800ff0', 'Page-fault error code'],
          ['Entry', 'ESP=0x00800ff0', 'EIP at ESP+4; no old SS:ESP pair']
        ]),
        table('Baseline exception error-word policy', ['Vectors', 'Hardware error word', 'Stub action'], [
          ['0 through 7', 'No', 'Push synthetic zero'],
          ['8: double fault', 'Yes, zero', 'Emergency entry with correct hardware frame'],
          ['10,11,12,13: TSS/segment/stack/protection', 'Yes', 'Preserve selector-style value'],
          ['14: page fault', 'Yes', 'Preserve page-fault value and read CR2'],
          ['16,18,19: floating-point/machine-check/SIMD', 'No', 'Push synthetic zero; inspect additional state'],
          ['17: alignment check', 'Yes, zero', 'Preserve CPU error slot'],
          ['Feature-dependent exceptions such as #CP', 'Depends on enabled feature', 'Extend the generated stub policy explicitly']
        ]),
        p('Normalize frames without losing evidence', 'A no-error stub pushes synthetic zero and then vector. An error stub pushes only vector. Common entry then sees `[vector,error,EIP,CS,EFLAGS,...]`. Saved CS low bits identify the interrupted privilege and whether an outer-privilege SS:ESP pair follows. This frame rule is specific to this legacy 32-bit path.', 'Common exit discards vector and error before IRETD. IRETD expects EIP on top and does not remove an exception error word. An incorrect adjustment turns an error value, selector, or flags word into a return address. Trace exact addresses whenever you alter save order.', 'For page faults, capture CR2 before diagnostic work can cause a nested page fault. Preserve the original frame pointer before aligning a C-call stack. Keep early diagnostics independent of pageable buffers and locks that the interrupted code might own.'),
        ex('Normalize two entries to one shape', 'An IRQ and a page fault separately arrive at old ESP=0x8000 without changing CPL.', ['Compute hardware ESP for both.', 'Compute normalized ESP.', 'State the common exit adjustment.'], ['IRQ: 0x7ff4 after twelve bytes. Page fault: 0x7ff0 after sixteen.', 'IRQ adds eight and fault adds four, so both reach 0x7fec.', 'Discard eight bytes for vector plus error, then IRETD consumes the hardware return frame.'], ['Both normalized prefixes have the same five words.'])
      ], references: [intel('Volume 3A: interrupt procedures, error codes, exception reference')]
    },
    {
      id: 'interrupt-assembly-c-bridge', sectionId: 'frames', title: 'Save registers, clear DF, call C, and return with IRETD',
      intro: ['Software preserves the interrupted computation and creates a valid C environment around the hardware frame. This bridge assumes the course’s flat 32-bit kernel, an ABI with 16-byte pre-CALL alignment, and handlers compiled without floating-point or SIMD use.'],
      blocks: [
        code('Common entry for normalized IA-32 stubs', 'asm', `bits 32
extern interrupt_dispatch
global irq0_stub, gp_stub
irq0_stub:
    push dword 0
    push dword 32
    jmp common_entry
gp_stub:
    push dword 13          ; CPU supplied #GP error already
    jmp common_entry
common_entry:
    pushad
    xor eax, eax
    mov ax, ds
    push eax
    mov ax, es
    push eax
    mov ax, fs
    push eax
    mov ax, gs
    push eax
    mov ax, 0x10
    mov ds, ax
    mov es, ax
    mov fs, ax
    mov gs, ax
    cld
    mov ebx, esp          ; ABI preserves EBX across C call
    and esp, -16
    sub esp, 12
    push ebx              ; argument; pre-call ESP aligned
    call interrupt_dispatch
    mov esp, ebx
    pop eax
    mov gs, ax
    pop eax
    mov fs, ax
    pop eax
    mov es, ax
    pop eax
    mov ds, ax
    popad
    add esp, 8            ; vector and normalized error
    iretd`, ['Save EAX before using it as scratch. PUSHAD’s saved ESP points to the normalized vector; POPAD skips that ESP slot.', 'Explicit zero-extended segment saves avoid relying on legacy segment-push padding.', 'The C function must preserve EBX and return normally. This bridge always resumes its original frame.', 'Keep interrupts non-nested until stack capacity, lock rules, and controller policy support nesting.', 'No extended CPU state is saved here. Either prohibit such instructions in handlers or implement a complete extended-state ownership protocol.']),
        code('Match C offsets to the assembly order', 'c', `#include <stdint.h>
#include <stddef.h>
struct irq_frame32 {
    uint32_t gs, fs, es, ds;
    uint32_t edi, esi, ebp, pushad_esp;
    uint32_t ebx, edx, ecx, eax;
    uint32_t vector, error, eip, cs, eflags;
    /* If (cs & 3) != 0, user_esp and user_ss follow. */
};
_Static_assert(offsetof(struct irq_frame32, vector) == 48,
               "vector offset mismatch");
_Static_assert(offsetof(struct irq_frame32, eip) == 56,
               "EIP offset mismatch");
_Static_assert(sizeof(struct irq_frame32) == 68, "frame size");`, ['Read optional outer-privilege words only when the saved CS and entry mode guarantee they exist.', 'Changes to assembly pushes require matching C and debugger offsets.']),
        p('Interrupt return is an architectural operation', 'An interrupt can arrive while ordinary caller-saved registers contain live values. The interrupted code never arranged a C call and never agreed to lose EAX, ECX, or EDX. Saving complete required integer state before calling C preserves this computation.', 'RET restores an instruction pointer only. IRETD restores interrupt-return state and applies privilege checks, including restoration of an outer-privilege stack when appropriate. STI plus RET cannot replace it. Saved EFLAGS restore the original DF, allowing CLD to protect C without permanently changing the interrupted program’s direction.', 'A scheduler can eventually choose a different saved frame, but that requires an explicit switch of stack and complete state ownership. Passing a frame pointer into C alone does not implement switching. This bridge anchors ESP in EBX and resumes the same frame.'),
        trace('The alignment gap stays below saved state', ['Stage', 'ESP', 'Meaning'], [
          ['Old ESP', '0x00801000', 'Before same-CPL IRQ'],
          ['Hardware plus normalization', '0x00800fec', 'Twenty bytes'],
          ['PUSHAD plus segments', '0x00800fbc', 'Sixty-eight-byte base frame; save in EBX'],
          ['Align down', '0x00800fb0', 'Temporary gap below frame'],
          ['Reserve 12, push argument', '0x00800fa0', 'Aligned CALL site'],
          ['Return and MOV ESP,EBX', '0x00800fbc', 'Recover exact frame without guessing gap size']
        ]),
        ex('A save-after-clobber bug', 'A stub loads AX=0x10 before executing PUSHAD.', ['Identify the corruption.', 'Explain why POPAD cannot repair it.', 'Give a regression observation.'], ['Interrupted EAX low sixteen bits are lost.', 'PUSHAD saved the modified value.', 'Preserve registers first; arrange EAX=0x1234abcd before an interrupt and compare it afterward. Also test DF=1 across entry while observing DF=0 inside C.'], ['EAX and original DF survive a complete entry/return.'])
      ], references: [intel('PUSHAD, POPAD, CLD, and IRET instruction definitions; interrupt procedure handling')]
    },
    {
      id: 'tss-stack-switch-and-double-fault', sectionId: 'proof', title: 'Enter a trusted TSS stack and prepare for double faults',
      intro: ['Ring 3 code controls its user stack. A 32-bit gate entering Ring 0 obtains a trusted stack from the Task State Segment. Software scheduling can use this service while performing ordinary context switches in software.'],
      blocks: [
        p('Prepare and load a minimal TSS', 'A 32-bit TSS contains ESP0 at byte offset 4 and SS0 at offset 8. Its minimum architectural extent is 104 bytes. The GDT descriptor uses S=0 and available 32-bit TSS type 0x9; with present=1 and DPL=0, access is 0x89. Use byte granularity and a limit of at least 103. LTR loads the task register’s selector and cached descriptor information and marks the descriptor busy. It does not switch the current task.', 'Set SS0 to the kernel writable-data selector, for example 0x10, and ESP0 to the current thread’s kernel-stack top. The I/O-map base is at offset 102. Setting it to 104 with descriptor limit 103 places the permission bitmap outside this TSS. With IOPL=0, user I/O is denied under the architectural bitmap rules. I/O-port permissions are separate from page permissions.', 'Before returning to a different user thread, update ESP0 for that thread. A same-CPL kernel interrupt continues on the current stack; it does not consult ESP0 to obtain a fresh stack. Per-thread entry stacks consequently do not automatically protect against kernel-stack exhaustion.'),
        trace('Ring 3 page fault, ESP0=0x00802000', ['Write', 'New-stack address', 'Value'], [
          ['1', '0x00801ffc', 'Old user SS, e.g. 0x23'], ['2', '0x00801ff8', 'Old user ESP, e.g. 0xbffff000'],
          ['3', '0x00801ff4', 'Old EFLAGS'], ['4', '0x00801ff0', 'Old user CS, e.g. 0x1b'],
          ['5', '0x00801fec', 'Faulting user EIP'], ['6', '0x00801fe8', 'Page-fault error'],
          ['Stub', '0x00801fe4', 'Vector 14; user ESP/SS remain after EFLAGS']
        ]),
        table('Objects with distinct update rules', ['Object', 'Purpose', 'Update point'], [
          ['GDT TSS descriptor', 'Base, limit, type, presence', 'CPU initialization or protected reconfiguration'],
          ['Task register', 'Selector and hidden TSS attributes', 'LTR during CPU setup'],
          ['TSS.ESP0/SS0', 'Trusted privilege-entry stack', 'ESP0 follows current thread'],
          ['Current ESP', 'Actual running kernel stack', 'Calls, returns, context-switch assembly'],
          ['Saved user ESP/SS', 'User continuation stack', 'Hardware frame and validated return construction']
        ]),
        p('A fault during exception delivery needs another plan', 'If a kernel stack overflows into a guard page, delivering the resulting page fault can itself fail when hardware writes the return frame. Particular combinations of exceptions during delivery produce double fault, an abort with error code zero. The architectural combination rules determine escalation; every second exception is not automatically double fault.', 'In legacy 32-bit protected mode, an IDT task gate to a separately prepared emergency TSS can provide independent execution state and stack for double fault. This uses hardware task-switch semantics and requires correct available/busy state. A teaching kernel should use a narrow terminal diagnostic path. In 64-bit mode, an IST stack provides a different independent-stack mechanism.', 'If double-fault delivery also fails, the processor reaches shutdown behavior commonly observed as an emulator reset or stop. A useful disposable-emulator experiment exhausts a guarded stack after configuring a dedicated emergency stack and a fixed diagnostic. General formatting code can fault or wait on an already-held lock, so emergency output needs narrowly controlled dependencies.'),
        ex('The scheduler changes the thread but misses ESP0', 'A uses kernel-stack top 0x804000; B uses 0x808000. The scheduler returns to B with TSS.ESP0 still pointing to A.', ['Trace B’s next user timer interrupt.', 'Identify corrupted ownership.', 'State the required ordering.'], ['Hardware builds B’s privilege-entry frame on A’s stack.', 'A’s dormant kernel continuation can be overwritten despite separate user pages.', 'Install B’s trusted stack and CPU-local current-thread state before returning to B and exposing asynchronous entry.'], ['TSS.ESP0 agrees with the selected user thread.'])
      ], references: [intel('Volume 3A: Task State Segment, Task Register, I/O Permission Bit Map, Double-Fault Exception')]
    }
  ],
  'drivers-and-irqs': [
    {
      id: 'pic-remap-mask-eoi', sectionId: 'pic', title: 'Program the 8259 pair and explain every acknowledgement',
      intro: ['A legacy PC routes sixteen numbered IRQ inputs through two cascaded interrupt controllers. The master sees the slave on IRQ2. Controller vector numbers, IDT entries, device status, CPU IF, and controller in-service state are separate parts of the delivery path.'],
      blocks: [
        table('Ports and controller state', ['Object', 'Master / slave', 'Meaning'], [
          ['Command port', '0x20 / 0xa0', 'Initialization, EOI, register-selection commands'],
          ['Data port', '0x21 / 0xa1', 'Initialization data or interrupt mask'],
          ['IRR', 'One bit per input', 'Pending requests recorded by the controller'],
          ['ISR', 'One bit per input', 'Requests accepted for service and awaiting EOI'],
          ['IMR', 'One bit per input', 'One masks delivery of that input']
        ]),
        p('Remap before unmasking', 'Processor exceptions occupy vectors 0 through 31, so assign the master IRQs to 0x20–0x27 and the slave IRQs to 0x28–0x2f. An 8259 block covers eight vectors and its base must be aligned to eight. IRQ14 consequently maps to vector 0x2e: the slave input is 14 minus 8, or 6, added to slave base 0x28.', 'Initialization command word 1 value 0x11 requests initialization, cascaded operation, edge triggering, and a following ICW4. ICW2 supplies the vector base. The master ICW3 value 0x04 indicates a slave attached at input 2, while slave ICW3 value 0x02 states its cascade identity. ICW4 value 0x01 selects 8086 mode with explicit EOI. Preserve ordering and any I/O delay required by the target platform.', 'For a timer-and-keyboard-only experiment, mask all inputs while configuring, install handlers, initialize the devices, then set master mask 0xfc and slave mask 0xff. Only master inputs 0 and 1 become unmasked. If a slave device is enabled later, unmask both its slave bit and the master cascade bit. Leaving master IRQ2 masked blocks every slave source.'),
        code('PIC initialization for the bounded legacy machine', 'c', `#include <stdint.h>
extern void outb(uint16_t port, uint8_t value);
extern void io_wait(void);
static void pic_write(uint16_t p, uint8_t v) {
    outb(p, v); io_wait();
}
static void pic_remap_masked(void) {
    pic_write(0x20, 0x11); pic_write(0xa0, 0x11);
    pic_write(0x21, 0x20); pic_write(0xa1, 0x28);
    pic_write(0x21, 0x04); pic_write(0xa1, 0x02);
    pic_write(0x21, 0x01); pic_write(0xa1, 0x01);
    pic_write(0x21, 0xff); pic_write(0xa1, 0xff);
}
static void pic_eoi_real_irq(unsigned irq) {
    if (irq >= 8) outb(0xa0, 0x20);
    outb(0x20, 0x20);
}`, ['Call initialization while the CPU cannot accept ordinary device IRQs and before exposing controller sources.', 'The EOI helper accepts only a confirmed real IRQ number from 0 through 15, after handling spurious cases.', 'For a slave IRQ, acknowledge the slave first and then the master cascade.']),
        p('Device acknowledgement and EOI solve different problems', 'Reading or clearing device status consumes the device’s reason for requesting service. EOI clears the controller’s in-service bookkeeping. IRETD restores the interrupted CPU state. None of these three actions substitutes for either of the others. A level-triggered source can immediately request again if the device condition remains asserted when EOI is sent.', 'For a suspected spurious IRQ7, read the master ISR by selecting it with command 0x0b and inspect bit 7. If clear, no master EOI is needed. For a suspected spurious IRQ15, inspect slave ISR bit 7. If clear, skip slave EOI but acknowledge the master cascade. A real IRQ7 or IRQ15 follows ordinary acknowledgement. Do not apply the spurious shortcut solely because the vector ends in seven.'),
        trace('A real IRQ14 traverses both controllers', ['Step', 'State change', 'Owner action'], [
          ['Device requests', 'Slave input 6 becomes pending', 'Device must be serviced'],
          ['Delivery', 'Slave ISR6 and master ISR2 record service', 'CPU enters IDT vector 0x2e'],
          ['Handler consumes status', 'Device cause is cleared', 'Publish completion to the driver queue'],
          ['Slave EOI', 'Slave service priority is released', 'OUT 0xa0,0x20'],
          ['Master EOI', 'Cascade service priority is released', 'OUT 0x20,0x20'],
          ['Return', 'Saved CPU state resumes', 'IRETD']
        ]),
        ex('Why the second disk completion never arrives', 'The first IRQ14 works. The handler sends EOI only to the slave.', ['Identify the stale bit.', 'Explain the effect on later slave events.', 'Compare with spurious IRQ15 handling.'], ['The master cascade remains in service on input 2.', 'Further equal or lower-priority service can be blocked by the master’s stale state.', 'Spurious IRQ15 requires only master EOI because the slave never entered service; a real IRQ14 needs both.'], ['A real slave IRQ clears service state in both controllers.'])
      ], references: [{ label: 'Intel I/O Platform Datasheet', url: 'https://cdrdv2-public.intel.com/332995/332995-skl-io-platform-datasheet-vol1_rev004.pdf', section: 'Interrupt Controller: initialization, masks, EOI, spurious interrupts' }, intel('External interrupt delivery and interrupt-return state')]
    },
    {
      id: 'pit-frequency-time-accounting', sectionId: 'pit', title: 'Derive PIT divisors and separate ticks from elapsed time',
      intro: ['A programmable timer counts input-clock cycles and requests interrupts at selected boundaries. The requested frequency, the realizable divisor, delivered interrupts, and elapsed wall time are four distinct quantities.'],
      blocks: [
        p('Choose an achievable period', 'Use the course’s nominal PIT input frequency of 1,193,182 Hz. For requested frequency f, choose divisor `round(1193182 / f)` within the supported mode’s legal range. A 100 Hz request gives divisor 11932, or 0x2e9c. The resulting nominal frequency is 99.99849145 Hz, so each period is about 10.00015086 ms. The error is small but systematic.', 'A binary 16-bit PIT count value of zero encodes 65536. That special encoding must be represented deliberately by configuration code. Very small divisors have mode-specific restrictions; validate rates and divisors before narrowing the count to sixteen bits. Actual platform clock tolerance and emulation scheduling create additional uncertainty beyond integer-divisor rounding.', 'For channel 0, low-byte/high-byte writes, mode 2 rate generation, and binary counting, the command byte is 0x34. Write it to port 0x43, then write 0x9c and 0x2e to channel port 0x40. The complete programming pair must not interleave with another writer to the same timer channel.'),
        table('Decode command 0x34 = binary 00110100', ['Bits', 'Value', 'Purpose'], [
          ['7:6', '00', 'Channel 0'], ['5:4', '11', 'Write low byte followed by high byte'],
          ['3:1', '010', 'Mode 2 periodic rate generator'], ['0', '0', 'Binary count']
        ]),
        code('Program this one declared rate', 'c', `#include <stdint.h>
extern void outb(uint16_t, uint8_t);
static void pit_start_approximately_100hz(void) {
    const uint16_t divisor = 11932;
    outb(0x43, 0x34);
    outb(0x40, (uint8_t)divisor);
    outb(0x40, (uint8_t)(divisor >> 8));
}`, ['Install IRQ0’s handler and complete PIC routing first.', 'A timer IRQ handler should update bounded state and acknowledge the controller; avoid printing every tick.', 'This function does not calibrate platform clock accuracy.']),
        p('Count events without pretending they are a clock', 'If interrupts are disabled for several periods, a legacy controller’s pending state does not necessarily queue one separate software event for every elapsed edge. Incrementing a tick counter once per delivered IRQ can therefore undercount elapsed time. Use a suitable monotonic clock source for elapsed durations and treat periodic IRQs as scheduling opportunities.', 'On a 32-bit CPU, reading a 64-bit tick count can tear across two machine loads. Use a brief local interrupt exclusion when the sole writer is this CPU’s IRQ handler, or a correctly designed sequence counter/atomic scheme when multiple CPUs are involved. Local interrupt exclusion alone does not serialize another CPU.', 'Separate clock source from clock event. A source measures time, while an event device requests future attention. Sleep can record an absolute deadline and recheck the source after waking. This avoids accumulating error from repeated approximate delays and remains meaningful when a timer interrupt arrives late.'),
        ex('Three periods, one observed interrupt', 'IRQs stay disabled for 35 ms with this nominal 100 Hz PIT configuration. On re-enabling, the kernel observes one pending IRQ.', ['Explain why one handler run cannot establish a 10 ms elapsed interval.', 'Calculate divisor-induced error after 100 nominal periods.', 'Choose evidence for a correct 30 ms timeout.'], ['The controller may coalesce elapsed requests; at least the disabled interval passed without a handler.', 'One hundred periods take about 1000.015086 ms under the nominal input clock, about 0.015086 ms longer than one second.', 'Record a monotonic deadline and compare the current clock after delivery; wakeups can be late but must not claim completion before the deadline.'], ['Elapsed-time policy does not equate delivered IRQ count with complete time history.'])
      ], references: [{ label: 'Intel I/O Platform Datasheet', url: 'https://cdrdv2-public.intel.com/332995/332995-skl-io-platform-datasheet-vol1_rev004.pdf', section: '8254 Timers: programming and counter access' }, osc('Chapter 1: timer and operating-system control')]
    },
    {
      id: 'keyboard-byte-protocol-parser', sectionId: 'keyboard', title: 'Turn keyboard bytes into events with an explicit parser',
      intro: ['A keyboard IRQ announces available device data. The byte may be a prefix, press, release, command response, or error. A key event, a layout-dependent character, and an edited line belong to progressively higher layers.'],
      blocks: [
        p('Declare the device protocol', 'This worked trace assumes the legacy controller is configured to deliver translated scan-code set 1 for the keyboard. A real initialization path must establish that contract. Port 0x64 provides controller status; bit 0 means the output buffer contains a byte. Read data from 0x60 only under the appropriate status condition. Distinguish auxiliary-device data and status errors according to the controller contract.', 'The IRQ handler should capture a bounded number of available bytes into a queue, record overflow, and acknowledge the interrupt path. A deferred parser converts bytes to key events. Polling and IRQ code cannot both consume the same data port independently, because one can steal the other’s byte. Choose one owner and define command-response routing.', 'For many set-1 keys, the high bit marks release and the low seven bits identify a key. E0 introduces an extended code. E1 introduces a longer special sequence. A parser that masks every byte with 0x7f treats prefixes as ordinary keys and loses identity. Print Screen and Pause also need deliberate multibyte handling; the small trace below covers only ordinary keys and one E0 extended key.'),
        trace('Decode Shift+A and an extended right-arrow press/release', ['Input byte', 'Parser state/action', 'Event or text'], [
          ['2a', 'Left Shift press; record modifier down', 'Key event; no character'],
          ['1e', 'A-position press while Shift held', 'Layout produces uppercase A'],
          ['9e', 'A-position release', 'Key-up event; no character'],
          ['aa', 'Left Shift release', 'Modifier becomes clear'],
          ['e0', 'Remember extended prefix', 'No complete event yet'],
          ['4d', 'Extended right-arrow press', 'Navigation event'],
          ['e0', 'Remember extended prefix', 'No complete event yet'],
          ['cd', 'Extended right-arrow release', 'Navigation key-up event']
        ]),
        p('Preserve state across interrupts', 'The E0 prefix and its following byte can arrive in separate IRQ invocations. Parser state therefore belongs to the device stream, not a local variable reset on every interrupt. Overflow can discard half a multibyte sequence or a modifier release. Choose a resynchronization policy, such as clearing partial-prefix state and marking modifier state uncertain until reset, and expose a dropped-byte counter.', 'Keyboard commands are another state machine. After sending a command, responses such as ACK and RESEND belong to the command transaction. A robust implementation tracks the expected response, retries with a finite budget, and prevents response bytes from reaching the text parser. Because special-key byte patterns can overlap response values in a context-dependent protocol, parsing requires command state.', 'Layout conversion happens after physical key identification. Shift and Caps Lock affect alphabetic conversion according to the selected layout; arrow keys do not become characters. The line editor then interprets backspace, cursor motion, and Enter. Keeping these states distinct makes it possible to test each stage with synthetic bytes without needing real IRQ timing.'),
        ex('A queue overflow makes Shift stick', 'The queue delivers Shift press and A press, drops Shift release, and later delivers another A press.', ['Predict the naive text result.', 'Explain why increasing buffer size cannot prove correctness.', 'Specify an observable recovery rule.'], ['A parser retaining Shift forever emits uppercase for the later A.', 'Any finite buffer can overflow under sufficient producer/consumer imbalance.', 'Count overflow, discard incomplete sequence state, and explicitly resynchronize keyboard/modifier state under a documented reset or recovery protocol.'], ['Dropped input is visible.', 'Special sequences and responses never become arbitrary text.'])
      ], references: [{ label: 'Linux i8042 I/O definitions', url: 'https://raw.githubusercontent.com/torvalds/linux/master/drivers/input/serio/i8042-io.h', section: 'Legacy controller ports and access functions' }, ostep('file-devices.pdf', 'Chapter 36: device interface and interrupt-driven I/O'), osc('Chapter 12: I/O systems')]
    },
    {
      id: 'driver-deferred-work-and-queues', sectionId: 'verification', title: 'Bound interrupt work and prove queue ownership',
      intro: ['An interrupt handler runs inside an interrupted execution context. Its latency, locking, and memory ownership affect every activity sharing that CPU. Keep the immediate path bounded and move work with unbounded duration into a schedulable context.'],
      blocks: [
        { type: 'flow', title: 'A byte becomes deferred work', intro: 'Each boundary changes ownership and provides a testable invariant.', nodes: [
          { id: 'device', label: 'Device has data', detail: 'Hardware state reports readable bytes.', kind: 'terminal' },
          { id: 'irq', label: 'Capture bounded bytes', detail: 'IRQ path reads status and stores only within the queue budget.', kind: 'process' },
          { id: 'room', label: 'Queue has room?', detail: 'Producer checks capacity before publishing.', kind: 'decision' },
          { id: 'publish', label: 'Publish and wake', detail: 'Payload becomes visible before the new head index.', kind: 'process' },
          { id: 'drop', label: 'Record overflow', detail: 'Loss invokes a documented recovery policy.', kind: 'process' },
          { id: 'worker', label: 'Worker parses events', detail: 'A schedulable consumer performs longer processing.', kind: 'terminal' }
        ], edges: [{ from: 'device', to: 'irq' }, { from: 'irq', to: 'room' }, { from: 'room', to: 'publish', label: 'Yes' }, { from: 'room', to: 'drop', label: 'No' }, { from: 'publish', to: 'worker' }, { from: 'drop', to: 'worker' }], caption: 'The device condition and controller EOI are handled in the IRQ path according to device ordering requirements.' },
        p('A queue is a publication protocol', 'For a single producer and single consumer ring of capacity N, each side owns its own monotonically advancing index. The producer writes payload before publishing head with release semantics. The consumer loads head with acquire semantics before reading payload. The consumer similarly releases a slot by publishing tail only after it finishes reading. Use unsigned arithmetic and a capacity/window design whose wraparound rules are proved.', 'Volatile makes some compiler accesses observable; it does not establish a C inter-thread synchronization relation. Use language atomics or architecture-specific primitives with a documented compiler and hardware ordering contract. The ring also needs correct cache visibility on every participating CPU and no extra producer hidden in a polling path.', 'On a uniprocessor, an interrupt handler that spins on a lock held by the interrupted thread deadlocks: the owner cannot resume to release it. Use an interrupt-safe locking discipline, a lock-free bounded publication path, or local IRQ exclusion around the shared critical section as appropriate. On SMP, IRQ exclusion protects against this CPU’s interrupts but other CPUs still require inter-CPU synchronization.'),
        table('Estimate capacity from an explicit service gap', ['Quantity', 'Example', 'Implication'], [
          ['Worst burst during gap', '20 bytes', 'Reserve at least this many arrivals'],
          ['Steady arrival rate', '1000 bytes/s', 'A 50 ms consumer gap adds 50 bytes'],
          ['Required capacity from these assumptions', '20 + 50 = 70 bytes', 'Choose at least 70 usable slots; ring conventions may reserve one'],
          ['If gap is unbounded', 'Worker can starve indefinitely', 'No finite buffer guarantees losslessness']
        ]),
        ex('A fast average hides a latency failure', 'The handler usually takes 3 microseconds, but occasionally formats a large diagnostic for 8 milliseconds.', ['Explain why the average hides a problem.', 'Move the diagnostic while retaining evidence.', 'Choose two measurements for the revised path.'], ['The long tail delays other interrupts and consumes queue headroom regardless of the average.', 'Record a fixed-size event and counters in the handler, then format them in a worker with an overflow policy.', 'Measure worst observed handler duration and maximum queue occupancy, together with drop counts under a specified input load.'], ['IRQ work has a bounded operation budget and visible overflow.'])
      ], references: [ostep('file-devices.pdf', 'Chapter 36: interrupt and polling mechanisms'), ostep('threads-locks.pdf', 'Chapter 28: synchronization'), osc('Chapter 12: kernel I/O subsystem')]
    }
  ],
  'long-mode-and-uefi': [
    {
      id: 'long-mode-paging-transition', sectionId: 'long-mode', title: 'Derive the page-table and control-register handoff into 64-bit code',
      intro: ['Long-mode activation is a coordinated change to paging and instruction decoding. This trace begins in 32-bit protected mode with paging disabled and enters ordinary four-level IA-32e paging. Five-level paging, CET, and other optional extensions remain outside this initial configuration.'],
      blocks: [
        p('Define the reachable set before changing CR0', 'Check CPUID support for the selected features, including long mode and PAE. Reserve aligned paging structures and enough memory for the transition code, GDT, stack, and early IDT/handlers. Every linear access needed immediately after enabling paging must translate, including instruction fetch, stack pushes, descriptor fetches, and exception delivery.', 'For a deliberately small identity-mapped first 2 MiB, place a PML4 at physical 0x1000, a PDPT at 0x2000, and a page directory at 0x3000. Zero all entries. Set PML4[0]=0x2003 and PDPT[0]=0x3003. Set PD[0]=0x83: present, writable, page-size bit set, physical base zero. This uses a 2 MiB leaf and maps linear [0,0x200000) to the same physical interval. Mapping an interval does not prove that every byte is usable RAM.', 'An address such as 0x00123456 selects index zero at the top three levels of this example and has a 2 MiB offset of 0x123456. The translated physical address is therefore 0x123456. Address 0x00200000 selects PD index one, which is zero, and faults. This boundary is an excellent explicit post-transition test after fault handling is ready.'),
        table('Register and descriptor sequence', ['Step', 'Action', 'Reason'], [
          ['1', 'Remain CR0.PE=1 and CR0.PG=0', 'Establish the supported activation starting state'],
          ['2', 'Set CR4.PAE; leave LA57 disabled for this design', 'Select the intended IA-32e paging structure family'],
          ['3', 'Load CR3 with physical 0x1000', 'Identify the page-table root'],
          ['4', 'Set IA32_EFER.LME using RDMSR/WRMSR', 'Request IA-32e operation when paging starts'],
          ['5', 'Set CR0.PG', 'Activate paging and IA-32e under the established prerequisites'],
          ['6', 'Far jump to present code with L=1 and D=0', 'Load a 64-bit CS and decode 64-bit instructions'],
          ['7', 'Load a mapped aligned RSP and valid data state', 'Prepare the selected kernel ABI before C']
        ]),
        p('There is an intermediate decoding state', 'Setting LME alone does not execute 64-bit instructions. After paging activates IA-32e, the current 32-bit code descriptor continues to select compatibility-mode decoding until a far transfer loads a descriptor with L=1 and D=0. Emit the transition instructions for the mode that actually decodes them. The destination itself must be reachable through the new mappings.', 'A four-level 48-bit linear address is canonical when bits 63:48 repeat bit 47. Thus 0xffff800000001000 is canonical while 0x0000800000001000 is not. Canonicality and presence are separate checks: a canonical address can still lack a translation. Optional five-level paging changes the relevant sign-extension boundary and needs its own negotiated setup.', 'The x86-64 System V kernel compilation must disable the user-space red zone. Interrupt hardware can write below the interrupted RSP, so compiler temporaries silently stored there would be vulnerable. Establish 16-byte pre-CALL stack alignment, pass arguments in the chosen ABI registers, and explicitly initialize floating-point/SIMD state before permitting compiler instructions that use it. The 32-bit assembly bridge cannot be reused by renaming ESP to RSP.'),
        ex('Find a transition’s unmapped dependency', 'Only [0,2 MiB) is identity mapped. The far target is at 0x100000, but the new RSP is 0x400000 and the IDT is at 0x300000.', ['Predict the first push.', 'Explain why exception delivery may escalate.', 'Give the minimal mapping plan before activation.'], ['A stack write below 0x400000 faults because that page has no mapping.', 'Fetching an IDT gate at 0x300000 also needs an unmapped address, so the original fault cannot be handled normally.', 'Map transition instructions, all descriptor tables, early handlers, and complete stack intervals before enabling paging, or place them within the already mapped owned region.'], ['The mapping ledger includes metadata and error paths.'])
      ], references: [intel('Volume 3A: Initializing IA-32e Mode; 4-Level Paging; Canonical Addressing'), osc('Chapter 9: address translation')]
    },
    {
      id: 'long-mode-descriptors-ist-frames', sectionId: 'abi', title: 'Rebuild GDT, sixteen-byte IDT gates, TSS, and IST for x86-64',
      intro: ['Long mode retains descriptor tables while changing their jobs and some entry sizes. Ordinary code/data descriptors remain eight bytes, an x64 TSS descriptor occupies sixteen, and every IA-32e interrupt/trap gate occupies sixteen. The hardware interrupt frame also changes.'],
      blocks: [
        p('Keep the relevant descriptor semantics', 'A 64-bit code descriptor has L=1 and D=0. Base and limit do not provide ordinary code/data bounds in 64-bit execution; paging supplies the primary memory boundary. CS still carries privilege and code-mode information. FS and GS bases remain useful for thread-local and CPU-local addressing and require explicit setup. Compatibility mode retains different segment behavior.', 'For a simple 64-bit Ring 0 code descriptor with the familiar maximum legacy limit fields retained, access=0x9a and flags nibble=0xa produces 0x00af9a000000ffff. Here G=1, L=1, and D=0. The upper limit fields do not create 64-bit bounds. An x64 TSS descriptor supplies a 64-bit base across two adjacent eight-byte GDT slots; count both slots when computing selectors and the table limit.'),
        table('Sixteen-byte IDT gate for RIP 0xffff800000123456, selector 0x08, IST1', ['Offsets', 'Bytes', 'Fields'], [
          ['0–1', '56 34', 'RIP bits 15:0'], ['2–3', '08 00', 'Target code selector'],
          ['4', '01', 'IST index 1 in low three bits; reserved bits zero'],
          ['5', '8e', 'P=1, DPL=0, 64-bit interrupt gate type'],
          ['6–7', '12 00', 'RIP bits 31:16'], ['8–11', '00 80 ff ff', 'RIP bits 63:32'],
          ['12–15', '00 00 00 00', 'Reserved zero']
        ]),
        p('A wider table and an unconditional saved stack pair', 'A complete 256-entry x64 IDT occupies 4096 bytes and has limit 0x0fff. LIDT in 64-bit mode uses a ten-byte pseudo-descriptor containing the two-byte limit and eight-byte base. A vector is multiplied by sixteen to locate its gate. The handler target must be canonical and select 64-bit code.', 'In 64-bit mode, hardware pushes eight-byte stack slots and saves old SS:RSP even when CPL does not change. It aligns the selected stack pointer down to a 16-byte boundary before constructing the frame. Without an error code, five pushes consume forty bytes, so the resulting RSP is eight modulo sixteen when the selected aligned top was zero modulo sixteen. With an error code, forty-eight bytes leave zero modulo sixteen. The assembly-to-C bridge must account for the actual shape and any later saves.', 'The x64 TSS contains RSP0 for ordinary privilege entry and seven IST pointers. A nonzero gate IST selects one of those pointers regardless of whether CPL changes. IST=0 uses the ordinary privilege-change rule, or the current stack for same-CPL entry. Double fault and NMI can receive dedicated stacks. Reusing the same IST top for nesting can overwrite a previous frame unless the entry design accounts for reentry.'),
        trace('Same-CPL interrupt with old RSP=0x00801008 and no IST/error', ['Operation', 'Address/value', 'Effect'], [
          ['Preserve old RSP', '0x00801008', 'Saved value retains the original alignment'],
          ['Align working top down', '0x00801000', 'Frame construction begins here'],
          ['Push SS, RSP', '0x800ff8, 0x800ff0', 'Old stack state always present'],
          ['Push RFLAGS, CS, RIP', '0x800fe8, 0x800fe0, 0x800fd8', 'Handler starts at RSP=0x800fd8'],
          ['IRETQ after software cleanup', 'Restore original RSP=0x801008', 'The alignment gap is not guessed or manually added']
        ]),
        p('Return and fast-syscall entry need separate designs', 'Use IRETQ with the eight-byte frame. A legacy assumption that SS:RSP is absent at same CPL corrupts this return. Extended-state, SWAPGS policy, NMI nesting, and optional shadow stacks add further contracts and must be enabled only with matching entry code.', 'SYSCALL is another entry mechanism with different saved state. It places a return address in RCX and saved flags in R11, loads configured kernel entry state, and does not automatically choose a kernel stack or construct the IDT frame above. A kernel must save user RSP, select trusted RSP, preserve required registers, and validate return state. Reusing an interrupt stub without an explicit adapter is incorrect.'),
        ex('Port a table and discover the missing half', 'A port allocates 2048 bytes for 256 x64 gates and keeps IDTR.limit=2047.', ['Determine how many complete gates fit.', 'Find the first vector beyond the bound.', 'Compute the correct size and limit.'], ['Only 128 sixteen-byte gates fit.', 'Vector 128 needs offset 2048 through 2063 and fails the table bound.', 'Allocate 4096 bytes and use inclusive limit 4095. Also expand the IDTR operand base field to eight bytes.'], ['Gate size, table allocation, vector scaling, and IDTR width all agree.'])
      ], references: [intel('Volume 3A: 64-Bit Mode IDT, 64-Bit Mode Stack Frame, Interrupt Stack Table, 64-Bit TSS; SYSCALL and IRET definitions')]
    },
    {
      id: 'uefi-map-key-ownership-handoff', sectionId: 'uefi', title: 'Make ExitBootServices an explicit memory-ownership transaction',
      intro: ['A UEFI loader uses firmware services to allocate memory, discover devices, and load the kernel. ExitBootServices transfers responsibility for ongoing operation. The final memory map and its key are the evidence that the loader and firmware agree about that boundary.'],
      blocks: [
        p('Complete allocations before the narrow handoff', 'Load the kernel, reserve stacks and paging structures, gather graphics and configuration information, and allocate a memory-map buffer with growth allowance. GetMemoryMap returns the actual byte count, a descriptor stride, a descriptor version, and MapKey. Iterate by the returned stride; sizeof a local descriptor structure need not equal the firmware’s record spacing.', 'The key identifies the current map. A later allocation or other map-changing activity can invalidate it. Obtain the final map immediately before ExitBootServices, with no logging or protocol operation inserted between them. If firmware rejects the key with EFI_INVALID_PARAMETER, obtain a fresh map and retry under the specification’s restricted post-attempt service rules. After an initial exit attempt, firmware may already have partially shut down.', 'On successful exit, boot-service calls and device-handle protocols are no longer available. Preserve any required values in loader-owned structures before that point. Runtime-service regions remain subject to their separate requirements. Memory marked boot-service code/data becomes eligible for kernel ownership only after the handoff, while the kernel must still exclude its own loaded image, stacks, tables, map buffer, and reserved platform ranges.'),
        trace('A stale key and a corrected retry', ['Step', 'Map generation / action', 'Result'], [
          ['1', 'GetMemoryMap returns key K7', 'Loader holds snapshot seven'],
          ['2', 'Debug logging allocates firmware memory', 'Map changes to a later generation'],
          ['3', 'ExitBootServices with K7', 'EFI_INVALID_PARAMETER'],
          ['4', 'Use prepared buffer for fresh GetMemoryMap', 'Receive key K9 and updated descriptors'],
          ['5', 'Immediately ExitBootServices with K9', 'Success if map remains current'],
          ['6', 'Enter kernel using copied handoff values', 'No boot-service console or allocation call remains']
        ]),
        code('A handoff algorithm with explicit failure states', 'text', `prepare kernel, page tables, stack, framebuffer metadata
allocate map buffer with spare capacity
repeat within a bounded retry policy:
    map = GetMemoryMap(preallocated buffer)
    if buffer is too small:
        grow using permitted memory-allocation services
        continue
    if map acquisition failed:
        enter the defined loader failure path
    result = ExitBootServices(image_handle, map.key)
    if result is success:
        transfer using the prepared kernel ABI
    if result is not stale-key rejection:
        enter the defined loader failure path
    # Retry only permitted calls after the first exit attempt.
stop if the retry budget is exhausted`, ['This is an algorithm, not drop-in EFI C: concrete status handling, allocation services, and failure paths must match the UEFI revision.', 'After a successful exit, failure output requires a previously prepared direct mechanism such as a framebuffer or owned serial device.', 'Do not reboot the ordinary discovery workflow after a failed first exit attempt.']),
        p('Firmware ABI and kernel ABI are explicit interfaces', 'An x64 UEFI application uses the firmware’s specified calling convention, including register arguments, stack alignment, and caller-provided shadow space. A kernel compiled for System V has a different argument-register order and no identical shadow-space rule. A loader-to-kernel assembly adapter can define one clean handoff with a pointer to a versioned structure and a reserved stack.', 'Give the handoff structure a size and version, fixed-width addresses, memory-map stride, and ownership descriptions. Record framebuffer dimensions, pitch, format, and physical range as owned values with an independent lifetime. Physical addresses may need conversion or mapping before the higher-half kernel dereferences them. Separate the lifetime of the structure from the lifetime of each object it references.'),
        ex('The framebuffer survives but its protocol does not', 'After ExitBootServices, a kernel calls a cached Graphics Output Protocol method to draw text.', ['Explain the lifetime violation.', 'List the values that should have been copied.', 'Explain the mapping needed for direct drawing.'], ['Device-handle protocols are boot-service interfaces and cannot be used after exit.', 'Copy framebuffer address/size, pixel format, resolution, and scan-line pitch before exit.', 'Map the physical framebuffer with appropriate memory attributes, then calculate pixel addresses using pitch and format while staying inside its extent.'], ['The post-exit kernel uses owned metadata and direct device access.'])
      ], references: [{ label: 'UEFI Specification 2.10: Boot Services', url: 'https://uefi.org/specs/UEFI/2.10/07_Services_Boot_Services.html?highlight=exitbootservice', section: 'GetMemoryMap and ExitBootServices' }, { label: 'UEFI Specification: image execution and calling conventions', url: 'https://uefi.org/specs/UEFI/2.10/02_Overview.html', section: 'x64 platforms and calling conventions' }, osc('Chapter 2: boot and system structure')]
    }
  ],
  'apic-and-smp': [
    {
      id: 'apic-topology-routing-and-eoi', sectionId: 'apic', title: 'Separate APIC identity, interrupt routing, and CPU-local service',
      intro: ['A multiprocessor machine has one local APIC per logical processor and platform routing that delivers device interrupts to selected destinations. The number naming a hardware input, a global interrupt, an APIC destination, and an IDT vector can all differ.'],
      blocks: [
        table('Identifiers in one illustrative route', ['Name', 'Example', 'Meaning'], [
          ['Device source', 'Legacy keyboard source', 'Hardware that produced the event'],
          ['Global system interrupt', 'A firmware-described GSI', 'Input routed through an I/O APIC'],
          ['Destination APIC ID', '6', 'Hardware identity of receiving logical CPU'],
          ['Kernel CPU index', '1', 'Dense software index, possibly mapped to APIC ID 6'],
          ['Vector', '0x51', 'Entry in that CPU’s IDT']
        ]),
        p('Discover before programming', 'Read and validate firmware topology information, including enabled processors, local APIC identities, I/O APIC ranges, and interrupt-source overrides. Do not assume a legacy IRQ number equals a GSI or that APIC IDs are consecutive. The kernel may use dense CPU indices internally while maintaining an explicit map to architectural IDs.', 'In xAPIC mode, local APIC registers use a memory-mapped interface that needs the required uncached memory type. In x2APIC mode, the interface uses MSRs and a wider identity scheme. Negotiate the supported mode and use its register layout. A plain pointer cast with normal write-back cache attributes is not an APIC initialization.', 'An I/O APIC redirection entry describes destination, vector, delivery policy, polarity, trigger mode, and masking. Program a masked entry completely, ensure the receiving CPU’s IDT and handler are ready, then unmask. Concurrent read-modify-write access through an I/O APIC’s select/window interface needs serialization so CPUs do not select each other’s registers.'),
        p('Complete a level-triggered event', 'For a level-triggered source, the device can continue asserting its input until software clears the condition. The handler consumes or clears the device cause and publishes work, then performs the required local APIC EOI. The routing/controller machinery can then deliver future requests. Sending EOI while the device remains asserted can produce an immediate interrupt storm.', 'The local APIC’s spurious vector is a distinct case: a genuine spurious event has no corresponding in-service bit and its handler should not issue normal EOI. It must not be assigned to an ordinary device route. Likewise, NMI and startup messages do not follow the normal fixed-interrupt EOI path. Keep these entry policies associated with vector ownership.'),
        ex('An override changes the route', 'Firmware reports that a legacy source uses GSI 2, active-low level-triggered delivery. A kernel programs its legacy number with active-high edge policy.', ['Identify two independent mistakes.', 'Describe evidence to inspect before blaming the IDT.', 'State the safe configuration order.'], ['It chose the wrong input and the wrong electrical/trigger semantics.', 'Inspect firmware override data, the selected I/O APIC and pin, redirection fields, and device status.', 'Mask, program the complete correct route, establish handler/device state, then unmask.'], ['Device source, GSI, destination, and vector are recorded separately.'])
      ], references: [intel('Volume 3A: Advanced Programmable Interrupt Controller; xAPIC and x2APIC; Spurious Interrupt'), osc('Chapter 1: multiprocessor systems')]
    },
    {
      id: 'smp-ap-startup-mailbox', sectionId: 'startup', title: 'Bring up an application processor through a private startup mailbox',
      intro: ['The bootstrap processor cannot make another CPU ready by setting a shared online flag. An application processor must begin at a startup vector, establish its own execution state, and publish readiness only after its local dependencies are usable.'],
      blocks: [
        p('A SIPI vector names a low physical page', 'A startup IPI supplies an eight-bit vector selecting a 4 KiB page below 1 MiB. Vector 0x08 begins execution at physical 0x8000. Place a real-mode trampoline in reserved memory there and verify that firmware data and the bootstrap loader no longer own it. The AP must follow a deliberate transition into the kernel’s protected or long-mode environment.', 'For the architectural family used by the course, the BSP follows the prescribed INIT/SIPI startup sequence, observes required delivery status and timing, and uses a bounded wait for the AP’s software acknowledgement. A second SIPI follows the startup retry rules; each CPU still initializes once. Exact timing and interface differ with the documented processor/APIC environment; implement the applicable specification with a reliable delay source.', 'Prepare a per-AP mailbox containing identity, startup generation, page-table root, stack top, and eventual C entry. Publish it before sending startup. A simple teaching design brings up one AP at a time through a shared low-memory trampoline, but mailbox reuse still waits until the AP has copied every required value. Concurrent startup requires a reliable way for each AP to select its own mailbox.'),
        { type: 'flow', title: 'AP initialization is a publication protocol', intro: 'Online means all advertised local services can execute.', nodes: [
          { id: 'prepare', label: 'BSP prepares mailbox', detail: 'Reserve trampoline, stack, CPU identity, and table roots.', kind: 'process' },
          { id: 'send', label: 'Send startup sequence', detail: 'Follow architectural delivery and timing rules.', kind: 'process' },
          { id: 'trampoline', label: 'AP enters trampoline', detail: 'Establish segments, stack, and paging before C.', kind: 'process' },
          { id: 'local', label: 'Initialize CPU-local state', detail: 'Load GDT/IDT/TSS, local APIC, per-CPU pointer, and scheduler state.', kind: 'process' },
          { id: 'ready', label: 'AP publishes ready', detail: 'Release-store a generation-tagged acknowledgement.', kind: 'process' },
          { id: 'observe', label: 'BSP observes readiness', detail: 'Acquire-load before routing work to this CPU.', kind: 'terminal' }
        ], edges: [{ from: 'prepare', to: 'send' }, { from: 'send', to: 'trampoline' }, { from: 'trampoline', to: 'local' }, { from: 'local', to: 'ready' }, { from: 'ready', to: 'observe' }], caption: 'Timeouts report partial progress and keep an unready processor out of scheduling and interrupt destinations.' },
        p('CPU-local does not mean initialized by another CPU', 'GDTR, IDTR, TR, CR3, segment caches, local APIC state, and current stack belong to a logical CPU. Loading them on the BSP does not configure the AP. The GDT may share immutable entries, but TSS and emergency-stack ownership commonly require per-CPU storage. Each CPU also needs a defined idle thread and a valid current-thread pointer before it can accept an interrupt.', 'Separate states such as discovered, starting, initialized, online, and failed. A timeout can mean no instruction executed, a trampoline fault, or a late acknowledgement. Preserve stage markers and a generation number so a delayed AP from an earlier attempt cannot validate a later mailbox accidentally. Do not free a timed-out AP’s stack or tables until its possible execution has been safely excluded.'),
        ex('Ready is published too early', 'An AP sets online=true before loading IDTR. The BSP immediately routes a timer vector to it.', ['Describe the dependency violation.', 'Move the publication point.', 'Explain release/acquire’s role and its limit.'], ['The BSP treats an advertised service as usable before the AP has its handler table.', 'Publish ready after the table, stack, local APIC, and CPU-local state are complete.', 'Release/acquire publishes prior memory initialization; it does not execute the AP’s missing LIDT or other CPU-local instructions.'], ['All advertised local services are usable before online publication.'])
      ], references: [intel('Volume 3A: Multiple-Processor Initialization; INIT-SIPI-SIPI sequence; startup vectors'), ostep('cpu-sched-multi.pdf', 'Chapter 10: multiple-CPU execution and scheduling')]
    },
    {
      id: 'smp-tlb-shootdown-ownership', sectionId: 'tlb', title: 'Treat a TLB shootdown as distributed permission revocation',
      intro: ['A page-table store changes memory. Other CPUs can retain cached translations and continue accessing the old physical frame. Freeing or reusing that frame requires evidence that every relevant CPU has stopped using the stale translation.'],
      blocks: [
        p('The stale entry is still an access path', 'Suppose CPUs A and B run the same address space and cache virtual page 0x400000 → frame F. A clears its PTE and invalidates its own translation. B can still access F through its local TLB. If A gives F to another process before B invalidates, B’s old address can corrupt the new owner’s data. Page-table memory coherence does not revoke a translation already cached in the CPU.', 'Keep frame F unavailable for reuse while revocation is pending. Under an address-space update protocol, remove or change the mapping, record a new generation, publish the affected range, and identify CPUs that may retain the old translation. Send an IPI to those CPUs. Each target invalidates the relevant translations using the appropriate mechanism and acknowledges completion. Only after all required acknowledgements may the old frame’s ownership be released.', 'INVLPG affects the executing logical processor. CR3 and INVPCID have their own scope rules, including PCIDs, global entries, and translation-cache behavior. Select the mechanism appropriate to the active paging configuration. Sending an IPI alone proves neither delivery nor invalidation; the target’s ordered completion acknowledgement is the evidence.'),
        trace('Two CPUs revoke one mapping before reuse', ['Step', 'CPU A', 'CPU B', 'Frame F ownership'], [
          ['1', 'Clear PTE under VM protocol', 'May still cache old entry', 'Retained by old mapping retirement'],
          ['2', 'Publish generation 18 and target set', 'Receives shootdown IPI', 'Cannot enter allocator'],
          ['3', 'Invalidate locally', 'Invalidate requested translation', 'Still retained'],
          ['4', 'Wait for matching acknowledgement', 'Release-publish completed generation 18', 'Still retained until observed'],
          ['5', 'Acquire-observe all acknowledgements', 'Cannot use old translation', 'Safe to release if no other references remain'],
          ['6', 'Allocator may assign F again', 'Future access walks the changed tables', 'New owner can receive F']
        ]),
        p('Close the race with address-space activation', 'A CPU can start running the address space while a shootdown chooses its target set. Serialize activation with the relevant generation/membership protocol: an entering CPU either joins the target set or observes the new generation and invalidates before using the address space. A snapshot of currently running CPUs without this handshake misses precisely the CPU that becomes active next.', 'A CPU that is not currently executing the address space may still retain translations under a tagged TLB design. Generation tracking can require invalidation when that address space becomes active again. Global kernel mappings often require broader targeting because they are shared across address spaces. State the policy explicitly before treating an idle CPU as irrelevant.', 'Avoid holding a lock that the shootdown handler needs while waiting for its acknowledgement. Also ensure waiting CPUs can service the required incoming IPIs under the chosen protocol. A deadlocked shootdown can freeze the allocator and scheduler even though the PTE modification itself is correct. Batch ranges when useful, but keep frame-retirement ownership tied to the exact completed generation.'),
        ex('A late activation escapes the target snapshot', 'A snapshots active CPUs as {A,B}. CPU C activates the address space before A clears the PTE, caches the mapping, and is never targeted.', ['Explain the missing synchronization.', 'Provide a generation-based repair.', 'State the release condition for the physical frame.'], ['Activation raced with target-set construction, allowing an unrecorded stale translation.', 'Serialize membership publication with updates, or require C to compare and satisfy the mapping generation before use and on activation.', 'Retire the frame only after every CPU that could retain the old generation has invalidated or is guaranteed to do so before reuse of that address space, and all non-TLB references are gone.'], ['IPI send completion is not treated as invalidation completion.', 'Frame reuse waits for a proved revocation boundary.'])
      ], references: [intel('Volume 3A: Caching Translation Information; Invalidation of TLBs and Paging-Structure Caches; multiprocessor considerations'), ostep('vm-tlbs.pdf', 'Chapter 19: translation caches'), osc('Chapter 10: virtual memory and multiprocessor coordination')]
    }
  ]
};
