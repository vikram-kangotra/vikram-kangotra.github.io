// Display-only briefs. Inputs and success criteria come from the same public
// contracts as the real x86 grader, so the problem cannot drift from its tests.
const sentences = text => text.match(/[^]+?(?:[.!?](?=\s+[A-Z]|$)|$)/g)?.map(part => part.trim()).filter(Boolean) || [];
const cleanInstructions = text => text.split(' Machine contract:')[0];
const hex = (value, width = 4) => typeof value === 'number' ? `0x${value.toString(16).toUpperCase().padStart(width, '0')} (${value})` : String(value);
const bytes = values => values.map(value => value.toString(16).toUpperCase().padStart(2, '0')).join(' ');
const flagNames = { carry: 'CF', parity: 'PF', auxiliary: 'AF', overflow: 'OF', zero: 'ZF', sign: 'SF', direction: 'DF', interrupt: 'IF', interrupts: 'IF' };
const suppliedInterfaces = {
  'ipc-and-synchronization': [
    { label: 'p->lock', value: 'Condition lock shared by the ring and writer count. lock(&p->lock) acquires it; unlock(&p->lock) releases it.' },
    { label: 'p->ring', value: 'Byte queue. bool ring_pop(&p->ring, out) removes the oldest byte and returns true; false means empty and leaves *out unchanged. Hold p->lock for this call.' },
    { label: 'p->writers', value: 'Unsigned number of open writers. Inspect while holding p->lock. Zero writers means no future bytes; already buffered bytes still belong to the reader.' },
    { label: 'p->readers_wait', value: 'wait_locked(&p->readers_wait, &p->lock) registers the wait and releases the lock as one operation. It returns with the lock held again. A wakeup may be spurious: check the condition again.' },
    { label: 'p->writers_wait', value: 'wake_one_locked(&p->writers_wait) wakes one blocked writer. Call with p->lock held after freeing a ring slot.' },
    { label: 'Function exit', value: 'Every return releases the lock. On drained EOF, return 0 and leave *out unchanged. On a byte, return 1 and store that byte in *out.' },
  ],
  'user-mode': [
    { label: 'bool has_user_page(uint32_t page, bool write)', value: 'Already supplied. Pass a 4096-byte-aligned page base. Returns whether the page grants user access of the requested kind. Mappings are stable for the call.' },
  ],
  'libc-and-shell': [
    { label: 'int32_t os_write(int fd, const void *buffer, uint32_t length)', value: 'Already supplied. A positive result counts accepted bytes; a negative result is an error. A short positive result requires advancing the pointer and retrying the remaining bytes.' },
  ],
};

