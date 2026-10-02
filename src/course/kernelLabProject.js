import { kernelProjectFiles } from './kernelProject';

// The guided boot chapter retains its incremental starter. This independent
// integration lab starts from that boot chain and exercises real CPU mechanisms.
export const kernelLabProjectFiles = {
  ...kernelProjectFiles,
  'kernel/main.c': `#include "vga.h"
#include "lab.h"

static volatile unsigned int zero_probe;
static volatile unsigned int data_probe = 0x12345678u;

void kernel_main(void) {
    vga_clear(VGA_DEFAULT_ATTRIBUTE);
    lab_console_init();
    lab_check("C runtime: data and BSS", zero_probe == 0 && data_probe == 0x12345678u);
    lab_check("GDT: flat code and data", descriptors_check());
    interrupts_init();
    __asm__ volatile("int3" ::: "memory");
    lab_check("IDT: breakpoint and IRETD", breakpoint_count == 1);
    unsigned conventional_kib = *(volatile unsigned short *)0x413;
    paging_init();
    lab_check("Paging: identity map and CR0.WP", paging_check());

    /* This lab explicitly owns physical [0x80000, 0x90000).
       A general kernel must discover and reserve memory first. */
    if (conventional_kib < 576) {
        lab_check("Conventional RAM >= 576 KiB", 0);
        return;
    }
    frames_init();
    int first = frame_alloc(), second = frame_alloc();
    int released = frame_free(first);
    int again = frame_alloc();
    lab_check("Frames: unique allocation and reuse", first == 0 && second == 1 && released && again == first);
    lab_check("Frames: reject invalid and duplicate free", frame_free(second) && !frame_free(second) && !frame_free(16));
    frame_free(again);

    heap_init();
    void *a = heap_alloc(24), *b = heap_alloc(40);
    int freed_a = heap_free(a), freed_b = heap_free(b);
    void *large = heap_alloc(4000);
    lab_check("Heap: split, free, coalesce", a && b && a != b && freed_a && freed_b && large == a);
    lab_check("Heap: bounded allocation", heap_alloc(4096) == 0 && heap_alloc(0) == 0);
    lab_finish();
    /* Try a deliberate fault after a successful run:
       __asm__ volatile("ud2");  // #UD reaches the fatal IDT entry
       *(volatile unsigned int *)0 = 42; // #PF: page zero is absent
       Restore before comparing the complete pass transcript. */
}
`,
  'include/lab.h': `#ifndef LAB_H
#define LAB_H
typedef unsigned char u8;
typedef unsigned short u16;
typedef unsigned int u32;
_Static_assert(sizeof(void *) == 4, "This project targets IA-32");
void lab_console_init(void);
void lab_check(const char *name, int passed);
void lab_finish(void);
int descriptors_check(void);
void interrupts_init(void);
extern volatile u32 breakpoint_count;
void breakpoint_handler(void);
void fatal_exception(void);
void paging_init(void);
int paging_check(void);
void frames_init(void);
int frame_alloc(void);
int frame_free(int index);
void heap_init(void);
void *heap_alloc(u32 bytes);
int heap_free(void *pointer);
#endif
`,
  'kernel/console.c': `#include "vga.h"
#include "lab.h"
static unsigned row, failures;
static void outb(u16 port, u8 value) { __asm__ volatile("outb %0,%1" : : "a"(value), "Nd"(port)); }
static u8 inb(u16 port) { u8 value; __asm__ volatile("inb %1,%0" : "=a"(value) : "Nd"(port)); return value; }
static void serial(const char *text) {
    for (; *text; ++text) {
        unsigned budget = 100000;
        while (!(inb(0x3fd) & 0x20) && --budget) {}
        if (budget) outb(0x3f8, (u8)*text);
    }
}
void lab_console_init(void) {
    row = failures = 0;
    outb(0x3f9, 0); outb(0x3fb, 0x80);
    outb(0x3f8, 3); outb(0x3f9, 0);
    outb(0x3fb, 3); outb(0x3fa, 0xc7); outb(0x3fc, 0x0b);
}
void lab_check(const char *name, int passed) {
    const char *result = passed ? "PASS " : "FAIL ";
    unsigned char color = passed ? 0x0a : 0x0c;
    vga_write_at(row, 0, result, color);
    vga_write_at(row++, 5, name, VGA_DEFAULT_ATTRIBUTE);
    serial(result); serial(name); serial("\\r\\n");
    if (!passed) ++failures;
}
void lab_finish(void) {
    const char *message = failures ? "KERNEL LAB FAILED" : "KERNEL LAB READY";
    vga_write_at(row, 0, message, VGA_DEFAULT_ATTRIBUTE);
    serial(message); serial("\\r\\n");
}
`,
  'kernel/descriptors.c': `#include "lab.h"
struct table_pointer { u16 limit; u32 base; } __attribute__((packed));
_Static_assert(sizeof(struct table_pointer) == 6, "SGDT writes six bytes in IA-32");
int descriptors_check(void) {
    struct table_pointer gdtr;
    u16 cs, ds;
    __asm__ volatile("sgdt %0" : "=m"(gdtr));
    __asm__ volatile("mov %%cs,%0" : "=r"(cs));
    __asm__ volatile("mov %%ds,%0" : "=r"(ds));
    if (gdtr.limit != 23 || cs != 8 || ds != 16) return 0;
    const u8 *table = (const u8 *)gdtr.base;
    const u8 code[8] = {255,255,0,0,0,0x9a,0xcf,0};
    const u8 data[8] = {255,255,0,0,0,0x92,0xcf,0};
    for (unsigned i = 0; i < 8; ++i) {
        /* The CPU may set the descriptor accessed bit when loading it. */
        u8 mask = i == 5 ? 0xfe : 0xff;
        if (table[i] || (table[8+i] & mask) != code[i] || (table[16+i] & mask) != data[i]) return 0;
    }
    return 1;
}
`,
  'kernel/interrupts.c': `#include "lab.h"
struct idt_gate { u16 low, selector; u8 zero, attributes; u16 high; } __attribute__((packed));
struct idtr { u16 limit; u32 base; } __attribute__((packed));
_Static_assert(sizeof(struct idt_gate) == 8, "IA-32 gates are eight bytes");
static struct idt_gate idt[256];
volatile u32 breakpoint_count;
extern void breakpoint_entry(void), fatal_entry(void);
static void set_gate(unsigned vector, void (*entry)(void)) {
    u32 address = (u32)entry;
    idt[vector] = (struct idt_gate){ (u16)address, 0x08, 0, 0x8e, (u16)(address >> 16) };
}
void interrupts_init(void) {
    for (unsigned vector = 0; vector < 256; ++vector) set_gate(vector, fatal_entry);
    set_gate(3, breakpoint_entry);
    struct idtr pointer = { sizeof(idt) - 1, (u32)idt };
    __asm__ volatile("lidt %0" : : "m"(pointer) : "memory");
    /* IF stays clear and the PIC stays masked. INT3 is synchronous. */
}
void breakpoint_handler(void) { ++breakpoint_count; }
void fatal_exception(void) {
    lab_check("Unexpected CPU exception: inspect IDT and mapping", 0);
    for (;;) __asm__ volatile("cli; hlt");
}
`,
  'kernel/interrupt-entry.asm': `bits 32
section .text
global breakpoint_entry, fatal_entry
extern breakpoint_handler, fatal_exception

; INT3 pushes EFLAGS, CS, EIP on this same-ring stack. No error code.
breakpoint_entry:
    pushad
    cld
    mov ebp, esp
    and esp, -16
    call breakpoint_handler
    mov esp, ebp
    popad
    iretd

; A terminal handler never attempts to unwind a vector-dependent frame.
; Extend it with per-vector stubs and saved CR2 before attempting recovery.
fatal_entry:
    cli
    cld
    and esp, -16
    call fatal_exception
.halt:
    hlt
    jmp .halt
`,
  'kernel/paging.c': `#include "lab.h"
static u32 directory[1024] __attribute__((aligned(4096)));
static u32 low_table[1024] __attribute__((aligned(4096)));
void paging_init(void) {
    for (unsigned i = 0; i < 1024; ++i) {
        directory[i] = 0;
        low_table[i] = i ? (i * 4096u) | 3u : 0;
    }
    directory[0] = (u32)low_table | 3u;
    __asm__ volatile("mov %0,%%cr3" : : "r"((u32)directory) : "memory");
    u32 cr0;
    __asm__ volatile("mov %%cr0,%0" : "=r"(cr0));
    cr0 |= 0x80010000u; /* PG and WP. PE was enabled by stage two. */
    __asm__ volatile("mov %0,%%cr0" : : "r"(cr0) : "memory");
}
int paging_check(void) {
    u32 cr0, cr3;
    __asm__ volatile("mov %%cr0,%0" : "=r"(cr0));
    __asm__ volatile("mov %%cr3,%0" : "=r"(cr3));
    return (cr0 & 0x80010001u) == 0x80010001u && cr3 == (u32)directory
        && low_table[0] == 0 && (low_table[0x80] & 0xfffff003u) == 0x80003u;
}
`,
  'kernel/memory.c': `#include "lab.h"
#define ARENA 0x80000u
#define FRAMES 16u
#define PAGE 4096u
static u16 occupied;
void frames_init(void) { occupied = 0; }
int frame_alloc(void) {
    for (unsigned i = 0; i < FRAMES; ++i) {
        u16 bit = (u16)(1u << i);
        if (!(occupied & bit)) { occupied |= bit; return (int)i; }
    }
    return -1;
}
int frame_free(int index) {
    if (index < 0 || index >= (int)FRAMES) return 0;
    u16 bit = (u16)(1u << index);
    if (!(occupied & bit)) return 0;
    occupied &= (u16)~bit;
    return 1;
}
struct block { u32 bytes, used; };
static u8 *heap_start, *heap_end;
void heap_init(void) {
    int frame = frame_alloc();
    if (frame < 0) { heap_start = heap_end = 0; return; }
    heap_start = (u8 *)(ARENA + (u32)frame * PAGE);
    heap_end = heap_start + PAGE;
    struct block *first = (struct block *)heap_start;
    first->bytes = PAGE - sizeof(*first); first->used = 0;
}
void *heap_alloc(u32 bytes) {
    if (!bytes || bytes > PAGE - sizeof(struct block) || !heap_start) return 0;
    bytes = (bytes + 7u) & ~7u;
    for (u8 *cursor = heap_start; cursor < heap_end;) {
        struct block *block = (struct block *)cursor;
        if (!block->used && block->bytes >= bytes) {
            if (block->bytes - bytes >= sizeof(*block) + 8) {
                struct block *tail = (struct block *)(cursor + sizeof(*block) + bytes);
                tail->bytes = block->bytes - bytes - sizeof(*block);
                tail->used = 0; block->bytes = bytes;
            }
            block->used = 1; return cursor + sizeof(*block);
        }
        cursor += sizeof(*block) + block->bytes;
    }
    return 0;
}
int heap_free(void *pointer) {
    if (!heap_start) return 0;
    struct block *found = 0;
    for (u8 *cursor = heap_start; cursor < heap_end;) {
        struct block *block = (struct block *)cursor;
        if (pointer == cursor + sizeof(*block)) { found = block; break; }
        cursor += sizeof(*block) + block->bytes;
    }
    if (!found || !found->used) return 0;
    found->used = 0;
    for (u8 *cursor = heap_start; cursor < heap_end;) {
        struct block *block = (struct block *)cursor;
        u8 *next = cursor + sizeof(*block) + block->bytes;
        if (next < heap_end && !block->used && !((struct block *)next)->used)
            block->bytes += sizeof(*block) + ((struct block *)next)->bytes;
        else cursor = next;
    }
    return 1;
}
`,
  'build.json': JSON.stringify({ type: 'kernel32', boot: ['boot/stage1.asm', 'boot/stage2.asm'], sources: ['kernel/entry.asm', 'kernel/main.c', 'kernel/vga.c', 'kernel/console.c', 'kernel/descriptors.c', 'kernel/interrupts.c', 'kernel/interrupt-entry.asm', 'kernel/paging.c', 'kernel/memory.c'], include: ['include'], linker: 'linker.ld' }, null, 2),
  'README.md': `# Kernel mechanisms lab

Build & run compiles every manifest source to native IA-32, constructs the boot disk, and runs it on the emulated x86 CPU. Expect eight PASS lines followed by KERNEL LAB READY on VGA and COM1. Every PASS is computed from machine state or an allocator result.

## Trace the complete boot chain
1. BIOS loads LBA 0 at physical 0x7c00. stage1 normalizes CS and the data/stack segments, saves DL, verifies EDD, and reads eight sectors into 0x8000.
2. stage2 reads 32 sectors from LBA 9 to 0x10000. It masks PIC interrupts, installs a three-entry GDT, sets CR0.PE, and performs a far jump to selector 0x08. Loading selector 0x10 establishes flat data segments.
3. entry.asm establishes the stack at 0x70000, clears BSS using linker symbols, and calls kernel_main. Inspect kernel.elf in Build to follow the linked entry and sections.
4. descriptors.c reads GDTR with SGDT and checks all descriptor bytes. The CPU can set the accessed bit, which the comparison permits.
5. interrupts.c installs 256 eight-byte IDT gates. INT3 enters an assembly stub, saves general registers, aligns the C call stack, increments a counter and returns with IRETD. All other vectors halt through a terminal handler.
6. paging.c creates aligned 4 KiB tables and an identity mapping through 4 MiB, with page zero absent. CR3 points to the directory; CR0 enables paging and supervisor write protection.
7. memory.c manages sixteen physical frames in [0x80000, 0x90000). Its bitmap rejects double frees. One frame supplies a first-fit heap with eight-byte headers, splitting and coalescing. Main executes deterministic reuse and bounds checks.

## Memory map and ownership
0x00000..0x00fff: unmapped after paging. The conventional-memory word at physical 0x413 is saved before enabling paging. Later reads use that saved value.
0x07c00: stage1. 0x08000: stage2 and GDT. 0x10000..0x13fff: maximum loaded kernel bytes.
BSS ends below 0x60000; [0x60000, 0x70000) is reserved for the descending stack. [0x80000, 0x90000) is the lab allocator arena. VGA is 0xb8000.
The kernel checks conventional RAM before owning the arena. A general allocator needs E820 normalization and explicit boot/device reservations. This fixed arena is deliberately bounded to one lab.

## Experiments with expected observations
1. Break a GDT byte in stage2 and predict whether the protected-mode jump faults or the descriptor check reports failure. A reset before any transcript points to a transition fault.
2. Change the breakpoint gate attribute from 0x8e to 0x8f. Both return; the interrupt gate clears IF on entry and the trap gate preserves it. This lab enters with IF clear. Add a saved-EFLAGS observation before drawing a conclusion about a running interrupt-enabled kernel.
3. Execute UD2 after interrupts_init. The terminal handler prints FAIL and halts. Implement per-vector stubs before attempting to resume exceptions with CPU-pushed error codes.
4. Write to address zero after paging_init. The absent PTE produces #PF. Extend the fatal handler with a CR2 snapshot and a decoded error code to distinguish a missing page from a permissions violation.
5. Allocate all sixteen frames and check that the seventeenth returns -1. Release alternate frames, allocate again, and record ascending reuse. Never reinitialize the bitmap while allocations exist.
6. Heap request 24 splits payload 4088 into 24 + header 8 + 4056. Request 40 splits the remainder into 40 + header 8 + 4008. Free both blocks; coalescing recovers one 4088-byte payload. Add interior-pointer and repeated-free cases.

## Deliberate boundaries
Paging uses the legacy two-level format with CR4.PAE clear. The CPU must implement CR0.WP (486 or later); the i386 compiler target describes the generated instruction baseline. Reading back WP verifies the control bit only. A permissions-fault experiment is required to test enforcement. heap_init is a one-time startup operation: calling it again discards heap ownership and consumes another frame.

Single CPU, ring 0, PIC masked, IF clear, no IRQ scheduling, no user address space, no dynamic page mapping, no E820 allocator, no recoverable exception frames, no filesystems. Page tables are writable and mapped pages are supervisor read/write. Heap metadata assumes callers respect allocation bounds. Production allocators need corruption handling and synchronization. The loader reads below 1 MiB, so this example does not rely on A20 enablement. All C runs freestanding without the host standard library.

Download os.img to boot the complete disk in QEMU: qemu-system-i386 -drive format=raw,file=os.img -serial stdio
kernel.bin is the loaded payload and kernel.elf contains linked addresses. Keep exported project JSON as an editable backup.
`,
};
