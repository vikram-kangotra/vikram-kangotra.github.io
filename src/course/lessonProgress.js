/* global Set */

// The first published curriculum stored numeric reading positions. Resolve
// those against its original order before inserting new mechanism lessons.
export function resolveLessonProgress(chapter, state = {}) {
  const sections = chapter.sections || [];
  const previous = chapter.legacySectionIds || sections.map(section => section.id);
  const knownIds = new Set(sections.map(section => section.id));
  const stored = Array.isArray(state.lessonIds)
    ? state.lessonIds
    : state.read ? previous : (Array.isArray(state.lessons) ? state.lessons : []).filter(Number.isInteger).map(index => previous[index]);
  const ids = new Set(stored.filter(id => typeof id === 'string' && knownIds.has(id)));
  const lessons = sections.flatMap((section, index) => ids.has(section.id) ? [index] : []);
  const read = sections.length > 0 && lessons.length === sections.length;
  return { ...state, lessonIds: sections.filter(section => ids.has(section.id)).map(section => section.id), lessons, read, complete: !!state.complete && read };
}

export function lessonProgressPatch(chapter, lessons) {
  const indexes = new Set(lessons);
  const lessonIds = chapter.sections.filter((_, index) => indexes.has(index)).map(section => section.id);
  return { lessons: chapter.sections.flatMap((_, index) => indexes.has(index) ? [index] : []), lessonIds, read: lessonIds.length === chapter.sections.length };
}

// Roadmaps carry only IDs so completion can reflect new reading without
// shipping every chapter's content or rewriting another chapter's saved work.
export function isChapterComplete(chapter, state = {}) {
  if (!state.complete) return false;
  const required = chapter.sectionIds || (chapter.sections || []).map(section => section.id);
  const read = new Set(Array.isArray(state.lessonIds) ? state.lessonIds : state.read ? chapter.legacySectionIds || required : []);
  return required.length > 0 && required.every(id => read.has(id));
}