const cProblems = {
  'descriptors-and-interrupts': ['Pack one interrupt gate into exactly eight bytes.', 'handler = 0x12345678', 'out = 78 56 08 00 00 8E 34 12; neighboring bytes stay unchanged.', 'You own the eight-byte output buffer encoding. The test supplies writable storage and a handler address.'],
  'memory-discovery': ['Find only the complete 4 KiB frames inside a firmware range.', 'base = 0x1003, length = 0x3FFD', 'first = 2, end = 5: frame indices 2, 3, and 4 are usable.', 'The range uses byte addresses; your result uses frame indices and an exclusive end.'],
  'drivers-and-irqs': ['Implement a bounded FIFO that preserves unread keyboard bytes.', 'An empty eight-slot queue; put seven bytes, then attempt an eighth.', 'Seven puts succeed; the eighth returns false and increments lost. Gets return the first seven bytes in order.', 'You write the queue structure and put/get functions. The checkpoint invokes these functions directly; hardware IRQ integration is a later step.'],
  'physical-memory': ['Allocate each available frame once, then safely release and reuse it.', '16 frame indices, 0 through 15; frames 0 and 3 are reserved.', '14 unique allocations succeed. Further allocations return -1. Releasing an allocated frame makes that frame available again.', 'You write the bitmap state and both functions. Begin with only bits 0 and 3 set. Allocation order is your choice.'],
  'virtual-memory': ['Translate a virtual address using a supplied directory and table entry.', 'v = 0x0040307A, pde = 0x00102003, pte = 0x00345067', 'Directory index 1, table index 3; translate succeeds with physical address 0x0034507A.', 'The caller supplies entry values directly. This exercise does not ask you to dereference a real page table or enable paging.'],
  'kernel-heap': ['Round an allocation request safely to a multiple of 16 bytes.', 'requested = 17; then try requested = 16, 0, and 0xFFFFFFFF.', '17 rounds to 32 and 16 stays 16. Zero and 0xFFFFFFFF must be rejected without changing the output.', 'The test supplies a 32-bit size_t request and an output pointer. This checkpoint isolates size arithmetic before you integrate it into a heap.'],
  'threads-and-scheduling': ['Choose the next runnable task with one round-robin scan.', 'runnable = {true, false, true, false}, count = 4, current = 2', 'Return task index 0 after wrapping. If every entry is false, return -1.', 'The test supplies an immutable runnable array. You write selection policy; no context switch is performed here.'],
  'user-mode': ['Validate every page touched by a userspace buffer.', 'p = 0x1FFF, n = 2; the page at 0x2000 is denied.', 'Check pages 0x1000 and 0x2000, then return false. One allowed first byte is insufficient.', 'The harness supplies has_user_page(page, write). Call it with aligned page addresses and the requested access type; do not replace it.'],
  'elf-loader': ['Calculate a new process break without crossing its logical bounds.', 'old = 0x2000, delta = -4096, base = 0x1000, limit = 0x3000', 'Succeed with out = 0x1000. A result below base or above limit must fail without changing out.', 'This checkpoint isolates brk/sbrk arithmetic. The caller supplies valid writable output storage; mapping pages belongs to the later integration work.'],
  'ipc-and-synchronization': ['Read one pipe byte while handling waits, wakeups, and EOF correctly.', 'The pipe is empty, a writer exists, and the first wakeup supplies no data.', 'Wait and check again. Return 1 only after removing a byte, or 0 when the buffer is empty and all writers have closed.', 'The harness supplies struct pipe and lock/unlock, ring_pop, wait_locked, and wake_one_locked. Use those interfaces; do not redefine their test implementations.'],
  'block-devices': ['Convert a partition-relative request into a safe absolute disk address.', 'base = 100, length = 1000, disk = 2000, lba = 999, count = 1', 'Succeed with absolute = 1099. The same request with count = 2 must fail and leave the output unchanged.', 'All sizes and addresses are 64-bit sector counts. The test calls the translation function without performing device I/O.'],
  'fat-read-driver': ['Extract one FAT12 entry without including its neighbor’s bits.', 'a = 0xBC, b = 0x3A; cluster = 2, then cluster = 3', 'Return 0xABC for the even cluster and 0x3AB for the odd cluster.', 'The caller has already fetched the two bytes at cluster + cluster/2. You only decode; sector fetching and cluster-chain traversal are separate work.'],
  'fat-write-driver': ['Change one packed FAT12 entry and preserve the shared neighbor.', 'a = 0xBC, b = 0x3A, odd = 0, value = 0xFFFF', 'Store a = 0xFF, b = 0x3F. The value is limited to 12 bits and b’s upper nibble remains 3.', 'The caller supplies writable byte pointers. You update only these bytes; disk writes and mirrored FATs are integration work.'],
  'libc-and-shell': ['Finish a write even when the syscall accepts only part of the buffer.', 'length = 8; os_write returns 2, then 3, then 3.', 'Make requests for 8, 6, then 3 remaining bytes at buffer offsets 0, 2, then 5. Return 8.', 'The harness supplies os_write. Implement write_all around it and keep its signature; do not substitute a fake successful syscall.'],
  'long-mode-and-uefi': ['Validate a 64-bit user return address under a 48-bit address policy.', 'rip = 0x1000, then rip = 0x0000800000000000', 'Accept the first address and reject the second. Also reject the upper canonical half.', 'The function uses uint64_t even in the browser’s 32-bit test kernel. Actual long-mode boot and SYSRET are separate experiments.'],
  'apic-and-smp': ['Publish a payload and consume it through a one-shot ready flag.', 'message starts with ready = 0; publish payload = -1, then consume.', 'ready becomes 1 and consume returns -1. Explain separately why a release store pairs with an acquire load.', 'You write struct message and both functions. The automated smoke test runs sequentially; your ordering argument is a separate required learning exercise.'],
  'capstone': ['Check that frame counts cover the total without arithmetic overflow.', 'total = 100, free = 60, reserved = 10, allocated = 30', 'Return true. Changing allocated to 29 or 31 returns false; wrapped sums must also fail.', 'The caller supplies counts. Arithmetic equality alone cannot establish that the categories contain different frame identities.'],
};

