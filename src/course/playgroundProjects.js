import { kernelLabProjectFiles } from './kernelLabProject';

export const routineProjectFiles = {
  'lesson.asm': `; Sum four words, then print the result and captured arithmetic FLAGS.
; Entry: real mode, CS=DS=ES=SS=0, SP=0x7bfe, DF=0.
; Helpers preserve general registers and flags. Keep the call stack balanced.
    xor ax, ax
    mov si, values
    mov cx, value_count
.next:
    add ax, [si]
    add si, 2
    loop .next
    mov [sum], ax
    call print_hex16
    call newline

; Snapshot immediately: subsequent arithmetic could change the flags.
    mov ax, 0x7fff
    add ax, 1
    pushf
    pop bx
    call print_hex16
    call newline
    mov ax, bx
    and ax, 0x0801             ; OF (bit 11) and CF (bit 0)
    call print_hex16
    call newline
    ret
`,
  'data.inc': `values: dw 3, 5, 8, 13
value_count equ ($ - values) / 2
sum: dw 0
`,
  'README.md': `# Assembly routine lab

Build & run prints 001D, 8000, 0800 on three lines.
The first value is 3+5+8+13 = 29. AX accumulates one 16-bit word per iteration; SI advances two bytes and LOOP decrements CX. The result is also stored at sum.
The next operation computes 0x7fff+1. Its 16-bit result is 0x8000. Signed overflow sets OF; unsigned carry stays clear. PUSHF/POP BX captures those flags before any later arithmetic. Mask 0x0801 keeps only OF and CF, producing 0x0800.

## Trace it
Iteration 1: SI=values, AX=3, CX becomes 3.
Iteration 2: SI=values+2, AX=8, CX becomes 2.
Iteration 3: SI=values+4, AX=16, CX becomes 1.
Iteration 4: SI=values+6, AX=29, CX becomes 0; LOOP falls through.

## Experiments
1. Replace 0x7fff with 0xffff. Result becomes 0000 and the masked flags become 0001. Explain the signed and unsigned interpretations separately.
2. Add a fifth word 21. The assembler computes count=5; the sum becomes 0032. Observe the generated listing in Build.
3. Make count zero without adding a guard. A LOOP-driven body still enters once, then wraps CX to 65535. Add JCXZ before the body and decide what an empty sum should print. Restore a nonzero count before running the unguarded version.
4. Move the flags snapshot after AND. Explain why it then reports the logical instruction's flags. Restore the immediate snapshot.
5. Extract the sum into a function with a documented input/output/clobber contract. Test one element, zero elements, and a sum that exceeds 65535. Add ADC into a second word for a 32-bit total.

## Build contract
Only the routine belongs in lesson.asm. Put data after the routine through data.inc. The harness supplies startup, putc(AL), puts(DS:SI), newline, print_hex16(AX), and the final halt. A separate boot sector loads the assembled routine at physical address 0x8000. Your code, startup, helpers, and data share a 16-KiB program area, so you can add functions, tables, and longer experiments. Build lists lesson.bin and the bootable disk image as separate artifacts. The Bytes view shows lesson.bin at its load address.
The sum loop's pointer increment changes FLAGS, so observe overflow immediately after the ADD being investigated. The first demonstration prints a wrapped 16-bit sum and does not detect aggregate overflow.
`,
};

