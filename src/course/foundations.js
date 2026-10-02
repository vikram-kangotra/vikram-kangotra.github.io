export const foundations = [
  {
    "id": "01",
    "slug": "bootloading",
    "title": "From power-on to your first C instruction",
    "subtitle": "Build two boot stages, cross the mode boundary, and make a freestanding kernel speak.",
    "phase": "Foundations",
    "minutes": 180,
    "prerequisites": [
      "Comfort reading C functions, pointers, integer types, and loops",
      "A terminal and basic Git, Make, and hexadecimal notation",
      "Complete the x86 Assembly foundation first: registers, memory, flags, loops, and call frames"
    ],
    "outcomes": [
      "Explain the distinct jobs of firmware, partition metadata, boot stages, and the kernel",
      "Build an i686-elf toolchain and inspect the executable it produces",
      "Follow a real-mode address through a protected-mode transition",
      "Assemble, link, boot, debug, and deliberately break a complete C kernel",
      "State the assumptions that make a tiny bootloader safe in its defined emulator environment"
    ],
    "sections": [
      {
        "id": "contract",
        "title": "What we will build, and how to learn it",
        "paragraphs": [
          "Until now, the workspace has done some quiet work for you: it has put your instructions into a bootable program, chosen a stack, and supplied printing helpers. Imagine removing that scaffolding. Your C file is on a disk, but the processor does not know its name, where to load it, or what a C function needs. This chapter follows the chain of small programs that answers those questions. At the end, your own boot stages will reach kernel_main and display text.",
          "We will use a deliberately small PC: one i686-compatible processor, a legacy BIOS boot path, a scratch disk, and 32 MiB of emulated RAM. Stage 1 fits in the first disk sector. It loads stage 2, which has room to load the kernel and enter 32-bit protected mode. A short assembly entry then prepares the environment expected by C. Keep two separate pictures in mind: disk sectors store the program before boot; physical memory addresses describe where it runs afterward. The same bytes occupy different positions in these two pictures.",
          "The main learning path runs here in the browser. Begin with README.md, then build boot/stage1.asm, boot/disk.inc, boot/stage2.asm, kernel/entry.asm, the C source and header files, and finally the linker script and build.json. Each checkpoint names the next part to add. The workspace uses NASM, Clang, and LLD, then runs the resulting x86 machine code in v86. The early files cannot boot independently; those checkpoints ask you to explain and review the part you have built. You get the first complete run when the file dependencies connect.",
          "For this first boot, all code and stack addresses stay below 1 MiB. Paging and hardware interrupts remain off after the mode switch. Those choices let us learn one mechanism at a time; the next chapters add fault handlers and memory discovery. The optional terminal route uses i686-elf tools and QEMU to build the same kind of machine from a separate reference bundle. You do not need to install that toolchain to complete the browser checkpoints. In your README, describe each program's job in your own words before writing its instructions."
        ],
        "callout": {
          "title": "Build one piece, then explain what it prepares",
          "text": "Start with your notes and add each file when its lesson introduces it. The checkpoint tells you what to write and what result to expect. Early stages are reviewed while the project is incomplete; the first full run comes when the source files and linker are connected. Use a hint or Peek whenever you need help, then return to your own version and explain why it works."
        },
        "teaching": {
          "goal": "Explain how the files you will write take a PC from its boot sector to a C function.",
          "bridge": "Your assembly routines have run inside a supplied machine setup. You will now build that setup yourself.",
          "check": {
            "prompt": "Suppose the disk contains a valid C kernel but stage 1 never loads stage 2. Which program can still execute, and why can the C code not fix the problem?",
            "answer": "Firmware can load and enter stage 1. Stage 2 and the kernel remain bytes on disk, so the CPU never fetches their instructions. Recovery must happen in the code that is already running, or by correcting the image and booting again."
          },
          "takeaway": "Booting is a sequence of handoffs: each running stage prepares and locates the next one.",
          "diagramAfter": 2
        }
      },
      {
        "id": "cpu",
        "title": "Instructions need an environment",
        "paragraphs": [
          "The CPU can execute an instruction only after interpreting its bytes in an execution mode. That mode affects instruction sizes, address calculation, and permission checks. A source line such as mov ax, 7 describes an intended operation; the assembler chooses bytes, and the processor interprets those bytes using its current state. Changing the source directive to bits 32 changes the assembler's output. It does not change the running processor's mode. The bootloader must make the two agree.",
          "Our BIOS boot begins in real mode. An ordinary segment:offset address is calculated as segment × 16 + offset. For example, 1200:0030 names physical address 0x12030 when the address is not affected by A20 wrapping. Many pairs can name the same place: 0000:7C00 and 07C0:0000 both locate the boot sector. A far jump sets both CS and the instruction offset, giving our code one predictable representation. We also set DS for data accesses, ES for destinations, and SS:SP for the stack. CLD clears the direction flag so string operations move toward increasing addresses.",
          "In protected mode a segment register instead holds a selector. The selector identifies a table entry describing the segment's base, limit, and permissions. We choose a flat layout: a base of zero and a range covering the 32-bit address space. An offset then has the same numerical value as its linear address. This flat segmentation setup provides convenient addresses. Program isolation requires additional protection and paging work. Setting CR0.PE changes mode; the following far jump loads the protected-mode code descriptor into CS, and explicit register loads establish the data segments.",
          "Long mode is a further transition for 64-bit kernels. It needs suitable CPU features and paging tables as well as control-register and model-specific-register changes. We will reach it later, after paging makes sense. For now, annotate each bootloader jump with two facts: the address it targets and the mode in which the target bytes must be decoded. This simple habit catches many failures that otherwise look like random instructions."
        ],
        "teaching": {
          "goal": "Calculate a real-mode address and explain what changes when the CPU enters protected mode.",
          "bridge": "We know the stages of the journey. Now we need to understand the machine state each stage inherits.",
          "check": {
            "prompt": "Calculate the address named by 1500:0024. Would writing bits 32 above the target label make a real-mode CPU execute it as protected-mode code?",
            "answer": "0x1500 × 16 + 0x24 = 0x15024. The bits directive controls emitted instruction encoding; processor state changes through runtime instructions. The loader must install descriptors and perform the architectural mode transition before entering code assembled for that environment."
          },
          "takeaway": "An instruction is meaningful only when its encoding, addressing environment, and CPU mode agree.",
          "diagramAfter": 2
        }
      },
      {
        "id": "firmware",
        "title": "BIOS, UEFI, MBR, and GPT are different layers",
        "paragraphs": [
          "Firmware is software supplied by the platform that runs before your kernel. In our legacy BIOS path it loads a boot sector at physical 0x7C00 and transfers control, placing the boot drive identifier in DL. While the loader remains in the appropriate real-mode environment, BIOS interrupt services can read disk sectors and display characters. This saves us from writing a disk-controller driver before we have even loaded the kernel. Stage 1 checks for the extended disk-read service it intends to use.",
          "UEFI offers a different starting point. It loads a PE/COFF application and exposes callable services for devices, memory allocation, and graphics. An x64 UEFI application therefore has a different file format and entry environment from our 512-byte sector. A UEFI loader eventually obtains a current memory map and uses its map key with ExitBootServices. That handoff matters because firmware allocations can change the map. We will replace the firmware-facing boot path when we study UEFI; you do not need to mix UEFI calls into this BIOS exercise.",
          "MBR and GPT answer another question: how is a disk divided into partitions? An MBR conventionally includes boot code, four partition entries, and a signature. GPT uses a protective MBR together with primary and backup partition metadata. These structures do not select a CPU mode. In particular, GPT's primary header occupies LBA 1, so a loader cannot casually store its next stage there on a GPT disk. Our image is a scratch format without partitions; its conventional MBR partition-entry bytes are reserved as zero.",
          "For this course image, LBA means a sector number starting at zero, and each sector is 512 bytes. Sector 0 holds stage 1; sectors 1 through 8 hold stage 2; sectors 9 through 40 form the kernel's 16 KiB slot. The image builder and loader must use the same numbers. Draw these ranges before you read the disk routine. The final bytes 55 AA make a boot signature; they do not tell BIOS where a C function is or prove that the rest of the sector is correct."
        ],
        "teaching": {
          "goal": "Separate the firmware boot interface from the disk partition format and trace our fixed disk layout.",
          "bridge": "The processor needs an initial program. Firmware supplies that first handoff, while disk metadata solves a different problem.",
          "check": {
            "prompt": "A loader says its kernel begins at LBA 12 on a disk with 512-byte sectors. What byte offset does the image builder use? Does the boot signature encode that offset?",
            "answer": "The file offset is 12 × 512 = 6144 bytes. The signature does not contain the location. The loader and image builder must share that layout through constants or a defined metadata format."
          },
          "takeaway": "Firmware chooses how execution starts; partition metadata and loader layout describe how disk bytes are organized.",
          "diagramAfter": 2
        }
      },
      {
        "id": "tools",
        "title": "Host tools versus target tools",
        "paragraphs": [
          "Your host is the computer running your editor and build tools. The target is the machine whose instructions and calling conventions the tools produce. They may both use x86, but that does not make their environments interchangeable: a Linux executable expects services that your kernel has not created. A cross-compiler explicitly targets a different environment. The optional native route uses i686-elf tools to produce 32-bit x86 code without assuming a Linux userspace runtime.",
          "Follow one C function through the browser build. Clang compiles it into an object file containing instructions and references to symbols such as vga_write. NASM produces another object for the assembly entry. LLD, the linker, joins those objects, resolves symbol references, and assigns addresses using linker.ld. The image builder places the boot-stage binaries and raw kernel bytes into disk sectors. Finally v86 emulates the machine that fetches those bytes. No single tool performs all these jobs, which is why an error's stage is an important clue.",
          "The commands below are for the optional native route on a Debian-family host. There, NASM still assembles the boot stages, GCC compiles C, GNU binutils links and inspects files, and QEMU system emulation provides the PC. QEMU user-mode emulation serves a different purpose and cannot replace a whole booting machine. If you stay in the browser, use this as a guide to the role of each tool.",
          "When building native tools, first install the host compiler and the mathematical libraries needed to build GCC. Then build target binutils before target GCC. A freestanding C compiler does not supply a normal libc, though it may need compiler-support routines from libgcc. Keep the toolchain in a user-owned directory and record its versions. You will find debugging much easier when you can say which tool produced each artifact."
        ],
        "code": {
          "language": "sh",
          "filename": "host-prerequisites.sh",
          "source": "# Debian / Ubuntu host prerequisites; adapt package names elsewhere.\nsudo apt-get update\nsudo apt-get install build-essential bison flex libgmp-dev libmpfr-dev   libmpc-dev texinfo nasm qemu-system-x86 python3 xz-utils gdb\n\n# Inspect existing target tools before building another copy.\ni686-elf-gcc -dumpmachine\ni686-elf-gcc --version\nnasm -v\nqemu-system-i386 --version\n"
        },
        "teaching": {
          "goal": "Identify the role of the assembler, compiler, linker, image builder, and machine emulator.",
          "bridge": "We have separated disk from memory. We must also separate the computer building the kernel from the computer running it.",
          "check": {
            "prompt": "Your source compiles, but the build reports an undefined reference to console_write. Which stage discovered the problem, and what does that tell you?",
            "answer": "The linker discovered that no linked object supplies the requested symbol. The compiler could translate the caller using a declaration, but completing the executable requires the definition with matching linkage and the correct object in the build."
          },
          "takeaway": "Compilation creates pieces; linking connects them; the image builder and emulator turn them into a boot experiment.",
          "diagramAfter": 2
        }
      },
      {
        "id": "cross-build",
        "title": "Build a minimal cross-toolchain",
        "paragraphs": [
          "A toolchain build has two different kinds of output: programs that run on your host and machine code those programs will later produce for your target. The commands below install host-running programs named i686-elf-gcc and i686-elf-ld. Their target name describes the output environment. Keeping that name explicit prevents the shell from silently selecting a host compiler with Linux or macOS defaults.",
          "Use verified GNU source releases, placing their extracted trees in the two source directories named by the script. Configuration examines your host and creates build instructions; make then compiles the tools, and make install copies them into the chosen prefix. Binutils goes first because GCC needs the target assembler and linker. The separate build directories hold generated files without changing the original source trees. If configuration cannot find a prerequisite, fix that host dependency before proceeding; adding host libraries to kernel link paths solves a different problem.",
          "After installation, ask the compiler to identify itself with -dumpmachine. Then compile a tiny source file and inspect the object with i686-elf-readelf -h. ELF32 tells you the object class, and Intel 80386 identifies the x86 architecture family; it does not mean the compiler ignored an i686 instruction-selection option. This is a useful lesson in verification: inspect the output as well as the tool's name. Browser learners can carry the same habit into the Build and Bytes panels without doing this installation."
        ],
        "code": {
          "language": "sh",
          "filename": "build-toolchain.sh",
          "source": "set -eu\nexport OS_PREFIX=\"$HOME/opt/cross\"\nexport OS_TARGET=i686-elf\nexport PATH=\"$OS_PREFIX/bin:$PATH\"\nOS_SRC=\"$HOME/os-toolchain/src\"\nOS_BUILD=\"$HOME/os-toolchain/build\"\nmkdir -p \"$OS_BUILD/binutils\" \"$OS_BUILD/gcc\"\ncd \"$OS_BUILD/binutils\"\n\"$OS_SRC/binutils/configure\" --target=\"$OS_TARGET\"   --prefix=\"$OS_PREFIX\" --with-sysroot --disable-nls --disable-werror\nmake -j2\nmake install\ncd \"$OS_BUILD/gcc\"\n\"$OS_SRC/gcc/configure\" --target=\"$OS_TARGET\"   --prefix=\"$OS_PREFIX\" --disable-nls --enable-languages=c --without-headers\nmake -j2 all-gcc all-target-libgcc\nmake install-gcc install-target-libgcc\n\"$OS_PREFIX/bin/i686-elf-gcc\" -dumpmachine\n# Add $HOME/opt/cross/bin to PATH in your normal shell configuration.\n"
        },
        "teaching": {
          "goal": "Understand the native cross-toolchain build and verify that it produces the intended target format.",
          "bridge": "The browser already supplies its tools. This optional section makes the equivalent native toolchain reproducible.",
          "check": {
            "prompt": "A compiler accepts -m32 but -dumpmachine still reports x86_64-linux-gnu. What has -m32 established, and what has it not established?",
            "answer": "It requests a 32-bit code-generation mode for that invocation. It does not change the toolchain into a bare-metal i686-elf environment or remove all hosted defaults. A deliberately configured cross-toolchain makes that environment choice explicit."
          },
          "takeaway": "Verify the target identity and the produced object format before trusting a native toolchain.",
          "diagramAfter": 2
        }
      },
      {
        "id": "stage-one",
        "title": "Stage 1: prepare the machine and load the next stage",
        "paragraphs": [
          "Create boot/stage1.asm in the browser project. This file has one job: prepare a small real-mode environment, load stage 2, and jump to it. It does not need to understand C, page tables, or filesystems. Begin by locating the first far jump. It sets a known CS:IP representation for the code loaded at 0x7C00, so the labels assembled with that origin and the segment values we choose agree.",
          "Next trace the stack setup. CLI disables maskable interrupts while we change SS and SP; SS=0 and SP=0x7C00 place the initial stack immediately below the boot sector, growing toward lower addresses as values are pushed. Setting DS and ES to zero makes ordinary data labels refer to the expected physical locations. CLD gives later string instructions a forward direction. We save DL because it identifies the disk that booted us, and a later firmware call should not force us to guess that disk again. STI restores maskable interrupts while we use the real-mode BIOS environment.",
          "The extended-disk-service probe is a conversation with BIOS: AH selects the operation and BX contains the required request marker. On return, the carry flag, returned marker, and capability bit tell us whether the service is available. Checking all of them means the next read has an established interface. The actual read loads eight sectors from LBA 1 into 0800:0000, which is physical 0x8000. A far jump then begins executing stage 2 there.",
          "Before opening the answer, label your draft in three groups: setup, service check, and handoff. The disk helper will be added next, so this checkpoint reviews an incomplete stage instead of claiming it can already run. Notice the padding expression at the end of the reference: if the code grows beyond its reserved area, NASM reports an error. The size limit is part of the design, just as the jump destination is."
        ],
        "code": {
          "language": "asm",
          "filename": "stage1.asm",
          "source": "bits 16\norg 0x7c00\n\njmp 0x0000:start\nstart:\n    cli\n    xor ax, ax\n    mov ds, ax\n    mov es, ax\n    mov ss, ax\n    mov sp, 0x7c00\n    cld\n    mov [boot_drive], dl\n    sti\n\n    ; BIOS Enhanced Disk Drive services are mandatory for this lab.\n    mov ah, 0x41\n    mov bx, 0x55aa\n    push ds\n    int 0x13\n    pop ds\n    jc fatal\n    cmp bx, 0xaa55\n    jne fatal\n    test cx, 1\n    jz fatal\n    call read_disk\n    jc fatal\n    mov dl, [boot_drive]\n    jmp 0x0000:0x8000\n\n%define LOAD_SECTORS 8\n%define LOAD_SEGMENT 0x0800\n%define LOAD_LBA 1\n%include \"disk.inc\"\n\n; Reserve the conventional partition-table area. No partitions here.\ntimes 446-($-$$) db 0\ntimes 64 db 0\ndw 0xaa55\n"
        },
        "teaching": {
          "goal": "Build the first boot stage and explain every setup operation before its disk read.",
          "bridge": "The tools can now produce boot bytes. Stage 1 must make those bytes run with known registers and a usable stack.",
          "check": {
            "prompt": "With SS=0 and SP=0x7800, where does a 16-bit PUSH place its word, and why must that memory remain separate from the instructions we are about to execute?",
            "answer": "PUSH first reduces SP to 0x77FE and stores the word at physical 0x77FE. If the stack overlaps live code, a call or saved register can replace instruction bytes. A valid stack address is therefore both writable and reserved for stack use."
          },
          "takeaway": "Stage 1 succeeds by establishing a few known values, checking its disk service, and handing off to a precisely loaded stage 2.",
          "diagramAfter": 2
        }
      },
      {
        "id": "disk-read",
        "title": "A bounded firmware disk request",
        "paragraphs": [
          "Create boot/disk.inc. NASM inserts an include file’s source text while assembling a stage, incorporating its instructions into that stage’s binary. Both boot stages can reuse the same disk routine while supplying different LOAD_SECTORS, LOAD_SEGMENT, and LOAD_LBA constants. This keeps the read mechanism in one place while leaving each caller responsible for choosing a destination that will not overwrite its own code or stack.",
          "The Disk Address Packet is a small record in memory. It contains a size field, the number of sectors, a destination segment:offset, and a 64-bit starting LBA. BIOS receives a pointer to this record and reads the request fields from memory. Work through a sample request: four 512-byte sectors occupy 2048 bytes, so loading them at 0x9000 uses the half-open range [0x9000, 0x9800). Writing ranges this way makes the last byte and the first byte after a transfer unambiguous.",
          "Firmware reports success or failure through the carry flag. On failure our routine resets the disk, restores the requested sector count, and retries, allowing three attempts in total. Restoring the count matters because firmware may modify the packet. If all attempts fail, the caller prints E and stops; jumping to the destination anyway would treat unknown memory as instructions. This is an early example of a general kernel pattern: check the result before publishing or using the resource you requested.",
          "Trace one successful read and one read that fails twice before succeeding. Keep the retry counter separate from the sector count in your notes. This helper deliberately performs one fixed, bounded transfer; partition discovery, filesystem paths, and larger split transfers belong to later loaders. For this checkpoint, a clearly explained source range, destination range, and error path are the parts you are learning to build."
        ],
        "code": {
          "language": "asm",
          "filename": "disk.inc",
          "source": "; Included by each stage. DS=0; boot_drive contains the BIOS drive.\n; LOAD_* constants define one fixed, bounded EDD transfer.\nread_disk:\n    mov byte [attempts], 3\n.retry:\n    mov word [dap_count], LOAD_SECTORS\n    mov si, dap\n    mov dl, [boot_drive]\n    mov ah, 0x42\n    push ds\n    int 0x13\n    pop ds\n    jnc .done\n    xor ah, ah\n    mov dl, [boot_drive]\n    push ds\n    int 0x13\n    pop ds\n    dec byte [attempts]\n    jnz .retry\n    stc\n.done:\n    ret\n\nfatal:\n    mov al, 'E'\n    out 0xe9, al\n    mov ah, 0x0e\n    mov bx, 0x0007\n    int 0x10\n    cli\n.halt:\n    hlt\n    jmp .halt\n\nboot_drive: db 0\nattempts: db 0\nalign 4, db 0\ndap:\n    db 0x10, 0\ndap_count:\n    dw LOAD_SECTORS\n    dw 0\n    dw LOAD_SEGMENT\n    dq LOAD_LBA\n"
        },
        "teaching": {
          "goal": "Describe a BIOS disk request as source sectors, a destination range, and a checked result.",
          "bridge": "Stage 1 knows what it wants to load. The shared disk helper now turns that intention into a firmware request.",
          "check": {
            "prompt": "A request loads five sectors at physical 0xA000. Write its half-open destination range. If carry is set after the final attempt, should the caller jump there?",
            "answer": "Five sectors occupy 0xA00 bytes, so the range is [0xA000, 0xAA00). Carry indicates the requested read did not succeed. The caller must take the failure path because the destination is not established as valid executable code."
          },
          "takeaway": "A disk read is complete only when the requested bytes fit the destination and firmware reports success.",
          "diagramAfter": 2
        }
      },
      {
        "id": "stage-two",
        "title": "Stage 2: leave firmware with a known machine state",
        "paragraphs": [
          "Create boot/stage2.asm. Its first instructions re-establish segments, stack, direction, and the saved boot drive, much as stage 1 did. This makes its entry conditions easy to understand without depending on incidental register values left by the earlier stage. While BIOS services remain available, it selects 80×25 VGA text mode and loads the kernel's 32-sector slot at physical 0x10000. After leaving the BIOS environment, our kernel will write the display itself.",
          "Protected mode needs a Global Descriptor Table, or GDT: an array describing the segments the CPU may use. Our first entry is unused, the second describes executable kernel code, and the third describes writable kernel data. Each entry occupies eight bytes, so selectors 0x08 and 0x10 identify entries one and two. A base of zero and an effective limit of 0xFFFFFFFF give both useful segments a flat 4 GiB address range. Use the diagram to connect each selector to its actual table entry before trying to memorize the encoded constants.",
          "LGDT loads the address and size of the table. It does not automatically reload CS, DS, or SS. We set the PE bit in CR0, then perform a far jump using the code selector; that jump loads the new code-segment state. At the target, instructions assembled with bits 32 load the data selector into the remaining segment registers and establish ESP. Only then does the loader jump to the kernel entry at 0x10000. The order matters because each instruction is preparing the environment expected by the next one.",
          "We keep IF clear and mask the legacy interrupt controllers during this first transition because protected-mode handlers have not been installed yet. Exceptions and NMIs are not removed by that choice; the next chapter gives faults a reporting path. We also keep every used address below 1 MiB, so this milestone does not require enabling A20. In your draft, mark the last BIOS call, the instruction that changes mode, and the instruction that loads the new CS. Those three boundaries tell the story of stage 2."
        ],
        "code": {
          "language": "asm",
          "filename": "stage2.asm",
          "source": "bits 16\norg 0x8000\n\nstart:\n    cli\n    xor ax, ax\n    mov ds, ax\n    mov es, ax\n    mov ss, ax\n    mov sp, 0x7c00\n    cld\n    mov [boot_drive], dl\n    sti\n\n    ; Explicitly establish 80x25 color text mode before leaving BIOS.\n    mov ax, 0x0003\n    push ds\n    int 0x10\n    pop ds\n    call read_disk\n    jc fatal\n\n    ; Mask legacy IRQ sources and keep IF clear until Module 2's IDT.\n    cli\n    mov al, 0xff\n    out 0x21, al\n    out 0xa1, al\n    lgdt [gdtr]\n    mov eax, cr0\n    or eax, 1\n    mov cr0, eax\n    jmp 0x08:protected_entry\n\n%define LOAD_SECTORS 32\n%define LOAD_SEGMENT 0x1000\n%define LOAD_LBA 9\n%include \"disk.inc\"\n\nalign 8, db 0\ngdt:\n    dq 0x0000000000000000  ; Null descriptor.\n    dq 0x00cf9a000000ffff  ; Ring-0, base 0, 4 GiB, 32-bit code.\n    dq 0x00cf92000000ffff  ; Ring-0, base 0, 4 GiB, writable data.\ngdt_end:\ngdtr:\n    dw gdt_end-gdt-1\n    dd gdt\n\nbits 32\nprotected_entry:\n    mov ax, 0x10\n    mov ds, ax\n    mov es, ax\n    mov fs, ax\n    mov gs, ax\n    mov ss, ax\n    mov esp, 0x70000\n    cld\n    mov eax, 0x10000\n    jmp eax\n\ntimes 4096-($-$$) db 0\n"
        },
        "teaching": {
          "goal": "Explain the ordered steps that load the kernel and enter 32-bit protected mode.",
          "bridge": "Stage 1 can now load a larger program. Stage 2 uses that space to prepare the environment that C will need.",
          "check": {
            "prompt": "A GDT has its code descriptor at entry 3. With a GDT selector using ring 0 and TI=0, what selector identifies it? Would LGDT alone switch execution to that code segment?",
            "answer": "The selector is 3 × 8 = 0x18. LGDT loads the table register. Loading the active code-segment descriptor requires the following control transfer. A suitable control transfer is needed to load CS after the required mode setup."
          },
          "takeaway": "The mode transition is an ordered handoff: tables, control bit, far jump, data segments, stack, and kernel entry.",
          "diagramAfter": 2
        }
      },
      {
        "id": "c-entry",
        "title": "C starts only after its assumptions are true",
        "paragraphs": [
          "Create kernel/entry.asm. A compiler can turn a C function into instructions, but it assumes some work has happened before the call. The application binary interface, or ABI, describes agreements such as stack alignment, argument locations, and which registers a function preserves. Our entry stub is the small bridge between the bootloader's jump and an ordinary C call. It establishes ESP, clears the direction flag, and sets EBP to zero to provide a useful end marker when inspecting an early call chain.",
          "Next distinguish initialized storage from zero-initialized storage. A declaration with a nonzero initial value needs those initial bytes in the image, usually in .data. Static storage that starts at zero normally occupies .bss: the linker reserves an address range, but the raw image need not contain a disk byte for every zero. The entry stub walks from __bss_start up to, but not including, __bss_end and writes zeros. The linker supplies those symbols, so entry.asm and linker.ld cooperate to make C's initialization rules true.",
          "The CALL instruction then pushes a return address and enters kernel_main. In the browser project, kernel_main must finish its initialization and return to the assembly entry stub. That return is part of the checkpoint: it lets the machine test observe that C was actually called and came back. The assembly code then owns the CLI; HLT loop. The optional native reference may halt inside its C function instead; follow the browser checkpoint's return behavior when building in this workspace.",
          "Before writing the final call, draw the stack immediately before and after it. Ask where the return address will be stored and whether the ABI's alignment rule holds at the call boundary. Then explain why a working print statement alone would not prove that .bss was cleared: an emulator may happen to start that memory at zero. We will use deliberate changes later to separate a correct initialization routine from a fortunate starting state."
        ],
        "code": {
          "language": "asm",
          "filename": "entry.asm",
          "source": "bits 32\nsection .text.entry\nglobal _start\nextern kernel_main\nextern __bss_start\nextern __bss_end\n\n_start:\n    cli\n    cld\n    mov esp, 0x70000\n    xor ebp, ebp\n    xor eax, eax\n    mov edi, __bss_start\n    mov ecx, __bss_end\n    sub ecx, edi\n    rep stosb\n    ; ESP is 16-byte aligned immediately before CALL (i386 SysV ABI).\n    call kernel_main\n.halt:\n    cli\n    hlt\n    jmp .halt\n\nsection .note.GNU-stack noalloc noexec nowrite progbits\n"
        },
        "teaching": {
          "goal": "Explain the assembly work required before calling a freestanding C function.",
          "bridge": "The kernel bytes are loaded and the CPU is in 32-bit mode. C still needs a calling environment.",
          "check": {
            "prompt": "The linker reserves .bss from 0x18020 to 0x18070. How many bytes must the entry stub clear, and should it write address 0x18070?",
            "answer": "The length is 0x50, or 80 bytes. The interval is half-open, so 0x18070 is the first byte after .bss and must not be included. The last cleared byte is 0x1806F."
          },
          "takeaway": "A freestanding C function begins after assembly establishes its stack, ABI conditions, and static-storage initialization.",
          "diagramAfter": 2
        }
      },
      {
        "id": "kernel",
        "title": "Your first driver is a controlled side effect",
        "paragraphs": [
          "A normal C program prints by asking its environment for an output service. Our kernel has no such service yet, so it must talk to the emulated hardware. In VGA text mode, memory at 0xB8000 describes the screen as cells. Each cell is two bytes: a character and an attribute specifying colors. Writing one 16-bit value therefore changes one visible position. This is memory-mapped I/O: a memory address has device behavior associated with it.",
          "In the browser project, create include/vga.h to declare the output interface, kernel/vga.c to implement it, and kernel/main.c to use it. The header lets the compiler check the call without copying the implementation into every file. Think of main.c as the client of a tiny driver. It chooses the message; the driver knows how character positions become VGA addresses. Read the checkpoint for the exact required output and function declarations, then implement one responsibility at a time.",
          "The volatile pointer used for VGA tells the compiler that these writes are observable and must not simply disappear as unused stores. It does not turn a sequence of writes into a lock or provide inter-CPU synchronization. Serial output offers a second observation path: the UART exposes port registers, and polling its status tells us when it can accept a byte. A bounded poll avoids waiting forever if the expected device never becomes ready. The native reference also checks one initialized and one zero-initialized variable before selecting its message.",
          "The larger native kernel.c shown as a reference keeps those pieces in one file and ends with a halt loop. Your browser checkpoint uses several files and returns from kernel_main to the assembly halt loop. Preserve that difference. Start by calculating one cell address and one character/attribute word yourself; then trace how a loop advances from one cell to the next. You are building a driver when you turn a hardware representation into a small, reusable software interface."
        ],
        "code": {
          "language": "c",
          "filename": "kernel.c",
          "source": "#include <stddef.h>\n#include <stdint.h>\n\nstatic volatile uint32_t bss_probe;\nstatic volatile uint32_t data_probe = 0x12345678;\n\nstatic inline void outb(uint16_t port, uint8_t value) {\n    __asm__ volatile (\"outb %0, %1\" : : \"a\"(value), \"Nd\"(port));\n}\n\nstatic inline uint8_t inb(uint16_t port) {\n    uint8_t value;\n    __asm__ volatile (\"inb %1, %0\" : \"=a\"(value) : \"Nd\"(port));\n    return value;\n}\n\nstatic void serial_init(void) {\n    outb(0x3f9, 0x00);             /* Disable UART interrupts. */\n    outb(0x3fb, 0x80);             /* Enable divisor latch. */\n    outb(0x3f8, 0x03);             /* 38400 baud. */\n    outb(0x3f9, 0x00);\n    outb(0x3fb, 0x03);             /* 8 bits, no parity, 1 stop bit. */\n    outb(0x3fa, 0xc7);             /* Enable and clear FIFOs. */\n    outb(0x3fc, 0x03);             /* Assert DTR and RTS. */\n}\n\nstatic void serial_putc(char ch) {\n    for (uint32_t tries = 0; tries < 100000; ++tries) {\n        if (inb(0x3fd) & 0x20) {\n            outb(0x3f8, (uint8_t)ch);\n            return;\n        }\n    }\n    /* A missing UART must not hang the kernel. */\n}\n\nvoid kernel_main(void) {\n    volatile uint16_t *const vga = (volatile uint16_t *)0xb8000;\n    const char *message = \"Module 1: protected-mode C kernel OK\";\n    serial_init();\n    if (bss_probe != 0 || data_probe != 0x12345678)\n        message = \"FAIL: C runtime initialization\";\n    for (size_t i = 0; i < 80 * 25; ++i)\n        vga[i] = 0x0720;\n    for (size_t i = 0; message[i] != '\\0'; ++i) {\n        vga[i] = (uint16_t)(0x0f00 | (uint8_t)message[i]);\n        serial_putc(message[i]);\n    }\n    serial_putc('\\r');\n    serial_putc('\\n');\n    for (;;)\n        __asm__ volatile (\"cli; hlt\");\n}\n"
        },
        "teaching": {
          "goal": "Connect a C device write to visible output and divide the browser kernel into a header and source files.",
          "bridge": "The entry stub can call C. We can now give that C code one concrete job: show that it ran.",
          "check": {
            "prompt": "A text cell uses character byte 0x41 and attribute byte 0x1E. What 16-bit value describes the cell on this little-endian machine, and how far apart are adjacent cell addresses?",
            "answer": "The word is 0x1E41: the low byte supplies the character and the high byte supplies the attribute. Each cell occupies two bytes, so the next cell is two addresses later."
          },
          "takeaway": "The kernel chooses what to display; a driver translates that choice into the device’s byte layout.",
          "diagramAfter": 2
        }
      },
      {
        "id": "linker",
        "title": "Place the kernel where the loader expects it",
        "paragraphs": [
          "Imagine the loader places your kernel at 0x10000 but its instructions were linked as though they lived at 0x20000. Some relative branches might still appear to work, while an absolute reference to a string reads the wrong memory. The linker script prevents this disagreement by describing the kernel's memory layout. Its location counter begins at the address where stage 2 loads and enters the raw kernel, and it keeps the entry section first.",
          "Sections collect related bytes. .text contains executable instructions, .rodata holds read-only constants such as message strings, and .data holds initialized writable storage. .bss reserves space for zero-initialized storage and supplies the boundary symbols used by entry.asm. Alignment directives leave appropriate gaps between these regions. Walk down the script as if you were laying blocks along an address ruler, tracking which blocks contribute file bytes and which reserve memory only.",
          "The script's assertions make mistakes visible at build time. The entry must remain at the loader's jump address. File-backed sections must fit the 32-sector kernel slot. The reserved .bss interval must stay below the stack region. These limits connect the loader, linker, and runtime; changing one side requires reviewing the others. In the browser, create linker.ld and the build.json manifest named by the checkpoint so the workspace knows which sources to assemble and link. This completes the dependency chain required for the first boot.",
          "Keep the ELF artifact as well as kernel.bin. ELF retains symbols and metadata useful for debugging; the raw binary is the sequence our simple loader actually copies and executes. This bootloader does not parse ELF headers. Later you will build an ELF loader that does, but replacing kernel.bin with kernel.elf now would make the CPU try to execute file-format metadata. Before running, match the load address, entry symbol, and image slot on one drawing."
        ],
        "code": {
          "language": "text",
          "filename": "linker.ld",
          "source": "OUTPUT_FORMAT(elf32-i386)\nOUTPUT_ARCH(i386)\nENTRY(_start)\n\nPHDRS {\n    text PT_LOAD FLAGS(5);\n    data PT_LOAD FLAGS(6);\n}\n\nSECTIONS {\n    . = 0x10000;\n    .text : { KEEP(*(.text.entry)) *(.text .text.*) } :text\n    .rodata ALIGN(16) : { *(.rodata .rodata.*) } :text\n    .data ALIGN(16) : { *(.data .data.*) } :data\n    __file_end = .;\n    .bss ALIGN(16) (NOLOAD) : {\n        __bss_start = .;\n        *(.bss .bss.*) *(COMMON)\n        __bss_end = .;\n    } :data\n    /DISCARD/ : { *(.comment) *(.note*) *(.eh_frame*) }\n    ASSERT(_start == 0x10000, \"kernel entry moved\")\n    ASSERT(__file_end <= 0x14000, \"kernel exceeds 32-sector slot\")\n    ASSERT(__bss_end <= 0x60000, \"kernel overlaps reserved stack region\")\n}\n"
        },
        "teaching": {
          "goal": "Explain how a linker script makes the kernel addresses agree with the bootloader.",
          "bridge": "Your assembly entry and C files now exist separately. Linking gives their symbols concrete addresses and connects their calls.",
          "check": {
            "prompt": "A raw kernel begins at 0x20000 and its file-backed content is 0x2800 bytes long. What is the first address after that content? Why might .bss extend farther without increasing the raw file by the same amount?",
            "answer": "The end is 0x22800. .bss reserves memory that startup code clears, so its zeros need not be stored as a corresponding payload in the raw file. Runtime memory use can therefore exceed file size."
          },
          "takeaway": "Link addresses are part of the boot protocol: the loader, entry code, and linker must agree.",
          "diagramAfter": 2
        }
      },
      {
        "id": "make",
        "title": "One build graph, several useful artifacts",
        "paragraphs": [
          "A build is a graph of dependencies. Editing a C file requires recompiling that translation unit, relinking the kernel, converting the result to raw bytes, and rebuilding the disk image. It does not require rewriting the unchanged stage-1 source. The browser's build.json names the sources and layout for its NASM/Clang/LLD pipeline. The optional Makefile below expresses a comparable graph for the native i686-elf and QEMU route. You do not need to translate this Makefile into the browser editor.",
          "Read compiler options in terms of the environment they promise. -ffreestanding says the program runs outside a hosted C environment; it does not create an entry stub or provide every helper a compiler might emit. Position-independent defaults and stack-protector support are disabled in this initial kernel because their supporting runtime has not been built. Floating-point and SIMD code are kept out until the kernel can preserve their processor state. These choices support the requirements of this small execution environment.",
          "Now follow kernel.o into kernel.elf and then kernel.bin. The ELF file carries addresses, sections, and symbols. The binary carries the bytes the fixed loader understands. kernel.map records where linked pieces landed, while os.img includes both boot stages and the kernel in their sector slots. Retaining the ELF and map means a numerical crash address can lead you back to a symbol or source line while preserving the disk image for booting.",
          "If the linker reports an unresolved helper, use that report as a question: which operation caused the compiler to require a runtime function? Supply the appropriate target implementation or adjust the code intentionally. A host libc expects an operating system that your kernel has not provided. To practice reading the graph, choose one header and list the object files whose behavior can depend on it, then compare your prediction with the build output after an edit."
        ],
        "code": {
          "language": "text",
          "filename": "Makefile",
          "source": ".DEFAULT_GOAL := all\nCROSS ?= i686-elf-\nCC := $(CROSS)gcc\nLD := $(CROSS)ld\nOBJCOPY := $(CROSS)objcopy\nNASM ?= nasm\nQEMU ?= qemu-system-i386\nBUILD ?= build\n\nCFLAGS := -m32 -march=i686 -std=c11 -O2 -g -ffreestanding \\\n          -fno-pie -fno-pic -fno-stack-protector -fno-builtin \\\n          -fno-asynchronous-unwind-tables -fno-unwind-tables \\\n          -mno-mmx -mno-sse -mno-sse2 -msoft-float \\\n          -Wall -Wextra -Werror\nQEMUFLAGS = -machine pc -accel tcg -m 32M \\\n            -drive file=$(BUILD)/os.img,format=raw,if=ide -boot c \\\n            -serial stdio -monitor none -nic none \\\n            -no-reboot -no-shutdown -snapshot\n\n.PHONY: all run debug test\nall: $(BUILD)/os.img\n\n$(BUILD):\n\tmkdir -p $@\n\n$(BUILD)/stage1.bin: stage1.asm disk.inc | $(BUILD)\n\t$(NASM) -f bin $< -o $@\n\n$(BUILD)/stage2.bin: stage2.asm disk.inc | $(BUILD)\n\t$(NASM) -f bin $< -o $@\n\n$(BUILD)/entry.o: entry.asm | $(BUILD)\n\t$(NASM) -f elf32 -g -F dwarf $< -o $@\n\n$(BUILD)/kernel.o: kernel.c | $(BUILD)\n\t$(CC) $(CFLAGS) -c $< -o $@\n\n$(BUILD)/kernel.elf: $(BUILD)/entry.o $(BUILD)/kernel.o linker.ld\n\t$(LD) -m elf_i386 -T linker.ld --build-id=none -Map=$(BUILD)/kernel.map \\\n\t    -o $@ $(BUILD)/entry.o $(BUILD)/kernel.o\n\n$(BUILD)/kernel.bin: $(BUILD)/kernel.elf\n\t$(OBJCOPY) -O binary $< $@\n\n$(BUILD)/os.img: $(BUILD)/stage1.bin $(BUILD)/stage2.bin $(BUILD)/kernel.bin mkimage.py\n\tpython3 mkimage.py $(BUILD)\n\nrun: all\n\t$(QEMU) $(QEMUFLAGS)\n\ndebug: all\n\t$(QEMU) $(QEMUFLAGS) -display none -S -gdb tcp:127.0.0.1:1234\n\ntest: all\n\tQEMU=$(QEMU) python3 smoke.py $(BUILD)/os.img\n"
        },
        "teaching": {
          "goal": "Read a build graph and explain why source, object, ELF, raw binary, and disk image are different artifacts.",
          "bridge": "The first browser run is now possible. This section explains the build steps it performs and their native equivalents.",
          "check": {
            "prompt": "You change only a string literal in a C source file. Which conceptual artifacts must be regenerated before the next boot, and why is keeping the old disk image insufficient?",
            "answer": "That source must become a new object, the kernel must be relinked, its raw bytes regenerated, and those bytes placed in a new disk image. The old image still contains the previous linked bytes regardless of what the editor displays."
          },
          "takeaway": "The program you boot is the final artifact of a dependency graph, so verify the build path from your edited source to that artifact.",
          "diagramAfter": 2
        }
      },
      {
        "id": "image",
        "title": "Put the program bytes in their disk sectors",
        "paragraphs": [
          "A disk image is an ordinary file whose bytes stand in for disk sectors. The loader reads numbered sectors; the host image builder writes byte offsets. Multiplication by the sector size joins those two views. In our layout, stage 2 starts at file offset 512 and the kernel starts at 9 × 512 = 4608. The browser pipeline constructs this image for you. The Python reference below shows the same placement explicitly for the optional native route.",
          "Before copying anything, the builder checks sizes. Stage 1 must be exactly one sector and end with its boot signature. Stage 2 must occupy exactly eight sectors. The kernel must be nonempty and fit the 32-sector slot the loader reads. Without those checks, a large kernel could overlap another planned region, or a short malformed boot sector could shift the apparent layout. A build failure at this point is useful: it identifies a violated agreement before the CPU executes the image.",
          "The 16 MiB container is larger than the initial programs, so most bytes are zero. That extra space does not increase the kernel slot: the loader still reads only its configured 32 sectors. Draw the used ranges inside the whole file, then distinguish container capacity from loaded-program capacity. When you download os.img, you are downloading the resulting bootable layout, while kernel.bin is only one component inside it."
        ],
        "code": {
          "language": "text",
          "filename": "mkimage.py",
          "source": "from pathlib import Path\nimport sys\n\n\ndef require(condition, message):\n    if not condition:\n        raise SystemExit(message)\n\n\nbuild = Path(sys.argv[1])\nboot = (build / \"stage1.bin\").read_bytes()\nstage2 = (build / \"stage2.bin\").read_bytes()\nkernel = (build / \"kernel.bin\").read_bytes()\nrequire(len(boot) == 512 and boot[510:] == b\"\\x55\\xaa\",\n        \"invalid boot sector\")\nrequire(len(stage2) == 8 * 512, \"stage 2 must occupy exactly 8 sectors\")\nrequire(0 < len(kernel) <= 32 * 512, \"kernel exceeds 32-sector slot\")\nimage = bytearray(16 * 1024 * 1024)\nimage[:512] = boot\nimage[512:9 * 512] = stage2\nimage[9 * 512:9 * 512 + len(kernel)] = kernel\n(build / \"os.img\").write_bytes(image)\nprint(f\"Built {build / 'os.img'}: kernel {len(kernel)} bytes\")\n"
        },
        "teaching": {
          "goal": "Convert the agreed sector layout into checked file offsets when constructing a boot disk.",
          "bridge": "The linker has produced kernel bytes. The image builder now puts those bytes where the loaders will look.",
          "check": {
            "prompt": "A disk image grows from 16 MiB to 32 MiB, but the loader still reads 24 sectors for its kernel. What is the largest kernel payload that this read can supply?",
            "answer": "24 × 512 = 12288 bytes, or 12 KiB. Enlarging the surrounding image does not change the loader’s read count or the permitted kernel slot."
          },
          "takeaway": "The image builder and loader describe the same regions in different units; validate the conversion and every size limit.",
          "diagramAfter": 2
        }
      },
      {
        "id": "observe",
        "title": "Boot, inspect, and debug with a hypothesis",
        "paragraphs": [
          "Before executing your code, write a short prediction: which message should appear, which mode should the CPU be in, and where should control go after kernel_main returns? In the browser project, the screen begins with C KERNEL READY and the two further lines named in the checkpoint. Use Run to experiment with the machine display, registers, and build output. Choose Submit when you want to check the checkpoint: it builds, boots, and runs the behavior tests automatically, even if you have not used Run. The visible message and the test report answer related questions, but your explanation should connect them to the actual code path.",
          "If the screen is blank, divide the path into stages instead of changing several files at once. Could firmware recognize the first sector? Did stage 1 read the correct sectors? Did stage 2 reach its protected-mode target? Was the entry address linked where the loader jumped? Did C write the expected device memory? A diagnostic marker before and after one boundary can narrow the failure. Serial output with a blank display points toward display setup; silence on serial alone cannot prove that C was never reached.",
          "The optional native bundle uses make test for its serial smoke check and make run for its VGA window. Its reference text is Module 1: protected-mode C kernel OK. make debug starts QEMU stopped with a GDB listener on loopback. Load kernel.elf in a GDB with i386 support, connect, set a hardware breakpoint at _start, and continue through firmware. At the kernel entry, inspect CR0, segment registers, and ESP before stepping toward C.",
          "A reset often deserves a fault-path investigation. With no usable protected-mode exception handlers yet, an early fault can escalate until the machine resets. The native debug flags shown here preserve a stopped machine and can record interrupt and reset events. Begin with the narrowest question you can answer, such as whether the loaded first instruction matches the disassembly. Debugging a bootloader becomes much more manageable when each experiment separates two possible explanations."
        ],
        "code": {
          "language": "sh",
          "filename": "first-run.sh",
          "source": "tar -xzf module-1-source.tar.gz\ncd complete-guide-module1\nmake\nmake test\nmake run\n\n# Inspect the artifacts, not just the terminal exit code.\ni686-elf-readelf -h build/kernel.elf\ni686-elf-nm -n build/kernel.elf\nod -An -tx1 -j510 -N2 build/stage1.bin\n# Expected final two bytes: 55 aa\n\n# Terminal A:\nmake debug\n# Terminal B, using GDB with i386 support:\ngdb build/kernel.elf\n# At the GDB prompt:\n# target remote 127.0.0.1:1234\n# hbreak _start\n# continue\n# info registers\n# x/10i $pc\n"
        },
        "teaching": {
          "goal": "Use a predicted output and a sequence of observations to locate a boot failure.",
          "bridge": "All required files can now produce a disk. Running becomes useful when you know what result each stage should make possible.",
          "check": {
            "prompt": "Your serial marker appears immediately before the mode switch, but no marker after the protected-mode entry appears. Which part of the path has evidence of execution, and what should you inspect next?",
            "answer": "The earlier marker establishes that the real-mode path reached that point. Inspect the GDT address and entries, the PE change, far-jump target and selector, and the target instruction encoding. The evidence narrows the boundary; it does not yet identify one specific failing instruction."
          },
          "takeaway": "Predict, run, and locate the last confirmed boundary before changing the implementation.",
          "diagramAfter": 2
        }
      },
      {
        "id": "validation-scope",
        "title": "Read a passing test as evidence",
        "paragraphs": [
          "Consider three observations: the project compiled, a message appeared, and the machine tests passed. Compilation shows that the tools accepted the source and could resolve the required pieces. A message shows that some execution path produced visible output. A machine test can inspect additional facts, such as the selected mode, expected memory contents, or return from C. Tie each observation to a particular claim so the result explains which behavior was verified.",
          "The native reference bundle has a smoke check for the expected serial message and small initialized-data and zero-initialized-data probes. The browser checkpoint follows its own multi-file project and checks the defined C-entry and output behavior. Passing either path is evidence about that image in that environment. It does not mean that an interrupt subsystem, allocator, or scheduler from a later chapter has already been integrated. Those chapters introduce focused function tests and separate kernel experiments because the two exercise different boundaries.",
          "There is a useful distinction between a test that can pass and a test that would catch your suspected mistake. If memory happens to begin at zero, omitting .bss clearing may still leave the right value. Fill that region with a nonzero pattern before the intended clearing step and the same check becomes more informative. This is how you improve tests while learning: invent a plausible broken implementation, predict whether the current observation distinguishes it, and add an experiment when it does not."
        ],
        "teaching": {
          "goal": "Explain what a passing build, output check, and machine-state check each demonstrate.",
          "bridge": "A successful run is encouraging. The next learning step is to say precisely which parts of your explanation it supports.",
          "check": {
            "prompt": "Two kernels print the same line. One initializes a global correctly; the other hardcodes the line without reading it. Does comparing the line distinguish them, and what extra observation would?",
            "answer": "The line comparison accepts both. An independent check of the relevant memory or a controlled change to the initial value and expected behavior can distinguish them. A test needs to observe the claimed property directly and distinguish plausible broken implementations."
          },
          "takeaway": "A useful test distinguishes your intended mechanism from a plausible wrong implementation.",
          "diagramAfter": 2
        }
      },
      {
        "id": "experiment",
        "title": "Turn a successful boot into understanding",
        "paragraphs": [
          "First draw two rulers: disk offsets and physical memory addresses. Mark stage 1, stage 2, the loaded kernel, its .bss region, and the stack on the appropriate ruler. Connect each disk region to its load destination. This drawing prevents a common confusion: changing a disk offset does not automatically change where the linker expects the kernel to run. Explain the two views aloud before making an edit.",
          "Choose one small change whose effect you can predict. In the browser project, change a C message or a value used through the header, rebuild, and look for the resulting change in the display and artifacts. The canonical checkpoint expects its specified output, so restore that output before the final verification. A playground copy is useful for keeping your exploratory version. In the native reference, changing an initialized probe without changing its comparison should select the failure message while leaving the loader itself intact.",
          "Now design a less obvious experiment around .bss. Simply deleting its clearing loop may seem to work if the emulator's memory starts at zero. A stronger temporary experiment writes nonzero bytes into the reserved interval before the clearing step. With the correct clear in place, the zero-initialized variable still reads zero; without it, the mismatch becomes visible. This teaches an important debugging habit: arrange initial conditions that make the mechanism necessary.",
          "End the chapter by explaining one complete path in your own words, from BIOS loading sector zero to C returning to assembly. Use file names and addresses where they clarify the handoff. You do not need to recite every instruction. You should be able to explain why each stage exists, what it receives, what it prepares, and how you would find out whether it ran."
        ],
        "teaching": {
          "goal": "Design a small boot experiment whose result can confirm or challenge your explanation.",
          "bridge": "You have a working path and know what its checks observe. Now use controlled changes to make the mechanisms memorable.",
          "check": {
            "prompt": "You want to test that a loader reads the kernel from the intended slot. Why is changing only the message text a weak test of the slot calculation? Suggest a more discriminating experiment.",
            "answer": "Changing a message tests the rebuild and executed payload, but another populated slot could still hide an address mistake. Put distinct recognizable payloads or markers in different candidate regions, then inspect which one is loaded or executed. Their different contents make the source location observable."
          },
          "takeaway": "Understanding grows when you can predict the result of a change and design an observation that distinguishes competing explanations.",
          "diagramAfter": 2
        }
      }
    ],
    "lab": "boot",
    "challenge": {
      "title": "Repair a boot contract, then prove it",
      "brief": "The stage below intends to execute bytes loaded at physical 0x8000. Repair its addressing and runtime setup, and explain why a boot signature alone cannot validate the result. This editor exercise is a reasoning check; run the full source bundle in QEMU for machine execution.",
      "language": "asm",
      "starter": "bits 16\norg 0x7c00\nstart:\n    mov sp, 0x7c00\n    mov ax, 0x0800\n    mov ds, ax\n    ; A successful EDD read has loaded stage 2 to 0800:0000.\n    jmp 0x0800:0x8000\n",
      "tasks": [
        "Normalize the boot entry to segment zero and establish DS, ES, SS, SP, and the direction flag.",
        "Correct the far jump so its segment:offset resolves to physical 0x8000.",
        "Calculate the physical destination of the original jump, then explain the disk-versus-memory distinction.",
        "In the downloadable project, change the success message and demonstrate the same message on serial and VGA."
      ],
      "hints": [
        "Compute segment × 16 + offset before choosing a new instruction.",
        "Protect SS:SP initialization with CLI and place your stack below the boot sector.",
        "Either 0000:8000 or 0800:0000 denotes the intended destination. Normalize the rest of the stage around one convention."
      ],
      "solution": "bits 16\norg 0x7c00\njmp 0x0000:start\nstart:\n    cli\n    xor ax, ax\n    mov ds, ax\n    mov es, ax\n    mov ss, ax\n    mov sp, 0x7c00\n    cld\n    ; Preserve DL before any firmware calls in a full loader.\n    ; Assumption for this focused snippet: stage 2 is already loaded.\n    jmp 0x0000:0x8000\n",
      "explanation": "The original jump resolves to 0x10000, because 0x0800 × 16 + 0x8000 = 0x10000. The corrected snippet establishes the CPU state needed to interpret its own data and stack. This focused repair covers the modeled address calculation. The full reference stage performs and checks the EDD read. A 55 AA suffix cannot prove the load address, initialized registers, or executable contents are correct.",
      "checks": [
        "Show the original and repaired physical jump addresses.",
        "Explain why SS must be initialized before the stack is used.",
        "Assemble the full reference project with no compilation errors or linker assertion failures.",
        "Capture the expected serial output and observe the VGA message in QEMU."
      ]
    },
    "reflection": {
      "prompt": "Your kernel prints correctly on one laptop’s emulator. A teammate claims the bootloader is now portable to every x86 PC and to UEFI. Write a technical review that identifies five unproven assumptions and proposes one discriminating experiment for each.",
      "rubric": [
        "Separates firmware interface, disk layout, execution mode, and ABI",
        "Names the concrete hardware and firmware assumptions",
        "Proposes observable outcomes and controls",
        "Acknowledges missing IDT, A20/high-memory work, and the fixed image layout"
      ],
      "modelAnswer": "The result establishes one BIOS/EDD/QEMU path. I would test EDD failure handling with an incompatible boot target; verify that another disk layout is rejected instead of overwriting GPT metadata; inspect CS/CR0/ESP at the entry boundary; poison BSS before initialization; and inject a deliberate fault to expose the missing protected-mode exception path. An x64 UEFI port needs a PE/COFF loader, a firmware memory-map contract, ExitBootServices handling, and framebuffer metadata. None of those requirements follows from the VGA success message."
    },
    "sources": [
      {
        "title": "Intel Software Developer Manuals: architectural reference",
        "url": "https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html"
      },
      {
        "title": "GCC: freestanding C and dialect options",
        "url": "https://gcc.gnu.org/onlinedocs/gcc/C-Dialect-Options.html"
      },
      {
        "title": "GCC: configuring a cross compiler",
        "url": "https://gcc.gnu.org/install/configure.html"
      },
      {
        "title": "QEMU system emulator invocation",
        "url": "https://www.qemu.org/docs/master/system/invocation.html"
      },
      {
        "title": "UEFI specification: GPT disk layout",
        "url": "https://uefi.org/specs/UEFI/2.10/05_GUID_Partition_Table_Format.html"
      },
      {
        "title": "OSDev learning companion: protected mode",
        "url": "https://wiki.osdev.org/Protected_Mode"
      },
      {
        "title": "Complete Module 1 source bundle",
        "url": "/course/module-1-source.tar.gz"
      }
    ],
    "nextBuild": "Keep the working image as a baseline. Next give processor faults a reliable destination before turning on any external interrupts."
  },
  {
    "id": "02",
    "slug": "descriptors-and-interrupts",
    "title": "Give every fault a destination",
    "subtitle": "Decode descriptors, build an IDT, and make exceptions explain themselves.",
    "phase": "Foundations",
    "minutes": 120,
    "prerequisites": [
      "Module 1 boots and you can inspect its registers in GDB",
      "Binary masks and little-endian memory layout"
    ],
    "outcomes": [
      "Decode a segment selector and an eight-byte descriptor",
      "Build a packed IDT entry without depending on compiler bitfields",
      "Normalize exception stack frames at an assembly/C boundary",
      "Distinguish fault, trap, interrupt gate, and trap gate behavior",
      "Diagnose a triple fault by tracing the failed delivery sequence"
    ],
    "sections": [
      {
        "id": "descriptor-contract",
        "title": "Understand the segment descriptors you already used",
        "paragraphs": [
          "In the previous chapter, the far jump used selector 0x08 and the data registers received 0x10. These values were not memory addresses. A selector is a compact reference to a descriptor, which is a record describing a segment. Its upper bits hold an index, bit 2 chooses the global or local descriptor table, and bits 1–0 hold the requested privilege level. For our kernel selectors those low three bits are zero, so dividing the selector by eight reveals the GDT entry number.",
          "The GDT itself is an array of eight-byte records. Each record splits a base address and a limit across several fields, then adds access and size information. The base says where the segment begins. The limit says the largest allowed offset, so it is inclusive. With byte granularity, a limit of 0x03FF permits offsets 0 through 1023. With 4 KiB granularity, the same encoded limit expands to (0x03FF << 12) | 0xFFF. The selector diagram shows how the record is chosen; the granularity calculation then explains how that record describes a large range.",
          "GDTR tells the processor where the table is and gives its byte size minus one. Loading a segment register then copies the chosen descriptor into hidden processor state used by later accesses. Editing the record in RAM does not refresh that cached state, and reloading GDTR does not reload all the segment registers. This explains why our boot transition needed a far jump and explicit data-register loads. Practice decoding one selector and one limit by hand; the goal is to be able to explain the constants before building a more complicated table."
        ],
        "teaching": {
          "goal": "Decode a selector and explain how it finds the segment description the CPU will use.",
          "bridge": "The bootloader used working GDT constants. We will now unpack them so you can reason about permissions and faults.",
          "check": {
            "prompt": "A GDT contains five entries. What limit belongs in GDTR? Which table entry is selected by 0x20 when its low three bits are zero?",
            "answer": "Five eight-byte entries occupy 40 bytes, so the inclusive byte limit is 39, or 0x27. Selector 0x20 identifies entry 4 because 0x20 ÷ 8 = 4. The selector identifies the entry by index and associated selector fields."
          },
          "takeaway": "A selector chooses a descriptor; loading the segment register makes that descriptor active.",
          "diagramAfter": 2
        }
      },
      {
        "id": "idt-layout",
        "title": "Build the table that gives events a destination",
        "paragraphs": [
          "Suppose a division cannot complete or the timer requests attention. The CPU needs a destination before either event occurs. The Interrupt Descriptor Table, or IDT, is an array indexed by an event number called a vector. Each gate describes an entry point and how the processor may enter it. In this 32-bit kernel the gate occupies eight bytes and contains a handler offset split into low and high halves, a code selector, a required zero field, and attributes.",
          "Work from a handler address toward the encoded bytes. The low 16 address bits go in the first field and the high 16 bits go in the last field. The selector chooses the code segment in which the entry executes. Attribute 0x8E describes a present ring-0 32-bit interrupt gate. Its interrupt-gate type clears IF during entry, helping keep ordinary maskable interrupts from nesting immediately. A trap gate preserves IF. Gate names describe this entry behavior; they are separate from whether an exception is classified as a fault or a trap.",
          "The gate's descriptor privilege level also matters, but in a specific way: it controls whether a software INT instruction at a given privilege may request that gate. It does not prevent hardware delivery or a CPU-detected exception. Later we will deliberately create a user-callable syscall entry; ordinary device and exception gates stay restricted. Represent the gate using explicit fixed-size fields and size assertions so the bytes match the hardware format. After filling valid entry points, LIDT makes the table available. The destination is an assembly interrupt stub, which builds and restores an interrupt frame before C can participate."
        ],
        "code": {
          "language": "c",
          "filename": "idt.c",
          "source": "#include <stdint.h>\n#include <stddef.h>\n\nstruct __attribute__((packed)) idt_gate {\n    uint16_t offset_lo, selector;\n    uint8_t zero, attributes;\n    uint16_t offset_hi;\n};\nstruct __attribute__((packed)) table_pointer {\n    uint16_t limit;\n    uint32_t base;\n};\n_Static_assert(sizeof(struct idt_gate) == 8, \"IDT gate layout\");\n_Static_assert(sizeof(struct table_pointer) == 6, \"IDTR layout\");\nstatic struct idt_gate idt[256] __attribute__((aligned(16)));\n\nvoid idt_set(unsigned vector, uintptr_t entry, uint8_t attributes) {\n    if (vector >= 256) return;\n    idt[vector] = (struct idt_gate) {\n        .offset_lo = (uint16_t)entry,\n        .selector = 0x08,\n        .zero = 0,\n        .attributes = attributes,\n        .offset_hi = (uint16_t)(entry >> 16)\n    };\n}\nvoid idt_load(void) {\n    const struct table_pointer p = {\n        .limit = (uint16_t)(sizeof(idt) - 1),\n        .base = (uint32_t)(uintptr_t)idt\n    };\n    __asm__ volatile (\"lidt %0\" : : \"m\"(p) : \"memory\");\n}\n"
        },
        "teaching": {
          "goal": "Trace an interrupt vector through an IDT gate to an assembly handler entry.",
          "bridge": "The GDT describes executable segments. The IDT tells the CPU which entry point to use when an event interrupts execution.",
          "check": {
            "prompt": "A 32-bit handler offset is 0x23456789. What belongs in the gate’s low and high offset fields? Why can the gate not simply point at a C function that uses RET?",
            "answer": "The low field is 0x6789 and the high field is 0x2345. Interrupt entry creates the hardware return frame required by the interrupt mechanism. An assembly stub must preserve the interrupted state and ultimately use the interrupt-return sequence, so a plain C RET is insufficient."
          },
          "takeaway": "An IDT gate connects a numbered event to an assembly entry with a precisely encoded address and entry policy.",
          "diagramAfter": 2
        }
      },
      {
        "id": "frames",
        "title": "One shape for exceptions with different hardware frames",
        "paragraphs": [
          "An interrupt can arrive while registers hold unfinished work. If the handler overwrites them without saving them, the interrupted program resumes with different inputs. The CPU saves part of the state automatically, and the entry stub saves the rest. For a same-privilege 32-bit entry, the hardware frame includes EFLAGS, CS, and EIP, with EIP nearest the new stack top. Some exceptions additionally supply an error code. A privilege change adds the old stack state after the CPU selects the kernel stack; that extra state is absent from an ordinary ring-0-to-ring-0 frame.",
          "We want the C dispatcher to see one predictable structure. For an exception that does not push an error code, its assembly stub pushes a synthetic zero. Every stub then pushes its vector number. The common entry saves the general registers, clears DF for C, and passes a pointer to the frame. These software additions normalize the differences between hardware entries. Draw each push as a new box toward lower addresses to derive the final structure.",
          "PUSHAD needs special care when reading that drawing. At the final ESP, the saved words appear as EDI, ESI, EBP, the old ESP snapshot, EBX, EDX, ECX, and EAX. POPAD skips the saved ESP field; it does not use it as a new stack pointer. Our focused stubs cover divide error, general protection, and page fault under the existing ring-0 flat-segment setup. Other supported exceptions must be classified according to whether they supply an error code, and user-mode entry will need additional segment handling. The important practice is to account for every word before designing the matching restore path."
        ],
        "code": {
          "language": "asm",
          "filename": "fault_entry.asm",
          "source": "bits 32\nsection .text\nextern fault_dispatch\nglobal isr0, isr13, isr14\nisr0:\n    push dword 0             ; #DE has no hardware error code\n    push dword 0\n    jmp fault_common\nisr13:\n    push dword 13            ; #GP already has an error code\n    jmp fault_common\nisr14:\n    push dword 14            ; #PF already has an error code\nfault_common:\n    pushad\n    cld\n    mov ebx, esp             ; preserved by the C ABI\n    and esp, -16\n    sub esp, 12\n    push ebx                 ; struct fault_frame *\n    call fault_dispatch\n    mov esp, ebx\n    popad\n    add esp, 8               ; vector + error, never EIP\n    iretd\nsection .note.GNU-stack noalloc noexec nowrite progbits\n"
        },
        "teaching": {
          "goal": "Draw the saved stack frame and explain how assembly gives different exceptions a common C interface.",
          "bridge": "A valid gate gets us into a handler. Returning safely requires understanding what was saved on the stack.",
          "check": {
            "prompt": "A no-error-code stub pushes synthetic zero and then a vector. Just before IRETD, what must happen to those two words, and why is leaving one on the stack dangerous?",
            "answer": "The restore path must remove both software-added words after restoring the saved registers, leaving the hardware EIP at the stack top. Otherwise IRETD interprets a software value as part of its hardware return frame and restores an invalid instruction pointer or segment."
          },
          "takeaway": "The entry and exit paths must agree on the exact stack shape, including every software-added word.",
          "diagramAfter": 2
        }
      },
      {
        "id": "diagnostics",
        "title": "Make the first handler deliberately boring",
        "paragraphs": [
          "Your first exception dispatcher should answer a small set of concrete questions: which vector arrived, which instruction was interrupted, what error code was supplied, and what were the important registers? A bounded serial routine is a useful first output path because it can operate without the normal console's locks or heap. For page faults, capture CR2 early; it holds the faulting linear address. Then print the saved frame and stop so the original evidence remains available.",
          "The saved EIP has meaning that depends on the exception. A fault commonly identifies an instruction that could not finish. Returning to it without repairing the cause makes it fault again. A trap commonly reports after the relevant instruction, so a deliberately installed breakpoint can be used to test resumption. Do not advance EIP by a guessed amount to escape a fault: x86 instructions have variable lengths, and skipping one does not explain why the operation was invalid. Read the event's semantics before deciding whether return is meaningful.",
          "The diagnostic path can itself fail. If the handler needs a heap lock that the interrupted code already holds, it can hang while trying to report the error. If exception delivery fails in certain combinations, the CPU attempts a double fault; if that delivery also fails, the resulting shutdown is commonly seen as a reset in our emulator. There is no ordinary triple-fault handler to install. Use reset suppression and the emulator's event log to find the first failed delivery, then work forward. A simple first handler gives you a reliable place from which to make later handlers more capable."
        ],
        "teaching": {
          "goal": "Use an exception report to distinguish the failing instruction from a failure in the handler itself.",
          "bridge": "The frame now preserves the interrupted state. We can turn that state into a useful explanation of a fault.",
          "check": {
            "prompt": "A divide-error handler prints the same EIP repeatedly after returning. Why might the print routine be correct even though execution never advances?",
            "answer": "The faulting divide instruction is being retried with the same invalid inputs. Printing and restoring the frame can both work while the cause remains unresolved. For this deliberate panic experiment, stopping preserves the report instead of pretending the computation can continue."
          },
          "takeaway": "A fault report is useful when it preserves the original cause and does not depend on facilities that may already be broken.",
          "diagramAfter": 2
        }
      },
      {
        "id": "proof",
        "title": "Exercise the boundary before exposing devices",
        "paragraphs": [
          "Begin with a controlled INT3 breakpoint and a handler intended to return. Put a recognizable operation immediately after INT3 and predict the register or output it should produce. If it executes, you have evidence for both delivery and the restore path. Compare this with a deliberate divide error created using an assembly DIV with a zero divisor. That second experiment should produce a fault report and stop; using undefined C division behavior would let the compiler change the experiment before the CPU sees it.",
          "Next load a deliberately invalid data selector in a disposable run and inspect the general-protection report. The error code can carry selector-related information, so decode its fields according to the event that produced it. Change only one stimulus per boot. If the handler prints and the machine then resets, focus on the frame restoration: the reporting code may have worked while IRETD received the wrong words.",
          "At the chapter checkpoint you implement and test the gate-encoding function as a focused C exercise. Those byte-level tests check the layout independently of a running interrupt subsystem. In your kernel, the breakpoint and fault experiments check the integration with actual CPU entry and exit. Both are useful. Before enabling hardware IRQs in the next chapter, install the relevant IDT entries and keep unsupported sources masked, so an arriving device event has a defined destination."
        ],
        "teaching": {
          "goal": "Plan separate experiments for interrupt entry, fault reporting, and correct return.",
          "bridge": "A handler that prints has demonstrated entry. We now test the different paths deliberately, including the path back out.",
          "check": {
            "prompt": "Your gate-encoding function passes every byte-layout test, but INT3 resets the machine. Name two parts of the integrated path those function tests did not exercise.",
            "answer": "They did not establish that IDTR points to the intended live table or that the assembly handler restores the correct interrupt frame. The code selector and mapped handler address also belong to the integrated execution path. Correct gate bytes are one component of a working delivery path."
          },
          "takeaway": "Test the encoded data in isolation, then test real entry and return as separate kernel behaviors.",
          "diagramAfter": 2
        }
      }
    ],
    "lab": "gdt",
    "challenge": {
      "title": "Reconstruct a gate from its bytes",
      "brief": "Repair a pure C IDT encoder. Compile the solution with a host compiler to test byte layout, then compare those bytes with your kernel’s IDT in GDB. Host execution checks packing arithmetic; it does not execute LIDT.",
      "language": "c",
      "starter": "#include <stdint.h>\nvoid encode_gate(uint8_t out[8], uint32_t handler) {\n    for (unsigned i = 0; i < 8; ++i) out[i] = 0;\n    out[0] = handler >> 24;\n    out[1] = handler >> 16;\n    out[2] = 0x10;\n    out[5] = 0x0e;\n    out[6] = handler;\n    out[7] = handler >> 8;\n}\n",
      "tasks": [
        "Encode handler 0x12345678 with code selector 0x08 and interrupt-gate attributes 0x8E.",
        "Explain why selector 0x10 is invalid for this handler in our current GDT.",
        "Write a test that reconstructs the handler address from the resulting bytes.",
        "Describe what would change for a user-callable INT 0x80 gate."
      ],
      "hints": [
        "The processor consumes little-endian 16-bit offset pieces.",
        "Bytes 2–3 contain the selector, byte 4 is zero, and byte 5 includes the present bit.",
        "The expected bytes are 78 56 08 00 00 8e 34 12."
      ],
      "solution": "#include <stdint.h>\n#include <assert.h>\nvoid encode_gate(uint8_t out[8], uint32_t handler) {\n    out[0] = (uint8_t)handler;\n    out[1] = (uint8_t)(handler >> 8);\n    out[2] = 0x08; out[3] = 0;\n    out[4] = 0; out[5] = 0x8e;\n    out[6] = (uint8_t)(handler >> 16);\n    out[7] = (uint8_t)(handler >> 24);\n}\nint main(void) {\n    uint8_t gate[8];\n    encode_gate(gate, 0x12345678u);\n    uint32_t address = (uint32_t)gate[0] | ((uint32_t)gate[1] << 8)\n        | ((uint32_t)gate[6] << 16) | ((uint32_t)gate[7] << 24);\n    assert(address == 0x12345678u);\n    assert(gate[2] == 8 && gate[3] == 0 && gate[4] == 0);\n    assert(gate[5] == 0x8e);\n    return 0;\n}\n",
      "explanation": "The handler offset is split around the selector and attributes. Selector 0x10 names a data descriptor in this GDT; an interrupt gate needs an executable code segment. A user-callable interrupt gate would normally have attributes 0xEE, but DPL 3 is only one piece of a safe syscall path: a TSS kernel stack and validated user arguments are also required.",
      "checks": [
        "The host assertion program exits successfully.",
        "You can label every byte in the expected gate.",
        "A kernel breakpoint returns to the correct following instruction.",
        "A real CPU exception reports its vector and original instruction pointer without an immediate reset."
      ]
    },
    "reflection": {
      "prompt": "A handler prints “page fault” and then immediately prints it again forever. Give two different explanations involving the return path, and describe how you would distinguish them.",
      "rubric": [
        "Explains why a fault may restart the same instruction",
        "Distinguishes unresolved cause from corrupt saved state",
        "Uses CR2, error code, EIP, and a stack dump as evidence"
      ],
      "modelAnswer": "The handler may correctly return to the faulting load while leaving its page unmapped; EIP and CR2 then repeat with a consistent frame. Alternatively it may remove the wrong number of stack words, so IRETD restores a corrupt EIP or CS and causes another exception. I would compare the saved frame before and after dispatch, single-step the restore, and verify that the intended mapping and TLB update exist before allowing a recoverable page fault to return."
    },
    "sources": [
      {
        "title": "Intel Software Developer Manuals: architectural reference",
        "url": "https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html"
      },
      {
        "title": "OSDev learning companion: interrupt descriptor table",
        "url": "https://wiki.osdev.org/Interrupt_Descriptor_Table"
      },
      {
        "title": "QEMU system emulator invocation",
        "url": "https://www.qemu.org/docs/master/system/invocation.html"
      }
    ],
    "nextBuild": "Install exception reporting in the bootable baseline. Preserve interrupts disabled until memory discovery and device routing are ready."
  },
  {
    "id": "03",
    "slug": "memory-discovery",
    "title": "Find the memory you actually own",
    "subtitle": "Collect E820, test A20, and turn firmware output into a kernel boot contract.",
    "phase": "Foundations",
    "minutes": 105,
    "prerequisites": [
      "A working BIOS loader and protected-mode exception path",
      "Unsigned arithmetic and half-open intervals"
    ],
    "outcomes": [
      "Collect variable-length BIOS memory-map records with bounded storage",
      "Separate usable RAM from currently unowned RAM",
      "Explain A20 aliasing and test it without leaving memory corrupted",
      "Normalize firmware records with overflow and overlap checks",
      "Design a versioned boot-information structure"
    ],
    "sections": [
      {
        "id": "ownership",
        "title": "Describe usable memory as ranges",
        "paragraphs": [
          "Suppose the emulator is configured with 32 MiB of RAM. It is tempting to allocate every address below that number. A PC's physical address space, however, is a map of different uses: ordinary RAM, firmware data, reserved regions, and device windows. The number of installed bytes does not describe all those boundaries. Firmware supplies a memory map so the loader can pass the kernel a description of individual ranges and their classifications.",
          "In the BIOS path we collect this information using E820 before leaving real mode. We need a buffer at a known location with a known capacity, and we must keep it intact until the kernel has copied or reserved it. Even a range firmware calls usable can contain our own loader, kernel, stack, page tables, or map buffer by the time C starts. Firmware describes the platform; our reservation list accounts for what this boot has placed inside it. The free-frame list will be built from both.",
          "Represent ranges as [base, end), including base and excluding end. Then length is simply end minus base, and two adjacent ranges can share an endpoint without overlapping. Compute end only after checking that base + length cannot overflow. Keep firmware values in 64-bit integers even while the kernel uses only addresses below 4 GiB: truncating a high physical address could turn it into an apparently available low one. Start your notes with three columns (firmware type, current contents, allocation decision) and use them to explain each range before marking it free."
        ],
        "teaching": {
          "goal": "Distinguish installed RAM, usable firmware ranges, and memory that the running kernel can actually allocate.",
          "bridge": "The kernel can report faults. Before giving it an allocator, we need to discover which physical bytes are available.",
          "check": {
            "prompt": "Firmware labels [0x200000, 0x600000) usable, but your kernel occupies [0x200000, 0x230000). Can an allocator hand out the whole firmware range immediately?",
            "answer": "No. The usable classification says it is RAM the operating system may manage; the running kernel already owns part of it. At minimum the kernel interval must be reserved, along with any other live allocations inside the range."
          },
          "takeaway": "Available memory is discovered RAM minus all regions still needed by firmware or this boot.",
          "diagramAfter": 2
        }
      },
      {
        "id": "e820",
        "title": "E820 is an iterative protocol",
        "paragraphs": [
          "E820 is an iterative interface: one call returns one memory-range record and a value used to ask for the next record. Start with EBX=0. For each call, supply the E820 operation number in EAX, the SMAP signature in EDX, the buffer size in ECX, and the destination pointer in ES:DI. After a successful call, validate the returned signature and record length before interpreting its fields. A register-level interface becomes easier to follow when you label each value as input, output, or both.",
          "The returned EBX is an opaque continuation token. Opaque means we preserve and return it exactly; we do not add one or infer an array index from it. A zero token means the record just returned was the final record, so that record still belongs in the result. Our bounded loader asks for 24-byte records while accepting the older 20-byte form, initializing the extended-attribute area before each request. The later normalization pass can then account for disabled extended records and other unsuitable entries.",
          "Capacity is part of the algorithm. The example reserves 0x5000–0x5BFF for collected records, below our loader stack. Before advancing the destination, make sure the next record fits. If firmware fails according to this loader's interface or the buffer fills before the map finishes, report failure and mark the partial map as incomplete. A partial map could omit the very reserved range that keeps the allocator safe. Trace two successful calls and a final returned zero token on paper, tracking buffer position separately from the continuation token."
        ],
        "code": {
          "language": "asm",
          "filename": "e820.asm: real-mode implementation unit",
          "source": "bits 16\n; Integrate in stage 2 before protected mode. DS = ES = 0.\n; Result: CF clear, e820_count valid; CF set means do not use this map.\n; Records: 128 slots x 24 bytes at physical 0x5000.\ncollect_e820:\n    mov word [e820_count], 0\n    xor ebx, ebx\n    mov di, 0x5000\n.next:\n    cmp word [e820_count], 128\n    jae .failed\n    mov dword [es:di+20], 1\n    mov eax, 0xe820\n    mov edx, 0x534d4150\n    mov ecx, 24\n    push ds\n    push es\n    push di\n    int 0x15\n    pop di\n    pop es\n    pop ds\n    jc .failed\n    cmp eax, 0x534d4150\n    jne .failed\n    cmp ecx, 20\n    jb .failed\n    cmp ecx, 24\n    ja .failed\n    cmp ecx, 24\n    je .record\n    mov dword [es:di+20], 1  ; 20-byte form has no attributes\n.record:\n    inc word [e820_count]\n    add di, 24\n    test ebx, ebx\n    jnz .next\n    clc\n    ret\n.failed:\n    stc\n    ret\ne820_count: dw 0\n"
        },
        "teaching": {
          "goal": "Trace the repeated BIOS calls that collect a complete memory map.",
          "bridge": "We know why one RAM-size value is insufficient. E820 gives us the individual records needed to build the map.",
          "check": {
            "prompt": "The first successful E820 call returns token 0x91, and the second returns token zero with a valid record. Which value is sent on the second call, and how many records were collected?",
            "answer": "Send 0x91 unchanged on the second call. Both successful records are collected, including the one returned with token zero. Zero ends the iteration after that returned record."
          },
          "takeaway": "A complete E820 map requires preserving continuation tokens, validating every record, and detecting capacity or call failures.",
          "diagramAfter": 2
        }
      },
      {
        "id": "a20",
        "title": "Prove that high addresses do not alias",
        "paragraphs": [
          "Early PC compatibility introduced a way to mask address bit 20. With that bit masked, two addresses differing only in bit 20 can refer to the same underlying byte. That behavior mattered for software expecting older wraparound addressing. For an allocator, it would be disastrous: two apparently different frames could actually overlap. Entering protected mode does not by itself prove that the masking has been removed. Our first boot avoided the issue by keeping its addresses below 1 MiB.",
          "To understand an A20 test, choose two suitable probe locations separated by 0x100000. Save their original bytes, write distinguishable patterns, and observe whether changing one location changes the other. The probe must temporarily control interrupts and avoid live code, stacks, and firmware data. Restore the original contents afterward. If the addresses alias, both saved reads came from the same underlying storage, so the restore sequence must handle their shared underlying byte.",
          "Test before trying to enable the gate; firmware may already have done it. If a change is needed, use a supported firmware method or a platform-appropriate fallback, then perform the test again. The fast gate at port 0x92 has other bits, including reset-related behavior, and the keyboard-controller method requires bounded waits and command sequencing. The educational point is the readback: an output instruction expresses a request, while the aliasing test observes whether the needed address behavior is actually present."
        ],
        "teaching": {
          "goal": "Explain address aliasing from the A20 gate and why high-memory use requires a verified result.",
          "bridge": "A map may describe memory above 1 MiB. We must also know that the machine can address it distinctly.",
          "check": {
            "prompt": "Assume bit 20 is masked. How are addresses 0x004520 and 0x104520 related, and why would writing different allocation metadata to both be unsafe?",
            "answer": "They differ only in bit 20, so masking that bit makes them refer to the same location. Writes through either address can overwrite the other metadata. They cannot be treated as independent memory until the address behavior is verified."
          },
          "takeaway": "Before using high memory, verify distinct addressing instead of assuming a mode switch or an enable request was enough.",
          "diagramAfter": 2
        }
      },
      {
        "id": "normalize",
        "title": "Reserve conservatively, then reclaim deliberately",
        "paragraphs": [
          "Firmware records describe byte ranges, while our first physical allocator hands out 4096-byte frames. A frame must be entirely safe to use. Start with every frame unavailable, then identify fully covered usable frames and subtract reservations. This direction of construction keeps memory covered by an omitted record unavailable. Keep the original records for diagnosis while building a normalized map the allocator can consume.",
          "For a usable range, round the beginning upward to a page boundary and the end downward. Consider [0x6005, 0xA900): complete frames begin at 0x7000, 0x8000, and 0x9000. The partial bytes near either endpoint are insufficient to offer the whole neighboring frame. For a reservation, do the opposite: every touched frame is unavailable. A reservation [0x8FF0, 0x9010) excludes both frames beginning at 0x8000 and 0x9000. Sketch these two ranges on a separate address ruler, then compare their rounding with the different worked interval in the diagram.",
          "Maps can be unordered or overlapping. If a reserved record overlaps a usable one, reserve the overlapping region consistently. Reclaimable memory also has a time dimension: loader storage becomes free only after the kernel stops executing or referencing it; ACPI reclaimable data becomes reusable after needed information is consumed or copied, while ACPI NVS has a different preservation role. The normalized map describes which complete frames may be allocated in the current boot state."
        ],
        "teaching": {
          "goal": "Convert byte ranges into allocatable pages using inward rounding for usable memory and outward rounding for reservations.",
          "bridge": "The raw firmware map is collected. The allocator needs a simpler answer for each complete page: available or unavailable.",
          "check": {
            "prompt": "With 4096-byte frames, which complete frame starts fit in usable [0xB100, 0xF000)? Then remove the frames touched by reserved [0xDFF8, 0xE004).",
            "answer": "The usable interval fully contains frames at 0xC000, 0xD000, and 0xE000. The reservation touches the last two, so only the frame beginning at 0xC000 remains available."
          },
          "takeaway": "Offer only whole usable frames, and reserve every frame touched by live or reserved bytes.",
          "diagramAfter": 2
        }
      },
      {
        "id": "boot-info",
        "title": "Version the handoff before it grows",
        "paragraphs": [
          "A handoff structure lets the loader tell the kernel what it discovered and where it placed things. Call it boot_info. A small header can contain a recognizable magic value, a version, and a structure size; the remaining fields describe the memory map, kernel bounds, display information, and reservations. Fixed-width integer fields make the byte layout explicit. Version and size fields let a future loader add information without making an old kernel interpret unrelated bytes as familiar fields.",
          "Follow the map pointer carefully. At this boundary it is a physical address unless the interface explicitly says otherwise. After paging begins, converting that number to a C pointer works only if the intended physical memory is mapped at that virtual address. Record count and record stride are also needed: count tells us how many records exist, while stride says how far to step between them. Validate their multiplication and the total pointed-to range before reading it, then copy the accepted description into storage the kernel will continue to own.",
          "The same discipline helps graphics: width alone does not describe a framebuffer. Pitch tells us how many bytes separate rows, pixel format describes each stored pixel, and the memory extent bounds access. A later UEFI loader can translate its firmware descriptors into the same kernel-facing structure, allowing memory management to remain independent of the firmware API. For practice, invent a map with one unsorted overlap, one empty record, and one overflowing endpoint. Explain which data you reject and which frames you conservatively reserve before running the focused range-conversion checkpoint."
        ],
        "teaching": {
          "goal": "Design a loader-to-kernel memory description that can be validated before it is used.",
          "bridge": "The loader has collected the map, but the kernel needs a stable way to receive and interpret it.",
          "check": {
            "prompt": "A handoff says there are 48 records with a 24-byte stride. How much mapped storage must be available for the records, and why is checking only the first record address insufficient?",
            "answer": "The records require 48 × 24 = 1152 bytes, after checking the multiplication and endpoint for overflow. A valid first address says nothing about whether the rest of the range is present, readable, and still owned by the handoff buffer."
          },
          "takeaway": "A boot handoff is a data format: validate its layout and full ranges before converting it into kernel-owned state.",
          "diagramAfter": 2
        }
      }
    ],
    "lab": "memory",
    "challenge": {
      "title": "Rescue the partial pages",
      "brief": "Repair the conversion from a firmware byte range to fully usable 4 KiB frames. This exercise is a complete host-testable arithmetic unit. It deliberately returns an empty interval for invalid input.",
      "language": "c",
      "starter": "#include <stdint.h>\nstruct frames { uint64_t first, end; };\nstruct frames usable(uint64_t base, uint64_t length) {\n    return (struct frames){base / 4096, (base + length + 4095) / 4096};\n}\n",
      "tasks": [
        "Reject base-plus-length overflow.",
        "Round a usable start upward and a usable end downward.",
        "Handle empty and sub-page ranges without manufacturing a frame.",
        "Explain why reserving a range needs a different rounding rule."
      ],
      "hints": [
        "Use UINT64_MAX - base before adding length.",
        "Compute ceil(base / 4096) using quotient and remainder to avoid base + 4095 overflow.",
        "The returned end frame number is exclusive; return empty when first is greater than or equal to end."
      ],
      "solution": "#include <stdint.h>\n#include <assert.h>\nstruct frames { uint64_t first, end; };\nstruct frames usable(uint64_t base, uint64_t length) {\n    if (length == 0 || length > UINT64_MAX - base)\n        return (struct frames){0, 0};\n    uint64_t first = base / 4096 + (base % 4096 != 0);\n    uint64_t end = (base + length) / 4096;\n    if (first >= end) return (struct frames){0, 0};\n    return (struct frames){first, end};\n}\nint main(void) {\n    struct frames a = usable(0x1003, 0x3ffd);\n    assert(a.first == 2 && a.end == 5);\n    struct frames b = usable(0x1003, 10);\n    assert(b.first == b.end);\n    struct frames c = usable(UINT64_MAX - 10, 20);\n    assert(c.first == c.end);\n    struct frames d = usable(0x2000, 4096);\n    assert(d.first == 2 && d.end == 3);\n    return 0;\n}\n",
      "explanation": "A free page must be wholly contained in usable RAM, so rounding moves both boundaries inward. Overflow is rejected before addition. Reserved bytes have the opposite ownership rule: a single reserved byte excludes its whole page, so reservation boundaries round outward.",
      "checks": [
        "The provided assertion program passes under a host C11 compiler.",
        "You can list the three frames accepted from [0x1003, 0x5000).",
        "Your normalized kernel map never includes the loader, kernel, stack, or map buffer.",
        "An oversized or malformed E820 map produces a bounded error path."
      ]
    },
    "reflection": {
      "prompt": "The firmware marks [1 MiB, 32 MiB) usable. Your allocator starts there and immediately corrupts its own bitmap. Explain the mistake and design an initialization order that makes it impossible.",
      "rubric": [
        "Separates firmware usability from kernel ownership",
        "Includes storage for the allocator metadata itself",
        "Reserves before exposing allocation",
        "Preserves map data until normalization is complete"
      ],
      "modelAnswer": "The bitmap was placed inside firmware-usable RAM, but no reservation removed its pages from the final free pool. I would begin with all frames unavailable, identify space for the bitmap from a validated usable interval, record that reservation, reserve the kernel, loader data, stacks, and page tables, then expose only remaining fully usable pages. Allocation starts only after the final reservation pass. The firmware map describes hardware ranges. Track the live kernel’s ownership separately."
    },
    "sources": [
      {
        "title": "Intel Software Developer Manuals: architectural reference",
        "url": "https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html"
      },
      {
        "title": "OSDev memory-map learning companion",
        "url": "https://wiki.osdev.org/Memory_Map_(x86)"
      },
      {
        "title": "UEFI specification: memory-map and boot services",
        "url": "https://uefi.org/specs/UEFI/2.10/07_Services_Boot_Services.html"
      }
    ],
    "nextBuild": "Pass a checked, versioned memory description into C and reserve every live boot allocation before enabling the page allocator."
  },
  {
    "id": "04",
    "slug": "drivers-and-irqs",
    "title": "Let hardware interrupt the silence",
    "subtitle": "Route timer ticks and keystrokes, and build output that survives failures.",
    "phase": "Foundations",
    "minutes": 150,
    "prerequisites": [
      "A loaded IDT with verified exception entry and return",
      "Port I/O helpers and a serial output path"
    ],
    "outcomes": [
      "Remap and mask the legacy PIC without exposing an incomplete IDT",
      "Program a PIT divisor and distinguish requested from actual frequency",
      "Separate a keyboard interrupt top half from scancode decoding",
      "Implement bounded input queues and explicit overflow policy",
      "Explain what changes for APIC, framebuffer, and modern hardware discovery"
    ],
    "sections": [
      {
        "id": "path",
        "title": "Follow a key press through the kernel",
        "paragraphs": [
          "Pressing a key does not call your shell function. The keyboard and controller produce data, an interrupt controller requests CPU attention, and the CPU enters the selected IDT vector when delivery is permitted. An assembly stub saves the interrupted state, then a small handler reads the device and stores the result in a software queue. Later, ordinary kernel code consumes that queue. Naming these stages helps you locate a lost event: it may never have reached the CPU, or it may be waiting unread in software.",
          "Each stage has its own completion action. Reading a device's data port consumes or observes device state. Sending an end-of-interrupt command, or EOI, tells the interrupt controller that servicing has progressed. These are different operations; an EOI does not magically read the keyboard byte. The exact ordering comes from the device and controller protocols. In the diagram, follow the data path separately from the notification path so that those two jobs remain visible.",
          "Keep the interrupt handler's work short and bounded. Capturing a byte and updating a queue is predictable; formatting a large line, waiting for another device, or allocating arbitrary memory may delay every other interrupt or wait on interrupted code. For this one-CPU milestone, queue mutations must occur under a defined rule: the handler owns its side, and ordinary code saves and disables local interrupts when it must exclude the handler. The chapter's focused queue exercise gives you a small place to practice the data movement before integrating it with hardware."
        ],
        "teaching": {
          "goal": "Trace a key press from hardware through an interrupt handler into a queue and a later consumer.",
          "bridge": "The kernel has interrupt entry and knows its memory. We can now connect a device event to useful software work.",
          "check": {
            "prompt": "A handler sends an EOI but never reads the available keyboard byte. Which part of the event path did it acknowledge, and which part remains unfinished?",
            "answer": "It acknowledged interrupt-controller servicing. It did not consume the device data or put a byte into the software queue. The controller protocol and the data-transfer operation must both be completed as required."
          },
          "takeaway": "Separate the device data, interrupt notification, and later interpretation into explicit stages.",
          "diagramAfter": 2
        }
      },
      {
        "id": "pic",
        "title": "Remap first, unmask last",
        "paragraphs": [
          "The legacy PC has two 8259-compatible Programmable Interrupt Controllers, usually called the master and slave PIC. Together they route sixteen IRQ lines, with the slave connected through the master's IRQ2 cascade input. An IRQ line number and an IDT vector number are different things. We remap the master to start at vector 0x20 and the slave at 0x28 so device delivery does not overlap the processor's reserved exception vectors. Under that mapping, master IRQ1 arrives at vector 0x21.",
          "Masking gives us control over which sources may be delivered while we initialize them. Begin with all lines masked, populate the IDT gates, initialize each device, and then unmask only the lines with working handlers. A mask bit of one disables that input. Allowing a slave device also requires allowing the master's cascade line. Keep a software copy of the masks so one driver's update does not accidentally change another driver's state. The port-delay technique in this reference belongs to the chosen legacy emulator profile.",
          "An ordinary master-only interrupt needs an EOI to the master. For a real slave interrupt, acknowledge the slave and then the master because both participated in the route. Spurious IRQ7 and IRQ15 are special cases whose in-service state determines the appropriate acknowledgment, so they cannot blindly use the ordinary sequence. Exceptions generated by the CPU do not involve a PIC request and receive no PIC EOI. Trace a master and a slave event on the diagram and identify which controller state each acknowledgment completes."
        ],
        "code": {
          "language": "c",
          "filename": "pic.c",
          "source": "#include <stdint.h>\nstatic inline void outb(uint16_t p, uint8_t v) {\n    __asm__ volatile(\"outb %0,%1\" : : \"a\"(v), \"Nd\"(p));\n}\nstatic void wait_io(void) { outb(0x80, 0); }\nstatic void write_pic(uint16_t p, uint8_t v) { outb(p, v); wait_io(); }\nvoid pic_init_masked(void) {\n    outb(0x21, 0xff); outb(0xa1, 0xff);\n    write_pic(0x20, 0x11); write_pic(0xa0, 0x11);\n    write_pic(0x21, 0x20); write_pic(0xa1, 0x28);\n    write_pic(0x21, 0x04); write_pic(0xa1, 0x02);\n    write_pic(0x21, 0x01); write_pic(0xa1, 0x01);\n    outb(0x21, 0xff); outb(0xa1, 0xff);\n}\nvoid pic_enable_timer_keyboard(void) {\n    /* Call only after both device handlers and gates are ready. */\n    outb(0xa1, 0xff);\n    outb(0x21, 0xfc);\n}\nvoid pic_eoi_real_irq(unsigned irq) {\n    /* Spurious IRQ7/15 must be filtered before this function. */\n    if (irq >= 16) return;\n    if (irq >= 8) outb(0xa0, 0x20);\n    outb(0x20, 0x20);\n}\n"
        },
        "teaching": {
          "goal": "Explain PIC remapping, masking, and acknowledgment using the path of one IRQ.",
          "bridge": "The event path includes an interrupt controller. We will first use the legacy controller provided by our emulated PC.",
          "check": {
            "prompt": "The slave starts at vector 0x30. Which vector would its local input 2 produce, and why must the master cascade line also be enabled?",
            "answer": "The vector is 0x32. The slave signals the CPU through the master cascade route; masking that master input prevents delivery even if the individual slave input is unmasked."
          },
          "takeaway": "An IRQ becomes a vector through configured routing, and every participating controller must be acknowledged correctly.",
          "diagramAfter": 2
        }
      },
      {
        "id": "pit",
        "title": "Relate timer counts to elapsed time",
        "paragraphs": [
          "The Programmable Interval Timer, or PIT, divides an input clock of approximately 1.193182 MHz. Channel 0 can produce periodic IRQ0 events. To request a rate, choose an integer divisor; the actual nominal event frequency is the input frequency divided by that integer. This introduces rounding even before emulator timing enters the picture. For a divisor of 10000, for example, the nominal frequency is about 119.3182 Hz, so one period is about 8.38 milliseconds.",
          "The control word selects the channel, access sequence, and operating mode. For the mode-2 setup here, send the divisor's low byte first and then its high byte. The 16-bit encoded value zero represents a divisor of 65536, so distinguish a register encoding from its mathematical meaning. Decide how to reject or bound requested rates that cannot be represented. In the interrupt handler, update a tick count and request later scheduling work; keep the potentially expensive policy decision outside the smallest device-service path.",
          "A tick count tells you how many events your software handled. Relating that count to elapsed time requires assumptions about event delivery and clock behavior. Emulator pauses, long interrupt masking, and pending-event behavior can change when you observe ticks. On a 32-bit CPU even reading a 64-bit software counter needs care: the handler could update it between the reader's two word loads. Use the selected interrupt discipline to take a consistent snapshot. Practice with a divisor calculation, then compare the predicted nominal interval with observed counts while keeping the distinction between event accounting and calibrated time explicit."
        ],
        "teaching": {
          "goal": "Derive a timer rate from the PIT divisor and distinguish timer events from measured elapsed time.",
          "bridge": "With one IRQ route understood, the timer gives us a repeatable event source for timekeeping and later scheduling.",
          "check": {
            "prompt": "A simplified timer receives 2,000,000 input pulses per second and uses divisor 8000. What is its nominal event rate and period? Would printing once per event be a good high-rate timing instrument?",
            "answer": "The rate is 250 events per second and the period is 4 ms. Printing adds substantial variable work and can perturb delivery or observation, so count events cheaply and inspect snapshots separately."
          },
          "takeaway": "Timer programming chooses a representable nominal rate; reliable time measurement also needs careful observation and synchronization.",
          "diagramAfter": 2
        }
      },
      {
        "id": "keyboard",
        "title": "Bytes become keys only after a state machine",
        "paragraphs": [
          "The PS/2 controller exposes status and data ports. A handler first checks whether output data is available, then reads it according to the controller protocol. The byte might be a keyboard scan code, a command response, or data associated with another controller device. That is why sending a command and treating the next byte as a character is unreliable. Commands need their own acknowledgment, resend, and timeout handling so their responses do not enter the text stream by mistake.",
          "A scan code describes a key event under a chosen scan-code set and translation policy. Converting the event into text requires decoding and a keyboard layout. Press and release events differ; prefix bytes can change the interpretation of later bytes; modifiers such as Shift remain active across multiple events. A decoder therefore remembers state. One useful layering is raw bytes, then key events, then a layout-dependent conversion to text. The text-editing layer handles Backspace as an editing action.",
          "Start by queueing raw bytes in a fixed-size ring and decoding them outside the interrupt handler. Head and tail positions identify where data is added and removed, and the queue must have a clear full/empty convention. When the consumer falls behind, count dropped bytes instead of silently overwriting unread input. Losing a prefix can leave a partial decoder sequence, so recovery includes resetting that partial state. Use the queue checkpoint to trace wraparound and full behavior before combining the queue with modifier and prefix handling."
        ],
        "teaching": {
          "goal": "Explain why raw keyboard bytes need both a queue and a stateful decoder before they become text.",
          "bridge": "The timer delivers a simple event. Keyboard input adds a byte protocol whose meaning can span several interrupts.",
          "check": {
            "prompt": "A decoder receives a prefix byte, then an overflow drops the following byte. Why might decoding the next ordinary byte as if nothing happened produce the wrong key?",
            "answer": "The decoder may still be waiting for the remainder of the prefixed sequence. It could interpret the next unrelated byte in that context. Reporting overflow and clearing the incomplete sequence prevents that stale state from silently changing later events."
          },
          "takeaway": "Keyboard input becomes text through explicit stages, and partial protocol state must be handled when bytes are lost.",
          "diagramAfter": 2
        }
      },
      {
        "id": "output",
        "title": "Build a console around device behavior",
        "paragraphs": [
          "Our first VGA routine wrote a fixed string at the screen's beginning. A reusable console needs more behavior: a cursor, ordinary character advancement, newline, carriage return, bounds, and scrolling. Decide those rules before adding more output sites. In 80×25 VGA text mode each cell still occupies two bytes, but the console chooses which cell a character changes. When scrolling, rows overlap in memory, so the copy direction or operation must preserve source bytes until they have been moved.",
          "A pixel framebuffer stores a different representation. Pitch is the number of bytes between row starts; it may be larger than width × bytes-per-pixel because rows can include padding. Pixel format tells you how the color channels are encoded. To locate a pixel, compute the row using pitch and then the pixel's offset within that row, after validating the full memory extent. A small bitmap font turns characters into pixel patterns. Keeping a text model in ordinary RAM also lets you redraw or scroll without treating device memory as your only record of the console contents.",
          "Preserve a simple output interface so callers do not need to know whether the backend is VGA, serial, or a framebuffer. The same principle will help replace the PIC with APIC routing later: modern routes need discovered controller information, polarity, trigger mode, and a vector. Keep a minimal panic output path available outside normal console locking, because a fault may interrupt the console itself. Practice calculating one VGA cell and one framebuffer row address to see where the shared behavior meets different device layouts."
        ],
        "teaching": {
          "goal": "Define console behavior separately from the VGA or framebuffer layout that implements it.",
          "bridge": "Input now has layers. Output benefits from the same separation between useful behavior and hardware representation.",
          "check": {
            "prompt": "A framebuffer row contains 640 four-byte pixels but its pitch is 2688 bytes. How far after the base does row 3 begin, using zero-based row numbering, and why is 640 × 4 × 3 wrong?",
            "answer": "Row 3 begins at 3 × 2688 = 8064 bytes. The width calculation gives 7680 and ignores 128 padding bytes per row, so it addresses the wrong memory after the first row."
          },
          "takeaway": "A console defines text behavior; its device backend translates that behavior using the actual hardware layout.",
          "diagramAfter": 2
        }
      },
      {
        "id": "verification",
        "title": "Make latency and overflow visible",
        "paragraphs": [
          "Begin with hardware IRQs masked and verify that deliberate CPU exceptions still report correctly. Then enable only the timer, observe a bounded increase in its event counter, and finally enable keyboard input. This sequence separates a broken entry path from a device-specific problem. Useful counters include received vectors, completed acknowledgments, queue occupancy, dropped bytes, and unexpected events. They give the event path landmarks without requiring expensive printing in every handler.",
          "Predict what happens when you slow the consumer and hold a key. The queue should fill according to its documented convention, then report losses while the kernel remains responsive. A single interrupt followed by silence can suggest a missing acknowledgment; repeated delivery can suggest a device source that was not cleared. Use these clues to select the next observation and confirm the cause. Compare the device state and controller state before choosing a fix.",
          "At the focused checkpoint, implement the bounded queue operations and run the tests for ordinary insertion, removal, wraparound, and overflow behavior. Then connect the same ideas to a live keyboard experiment in your kernel. Finally consider the moment an idle consumer sleeps: work must not arrive between an unprotected empty check and sleep in a way that leaves the consumer asleep indefinitely. The scheduler chapter develops that problem further. For now, explain what protects each queue transition and how your counters would reveal a dropped event."
        ],
        "teaching": {
          "goal": "Use counters and controlled workloads to locate lost input, missing acknowledgments, and queue overflow.",
          "bridge": "The components are in place. We will integrate them gradually so an observation points to a small part of the path.",
          "check": {
            "prompt": "The IRQ count rises by 20, the queue records 6 drops, and the consumer reads 14 bytes after starting empty. Is this accounting internally consistent? What would you investigate if it read only 9?",
            "answer": "The first accounting is consistent because 14 consumed plus 6 dropped equals 20 received, assuming the queue ends empty and each IRQ supplied one byte. With only 9 consumed, inspect remaining occupancy and each stated assumption before concluding that five bytes vanished."
          },
          "takeaway": "A controlled workload plus explicit counters makes a device path explainable from arrival to consumption.",
          "diagramAfter": 2
        }
      }
    ],
    "lab": "interrupts",
    "challenge": {
      "title": "Repair the interrupt input queue",
      "brief": "Build a bounded ring that never overwrites unread bytes and can distinguish full from empty. This host exercise tests sequential operations. In the kernel, protect shared mutations with saved interrupt state; these plain C fields do not create an SMP-safe queue.",
      "language": "c",
      "starter": "#include <stdint.h>\nstruct queue { uint8_t data[8]; unsigned head, tail, lost; };\nvoid put(struct queue *q, uint8_t value) {\n    q->data[q->head] = value;\n    q->head = (q->head + 1) % 8;\n}\n",
      "tasks": [
        "Reserve one slot so equal head and tail means empty.",
        "Return failure and increment a loss counter when the ring is full.",
        "Implement a pop operation that leaves its output unchanged on empty.",
        "Test initial fill and a sequence that wraps around the ring."
      ],
      "hints": [
        "Compute next = (head + 1) % capacity before writing.",
        "Full means next equals tail; empty means head equals tail.",
        "Fill seven entries, remove three, add three, and verify FIFO order across index zero."
      ],
      "solution": "#include <stdint.h>\n#include <stdbool.h>\n#include <assert.h>\nstruct queue { uint8_t data[8]; unsigned head, tail, lost; };\nbool put(struct queue *q, uint8_t value) {\n    unsigned next = (q->head + 1) % 8;\n    if (next == q->tail) { ++q->lost; return false; }\n    q->data[q->head] = value;\n    q->head = next;\n    return true;\n}\nbool get(struct queue *q, uint8_t *out) {\n    if (q->head == q->tail) return false;\n    *out = q->data[q->tail];\n    q->tail = (q->tail + 1) % 8;\n    return true;\n}\nint main(void) {\n    struct queue q = {0}; uint8_t v = 99;\n    assert(!get(&q, &v) && v == 99);\n    for (unsigned i = 0; i < 7; ++i) assert(put(&q, (uint8_t)i));\n    assert(!put(&q, 200) && q.lost == 1);\n    for (unsigned i = 0; i < 3; ++i) {\n        assert(get(&q, &v)); assert(v == i);\n    }\n    for (unsigned i = 7; i < 10; ++i) assert(put(&q, (uint8_t)i));\n    for (unsigned i = 3; i < 10; ++i) {\n        assert(get(&q, &v)); assert(v == i);\n    }\n    assert(!get(&q, &v));\n    return 0;\n}\n",
      "explanation": "The reserved slot removes the full/empty ambiguity at the cost of one byte of capacity. Failed insertion does not move head, so existing unread bytes remain intact. This proves an algorithmic invariant only; the kernel still needs a synchronization protocol matching its interrupt and CPU model.",
      "checks": [
        "The complete host assertion program passes, including wraparound.",
        "A deliberately slow kernel consumer increments the drop counter without hanging.",
        "Timer delivery continues while keyboard input is processed.",
        "You can distinguish device acknowledgment from PIC EOI in your handler."
      ]
    },
    "reflection": {
      "prompt": "A keyboard interrupt fires exactly once. List three possible causes at different layers, and describe the smallest observation that distinguishes each one.",
      "rubric": [
        "Covers device, controller, and CPU/entry-state layers",
        "Does not send EOI indiscriminately as the only proposed fix",
        "Uses counters or register state to isolate the failure"
      ],
      "modelAnswer": "The device data may remain unread, the PIC in-service state may remain set because EOI was omitted, or the return frame may leave IF disabled. I would record whether port 0x60 was read after a valid status bit, inspect the relevant PIC in-service bit with a controlled diagnostic, and inspect EFLAGS after IRETD. A fourth possibility is an accidentally restored mask. Each check belongs to a different boundary and should be performed without adding blocking work to the IRQ handler."
    },
    "sources": [
      {
        "title": "Intel Software Developer Manuals: architectural reference",
        "url": "https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html"
      },
      {
        "title": "OSDev learning companion: 8259 PIC",
        "url": "https://wiki.osdev.org/8259_PIC"
      },
      {
        "title": "OSDev learning companion: PIT",
        "url": "https://wiki.osdev.org/Programmable_Interval_Timer"
      },
      {
        "title": "UEFI specification: console and graphics output protocols",
        "url": "https://uefi.org/specs/UEFI/2.10/12_Protocols_Console_Support.html"
      }
    ],
    "nextBuild": "Keep interrupts short and measurable. The next layer turns the reserved physical-memory map into a page allocator."
  },
  {
    "id": "05",
    "slug": "physical-memory",
    "title": "Make every physical page accountable",
    "subtitle": "Build a bitmap allocator that cannot confuse reserved, free, and owned memory.",
    "phase": "Memory",
    "minutes": 135,
    "prerequisites": [
      "A normalized firmware map with explicit reservations",
      "Safe integer range arithmetic and bit operations"
    ],
    "outcomes": [
      "Calculate bitmap storage for a physical address range",
      "Initialize allocation state conservatively and reserve the allocator itself",
      "Allocate and free frames with defined exhaustion and double-free behavior",
      "Separate page ownership from virtual mappings",
      "Design meaningful adversarial allocator tests"
    ],
    "sections": [
      {
        "id": "unit",
        "title": "What a physical frame allocator returns",
        "paragraphs": [
          "The physical memory manager, or PMM, allocates frames: fixed-size aligned pieces of physical RAM. We use 4096-byte frames, so frame 6 begins at physical address 6 × 4096 = 0x6000. A frame provides physical storage; object allocation and process mappings give it additional roles. The virtual memory manager will decide where that storage appears in an address space, and the heap will later divide mapped storage into smaller objects. Keeping those jobs separate makes this first allocator small enough to reason about.",
          "A bitmap stores one yes-or-no value per frame in a single bit. A bit index selects the frame; dividing by eight selects its bitmap byte, and the remainder selects the bit within that byte. We use two ideas: eligible means the frame is allowed to participate in allocation, while busy means it is not currently free. This distinction matters during release. A frame containing firmware or the kernel must not become available merely because somebody passes its address to a free operation.",
          "For N frames, one bitmap needs ceil(N / 8) bytes. Managing 4 GiB with 4 KiB frames means 1,048,576 frame bits, or 128 KiB for each bitmap. Those metadata bytes themselves occupy RAM and must be reserved. Our smaller teaching implementation limits the managed range to match the initial machine. Before reading its scan loop, sketch a twelve-frame pool with two reserved holes and mark eligible and busy independently. Then walk through the first allocation and explain exactly which bit changes."
        ],
        "teaching": {
          "goal": "Translate frame numbers into physical addresses and explain the two bitmap states used by the allocator.",
          "bridge": "Memory discovery gave us safe ranges. We now need a way to give one caller a page without giving the same page to another.",
          "check": {
            "prompt": "A pool has 24 frames. How many bytes does one bitmap require? What physical address corresponds to frame 11 when frames are 4096 bytes?",
            "answer": "One bitmap needs 24 ÷ 8 = 3 bytes. Frame 11 begins at 11 × 4096 = 45056, or 0xB000. Two separate bitmaps require six bytes before any surrounding metadata or alignment."
          },
          "takeaway": "The PMM hands out physical frames; its metadata must distinguish available RAM from live allocations and permanent reservations.",
          "diagramAfter": 2
        }
      },
      {
        "id": "initialization",
        "title": "Start unavailable and prove pages free",
        "paragraphs": [
          "An allocator can have a perfect search loop and still return unsafe memory if initialization marked the wrong frames free. Begin with every busy bit set and every eligibility bit clear. Then apply normalized usable ranges, followed by all reservations. This gives reservations the final say regardless of the firmware record order. Only after that preparation is complete should a runtime caller be allowed to request a frame.",
          "List the memory already in use at boot: the kernel's instructions and data, .bss, stacks, boot information, bitmap storage, existing page tables, and any loaded modules. If any live byte touches a frame, reserve the whole frame. The reference manages at most 32 MiB, and its boot helpers accept half-open intervals expressed as frame numbers. Convert and round ranges before calling them. Addresses above the cap stay unmanaged; they must not wrap around into a low bitmap index.",
          "The runtime interface separates success from the returned physical address by using a boolean result and an output parameter. This lets failure leave the output unchanged and avoids overloading a particular address as a universal error value. We still reserve frame zero as an explicit policy. The first-fit scan chooses the first eligible free frame, marks it busy, and reports its address. Do not rerun boot reservation helpers after allocation has begun: they do not know which existing caller owns a live frame. Practice the setup on your small pool before turning to the executable checkpoint's smaller API."
        ],
        "code": {
          "language": "c",
          "filename": "pmm.c: serialized uniprocessor implementation",
          "source": "#include <stdint.h>\n#include <stdbool.h>\n#define FRAME_BYTES 4096u\n#define FRAME_COUNT 8192u\n#define BITMAP_BYTES ((FRAME_COUNT + 7u) / 8u)\nstatic uint8_t eligible[BITMAP_BYTES], busy[BITMAP_BYTES];\nstatic bool bit(const uint8_t *map, uint32_t i) {\n    return (map[i / 8] & (uint8_t)(1u << (i % 8))) != 0;\n}\nstatic void set(uint8_t *map, uint32_t i, bool value) {\n    uint8_t mask = (uint8_t)(1u << (i % 8));\n    if (value) map[i / 8] |= mask;\n    else map[i / 8] &= (uint8_t)~mask;\n}\nvoid pmm_boot_begin(void) {\n    for (uint32_t i = 0; i < BITMAP_BYTES; ++i) {\n        eligible[i] = 0;\n        busy[i] = 0xff;\n    }\n}\nbool pmm_boot_usable(uint32_t first, uint32_t end) {\n    if (first > end || end > FRAME_COUNT) return false;\n    for (uint32_t i = first; i < end; ++i) {\n        set(eligible, i, true); set(busy, i, false);\n    }\n    return true;\n}\nbool pmm_boot_reserve(uint32_t first, uint32_t end) {\n    if (first > end || end > FRAME_COUNT) return false;\n    for (uint32_t i = first; i < end; ++i) {\n        set(eligible, i, false); set(busy, i, true);\n    }\n    return true;\n}\nbool pmm_alloc(uint32_t *physical) {\n    if (!physical) return false;\n    for (uint32_t i = 0; i < FRAME_COUNT; ++i) {\n        if (bit(eligible, i) && !bit(busy, i)) {\n            set(busy, i, true);\n            *physical = i * FRAME_BYTES;\n            return true;\n        }\n    }\n    return false;\n}\nbool pmm_free(uint32_t physical) {\n    if (physical % FRAME_BYTES != 0) return false;\n    uint32_t i = physical / FRAME_BYTES;\n    if (i >= FRAME_COUNT || !bit(eligible, i) || !bit(busy, i))\n        return false;\n    set(busy, i, false);\n    return true;\n}\n"
        },
        "teaching": {
          "goal": "Build the initial free-frame set from usable ranges and reservations before permitting allocations.",
          "bridge": "The bitmap representation is clear. Its starting contents decide whether every later allocation is safe.",
          "check": {
            "prompt": "You process one usable range, reserve the kernel, and then process an overlapping usable range that marks those bits free again. What ordering error occurred, and how should initialization be organized?",
            "answer": "The later usable pass undid a live reservation. Collect all usable candidates first and apply all reservations afterward, or use an equivalent representation where reserved status cannot be overridden by input order. Allocations start only after that complete result is ready."
          },
          "takeaway": "Allocator initialization is finished only when every live boot region has been removed from the candidate free frames.",
          "diagramAfter": 2
        }
      },
      {
        "id": "concurrency",
        "title": "Claim a frame without giving it to two callers",
        "paragraphs": [
          "Imagine caller A finds a free bit and is interrupted before setting it. Caller B scans the same bitmap, finds the same bit, and returns that frame. When A resumes, it also sets the bit and returns the frame. The bitmap contains a single busy bit, yet two callers believe they own the memory. The error lies between observation and claim. Protecting only the final store is not enough if the decision was made from stale state.",
          "For this single-CPU kernel, use a defined allocator critical section that saves and disables local interrupts, then restores the saved state afterward. If interrupts were already disabled on entry, the allocator must leave them disabled on exit. An ordinary spinlock alone can deadlock when an interrupt handler waits for the same lock held by the code it interrupted. On multiple CPUs, local interrupt masking is insufficient because another core still runs; the shared metadata also needs an inter-core synchronization mechanism. Counters and ownership records belong to the same protected update as the bit claim.",
          "Frame initialization is another part of the handoff. A kernel-only caller may accept uninitialized storage, but memory exposed to a new user process must not reveal the previous owner's bytes. Choose which layer zeroes it and when the page becomes visible. Once identity mapping ends, a physical address cannot simply be cast to a pointer for memset; a direct or temporary virtual mapping must provide access. Trace claim, preparation, and publication as separate steps so the next owner never observes partially prepared storage."
        ],
        "teaching": {
          "goal": "Explain why finding and claiming a free frame must be one protected operation.",
          "bridge": "One allocation works in a straight-line trace. Interrupts and additional CPUs introduce another caller between those steps.",
          "check": {
            "prompt": "An allocator saves IF=0, performs a successful allocation, then executes STI before returning. What caller expectation did it violate?",
            "answer": "The caller entered with maskable interrupts disabled, possibly while updating another shared structure. Unconditionally enabling them changes that surrounding critical section. The allocator must restore the interrupt state captured on entry."
          },
          "takeaway": "Allocation is a protected decision-and-update sequence, followed by whatever preparation is required before the new owner can use the frame.",
          "diagramAfter": 2
        }
      },
      {
        "id": "ownership",
        "title": "A mapping does not own a frame by default",
        "paragraphs": [
          "A virtual mapping provides access to a frame. Track frame ownership separately because several users may share that storage. Two virtual addresses, possibly in different processes, can map the same storage. Removing one mapping does not make the frame free while another user still depends on it. Conversely, a frame can be allocated before it has a usable virtual mapping, as when preparing a new page table. Shared memory therefore needs explicit ownership or reference accounting in addition to page-table entries.",
          "Another distinction appears when a caller requests several frames. Four successful single-frame allocations produce four frames, but there may be reserved or busy holes between them. A device's DMA request may need one physically contiguous run, a particular alignment, or an address ceiling. That is a different allocator operation. A run allocator must find and validate the complete candidate interval and claim it under the same synchronization; failure should not leave an unexpected partial run allocated.",
          "Use accounting that explains the represented states. Among eligible frames, free plus allocated should equal eligible. Count reserved frames separately from this equation. A debugging owner tag can tell you which subsystem holds each allocated frame, making a leak more informative than a shrinking free total. Practice releasing a shared frame: enumerate all users, remove their references, and explain the event after which returning it to the allocator is justified."
        ],
        "teaching": {
          "goal": "Separate a frame’s lifetime from its mappings and distinguish individual-frame allocation from a contiguous-run request.",
          "bridge": "We can allocate safely. We now need to decide when an allocated frame has really become available again.",
          "check": {
            "prompt": "A frame is shared by two processes. Process A removes its mapping while process B still reads it. What could happen if A immediately returns the frame to the PMM?",
            "answer": "The PMM may give the frame to an unrelated caller, whose writes become visible through B’s still-live mapping. B could also corrupt the new owner. Reuse must wait until the lifetime accounting and mapping removal establish that no remaining user can access it."
          },
          "takeaway": "Reuse a frame after all of its owners and access paths have released it.",
          "diagramAfter": 2
        }
      },
      {
        "id": "test",
        "title": "Test the invariant until the pool is empty",
        "paragraphs": [
          "Use a tiny synthetic pool before relying on the full firmware map. Give it a few reserved holes, allocate until the API reports exhaustion, and record each result. Every returned frame must be in range, aligned, unique among live allocations, and outside the reserved set. Exhaustion should be an ordinary result that leaves metadata and output arguments in their documented state. A single successful allocate/free pair cannot reveal duplicate allocation or a bad end-of-pool scan.",
          "Next free alternating live frames and allocate again. The new results should come only from the holes you released, with placement following the allocator's stated policy. Try an unaligned address, an address beyond the pool, a reserved frame, and a repeated release before reallocation. Compare the metadata before and after each rejected operation. Rejection is useful only if it also leaves the pool intact; a false result after an accidental bit change is still a bug.",
          "The chapter checkpoint focuses on allocation and release in a small pool with specified reserved frames. Use its public API and cases to practice those transitions. When integrating the full PMM, repeat the experiment with partially covered pages and overlapping firmware reservations, because initialization adds a separate source of errors. Place diagnostic canaries around the bitmaps and keep an emergency log buffer outside the allocator. If allocation fails, reporting that failure should not need another successful allocation."
        ],
        "teaching": {
          "goal": "Construct allocation tests that expose duplicates, reserved-frame reuse, failure mutation, and initialization mistakes.",
          "bridge": "The allocator’s rules are now precise enough to turn into a small sequence with a predictable result.",
          "check": {
            "prompt": "A test pool has 10 eligible frames. You allocate all ten, release three, then successfully allocate four more without another release. What invariant proves something is wrong?",
            "answer": "Only three eligible frames became free. Four successful new claims imply a duplicate allocation or corrupted accounting. The live allocated count cannot exceed the ten eligible frames, and each live result must be unique."
          },
          "takeaway": "Exhaustion, reuse, and rejected operations reveal allocator mistakes that a happy-path pair can miss.",
          "diagramAfter": 2
        }
      }
    ],
    "lab": "memory",
    "challenge": {
      "title": "Prove that a frame is never handed out twice",
      "brief": "Repair a sixteen-frame bitmap allocator. Reserve frames 0 and 3, exhaust the remaining pool, then test reuse and invalid release. The standalone solution checks the invariant without needing QEMU.",
      "language": "c",
      "starter": "#include <stdint.h>\nstatic uint16_t used = 0x0009;\nint alloc_frame(void) {\n    for (int i = 0; i < 16; ++i)\n        if (!(used & (1u << i))) return i;\n    return -1;\n}\nvoid release_frame(int frame) { used &= ~(1u << frame); }\n",
      "tasks": [
        "Make allocation actually claim the frame.",
        "Keep reserved frames unavailable even if release is called on them.",
        "Reject negative, out-of-range, and double releases.",
        "Exhaust the pool and verify every successful allocation is unique."
      ],
      "hints": [
        "The returned frame must be marked before returning.",
        "Use a separate immutable reserved mask in this small model.",
        "Validate the index before shifting; shifting by a negative or excessive count is undefined behavior."
      ],
      "solution": "#include <stdint.h>\n#include <stdbool.h>\n#include <assert.h>\nstatic const uint16_t reserved = 0x0009u;\nstatic uint16_t used = 0x0009u;\nint alloc_frame(void) {\n    for (int i = 0; i < 16; ++i) {\n        uint16_t mask = (uint16_t)(1u << i);\n        if (!(used & mask)) { used |= mask; return i; }\n    }\n    return -1;\n}\nbool release_frame(int frame) {\n    if (frame < 0 || frame >= 16) return false;\n    uint16_t mask = (uint16_t)(1u << frame);\n    if ((reserved & mask) || !(used & mask)) return false;\n    used &= (uint16_t)~mask;\n    return true;\n}\nint main(void) {\n    uint16_t seen = 0;\n    for (int n = 0; n < 14; ++n) {\n        int f = alloc_frame(); assert(f >= 0);\n        uint16_t mask = (uint16_t)(1u << f);\n        assert(!(seen & mask) && !(reserved & mask)); seen |= mask;\n    }\n    assert(alloc_frame() == -1);\n    assert(!release_frame(0) && !release_frame(3));\n    assert(!release_frame(-1) && !release_frame(16));\n    assert(release_frame(5)); assert(!release_frame(5));\n    assert(alloc_frame() == 5); assert(alloc_frame() == -1);\n    return 0;\n}\n",
      "explanation": "The allocation transition is free → busy before the address escapes. Release validates both eligibility and present ownership. The proof is conditional on serialized calls; use a lock or interrupt discipline when integrating with the kernel.",
      "checks": [
        "Exactly fourteen unique frames are allocated before exhaustion.",
        "Reserved frames never appear in successful allocations.",
        "A failed release leaves state unchanged.",
        "Releasing frame 5 makes precisely that frame available again."
      ]
    },
    "reflection": {
      "prompt": "A process maps the same physical frame twice. It unmaps one address and the kernel immediately frees the frame. Another process now receives it. Explain the resulting bug and identify which layer must track what.",
      "rubric": [
        "Distinguishes virtual mappings, physical ownership, and reference lifetime",
        "Explains corruption or information leakage after reuse",
        "Assigns responsibilities explicitly"
      ],
      "modelAnswer": "The second mapping still refers to the frame, so reuse creates concurrent ownership and potentially exposes another process’s data. The VMM tracks mappings and removes one translation; the frame or backing-object lifetime manager tracks remaining references; the PMM releases the frame only after the last owning reference disappears. A TLB invalidation is necessary for translation correctness but cannot replace reference accounting."
    },
    "sources": [
      {
        "title": "Intel Software Developer Manuals: architectural reference",
        "url": "https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html"
      },
      {
        "title": "OSDev learning companion: page-frame allocation",
        "url": "https://wiki.osdev.org/Page_Frame_Allocation"
      }
    ],
    "nextBuild": "Connect the PMM to a virtual-memory layer without assuming every physical address remains a valid C pointer."
  },
  {
    "id": "06",
    "slug": "virtual-memory",
    "title": "Translate addresses and enforce boundaries",
    "subtitle": "Construct page tables, explain page faults, and make stale translations visible.",
    "phase": "Memory",
    "minutes": 150,
    "prerequisites": [
      "A physical-frame allocator and exception handler",
      "Bit extraction, page alignment, and physical versus virtual addresses"
    ],
    "outcomes": [
      "Walk a two-level 32-bit paging translation by hand",
      "Build aligned page tables and safely enable paging",
      "Combine permissions across directory and table entries",
      "Decode page-fault evidence without treating every fault as a missing page",
      "Invalidate stale translations before reusing mappings or frames"
    ],
    "sections": [
      {
        "id": "walk",
        "title": "One address, three fields, two memory reads",
        "paragraphs": [
          "Until now, our flat segments and disabled paging made useful linear addresses numerically match physical addresses. Paging adds a translation step. In this chapter we use 32-bit non-PAE paging with 4 KiB pages. Split an address into three fields: ten bits choose a page-directory entry, ten choose a page-table entry, and twelve select a byte within the final page. The twelve-bit offset spans 4096 positions, explaining why it matches our frame size.",
          "CR3 identifies the physical page containing the directory. Each present directory entry points to a physical page table, and each present table entry points to a data frame. For address 0x00805234, the directory index is 2, table index is 5, and offset is 0x234. If that walk selects frame 0x00678000, the byte resides at physical address 0x00678234. Draw the two table-entry fetches and the final translated data access as three separate addresses.",
          "The processor caches translations in the Translation Lookaside Buffer, or TLB, so repeated accesses need not repeat every table fetch. Page tables describe the mapping, while the cache speeds up using it. We will need to invalidate cached information when mappings change. For now, practice extracting indices with shifts and masks, then perform a walk using actual entry values. Remember that the address stored in an entry is physical; the C pointer used by the kernel to edit that table depends on whatever virtual mapping gives it access."
        ],
        "teaching": {
          "goal": "Translate one 32-bit linear address through a directory and table to its physical byte.",
          "bridge": "The PMM gives us physical storage. Paging lets us choose which virtual addresses refer to that storage.",
          "check": {
            "prompt": "For virtual address 0x00C07456, find the directory index, table index, and offset. If its table entry selects frame 0x01234000, what physical address results?",
            "answer": "The directory index is 3, the table index is 7, and the offset is 0x456. Combining that offset with the selected frame gives 0x01234456. The index fields select the entries, and the offset field selects the byte within the resulting frame."
          },
          "takeaway": "A page walk selects a frame through two indexed tables, then preserves the offset within the page.",
          "diagramAfter": 2
        }
      },
      {
        "id": "bootstrap",
        "title": "Map the instructions that turn mapping on",
        "paragraphs": [
          "Enabling paging changes how the CPU interprets subsequent linear memory accesses. The instruction after setting CR0.PG still has to be fetched, and the next stack access still has to reach valid storage. If the new tables omit either address, the transition fails immediately. An identity mapping is a convenient bridge: it maps a virtual address to the same numerical physical address, so existing low-address code can continue while translation becomes active.",
          "The reference constructs a directory and one table mapping the first 4 MiB as supervisor-writable pages, except for page zero. This covers the low-loaded kernel, its current stack, descriptors, and diagnostic output in the stated setup. The table pages themselves must be 4096-byte aligned and reserved from the PMM. Before paging is active, their linked low addresses are usable as physical addresses; verify both alignment and load locations in the linker map.",
          "After pointing CR3 at the directory, the code enables paging and write protection through CR0. WP makes supervisor writes respect read-only page permissions, which later helps catch kernel mistakes. This bootstrap map covers the first 4 MiB; additional RAM requires additional mappings. Its non-PAE entry format also has no NX permission for forbidding instruction fetches. Draw every address needed for the transition, check each against the map, and then explain why leaving page zero absent is useful for detecting null-pointer accesses."
        ],
        "code": {
          "language": "c",
          "filename": "paging_bootstrap.c",
          "source": "#include <stdint.h>\n#include <stddef.h>\n#define PAGE_P  0x001u\n#define PAGE_RW 0x002u\nstatic uint32_t directory[1024] __attribute__((aligned(4096)));\nstatic uint32_t low_table[1024] __attribute__((aligned(4096)));\n\nvoid paging_enable_low_identity(void) {\n    /* Requires paging off; code, stack, tables, GDT/IDT all below 4 MiB. */\n    for (size_t i = 0; i < 1024; ++i) {\n        directory[i] = 0;\n        low_table[i] = ((uint32_t)i * 4096u) | PAGE_P | PAGE_RW;\n    }\n    low_table[0] = 0; /* Deliberately leave null dereferences unmapped. */\n    directory[0] = (uint32_t)(uintptr_t)low_table | PAGE_P | PAGE_RW;\n    uint32_t cr3 = (uint32_t)(uintptr_t)directory;\n    __asm__ volatile(\"mov %0, %%cr3\" : : \"r\"(cr3) : \"memory\");\n    uint32_t cr0;\n    __asm__ volatile(\"mov %%cr0, %0\" : \"=r\"(cr0));\n    cr0 |= (1u << 31) | (1u << 16); /* PG and WP */\n    __asm__ volatile(\"mov %0, %%cr0\" : : \"r\"(cr0) : \"memory\");\n}\nvoid invalidate_page(uintptr_t virtual_address) {\n    __asm__ volatile(\"invlpg (%0)\" : : \"r\"(virtual_address) : \"memory\");\n}\n"
        },
        "teaching": {
          "goal": "Explain why enabling paging requires mappings for the code and stack already in use.",
          "bridge": "A page walk makes sense on paper. The first live transition must preserve the machine’s next instruction and current stack.",
          "check": {
            "prompt": "Your initial tables map the first 4 MiB, but ESP points at 0x00500000. Why might setting PG appear to work for an instruction or two and then fault?",
            "answer": "The current instruction stream may still be mapped, but a push, call, or other stack access uses the unmapped stack address. Successful instruction fetch after the switch does not establish that every immediately required data address is mapped."
          },
          "takeaway": "The first paging map must preserve all live code, stack, tables, and device accesses across the transition.",
          "diagramAfter": 2
        }
      },
      {
        "id": "permissions",
        "title": "Permissions are checked through the whole walk",
        "paragraphs": [
          "A present mapping answers only whether translation has an entry; it does not imply that every caller may read or write it. In this paging mode, access permissions combine across the directory and table levels. A user access needs the user/supervisor permission at both levels. A user-capable PTE cannot make a supervisor-only PDE permissive. Read/write restrictions also combine, and the effect of read-only mappings on supervisor writes depends on CR0.WP. Read the whole route before deciding whether an access should succeed.",
          "This lets each process contain kernel mappings without allowing user code to access them. Shared supervisor-only kernel mappings simplify entry into the kernel during syscalls and interrupts. A higher-half layout can give the kernel stable high virtual addresses while placing its physical frames elsewhere. That introduces three distinct numbers to track: where bytes are loaded physically, where symbols are linked virtually, and any temporary identity mappings used during boot. The page tables connect those views.",
          "Entries also carry information beyond permissions. The processor can set accessed and dirty bits, and cache-control fields help describe how memory should be treated. When updating an entry, preserve or deliberately handle each of these state fields. Choose a memory type that matches the device’s access requirements. Make a small table of PDE and PTE permissions to predict one allowed read, one rejected user access, and one rejected write before trying those cases in the kernel."
        ],
        "teaching": {
          "goal": "Determine access permission from the combined directory and table permissions.",
          "bridge": "Address translation chooses storage. Page permissions decide which accesses to that storage are allowed.",
          "check": {
            "prompt": "A PDE is present and supervisor-only. Its PTE is present, writable, and user-accessible. Can ring 3 read the page? Which level determines the answer?",
            "answer": "Ring 3 cannot read it because user permission is required through both levels. The restrictive PDE remains effective even though the leaf entry is more permissive."
          },
          "takeaway": "Permissions apply through the complete translation path; a permissive leaf cannot override a restrictive parent.",
          "diagramAfter": 2
        }
      },
      {
        "id": "faults",
        "title": "A page fault is structured evidence",
        "paragraphs": [
          "Page faults arrive at vector 14. Capture CR2, which identifies the faulting linear address, and retain the supplied error code before doing complex work. The error code distinguishes a non-present translation from a protection violation and includes information such as read versus write and user versus supervisor. Other bits depend on the paging mode and supported features. Decode the relevant fields alongside the saved EIP so the report describes both the attempted address and the instruction making the attempt.",
          "The same event can have different meanings. Accessing a valid lazily allocated process region may legitimately request a new zero-filled page. Accessing an unmapped guard page may mean the stack overflowed. A kernel pointer into an unrelated range may reveal a bug. The page tables alone do not say which missing regions are allowed to grow; the kernel needs a policy describing valid virtual areas. Allocating a page for every fault would turn many invalid pointers into apparently successful memory accesses.",
          "For a recoverable fault, prepare the backing storage and complete the mapping before returning to retry the instruction. Clear memory before exposing it to a user process, and undo newly acquired resources if a later allocation or mapping step fails. The fault handler itself needs a valid stack and a diagnostic path that will not immediately fault for the same reason. Practice by writing an expected report for a null access, a write to a read-only page, and an allowed demand-allocation address. Each should lead to a different explanation even though all enter vector 14."
        ],
        "teaching": {
          "goal": "Read a page-fault report and decide whether the access should be repaired or rejected.",
          "bridge": "We can predict permitted accesses. A page fault tells us when the actual access could not satisfy the mapping rules.",
          "check": {
            "prompt": "A process faults on an unmapped address just beyond its permitted heap, while another address inside a valid lazy region is also unmapped. Why should “present bit is zero” not make the handler treat them identically?",
            "answer": "The bit describes the failed translation. A separate ownership check determines whether the process is entitled to memory there. The virtual-area policy can permit backing allocation for the lazy region and reject the address outside the heap. Mapping both would erase that boundary."
          },
          "takeaway": "A page-fault handler combines hardware evidence with the address-space policy before deciding to repair or reject an access.",
          "diagramAfter": 2
        }
      },
      {
        "id": "tlb",
        "title": "Change a mapping without leaving stale access",
        "paragraphs": [
          "Suppose a virtual page maps frame A and the CPU has cached that translation. You replace its PTE with frame B. A later access may still use the old cached result unless you perform the required invalidation. INVLPG targets a virtual page on the current processor. Reloading CR3 has broader effects under the relevant paging configuration, but features such as global pages affect exactly what is retained. Choose an operation that matches the mapping change instead of assuming a memory store alone updates every user of the table.",
          "Now consider freeing frame A immediately after changing the PTE. If a stale translation still reaches A, another allocation can reuse it while the old virtual address remains able to read or overwrite its new contents. Safe replacement therefore has a lifetime sequence: serialize the table update, install the new entry, invalidate relevant cached translations, and delay reuse until no stale access remains possible. On multiple CPUs, that includes a shootdown request and acknowledgment from affected processors. Reference counts and TLB synchronization solve different parts of the problem.",
          "Make the mechanism visible with two frames holding different marker bytes at the same offset. Map A, read its marker, replace the mapping with B, invalidate, and read again. Then make a page read-only with WP enabled and check that a deliberate write produces the expected fault. The chapter's focused translation exercise tests index extraction and walk behavior; these live remapping experiments test the interaction with processor state. Both are more informative than checking only that the kernel still prints after enabling paging."
        ],
        "teaching": {
          "goal": "Explain why replacing a page-table entry is incomplete until stale translations can no longer be used.",
          "bridge": "The tables can change after paging starts. The translation cache adds one more participant to that change.",
          "check": {
            "prompt": "A virtual page once pointed to frame A. You remove its PTE and give A to another subsystem before invalidating the old translation. What access could still violate the new owner’s isolation?",
            "answer": "The CPU may still use the cached old translation for the original virtual address and reach A. A read can expose the new owner’s data, and a write can corrupt it. Complete the required invalidation so the old translation can no longer reach the released frame."
          },
          "takeaway": "Complete unmapping by clearing the entry, synchronizing translation caches, and resolving frame lifetime.",
          "diagramAfter": 2
        }
      }
    ],
    "lab": "paging",
    "challenge": {
      "title": "Walk the page tables without guessing",
      "brief": "Repair a pure translation model. The model covers present bits, a supplied PDE/PTE pair, and the final physical address. Prove it with the worked address before integrating page-table writes.",
      "language": "c",
      "starter": "#include <stdint.h>\nuint32_t translate(uint32_t virtual_address, uint32_t pte) {\n    return pte + (virtual_address & 0xffffu);\n}\n",
      "tasks": [
        "Extract directory and table indices and the 12-bit offset.",
        "Reject a missing PDE or PTE without changing the output argument.",
        "Mask entry flags away from the physical frame address.",
        "Add a test where low flag bits are set, so a naive addition fails."
      ],
      "hints": [
        "A 4 KiB offset occupies bits 0–11.",
        "The two indices use (address >> 22) and (address >> 12), each masked to 10 bits.",
        "Use frame = pte & 0xFFFFF000, then OR the offset."
      ],
      "solution": "#include <stdint.h>\n#include <stdbool.h>\n#include <assert.h>\nunsigned pd_index(uint32_t v) { return (v >> 22) & 0x3ffu; }\nunsigned pt_index(uint32_t v) { return (v >> 12) & 0x3ffu; }\nbool translate(uint32_t v, uint32_t pde, uint32_t pte, uint32_t *out) {\n    if (!out || !(pde & 1u) || !(pte & 1u)) return false;\n    /* This model only supports 4 KiB pages, not PDE large pages. */\n    if (pde & (1u << 7)) return false;\n    *out = (pte & 0xfffff000u) | (v & 0xfffu);\n    return true;\n}\nint main(void) {\n    uint32_t v = 0x0040307au, p = 0;\n    assert(pd_index(v) == 1 && pt_index(v) == 3);\n    assert(translate(v, 0x00102003, 0x00345067, &p));\n    assert(p == 0x0034507au);\n    p = 0xdeadbeefu;\n    assert(!translate(v, 0x00102003, 0, &p));\n    assert(p == 0xdeadbeefu);\n    assert(!translate(v, 0, 0x00345003, &p));\n    return 0;\n}\n",
      "explanation": "The PTE’s low twelve bits hold attributes; mask them out when extracting the frame address. The model intentionally does not perform memory reads, permission checking, TLB behavior, or large-page translation. Its narrow contract makes the arithmetic independently testable and leaves the architectural cases explicit.",
      "checks": [
        "The worked virtual address resolves to 0x0034507A.",
        "Missing entries fail without modifying the output.",
        "A real null-page access reports CR2=0 through the kernel fault path.",
        "Remapping a test page changes its observed marker after invalidation."
      ]
    },
    "reflection": {
      "prompt": "A debugger shows the correct new PTE, but the kernel still reads the old frame’s marker. Give a plausible explanation and explain why simply freeing the old frame makes the situation worse.",
      "rubric": [
        "Distinguishes the in-memory PTE from cached translation",
        "Names current and remote CPU invalidation requirements",
        "Connects stale translation to unsafe frame reuse"
      ],
      "modelAnswer": "The CPU may still have the old translation cached in its TLB. The mapping update needs the correct invalidation in the active address space, and an SMP kernel must coordinate every CPU that could use it. Freeing the old frame before that completes allows stale accesses to hit a new owner’s memory. The frame can be reused only after both mapping references and translation-cache users are gone."
    },
    "sources": [
      {
        "title": "Intel Software Developer Manuals: architectural reference",
        "url": "https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html"
      },
      {
        "title": "OSDev learning companion: paging",
        "url": "https://wiki.osdev.org/Paging"
      }
    ],
    "nextBuild": "Use the VMM to back a bounded kernel arena, then separate object allocation from frame allocation."
  },
  {
    "id": "07",
    "slug": "kernel-heap",
    "title": "Turn pages into useful objects",
    "subtitle": "Implement kmalloc and kfree, then measure fragmentation instead of guessing.",
    "phase": "Memory",
    "minutes": 150,
    "prerequisites": [
      "PMM allocation and a stable writable virtual-memory arena",
      "Pointer arithmetic, alignment, and ownership discipline"
    ],
    "outcomes": [
      "Separate virtual arena growth from allocation within an arena",
      "Implement aligned first-fit allocation, splitting, and coalescing",
      "Reject zero, overflow, invalid-free, and double-free edge cases deliberately",
      "Explain external versus internal fragmentation with a trace",
      "Distinguish a kernel heap from process brk/sbrk semantics"
    ],
    "sections": [
      {
        "id": "layers",
        "title": "Three allocators answer three different questions",
        "paragraphs": [
          "A thread record might need a few hundred bytes, while a queue node may need only a few dozen. Giving each one a separate 4096-byte frame would waste space and mix object-layout decisions into the physical allocator. The heap solves this by subdividing a mapped region, or arena, into object-sized blocks. The PMM chooses physical storage, the VMM makes it accessible at virtual addresses, and the heap chooses a suitably aligned part of that accessible storage for the caller.",
          "Begin with one fixed arena so we can understand object allocation without simultaneously implementing page-table growth. Each block has a header, which records allocator information, and a payload, which belongs to the caller. Our list follows address order through both free and allocated blocks. A first-fit search walks from the start and chooses the first free block large enough for the request. The simple list makes it possible to draw every state after an allocation or release, even though a larger production allocator may use different structures for speed.",
          "The API also needs decisions for unusual requests. In this implementation, kmalloc(0) returns null, successful payloads are 16-byte aligned, and a failed allocation leaves the heap unchanged. kfree(NULL) succeeds; an invalid pointer or a repeated free is rejected. These rules let callers reason about failure without inspecting private headers. Before reading the implementation, draw an arena with one free block, then place one small allocation inside it and label which bytes the caller may write. The header remains the allocator's data."
        ],
        "teaching": {
          "goal": "Explain how a heap serves small C allocations using storage supplied by the PMM and VMM.",
          "bridge": "We can acquire frames and map pages. Many kernel data structures occupy only a small portion of a page.",
          "check": {
            "prompt": "A caller requests 40 bytes. Why is returning a whole physical frame directly a different interface from kmalloc, and which layers would normally make the resulting payload pointer usable?",
            "answer": "A frame request returns physical storage at page granularity. kmalloc returns an aligned virtual payload range sized for an object. The PMM supplies frames, the VMM maps them, and the heap subdivides that mapped arena so the C pointer reaches the intended bytes."
          },
          "takeaway": "A heap manages objects inside mapped memory; it does not replace physical allocation or virtual mapping.",
          "diagramAfter": 2
        }
      },
      {
        "id": "implementation",
        "title": "Split only when the remainder can be useful",
        "paragraphs": [
          "Start with size rounding. A 16-byte alignment means requests use payload capacities that are multiples of 16: a 35-byte request needs 48 bytes of aligned capacity. Check for arithmetic overflow before adding the alignment adjustment. The reference targets i686 with a 16-byte header and a 16 KiB aligned arena. Keeping both headers and payload sizes aligned means each newly split block begins at an address satisfying the same rule as the first.",
          "Suppose a free block has 128 bytes of payload capacity and the rounded request needs 48. Splitting consumes those 48 bytes and a new 16-byte header, leaving 64 bytes for the following free payload. A split is useful only if the remainder can hold its header and a minimum payload. Otherwise give the caller the whole original block and accept some unused capacity inside it. Trace the addresses of the original header, returned payload, and new header before changing any list links.",
          "Freeing reverses the ownership of a block, but it also offers a chance to coalesce: merge neighboring free blocks into one larger block. The reference first searches for an exact payload pointer, avoiding an immediate read before an arbitrary pointer supplied by the caller. After marking a valid block free, it merges adjacent free regions, recovering the absorbed header space. Calls must be serialized and the metadata must remain intact. Initialize the heap only once before use; running heap_init again would erase the records of still-live objects."
        ],
        "code": {
          "language": "c",
          "filename": "heap.c: i686 fixed-arena implementation",
          "source": "#include <stdint.h>\n#include <stddef.h>\n#include <stdbool.h>\n#define ARENA_BYTES (16u * 1024u)\n#define ALIGNMENT 16u\nstruct block {\n    size_t size;\n    struct block *next;\n    uint32_t tag;\n    uint32_t free;\n};\n_Static_assert(sizeof(struct block) == 16, \"compile for i686\");\nstatic _Alignas(16) unsigned char arena[ARENA_BYTES];\nstatic struct block *first;\n\nvoid heap_init(void) {\n    first = (struct block *)(void *)arena;\n    *first = (struct block) {\n        .size = ARENA_BYTES - sizeof(*first),\n        .next = NULL, .tag = 0x48454150u, .free = 1\n    };\n}\nvoid *kmalloc(size_t requested) {\n    if (!first || requested == 0 || requested > SIZE_MAX - 15u)\n        return NULL;\n    size_t n = (requested + 15u) & ~(size_t)15u;\n    for (struct block *b = first; b; b = b->next) {\n        if (!b->free || b->size < n) continue;\n        size_t rest = b->size - n;\n        if (rest >= sizeof(*b) + ALIGNMENT) {\n            struct block *split = (struct block *)\n                ((unsigned char *)(b + 1) + n);\n            *split = (struct block) {\n                .size = rest - sizeof(*b), .next = b->next,\n                .tag = 0x48454150u, .free = 1\n            };\n            b->next = split;\n            b->size = n;\n        }\n        b->free = 0;\n        return b + 1;\n    }\n    return NULL;\n}\nbool kfree(void *pointer) {\n    if (!pointer) return true;\n    struct block *found = NULL;\n    for (struct block *b = first; b; b = b->next)\n        if ((void *)(b + 1) == pointer) { found = b; break; }\n    if (!found || found->free || found->tag != 0x48454150u)\n        return false;\n    found->free = 1;\n    for (struct block *b = first; b && b->next;) {\n        struct block *next = b->next;\n        if (b->free && next->free) {\n            b->size += sizeof(*b) + next->size;\n            b->next = next->next;\n        } else b = next;\n    }\n    return true;\n}\n"
        },
        "teaching": {
          "goal": "Trace size rounding, first-fit selection, splitting, and coalescing in a small heap.",
          "bridge": "The block representation is defined. Now we will follow one request through the decisions that change that representation.",
          "check": {
            "prompt": "A free block has 160 payload bytes. With a 16-byte header and a rounded request of 64 bytes, how much payload remains after a split? Explain where the missing bytes went.",
            "answer": "The remainder has 160 − 64 − 16 = 80 payload bytes. The extra 16 bytes become the new free block’s header. The original header remains attached to the allocated block and was not part of its 160-byte payload capacity."
          },
          "takeaway": "Splitting accounts for both payload and a new header; coalescing recovers the header between neighboring free blocks.",
          "diagramAfter": 2
        }
      },
      {
        "id": "fragmentation",
        "title": "Trace the shape of free space",
        "paragraphs": [
          "Internal fragmentation is space inside an allocated block that the caller did not request. Alignment padding and an unsplittable remainder are common causes. External fragmentation is different: enough free bytes may exist in total, but they are separated by live allocations, so no one free block is large enough. A heap with two free 2 KiB regions separated by a live block cannot satisfy a contiguous 3 KiB payload just because its free-byte total is 4 KiB.",
          "Draw three neighboring allocations A, B, and C, including every header. Free A and C while B remains live. The allocator cannot merge across B because doing so would give another caller bytes that B still owns. Once B is freed, the neighbors can coalesce into one continuous block, including the bytes previously used by the interior headers. This drawing explains why checking only a total free counter hides useful information. Also record the largest free block or a distribution of block sizes.",
          "More elaborate allocators change these tradeoffs. Boundary tags help find a previous neighbor; size-segregated lists reduce search work; slab-style caches group objects of one size. Each introduces more metadata and update rules. Keep the simple first-fit allocator as a reference while exploring an optimization: two correct allocators may choose different addresses, so compare alignment, capacity, non-overlap, and lifetime behavior for each chosen placement. First learn to explain why a request failed from the shape of the arena."
        ],
        "teaching": {
          "goal": "Distinguish wasted capacity inside allocations from free space separated by live allocations.",
          "bridge": "The heap can allocate and release blocks. The arrangement of those blocks determines which future requests it can satisfy.",
          "check": {
            "prompt": "Two free blocks each have 96 payload bytes and a live block sits between them. Can they satisfy one 160-byte payload request? What changes if the middle block is freed?",
            "answer": "They cannot satisfy the request while separated because the payload must be contiguous in this arena. Freeing the middle block permits coalescing if all three are adjacent, producing one region that also recovers interior header space and can satisfy a larger request."
          },
          "takeaway": "Allocation depends on total free capacity and the size and arrangement of individual free blocks.",
          "diagramAfter": 2
        }
      },
      {
        "id": "defense",
        "title": "Find heap mistakes close to their cause",
        "paragraphs": [
          "A heap corruption often appears much later than its cause. A caller writes past an object today, changing the next block's header; a later allocation follows the damaged pointer and crashes somewhere else. Debug patterns help shorten that distance. Fill newly allocated and freed payloads with different recognizable values, place a canary after a requested payload, and check list links periodically. An allocation-site tag can identify which code requested the damaged object. These debugging clues can reveal corruption; privileged code can also overwrite them.",
          "Synchronization has to fit the calling context. A heap lock can protect the list from concurrent updates, but an interrupt handler must not spin waiting for a lock held by the code it interrupted. A useful first policy is to prohibit general heap allocation in IRQ and panic paths and use bounded preallocated storage there. The allocator's own error logger must follow that rule too; otherwise reporting an allocation failure can recursively require an allocation. Explain the permitted contexts in the interface before sprinkling kmalloc into drivers.",
          "When the fixed arena eventually grows, the heap must coordinate with lower layers. Reserve virtual space, acquire frames, install mappings, and publish the additional arena only after the whole operation succeeds. If a step fails, unwind the newly acquired resources. Returning memory works at page granularity, so a partly occupied page cannot be released merely because it contains one free object. Remove mappings and finish the necessary translation invalidations before those physical frames become reusable. Draw this growth path as another ownership handoff, just as you did for boot stages."
        ],
        "teaching": {
          "goal": "Choose diagnostics that bring a heap ownership error closer to the write that caused it.",
          "bridge": "A small allocator is understandable, but another kernel component can still overwrite its payloads or metadata.",
          "check": {
            "prompt": "An interrupt arrives while ordinary kernel code holds the heap lock. The handler tries to acquire that same lock and spins. Why can the lock holder not make progress?",
            "answer": "On the same CPU, the interrupted code cannot resume and release the lock until the handler finishes. The handler is waiting for the very execution it has suspended. Avoid that dependency through the allocation-context policy or a separately designed interrupt-safe pool."
          },
          "takeaway": "Heap diagnostics and synchronization must work in the contexts where failures occur, including interrupted and low-memory paths.",
          "diagramAfter": 2
        }
      },
      {
        "id": "brk",
        "title": "Give a user process room to grow",
        "paragraphs": [
          "The traditional program break is the logical endpoint of a process's data region. brk requests an endpoint, while sbrk traditionally requests a signed change to it. These operations do not hand a user program an internal kernel-heap pointer. The kernel manages which virtual pages belong to the process; a userspace allocator can subdivide that region into smaller objects. This repeats the separation you learned between the VMM and kernel heap, now across the user/kernel boundary.",
          "The logical break may move by bytes, while page mappings move in 4096-byte units. If the break grows from 0x404120 to 0x4042A0 and that page is already backed, no new frame is needed. A growth across a page boundary may require additional frames and mappings. Shrinking must keep any page that still contains live bytes below the new endpoint. Calculate the old and new page coverage separately from the exact byte-valued break so rounding does not silently free needed storage.",
          "Before committing a new break, check address bounds, signed-increment arithmetic, collisions with other mappings, and resource availability. If the required frame allocation fails, keep the old logical break and mappings coherent. Later chapters specify the syscall's return convention; libc wrappers can present a different interface, so do not infer the kernel ABI from a familiar userspace function name. For now, practice the endpoint calculation as a pure function and explain which page boundaries a request crosses."
        ],
        "teaching": {
          "goal": "Explain the difference between a process’s logical heap endpoint and the pages backing it.",
          "bridge": "Kernel objects now have an allocator. A future user process needs its own object allocator and a way to request address-space growth.",
          "check": {
            "prompt": "A process break grows from 0x501FF0 to 0x502020 with 4 KiB pages. Which new page is needed if only the pages below the old break are backed? If it shrinks back, can the page at 0x501000 be removed?",
            "answer": "Growth reaches the page beginning at 0x502000. Shrinking back can release that newly unneeded page under the mapping policy, but 0x501000 still contains bytes below the restored break and must remain backed."
          },
          "takeaway": "The program break describes byte-level process bounds; backing allocation follows the page coverage of those bounds.",
          "diagramAfter": 2
        }
      },
      {
        "id": "verification",
        "title": "Make the allocator recover its original shape",
        "paragraphs": [
          "Begin with sizes around alignment boundaries, such as 1, 14, 16, 18, and a near-arena-sized request. Each successful pointer should have the required alignment, and each live payload should remain disjoint from every other live payload. Fill objects with distinct patterns so overlap becomes visible. The chapter's focused C checkpoint isolates the size-rounding calculation, including overflow; that small test makes one prerequisite clear before you integrate the complete allocator.",
          "For the full heap, free objects in several orders and check every surviving object's pattern after each operation. This catches an incorrect merge that consumes a neighbor still in use. When every allocation has been released, the arena should recover one free block with its original capacity, including reclaimed interior headers. Then try an interior pointer and a pointer to unrelated storage. Both should be rejected without changing the heap, because neither identifies the start of a currently allocated payload.",
          "A repeated free before reallocation should also fail, but there is a subtler lifetime problem. An old pointer can have the same numerical address as a later allocation that reuses the block. A simple busy bit cannot tell whether that pointer belongs to the old or new lifetime. This is why callers must stop using freed pointers and why richer debug identifiers can be helpful. Finish by explaining which bugs your tests distinguish and which require an ownership discipline beyond this allocator's metadata."
        ],
        "teaching": {
          "goal": "Test alignment, non-overlap, survivor contents, and restoration of the heap after mixed allocation orders.",
          "bridge": "The allocator has enough moving parts that the final free-byte total alone cannot establish correct behavior.",
          "check": {
            "prompt": "Object A is freed, then object B is allocated at the same address. Why might calling kfree with A’s stale pointer appear valid to a simple allocator, and what is wrong with the caller’s reasoning?",
            "answer": "The address now matches a live block owned by B, so a pointer-only lookup may accept it. A’s lifetime already ended; reusing the address did not give the old caller ownership of B. Numerical address equality does not establish allocation identity."
          },
          "takeaway": "Heap tests must track live objects and their contents, while callers must respect allocation lifetimes even when addresses are reused.",
          "diagramAfter": 2
        }
      }
    ],
    "lab": "heap",
    "challenge": {
      "title": "Stop an alignment overflow before it reaches the heap",
      "brief": "Repair the size calculation used before splitting blocks. Treat the arithmetic as a separately testable contract, then explain why passing it is necessary but insufficient for a correct allocator.",
      "language": "c",
      "starter": "#include <stddef.h>\nsize_t rounded(size_t requested) {\n    return (requested + 15) & ~15;\n}\n",
      "tasks": [
        "Reject zero-sized requests according to this chapter’s API.",
        "Detect overflow before adding alignment padding.",
        "Use a size_t mask so its width matches the size calculation.",
        "Leave the output unchanged on failure and test the largest representable values."
      ],
      "hints": [
        "The addition is safe only when requested <= SIZE_MAX - 15.",
        "Cast the mask to size_t before applying bitwise complement.",
        "A boolean plus output parameter makes failure explicit without reserving a valid size as a sentinel."
      ],
      "solution": "#include <stdint.h>\n#include <stddef.h>\n#include <stdbool.h>\n#include <assert.h>\nbool rounded(size_t requested, size_t *out) {\n    if (!out || requested == 0 || requested > SIZE_MAX - 15u)\n        return false;\n    *out = (requested + 15u) & ~(size_t)15u;\n    return true;\n}\nint main(void) {\n    size_t n = 123;\n    assert(!rounded(0, &n) && n == 123);\n    assert(rounded(1, &n) && n == 16);\n    assert(rounded(16, &n) && n == 16);\n    assert(rounded(17, &n) && n == 32);\n    assert(!rounded(SIZE_MAX, &n) && n == 32);\n    assert(rounded(SIZE_MAX - 15u, &n));\n    assert(n == SIZE_MAX - 15u);\n    return 0;\n}\n",
      "explanation": "Unsigned overflow is defined wraparound in C, but it is still a security and correctness bug when a huge request becomes a tiny allocation. Correct rounding prevents that failure. Non-overlap, list integrity, synchronization, and ownership lifetime require separate checks in the complete allocator.",
      "checks": [
        "All standalone arithmetic assertions pass.",
        "Every successful kmalloc result is 16-byte aligned.",
        "Freeing every object restores one free block with the initial arena capacity.",
        "An interior-pointer free and a double free leave the heap unchanged."
      ]
    },
    "reflection": {
      "prompt": "The heap reports 8192 free bytes, yet a 6144-byte allocation fails. A teammate proposes ignoring the failure because “there is enough RAM.” Construct a concrete layout that explains the failure and compare two legitimate responses.",
      "rubric": [
        "Accounts for contiguous virtual space and allocator headers",
        "Distinguishes external fragmentation from physical-memory exhaustion",
        "Proposes a valid design change without moving live raw pointers silently"
      ],
      "modelAnswer": "Two free holes of 4096 bytes separated by a live object provide 8192 bytes in total but no 6144-byte contiguous payload. Coalescing helps only when neighbors are both free; it cannot cross the live object. The heap could grow its mapped arena if its policy and resources allow, or use allocation strategies that reduce fragmentation for the workload. Moving the live object without updating every raw pointer would corrupt clients. The caller must handle failure until a valid larger block exists."
    },
    "sources": [
      {
        "title": "Intel Software Developer Manuals: architectural reference",
        "url": "https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html"
      },
      {
        "title": "OSDev learning companion: memory allocation layers",
        "url": "https://wiki.osdev.org/Memory_Allocation"
      }
    ],
    "nextBuild": "Use the heap for thread metadata and the PMM/VMM for guarded stacks. Keep their lifetimes separate."
  },
  {
    "id": "08",
    "slug": "threads-and-scheduling",
    "title": "Teach one CPU to make progress on many tasks",
    "subtitle": "Save a continuation, build a run queue, and reason about fairness and preemption.",
    "phase": "Processes",
    "minutes": 180,
    "prerequisites": [
      "Reliable interrupt entry/return, timer ticks, and owned kernel stacks",
      "C calling conventions and allocator lifetime rules"
    ],
    "outcomes": [
      "Explain which state a cooperative switch must preserve and why",
      "Construct a new thread’s stack so it can enter through the normal switch path",
      "Implement round-robin selection and account for blocked threads",
      "Separate interrupt preemption from ordinary function-call context switching",
      "Diagnose starvation, lost wakeups, and unsafe stack reclamation"
    ],
    "sections": [
      {
        "id": "continuation",
        "title": "What a thread needs to pause and resume",
        "paragraphs": [
          "Imagine two functions that should both make progress, even though the CPU executes one instruction stream at a time. A thread records enough state to stop one stream and later continue it. That includes a stack holding its call history and local data, saved registers, a lifecycle state, and scheduling information. A process additionally supplies an address space and shared resources for its threads. We begin with kernel threads in one address space so the first lesson can focus on changing the execution state and stack.",
          "In cooperative scheduling, a thread calls a yield or switch function at an ordinary ABI boundary. The caller already knows that caller-saved registers may change. For our i386 convention, the switch routine must preserve EBX, ESI, EDI, and EBP, along with the stack position needed to resume. The CALL has already placed a return address on the current stack. Saving ESP after saving those registers captures a continuation: a place and a set of values from which execution can later proceed as though the call took a long time.",
          "An interrupt-driven preemption can arrive between arbitrary instructions, where caller-saved registers may contain essential live values. Its entry path therefore preserves the full interrupted context and hardware return frame. Timer preemption needs the full interrupted context in addition to the cooperative switch mechanism. Keep those two frame types separate in your drawings. Give each thread its own mapped stack, and label which saved stack pointer belongs to which thread before following the first switch."
        ],
        "teaching": {
          "goal": "Explain a thread as saved execution state plus a private stack, and distinguish cooperative switching from interrupt preemption.",
          "bridge": "Memory and a heap let us create independent stacks and metadata. We can now pause one computation and resume another.",
          "check": {
            "prompt": "Thread A calls yield while holding a useful value in a caller-saved register. Who is responsible for preserving that value across the ordinary C call? How does an unexpected timer interrupt differ?",
            "answer": "At an ordinary call boundary, the caller or compiler must preserve any caller-saved value it needs afterward. A timer can arrive without that preparation, so interrupt entry must save the interrupted state before handler code overwrites it."
          },
          "takeaway": "A thread resumes from a saved continuation; the required saved state depends on whether stopping occurred at a call boundary or an arbitrary instruction.",
          "diagramAfter": 2
        }
      },
      {
        "id": "switch",
        "title": "Switch stacks, then return in another thread",
        "paragraphs": [
          "The switch routine receives two values: where to store the outgoing thread's saved ESP, and the saved ESP of the incoming thread. On entry, an ordinary CALL has placed the return address at the stack top, with arguments above it. Pushing four callee-saved registers uses sixteen more bytes, so the arguments are now 20 and 24 bytes above ESP. Work through those offsets from a stack drawing before trusting the numbers in assembly.",
          "After saving the outgoing ESP through its pointer argument, the routine loads the incoming ESP. This one assignment changes which thread's stack the following instructions use. The pops restore the incoming thread's saved registers, and RET takes its return address from that incoming stack. Thread A called the switch, yet this execution of RET can resume thread B's earlier call. The control flow is surprising only until you remember that RET reads memory at the current ESP; it has no independent notion of which source-level caller should own the stack.",
          "A brand-new thread has no earlier switch call to return from, so create the frame the restore sequence expects. From low to high it contains saved EDI, ESI, EBX, EBP, and a bootstrap trampoline address. Arrange alignment for the trampoline's C call. The bootstrap calls the thread function and routes a normal function return into thread_exit. This minimal switch does not preserve EFLAGS, CR3, SIMD, or every other architectural feature; the cooperative kernel-thread environment and surrounding scheduler code must provide the agreed interrupt state and shared address space."
        ],
        "code": {
          "language": "asm",
          "filename": "switch.asm: cooperative i386 kernel threads",
          "source": "bits 32\nsection .text\nglobal switch_context, thread_trampoline\nextern thread_bootstrap\n; void switch_context(uint32_t **old_sp, uint32_t *new_sp);\nswitch_context:\n    push ebp\n    push ebx\n    push esi\n    push edi\n    mov eax, [esp + 20]      ; old_sp\n    mov [eax], esp\n    mov esp, [esp + 24]      ; new_sp, evaluated before ESP changes\n    pop edi\n    pop esi\n    pop ebx\n    pop ebp\n    ret\n\n; New thread stack top is 16-byte aligned after the synthetic RET.\nthread_trampoline:\n    call thread_bootstrap   ; Must not return: entry() then thread_exit().\n    cli\n.halt:\n    hlt\n    jmp .halt\nsection .note.GNU-stack noalloc noexec nowrite progbits\n"
        },
        "teaching": {
          "goal": "Trace how changing ESP makes a return instruction resume another thread.",
          "bridge": "We know what a cooperative continuation contains. The switch routine shows how a few stack operations move between two of them.",
          "check": {
            "prompt": "Immediately after loading thread B’s saved ESP, the switch restores registers and executes RET. From whose stack is the return address read, and what happens to A’s suspended call?",
            "answer": "RET reads B’s stack because ESP now points there. A’s saved stack, including its own return address, remains intact and can be restored by a later switch. At that later time A’s call can finally return."
          },
          "takeaway": "Changing the stack pointer changes the continuation that the restore sequence and RET will resume.",
          "diagramAfter": 2
        }
      },
      {
        "id": "states",
        "title": "Choose which thread runs next",
        "paragraphs": [
          "Mechanism and policy are different questions. The context switch describes how execution moves; the scheduler decides where it moves. Give each thread a clear state: NEW while being prepared, RUNNABLE when eligible for CPU time, RUNNING while selected, BLOCKED while waiting for a condition, and DEAD after execution ends. A blocked thread leaves the run queue until its condition can make progress.",
          "Round robin chooses runnable threads in turn and gives each a bounded time quantum. When a thread uses its quantum, place it behind its runnable peers. When it blocks early, select another immediately. Keep the current RUNNING thread either outside the queue or inside it according to one documented convention; accidental duplicate membership gives unfair extra turns and corrupts lifecycle reasoning. Select the idle thread only when no ordinary thread is eligible.",
          "Priority adds another selection rule. Strictly preferring higher-priority work can starve a lower-priority thread if high-priority work never stops. Aging or weighted policies can change that tradeoff. Priority inversion is a dependency problem: a high-priority thread waits for a lock owned by a low-priority thread while medium-priority work prevents the owner from running. Priority inheritance can help the owner finish the needed work. Before implementing a policy, trace a tiny workload and state what behavior it should favor."
        ],
        "teaching": {
          "goal": "Trace thread lifecycle states through a round-robin queue and explain how priority changes scheduling choices.",
          "bridge": "The switch mechanism can resume a chosen thread. Scheduling decides which eligible thread should be chosen next.",
          "check": {
            "prompt": "The runnable queue is A, B, C. A uses its full quantum; B then blocks before its quantum ends. Under ordinary round robin, which thread runs next, and where should blocked B be recorded?",
            "answer": "After A’s turn the queue order gives B then C then A. Once B blocks, C runs next. B stays with its wait condition or wait queue until a wakeup makes it eligible for the runnable rotation again."
          },
          "takeaway": "Choose among eligible threads according to a stated policy, while keeping lifecycle state and queue membership consistent.",
          "diagramAfter": 2
        }
      },
      {
        "id": "preemption",
        "title": "Add timer-driven preemption",
        "paragraphs": [
          "First make two cooperative threads repeatedly update separate counters and yield. Verify that their stacks and callee-saved registers survive many switches. This gives you a working mechanism before the timer adds asynchronous entry. For preemption, the timer handler updates accounting and records that rescheduling is needed. The actual switch occurs through a path where the interrupted frame has been saved and the scheduler's lock and preemption rules permit changing the running thread.",
          "Sometimes kernel code temporarily prevents rescheduling while it manipulates state that belongs to the current CPU or holds a lock whose use requires that restriction. Preemption disabling should be nested: an inner critical section must not cancel an outer section's request to remain unscheduled. A counter can record this depth. Masking local interrupts controls IRQ delivery; disabling preemption controls scheduler replacement at allowed points. Track IRQ delivery and scheduler replacement as separate controls, with an explicit rule for how they interact. A long protected region can delay another thread even under a fair scheduling policy.",
          "Switching between processes later adds address-space selection, kernel-entry stack updates for privilege transitions, and any additional per-thread architectural state. Floating-point and SIMD usage requires a save/restore policy before code relies on those registers. Our small switch remains a complete teaching mechanism only for its stated cooperative subset. To extend it, list every piece of state that can differ between threads, identify which entry path saves it, and show where the resumed path restores it."
        ],
        "teaching": {
          "goal": "Explain how a timer request becomes a safe rescheduling point and why interrupt masking differs from preemption control.",
          "bridge": "Cooperative threads switch when they volunteer. A timer lets the kernel ask for a switch even when a thread does not yield.",
          "check": {
            "prompt": "An outer operation disables preemption, then calls an inner operation that also disables it. Why does a single boolean fail if the inner operation sets it back to false on return?",
            "answer": "The outer operation still needs the restriction, but the inner return erases that fact. A nesting count changes from 0 to 1 to 2, then back to 1, so rescheduling remains deferred until the outer operation also leaves."
          },
          "takeaway": "Timer preemption combines a saved interrupt context with scheduler rules that identify when switching is safe.",
          "diagramAfter": 2
        }
      },
      {
        "id": "wakeup",
        "title": "Wait for work without losing the wakeup",
        "paragraphs": [
          "Consider a consumer that checks an empty queue and plans to sleep. Before it records itself as waiting, a producer adds an item and signals. The producer sees no waiter. The consumer then marks itself blocked and sleeps even though the queue contains work. This is a lost wakeup. The problem is the gap between testing the condition and becoming a visible waiter. The consumer and producer must use one synchronization protocol that closes that gap.",
          "The same care applies when a thread finishes. thread_exit cannot free the stack it is still using: the next instruction, local access, or context-save operation may touch that memory. Mark the thread dead, switch to another stack, and let a reaper reclaim the old stack after scheduler and interrupt paths no longer reference it. Removing a thread from the run queue is only one part of ending its lifetime; wait queues and other references may also need attention.",
          "An idle CPU has a related check-then-sleep problem. On one processor, the appropriate sequence checks for work with interrupts disabled, then arranges interrupt enabling and HLT so a maskable interrupt cannot be handled in a gap that leaves the CPU sleeping with no further event. The STI interrupt shadow is relevant to that sequence. Multiple CPUs need additional shared-queue and wakeup coordination, often including an inter-processor interrupt. Trace the producer and consumer in alternating steps, then identify which steps must become indivisible under your chosen protocol."
        ],
        "teaching": {
          "goal": "Trace a lost wakeup and explain why blocking, waking, and stack reclamation require coordinated state changes.",
          "bridge": "A useful scheduler must handle threads that wait for input, then become runnable when another part of the kernel supplies it.",
          "check": {
            "prompt": "A consumer checks “empty,” a producer queues data and finds no waiter, and the consumer then blocks. Which two consumer actions need to be coordinated with the producer, and why does signaling again by chance not fix the design?",
            "answer": "The condition check and registration as a blocked waiter must participate in the producer’s synchronization protocol. A later accidental signal may hide the bug in one run, but if no more work arrives the consumer can remain asleep indefinitely despite queued data."
          },
          "takeaway": "Waiting is a coordinated transition from checking a condition to becoming visible as a waiter.",
          "diagramAfter": 2
        }
      },
      {
        "id": "measure",
        "title": "Measure waiting, response, and fairness",
        "paragraphs": [
          "Begin with a deterministic paper model. Specify when threads arrive, how long they need the CPU, when they block, and the quantum. Then write the execution timeline. Response time measures the delay before a thread first runs; waiting time accumulates time when it is runnable but not running; completion time records when its work finishes. These reveal different qualities. Two policies can complete the same number of tasks while giving a newly arrived interactive thread very different delays.",
          "The chapter's focused C checkpoint asks you to select the next eligible task under its stated policy. Test blocked and dead entries as carefully as normal runnable ones, and explain the fallback when no ordinary task can run. Then integrate scheduling with a CPU-bound counter, a periodically sleeping thread, and an input consumer in the kernel. The sleeping thread should stop taking runnable turns, while measured wakeup delay should reflect your quantum and critical-section limits. Compare the trace with your prediction before changing policy.",
          "Resource failure belongs in the experiment too. If creating a thread runs out of stack memory, the scheduler must not retain a half-initialized runnable entry. Check that the queue and allocation accounting return to their previous state. Finally, choose one workload where your policy behaves well and one where its tradeoff becomes visible. A scheduler is easier to improve when you can state which delays matter and show where those delays arise in an actual trace."
        ],
        "teaching": {
          "goal": "Compare scheduler behavior using execution traces, waiting time, response time, and failure handling.",
          "bridge": "The scheduler can switch, block, and wake threads. Measurements now let us evaluate the policy instead of judging it by how output looks.",
          "check": {
            "prompt": "Two threads arrive at time 0. Under a 3-unit round-robin quantum, A needs 6 CPU units and B needs 3, with A first and no blocking. Give the timeline and B’s response and completion times.",
            "answer": "A runs from 0 to 3, B runs from 3 to 6 and finishes, then A runs from 6 to 9. B first runs at time 3, so its response time is 3; it completes at time 6. The trace separates waiting before first service from total time until completion."
          },
          "takeaway": "A scheduling claim should be supported by a workload, a predicted trace, and measurements of the delays that matter.",
          "diagramAfter": 2
        }
      }
    ],
    "lab": "scheduler",
    "challenge": {
      "title": "Repair round robin when tasks block",
      "brief": "Write a pure scheduler selector that skips blocked tasks, wraps once, and returns an explicit idle result. This models selection only; it does not save registers or execute threads.",
      "language": "c",
      "starter": "#include <stddef.h>\n#include <stdbool.h>\nint pick_next(const bool *runnable, size_t count, int current) {\n    (void)runnable;\n    return (current + 1) % count;\n}\n",
      "tasks": [
        "Handle an empty set without division by zero.",
        "Search at most count candidates and skip blocked entries.",
        "Return -1 when no ordinary task is runnable.",
        "Define current=-1 as no previous task, and test the one-runnable-task case."
      ],
      "hints": [
        "Selection begins after current, wrapping to index zero.",
        "A bounded loop avoids spinning forever when every task is blocked.",
        "Use size_t for the scan but reject counts that cannot fit in the int result."
      ],
      "solution": "#include <stddef.h>\n#include <stdbool.h>\n#include <limits.h>\n#include <assert.h>\nint pick_next(const bool *runnable, size_t count, int current) {\n    if (!runnable || count == 0 || count > INT_MAX) return -1;\n    if (current < -1 || (current >= 0 && (size_t)current >= count))\n        return -1;\n    size_t start = current < 0 ? 0 : ((size_t)current + 1) % count;\n    for (size_t step = 0; step < count; ++step) {\n        size_t i = (start + step) % count;\n        if (runnable[i]) return (int)i;\n    }\n    return -1;\n}\nint main(void) {\n    bool run[] = {true, false, true, false};\n    assert(pick_next(run, 4, -1) == 0);\n    assert(pick_next(run, 4, 0) == 2);\n    assert(pick_next(run, 4, 2) == 0);\n    run[0] = false;\n    assert(pick_next(run, 4, 2) == 2);\n    run[2] = false;\n    assert(pick_next(run, 4, 2) == -1);\n    assert(pick_next(run, 0, -1) == -1);\n    return 0;\n}\n",
      "explanation": "Round robin rotates among eligible tasks and skips blocked or unused slots. The bounded search supports a single runnable task and a fully blocked set without special spinning behavior. The scheduler still needs atomic state transitions and a context-switch protocol when this selector is integrated into the kernel.",
      "checks": [
        "The deterministic selector passes every assertion.",
        "Two yielding kernel threads preserve callee-saved registers and stack canaries.",
        "A blocked thread does not accumulate run turns until it is woken.",
        "A dead thread’s stack is reclaimed only after execution has switched away."
      ]
    },
    "reflection": {
      "prompt": "Thread A checks an empty input queue, thread B inserts a byte and signals, then A goes to sleep forever. Draw the interleaving and repair it using one shared synchronization rule. Explain why adding more timer interrupts does not fix the protocol.",
      "rubric": [
        "Identifies the gap between condition check and wait registration",
        "Coordinates both consumer and producer under the same protocol",
        "Separates accidental wakeups from correctness",
        "Rechecks the condition after wakeup"
      ],
      "modelAnswer": "A checks empty; B publishes a byte and finds no registered waiter; A registers and sleeps. The consumer must hold the queue/wait lock while checking the condition and registering its blocked state, then release it as part of the scheduler’s sleep operation. The producer holds that same lock while publishing work and choosing waiters to wake. A rechecks the condition after waking. Extra timer ticks may occasionally hide the bug but cannot ensure that a lost notification is reconstructed."
    },
    "sources": [
      {
        "title": "Intel Software Developer Manuals: architectural reference",
        "url": "https://www.intel.com/content/www/us/en/developer/articles/technical/intel-sdm.html"
      },
      {
        "title": "OSDev learning companion: context switching",
        "url": "https://wiki.osdev.org/Context_Switching"
      },
      {
        "title": "OSDev learning companion: scheduling algorithms",
        "url": "https://wiki.osdev.org/Scheduling_Algorithms"
      }
    ],
    "nextBuild": "Introduce processes, ring 3, and a syscall boundary while preserving the thread and stack-lifetime invariants established here."
  }
];
