import { makeProjectGuide } from './guidedBuild';
import { uefi } from './uefi';
import { getCExerciseTests } from './cExerciseTests';
import { uefiProjectFiles } from './uefiProject';

export const guidedUefiBySlug = Object.fromEntries(uefi.map(chapter => {
  const guide = makeProjectGuide(chapter);
  const exercise = getCExerciseTests(chapter);
  return [chapter.slug, {
    ...guide,
    kind: 'uefi',
    intro: 'Write the chapter’s focused C boundary check in Workspace. Run and Submit execute it on x86. Use the UEFI project files and native QEMU commands in the lesson to verify the complete firmware path.',
    initialFiles: { ...uefiProjectFiles, [exercise.file]: exercise.starter },
  }];
}));
