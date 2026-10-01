import { foundations } from './foundations';
import { systems } from './systems';
import { assemblyBasics } from './assemblyBasics';
import { assemblyMemory } from './assemblyMemory';
import { assemblyControl } from './assemblyControl';

export const chapters = [...assemblyBasics, ...assemblyMemory, ...assemblyControl, ...foundations, ...systems];
export const chapterSummary = (chapter) => {
  const { slug, title, subtitle, phase, minutes } = chapter;
  return { id: String(chapters.indexOf(chapter) + 1).padStart(2, '0'), slug, title, subtitle, phase, minutes, lessons: chapter.sections.length };
};
export const courseTitle = 'Building an OS from Scratch: The Complete Guide';
