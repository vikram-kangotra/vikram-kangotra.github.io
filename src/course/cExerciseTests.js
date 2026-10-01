// Executable contracts for chapter-sized C functions. These run as native
// i386 code in a fresh teaching kernel, not as JavaScript approximations.
// Broader kernel integration and concurrency claims remain separate evidence.
const test = (name, body, hint) => ({ name, body, ...(hint ? { hint } : {}) });
const common = `#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include <limits.h>
#define COURSE_CHECK_U64(actual, expected) do { \\
    uint64_t __course_a = (actual), __course_e = (expected); \\
    COURSE_ASSERT_EQ((uint32_t)__course_a, (uint32_t)__course_e); \\
    COURSE_ASSERT_EQ((uint32_t)(__course_a >> 32), (uint32_t)(__course_e >> 32)); \\
} while (0)
`;
const standardScope = 'Tests the declared C function on native 32-bit x86, including boundary inputs and observable state. Passing this isolated function contract does not validate your complete kernel.';
const definitions = {
  'descriptors-and-interrupts': {
    contract: 'Implement void encode_gate(uint8_t out[8], uint32_t handler). Emit an interrupt gate for selector 0x08, attributes 0x8e, little-endian handler halves, and zero reserved bytes. Change exactly eight bytes.',
    cases: [0, 0x12345678, 0xffffffff, 0x80000001].map(handler => test(`Gate for 0x${handler.toString(16).padStart(8, '0')}`, `
    uint8_t bytes[10]; for (unsigned i = 0; i < 10; ++i) bytes[i] = 0xa5;
    encode_gate(bytes + 1, ${handler}u);
    const uint8_t expected[8] = {${handler & 255}, ${(handler >>> 8) & 255}, 8, 0, 0, 0x8e, ${(handler >>> 16) & 255}, ${handler >>> 24}};
    for (unsigned i = 0; i < 8; ++i) COURSE_ASSERT_EQ(bytes[i + 1], expected[i]);
    COURSE_ASSERT_EQ(bytes[0], 0xa5); COURSE_ASSERT_EQ(bytes[9], 0xa5);`, 'Check byte order, selector, present bit, and the bytes immediately outside the gate.')),
    scope: 'Checks packing and adjacent-byte preservation. It does not execute LIDT, deliver an interrupt, or validate your ISR stack frame.',
  },
  'memory-discovery': {
    contract: 'struct frames { uint64_t first, end; }; struct frames usable(uint64_t base, uint64_t length). Return the half-open interval of complete 4096-byte frames, or {0,0} for empty, too-short, or overflowing ranges.',
    cases: [
      ['Unaligned start', '0x1003u', '0x3ffdu', '2', '5'],
      ['One exact frame', '0x2000u', '4096', '2', '3'],
      ['Partial trailing frame', '0x2000u', '8191', '2', '3'],
      ['No complete frame', '0x1003u', '10', '0', '0'],
      ['Zero length', '0', '0', '0', '0'],
      ['Wrapped end', 'UINT64_MAX - 10', '20', '0', '0'],
      ['Highest representable complete frame', 'UINT64_C(0xffffffffffffe000)', '4096', 'UINT64_C(0xffffffffffffe)', 'UINT64_C(0xfffffffffffff)'],
      ['Entire representable range', '0', 'UINT64_MAX', '0', 'UINT64_C(0xfffffffffffff)'],
    ].map(([name, base, length, first, end]) => test(name, `struct frames result = usable(${base}, ${length}); COURSE_CHECK_U64(result.first, ${first}); COURSE_CHECK_U64(result.end, ${end});`, 'Round the start upward and exclusive end downward only after validating the addition.')),
  },
  'drivers-and-irqs': {
    contract: 'Keep struct queue { uint8_t data[8]; unsigned head, tail, lost; }. Implement bool put(struct queue *, uint8_t) and bool get(struct queue *, uint8_t *). Capacity is seven bytes; a rejected put increments lost and preserves unread data; an empty get leaves its output unchanged.',
    starter: '#include <stdint.h>\n#include <stdbool.h>\nstruct queue { uint8_t data[8]; unsigned head, tail, lost; };\nbool put(struct queue *q, uint8_t value) {\n    /* Add one byte, or report full without overwriting unread data. */\n    return false;\n}\nbool get(struct queue *q, uint8_t *out) {\n    /* Remove the oldest byte, or leave *out unchanged when empty. */\n    return false;\n}\n',
    cases: [
      test('Empty, full, and unread-byte preservation', `
    struct queue q = {0}; uint8_t value = 0xa7;
    COURSE_ASSERT_EQ(get(&q, &value), false); COURSE_ASSERT_EQ(value, 0xa7);
    for (unsigned i = 0; i < 7; ++i) COURSE_ASSERT_EQ(put(&q, (uint8_t)(i + 10)), true);
    COURSE_ASSERT_EQ(put(&q, 200), false); COURSE_ASSERT_EQ(put(&q, 201), false); COURSE_ASSERT_EQ(q.lost, 2);
    for (unsigned i = 0; i < 7; ++i) { COURSE_ASSERT_EQ(get(&q, &value), true); COURSE_ASSERT_EQ(value, i + 10); }
    value = 0xa7; COURSE_ASSERT_EQ(get(&q, &value), false); COURSE_ASSERT_EQ(value, 0xa7);`, 'A full ring must not overwrite the tail; head == tail represents empty.'),
      test('Repeated wraparound', `
    struct queue q = {0}; unsigned failures = 0; uint8_t value;
    for (unsigned round = 0; round < 64; ++round) {
        for (unsigned i = 0; i < 7; ++i) { if (!put(&q, (uint8_t)(round * 7 + i))) ++failures; }
        for (unsigned i = 0; i < 7; ++i) { value = 0; if (!get(&q, &value) || value != (uint8_t)(round * 7 + i)) ++failures; }
        if (q.head >= 8 || q.tail >= 8) { ++failures; break; }
    }
    COURSE_ASSERT_EQ(failures, 0); COURSE_ASSERT_EQ(q.lost, 0);`, 'Exercise more than one wrap. The sequence must remain FIFO across index zero.'),
    ],
    scope: 'Checks sequential ring behavior, wraparound, full/empty states, and data preservation. Interrupt exclusion and SMP synchronization require separate kernel tests.',
  },
  'physical-memory': {
    contract: 'Implement int alloc_frame(void) and bool release_frame(int frame) for 16 frames, with frames 0 and 3 permanently reserved. Return -1 on exhaustion. Reject out-of-range, reserved, and already-free releases. Begin with only the two reserved frames marked used.',
    starter: '#include <stdint.h>\n#include <stdbool.h>\nstatic uint16_t used = 0x0009u;\nint alloc_frame(void) {\n    /* Reserve a free frame before returning its index. */\n    return -1;\n}\nbool release_frame(int frame) {\n    /* Validate ownership and reservation before clearing its bit. */\n    return false;\n}\n',
    cases: [
      test('Fourteen unique allocations, reserved frames, exhaustion', `
    uint16_t seen = 0;
    for (unsigned i = 0; i < 14; ++i) {
        int frame = alloc_frame(); COURSE_ASSERT(frame >= 0 && frame < 16);
        if (frame < 0 || frame >= 16) return;
        uint16_t mask = (uint16_t)(1u << frame);
        COURSE_ASSERT_EQ(seen & mask, 0); COURSE_ASSERT_EQ(mask & 0x0009u, 0); seen |= mask;
    }
    COURSE_ASSERT_EQ(seen, 0xfff6u); COURSE_ASSERT_EQ(alloc_frame(), -1); COURSE_ASSERT_EQ(alloc_frame(), -1);
    for (int frame = 0; frame < 16; ++frame) if (seen & (1u << frame)) COURSE_ASSERT_EQ(release_frame(frame), true);`, 'Mark a frame before returning it. Fourteen successful calls must identify fourteen different nonreserved frames.'),
      test('Reject invalid release and reuse a released frame', `
    COURSE_ASSERT_EQ(release_frame(0), false); COURSE_ASSERT_EQ(release_frame(3), false);
    COURSE_ASSERT_EQ(release_frame(-1), false); COURSE_ASSERT_EQ(release_frame(16), false);
    COURSE_ASSERT_EQ(release_frame(INT_MAX), false); COURSE_ASSERT_EQ(release_frame(5), false);
    for (unsigned i = 0; i < 14; ++i) { int frame = alloc_frame(); COURSE_ASSERT(frame >= 0 && frame < 16 && frame != 0 && frame != 3); }
    COURSE_ASSERT_EQ(alloc_frame(), -1); COURSE_ASSERT_EQ(release_frame(5), true);
    COURSE_ASSERT_EQ(release_frame(5), false); COURSE_ASSERT_EQ(alloc_frame(), 5); COURSE_ASSERT_EQ(alloc_frame(), -1);`, 'Bounds checks must precede shifts. A released frame becomes available once; reserved frames never do.'),
    ],
    scope: 'Checks the complete 16-frame exercise pool, allocation uniqueness, reservations, exhaustion, invalid release, and reuse. It does not validate a full firmware-derived physical memory map or concurrent allocator.',
  },
  'virtual-memory': {
    contract: 'Implement unsigned pd_index(uint32_t), unsigned pt_index(uint32_t), and bool translate(uint32_t v, uint32_t pde, uint32_t pte, uint32_t *out). Support present 4 KiB pages only; reject absent entries, PDE.PS, and null output. Strip PTE flags; preserve *out on failure.',
    starter: '#include <stdint.h>\n#include <stdbool.h>\nunsigned pd_index(uint32_t v) { return 0; }\nunsigned pt_index(uint32_t v) { return 0; }\nbool translate(uint32_t v, uint32_t pde, uint32_t pte, uint32_t *out) {\n    /* Validate the entry types, then combine frame and page offset. */\n    return false;\n}\n',
    cases: [
      test('Directory/table boundaries and full-width offsets', `
    const uint32_t inputs[] = {0, 0xfffu, 0x1000u, 0x3fffffu, 0x400000u, 0x0040307au, 0xffffffffu};
    for (unsigned i = 0; i < 7; ++i) {
        uint32_t v = inputs[i], physical = 0;
        COURSE_ASSERT_EQ(pd_index(v), (v >> 22) & 1023u); COURSE_ASSERT_EQ(pt_index(v), (v >> 12) & 1023u);
        COURSE_ASSERT_EQ(translate(v, 0x00102003u, 0x00345067u, &physical), true);
        COURSE_ASSERT_EQ(physical, 0x00345000u | (v & 0xfffu));
    }`, 'The low twelve bits are offset; PTE flags are never part of the physical frame address.'),
      test('Absent entries, unsupported large pages, and unchanged output', `
    uint32_t out = 0xdeadbeefu;
    COURSE_ASSERT_EQ(translate(0x1234, 0, 0x1001, &out), false); COURSE_ASSERT_EQ(out, 0xdeadbeefu);
    COURSE_ASSERT_EQ(translate(0x1234, 1, 0x1000, &out), false); COURSE_ASSERT_EQ(out, 0xdeadbeefu);
    COURSE_ASSERT_EQ(translate(0x1234, 0x81, 0x1001, &out), false); COURSE_ASSERT_EQ(out, 0xdeadbeefu);
    COURSE_ASSERT_EQ(translate(0x1234, 1, 0x1001, 0), false);`, 'Reject unsupported mappings before storing through out.'),
      test('Every combination of low PTE flags', `
    unsigned failures = 0;
    for (uint32_t flags = 1; flags < 4096; flags += 2) {
        uint32_t out = 0; bool ok = translate(0xabcde789u, 3, 0xfffff000u | flags, &out);
        if (!ok || out != 0xfffff789u) ++failures;
    }
    COURSE_ASSERT_EQ(failures, 0);`, 'Present PTE flags, including the PAT bit, do not change the frame base; PDE.PS is a separate test.'),
    ],
    scope: 'Executes your translation model as x86 C and checks address/flag arithmetic. It does not enable CPU paging or establish writable/user permission policy.',
  },
  'kernel-heap': {
    contract: 'Implement bool rounded(size_t requested, size_t *out). On this i386 target size_t is 32 bits. Round nonzero sizes upward to a multiple of 16; reject null output and addition overflow; preserve output on failure.',
    starter: '#include <stdint.h>\n#include <stddef.h>\n#include <stdbool.h>\nbool rounded(size_t requested, size_t *out) {\n    /* Validate before rounding. */\n    return false;\n}\n',
    cases: [
      test('Alignment boundaries', `
    const size_t inputs[] = {1, 2, 15, 16, 17, 31, 32, 33, 4095, 4096};
    for (unsigned i = 0; i < 10; ++i) { size_t out = 0; COURSE_ASSERT_EQ(rounded(inputs[i], &out), true); COURSE_ASSERT_EQ(out, ((inputs[i] + 15) / 16) * 16); }
    COURSE_ASSERT_EQ(sizeof(size_t), 4);`, 'Already aligned sizes stay unchanged; the next byte requires a whole new alignment unit.'),
      test('Zero, null, largest valid size, and overflow', `
    size_t out = 123; COURSE_ASSERT_EQ(rounded(0, &out), false); COURSE_ASSERT_EQ(out, 123);
    COURSE_ASSERT_EQ(rounded(1, 0), false);
    COURSE_ASSERT_EQ(rounded(SIZE_MAX - 15u, &out), true); COURSE_ASSERT_EQ(out, SIZE_MAX - 15u);
    out = 123; for (unsigned i = 0; i < 15; ++i) { COURSE_ASSERT_EQ(rounded(SIZE_MAX - i, &out), false); COURSE_ASSERT_EQ(out, 123); }`, 'Check requested > SIZE_MAX - 15 before adding the rounding bias.'),
    ],
    scope: 'Checks the allocation-size arithmetic helper. It does not prove block splitting, coalescing, alignment of returned pointers, or freedom from leaks.',
  },
  'threads-and-scheduling': {
    contract: 'Implement int pick_next(const bool *runnable, size_t count, int current). Search after current, wrap once, and return -1 if none run. current=-1 means start at zero. Reject null input, empty or unrepresentable counts, and invalid current indices.',
    cases: [
      test('Every four-task runnable pattern and current position', `
    unsigned failures = 0;
    for (unsigned mask = 0; mask < 16; ++mask) {
        bool tasks[4]; for (unsigned i = 0; i < 4; ++i) tasks[i] = (mask & (1u << i)) != 0;
        for (int current = -1; current < 4; ++current) {
            int expected = -1;
            for (unsigned step = 0; step < 4; ++step) { unsigned i = ((unsigned)(current + 1) + step) % 4; if (tasks[i]) { expected = (int)i; break; } }
            if (pick_next(tasks, 4, current) != expected) ++failures;
            for (unsigned i = 0; i < 4; ++i) if (tasks[i] != ((mask & (1u << i)) != 0)) ++failures;
        }
    }
    COURSE_ASSERT_EQ(failures, 0);`, 'Include the current task after wrapping: it may be the only runnable task.'),
      test('Idle and malformed inputs', `
    bool one[] = {true}; COURSE_ASSERT_EQ(pick_next(one, 1, -1), 0); COURSE_ASSERT_EQ(pick_next(one, 1, 0), 0);
    one[0] = false; COURSE_ASSERT_EQ(pick_next(one, 1, 0), -1);
    COURSE_ASSERT_EQ(pick_next(0, 4, -1), -1); COURSE_ASSERT_EQ(pick_next(one, 0, -1), -1);
    COURSE_ASSERT_EQ(pick_next(one, (size_t)INT_MAX + 1u, -1), -1);
    COURSE_ASSERT_EQ(pick_next(one, 1, -2), -1); COURSE_ASSERT_EQ(pick_next(one, 1, 1), -1);`, 'Validate before modulo, conversion, or array access.'),
    ],
    scope: 'Checks round-robin selection and argument validation. Context switching, timer preemption, and scheduling fairness over time need integration tests.',
  },
  'user-mode': {
    contract: 'Implement bool user_range(uint32_t p, uint32_t n, bool write), using has_user_page(page, write) for each touched 4 KiB page. Nonempty ranges must stay below 0xc0000000 without overflow. Zero length succeeds with no lookup. Mappings are stable during this call.',
    prelude: `
static uint32_t course_pages[16], course_denied_page;
static unsigned course_page_calls, course_page_errors;
static bool course_expected_write, course_deny_write;
static void course_reset_pages(bool write) {
    course_page_calls = course_page_errors = 0; course_denied_page = 0xffffffffu;
    course_expected_write = write; course_deny_write = false;
}
bool has_user_page(uint32_t page, bool write) {
    if (course_page_calls >= 16) { ++course_page_errors; return false; }
    course_pages[course_page_calls++] = page;
    if ((page & 4095u) || write != course_expected_write) ++course_page_errors;
    return page != course_denied_page && !(write && course_deny_write);
}
`,
    cases: [
      test('Zero length performs no access', `course_reset_pages(false); COURSE_ASSERT_EQ(user_range(0xffffffffu, 0, false), true); COURSE_ASSERT_EQ(course_page_calls, 0);`),
      test('Reject overflow and kernel crossing before any lookup', `
    course_reset_pages(false);
    COURSE_ASSERT_EQ(user_range(0xfffffff0u, 64, false), false); COURSE_ASSERT_EQ(user_range(0xc0000000u, 1, false), false);
    COURSE_ASSERT_EQ(user_range(0xbfffffffu, 2, false), false); COURSE_ASSERT_EQ(course_page_calls, 0);`, 'Validate the length with subtraction before calculating the last address.'),
      test('Last byte below the split', `
    course_reset_pages(true); COURSE_ASSERT_EQ(user_range(0xbfffffffu, 1, true), true);
    COURSE_ASSERT_EQ(course_page_calls, 1); COURSE_ASSERT_EQ(course_pages[0], 0xbffff000u); COURSE_ASSERT_EQ(course_page_errors, 0);`),
      test('A one-byte crossing still checks its final page', `
    course_reset_pages(false); course_denied_page = 0x2000;
    COURSE_ASSERT_EQ(user_range(0x1fff, 2, false), false); COURSE_ASSERT_EQ(course_page_calls, 2);
    COURSE_ASSERT_EQ(course_pages[0], 0x1000); COURSE_ASSERT_EQ(course_pages[1], 0x2000); COURSE_ASSERT_EQ(course_page_errors, 0);`, 'Page permission must hold for every byte, including one byte on the last page.'),
      test('Three-page traversal and write permission', `
    course_reset_pages(true); COURSE_ASSERT_EQ(user_range(0x1fff, 4098, true), true);
    COURSE_ASSERT_EQ(course_page_calls, 3); COURSE_ASSERT_EQ(course_pages[0], 0x1000); COURSE_ASSERT_EQ(course_pages[1], 0x2000); COURSE_ASSERT_EQ(course_pages[2], 0x3000); COURSE_ASSERT_EQ(course_page_errors, 0);
    course_reset_pages(true); course_deny_write = true; COURSE_ASSERT_EQ(user_range(0x1000, 1, true), false);
    course_reset_pages(false); course_deny_write = true; COURSE_ASSERT_EQ(user_range(0x1000, 1, false), true);`),
    ],
    scope: 'Tests arithmetic, complete page traversal, and propagation of read/write intent against a deterministic permission provider. It does not prove Ring 3 isolation or protect against a concurrent unmap.',
  },
  'elf-loader': {
    contract: 'Implement bool next_break(uint32_t old, int32_t delta, uint32_t base, uint32_t limit, uint32_t *out). Accept inclusive logical bounds, validate the existing break, use wider signed arithmetic, and leave *out unchanged on rejection. out is a valid writable pointer.',
    cases: [
      ['Grow normally', '0x2000', '16', '0x1000', '0x3000', true, '0x2010'],
      ['Shrink to exact base', '0x2000', '-4096', '0x1000', '0x3000', true, '0x1000'],
      ['Grow to exact limit', '0x2000', '4096', '0x1000', '0x3000', true, '0x3000'],
      ['Beyond the limit', '0x2000', '4097', '0x1000', '0x3000', false, '0xdeadbeef'],
      ['INT32_MIN is representable after widening', '0x80001000u', 'INT32_MIN', '0x1000', '0xffffffffu', true, '0x1000'],
      ['INT32_MIN crosses below base', '0x2000', 'INT32_MIN', '0x1000', '0xffffffffu', false, '0xdeadbeef'],
      ['Unsigned wrap must not become a low address', '0xffffffffu', '1', '0', '0xffffffffu', false, '0xdeadbeef'],
      ['Old break outside policy', '0x500', '4096', '0x1000', '0x3000', false, '0xdeadbeef'],
      ['Reversed policy bounds', '0x2000', '0', '0x3000', '0x1000', false, '0xdeadbeef'],
    ].map(([name, old, delta, base, limit, ok, out]) => test(name, `uint32_t result = 0xdeadbeefu; COURSE_ASSERT_EQ(next_break(${old}, ${delta}, ${base}, ${limit}, &result), ${ok}); COURSE_ASSERT_EQ(result, ${out}u);`, 'Widen both operands before adding; validate the new value before changing the output.')),
    scope: 'Checks brk/sbrk policy arithmetic. It does not load ELF segments or prove transactional mapping and rollback.',
  },
  'ipc-and-synchronization': {
    contract: 'Implement int pipe_get(struct pipe *p, unsigned char *out) using the provided pipe/lock/ring/wait interfaces. Return 1 for a byte and 0 for drained EOF. Hold the condition lock around ring and writer checks, retry after spurious wakes, and wake a writer after removal.',
    prelude: `
struct course_lock { unsigned held; };
struct course_ring { unsigned char bytes[8]; unsigned used, next; };
struct course_wait_queue { unsigned tag; };
struct pipe { struct course_lock lock; struct course_ring ring; unsigned writers; struct course_wait_queue readers_wait, writers_wait; };
static struct pipe *course_pipe;
static unsigned course_lock_errors, course_waits, course_wakes, course_wait_script;
static void course_pipe_setup(struct pipe *p, unsigned script) {
    course_pipe = p; course_lock_errors = course_waits = course_wakes = 0; course_wait_script = script;
}
static void lock(struct course_lock *l) { if (l != &course_pipe->lock || l->held) ++course_lock_errors; l->held = 1; }
static void unlock(struct course_lock *l) { if (l != &course_pipe->lock || !l->held) ++course_lock_errors; l->held = 0; }
static bool ring_pop(struct course_ring *r, unsigned char *out) {
    if (r != &course_pipe->ring || !course_pipe->lock.held) ++course_lock_errors;
    if (!r->used) return false;
    *out = r->bytes[r->next++ % 8]; --r->used; return true;
}
static void wake_one_locked(struct course_wait_queue *q) {
    if (q != &course_pipe->writers_wait || !course_pipe->lock.held) ++course_lock_errors;
    ++course_wakes;
}
static void wait_locked(struct course_wait_queue *q, struct course_lock *l) {
    if (q != &course_pipe->readers_wait || l != &course_pipe->lock || !l->held) ++course_lock_errors;
    ++course_waits; l->held = 0;
    if (course_wait_script == 1 && course_waits == 2) { course_pipe->ring.bytes[0] = 0x51; course_pipe->ring.next = 0; course_pipe->ring.used = 1; }
    if (course_wait_script == 2 || course_waits > 4) course_pipe->writers = 0;
    l->held = 1;
}
`,
    cases: [
      test('Buffered bytes drain before EOF', `
    struct pipe p = {0}; p.ring.bytes[0] = 0x41; p.ring.used = 1; unsigned char out = 0xa5; course_pipe_setup(&p, 0);
    COURSE_ASSERT_EQ(pipe_get(&p, &out), 1); COURSE_ASSERT_EQ(out, 0x41); COURSE_ASSERT_EQ(course_wakes, 1);
    out = 0xa5; COURSE_ASSERT_EQ(pipe_get(&p, &out), 0); COURSE_ASSERT_EQ(out, 0xa5);
    COURSE_ASSERT_EQ(course_waits, 0); COURSE_ASSERT_EQ(course_lock_errors, 0); COURSE_ASSERT_EQ(p.lock.held, 0);`, 'Try the buffer before concluding that zero writers means EOF.'),
      test('Spurious wake followed by real data', `
    struct pipe p = {0}; p.writers = 1; unsigned char out = 0xa5; course_pipe_setup(&p, 1);
    COURSE_ASSERT_EQ(pipe_get(&p, &out), 1); COURSE_ASSERT_EQ(out, 0x51); COURSE_ASSERT_EQ(course_waits, 2);
    COURSE_ASSERT_EQ(course_wakes, 1); COURSE_ASSERT_EQ(course_lock_errors, 0); COURSE_ASSERT_EQ(p.lock.held, 0);`, 'The first wake supplies no data. A while/for recheck is required before a second wait.'),
      test('Final writer closes while reader waits', `
    struct pipe p = {0}; p.writers = 1; unsigned char out = 0xa5; course_pipe_setup(&p, 2);
    COURSE_ASSERT_EQ(pipe_get(&p, &out), 0); COURSE_ASSERT_EQ(out, 0xa5); COURSE_ASSERT_EQ(course_waits, 1);
    COURSE_ASSERT_EQ(course_wakes, 0); COURSE_ASSERT_EQ(course_lock_errors, 0); COURSE_ASSERT_EQ(p.lock.held, 0);`),
    ],
    scope: 'Uses deterministic lock, wait, and ring test doubles to check the reader protocol, spurious wake handling, and close behavior. It does not simulate two CPUs or prove the scheduler implementation makes wait registration atomic.',
  },
  'block-devices': {
    contract: 'Implement bool translate(uint64_t base, uint64_t length, uint64_t disk, uint64_t lba, uint64_t count, uint64_t *absolute). Validate the complete partition, then a nonempty relative request; reject overflow and leave output unchanged on failure. absolute is valid.',
    cases: [
      ['First sector', '100', '1000', '2000', '0', '1', true, '100'],
      ['Last sector', '100', '1000', '2000', '999', '1', true, '1099'],
      ['Exact full partition', '100', '1000', '2000', '0', '1000', true, '100'],
      ['High disk address', 'UINT64_MAX - 100', '100', 'UINT64_MAX', '99', '1', true, 'UINT64_MAX - 1'],
      ['Zero count', '100', '1000', '2000', '0', '0', false, 'UINT64_C(0xabcdef1234567890)'],
      ['Request exceeds partition', '100', '1000', '2000', '999', '2', false, 'UINT64_C(0xabcdef1234567890)'],
      ['Wrapped request end', '0', '1000', '2000', '1', 'UINT64_MAX', false, 'UINT64_C(0xabcdef1234567890)'],
      ['Partition begins outside disk', '2001', '1', '2000', '0', '1', false, 'UINT64_C(0xabcdef1234567890)'],
      ['Partition extends outside disk', '1999', '2', '2000', '0', '1', false, 'UINT64_C(0xabcdef1234567890)'],
      ['Wrapped partition end', 'UINT64_MAX - 1', '10', 'UINT64_MAX', '0', '1', false, 'UINT64_C(0xabcdef1234567890)'],
    ].map(([name, base, length, disk, lba, count, ok, expected]) => test(name, `uint64_t out = UINT64_C(0xabcdef1234567890); COURSE_ASSERT_EQ(translate(${base}, ${length}, ${disk}, ${lba}, ${count}, &out), ${ok}); COURSE_CHECK_U64(out, ${expected});`, 'Validate bounds with subtraction before calculating untrusted sums.')),
  },
  'fat-read-driver': {
    contract: 'Implement uint16_t decode12(uint8_t a, uint8_t b, uint32_t cluster). The bytes are the little-endian pair at cluster + cluster/2. Select the low 12 bits for an even cluster and high 12 bits for odd; do not classify the result here.',
    cases: [
      test('Shared-nibble example', 'COURSE_ASSERT_EQ(decode12(0xbc, 0x3a, 2), 0xabc); COURSE_ASSERT_EQ(decode12(0xbc, 0x3a, 3), 0x3ab);'),
      test('All 4096 values, both parities, changing neighboring nibble', `
    unsigned failures = 0;
    for (unsigned value = 0; value < 4096; ++value) {
        unsigned neighbor = (value * 7u + 3u) & 15u;
        uint16_t even_pair = (uint16_t)(value | (neighbor << 12));
        uint16_t odd_pair = (uint16_t)((value << 4) | neighbor);
        if (decode12((uint8_t)even_pair, (uint8_t)(even_pair >> 8), 0xabcdeffeu) != value) ++failures;
        if (decode12((uint8_t)odd_pair, (uint8_t)(odd_pair >> 8), 0xabcdefffu) != value) ++failures;
    }
    COURSE_ASSERT_EQ(failures, 0);`, 'Only cluster parity selects the half; neighboring bits must never leak into the result.'),
    ],
    scope: 'Exhaustively checks FAT12 value decoding. FAT32 traversal, sector fetching, cluster classification, loop detection, and file-length bounds remain driver integration tests.',
  },
  'fat-write-driver': {
    contract: 'Implement void set12(uint8_t *a, uint8_t *b, unsigned odd, uint16_t value). Update the specified FAT12 value, masking it to 12 bits. Preserve the neighboring shared nibble and all bytes outside a/b. Any nonzero odd selects the upper entry.',
    cases: [
      test('All 4096 values preserve the adjacent entry', `
    unsigned failures = 0;
    for (unsigned value = 0; value < 4096; ++value) {
        unsigned neighbor = (value * 13u + 7u) & 0xfffu;
        uint8_t even[5] = {0xa5, 0, (uint8_t)(neighbor << 4), (uint8_t)(neighbor >> 4), 0x5a};
        set12(&even[1], &even[2], 0, (uint16_t)value);
        if (((unsigned)even[1] | (((unsigned)even[2] & 15u) << 8)) != value) ++failures;
        if (((unsigned)(even[2] >> 4) | ((unsigned)even[3] << 4)) != neighbor) ++failures;
        if (even[0] != 0xa5 || even[4] != 0x5a) ++failures;
        uint8_t odd[5] = {0xa5, (uint8_t)neighbor, (uint8_t)(neighbor >> 8), 0, 0x5a};
        set12(&odd[2], &odd[3], 1, (uint16_t)value);
        if (((unsigned)(odd[2] >> 4) | ((unsigned)odd[3] << 4)) != value) ++failures;
        if (((unsigned)odd[1] | (((unsigned)odd[2] & 15u) << 8)) != neighbor) ++failures;
        if (odd[0] != 0xa5 || odd[4] != 0x5a) ++failures;
    }
    COURSE_ASSERT_EQ(failures, 0);`, 'Odd and even updates preserve opposite nibbles; verify the entire neighboring 12-bit entry after every write.'),
      test('Mask oversized values and accept nonzero parity', `
    uint8_t a = 0xbc, b = 0x3a; set12(&a, &b, 0, 0xffff); COURSE_ASSERT_EQ(a, 0xff); COURSE_ASSERT_EQ(b, 0x3f);
    a = 0xbc; b = 0x3a; set12(&a, &b, 7, 0xf123); COURSE_ASSERT_EQ(a, 0x3c); COURSE_ASSERT_EQ(b, 0x12);`),
    ],
    scope: 'Exhaustively checks FAT12 entry updates and adjacent-entry preservation. It does not prove sector-crossing I/O, mirrored FAT updates, or crash consistency.',
  },
  'libc-and-shell': {
    contract: 'Implement int32_t write_all(int fd, const void *buffer, uint32_t length). Retry short positive writes with the advanced pointer and remaining count; propagate negative errors. Return -5 for zero progress, oversized requests, or a result larger than the remaining count. Zero length makes no syscall.',
    prelude: `
static const uint8_t course_write_data[8] = {1,2,3,4,5,6,7,8};
static int32_t course_write_results[8];
static unsigned course_write_calls, course_write_errors, course_write_done, course_write_length;
static void course_write_setup(unsigned length, int32_t a, int32_t b, int32_t c) {
    course_write_calls = course_write_errors = course_write_done = 0; course_write_length = length;
    for (unsigned i = 0; i < 8; ++i) course_write_results[i] = -5;
    course_write_results[0] = a; course_write_results[1] = b; course_write_results[2] = c;
}
int32_t os_write(int fd, const void *buffer, uint32_t length) {
    if (fd != 7 || buffer != course_write_data + course_write_done || length != course_write_length - course_write_done) ++course_write_errors;
    if (course_write_calls >= 8) { ++course_write_errors; return -5; }
    int32_t result = course_write_results[course_write_calls++];
    if (result > 0 && (uint32_t)result <= length) course_write_done += (uint32_t)result;
    return result;
}
`,
    cases: [
      test('Short writes advance pointer and remaining count', `
    course_write_setup(8, 2, 3, 3); COURSE_ASSERT_EQ(write_all(7, course_write_data, 8), 8);
    COURSE_ASSERT_EQ(course_write_calls, 3); COURSE_ASSERT_EQ(course_write_done, 8); COURSE_ASSERT_EQ(course_write_errors, 0);`, 'A retry begins at buffer + done and requests length - done.'),
      test('Zero progress stops immediately', `
    course_write_setup(8, 0, 8, 0); COURSE_ASSERT_EQ(write_all(7, course_write_data, 8), -5);
    COURSE_ASSERT_EQ(course_write_calls, 1); COURSE_ASSERT_EQ(course_write_errors, 0);`),
      test('Partial progress followed by an error', `
    course_write_setup(8, 3, -9, 0); COURSE_ASSERT_EQ(write_all(7, course_write_data, 8), -9);
    COURSE_ASSERT_EQ(course_write_calls, 2); COURSE_ASSERT_EQ(course_write_done, 3); COURSE_ASSERT_EQ(course_write_errors, 0);`),
      test('Reject over-reporting without retry', `
    course_write_setup(8, 3, 6, 0); COURSE_ASSERT_EQ(write_all(7, course_write_data, 8), -5);
    COURSE_ASSERT_EQ(course_write_calls, 2); COURSE_ASSERT_EQ(course_write_errors, 0);`),
      test('Zero and oversized lengths make no call', `
    course_write_setup(0, 0, 0, 0); COURSE_ASSERT_EQ(write_all(7, course_write_data, 0), 0); COURSE_ASSERT_EQ(course_write_calls, 0);
    COURSE_ASSERT_EQ(write_all(7, course_write_data, 0x80000000u), -5); COURSE_ASSERT_EQ(course_write_calls, 0);`),
    ],
    scope: 'Checks the write_all loop against a deterministic syscall provider, including pointer/count arguments. It does not validate syscall entry, a real device, or shell parsing.',
  },
  'long-mode-and-uefi': {
    contract: 'Implement bool user_return_address(uint64_t rip). Accept addresses from 0x1000 through (1ULL << 47) - 1; reject the null guard, noncanonical gap, and upper canonical half. This exercise deliberately uses 48-bit canonical-address policy.',
    cases: [
      test('Guard and lower canonical boundaries', `
    COURSE_ASSERT_EQ(user_return_address(0), false); COURSE_ASSERT_EQ(user_return_address(0xfff), false);
    COURSE_ASSERT_EQ(user_return_address(0x1000), true); COURSE_ASSERT_EQ(user_return_address(UINT64_C(0x7fffffffffff)), true);
    COURSE_ASSERT_EQ(user_return_address(UINT64_C(0x800000000000)), false); COURSE_ASSERT_EQ(user_return_address(UINT64_C(0xffff800000000000)), false);
    COURSE_ASSERT_EQ(user_return_address(UINT64_MAX), false);`, 'Canonical upper-half addresses still violate this user-return policy.'),
      test('Upper bits must not disappear on the 32-bit compiler', `
    COURSE_ASSERT_EQ(user_return_address(UINT64_C(0x100001000)), true);
    COURSE_ASSERT_EQ(user_return_address(UINT64_C(0x1000000001000)), false);
    COURSE_ASSERT_EQ(user_return_address(UINT64_C(0xffff000000001000)), false);`, 'Keep the input 64 bits wide even though this exercise executes in an i386 test kernel.'),
    ],
    scope: 'Checks a 64-bit address-policy function compiled for i386. This is not a long-mode boot, UEFI test, executable-page check, or complete SYSRET safety proof.',
  },
  'apic-and-smp': {
    contract: 'Keep struct message { int payload; unsigned ready; }. Implement void publish(struct message *, int) and int consume(struct message *) for one-shot release/acquire publication. The machine checks below cover completed publication only; justify the memory ordering separately.',
    cases: [
      test('Publish then consume several payload patterns', `
    const int values[] = {0, 1, -1, INT_MIN, INT_MAX, 0x12345678};
    for (unsigned i = 0; i < 6; ++i) {
        struct { uint32_t before; struct message message; uint32_t after; } guarded = {0xa5a5a5a5u, {0, 0}, 0x5a5a5a5au};
        publish(&guarded.message, values[i]); COURSE_ASSERT_EQ(guarded.message.ready, 1); COURSE_ASSERT_EQ(guarded.message.payload, values[i]);
        COURSE_ASSERT_EQ(consume(&guarded.message), values[i]); COURSE_ASSERT_EQ(guarded.before, 0xa5a5a5a5u); COURSE_ASSERT_EQ(guarded.after, 0x5a5a5a5au);
    }`, 'Ready must be published and the exact payload preserved. These executions alone cannot distinguish correct atomics from a data-racy lookalike.'),
    ],
    scope: 'Sequential publication smoke test on one emulated CPU only. It cannot prove release/acquire ordering, absence of a C data race, SMP behavior, or safe slot reuse. Explain the happens-before argument and validate concurrent code separately.',
  },
  'capstone': {
    contract: 'Implement bool accounting_ok(uint64_t total, uint64_t free_frames, uint64_t reserved, uint64_t allocated). Categories must cover total exactly without overflowing; reject missing or extra counts.',
    cases: [
      test('Balanced, missing, and extra frames', `
    COURSE_ASSERT_EQ(accounting_ok(100, 60, 10, 30), true); COURSE_ASSERT_EQ(accounting_ok(100, 60, 10, 29), false);
    COURSE_ASSERT_EQ(accounting_ok(100, 60, 10, 31), false); COURSE_ASSERT_EQ(accounting_ok(0, 0, 0, 0), true);
    COURSE_ASSERT_EQ(accounting_ok(0, 1, 0, 0), false); COURSE_ASSERT_EQ(accounting_ok(10, 11, 0, 0), false);`),
      test('Overflow must not manufacture equality', `
    COURSE_ASSERT_EQ(accounting_ok(0, UINT64_MAX, 1, 0), false);
    COURSE_ASSERT_EQ(accounting_ok(10, 10, UINT64_MAX, 1), false);
    COURSE_ASSERT_EQ(accounting_ok(UINT64_MAX, UINT64_MAX, 0, 0), true);
    COURSE_ASSERT_EQ(accounting_ok(UINT64_MAX, UINT64_MAX - 2, 1, 1), true);
    COURSE_ASSERT_EQ(accounting_ok(UINT64_MAX, UINT64_MAX - 2, 2, 1), false);`, 'Subtract validated categories from the remaining total; an unchecked sum can wrap.'),
    ],
    scope: 'Checks arithmetic accounting of reported counts. Equal totals cannot prove frame identity, disjoint ownership, or the overall correctness of the kernel.',
  },
};

export function getCExerciseTests(chapter) {
  const definition = definitions[chapter.slug];
  if (!definition || chapter.challenge?.language !== 'c') return null;
  const file = `exercises/${chapter.slug}.c`;
  const reference = chapter.challenge.solution.replace(/^#include <assert\.h>\s*\n/gm, '').split(/\nint main\s*\(/)[0].trim() + '\n';
  const starter = definition.starter || chapter.challenge.starter;
  const tests = { kind: 'c-function', file, contract: definition.contract, scope: definition.scope || standardScope, prelude: common + (definition.prelude || ''), cases: definition.cases };
  return {
    file, reference, starter, tests,
    instructions: `Write this chapter’s focused C exercise in ${file}. ${definition.contract} Run its behavioral tests to check boundary cases on x86. Your kernel project remains available for the integration experiments.`,
  };
}
