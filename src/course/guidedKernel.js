import { kernelCheckpointTests } from './checkpointTests';
import { kernelProjectFiles } from './kernelProject';

const output = 'C KERNEL READY\n32-bit C running without an OS.\nTwo C files, one header, one linked kernel.';
const references = (...paths) => Object.fromEntries(paths.map(path => [path, kernelProjectFiles[path]]));

// Reference files are deliberately separate from the initial learner project.
// The workspace lets a learner peek at each reference on request;
// selecting a checkpoint must never insert these files into the learner's work.
export const guidedKernel = {
  kind: 'kernel',
  file: 'README.md',
  intro: 'Build the project a file at a time. Begin with your machine contract, then write the boot path before opening C. Submit records your written files at early checkpoints without compiling or validating them. At the linker checkpoint, the connected project becomes runnable and Submit builds, boots, and tests it. Your own files stay in the workspace as you move between lessons.',
  initialFiles: {
    'README.md': '# My first operating-system project\n\nWrite your machine contract here before creating source files.\n\n- Firmware interface and CPU mode at entry:\n- Boot-sector load address and size:\n- Stage-2 disk and memory location:\n- Kernel disk and memory location:\n- Stack location and direction of growth:\n- What a successful first run should demonstrate:\n',
  },
  steps: [
    {
      sectionId: 'contract',
      title: 'State the machine contract before writing instructions',
      instructions: 'Complete README.md in your own words. Draw disk-sector positions separately from physical-memory addresses. Name the BIOS entry mode, the boot-sector size and load address, the two loader responsibilities, and the first observable C result. This is a design checkpoint: no executable exists yet. State the behavior that the later boot should demonstrate.',
      filesToCreate: ['README.md'],
      runnable: false,
      prediction: {
        prompt: 'At which physical address does the BIOS load the first byte of this boot sector? Enter decimal or hex.',
        answer: 0x7c00,
        explanation: 'The reference BIOS path loads the sector at physical 0x7c00. This memory address is different from its disk location, LBA 0.',
      },
      referenceFiles: {
        'README.md': '# Reference machine contract\n\nThe target is a BIOS/EDD PC starting our sector in real mode. LBA 0\nholds a 512-byte boot sector loaded at physical 0x7c00. Stage 1 loads\neight sectors from LBA 1 to 0x8000. Stage 2 loads 32 sectors from\nLBA 9 to 0x10000, establishes flat protected-mode segments, and jumps\nto the kernel entry. The entry establishes ESP=0x70000, clears BSS,\nand calls C. The first run must produce matching VGA and serial text.\nThis result tests the stated emulator contract. Other PCs need separate validation.\n',
      },
    },
    {
      sectionId: 'stage-one',
      title: 'Write the first boot stage',
      instructions: 'Create boot/stage1.asm. Establish a normalized entry, data segments, stack, and direction flag before using them. Preserve the BIOS boot-drive identifier. Write the EDD capability check and a call to the disk routine you will implement next. Name its load constants and the exact far-jump destination. Reserve partition-table bytes and construct a 512-byte sector with the signature. The missing disk routine is an explicit dependency; this checkpoint reviews your source and address calculation. Execution is checked after the disk routine is complete.',
      filesToCreate: ['boot/stage1.asm'],
      runnable: false,
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
      instructions: 'Create boot/disk.inc to satisfy stage 1’s interface. Define the Disk Address Packet, preserve the drive number, restore the sector count before retries, and stop after three failed reads. Make the failure path observable. Explain how LOAD_SECTORS, LOAD_SEGMENT, and LOAD_LBA allow the next stage to reuse this file. Review the packet’s bytes and bounds; the stage-2 and kernel payloads do not exist yet.',
      filesToCreate: ['boot/disk.inc'],
      runnable: false,
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
      instructions: 'Create boot/stage2.asm. Re-establish the real-mode contract, select VGA text mode, and read the kernel slot before leaving firmware. Define the three-entry GDT, mask legacy IRQs, set CR0.PE, and use a far jump to load the code descriptor. Establish flat data selectors and a protected-mode stack, then transfer to 0x10000. Label which statements are assembler directives and which change CPU state. C is still absent; do not mistake assembling this file for proving the transition.',
      filesToCreate: ['boot/stage2.asm'],
      runnable: false,
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
      instructions: 'Create kernel/entry.asm as an ELF32 assembly translation unit. Export _start, import kernel_main and the BSS bounds, establish ESP and the direction flag, clear the entire BSS interval, and call C with the documented stack alignment. Provide a defined halt path if C returns. The C-writing steps begin after this checkpoint because their stack and initialization requirements now have a named owner. You still need a C definition and linker script before this project can boot.',
      filesToCreate: ['kernel/entry.asm'],
      runnable: false,
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
      instructions: 'First create include/vga.h with the screen dimensions and function declarations. Next write kernel/vga.c: construct a VGA cell, clear the screen, and clip writes at a row boundary. Finally create kernel/main.c to call that interface, check initialized data and zeroed BSS, and send the same first message to COM1. Try writing each function from its contract; open its individual reference whenever you need a worked example. Use the three target lines shown in this lesson checkpoint so the later runtime check can compare real output. For each declaration in the header, identify the translation unit that implements it.',
      filesToCreate: ['include/vga.h', 'kernel/vga.c', 'kernel/main.c'],
      runnable: false,
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
      instructions: 'Use Run to explore your assembled and linked files. Record the VGA text and serial line separately. Download kernel.elf and the disk, and identify which artifact retains symbols and which contains the sector layout. Explain why the final stationary screen is a deliberate halt. Introduce one failure at a time: an undefined C symbol, an invalid boot signature, or a changed initialized-data probe. Record which phase reports each failure, then restore the expected three-line output and choose Submit to build, boot, and test this checkpoint automatically.',
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
      instructions: 'Change the message in kernel/main.c and the color attribute in include/vga.h; predict which character and attribute bytes change, then choose Run to rebuild and observe. Remove kernel/vga.c from build.json and explain the unresolved symbols; restore it. Test the data/BSS probes with a deliberately wrong initialization. Keep a short evidence log in README.md. Finally restore the canonical three-line output and choose Submit for the complete build, boot, and runtime checks. The machine tests check the declared first-kernel contract, while your evidence log explains the separate experiments and remaining assumptions. Peek at a reference when you need help, then explain the relevant instruction or C statement before continuing.',
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

for (const step of guidedKernel.steps) {
  if (step.runnable) {
    step.tests = kernelCheckpointTests;
    step.instructions += ` Machine contract: ${kernelCheckpointTests.contract}`;
  }
}