export function checkpointStateRows(state = {}) {
  const rows = [];
  for (const [name, value] of Object.entries(state.registers || {})) rows.push({ label: name.toUpperCase(), value: hex(value, name.startsWith('e') ? 8 : /^[abcd][hl]$/.test(name) ? 2 : 4) });
  for (const [name, value] of Object.entries(state.flags || {})) rows.push({ label: flagNames[name] || name, value: value ? '1 (set)' : '0 (clear)' });
  for (const memory of state.memory || []) rows.push({ label: `Bytes at ${memory.address}`, value: bytes(memory.bytes) });
  for (const [name, value] of Object.entries(state.segments || {})) rows.push({ label: name.toUpperCase(), value: hex(value) });
  if (typeof state.protectedMode === 'boolean') {
    rows.push({ label: 'C entry and return', value: 'Call kernel_main and let it return. The assembly entry stub owns the final halt loop.' });
    rows.push({ label: 'CR0.PE / CR0.PG', value: `${Number(state.protectedMode)} / ${Number(state.pagingEnabled)}: protected mode, paging disabled` });
    rows.push({ label: 'IF / DF', value: `${Number(state.interruptsEnabled)} / ${Number(state.directionFlag)}: interrupts disabled, forward string direction` });
    if (state.stack) rows.push({ label: 'Stack after C returns', value: `Valid stack in the reserved ${hex(state.stack.min)} to ${hex(state.stack.max)} region; preserve the return address and calling convention.` });
    if (state.serial) rows.push({ label: 'COM1 serial output', value: state.serial });
  }
  return rows;
}

