// Compact chapter-card copy. Slugs and content remain owned by the curriculum.
export const chapterDirectory = {
  'assembly-first-instructions': {
    title: 'First x86 instructions',
    description: 'Read NASM syntax, change register values, and print your first characters.',
    topics: ['Machine state', 'NASM syntax', 'MOV and CALL', 'Instruction encoding'],
  },
  'assembly-numbers': {
    title: 'Binary, hex & signed numbers',
    description: 'Convert number representations and derive how width changes their range and meaning.',
    topics: ['Binary and hex', 'Integer widths', 'Two’s complement', 'ASCII characters'],
  },
  'assembly-registers': {
    title: 'Registers & operand width',
    description: 'Trace overlapping register names and preserve the bits that a smaller write leaves untouched.',
    topics: ['Register aliases', 'Partial writes', 'Operand sizes', 'MOVZX and MOVSX'],
  },
  'assembly-arithmetic': {
    title: 'Arithmetic & flags',
    description: 'Calculate carry and overflow, capture flags, and extend arithmetic across multiple words.',
    topics: ['ADD and SUB', 'Carry and overflow', 'Status flags', 'ADC and SBB'],
  },
  'assembly-memory': {
    title: 'Memory loads & stores',
    description: 'Read and write exact bytes, interpret brackets, and move overlapping memory safely.',
    topics: ['Data declarations', 'Memory operands', 'Byte order', 'Overlapping copies'],
  },
  'assembly-addressing': {
    title: 'Real-mode addressing',
    description: 'Turn segment and offset values into physical addresses and select array elements.',
    topics: ['Segment and offset', 'Address forms', 'Segment overrides', 'Array indexing'],
  },
  'assembly-branches': {
    title: 'Comparisons & conditional jumps',
    description: 'Build decisions from flags and choose jump conditions for signed and unsigned values.',
    topics: ['CMP and TEST', 'Equality checks', 'Signed comparisons', 'Conditional jumps'],
  },
  'assembly-loops': {
    title: 'Loops & array traversal',
    description: 'Track pointers, counts, and sums while proving that each loop handles its boundaries.',
    topics: ['Loop structure', 'Counted traversal', 'Loop invariants', 'Boundary cases'],
  },
  'assembly-stack': {
    title: 'Stack, PUSH & POP',
    description: 'Follow saved values through stack memory and balance every path back to the caller.',
    topics: ['PUSH and POP', 'SS and SP', 'Stack frames', 'Stack capacity'],
  },
  'assembly-calls': {
    title: 'Functions & calling conventions',
    description: 'Trace calls and returns, pass arguments, preserve registers, and build a C-compatible frame.',
    topics: ['CALL and RET', 'Stack arguments', 'Register preservation', 'Calling conventions'],
  },
  'assembly-bits': {
    title: 'Bit operations & integer arithmetic',
    description: 'Extract fields, shift and rotate bits, and prepare full-width multiplication and division.',
    topics: ['Bit masks', 'Shifts and rotates', 'Wide multiplication', 'Signed division'],
  },
  'assembly-debugging': {
    title: 'Debugging assembly & BIOS calls',
    description: 'Connect source to machine bytes and diagnose BIOS requests, string loops, and blank output.',
    topics: ['Assembler listings', 'Loaded addresses', 'BIOS services', 'String instructions'],
  },
  'assembly-output': {
    title: 'BIOS output routines',
    description: 'Implement character, newline, string, and hex output while preserving caller state.',
    topics: ['putc and puts', 'CR and LF', 'Hexadecimal formatting', 'Register and flag saves'],
  },
  bootloading: {
    title: 'BIOS bootloader & C entry',
    description: 'Build two boot stages, enter protected mode, and load a linked C kernel.',
    topics: ['BIOS disk reads', 'Protected mode', 'Freestanding C', 'Linker layout'],
  },
  'descriptors-and-interrupts': {
    title: 'GDT, IDT & interrupts',
    description: 'Decode descriptors, populate interrupt gates, and handle exceptions with correct stack frames.',
    topics: ['GDT descriptors', 'IDT gates', 'Interrupt frames', 'TSS and privilege'],
  },
  'memory-discovery': {
    title: 'Firmware memory maps & A20',
    description: 'Collect the firmware memory map, verify A20, and reserve memory before allocation begins.',
    topics: ['E820 memory maps', 'A20 testing', 'Reserved ranges', 'Boot information'],
  },
  'drivers-and-irqs': {
    title: 'Hardware drivers & IRQs',
    description: 'Route timer and keyboard interrupts, acknowledge devices, and bound interrupt work.',
    topics: ['PIC routing', 'PIT timers', 'Keyboard parsing', 'Interrupt queues'],
  },
  'physical-memory': {
    title: 'Physical memory & buddy allocation',
    description: 'Track physical frame ownership with bitmaps and derive buddy splitting and coalescing.',
    topics: ['Frame ownership', 'Bitmap allocation', 'Buddy allocation', 'Memory zones'],
  },
  'virtual-memory': {
    title: 'Paging, page faults & replacement',
    description: 'Walk page tables, enforce permissions, handle faults, and compare page replacement policies.',
    topics: ['Page tables', 'Page faults', 'Page replacement', 'TLB invalidation'],
  },
  'kernel-heap': {
    title: 'Kernel heap & slab allocation',
    description: 'Build object allocation above pages and measure splitting, coalescing, and fragmentation.',
    topics: ['kmalloc and kfree', 'Slab caches', 'Fit policies', 'Heap fragmentation'],
  },
  'threads-and-scheduling': {
    title: 'Threads & CPU scheduling',
    description: 'Switch execution contexts, manage run queues, and compare fairness, response, and deadlines.',
    topics: ['Context switches', 'Scheduling policies', 'Periodic deadlines', 'Wait queues'],
  },
  'user-mode': {
    title: 'User mode & privilege boundaries',
    description: 'Enter ring 3, establish kernel entry stacks, and validate access to user memory.',
    topics: ['Ring 3', 'TSS stacks', 'User pointers', 'System call requests'],
  },
  'elf-loader': {
    title: 'ELF loading & process startup',
    description: 'Validate ELF images, map program segments, and construct a process entry stack.',
    topics: ['ELF validation', 'Program segments', 'Relocation records', 'Process entry stacks'],
  },
  'ipc-and-synchronization': {
    title: 'IPC, synchronization & deadlocks',
    description: 'Build communication and waiting protocols, reason about atomics, and detect unsafe dependencies.',
    topics: ['Pipes and messages', 'Locks and atomics', 'Condition variables', 'Deadlock analysis'],
  },
  'block-devices': {
    title: 'Block devices & disk scheduling',
    description: 'Issue bounded device requests, parse partitions, and compare disk, SSD, and RAID behavior.',
    topics: ['ATA and DMA', 'Disk scheduling', 'MBR and GPT', 'SSD and RAID'],
  },
  'fat-read-driver': {
    title: 'FAT reading & file access',
    description: 'Derive FAT geometry, parse directories, and follow bounded cluster chains to file data.',
    topics: ['FAT geometry', 'Directory records', 'Cluster chains', 'VFS and descriptors'],
  },
  'fat-write-driver': {
    title: 'FAT writes & crash recovery',
    description: 'Allocate clusters, order file updates, and reason about journaling and interrupted writes.',
    topics: ['Cluster allocation', 'Long filenames', 'Write ordering', 'Journaling and recovery'],
  },
  'libc-and-shell': {
    title: 'libc, system calls & shell',
    description: 'Wrap the kernel ABI in C and build a shell with parsing, pipelines, signals, and job control.',
    topics: ['System call ABI', 'Partial I/O', 'Shell pipelines', 'Signals and jobs'],
  },
  'long-mode-and-uefi': {
    title: 'x86-64 & UEFI',
    description: 'Plan long-mode entry, UEFI handoff, 64-bit calling conventions, and safe syscall returns.',
    topics: ['Long mode', 'UEFI handoff', '64-bit descriptors', 'SYSCALL and SYSRET'],
  },
  'uefi-entry': {
    title: 'UEFI entry & EFI image',
    description: 'Build a 64-bit PE/COFF application, follow the system table, and boot it with OVMF.',
    topics: ['PE/COFF', 'EFI_SYSTEM_TABLE', 'x64 firmware ABI', 'FAT boot'],
  },
  'uefi-memory': {
    title: 'UEFI memory map & exit',
    description: 'Query descriptors, preserve the map key, and leave boot services safely.',
    topics: ['GetMemoryMap', 'Descriptor stride', 'Map key', 'ExitBootServices'],
  },
  'uefi-kernel': {
    title: 'UEFI kernel handoff',
    description: 'Load a separate ELF64 kernel and transfer boot information into independent code.',
    topics: ['ELF64 segments', 'Kernel entry', 'Boot information', 'Ownership'],
  },
  'apic-and-smp': {
    title: 'APIC & multicore startup',
    description: 'Start additional CPUs, route interrupts, and coordinate shared data and translation changes.',
    topics: ['APIC routing', 'Processor startup', 'Memory ordering', 'TLB shootdowns'],
  },
  capstone: {
    title: 'Kernel integration & testing',
    description: 'Test the full kernel, study ZenOS, and examine distributed systems and virtual machines.',
    topics: ['Reproducible builds', 'Kernel testing', 'Distributed systems', 'Virtual machines'],
  },
};
