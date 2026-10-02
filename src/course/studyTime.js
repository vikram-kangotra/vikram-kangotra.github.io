function textWords(value) {
  if (typeof value === 'string') return value.trim().split(/\s+/).filter(Boolean).length;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + textWords(item), 0);
  if (value && typeof value === 'object') return Object.entries(value).reduce((sum, [key, item]) => sum + (['id', 'kind', 'from', 'to'].includes(key) ? 0 : textWords(item)), 0);
  return 0;
}

export function lessonStudyMinutes(section) {
  const words = textWords([section.paragraphs, section.teaching, section.callout, section.deepDive, section.topics?.map(topic => [topic.title, section.parentSectionId ? [] : topic.intro, topic.blocks.filter(block => block.type !== 'exercise')])]);
  // A planning estimate: 180 words/minute, plus time to trace the example and
  // inspect a branching diagram. This is not a measured reading speed.
  return Math.max(3, Math.ceil(words / 180) + 2 + (section.deepDive?.flowchart ? 2 : 0));
}

export function chapterStudyPlan(chapter) {
  const readingMinutes = Math.ceil(chapter.sections.reduce((sum, section) => sum + lessonStudyMinutes(section), 0) / 5) * 5;
  // Keep the original guided-work budget where it still fits. Reserve practice
  // time even when the expanded reading exceeds the previous total estimate.
  const furtherExercises = chapter.sections.reduce((sum, section) => sum + (section.topics || []).reduce((count, topic) => count + topic.blocks.filter(block => block.type === 'exercise').length, 0), 0);
  const practiceMinutes = Math.max(20, Math.ceil((chapter.minutes - readingMinutes) / 5) * 5, furtherExercises * 10);
  return { readingMinutes, practiceMinutes, totalMinutes: readingMinutes + practiceMinutes };
}
