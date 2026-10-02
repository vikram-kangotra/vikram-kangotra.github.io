import { kernelCheckpointTests } from './checkpointTests';
import { kernelProjectFiles } from './kernelProject';

const output = 'C KERNEL READY\n32-bit C running without an OS.\nTwo C files, one header, one linked kernel.';
const references = (...paths) => Object.fromEntries(paths.map(path => [path, kernelProjectFiles[path]]));

// Reference files are deliberately separate from the initial learner project.
// The workspace lets a learner peek at each reference on request;
// selecting a checkpoint must never insert these files into the learner's work.
export const guidedKernel = {
  kind: 'kernel',
  file: 'boot/stage1.asm',
  intro: 'Build the project a file at a time, starting with the boot path before opening C. Every checkpoint builds a disk, boots it, and tests the running machine. Early checkpoints use your completed files with supplied later dependencies so you can test each addition immediately. Those dependencies are used only for Run and Submit; your saved files stay in the workspace as you move between lessons. At the linker checkpoint, you own every source and build file.',
  initialFiles: {
    'boot/stage1.asm': '; Write your first boot stage here.\n',
  },
  steps: [
    {
      sectionId: 'stage-one',
      title: 'Write the first boot stage',
      instructions: 'Write boot/stage1.asm. Establish a normalized entry, data segments, stack, and direction flag before using them. Preserve the BIOS boot-drive identifier. Check EDD support, then call read_disk with LOAD_SECTORS=8, LOAD_SEGMENT=0x0800, and LOAD_LBA=1 before jumping to 0000:8000. Include disk.inc, reserve partition-table bytes, and construct a 512-byte sector with the signature. Run and Submit supply the shared disk routine, stage 2, C runtime, C code, and build files. Your boot sector must load and transfer to that supplied chain so the machine reaches C and produces the expected output.',
      filesToCreate: ['boot/stage1.asm'],
      runnable: true,
      prediction: {
        prompt: 'Your stage-2 destination is 0800:0000 in real mode. What is its physical address?',
        answer: 0x8000,
        explanation: 'Real-mode segment arithmetic gives 0x0800×16+0=0x8000. The normalized jump 0000:8000 reaches that same physical address.',
      },
      referenceFiles: references('boot/stage1.asm'),
    },
    {
      sectionId: 'disk-read',
      title: 'Implement the shared, bounded disk read',
      instructions: 'Create boot/disk.inc to satisfy stage 1’s interface. Define read_disk, boot_drive, the Disk Address Packet, and an observable fatal path. Preserve the drive number, restore the sector count before retries, and stop after three failed reads. Use LOAD_SECTORS, LOAD_SEGMENT, and LOAD_LBA so both boot stages can include this routine. Run and Submit use your stage 1 and disk routine with the supplied stage-2 and kernel files. The successful read path must load both payloads and reach the expected C output; the runtime contract below describes the behavior checked by these tests.',
      filesToCreate: ['boot/disk.inc'],
      runnable: true,
      prediction: {
        prompt: 'The kernel read requests 32 sectors of 512 bytes each. How many bytes must its destination accommodate?',
        answer: 16384,
        explanation: '32×512=16384 bytes, or 0x4000. Both the destination bounds and the later linked file image must respect that slot.',
      },
      referenceFiles: references('boot/disk.inc'),
    },
    {
      sectionId: 'stage-two',
      title: 'Connect loading to a deliberate mode transition',
      instructions: 'Create boot/stage2.asm. Re-establish the real-mode contract, select VGA text mode, and read the kernel slot before leaving firmware. Define the three-entry GDT, mask legacy IRQs, set CR0.PE, and use a far jump to load the code descriptor. Establish flat data selectors and a protected-mode stack, then transfer to 0x10000. Run and Submit use your complete loader with the supplied C entry, C sources, and build files. The tests must observe protected-mode execution, the expected output, and a safe return from the supplied C function.',
      filesToCreate: ['boot/stage2.asm'],
      runnable: true,
      prediction: {
        prompt: 'Which GDT entry index does selector 0x08 select?',
        answer: 1,
        explanation: 'The index occupies selector bits 3 and above: 0x08>>3=1. Its low three bits describe the table choice and requested privilege.',
      },
      referenceFiles: references('boot/stage2.asm'),
    },
    {
      sectionId: 'c-entry',
      title: 'Write the runtime that makes C possible',
      instructions: 'Create kernel/entry.asm as an ELF32 assembly translation unit. Export _start, import kernel_main and the BSS bounds, establish ESP and the direction flag, clear the entire BSS interval, and call C with the documented stack alignment. Provide a defined halt path after C returns. Run and Submit use your loader and entry stub with supplied C sources, header, linker script, and build manifest. The tests check the output, the return from C, and the resulting stack and CPU state.',
      filesToCreate: ['kernel/entry.asm'],
      runnable: true,
      prediction: {
        prompt: 'ESP is 0x70000 immediately before a 32-bit near CALL with no arguments. What is ESP immediately after that CALL pushes its return address?',
        answer: 0x6fffc,
        explanation: 'A 32-bit near CALL pushes a four-byte return address. With a downward-growing stack, 0x70000−4=0x6fffc.',
      },
      referenceFiles: references('kernel/entry.asm'),
    },
    {
      sectionId: 'kernel',
      title: 'Build the C interface, driver, and caller in that order',
      instructions: 'First create include/vga.h with the screen dimensions and function declarations. Next write kernel/vga.c: construct a VGA cell, clear the screen, and clip writes at a row boundary. Finally create kernel/main.c to call that interface, check initialized data and zeroed BSS, and send the same first message to COM1. Try writing each function from its contract; open its individual reference whenever you need a worked example. Write the three target lines shown below, then return from kernel_main to the assembly entry stub. Run and Submit supply only linker.ld and build.json at this checkpoint; your own loader, entry stub, header, and C files must work together to pass the runtime tests.',
      filesToCreate: ['include/vga.h', 'kernel/vga.c', 'kernel/main.c'],
      runnable: true,
      expectedOutput: output,
      prediction: {
        prompt: 'VGA text memory begins at 0xb8000. With 80 columns and two bytes per cell, what is the address of row 1, column 0?',
        answer: 0xb80a0,
        explanation: 'The cell index is 1×80+0=80. Its byte offset is 160, or 0xa0, so the address is 0xb80a0.',
      },
      referenceFiles: references('include/vga.h', 'kernel/vga.c', 'kernel/main.c'),
    },
    {
      sectionId: 'linker',
      title: 'Describe the build and create the first complete disk',
      instructions: 'Create linker.ld with an entry at 0x10000, separate file-backed sections and NOLOAD BSS, exported BSS bounds, and assertions for the 16-KiB kernel slot and reserved stack region. Then write build.json: type kernel32, two boot stages, the assembly entry and both C sources, the include directory, and your linker-script path. Every source remains your own file. Choose Submit to build, boot, and test the complete project automatically. Use source-line diagnostics to repair the dependency graph, then compare all three VGA lines and COM1. Run is available whenever you want to experiment without submitting. If you have not written an earlier dependency, return to its checkpoint; its reference is available whenever you need help.',
      filesToCreate: ['linker.ld', 'build.json'],
      runnable: true,
      expectedOutput: output,
      prediction: {
        prompt: 'Stage 2 jumps to the kernel’s first instruction. What physical address must the ELF entry point contain?',
        answer: 0x10000,
        explanation: 'The loader transfers directly to 0x10000. The linker entry and executable file-backed bytes must agree with that address; an arbitrary ELF entry cannot change the loader’s jump.',
      },
      referenceFiles: references('linker.ld', 'build.json'),
    },
    {
      sectionId: 'observe',
      title: 'Distinguish a successful build from a successful boot',
      instructions: 'Use Run to inspect the VGA text and serial line from your complete project. Introduce one code failure at a time: an undefined C symbol, an invalid boot signature, or a changed initialized-data probe. Build and run each change to locate its failure phase, then repair the code. Restore the expected three-line output, COM1 first line, and return from kernel_main. Choose Submit to verify the repaired project with the machine tests. You can download kernel.elf to inspect symbols and the disk image to inspect the sector layout.',
      filesToCreate: [],
      runnable: true,
      expectedOutput: output,
      prediction: {
        prompt: 'The uninitialized static bss_probe has no initial bytes stored in the kernel file. What value must the entry stub establish before kernel_main reads it?',
        answer: 0,
        explanation: 'The entry stub zeroes the linked BSS interval before calling C. The entry stub must perform this initialization even when an emulator starts with zeroed memory.',
      },
      referenceFiles: {},
    },
    {
      sectionId: 'experiment',
      title: 'Prove that changing one file changes the running machine',
      instructions: 'Change the message in kernel/main.c and the color attribute in include/vga.h, then choose Run to rebuild and observe the changed character and attribute bytes. Remove kernel/vga.c from build.json, inspect the unresolved-symbol errors, and restore the source path. Change the data/BSS initialization to exercise the runtime probes, then repair it. Finally restore the canonical three-line output and choose Submit for the complete build, boot, and runtime checks. Passing requires your code to satisfy the machine contract below. You may keep personal notes about the experiments; checkpoint completion comes from the executable tests.',
      filesToCreate: [],
      runnable: true,
      expectedOutput: output,
      prediction: {
        prompt: 'A 16-KiB file-backed kernel begins at 0x10000. What is its largest permitted exclusive end address?',
        answer: 0x14000,
        explanation: '16 KiB is 0x4000 bytes, so the exclusive end is 0x10000+0x4000=0x14000. BSS has a separate memory bound because it does not consume initialized disk bytes.',
      },
      referenceFiles: references('kernel/main.c', 'kernel/vga.c', 'include/vga.h', 'build.json'),
    },
  ],
};

const projectPaths = guidedKernel.steps.flatMap(step => step.filesToCreate);
const requiredFiles = [];
for (const step of guidedKernel.steps) {
  requiredFiles.push(...step.filesToCreate);
  const scaffoldPaths = projectPaths.filter(path => !requiredFiles.includes(path));
  step.tests = {
    ...kernelCheckpointTests,
    scope: scaffoldPaths.length
      ? `Builds your ${requiredFiles.join(', ')} with supplied later dependencies: ${scaffoldPaths.join(', ')}. ${kernelCheckpointTests.scope}`
      : kernelCheckpointTests.scope,
    requiredFiles: [...requiredFiles],
    scaffoldFiles: references(...scaffoldPaths),
  };
  step.expectedOutput = output;
  step.instructions += ` Machine contract: ${kernelCheckpointTests.contract}`;
}
