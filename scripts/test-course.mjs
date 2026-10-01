import assert from 'node:assert/strict';
import { readCourseModule as sourceModule } from './course-loader.mjs';

const { chapters } = await sourceModule('src/course/index.js');
const { assembleBoot, bootExample } = await sourceModule('src/course/bootAssembler.js');
assert.equal(chapters.length, 30);
assert.equal(new Set(chapters.map(chapter => chapter.slug)).size, 30);
for (const chapter of chapters) {
  assert(chapter.sections.length >= 5, `${chapter.slug}: enough substantive lessons`);
  assert.equal(new Set(chapter.sections.map(section => section.id)).size, chapter.sections.length);
  for (const section of chapter.sections) {
    assert(section.title && section.paragraphs.length);
    if (section.code) assert(section.code.source.length > 0);
  }
  assert(chapter.challenge.starter && chapter.challenge.solution);
  assert(chapter.challenge.hints.length >= 3);
  assert(chapter.challenge.checks.length > 0);
  assert(chapter.reflection.rubric.length > 0);
  assert(chapter.sources.length > 0);
}
const { sector, labels, disk } = assembleBoot(bootExample);
assert.equal(sector.length, 512);
assert.equal(disk.length, 16 * 1024 * 1024);
assert.deepEqual([...sector.slice(510)], [0x55, 0xaa]);
assert.equal(sector[labels.message - 0x7c00], 'I'.charCodeAt(0));
assert.equal(sector[18] | sector[19] << 8, labels.message, 'mov si points to the emitted string');
assert.equal(labels.print, 0x7c14);
assert.equal(assembleBoot(bootExample.replace('I booted my own code!', 'Different program')).sector[labels.message - 0x7c00], 'D'.charCodeAt(0));
for (const data of ['db ,,,', 'dw ,', 'db "a" 0', 'db "a",,0', 'db "a",']) {
  assert.throws(() => assembleBoot(bootExample.replace('message: db "I booted my own code!", 0', `message: ${data}`)));
}
assert.throws(() => assembleBoot(bootExample.replace('dw 0xaa55', 'dw 0')), /signature|0xaa55/);
assert.throws(() => assembleBoot(bootExample.replace('mov si, message', 'mov si, missing')), /Unknown label/);
assert.throws(() => assembleBoot(bootExample.replace('mov ah, 0x0e', 'mov ah, 256')), /8 bits/);
assert.throws(() => assembleBoot(bootExample.replace('I booted my own code!', 'x'.repeat(600))), /512/);
assert.throws(() => assembleBoot(bootExample.replace('bits 16', 'bits 32')), /Unsupported/);
console.log('PASS: 30 chapter contracts; real x86 assembly layout, relocations, signature and malformed-input checks');
