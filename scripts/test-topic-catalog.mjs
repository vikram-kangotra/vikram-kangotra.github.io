import assert from 'node:assert/strict';
import { readCourseModule } from './course-loader.mjs';

const { chapters } = await readCourseModule('src/course/index.js');
const { buildTopicCatalog, searchTopics, getTopicCollections } = await readCourseModule('src/course/topicCatalog.js');
const catalog = buildTopicCatalog(chapters);
const topicIds = new Set(chapters.flatMap(chapter => chapter.sections.flatMap(section => (section.topics || []).map(topic => topic.id))));
assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
for (const item of catalog) {
  const chapter = chapters.find(chapter => chapter.slug === item.chapterSlug);
  assert(chapter.sections.some(section => item.lessonHref === `/learn/os/${chapter.slug}#lesson-${section.id}`), `Invalid lesson: ${item.id}`);
  if (item.kind === 'topic') {
    assert(topicIds.has(item.id));
    assert.equal(item.href, `/learn/os/reference/${item.id}`);
  } else assert.equal(item.href, item.lessonHref);
}
for (const [query, first] of [
  [' GDT ', 'gdt-descriptor-bits-and-bytes'], ['global descriptor table', 'gdt-descriptor-bits-and-bytes'],
  ['IDT', 'idt-populated-table-and-gate'], ['interrupt descriptor table', 'idt-populated-table-and-gate'],
  ['buddy allocator', 'pmm-buddy-split-coalesce'], ['slab allocator', 'heap-slab-object-caches'],
  ['page faults', 'vm-page-fault-decoding'], ['page tables', 'vm-walk-10-10-12'], ['POPAD', 'register-save-layout'], ['POPFD', 'flags-image-bytes'],
]) assert.equal(searchTopics(catalog, query)[0]?.id, first, query);
assert(!searchTopics(catalog, 'IDT').some(item => item.title.toLowerCase().includes('width')), 'An acronym must not match inside another word');
assert(searchTopics(catalog, 'page table').some(item => item.id === 'vm-walk-10-10-12'));
assert.deepEqual(searchTopics(catalog, 'no-such-topic-zzq'), []);
assert.equal(searchTopics(catalog, '  ').length, catalog.length);
const destinations = new Set(catalog.map(item => item.href));
const collections = getTopicCollections(catalog);
assert.equal(collections.length, 6);
for (const group of collections) {
  assert.equal(group.topics.length, 4);
  for (const topic of group.topics) assert(destinations.has(topic.href), `${topic.label}: missing destination`);
}
assert(Buffer.byteLength(JSON.stringify(catalog)) < 240_000, 'Search index should contain compact metadata, without code or complete lesson bodies');
assert(!JSON.stringify(catalog).includes('\u2014'));
console.log(`PASS: ${catalog.length} search destinations, acronym ranking, multiword search, no-results handling, and 24 curated topic links.`);
