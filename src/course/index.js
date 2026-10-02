import { assemblyOutput } from './assemblyOutput';
import { foundations } from './foundations';
import { systems } from './systems';
import { assemblyBasics } from './assemblyBasics';
import { assemblyMemory } from './assemblyMemory';
import { assemblyControl } from './assemblyControl';
import { assemblyDepth } from './assemblyDepth';
import { foundationsDepth } from './foundationsDepth';
import { systemsDepth } from './systemsDepth';
import { architectureHandbook } from './handbook/architecture';
import { memoryHandbook } from './handbook/memory';
import { systemsHandbook } from './handbook/systems';
import { assemblyHandbook } from './handbook/assembly';
import { architectureFurtherHandbook } from './handbook/architectureFurther';
import { memoryFurtherHandbook } from './handbook/memoryFurther';
import { systemsFurtherHandbook } from './handbook/systemsFurther';
import { chapterStudyPlan, lessonStudyMinutes } from './studyTime';

const depthByChapter = { ...assemblyDepth, ...foundationsDepth, ...systemsDepth };
const handbook = {};
for (const source of [architectureHandbook, memoryHandbook, systemsHandbook, assemblyHandbook, architectureFurtherHandbook, memoryFurtherHandbook, systemsFurtherHandbook]) {
  for (const [slug, topics] of Object.entries(source)) handbook[slug] = [...(handbook[slug] || []), ...topics];
}
export const chapters = [...assemblyBasics, ...assemblyMemory, ...assemblyControl,
  ...assemblyOutput, ...foundations, ...systems].map(chapter => {
  const sections = chapter.sections.map(section => {
    const deepDive = depthByChapter[chapter.slug]?.[section.id];
    const lesson = { ...section, ...(deepDive ? { deepDive } : {}) };
    return { ...lesson, studyMinutes: lessonStudyMinutes(lesson) };
  }).flatMap(section => [section, ...(handbook[chapter.slug] || []).filter(topic => topic.sectionId === section.id).map(topic => {
    const id = `detail-${topic.id}`;
    const lesson = { id, parentSectionId: section.id, title: topic.title, paragraphs: topic.intro, topics: [{ ...topic, sourceSectionId: section.id, sectionId: id }] };
    return { ...lesson, studyMinutes: lessonStudyMinutes(lesson) };
  })]);
  const studyPlan = chapterStudyPlan({ ...chapter, sections });
  return { ...chapter, legacySectionIds: chapter.legacySectionIds || chapter.sections.map(section => section.id), sections, studyPlan, minutes: studyPlan.totalMinutes };
});
export const chapterSummary = (chapter) => {
  const { slug, title, subtitle, phase, minutes, studyPlan } = chapter;
  return { id: String(chapters.indexOf(chapter) + 1).padStart(2, '0'), slug, title, subtitle, phase, minutes, studyPlan, lessons: chapter.sections.length, sectionIds: chapter.sections.map(section => section.id), legacySectionIds: chapter.legacySectionIds };
};
export const courseTitle = 'Building an OS from Scratch: The Complete Guide';
