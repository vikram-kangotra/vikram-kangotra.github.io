// Original architecture exercises. These extend the existing descriptor and IRQ lessons.
const INTEL = 'https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html';
const OSC = 'https://www.os-book.com/OS10/slide-dir/index.html';
const intel = section => ({ label: 'Intel Software Developer Manuals', url: INTEL, section });
const osc = section => ({ label: 'Operating System Concepts, tenth edition', url: OSC, section });
const ostep = (file, section) => ({ label: 'Operating Systems: Three Easy Pieces', url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/' + file, section });
const phil = (path, section) => ({ label: 'Writing an OS in Rust: Phil Opp', url: 'https://os.phil-opp.com/' + path + '/', section });
const p = (title, ...paragraphs) => ({ type: 'prose', title, paragraphs });
const table = (caption, columns, rows) => ({ type: 'table', caption, columns, rows });
const trace = (caption, columns, rows) => ({ type: 'trace', caption, columns, rows });
const code = (title, language, source, notes) => ({ type: 'code', title, language, code: source, notes });
const ex = (title, prompt, tasks, solution, checks) => ({ type: 'exercise', title, prompt, tasks, solution, checks });

export const architectureFurtherHandbook = {
  'drivers-and-irqs': [{
    id: 'irq-draining-and-idle-wakeup', sectionId: 'path', title: 'Close the interrupt races between draining a device and sleeping',
    intro: ['An interrupt is a notification that software should inspect some state. The device can accumulate several events while one interrupt is pending, and the handler can publish work while the consumer is deciding to sleep. Correct delivery therefore needs a device-service protocol and a CPU idle protocol. This lesson derives both boundaries for a deliberately small single-CPU kernel.'],
    blocks: [
      p('Assign an owner to each state change',
        'Separate three facts in the debugger: whether the device has unread data, whether the interrupt controller considers a vector in service, and whether the software queue contains work. Reading device data changes the first fact. EOI changes controller state. Publishing a queue entry changes the third. A single EOI cannot establish all three facts, and a count of interrupts can differ from a count of transferred bytes.',
        'A level-triggered source keeps its request asserted while its service condition remains true. A driver commonly drains or masks that condition before completing controller servicing, following the device specification. An edge-triggered source records transitions; delaying service can coalesce transitions or overrun a device buffer. Thus a polling budget needs a continuation mechanism. Stopping after sixteen reads is safe only when remaining work has a reliable owner and route back to execution.',
        'One bounded design masks this device source, drains up to a fixed budget, publishes captured records, and schedules a worker if more work remains. The worker continues with the source masked. When it observes an empty device, it follows the device’s documented rearming sequence and rechecks any required status. An event arriving between the empty observation and unmasking must either remain visible, cause a new interrupt, or be found by that recheck. Document which of those facts closes the race for the actual device.'),
      table('A burst with a four-record service budget', ['Moment', 'Device records', 'Software action', 'Outstanding owner'], [
        ['Interrupt arrives', 'A B C D E F', 'Mask source and enter bounded service', 'IRQ handler'],
        ['Four reads finish', 'E F', 'Publish A through D and queue worker', 'Worker owns continued draining'],
        ['New record G arrives', 'E F G', 'Source remains masked', 'Worker still owns all remaining work'],
        ['Worker drains and rearms', 'Empty at observation', 'Apply protocol-specific unmask and recheck', 'Device IRQ route after handoff']
      ]),
      p('The empty check and HLT form one protocol',
        'Suppose ordinary code sees an empty queue, an IRQ publishes one byte and returns, and ordinary code then executes HLT. The byte remains ready while the processor sleeps until another wake event. A periodic timer can hide this defect by eventually waking the CPU, making the failure appear as unpredictable input latency. Disable the timer during a controlled test so a single device event exposes the missing wakeup.',
        'For a single CPU whose only producer is a maskable interrupt handler, disable interrupts before testing the work predicate. If it is empty, execute adjacent STI and HLT instructions. When STI changes IF from zero to one, recognition of maskable interrupts is delayed through the following instruction. This gives HLT an opportunity to execute before a pending maskable interrupt is serviced. After the handler returns, execution resumes after HLT and repeats the predicate check. NMI and faults have separate rules; neither may act as an unaccounted producer in this small proof.'),
      code('Wait for a counted event under a specific single-CPU contract', 'asm', `bits 32
section .text
global wait_events
extern pending_events
; Entry: CPL=0, IF=1. Only local maskable IRQs increment the
; aligned 32-bit counter, with IF=0 and a defined overflow policy.
; Exit: EAX=nonzero captured count, IF=1. Arithmetic FLAGS clobbered.
; Preserves other general registers. Suitable stacks/IDT are active.
wait_events:
.again:
    cli
    cmp dword [pending_events], 0
    jne .take
    sti
    hlt
    jmp .again
.take:
    mov eax, [pending_events]
    mov dword [pending_events], 0
    sti
    ret`, [
        'The predicate check and reset execute with local maskable interrupts disabled. A real queue consumer must protect its own head/tail transaction under an equally explicit contract.',
        'STI and HLT must remain adjacent. A compiler wrapper needs an appropriate memory clobber so memory operations stay on their intended side of the boundary.',
        'The counter needs a bounded overflow policy, such as saturating and recording overflow. Wrapping a positive pending count to zero would defeat the predicate.',
        'This fragment deliberately returns with IF enabled and therefore requires that entry contract. A general irq-save helper must restore the caller’s prior IF state.'
      ]),
      p('Extend the proof when another CPU can publish',
        'CLI affects the executing logical CPU. A remote producer can still enqueue immediately after the empty check. An SMP idle protocol needs a shared sleeping or wake-needed state, atomic publication, and an IPI or another documented wake mechanism. Its proof must cover both orders: publication before the consumer commits to sleep, and publication after that commitment. Reusing the single-CPU assembly with a shared queue leaves this additional ordering unresolved.',
        'Interrupt-context locks create another boundary. If an ordinary path owns a lock and its local handler spins on the same lock, the owner cannot resume to release it. Save and disable local interrupts before acquiring a lock shared with that handler, restore the saved state afterward, and keep the protected work bounded. NMI handlers require their own ownership design because CLI leaves NMI delivery available. Prefer preallocated emergency records for that context.'),
      ex('Reconstruct a delayed key and a stuck source', 'A single key event arrives between an empty queue check and HLT. In a separate run, a level-triggered device is still asserted when EOI is sent.',
        ['Trace why the first run can sleep with work ready.', 'Show where CLI and adjacent STI/HLT move the event in the corrected run.', 'Explain why repeatedly entering the IRQ handler in the second run can be expected behavior.', 'For a four-record budget and eleven ready records, calculate the minimum number of service batches.'],
        ['The handler publishes before HLT, so its completed interrupt supplies no future wake event. Protecting the check with CLI delays a pending maskable interrupt through the following HLT after STI; the wake resumes the loop and finds work.', 'The asserted level still describes an unserviced condition, so completing controller servicing permits another delivery. The driver must drain or mask and transfer ownership according to the device protocol.', 'Eleven records need ceil(11/4)=3 batches. The first two consume four each and the last consumes three. A continuation owner must exist between batches.'],
        ['Ready work always has either a running consumer or a reliable wake path.', 'Service-budget exhaustion preserves a continuation owner.', 'The counter and queue have explicit overflow behavior.'])
    ], references: [intel('STI and HLT instruction definitions; interrupt inhibition and NMI'), ostep('file-devices.pdf', 'I/O devices: interrupts, polling, and device protocols'), osc('Chapter 12: I/O Systems, interrupt-driven I/O'), phil('hardware-interrupts', 'Interrupt completion and deadlocks; x86-64 Rust examples'), phil('async-await', 'Sleeping when idle and the enable-and-halt race')]
  }],
  'user-mode': [{
    id: 'first-ring-three-iret-frame', sectionId: 'iret', title: 'Build the first ring-3 frame and keep TSS.ESP0 attached to the running task',
    intro: ['A first user-mode entry can be constructed as an interrupt return to an outer privilege level. In the legacy 32-bit design here, IRETD consumes an EIP, CS, EFLAGS, ESP, and SS frame. The kernel supplies that frame, while the GDT, paging structures, and TSS make the proposed transition valid. Each structure has a different job.'],
    blocks: [
      table('A six-entry GDT for the worked transition', ['Index', 'Selector', 'Descriptor', 'Required properties'], [
        ['0', '0x00', 'Null', 'Reserved first slot'],
        ['1', '0x08', 'Kernel code', 'Present, DPL 0, executable, 32-bit'],
        ['2', '0x10', 'Kernel data/stack', 'Present, DPL 0, writable data'],
        ['3', '0x1b', 'User code', 'Index 3 plus RPL 3; present nonconforming DPL 3 code'],
        ['4', '0x23', 'User data/stack', 'Index 4 plus RPL 3; present DPL 3 writable data'],
        ['5', '0x28', '32-bit TSS', 'System descriptor, available type 9 before LTR, limit at least 103']
      ]),
      p('Prepare both sides of the privilege boundary',
        'All four code/data descriptors in this example have base zero and suitable flat limits. The table occupies 6 × 8 = 48 bytes, so GDTR.limit is 47. User selector 0x1b decomposes into index 3, TI=0, and RPL=3. IRETD checks the proposed code selector, descriptor type, presence, privilege, and offset. The outer stack selector must name a present writable stack segment with DPL and RPL matching the new CPL.',
        'Map user code at 0x00400000 and a writable user stack page at [0xbfffd000,0xbfffe000). The initial user ESP is the exclusive upper endpoint 0xbfffe000; its first push writes within the mapped page. Every paging level needed for a user access must permit that access. Kernel stacks, tables, and kernel text retain supervisor mappings. In ordinary legacy paging without NX support, executable permissions are limited; use the supported paging configuration and make that limitation explicit.',
        'Allocate a valid 104-byte 32-bit TSS. ESP0 is at byte offset 4, SS0 at offset 8, and the I/O-map base field at offset 102. Set SS0=0x10 and ESP0=0xc0104000 for a reserved kernel stack [0xc0102000,0xc0104000). Set the I/O-map base to 104 with a descriptor limit of 103 so no I/O permission bitmap is present inside this TSS. With IOPL=0, user I/O instructions fail permission checks. Load selector 0x28 using LTR after installing the available TSS descriptor; hardware marks that descriptor busy.'),
      code('Construct a five-word outer-privilege return frame', 'asm', `bits 32
; CPL=0, flat kernel SS=0x10, trusted writable kernel stack.
; GDT, TR/TSS, user mappings, and all enabled IRQ paths are ready.
; This is a one-way first entry, with NT=VM=0 and no CET.
enter_first_user:
    cli
    mov ax, 0x23
    mov ds, ax
    mov es, ax
    mov fs, ax
    mov gs, ax
    push dword 0x23
    push dword 0xbfffe000
    push dword 0x202
    push dword 0x1b
    push dword 0x00400000
    iretd`, [
        'The push order is the reverse of IRETD consumption. EIP is on top when IRETD begins.',
        'The selected initial EFLAGS sets reserved bit 1 and IF, with IOPL, NT, VM, TF, and DF clear. This is a chosen initial user policy.',
        'Loading user data selectors at CPL 0 is permitted by these descriptors. SS remains the kernel stack segment until the return completes.',
        'All interrupts that become deliverable after the transition need valid entries and trusted stacks. This fragment supplies neither a full GDT nor a complete handler.'
      ]),
      trace('The first user INT 0x80 enters through TSS.ESP0', ['New kernel address', 'Saved value', 'Meaning'], [
        ['0xc0103ffc', '0x00000023', 'Old user SS'],
        ['0xc0103ff8', 'Current user ESP', 'Old user stack pointer'],
        ['0xc0103ff4', 'User EFLAGS', 'Flags before interrupt-gate entry'],
        ['0xc0103ff0', '0x0000001b', 'Old user CS'],
        ['0xc0103fec', 'Instruction after INT', 'Return EIP; handler starts with this on top']
      ]),
      p('Keep the return frame separate from the entry-stack rule',
        'Install a present 32-bit interrupt gate for vector 0x80 with DPL=3, a kernel code selector, and the syscall entry address. Its type/attribute byte is 0xee. The gate’s DPL permits the software INT instruction from CPL 3; the target code descriptor makes execution enter CPL 0. For this no-error-code interrupt, hardware switches to SS0:ESP0 and pushes five four-byte values, consuming twenty bytes. The assembly wrapper then adds its software saves. It must load kernel data selectors before ordinary kernel data accesses and restore the selected return state before IRETD.',
        'TSS.ESP0 supplies a future privilege-entry stack. It does not choose the initial user stack and does not automatically follow a software scheduler’s current-task pointer. Before returning task B to user mode, update the local CPU’s ESP0 to B’s kernel stack top. Otherwise B’s next interrupt can overwrite task A’s suspended kernel state. Update the scheduling state and stack-entry state inside a controlled transition so an interrupt observes a consistent owner.',
        'A diagnostic first user program should perform one known system call, try one prohibited I/O instruction under a recoverable exception policy, and attempt a supervisor-page access. Record the saved CS and stack addresses in the handlers. Seeing CS low bits equal three and the kernel frame inside the intended task stack is direct evidence of a privilege transition. A printed greeting alone cannot establish which ring executed the code.'),
      ex('Find a cross-task stack corruption', 'Task A has kernel stack top 0xc0104000. Task B has top 0xc0108000. The scheduler returns B to user mode but leaves TSS.ESP0 unchanged.',
        ['Locate the first five hardware words when B invokes INT 0x80.', 'Calculate B’s correct frame-start address.', 'State when the scheduler must update ESP0.', 'Predict the required changes when this design is ported to x86-64.'],
        ['B’s frame lands at 0xc0103fec through 0xc0103fff, inside A’s stack. The correct B frame begins at 0xc0107fec.', 'The scheduler must establish B’s trusted privilege-entry stack before B can execute with a return path into the kernel. A per-CPU TSS must follow the task selected on that CPU.', 'The x64 design uses RSP0, sixteen-byte TSS descriptors, eight-byte interrupt-frame slots, and IRETQ. Its stack frame and IST rules require a separate calculation.'],
        ['The five-word frame consumes 20 bytes.', 'User ESP and kernel ESP0 have separate owners.', 'Every running task has a valid next privilege-entry stack.'])
    ], references: [intel('Protected-mode interrupt transfers; returning from an interrupt; 32-bit TSS; I/O permission bitmap'), ostep('cpu-mechanisms.pdf', 'Limited direct execution and restricted operations'), osc('Chapter 1: dual-mode operation; Chapter 3: context switching')]
  }],
  'long-mode-and-uefi': [
    {
      id: 'syscall-entry-and-validated-return', sectionId: 'syscalls', title: 'Define a complete SYSCALL ABI and validate every return path',
      intro: ['SYSCALL provides a compact x86-64 privilege transition whose software contract differs from an IDT interrupt. This lesson uses ordinary IA-32e operation with FRED and CET disabled, four-level paging, and a kernel-defined six-argument ABI. The goal is to account for every value that must survive entry and every value that can affect return.'],
      blocks: [
        p('Derive the descriptor and register setup',
          'Check CPUID support for SYSCALL/SYSRET, enable IA32_EFER.SCE, and configure IA32_STAR, IA32_LSTAR, and IA32_FMASK on every participating logical CPU. LSTAR contains the canonical kernel entry RIP. The entry code and its early data must be reachable through the address space active at the transition. A kernel with separate user and kernel page-table roots needs a deliberately mapped entry region and an explicit CR3 transition.',
          'Choose kernel code selector 0x08 and kernel data selector 0x10. Put a compatibility user-code slot at 0x18, user data at 0x20, and 64-bit user code at 0x28. Set STAR bits 47:32 to 0x08 and bits 63:48 to 0x18, giving 0x0018000800000000. A 64-bit SYSRET derives user SS from the upper field plus 8, and user CS from that field plus 16, with user RPL, producing SS=0x23 and CS=0x2b. This arithmetic constrains the descriptor layout.',
          'Define the syscall number in RAX and arguments in RDI, RSI, RDX, R10, R8, and R9. SYSCALL saves the following instruction address in RCX and saved flags in R11, so those two registers are clobbered by the user-visible call. The fourth argument uses R10 to avoid the RCX return-address role. If a C dispatcher uses the System V fourth-argument register RCX, the wrapper must adapt its argument layout after preserving the return address.'),
        table('State immediately after SYSCALL', ['Item', 'Hardware effect', 'Software obligation'], [
          ['RIP and privilege', 'Transfer to LSTAR with configured kernel code state', 'Ensure entry mappings and descriptor layout agree'],
          ['RCX', 'Receives next user RIP', 'Save before a C call or argument adaptation'],
          ['R11', 'Receives saved user flags', 'Save and sanitize according to return policy'],
          ['RSP', 'Retains the user value', 'Save without using it as a trusted kernel stack'],
          ['RFLAGS', 'Apply complement of FMASK', 'Mask IF, DF, TF and other selected flags at entry'],
          ['General registers', 'Most remain live user inputs', 'Save ABI-required state and validate arguments']
        ]),
        p('Establish a trusted stack before ordinary calls',
          'A common entry design uses SWAPGS to select a configured kernel GS base, stores user RSP in a CPU-local slot, and loads the current task’s kernel stack top. It then builds a software frame containing return RIP, flags, user stack, and preserved registers. Kernel C entry requires its own alignment and DF policy. Keep interrupts disabled until all state needed by a nested handler is valid, and compile kernel paths without the user-space red zone.',
          'SWAPGS introduces a transition state that NMI entry must understand. An NMI can arrive after privilege has changed but before GS has been swapped, or while returning after GS has been swapped back. Saved CS privilege alone cannot identify every such window. A complete implementation needs a carefully designed NMI/entry convention with dedicated stacks and verified CPU-local access. The register table is a design contract; it is insufficient as a production entry stub by itself.'),
        code('A small return-policy validator for the chosen address-space layout', 'c', `#include <stdint.h>
#include <stdbool.h>

struct user_return {
    uint64_t rip, rsp, rflags;
};

static bool user_address(uint64_t value) {
    return value >= UINT64_C(0x10000) &&
           value < UINT64_C(0x0000800000000000);
}

bool prepare_user_return(struct user_return *state) {
    if (!user_address(state->rip) || !user_address(state->rsp))
        return false;
    /* Retain arithmetic flags; choose IF=1 and reserved bit 1=1. */
    state->rflags = (state->rflags & UINT64_C(0x8d5)) |
                    UINT64_C(0x202);
    return true;
}`, [
          'The pointer to state refers to trusted kernel memory. This helper does not copy from a user pointer.',
          'The accepted interval is a deliberately chosen low user range for four-level paging. The helper excludes the zero-page region and all upper-half addresses.',
          'Address classification does not prove a mapping, ownership, executable permission, or stack capacity. Those policies need separate checks.',
          'This initial policy clears TF, DF, IOPL, NT, RF, and AC. A debugger or signal ABI can require additional explicitly supported return paths.'
        ]),
        p('Treat the final return window as privileged execution',
          'SYSRET does not restore RSP. Software that restores user RSP before SYSRET briefly executes privileged instructions with an untrusted stack value. Keep maskable interrupts disabled throughout that window and make NMI and relevant exception delivery use trusted stacks. On Intel processors, SYSRET with a noncanonical RCX can raise #GP before completing the return; checking RCX while still on a kernel stack avoids that particular failure path.',
          'A canonical upper-half kernel address still violates the chosen user address-space policy, so a sign-extension check alone is incomplete. Validate both shape and allowed range, retain page permissions, and use a slower IRETQ path for return states that the fast path deliberately excludes. That fallback must have its own validated frame and fault handling. Signals, tracing, interrupted returns, and malicious register modifications deserve separate test cases.',
          'For the helper above, RIP=0x00401234 and RSP=0x00007fffffffdff0 pass the range test. RIP=0x0000800000000000 fails canonical low-half classification. RIP=0xffff800000001000 is canonical yet fails the user-range policy. An input flags value with every bit set becomes 0x0ad7, retaining only the selected arithmetic bits plus 0x202. These worked values make the distinction between machine validity and kernel policy visible.'),
        ex('Test the fast-return boundary', 'A syscall implementation saves RCX correctly but restores user RSP before validating RCX. Its #GP handler uses the current stack at CPL 0.',
          ['Explain the failure for RCX=0x0000800000000000.', 'Move validation to a safe point and name the independent NMI requirement.', 'Derive user CS and SS from STAR upper field 0x18.', 'Run the return validator with zero, the first accepted address, the low-half boundary, and a canonical upper-half address.'],
          ['SYSRET can fault while CPL remains zero and RSP already contains a user-controlled value. A same-privilege #GP path can then attempt to build its frame on that unsafe stack.', 'Validate while the trusted stack is still active. Keep a trusted NMI stack and entry convention across both SWAPGS windows. A valid return RIP alone does not solve NMI stack or GS ownership.', 'The derived selectors are CS=(0x18+16)|3=0x2b and SS=(0x18+8)|3=0x23. The sample range accepts 0x10000 and rejects the other three listed boundary categories.'],
          ['Every user-visible clobber is documented.', 'Return validation precedes restoring untrusted RSP.', 'Fast and fallback paths preserve the same privilege policy.'])
      ], references: [intel('Fast System Calls in 64-Bit Mode; SYSCALL, SYSRET, SWAPGS; interrupt stack table'), osc('Chapter 2: system-call interface and parameter passing'), ostep('cpu-mechanisms.pdf', 'Controlled entry and return across a protection boundary')]
    },
    {
      id: 'xsave-feature-and-task-ownership', sectionId: 'abi', title: 'Negotiate SIMD features and transfer extended register ownership on a switch',
      intro: ['A context switch must preserve every architectural state component that tasks are allowed to use. Saving general registers and RSP leaves x87, vector registers, and their control state outside the saved context. The CPU feature policy, compiler target, save-area layout, and scheduler therefore form one contract.'],
      blocks: [
        p('Distinguish supported, enabled, and owned state',
          'CPUID describes hardware capabilities. Control registers and XCR0 decide which supported facilities software enables. The scheduler decides which task currently owns the live values. A CPU can report AVX support while the operating system has not enabled the state needed to execute AVX instructions. Similarly, a task can own a valid saved buffer while another task’s values are currently loaded into hardware.',
          'For a bounded x87/SSE/AVX design, inspect CPUID leaf 1 for the required features, including XSAVE in ECX bit 26 and AVX in bit 28, and verify that leaf 0x0d is available. Configure the required CR0 and CR4 floating-point/SSE controls, then set CR4.OSXSAVE before using XSETBV. XCR0 bits 0, 1, and 2 select x87, SSE, and AVX state; enabling this set gives XCR0=7. Bit 0 is required, and AVX state depends on SSE state. Validate the allowed combination against the feature enumeration.',
          'The OSXSAVE indication in CPUID leaf 1 ECX bit 27 reflects OS enablement. Software that wants to use AVX checks hardware AVX, OSXSAVE, and the relevant XCR0 bits. The kernel must also establish a compatible policy on every CPU where such a task may run. A common enabled feature set simplifies migration; otherwise the scheduler needs explicit feature restrictions for each task and destination CPU.'),
        table('A worked standard-format XSAVE area for one enumerated CPU', ['Region', 'Offset', 'Size', 'Role'], [
          ['Legacy x87/SSE region', '0', '512 bytes', 'Floating-point, XMM, and related control state'],
          ['XSAVE header', '512', '64 bytes', 'State-component and format metadata'],
          ['YMM upper halves', '576', '256 bytes in this example', 'Upper halves extending XMM into YMM'],
          ['Required extent', '0', '832 bytes', '576 + 256; query the actual processor'],
          ['Alignment', 'Base modulo 64 = 0', '64 bytes', 'XSAVE/XRSTOR memory-operand requirement']
        ]),
        p('Ask the CPU for the actual layout',
          'CPUID leaf 0x0d subleaf 0 reports supported XCR0 components and sizing information. Component subleaves report their sizes and standard-format offsets. After choosing the enabled components, use the reported size for that policy. The 832-byte worked layout is suitable for this stated x87/SSE/AVX example; later extensions can require substantially larger areas. A fixed 512-byte FXSAVE buffer cannot contain enabled YMM upper halves.',
          'Allocate each task’s area at 64-byte alignment and maintain the selected standard or compacted format consistently. Three 832-byte areas consume 2496 bytes before allocator overhead, and 832 is already a multiple of 64. With a larger reported size of 2696, rounding a per-task allocation to the next 64-byte boundary gives 2752. Perform that round-up with checked arithmetic. A buffer size and alignment are both necessary because a large misaligned buffer remains invalid.',
          'New tasks need defined initial state. Prepare a documented initial-state template with valid control fields, including the conventional initial MXCSR value 0x1f80, and ensure reserved header bytes satisfy the chosen format. Intel requires a newly allocated XSAVE header to be initialized before its first save. Restoring arbitrary allocator contents can fail reserved-bit checks or expose previous task data. Save-area memory belongs to the kernel, and user-supplied signal state needs validation before any restore.'),
        code('Save and restore a negotiated mask of seven', 'asm', `bits 64
section .text
global save_xstate, restore_xstate
; RDI points to a trusted, mapped, 64-byte-aligned area of the
; enumerated size. XCR0=7 and the required CPU controls are active.
; Clobbers RAX, RDX, and arithmetic FLAGS.
; Restore replaces enabled extended state.
save_xstate:
    mov eax, 7
    xor edx, edx
    xsave64 [rdi]
    ret
restore_xstate:
    mov eax, 7
    xor edx, edx
    xrstor64 [rdi]
    ret`, [
          'EDX:EAX is the requested component mask. Saving only mask 3 would omit enabled AVX upper state.',
          'The XOR also modifies arithmetic flags. Callers must treat ordinary caller-clobbered flags as changed.',
          'These routines assume valid buffers and configuration; they do not negotiate features or initialize a new task.',
          'Compile the surrounding switch and early interrupt paths with a policy that prevents untracked SIMD use, such as an appropriate general-register-only target configuration.'
        ]),
        trace('Eager ownership transfer from task A to task B', ['Step', 'Live extended state', 'Saved buffers'], [
          ['Before switch', 'A owns the hardware registers', 'A buffer can be stale; B buffer is current'],
          ['XSAVE for A', 'Still A', 'A buffer now captures enabled state'],
          ['XRSTOR for B', 'B', 'Both buffers contain their task states'],
          ['Resume B', 'B may modify its registers', 'B buffer becomes stale until its next save']
        ]),
        p('Include kernel and interrupt code in the ownership proof',
          'An eager scheme saves the outgoing task and restores the incoming task on every relevant switch. It is easy to reason about and makes isolation tests straightforward. Lazy schemes use mechanisms such as CR0.TS and #NM to defer work, but need additional exception, migration, and security reasoning. Begin with a complete eager policy before considering that optimization.',
          'Kernel code can corrupt task state even without an explicit floating-point expression: compiler-generated copies or optimized library routines may use vector registers. Either forbid such instructions in contexts that lack a state-ownership protocol, or enter a controlled kernel vector-use section that preserves the task’s state and prevents conflicting preemption. Interrupt handlers need the same rule. Saving registers only when switching to a different task leaves same-task interrupts exposed if they use unsaved SIMD.'),
        ex('Detect the missing upper half', 'Two tasks repeatedly fill YMM0 with distinct 256-bit patterns and yield. The switch code uses a 512-byte FXSAVE area while the kernel has enabled XCR0=7.',
          ['Predict which portion can survive correctly and which portion can leak across tasks.', 'Calculate storage for three worked XSAVE areas.', 'List the configuration and compiler checks required before the test.', 'Add a migration case across two CPUs.'],
          ['FXSAVE covers the legacy SSE region, including the low XMM portion, while AVX upper halves require the corresponding XSAVE component. The upper 128 bits can retain another task’s values.', 'Three areas require 3 × 832 = 2496 bytes in the stated layout, with each base aligned to 64 bytes.', 'Confirm feature enumeration, compatible XCR0 masks, enabled controls, exact buffer sizes, trusted initialization, full save masks, and absence of uncontrolled kernel SIMD. Migration also requires a compatible destination CPU and correct ownership transfer there.'],
          ['Every enabled task component participates in the save/restore policy.', 'Both halves of the vector pattern survive repeated switches.', 'Kernel and interrupt compiler output follows the ownership contract.'])
      ], references: [intel('XSAVE feature set; determining state components and buffer sizes; initialization; XSAVE/XRSTOR instruction definitions'), osc('Chapter 3: context switch; Chapter 4: multicore programming'), ostep('cpu-mechanisms.pdf', 'Saving machine state across execution changes')]
    }
  ],
  'descriptors-and-interrupts': [{
    id: 'interrupt-stack-budget-and-fault-tests', sectionId: 'diagnostics', title: 'Budget interrupt stacks and test the failure path on a separate stack',
    intro: ['A stack reservation needs a bound on the bytes that can become live simultaneously. Exception entry, saved registers, compiler frames, nested calls, and nested events all contribute. A guard page converts an overrun into a fault only when the machine can deliver that fault using resources that remain usable. This lesson works through a small x86-64 budget.'],
    blocks: [
      p('Count the frame that the CPU and wrapper actually build',
        'Use ordinary x86-64 IDT entry with eight-byte frame slots and no CET or FRED. Hardware saves SS, RSP, RFLAGS, CS, and RIP, consuming forty bytes after its stack-alignment step. An exception error code adds eight. A common wrapper can normalize both cases to fifty-six bytes by pushing a vector plus synthetic error for a no-error event, or only a vector for an event that already has an error code. Drawing those two layouts catches accidental double error-code insertion.',
        'Assume the wrapper saves fifteen general registers, excluding RSP whose interrupted value is already represented. That uses 120 bytes. Allow up to fifteen bytes lost when hardware aligns the interrupted stack downward, eight bytes for the C return address, and an independently established 512-byte maximum for the called handler and its deepest call chain. The normalized frame plus register saves occupies 176 bytes, a multiple of sixteen, so this exact wrapper already has the required pre-CALL alignment. The constructed event budget is 56 + 120 + 15 + 8 + 512 = 711 bytes. Rounding this design allowance to 768 gives a margin, but the 512-byte premise still needs evidence from compiler output and reachable calls.',
        'A preempted kernel path might already use 3072 bytes. With two simultaneously live event budgets, the combined allowance becomes 3072 + 2 × 768 = 4608 bytes. A single 4096-byte stack fails this estimate by 512 bytes. An 8192-byte stack leaves 3584 bytes under the same assumptions. Document which events can nest and why; an unbounded recursion path invalidates every fixed calculation.'),
      table('A per-CPU baseline with three independently protected stacks', ['Reservation', 'Mapped bytes', 'Unmapped guard', 'Role'], [
        ['Ordinary idle/kernel stack', '8192', '4096', 'Normal execution and permitted interrupt nesting'],
        ['NMI stack', '4096', '4096', 'Minimal capture with its own entry policy'],
        ['Double-fault stack', '4096', '4096', 'Terminal failure capture'],
        ['Total per CPU', '16384', '12288', '28672 bytes of virtual reservation'],
        ['Four CPUs', '65536', '49152', '114688 bytes of virtual reservation']
      ]),
      p('Use IST where the interrupted stack may be unusable',
        'The x64 TSS provides seven IST pointers. A nonzero IST field in an interrupt gate selects its configured stack even when the interrupted privilege level is already zero. Give the double-fault gate a dedicated trusted stack, with its TSS, descriptor, handler code, and required output memory mapped. A page fault raised while trying to write onto an exhausted ordinary stack can escalate during delivery; the dedicated double-fault path gives the kernel a bounded place to record evidence.',
        'For a downward-growing stack, leave a guard page immediately below the mapped stack interval. This catches ordinary contiguous growth into that page. A very large stack-pointer subtraction followed by a distant write can jump over a single guard page, so large automatic allocations require probes or a policy that excludes them. The guard also requires a live page-table mapping policy; reserving a page in an allocator while leaving it mapped does not create an access fault.',
        'IST entries hold stack tops, and an entry can reload the same top on another delivery. Nested use of the same IST can overwrite an earlier frame. Distinct NMI and double-fault IST stacks remove one collision, while the NMI handler still needs a reentry policy. IRET affects NMI blocking, including interactions with exceptions during handling. A minimal terminal diagnostic can capture into a fixed CPU-local record and halt; a returning NMI handler needs the fuller nesting and GS-state design.'),
      trace('Turn a stack-overflow fault into useful evidence', ['Phase', 'Action', 'Expected evidence'], [
        ['Prepare', 'Install guard mapping, TSS IST, and double-fault gate', 'Recorded stack bounds and gate IST index'],
        ['Trigger', 'Move a controlled test stack into its guard path', 'A fault while the ordinary stack is unusable'],
        ['Deliver', 'Enter the double-fault handler through its dedicated IST', 'Handler RSP lies inside the emergency stack'],
        ['Capture', 'Store bounded record without allocator or ordinary locks', 'Vector, saved RIP/CS/RSP, CR2 observation, CPU identity'],
        ['Terminate', 'Emit fixed diagnostic and stop this test machine', 'Expected test-exit marker or controlled halt']
      ]),
      p('Make stack evidence correspond to the actual build',
        'Use compiler stack-usage reports where available, inspect generated prologues, and account for the deepest permitted call chain. Inline expansion, optimization, tracing, and diagnostic formatting can change the budget. A 512-byte local character array contributes before the formatter makes its own calls. Interrupt entry also needs the compiler’s red zone disabled so it cannot silently place live temporaries below the interrupted RSP.',
        'Measure a high-water mark by filling unused mapped stack bytes with a known pattern before use, then examining how far ordinary workloads overwrite it. That observation is useful coverage evidence, while the call-graph and nesting analysis supplies a bound for paths the workload may miss. Record the compiler flags and binary identity beside both. Test debug and optimized configurations independently if they produce different frames.',
        'The four-CPU table counts one ordinary stack per CPU plus the two emergency stacks. A scheduler with multiple kernel stacks per task must add those reservations separately. Guard pages consume virtual address space but no backing frames when left unmapped. Stack ownership persists until all saved frames and possible interrupt-entry references have been retired; freeing a task stack while a CPU’s privilege-entry pointer still names it creates a delayed use-after-free.'),
      ex('Repair an apparently adequate stack budget', 'A 4 KiB kernel stack has a 3072-byte deepest ordinary call chain. Two allowed nested handlers each have a rounded 768-byte allowance. The double-fault handler uses that same stack.',
        ['Calculate the simultaneous demand and deficit.', 'Choose a mapped size and state its remaining margin.', 'Describe the independent stack and mappings required for an overflow diagnostic.', 'Calculate total virtual and physical baseline reservations for four CPUs using the table.'],
        ['Demand is 4608 bytes, exceeding 4096 by 512. An 8192-byte ordinary stack leaves 3584 under the stated nesting assumptions.', 'The double-fault gate needs a valid dedicated IST stack and reachable TSS, GDT, IDT, handler, and diagnostic storage. The capture path must avoid dependencies on the damaged ordinary stack.', 'Four CPUs need 65536 mapped stack bytes and 49152 unmapped guard bytes, for 114688 virtual bytes. Extra task stacks and metadata remain separate allocations.'],
        ['Every simultaneous frame has a counted owner.', 'The emergency handler uses an independent trusted stack.', 'The failure test records actual handler RSP and binary identity.'])
    ], references: [intel('64-bit mode stack frame; interrupt stack table; NMI blocking; double-fault exception'), phil('double-fault-exceptions', 'Guard pages, separate interrupt stacks, and stack-overflow tests'), osc('Chapter 1: interrupts; Chapter 3: process state and stacks')]
  }],
  'apic-and-smp': [{
    id: 'ap-startup-deadlines-and-lock-order', sectionId: 'startup', title: 'Make AP startup bounded and keep readiness independent of shared locks',
    intro: ['Starting an application processor is a distributed protocol inside one machine. The bootstrap CPU publishes a boot contract, the target CPU executes a trampoline and local initialization, and both CPUs must agree when that target is safe to schedule. Timeouts, delayed arrivals, and lock dependencies deserve explicit states because they can occur before ordinary scheduling or diagnostics work.'],
    blocks: [
      p('Define readiness as a published invariant',
        'Give each target logical CPU an independent mailbox identified by its discovered APIC identity. A useful progression is OFFLINE, PREPARED, STARTING, then ONLINE or FAILED. PREPARED means its trampoline inputs and owned storage exist. STARTING means the bootstrap CPU has committed this launch attempt. ONLINE means the target has installed its local stack, descriptor and interrupt state, CPU-local data, feature policy, and any scheduler prerequisites promised by the boot contract.',
        'Use release publication after writing shared initialization data and acquire observation before consuming it. The boot trampoline also needs architectural setup for its own execution mode; C atomics describe the shared-memory publication once the CPUs have entered the assumed coherent environment. A STARTUP IPI’s vector identifies a 4 KiB page in the low megabyte: vector 0x08 names physical 0x8000. Prove that page, its referenced data, and the transition mappings remain alive throughout every possible target access.',
        'Keep a monotonically changing generation or launch cookie in the mailbox so a delayed message can be associated with its attempt. Identity and generation are diagnostic and protocol fields, but they do not physically stop a late CPU. A failed attempt’s memory must remain reserved until the target is known to be quiescent. Reusing its stack or trampoline immediately after a timeout can let delayed execution corrupt an unrelated owner.'),
      code('Choose one terminal readiness result with compare-exchange', 'c', `#include <stdatomic.h>
#include <stdbool.h>

enum boot_state { OFFLINE, PREPARED, STARTING, ONLINE, FAILED };
struct boot_mailbox {
    atomic_int state;
    unsigned apic_id;
    unsigned generation;
};

/* AP calls after all promised CPU-local initialization is complete. */
bool ap_publish_online(struct boot_mailbox *box) {
    int expected = STARTING;
    return atomic_compare_exchange_strong_explicit(
        &box->state, &expected, ONLINE,
        memory_order_acq_rel, memory_order_acquire);
}

/* BSP calls when this launch attempt reaches its measured deadline. */
bool bsp_mark_failed(struct boot_mailbox *box) {
    int expected = STARTING;
    return atomic_compare_exchange_strong_explicit(
        &box->state, &expected, FAILED,
        memory_order_acq_rel, memory_order_acquire);
}`, [
        'Both contenders replace STARTING conditionally. Exactly one can succeed for a given state transition.',
        'An AP whose publication fails must follow the failed-attempt parking protocol. It must never enter ordinary scheduling on that path.',
        'The BSP must inspect the observed state after a failed timeout transition; ONLINE may already have won.',
        'The mailbox and AP-owned storage stay allocated while either CPU may reference them. These two functions do not implement reset, IPI delivery, or physical quiescence.'
      ]),
      trace('Two legal resolutions of the deadline race', ['Ordering', 'First successful transition', 'Second attempt', 'Result'], [
        ['AP reaches readiness first', 'STARTING → ONLINE', 'BSP expects STARTING and fails', 'Accept ONLINE after observing the published state'],
        ['Deadline wins first', 'STARTING → FAILED', 'AP expects STARTING and fails', 'AP parks; BSP retains resources until quiescence is established'],
        ['AP never reaches its mailbox', 'STARTING → FAILED', 'No observed AP acknowledgment', 'Keep target excluded and retain potentially referenced resources']
      ]),
      p('Measure deadlines with an available clock',
        'A timeout needs a clock that works while this protocol runs. If the waiting BSP has local interrupts disabled, a software tick counter incremented only by its timer handler cannot advance. Use a documented polling clock or another suitable source, perform wrap-safe deadline comparisons, and bound each hardware-status wait separately. A host-emulator pause can delay guest execution, so record the chosen clock and environment when interpreting a deadline failure.',
        'For a clock measured in microseconds, a launch at 125000 with a 20000-microsecond allowance reaches its deadline at 145000. If an intermediate hardware wait already consumed 7000, only 13000 remain under a single overall budget. Resetting the full timeout at every retry can turn a supposedly bounded startup into a much longer operation. Choose per-stage and overall limits explicitly, and report the last completed stage in a preallocated record.'),
      table('Dependencies that can stop startup forever', ['BSP action', 'AP dependency', 'Repair'], [
        ['Hold allocator lock while waiting for ONLINE', 'AP allocates its startup record', 'Preallocate before launch or release the lock before waiting'],
        ['Hold console lock while polling readiness', 'AP prints before publishing ONLINE', 'Use independent bounded startup records'],
        ['Hold a run-queue lock while waiting for an IPI acknowledgment', 'Target handler needs that lock', 'Rearrange the protocol so the responder can run'],
        ['Migrate under local then remote run-queue lock', 'Other CPU takes the reverse order', 'Acquire queues in a global CPU-ID order']
      ]),
      p('Write a lock order that includes interrupt responders',
        'Suppose CPU 0 holds queue lock Q0 and wants Q1 while CPU 1 holds Q1 and wants Q0. Both spin forever even though both CPUs are running. Ordering all queue acquisitions by CPU number makes each participant request Q0 before Q1 and removes this particular cycle. Handle the equal-queue case once, and keep any outer scheduler locks in the same documented order.',
        'A lock graph must also include waits for events. A CPU waiting for an IPI acknowledgment effectively depends on the target handler. If that handler depends on a lock the sender holds, there is a cycle even when only one explicit spinlock appears in the source. Draw event waits as dependency edges alongside lock acquisitions. Local interrupt masking prevents local maskable reentry; remote CPUs and NMIs still need their own synchronization rules.',
        'Exercise startup with one, two, and several virtual CPUs, deliberately delay one target before publication, and force one target to reject a required feature. The surviving online mask should contain exactly the CPUs that completed their contracts. Capture APIC identity, generation, stage, and terminal state so a missing CPU has an explanation. Scheduling begins only after the selected membership and feature policy are stable for this milestone.'),
      ex('A timeout that never expires', 'The BSP disables interrupts, owns the console lock, and waits for a timer-handler counter to reach a deadline. The AP tries to print before setting ONLINE.',
        ['Identify the two independent reasons the wait can stop making progress.', 'Provide a bounded clock and logging arrangement.', 'Resolve both compare-exchange race orderings.', 'Calculate the remaining budget after a 7000-microsecond stage within a 20000-microsecond launch.'],
        ['The BSP’s local timer handler cannot advance its counter while maskable interrupts remain disabled. Independently, the AP waits for the console lock held by the waiting BSP.', 'Use a clock available to the polling context and preallocated per-CPU stage records. Release resources needed by responders before waiting.', 'If ONLINE wins, the timeout transition fails and the BSP observes success. If FAILED wins, the AP cannot publish ONLINE and follows its parking path. Keep storage alive until late execution is ruled out.', 'The remaining allowance is 13000 microseconds under the stated overall budget.'],
        ['Every wait has an advancing clock and a finite bound.', 'ONLINE implies completed local prerequisites.', 'No waited-for responder needs a resource held by its waiter.'])
    ], references: [intel('Multiprocessor initialization; INIT and STARTUP IPIs; interprocessor interrupt delivery'), osc('Chapter 5: multiprocessor scheduling; Chapter 8: deadlocks'), ostep('threads-locks.pdf', 'Lock correctness and progress'), ostep('threads-bugs.pdf', 'Deadlock conditions and lock ordering')]
  }]
};