export function makeCheckpointBrief(chapter, guide, step, index) {
  const lesson = chapter.sections.find(section => section.id === step.sectionId);
  const assembly = guide.kind === 'assembly';
  const learnerHelpers = Boolean(guide.learnerHelpers || step.tests?.learnerHelpers);
  const kernel = guide.kind === 'kernel';
  const cFunction = step.tests?.kind === 'c-function';
  const scaffoldPaths = Object.keys(step.tests?.scaffoldFiles || {});
  const problem = cProblems[chapter.slug];
  const tasks = sentences(cFunction ? step.tests.contract : cleanInstructions(step.instructions));
  if (kernel && step.tests?.requiredFiles?.includes('kernel/main.c')) tasks.push('Let kernel_main return after writing the required output. The assembly entry stub owns the final halt loop; the test must observe both C entry and C return.');
  const files = assembly ? learnerHelpers ? [guide.file || 'console.asm', 'lesson.asm', 'data.inc'] : ['lesson.asm', ...(step.reference?.data ? ['data.inc'] : [])] : step.filesToCreate?.length ? step.filesToCreate : kernel ? step.sectionId === 'observe' ? ['boot/stage1.asm', 'kernel/main.c', 'kernel/entry.asm'] : ['kernel/main.c', 'include/vga.h', 'build.json'] : [guide.file];
  const cases = step.tests?.cases || [];
  const first = cases[0];
  const inputRows = checkpointStateRows(first?.input);
  const expectedRows = checkpointStateRows(first?.expect);
  const goal = problem?.[0] || tasks[0] || step.title;
  const startingPoint = assembly
    ? learnerHelpers ? `Implement the output functions in ${guide.file || 'console.asm'}. Use lesson.asm to call them and data.inc for strings. Keep the functions from earlier checkpoints as you add the next one.` : index === 0 ? 'Start this chapter in lesson.asm. The editor contains a comment; write the instructions beneath it.' : 'Continue with your saved chapter draft. Follow the changes below; some checkpoints ask you to replace an earlier experiment.'
    : cFunction ? 'Create the exercise file below in the file tree. Use the interface skeleton, then fill in its function bodies. This focused test can run before your complete kernel is ready.'
      : index === 0 ? 'Open boot/stage1.asm. The editor contains a comment; write your boot sector beneath it.' : 'Keep the files from earlier stages and create or edit the paths below. Every checkpoint builds and boots your work with the dependencies listed here.';
  const supplied = assembly
    ? learnerHelpers ? 'The lab supplies startup, a stack, VGA text mode, and the test inputs. You implement the output functions. Run executes your caller in lesson.asm. Submit calls the target helper directly with varied inputs and checks its output, preserved state, and safe return.' : inputRows.length ? 'The lab puts these sample values in registers or memory before your instructions begin. Work from those values. The tests then try other starting values so you can check that your method works beyond the example.' : 'For this exercise, you choose the starting values described in the task. Load them with instructions, or write the requested data declarations.'
    : problem?.[3] || (scaffoldPaths.length
      ? `Run and Submit supply these later dependencies: ${scaffoldPaths.join(', ')}. They use fixed supplied versions for this checkpoint and leave any saved drafts of those later files untouched. You must provide every file introduced up to this checkpoint. The supplied dependencies are never inserted into your workspace.`
      : 'Use the BIOS/EDD machine contract and your files from earlier checkpoints. You now provide every source and build file. File names, linked addresses, and disk slots must agree across the build.');
  const finish = learnerHelpers ? [
    'Write the requested helper in console.asm. Preserve the caller’s 32-bit general registers, FLAGS, DS, and ES, and balance the stack before RET.',
    'Use Run to execute your lesson.asm caller and experiment with characters, strings, and numbers from data.inc.',
    'Open the coding checkpoint and choose Submit. Its tests call your helper directly with every declared input; changing only the caller cannot satisfy the helper contract.',
    'Inspect any failed output or preservation checks, repair console.asm, and submit again. A pass unlocks Continue the lesson.',
  ] : cFunction ? [
    'Save the function implementation at the exact exercise path shown above. Match the interface names and types.',
    'Choose Submit below the editor. The browser compiles this file into a supplied test kernel and runs all declared cases on x86 automatically. Run is optional: it tries the sample case without awarding checkpoint credit.',
    'Compare Expected with Actual for each failure, edit the code, and choose Submit again. A pass unlocks Continue the lesson.',
    'Find optional integration experiments in chapter Progress. When your complete kernel project is ready, open the workspace tools and choose Run kernel project in Build.',
  ] : [
    'Write the requested program. Run is available for optional experiments with the display and registers; it does not complete the checkpoint.',
    'Choose Submit below the editor. It builds, boots, and runs the checkpoint tests automatically; you do not need to choose Run first.',
    'Read the test results in Check. Passing requires your code to produce the expected machine behavior for every declared case.',
    'After editing the program, choose Submit again. When the checkpoint passes, choose Continue the lesson.',
  ];
  return {
    number: index + 1, title: step.title, goal, startingPoint, tasks, files: files.filter(Boolean), supplied,
    ...(lesson?.teaching ? { learningGoal: lesson.teaching.goal, connection: lesson.teaching.takeaway } : {}),
    inputRows, expectedRows, finish,
    ...(suppliedInterfaces[chapter.slug] ? { suppliedInterfaces: suppliedInterfaces[chapter.slug] } : {}),
    ...(problem ? { example: { input: problem[1], result: problem[2] } } : {}),
    ...(step.expectedOutput ? { output: step.expectedOutput } : {}),
    ...(step.tests ? { contract: step.tests.contract, scope: step.tests.scope, caseCount: cases.length } : {}),
    ...(assembly ? { scaffold: learnerHelpers
      ? 'The lab supplies the BIOS loader, 16-bit startup at 0x8000, a stack, VGA text mode, and a halt path after your caller returns. You supply putc, newline, puts, and print_hex16 in console.asm as each checkpoint introduces them. Keep calls in lesson.asm and strings in data.inc. Each helper must preserve all 32-bit general registers, FLAGS, DS, and ES and restore the caller’s stack. Leave ORG, boot padding, and the final halt path to the supplied startup.'
      : 'The lab supplies a BIOS loader and 16-bit startup at 0x8000, a stack, and putc (AL), print_hex16 (AX), newline, and puts (DS:SI). These helpers preserve general registers and FLAGS. Write only your routine in lesson.asm and declarations in data.inc; do not add ORG, boot padding, or a halt loop. Fall through to the supplied return, or return with a balanced stack. Keep local subroutines out of the fall-through path.' } : {}),
  };
}
