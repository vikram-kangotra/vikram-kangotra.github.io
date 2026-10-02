import { bootProgram } from './assemblyPrograms';
import { assemblyCaseInitialization } from './machineTestHarness';
import { getCExerciseTests } from './cExerciseTests';

// The learner writes only the routine being taught. NASM still assembles every
// instruction; the execution harness establishes the documented machine state.
export function prepareGuidedBuild(files, kind, input, setupFile) {
  if (kind !== 'assembly') return { ...files };
  if (typeof files['lesson.asm'] !== 'string') throw new Error('Create lesson.asm for your lesson routine.');
  if (Object.hasOwn(files, '__lesson_boot.asm')) throw new Error('__lesson_boot.asm is reserved for the execution harness.');
  if (setupFile && (!Object.hasOwn(files, setupFile) || !/^[A-Za-z0-9_.-]+$/.test(setupFile))) throw new Error('The playground input file is missing or has an invalid name.');
  return {
    ...files,
    '__lesson_boot.asm': bootProgram('%include "lesson.asm"', files['data.inc'] === undefined ? '' : '%include "data.inc"', input ? assemblyCaseInitialization(input) : setupFile ? `%include "${setupFile}"` : ''),
    'build.json': JSON.stringify({ type: 'boot-sector', entry: '__lesson_boot.asm' }),
  };
}

export function learnerHasCode(files) {
  return Object.entries(files).some(([path, text]) => !/\.md$/i.test(path) && text.split('\n').some(line => {
    const trimmed = line.trim();
    return trimmed && !trimmed.startsWith(';') && !trimmed.startsWith('//');
  }));
}

export function makeProjectGuide(chapter) {
  const exercise = getCExerciseTests(chapter);
  return {
    kind: 'project', intro: 'Extend the kernel you have written. Add only the files introduced in this chapter.',
    ...(exercise ? { file: exercise.file } : {}),
    initialFiles: { 'README.md': 'Your kernel workspace\n\nStart with the bootloading chapter to build the boot stages and C entry point, one file at a time.\n' },
    steps: [{ sectionId: chapter.legacySectionIds?.at(-1) || chapter.sections[chapter.sections.length - 1].id, title: chapter.challenge.title,
      instructions: exercise ? exercise.instructions : `${chapter.challenge.brief} ${chapter.challenge.tasks.join(' ')}`, runnable: true,
      filesToCreate: exercise ? [exercise.file] : [], referenceFiles: exercise ? { [exercise.file]: exercise.reference } : {},
      ...(exercise ? { tests: exercise.tests, interface: exercise.starter } : {}),
    }],
  };
}