export const bootSectorProjectFiles = {
  'boot.asm': `bits 16
org 0x7c00
jmp 0x0000:start

start:
    cli
    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7c00
    mov [boot_drive], dl
    sti
    mov ax, 3
    int 0x10
    xor ax, ax
    mov ds, ax
    mov es, ax
    cld
    mov si, title
    call puts
    mov al, [boot_drive]
    call hex_byte
    mov si, suffix
    call puts
.halt:
    cli
    hlt
    jmp .halt

%include "console.inc"
title: db "BOOT READY", 13, 10, "BIOS drive: ", 0
suffix: db 13, 10, "CS/DS/ES/SS=0000, stack starts at 7C00", 0
boot_drive: db 0
times 510-($-$$) db 0
dw 0xaa55
`,
  'console.inc': `; BIOS teletype: preserves 16-bit general registers, DS, ES and FLAGS.
putc:
    pushf
    pusha
    push ds
    push es
    cld
    mov ah, 0x0e
    mov bx, 7
    int 0x10
    pop es
    pop ds
    popa
    popf
    ret

puts:
    pushf
    pusha
    cld
.next:
    lodsb
    test al, al
    jz .done
    call putc
    jmp .next
.done:
    popa
    popf
    ret

hex_byte:
    pushf
    pusha
    mov dl, al
    shr al, 4
    call .nibble
    mov al, dl
    and al, 15
    call .nibble
    popa
    popf
    ret
.nibble:
    add al, '0'
    cmp al, '9'
    jbe .emit
    add al, 7
.emit:
    call putc
    ret
`,
  'README.md': `# Complete boot-sector lab

Expected screen: BOOT READY, BIOS drive: 80, and the normalized segment/stack message. The browser boots a hard-disk image, whose first BIOS drive is normally 0x80; the displayed value is the actual saved DL. Firmware can supply another value when booting a different device.

## Account for every address
ORG tells NASM the load address used in label calculations. The far jump establishes CS=0. Clearing DS and ES makes label offsets refer to the expected physical bytes. SS=0 and SP=0x7c00 place the descending stack below the loaded sector. CLI covers stack setup; the program uses BIOS services while still in real mode. It saves DL before video services can change registers.
CALL pushes a two-byte return offset in this 16-bit code. PUSHA uses another 16 bytes and segment/FLAGS saves consume more. Walk the deepest nested console call to count stack use. RET must encounter the same return offset that CALL saved.

## Read the binary
The complete sector is 512 bytes. The last two bytes are 55 AA because DW writes 0xaa55 in little-endian order. TIMES pads through offset 509. Inspect Bytes and Build listing to compare source labels with emitted addresses. An overlarge source produces a negative TIMES count; reduce code/data or move to a second stage.

## Exercises
1. Change the title, build, and locate its ASCII bytes in the download. The signature must remain at offsets 510 and 511.
2. Predict the displayed high and low nibbles for drive values 0x00, 0x80 and 0x81. Temporarily substitute each input to hex_byte and check both digits.
3. Add an INT 12h memory-size query and print AX with your own four-digit helper. BIOS returns conventional-memory KiB. Call it before leaving real mode and preserve the boot drive.
4. Add a zero-count check to any LOOP-based byte copy. Keep code, stack and output ranges disjoint and clear DF before string instructions.
5. Move to the C project to study EDD reads, the disk-address packet, bounded retries and two-stage loading. This boot sector only demonstrates firmware entry and output; it performs no disk reads.

Files: boot.asm owns layout/startup/data/signature. console.inc owns three callable routines. Build & run assembles boot.asm using NASM and includes console.inc. Download boot.bin for the sector and os.img for a complete raw disk; export JSON for editable sources.
`,
};

export const playgroundProjects = { example: routineProjectFiles, challenge: bootSectorProjectFiles, kernel: kernelLabProjectFiles };
export const projectGuides = {
  example: { topics: [['Instruction bytes', 'decode-instructions-byte-by-byte'], ['Multiword arithmetic', 'wide-sum-carry-chain'], ['Overlapping copies', 'overlapping-memory-copy-direction']], title: 'Trace an array sum and capture FLAGS', output: '001D · 8000 · 0800', file: 'lesson.asm', steps: ['Trace AX, SI and CX through four words in data.inc.', 'Capture FLAGS immediately after ADD; decode CF and OF.', 'Use README.md for empty-array, overflow and function exercises.'] },
  challenge: { topics: [['Firmware entry state', 'boot-machine-state-ledger'], ['Disk and memory layout', 'boot-disk-memory-intervals'], ['Entering C', 'boot-c-entry-abi']], title: 'Own the complete BIOS entry', output: 'BOOT READY · BIOS drive: 80', file: 'boot.asm', steps: ['Follow the far jump, segment setup, stack and saved DL.', 'Inspect callable console routines and the final 55 AA signature.', 'Extend the loader using the memory-query and binary-layout exercises.'] },
  kernel: { topics: [['GDT fields and bytes', 'gdt-descriptor-bits-and-bytes'], ['IDT entries', 'idt-populated-table-and-gate'], ['Page-table walks', 'vm-walk-10-10-12'], ['Physical frame bitmap', 'pmm-bitmap-accounting'], ['Heap splitting and coalescing', 'heap-split-boundary-tags']], title: 'Boot, install tables, and manage memory', output: '8 PASS lines · KERNEL LAB READY', file: 'kernel/main.c', steps: ['Follow both boot stages into a linked, freestanding C kernel.', 'Inspect the GDT, install the IDT, and return from INT3.', 'Enable paging, allocate frames, and split/coalesce heap blocks.'] },
};
