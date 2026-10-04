/* global Map */
// Search metadata stays separate from lesson bodies and executable examples.
const aliases = {
  'gdt-descriptor-bits-and-bytes': 'GDT global descriptor table segmentation descriptor layout',
  'gdt-selectors-gdtr-cache': 'GDT GDTR LGDT segment selector hidden cache',
  'gdt-privilege-checks': 'GDT CPL DPL RPL privilege rings',
  'idt-populated-table-and-gate': 'IDT interrupt descriptor table LIDT gate layout',
  'interrupt-hardware-frame-ledger': 'IDT interrupt stack frame error code IRET',
  'interrupt-assembly-c-bridge': 'IDT ISR interrupt service routine stub handler',
  'tss-stack-switch-and-double-fault': 'TSS task state segment double fault ring stack',
  'vm-walk-10-10-12': 'paging page table directory virtual address translation',
  'vm-page-entry-bits': 'paging PTE PDE page table flags permissions',
  'vm-page-fault-decoding': 'paging page fault CR2 error code',
  'vm-tlb-shootdown': 'TLB translation lookaside buffer invalidation INVLPG',
  'pmm-bitmap-accounting': 'physical memory allocation bitmap frame allocator',
  'pmm-buddy-split-coalesce': 'physical memory allocation buddy allocator algorithm',
  'heap-slab-object-caches': 'memory allocation slab allocator SLUB object cache',
  'heap-fit-policies': 'memory allocation first fit best fit worst fit next fit fragmentation',
  'register-save-layout': 'PUSHA PUSHAD POPA POPAD save restore registers stack',
  'flags-image-bytes': 'PUSHF PUSHFD POPF POPFD save restore EFLAGS stack',
};

function plain(value = '') { return String(value).replace(/[`*_]/g, '').replace(/\s+/g, ' ').trim(); }
const singular = { pages: 'page', tables: 'table', faults: 'fault', registers: 'register', interrupts: 'interrupt', descriptors: 'descriptor', allocators: 'allocator', algorithms: 'algorithm', addresses: 'address', caches: 'cache', processes: 'process' };
function normalize(value) { return plain(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').map(word => singular[word] || word).join(' '); }
function excerpt(value) { const text = plain(value); return text.length > 170 ? `${text.slice(0, 167).replace(/\s+\S*$/, '')}…` : text; }

export function buildTopicCatalog(chapters) {
  return chapters.flatMap(chapter => chapter.sections.flatMap(section => {
    const lessonHref = `/learn/os/${chapter.slug}#lesson-${section.id}`;
    const shared = { lessonHref, chapterSlug: chapter.slug, chapterTitle: chapter.title, phase: chapter.phase };
    if (section.topics?.length) return section.topics.map(topic => ({
      ...shared, id: topic.id, title: topic.title, href: `/learn/os/reference/${topic.id}`, kind: 'topic',
      summary: excerpt(topic.intro?.[0]),
      search: normalize([aliases[topic.id] || '', ...(topic.blocks || []).map(block => block.title || block.caption || '')].join(' ')),
    }));
    return [{ ...shared, id: `${chapter.slug}/${section.id}`, title: section.title, href: lessonHref, kind: 'lesson',
      summary: excerpt(section.paragraphs?.[0]),
      search: normalize([section.id, section.visual?.title, ...(section.deepDive?.blocks || []).map(block => block.title || block.caption || '')].filter(Boolean).join(' ')),
    }];
  }));
}

export function searchTopics(catalog, query) {
  const phrase = normalize(query);
  if (!phrase) return catalog;
  // Broad lookups begin at the core mechanism before its later applications.
  const primaryTopic = { 'page table': 'vm-walk-10-10-12', paging: 'vm-walk-10-10-12', 'page fault': 'vm-page-fault-decoding' }[phrase];
  const words = phrase.split(' ');
  return catalog.map((item, order) => {
    const title = normalize(item.title), tags = normalize(item.search);
    const chapter = normalize(`${item.chapterTitle} ${item.chapterSlug} ${item.phase}`);
    const text = `${title} ${tags} ${chapter} ${normalize(item.summary)}`;
    const tokens = text.split(' ');
    if (!words.every(word => tokens.some(token => token === word || (word.length > 3 && token.startsWith(word))))) return null;
    const titleWords = title.split(' ');
    const score = (item.id === primaryTopic ? 100 : 0) + (title === phrase ? 100 : 0) + (title.includes(phrase) ? 30 : 0)
      + words.reduce((total, word) => total + (titleWords.includes(word) ? 12 : title.includes(word) ? 6 : 0) + (tags.split(' ').includes(word) ? 4 : 0), 0)
      + (item.kind === 'topic' ? 1 : 0);
    return { item, score, order };
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.order - b.order).map(result => result.item);
}

const collections = [
  { id: 'cpu', title: 'Assembly & CPU state', description: 'Registers, instructions, the stack, and calling functions.', topics: [
    ['Registers', 'assembly-registers/names-select-bits'], ['Stack', 'assembly-stack/ownership'], ['PUSHAD / POPAD', 'register-save-layout'], ['PUSHFD / POPFD', 'flags-image-bytes'],
  ] },
  { id: 'tables', title: 'Boot & CPU tables', description: 'Boot contracts, descriptor tables, interrupts, and privilege changes.', topics: [
    ['GDT layout', 'gdt-descriptor-bits-and-bytes'], ['IDT layout', 'idt-populated-table-and-gate'], ['Interrupt stack', 'interrupt-hardware-frame-ledger'], ['TSS', 'tss-stack-switch-and-double-fault'],
  ] },
  { id: 'paging', title: 'Virtual memory', description: 'Address translation, permissions, faults, and page replacement.', topics: [
    ['Page tables', 'vm-walk-10-10-12'], ['Page faults', 'vm-page-fault-decoding'], ['TLB', 'vm-tlb-shootdown'], ['FIFO / LRU / OPT', 'vm-fifo-lru-opt-trace'],
  ] },
  { id: 'allocation', title: 'Memory allocation', description: 'Physical frames, heap blocks, and allocator algorithms.', topics: [
    ['Bitmap allocator', 'pmm-bitmap-accounting'], ['Buddy allocator', 'pmm-buddy-split-coalesce'], ['Slab allocator', 'heap-slab-object-caches'], ['Fit policies', 'heap-fit-policies'],
  ] },
  { id: 'processes', title: 'Processes & synchronization', description: 'Scheduling, system calls, shared state, and deadlocks.', topics: [
    ['Scheduling', 'scheduling-gantt-metrics'], ['System calls', 'syscall-abi-errors-progress'], ['Locks & atomics', 'atomic-publication-and-locks'], ['Deadlocks', 'deadlock-conditions-prevention'],
  ] },
  { id: 'storage', title: 'Storage & I/O', description: 'Devices, file systems, disk scheduling, and crash recovery.', topics: [
    ['DMA & buffering', 'io-completion-dma-buffering'], ['Disk scheduling', 'hdd-scheduling-latency'], ['VFS & file descriptors', 'vfs-pathnames-and-descriptors'], ['Journaling', 'write-ordering-journal-recovery'],
  ] },
];

export function getTopicCollections(catalog) {
  const byId = new Map(catalog.map(item => [item.id, item]));
  return collections.map(group => ({ ...group, topics: group.topics.flatMap(([label, id]) => {
    const item = byId.get(id);
    return item ? [{ label, href: item.href }] : [];
  }) }));
}
