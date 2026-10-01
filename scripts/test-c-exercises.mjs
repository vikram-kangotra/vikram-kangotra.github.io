import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readCourseModule } from './course-loader.mjs';

const { chapters } = await readCourseModule('src/course/index.js');
const { getCExerciseTests } = await readCourseModule('src/course/cExerciseTests.js');
const directory = mkdtempSync(join(tmpdir(), 'course-c-functions-'));
const include = join(directory, 'include'); mkdirSync(include);
const headers = {
  'stdint.h': '#ifndef TEST_STDINT_H\n#define TEST_STDINT_H\ntypedef unsigned char uint8_t; typedef signed char int8_t; typedef unsigned short uint16_t; typedef short int16_t; typedef unsigned int uint32_t; typedef int int32_t; typedef unsigned long long uint64_t; typedef long long int64_t; typedef __UINTPTR_TYPE__ uintptr_t; typedef __INTPTR_TYPE__ intptr_t;\n#define UINT64_MAX 0xffffffffffffffffULL\n#define UINT32_MAX 0xffffffffU\n#define UINT64_C(v) v##ULL\n#define INT32_MIN (-2147483647 - 1)\n#define SIZE_MAX __SIZE_MAX__\n#endif\n',
  'stdbool.h': '#define bool _Bool\n#define true 1\n#define false 0\n',
  'stddef.h': 'typedef __SIZE_TYPE__ size_t;\n#define NULL ((void *)0)\n',
  'limits.h': '#define INT_MAX 2147483647\n#define INT_MIN (-2147483647 - 1)\n',
};
for (const [name, source] of Object.entries(headers)) writeFileSync(join(include, name), source);
const mutants = {
  'descriptors-and-interrupts': source => source.replace('out[5] = 0x8e', 'out[5] = 0x0e'),
  'memory-discovery': source => source.replace('base / 4096 + (base % 4096 != 0)', 'base / 4096'),
  'drivers-and-irqs': source => source.replace('++q->lost;', '/* forget loss accounting */'),
  'physical-memory': source => source.replace('used |= mask;', '/* never reserve */'),
  'virtual-memory': source => source.replace('(pte & 0xfffff000u) | (v & 0xfffu)', 'pte + (v & 0xffffu)'),
  'kernel-heap': source => source.replace('requested > SIZE_MAX - 15u', 'false'),
  'threads-and-scheduling': source => source.replace('if (runnable[i]) return (int)i;', 'return (int)i;'),
  'user-mode': source => source.replace('if (!has_user_page(page, write))', 'if (!has_user_page(page, false))'),
  'elf-loader': source => source.replace('(int64_t)old + (int64_t)delta', '(uint32_t)(old + delta)'),
  'ipc-and-synchronization': source => source.replace('wake_one_locked(&p->writers_wait);', '/* forget blocked writers */'),
  'block-devices': source => source.replace('count == 0u || ', ''),
  'fat-read-driver': source => source.replace('(pair >> 4)', '(pair & 0x0fffu)'),
  'fat-write-driver': source => source.replace('(old & 0xf000u) | value', 'value'),
  'libc-and-shell': source => source.replace('p + done, length - done', 'p, length - done'),
  'long-mode-and-uefi': source => source.replace('rip >= UINT64_C(0x1000)', 'rip >= UINT64_C(0)'),
  'apic-and-smp': source => source.replace('__atomic_store_n(&m->ready, 1u, __ATOMIC_RELEASE);', '__atomic_store_n(&m->ready, 2u, __ATOMIC_RELEASE);'),
  'capstone': source => source.replace('if (free_frames > total) return false;', '/* unchecked subtraction */'),
};
const prefix = `
static unsigned course_failures, course_assertions;
#define COURSE_ASSERT_EQ(actual, expected) do { unsigned __native_actual = (unsigned)(actual), __native_expected = (unsigned)(expected); ++course_assertions; if (__native_actual != __native_expected) ++course_failures; } while (0)
#define COURSE_ASSERT(condition) COURSE_ASSERT_EQ(!!(condition), 1u)
void *memset(void *p, int v, __SIZE_TYPE__ n) { unsigned char *b = p; while (n--) *b++ = (unsigned char)v; return p; }
void *memcpy(void *d, const void *s, __SIZE_TYPE__ n) { unsigned char *to = d; const unsigned char *from = s; while (n--) *to++ = *from++; return d; }
`;
const compiler = process.env.CC || 'gcc';
let totalCases = 0;
for (const chapter of chapters) {
  const metadata = getCExerciseTests(chapter); if (!metadata) continue;
  const { tests, reference } = metadata; totalCases += tests.cases.length;
  assert(!reference.includes('int main('));
  const mutation = mutants[chapter.slug](reference); assert.notEqual(mutation, reference, `Mutation did not change ${chapter.slug}`);
  for (const [name, implementation] of [['reference', reference], ['mutant', mutation]]) {
    const sourcePath = join(directory, `${chapter.slug}-${name}.c`);
    const binaryPath = sourcePath.slice(0, -2);
    writeFileSync(sourcePath, `${prefix}\n${tests.prelude || ''}\n${implementation}\n${tests.postlude || ''}\n${tests.cases.map((t, i) => `static void case_${i}(void) { ${t.body}\n}`).join('\n')}\nvoid _start(void) { ${tests.cases.map((_, i) => `case_${i}();`).join(' ')} unsigned result = course_assertions > 128 ? 2 : course_failures ? 1 : 0; __asm__ volatile("int $0x80" : : "a"(1), "b"(result) : "memory"); for (;;) {} }\n`);
    const compiled = spawnSync(compiler, ['-m32', '-O1', '-std=c11', '-static', '-nostdlib', '-nostdinc', '-I', include, '-ffreestanding', '-fno-builtin', '-fno-pic', '-fno-pie', '-fno-stack-protector', '-Wl,-e,_start', sourcePath, '-o', binaryPath], { encoding: 'utf8', timeout: 30000 });
    assert.equal(compiled.status, 0, `${chapter.slug} ${name} compile:\n${compiled.stderr}`);
    const execution = spawnSync(binaryPath, [], { encoding: 'utf8', timeout: 3000 });
    assert.equal(execution.signal, null, `${chapter.slug} ${name} terminated: ${execution.signal}`);
    assert.equal(execution.status, name === 'reference' ? 0 : 1, `${chapter.slug} ${name} exit ${execution.status}; 2 means >128 assertions`);
  }
  console.log(`PASS ${chapter.slug}: reference passes; realistic mutant rejected (${tests.cases.length} cases)`);
}
console.log(`PASS 17 C exercises, ${totalCases} cases, 17 rejected mutants; each checkpoint stays within the 128-assertion mailbox.`);
