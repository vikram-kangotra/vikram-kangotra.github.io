// Additional explanations and paper traces for the foundations chapters.
export const foundationsDepth = {
  "bootloading": {
    "contract": {
      "title": "Write the handoff before the implementation",
      "paragraphs": [
        "An entry contract is a list of facts a program may rely on when its first instruction runs. Separate facts established by your own previous stage from facts promised by the firmware interface. A register that happened to contain zero during one run is neither. The next stage should receive only assumptions you can point to in code or in the defined platform contract.",
        "A useful handoff has four parts: bytes, location, processor state, and ownership. Bytes identify the image that was loaded. Location connects those bytes to a jump destination. Processor state includes mode, segments, stack, and interrupt policy. Ownership describes which memory may be overwritten and which must survive. Writing these four parts prevents a bootloader from becoming a collection of unexplained constants."
      ],
      "example": {
        "title": "A kernel is present but unreachable",
        "intro": "Assume the disk contains valid kernel bytes and stage 1 displays its own diagnostic character.",
        "steps": [
          {
            "title": "List the proven facts",
            "explanation": "The first diagnostic proves that some stage-1 instructions executed. It does not establish that the disk helper succeeded or that the kernel is in RAM."
          },
          {
            "title": "Inspect the next handoff",
            "explanation": "Compare the intended stage-2 disk interval with the read request and compare its RAM destination with the far jump. A mismatch at either end prevents the intended stage 2 from running."
          },
          {
            "title": "Advance the evidence",
            "explanation": "Place a distinct marker at stage-2 entry in a disposable build. Seeing both markers establishes a longer executed path, after which the next boundary can be investigated."
          }
        ],
        "conclusion": "Each new observation extends a chain of known execution. It is more useful than treating an entirely black screen as one undifferentiated failure."
      },
      "pitfalls": [
        {
          "title": "Confusing a file with a running program",
          "text": "A correct source file or disk region has no effect until an already executing stage brings the required bytes into the CPU’s instruction path."
        }
      ],
      "transfer": "If stage 2 is loaded correctly but the stack overlaps it, has the handoff succeeded? Only partly. The bytes and destination agree, but a CALL can overwrite live code. Memory ownership belongs in the entry contract too."
    },
    "cpu": {
      "title": "Keep three meanings of an address separate",
      "paragraphs": [
        "A source label is a name resolved by the assembler or linker. An offset is a number interpreted using a segment. A physical address selects a location on the memory side of translation. These may have equal numerical values in this course, but equality follows from the chosen configuration. Other segment and paging configurations can make these numerical values differ.",
        "Flat protected-mode segments make arithmetic easier because the selected segment base is zero. They do not remove segmentation checks, establish page mappings, or manufacture RAM at every address. A 4 GiB segment range means the offset passes that segment’s limit test; the platform can still reserve parts of the resulting address space. Later paging adds another translation between linear and physical addresses."
      ],
      "example": {
        "title": "The same offset in two environments",
        "intro": "Take offset 0x0120 first with real-mode DS=0x2400, then with a protected-mode data descriptor whose base is zero.",
        "steps": [
          {
            "title": "Calculate the real-mode location",
            "explanation": "Shift the segment value left by four bits, then add the offset. This example is below the A20 boundary.",
            "state": "0x2400 × 16 + 0x0120 = 0x24120"
          },
          {
            "title": "Interpret a protected-mode selector",
            "explanation": "DS now identifies a descriptor. Multiplying the selector by sixteen would be the wrong operation. With base zero, the offset becomes linear address 0x0120."
          },
          {
            "title": "Locate the physical byte",
            "explanation": "With paging disabled, that linear address reaches physical address 0x0120. With paging enabled later, consult the page tables instead of assuming identity."
          }
        ],
        "conclusion": "The instruction’s address environment changes the destination even when the written offset looks identical."
      },
      "pitfalls": [
        {
          "title": "Changing BITS without changing the CPU",
          "text": "BITS selects the encoding emitted by NASM. Entering those bytes with a mismatched decoding mode can change both instruction length and operation."
        }
      ],
      "transfer": "Would a flat segment make offset 0xB8000 ordinary heap RAM? No. The segment only helps compute and validate the address; the PC platform assigns that region its VGA text-memory role."
    },
    "firmware": {
      "title": "Separate a container format from an execution path",
      "paragraphs": [
        "When examining an unfamiliar disk, first ask which component interprets each structure. Firmware interprets its boot interface. A partition parser interprets partition entries. A filesystem driver interprets directories. Your tiny stage 1 interprets only its own fixed constants and the disk service result. Giving a structure a familiar name does not cause every earlier component to understand it.",
        "This distinction lets you reason about changes. Adding a filesystem to unused sectors does not teach stage 1 how to find a file by name. Moving a kernel into a partition does not update a hardcoded LBA. The initial scratch layout is useful because it removes these parsers while you learn loading, but its assumptions must remain visible when the design grows."
      ],
      "example": {
        "title": "Find the owner of a misplaced sector",
        "intro": "Imagine an experimental partitioned image that keeps the course rule that stage 2 starts at LBA 1.",
        "steps": [
          {
            "title": "Write both claims",
            "explanation": "The fixed loader claims sectors beginning at LBA 1. A GPT-formatted disk also places its primary header at LBA 1. Both cannot independently own those bytes."
          },
          {
            "title": "Predict the corruption",
            "explanation": "Writing stage 2 there destroys metadata, while writing the GPT header there replaces executable stage-2 bytes. A valid sector-zero signature cannot resolve this conflict."
          },
          {
            "title": "Choose a defined layout",
            "explanation": "Keep the current experiment as its unpartitioned scratch image. A future partition-aware loader needs explicit reserved locations or a filesystem lookup path coordinated with image construction."
          }
        ],
        "conclusion": "A layout collision is a disagreement over ownership, even when each individual file is valid."
      },
      "pitfalls": [
        {
          "title": "Treating 55 AA as a complete validator",
          "text": "The signature occupies two bytes. It cannot prove that the preceding instructions, stage locations, or partition structures make sense together."
        }
      ],
      "transfer": "If the sector size changes, can all LBA constants remain while byte-copy offsets remain unchanged? No. Every conversion between sectors and bytes must use the same declared sector size, and this course specifically assumes 512-byte sectors."
    },
    "tools": {
      "title": "Classify the failure by the artifact it concerns",
      "paragraphs": [
        "An object file may contain an unresolved symbol on purpose. The compiler can generate a call whose final destination the linker will fill in. This postponement is called relocation. It allows separately compiled files to refer to one another without agreeing on final addresses during compilation.",
        "A raw binary must already contain the final bytes for its intended placement. Its bytes have to be ready for the specific placement that the bootloader performs. Saving each intermediate artifact gives you a way to inspect the agreement at every boundary and identify the stage responsible for a failure."
      ],
      "example": {
        "title": "A missing output implementation",
        "intro": "Suppose main.c includes a correct declaration of console_putc, and console.c contains its implementation, but only main.o is passed to the linker.",
        "steps": [
          {
            "title": "Explain successful compilation",
            "explanation": "The declaration supplies the argument and return types. The compiler can check the call and emit a reference without seeing the function body."
          },
          {
            "title": "Explain failed linking",
            "explanation": "The linker searches its supplied objects for a definition of console_putc. A file existing in the editor is irrelevant if its object is absent from the input list."
          },
          {
            "title": "Fix the appropriate boundary",
            "explanation": "Add console.c to the build inputs and rebuild its object, executable, raw kernel, and disk image. Changing the function’s address manually would bypass the real dependency error."
          }
        ],
        "conclusion": "Follow the missing symbol through the build inputs. The error message identifies a particular build stage to investigate."
      },
      "pitfalls": [
        {
          "title": "Using a host library to silence the error",
          "text": "A hosted output routine can depend on system calls and startup services that this kernel does not provide. Matching a symbol name alone does not supply a compatible execution environment."
        }
      ],
      "transfer": "What if console.c is included twice? Two external definitions can create a different link failure. Both missing and duplicate symbols are questions about which definitions participate in the final executable."
    },
    "cross-build": {
      "title": "Prove what the compiler produced",
      "paragraphs": [
        "A target triplet is a useful declaration of intent, but an actual object file is the evidence of one invocation. Compiler flags, source features, and link defaults can still affect the result. Record the command and inspect its product together. This also makes a later toolchain upgrade reviewable: compare outputs for a small known program before rebuilding the whole kernel.",
        "The native cross-toolchain is optional because the browser already selects target tools. The transferable skill is artifact inspection. ELF headers describe class and architecture; symbol tables distinguish definitions from unresolved references; disassembly shows the selected instructions. These views answer different questions, so a correct ELF header cannot by itself prove a correct boot entry."
      ],
      "example": {
        "title": "A minimal toolchain acceptance check",
        "intro": "Compile a function that returns the unsigned sum of its two arguments without linking a hosted application.",
        "steps": [
          {
            "title": "Check the compiler identity",
            "explanation": "Record the target reported by the explicit i686-elf compiler path. Use that explicit compiler path consistently in the build."
          },
          {
            "title": "Check the object header",
            "explanation": "Confirm an ELF32 object for the intended x86 target. The object header records the target used for this artifact."
          },
          {
            "title": "Check references and instructions",
            "explanation": "Inspect whether the small object unexpectedly requires external helpers. If it does, identify the operation that caused them and the target runtime that must provide them."
          }
        ],
        "conclusion": "You have a small reproducible acceptance experiment before involving boot sectors or firmware."
      },
      "pitfalls": [
        {
          "title": "Assuming freestanding means no runtime work",
          "text": "Freestanding compilation still leaves startup, storage initialization, linking, and potentially compiler helper routines for the environment to provide."
        }
      ],
      "transfer": "A correct compiler produces a correct object, but the kernel still resets. What remains unproven? Link placement, disk construction, entry state, and runtime behavior all remain separate checks."
    },
    "stage-one": {
      "title": "Trace stack use while the loader is still tiny",
      "paragraphs": [
        "A stack is an address interval with a growth direction and a maximum intended depth. Choosing its initial pointer is only the first step. CALL, PUSH, interrupts, and firmware routines all consume stack space. Keep enough room below the initial top and avoid placing persistent records in the part the stack may reach.",
        "Notice that initializing SS:SP is a state change with a vulnerable intermediate moment. The code disables maskable interrupts while installing the pair, then enables the expected firmware environment. Later protected-mode code has a different interrupt policy because a new interrupt table is not yet ready. The two policies belong to different stages of the boot path."
      ],
      "example": {
        "title": "Account for two nested calls",
        "intro": "Use a paper-only real-mode stack with SS=0 and initial SP=0x7600. Assume ordinary 16-bit near calls and one saved word.",
        "steps": [
          {
            "title": "Enter the disk helper",
            "explanation": "A near CALL stores a two-byte return offset after decrementing SP.",
            "state": "SP = 0x75FE"
          },
          {
            "title": "Save a register and call again",
            "explanation": "PUSH consumes another two bytes, then the nested CALL consumes two more.",
            "state": "Saved word at 0x75FC; nested return at 0x75FA"
          },
          {
            "title": "Reverse the sequence",
            "explanation": "The inner RET, matching POP, and outer RET restore SP to 0x7600. A missing POP makes a return consume a saved register as an instruction address."
          }
        ],
        "conclusion": "The bookkeeping explains why a small stack bug can appear to be a bad disk read or a random jump."
      },
      "pitfalls": [
        {
          "title": "Budgeting only the source-level calls",
          "text": "Firmware and interrupt paths may use additional stack space. Your three-word trace establishes local usage; firmware requires a separate depth bound."
        }
      ],
      "transfer": "If a buffer ends at 0x7600, is that a safe location immediately below this stack top? No. The first push writes inside that buffer. Adjacent endpoints help only when the regions grow away from one another."
    },
    "disk-read": {
      "title": "Separate retry policy from transfer geometry",
      "paragraphs": [
        "A retry may solve a transient read failure, but it cannot repair a destination that overlaps the running loader. Validate geometry independently: starting sector, number of sectors, destination, and accessible address interval. Then apply the firmware protocol and retry policy to that valid request.",
        "The packet belongs to both sides of the call: software initializes it, firmware consumes it, and firmware may update fields. Reusing the same memory does not mean it still contains the original request. Restoring mutable request fields before every attempt prevents a first failure from silently changing the meaning of the second attempt."
      ],
      "example": {
        "title": "Two failures followed by one success",
        "intro": "For a hypothetical six-sector transfer beginning at LBA 20, choose physical destination 0x9000 and a budget of three attempts.",
        "steps": [
          {
            "title": "Compute both intervals",
            "explanation": "The disk source begins at byte 20 × 512 = 10240. Six sectors contain 3072 bytes, so the destination interval is [0x9000, 0x9C00)."
          },
          {
            "title": "Spend the retry budget",
            "explanation": "After failure one, reset as required and leave two attempts. After failure two, leave one. Reinitialize the count to six before each new read."
          },
          {
            "title": "Publish success only after the result",
            "explanation": "A clear carry flag on attempt three establishes that the request succeeded according to this interface. Exhaustion follows the fatal path, even if part of the buffer looks plausible."
          }
        ],
        "conclusion": "The number of attempts and the number of sectors are independent quantities with different lifetimes."
      },
      "pitfalls": [
        {
          "title": "Using partially changed memory after an error",
          "text": "After a failed transfer, treat the buffer as potentially modified and incomplete."
        }
      ],
      "transfer": "If the requested destination extends into the disk packet itself, should retries make it safe? No. A successful read could overwrite the metadata required for later operations. Move the buffer or split the design into non-overlapping regions.",
      "flowchart": {
        "title": "A read has exactly two outcomes",
        "intro": "Retry only while the request still has an attempt available. Successful loading and terminal failure never share the same handoff.",
        "nodes": [
          {
            "id": "prepare",
            "label": "Prepare request",
            "detail": "Restore the sector count, packet pointer, and boot-drive value.",
            "kind": "process"
          },
          {
            "id": "read",
            "label": "Call BIOS read",
            "detail": "Issue the bounded firmware operation.",
            "kind": "process"
          },
          {
            "id": "ok",
            "label": "Read succeeded?",
            "detail": "Inspect the returned carry flag.",
            "kind": "decision"
          },
          {
            "id": "loaded",
            "label": "Use loaded image",
            "detail": "The caller may continue to the next stage.",
            "kind": "terminal"
          },
          {
            "id": "budget",
            "label": "Attempts remain?",
            "detail": "After a failed read, reset the device and decrement the budget.",
            "kind": "decision"
          },
          {
            "id": "failed",
            "label": "Report and halt",
            "detail": "Never jump to an unverified destination.",
            "kind": "terminal"
          }
        ],
        "edges": [
          {
            "to": "read",
            "from": "prepare"
          },
          {
            "to": "ok",
            "from": "read"
          },
          {
            "to": "loaded",
            "label": "Yes",
            "from": "ok"
          },
          {
            "to": "budget",
            "label": "No",
            "from": "ok"
          },
          {
            "to": "prepare",
            "label": "Yes",
            "from": "budget"
          },
          {
            "to": "failed",
            "label": "No",
            "from": "budget"
          }
        ],
        "caption": "The back edge retries the same validated transfer; it does not broaden the destination or accept partial success."
      }
    },
    "stage-two": {
      "title": "Treat the mode switch as a dependency chain",
      "paragraphs": [
        "The protected-mode transition cannot be rearranged like independent initialization assignments. The far jump depends on a usable descriptor table and a code descriptor. The protected-mode data loads depend on compatible data descriptors. The eventual C call depends on a stack whose address is meaningful under the resulting segment state.",
        "This is also a point where failure becomes less observable. Real-mode printing through firmware is available before the transition; immediately afterward you need your own valid output or exception path. Place diagnostic observations on each side using mechanisms supported by that execution environment."
      ],
      "example": {
        "title": "Why a correct PE bit is insufficient",
        "intro": "Assume the GDT in memory contains valid entries, but GDTR accidentally points eight bytes after the table’s actual beginning.",
        "steps": [
          {
            "title": "Follow selector 0x08",
            "explanation": "The selector requests entry one relative to the incorrect table base. The CPU therefore reads a different eight-byte record from the one you intended."
          },
          {
            "title": "Locate the first dependent operation",
            "explanation": "The control-register write may succeed. The subsequent far jump uses the descriptor and can fault before any protected-entry marker executes."
          },
          {
            "title": "Repair the shared representation",
            "explanation": "Check the GDTR base, its size-minus-one limit, and the selector’s index against the actual bytes. Do not change the selector blindly until the table and pointer agree."
          }
        ],
        "conclusion": "A register report showing PE=1 proves the control bit changed. Verify the newly installed code segment separately."
      },
      "pitfalls": [
        {
          "title": "Assuming CLI makes transition faults impossible",
          "text": "CLI affects maskable external interrupts. An invalid descriptor or instruction can still cause an exception, so careful transition setup remains necessary."
        }
      ],
      "transfer": "If you add a descriptor before the code descriptor, what must you review? Every selector naming entries after that insertion, including the far jump and later segment loads, must still identify the intended records."
    },
    "c-entry": {
      "title": "Make zero initialization an observable obligation",
      "paragraphs": [
        "C’s static-storage rules are part of the language environment you implement. The fact that .bss has no full payload in the raw file does not make its initialization optional. Think of the linker’s symbols as an interface: the linker chooses an interval, and the assembly entry promises to clear exactly that interval before any C code observes it.",
        "The ABI also specifies the entry-stack requirements. A source function with no explicit local array can still spill registers, call another function, or need aligned stack storage after optimization. Establish the agreed stack condition before the call and let the generated function use it normally."
      ],
      "example": {
        "title": "A boundary-sensitive .bss test",
        "intro": "Use a hypothetical .bss interval [0x15240, 0x152A3), with diagnostic guard bytes immediately outside it in a temporary test layout.",
        "steps": [
          {
            "title": "Derive the byte count",
            "explanation": "Subtract the endpoints to obtain 0x63, or 99 bytes. The final cleared byte is 0x152A2."
          },
          {
            "title": "Choose hostile initial contents",
            "explanation": "Fill the interval with a nonzero marker before the intended clearing routine and give each guard a different value. This makes both missing clearing and over-clearing visible."
          },
          {
            "title": "Check the complete result",
            "explanation": "After clearing, all 99 bytes should be zero while the guards remain unchanged. A single zero-valued variable would check much less of the interval."
          }
        ],
        "conclusion": "The experiment validates both initialization and the half-open boundary contract."
      },
      "pitfalls": [
        {
          "title": "Copying the native halt policy into the browser task",
          "text": "The browser milestone checks return from kernel_main into the assembly halt loop. A function that halts forever internally changes that observable contract."
        }
      ],
      "transfer": "Why clear EBP before the first C call? It gives a recognizable boundary for early frame-chain inspection, though optimized functions may omit frame pointers. Reliable stack tracing also requires a valid ESP and the appropriate unwinding logic."
    },
    "kernel": {
      "title": "Derive the display write from coordinates",
      "paragraphs": [
        "A driver interface becomes useful when callers can describe intent without repeating the hardware formula. A write-cell function can accept a row, column, character, and attribute, check bounds, and then perform the VGA store. Later replacing the display backend should not require the shell to learn a new cell-address calculation.",
        "The first display routine also introduces policy questions: whether text wraps, how newline behaves, and what happens at the last row. Decide those separately from the primitive store. The hardware cell layout says where a character goes; it does not decide what your console means by a newline or an overflowing message."
      ],
      "example": {
        "title": "Write a character away from the first cell",
        "intro": "In an 80-column text display, put character B with attribute 0x2F at zero-based row 3, column 7.",
        "steps": [
          {
            "title": "Convert coordinates to a cell index",
            "explanation": "Three complete rows contain 240 cells. Add column 7 to select cell 247.",
            "state": "3 × 80 + 7 = 247"
          },
          {
            "title": "Convert cells to bytes",
            "explanation": "Each cell occupies two bytes, so the offset is 494, hexadecimal 0x1EE. Add it to 0xB8000.",
            "state": "Destination = 0xB81EE"
          },
          {
            "title": "Construct the store value",
            "explanation": "The character code for B is 0x42. Put the attribute in the upper byte to form 0x2F42; the adjacent cell begins at 0xB81F0."
          }
        ],
        "conclusion": "Explicit unit conversions make an off-by-one column or a missing factor of two easy to recognize."
      },
      "pitfalls": [
        {
          "title": "Using volatile as a complete device protocol",
          "text": "Volatile preserves relevant compiler-visible accesses. Bounds, device initialization, synchronization, and the device’s actual access rules still need a deliberate design."
        }
      ],
      "transfer": "What happens if column 80 is accepted? The linear formula reaches the next row. That may look like wrapping, but accepting an invalid coordinate silently is a different API from explicitly implementing wrap behavior."
    },
    "linker": {
      "title": "Distinguish address assignment from memory protection",
      "paragraphs": [
        "A linker section named .rodata groups read-only-intended objects, but its name alone does not cause the current CPU to reject stores there. At this milestone, flat writable segments and disabled paging do not enforce those source-level intentions. Later page permissions turn parts of that layout into hardware-enforced policy.",
        "The location counter is easier to reason about as a cursor along memory. Adding section bytes advances it; alignment may advance it further; a zero-initialized section reserves a range even when it does not contribute equivalent disk bytes. Keep separate running totals for file-backed size and runtime extent."
      ],
      "example": {
        "title": "Lay out three small regions",
        "intro": "In a paper layout starting at 0x10000, assume 0x321 bytes of text, 0x25 bytes of constants, and 0x14 bytes of initialized data. Align each following section to 16 bytes.",
        "steps": [
          {
            "title": "Finish text and align constants",
            "explanation": "Text ends at 0x10321. The next 16-byte boundary is 0x10330, leaving a 15-byte alignment gap."
          },
          {
            "title": "Place constants and data",
            "explanation": "Constants end at 0x10355. Align data to 0x10360; its 0x14 bytes end at 0x10374."
          },
          {
            "title": "Start zero-initialized storage",
            "explanation": "The next boundary is 0x10380. If .bss needs 0x180 bytes, it ends at 0x10500, extending runtime use beyond file-backed content."
          }
        ],
        "conclusion": "Alignment gaps are part of placement. The loader’s slot and the stack reservation must account for the appropriate extent."
      },
      "pitfalls": [
        {
          "title": "Assuming a relative jump proves all addresses are correct",
          "text": "Nearby control flow can still work after a placement mistake while absolute data references point into the wrong region."
        }
      ],
      "transfer": "Would changing ENTRY(_start) alone move _start to the first raw byte? No. The entry directive identifies an entry symbol; section placement and ordering must also put the intended instructions at the loader’s fixed jump address."
    },
    "make": {
      "title": "Rebuilding is a reachability problem",
      "paragraphs": [
        "A dependency edge means that changing one input may require regenerating another artifact. Start at the edited file and follow every outgoing path to the disk image. If any edge is missing, a successful command can still produce a stale boot image. If every input always rebuilds, correctness may hold but the build hides which dependencies really matter.",
        "Headers are especially easy to omit from a hand-written native Makefile. A C file can be unchanged while a declaration or constant it includes changes. The conceptual dependency remains even if timestamps on the C file do not. The browser manifest and native build machinery need appropriate treatment of these inputs within their own pipelines."
      ],
      "example": {
        "title": "Track a shared header edit",
        "intro": "Suppose both main.c and vga.c include vga.h, and you change the declared output interface in that header.",
        "steps": [
          {
            "title": "Find direct consumers",
            "explanation": "Both translation units must be checked against the new declaration. Recompiling only main.c could leave an implementation compiled for an older interface."
          },
          {
            "title": "Follow the outputs",
            "explanation": "New objects require a new linked kernel. The raw conversion then needs to use that new executable, and the disk image must contain the resulting new binary."
          },
          {
            "title": "Verify the experiment’s identity",
            "explanation": "Record a build marker or inspect the artifact before booting. Confirm that the emulator opened the image containing the new message."
          }
        ],
        "conclusion": "The observed machine result is meaningful only when you know which generated bytes produced it."
      },
      "pitfalls": [
        {
          "title": "Treating a clean build as the only solution",
          "text": "A clean build can expose a stale-dependency bug but does not repair the missing edge. Fix the dependency so future incremental builds remain trustworthy."
        }
      ],
      "transfer": "If only linker.ld changes, must every C file be recompiled? Usually no: existing compatible objects can be relinked. The downstream ELF, binary, and disk image must still be regenerated."
    },
    "image": {
      "title": "Use intervals to detect disk-layout mistakes",
      "paragraphs": [
        "A sector slot specifies both a starting location and a maximum capacity. The image builder must reject a payload larger than its slot even when unused bytes remain elsewhere in the disk image. Otherwise the bootloader can load a prefix while the linker has created references to bytes that never arrive in RAM.",
        "Padding also needs a clear meaning. Zero-filling unused capacity makes the image deterministic and prevents leftovers from previous builds. It does not turn unloaded .bss into initialized runtime memory, nor does it replace the kernel entry’s zeroing contract. Disk padding and C startup occur at different boundaries."
      ],
      "example": {
        "title": "Detect a kernel that is one byte too large",
        "intro": "The fixed kernel slot contains 32 sectors of 512 bytes. Consider payload sizes 16384 and 16385 bytes.",
        "steps": [
          {
            "title": "Derive capacity",
            "explanation": "32 × 512 is 16384, hexadecimal 0x4000. The first payload exactly fits, subject to all other checks."
          },
          {
            "title": "Locate the excess",
            "explanation": "The second payload extends one byte beyond what the loader requests. A large surrounding disk container does not change the requested transfer length."
          },
          {
            "title": "Fail before boot",
            "explanation": "Reject the oversized image or intentionally redesign all related loader and linker limits. Silently truncating produces a binary whose linked assumptions no longer match loaded memory."
          }
        ],
        "conclusion": "A precise size check turns a difficult runtime mystery into a clear build-time explanation."
      },
      "pitfalls": [
        {
          "title": "Appending bytes instead of placing bytes",
          "text": "Concatenation works only if every preceding component has exactly the expected padded size. Explicit offsets and length checks make that assumption visible."
        }
      ],
      "transfer": "A kernel is 6000 bytes long. How many 512-byte sectors cover its payload? Twelve, since eleven provide only 5632 bytes. The course loader still reads its fixed 32-sector slot; payload coverage and configured read length need not be equal."
    },
    "observe": {
      "title": "Use the last confirmed instruction boundary",
      "paragraphs": [
        "Debugging begins with observations that survive the failure. A marker stored in ordinary RAM may disappear when the machine resets; a serial log can preserve it. A display marker may be overwritten by later screen clearing. Choose the observation path with these lifetimes in mind, and label each marker with the boundary it establishes.",
        "A useful hypothesis predicts both what you will see and what you will not yet know. Seeing the stage-2 entry marker proves arrival there but not that the kernel was loaded correctly. Seeing C output proves a path through output code but not every initialization property. Narrow claims keep a diagnostic from becoming false reassurance."
      ],
      "example": {
        "title": "A blank screen with a surviving serial marker",
        "intro": "Assume a marker immediately before kernel_main’s VGA loop appears on serial, but the screen remains blank.",
        "steps": [
          {
            "title": "Remove earlier suspects carefully",
            "explanation": "The observed execution has reached C near the display code, so begin at the display boundary. This inspection verifies the loaded layout as well as successful linking."
          },
          {
            "title": "Test the simplest visible store",
            "explanation": "In a disposable build, write a single recognizable cell at the expected text-memory address. Inspect the memory and confirm the firmware selected the intended display mode."
          },
          {
            "title": "Separate device and loop problems",
            "explanation": "If the single cell works, examine coordinates, string termination, and later screen clearing. If memory changes without the expected display, investigate the backend assumptions."
          }
        ],
        "conclusion": "One controlled store distinguishes a bad loop from a bad display environment more effectively than rewriting the whole kernel."
      },
      "pitfalls": [
        {
          "title": "Changing several stages between observations",
          "text": "A result after several edits cannot identify which edit mattered. Keep the diagnostic change small enough to connect cause and observation."
        }
      ],
      "transfer": "Why use a hardware breakpoint for an early loader boundary when available? It avoids relying on patched instruction bytes surviving a later disk load into that address. The debugger’s setup and the image’s loading order must agree."
    },
    "validation-scope": {
      "title": "Construct the broken version your test should catch",
      "paragraphs": [
        "A test has an input, an observation, and a claim. Writing all three often reveals that the observation is weaker than the claim. A screen message can confirm a visible effect, while a register or memory assertion can confirm a different internal property. Neither is automatically a substitute for the other.",
        "Negative controls are deliberately broken variants used to check whether a test notices the error it is meant to detect. They belong in temporary experiments, followed by restoration of the correct implementation. If the bad variant passes, improve the experiment before treating a green result as evidence for that mechanism."
      ],
      "example": {
        "title": "Test the return from C",
        "intro": "The browser milestone requires kernel_main to return to an assembly-owned halt loop.",
        "steps": [
          {
            "title": "State the exact claim",
            "explanation": "The claim is that assembly used a call-compatible entry and C returned through its saved return address. Printing the required text is only one event along that path."
          },
          {
            "title": "Invent a misleading variant",
            "explanation": "A version that prints correctly and loops forever inside C could satisfy a text-only checker while violating the return requirement."
          },
          {
            "title": "Observe the distinguishing state",
            "explanation": "Inspect whether execution reaches the assembly continuation after CALL. That observation separates the two variants while leaving the visible text identical."
          }
        ],
        "conclusion": "A useful test directly observes the boundary and property specified by the contract."
      },
      "pitfalls": [
        {
          "title": "Reading a local exercise pass as full integration",
          "text": "A passing arithmetic helper proves its behavior for the exercised cases. It does not establish that a running loader calls it with correct physical addresses or preserves its output."
        }
      ],
      "transfer": "If a test catches a wrong initial value but never varies it, what extra confidence can a controlled change provide? Vary the input and predict the new result. This checks that output follows the mechanism instead of an unrelated constant."
    },
    "experiment": {
      "title": "Write an experiment with a reversible prediction",
      "paragraphs": [
        "A productive boot experiment has a baseline, one deliberate change, a predicted consequence, and a restoration step. Record the baseline image’s successful behavior first. Then make the smallest change that distinguishes the mechanism you are studying. This protects you from attributing an old failure to the latest edit.",
        "Experiments need not all break the machine. Moving a display character, changing a valid constant, or adding an independent marker can expose data flow while preserving boot. Once those are understood, a controlled invalid selector or missing initialization step can explore failure boundaries. Keep destructive image-layout experiments inside a scratch image."
      ],
      "example": {
        "title": "Distinguish loading from executing",
        "intro": "Use a temporary kernel payload containing a recognizable constant at a known offset and an entry marker produced only by executed code.",
        "steps": [
          {
            "title": "Predict the loaded memory",
            "explanation": "From the kernel destination and constant’s offset, compute the physical address that should contain the marker after the disk read."
          },
          {
            "title": "Inspect before the jump",
            "explanation": "Finding the constant at that address supports the load-location claim. It does not show that control has reached the kernel entry."
          },
          {
            "title": "Continue and inspect execution",
            "explanation": "Now look for the execution marker. If memory is correct but the marker is absent, concentrate on entry address, processor state, and the first instructions."
          }
        ],
        "conclusion": "Loading and executing are separate events that can be tested separately. The two observations divide a difficult boot failure into smaller questions."
      },
      "pitfalls": [
        {
          "title": "Leaving experimental output in the canonical checkpoint",
          "text": "The checkpoint has a defined output contract. Restore its expected behavior after exploring a variation so the final result tests the intended project."
        }
      ],
      "transfer": "What should your notes contain when an experiment surprises you? Record the exact changed bytes or source, predicted result, actual observation, and the assumption now in doubt. A surprising result is useful when another person can reproduce the distinction."
    }
  },
  "descriptors-and-interrupts": {
    "descriptor-contract": {
      "title": "Decode the reference before decoding the descriptor",
      "paragraphs": [
        "A selector contains an index and two kinds of control information. Removing its low three bits leaves a multiple of the descriptor size, which is why kernel selectors often look like 0x08, 0x10, and 0x18. The index says which record to read, while the table-indicator and requested-privilege bits influence how that reference is interpreted.",
        "The descriptor’s limit is inclusive. That is different from the half-open ranges used in the allocator. A segment allowing offsets 0 through 0x2FFF covers 0x3000 bytes. Confusing these conventions creates one-byte errors before granularity makes them page-sized errors. Always label whether a number means last valid offset, first excluded address, or byte count."
      ],
      "example": {
        "title": "Decode a deliberately nonzero-base segment",
        "intro": "Use selector 0x18 with a GDT entry whose base is 0x200000, byte-granular limit is 0x2FFF, and permissions allow the intended data read.",
        "steps": [
          {
            "title": "Find the entry",
            "explanation": "0x18 shifted right by three is index 3. The low bits select the GDT and requested privilege zero. The descriptor begins 24 bytes after the table base."
          },
          {
            "title": "Check an allowed access",
            "explanation": "A one-byte access at offset 0x2FFE is within the limit and produces linear address 0x202FFE. A multi-byte access also needs its full extent to fit."
          },
          {
            "title": "Check the boundary",
            "explanation": "A one-byte access at offset 0x3000 exceeds the limit. Adding the segment base cannot make the offset valid after the limit check fails."
          }
        ],
        "conclusion": "Selectors find descriptions; descriptions govern accesses. Neither is simply a physical pointer."
      },
      "pitfalls": [
        {
          "title": "Editing a descriptor and expecting immediate use",
          "text": "The loaded segment has cached descriptor state. After updating the table in memory, reload the relevant segment register to install its new descriptor state."
        }
      ],
      "transfer": "A GDT contains five eight-byte records. What limit belongs in GDTR? The table occupies 40 bytes, so the inclusive table limit is 39, hexadecimal 0x27."
    },
    "idt-layout": {
      "title": "Build one gate from independently checked fields",
      "paragraphs": [
        "An IDT gate is a hardware record whose meaning is determined by byte positions. C field names are for humans; the processor sees only the resulting layout. Fixed-width fields and a structure-size assertion make accidental compiler padding visible. Explicit byte tests then verify that low and high halves have not been reversed.",
        "The gate points to an assembly entry that handles the interrupt frame before invoking C. Interrupt entry has its own stack contents and return instruction. Keep gate construction separate from stub construction so you can test the destination encoding even before the complete handler is ready to run."
      ],
      "example": {
        "title": "Encode an invented handler address",
        "intro": "Assume the handler is linked at 0x0012ABCD, the kernel code selector is 0x08, and the chosen gate attributes are 0x8E.",
        "steps": [
          {
            "title": "Split the address",
            "explanation": "The low half is 0xABCD and the high half is 0x0012. Recombining them must recover the original address.",
            "state": "(0x0012 << 16) | 0xABCD = 0x0012ABCD"
          },
          {
            "title": "Lay out the eight bytes",
            "explanation": "For the course’s little-endian gate structure, the bytes are CD AB 08 00 00 8E 12 00. The required zero field is distinct from the upper address bytes."
          },
          {
            "title": "Verify the table extent",
            "explanation": "A table with all 256 eight-byte gates occupies 2048 bytes. Its IDTR limit is 2047, and every vector you expose needs a meaningful gate."
          }
        ],
        "conclusion": "Independent field calculations let a failed encoding test tell you which part of the gate is wrong."
      },
      "pitfalls": [
        {
          "title": "Confusing gate privilege with hardware interrupt permission",
          "text": "The gate DPL is relevant to software INT access checks. It does not replace the PIC mask or prevent a CPU-detected exception from being delivered."
        }
      ],
      "transfer": "Would pointing the gate at kernel_main make it an interrupt handler? No. Its ordinary prologue and RET do not implement the required interrupt frame preservation and IRETD return path."
    },
    "frames": {
      "title": "Count every stack word at entry and exit",
      "paragraphs": [
        "An interrupt frame is a serialized description of suspended execution. The assembly stub creates a format, and the C structure consumes that format. They form an ABI inside your own kernel. Changing the push order on one side requires changing field offsets on the other, even if both files still compile.",
        "Normalization works by making two incoming shapes converge. A no-error exception gets a software zero, while an error-code exception already has that word supplied by the CPU. Both then receive the vector number and register saves. The restore path must remove exactly the software-normalized words before the architectural return consumes the hardware frame."
      ],
      "example": {
        "title": "Compare divide error with page fault",
        "intro": "For this paper trace use a same-privilege 32-bit entry and ESP=0x8000 before the CPU begins saving its frame.",
        "steps": [
          {
            "title": "Trace an exception without an error code",
            "explanation": "EFLAGS, CS, and EIP occupy three four-byte slots. The top becomes 0x7FF4. A synthetic error word and vector then bring it to 0x7FEC."
          },
          {
            "title": "Trace an exception with an error code",
            "explanation": "The CPU also saves the error word, reaching 0x7FF0. Pushing only the vector reaches the same normalized top, 0x7FEC."
          },
          {
            "title": "Add the common register saves",
            "explanation": "PUSHAD adds 32 bytes, so both routes reach 0x7FCC before further call preparation. The saved original-ESP field records a snapshot; stack switching requires a separate operation."
          }
        ],
        "conclusion": "The two entry routes can share a dispatcher because the stub deliberately made their layouts agree."
      },
      "pitfalls": [
        {
          "title": "Adding a second dummy error code",
          "text": "Doing this for an exception that already supplied one shifts every later field and leaves IRETD looking at the wrong return words."
        }
      ],
      "transfer": "Does the same diagram include an old SS:ESP pair on every interrupt? No. A privilege transition has additional stack state. A same-ring frame must not be interpreted as though those extra words were always present.",
      "flowchart": {
        "title": "Normalize exception frames",
        "intro": "This diagram shows the entry-format decision. The CPU-specific frame must be accounted for before common software saves are added.",
        "nodes": [
          {
            "id": "entry",
            "label": "Exception entry",
            "detail": "The CPU has saved its architectural return frame.",
            "kind": "terminal"
          },
          {
            "id": "error",
            "label": "Hardware error code?",
            "detail": "Classify the vector using its architectural definition.",
            "kind": "decision"
          },
          {
            "id": "dummy",
            "label": "Push synthetic zero",
            "detail": "Provide the missing error-code slot.",
            "kind": "process"
          },
          {
            "id": "vector",
            "label": "Push vector number",
            "detail": "Both routes now expose a vector followed by an error word.",
            "kind": "process"
          },
          {
            "id": "save",
            "label": "Save registers and call C",
            "detail": "Preserve state and prepare the C calling boundary.",
            "kind": "process"
          },
          {
            "id": "return",
            "label": "Restore or stop",
            "detail": "Return only when the handler’s policy permits safe resumption.",
            "kind": "terminal"
          }
        ],
        "edges": [
          {
            "to": "error",
            "from": "entry"
          },
          {
            "to": "dummy",
            "label": "No",
            "from": "error"
          },
          {
            "to": "vector",
            "label": "Yes",
            "from": "error"
          },
          {
            "to": "vector",
            "from": "dummy"
          },
          {
            "to": "save",
            "from": "vector"
          },
          {
            "to": "return",
            "from": "save"
          }
        ],
        "caption": "A single extra or missing word changes the meaning of the entire restore path."
      }
    },
    "diagnostics": {
      "title": "Capture evidence before using complicated services",
      "paragraphs": [
        "A fault report should be designed for the environment in which ordinary assumptions may already be broken. A bad pointer can be inside the normal console, and a damaged allocator can be holding its own lock. Reusing those facilities in the report can replace the first fault with a deadlock or another fault.",
        "Capture compact raw evidence first: vector, error code, saved instruction pointer, relevant registers, and CR2 for a page fault. Decode it only after the values are safe. A second page fault can overwrite CR2, so delaying that capture while formatting a long message risks reporting the wrong address."
      ],
      "example": {
        "title": "The report itself hangs",
        "intro": "Suppose ordinary console output holds console_lock when a bad pointer causes a page fault. The dispatcher calls the same console routine to print the error.",
        "steps": [
          {
            "title": "Identify the suspended owner",
            "explanation": "The interrupted code owns the lock but cannot run until the fault handler finishes. Its lock ownership did not disappear when the exception arrived."
          },
          {
            "title": "Identify the circular wait",
            "explanation": "The handler waits for the lock; the owner waits indirectly for the handler to return. On one CPU this cannot resolve through ordinary progress."
          },
          {
            "title": "Use an independent bounded path",
            "explanation": "Capture the frame and use a minimal output mechanism that does not acquire that lock or allocate memory. If output cannot complete, preserve the evidence and stop predictably."
          }
        ],
        "conclusion": "A diagnostic subsystem has to work under a smaller set of assumptions than the normal subsystem it diagnoses."
      },
      "pitfalls": [
        {
          "title": "Advancing EIP until the machine appears to continue",
          "text": "Skipping an unknown instruction length can enter the middle of another instruction. Even an accurately skipped instruction may leave the program’s state inconsistent."
        }
      ],
      "transfer": "If you see only the beginning of the report before reset, what should you inspect? The first handler’s stack, memory accesses, and nested-delivery path are now suspects. The original fault and the reporting fault may be separate bugs."
    },
    "proof": {
      "title": "Test delivery, preservation, and return separately",
      "paragraphs": [
        "A handler that prints has demonstrated one part of the path: entry reached code capable of output. It has not yet demonstrated that every interrupted register survives or that the return frame is correctly consumed. Give each claim a separate controlled observation so a failure identifies the affected part of the subsystem.",
        "Use assembly for instruction-level failure stimuli when the C language would otherwise permit the compiler to transform or eliminate the operation. Use an explicit assembly fault trigger so the experiment executes the exact machine instruction you intend. A small assembly experiment gives the CPU a defined stimulus and leaves the software response under your control."
      ],
      "example": {
        "title": "A returning breakpoint with register sentinels",
        "intro": "Install an appropriate breakpoint handler and prepare several general registers with recognizable values in a disposable assembly test.",
        "steps": [
          {
            "title": "Set a before-state",
            "explanation": "Choose distinct register patterns and a memory counter initialized to zero. Place INT3 immediately before a counter increment."
          },
          {
            "title": "Enter and return",
            "explanation": "Let the handler record its vector without deliberately changing the saved test registers. Its common entry and exit must preserve the interrupted state."
          },
          {
            "title": "Check two outcomes",
            "explanation": "After return, the counter should be one and the register sentinels should match. The counter tests resumption; the sentinels test preservation. Either can fail while the handler still prints."
          }
        ],
        "conclusion": "The observations identify which contract broke instead of treating every reset as an IDT encoding problem."
      },
      "pitfalls": [
        {
          "title": "Reusing the returning test for an unrepaired fault",
          "text": "A divide fault commonly returns to the offending instruction. Until its cause is repaired, the faulting instruction will cause repeated entry after each return."
        }
      ],
      "transfer": "What should happen before unmasking a device IRQ? Install its gate and valid entry path, establish device state, and define acknowledgment handling. A working breakpoint handler does not automatically provide those device-specific pieces."
    }
  },
  "memory-discovery": {
    "ownership": {
      "title": "Build a ledger of who may overwrite each range",
      "paragraphs": [
        "Usable RAM is a platform classification, while free RAM is a statement about current ownership. The difference changes during boot. A region can begin as usable, receive a loader buffer, and become temporarily unavailable to allocation even though its firmware type never changes. The allocator needs the current ownership ledger as well as firmware classifications.",
        "A reservation should carry a reason in your notes: kernel image, live stack, descriptor tables, map buffer, allocator metadata, or device window. Reasons explain when reclamation is safe. Without them, later code cannot distinguish permanent exclusions from temporary boot allocations and may either leak memory forever or reclaim it too early."
      ],
      "example": {
        "title": "Subtract a live boot buffer",
        "intro": "Assume firmware reports the hypothetical range [0x200000, 0x210000) as usable. Your loader stores a map in [0x203800, 0x204200).",
        "steps": [
          {
            "title": "Find the firmware capacity",
            "explanation": "The usable range covers 0x10000 bytes, or sixteen 4 KiB frames."
          },
          {
            "title": "Reserve all touched frames",
            "explanation": "The buffer touches the frames beginning at 0x203000 and 0x204000. Both must remain unavailable even though the buffer uses only part of each."
          },
          {
            "title": "Determine the immediate free set",
            "explanation": "Fourteen frames remain eligible in this example, assuming no other reservations. Reclaiming the two excluded frames requires proving that no live reference to the buffer remains."
          }
        ],
        "conclusion": "A byte-sized object can consume more than one frame of reservation because allocation happens at frame granularity."
      },
      "pitfalls": [
        {
          "title": "Treating a missing map record as permission",
          "text": "Unknown address ranges stay unavailable. Starting from “everything free” makes incomplete platform information dangerous."
        }
      ],
      "transfer": "If the kernel copies the map, is the old buffer immediately reusable? Only after all code has switched to the copy and no pointer, pending parsing operation, or other structure still refers to the original storage."
    },
    "e820": {
      "title": "Track protocol progress separately from buffer progress",
      "paragraphs": [
        "An iterative interface has two independent kinds of progress: the firmware continuation token and your destination cursor. The token belongs to firmware’s enumeration state. The cursor belongs to your storage layout. They can change by unrelated amounts, so write them in different columns when tracing the loop.",
        "Validate the returned record before using it to change allocator state. This creates a useful boundary between collection and interpretation. Collection checks the protocol and buffer capacity; normalization later reasons about overlap, range arithmetic, and eligibility. Keeping the raw records lets you explain how a suspicious normalized result arose."
      ],
      "example": {
        "title": "The final call still returns a record",
        "intro": "Imagine a buffer for four 24-byte slots and an enumeration that returns three valid records, with continuation tokens 0x91, 0x2A, and zero.",
        "steps": [
          {
            "title": "Begin enumeration",
            "explanation": "Pass EBX=0 for the first request. Store the accepted record in slot zero and preserve the returned 0x91 token exactly."
          },
          {
            "title": "Continue without inventing an index",
            "explanation": "Pass 0x91 and then 0x2A as required. The destination moves by a record slot each time, regardless of the numerical token values."
          },
          {
            "title": "Accept before terminating",
            "explanation": "The third call returns a valid record and EBX=0. Append that record, bringing the count to three, then finish. Checking zero before appending would silently lose the final range."
          }
        ],
        "conclusion": "The returned token tells firmware how to continue the next request. Store the record count separately."
      },
      "pitfalls": [
        {
          "title": "Reporting a truncated map as complete",
          "text": "If more records exist after your final available slot, fail the collection explicitly. A missing reserved interval can change the safety of the resulting free-frame set."
        }
      ],
      "transfer": "Should a zero-length record consume allocatable frames? No. It may still be useful raw evidence, but normalization contributes no usable interval from it. Protocol success and useful memory content are different decisions.",
      "flowchart": {
        "title": "Collect a complete bounded map",
        "intro": "A collector finishes only after a valid final response; running out of buffer space is an error.",
        "nodes": [
          {
            "id": "space",
            "label": "Buffer slot available?",
            "detail": "Check capacity before giving firmware the next destination.",
            "kind": "decision"
          },
          {
            "id": "call",
            "label": "Request next E820 record",
            "detail": "Supply the saved continuation token and initialized record buffer.",
            "kind": "process"
          },
          {
            "id": "valid",
            "label": "Response valid?",
            "detail": "Check call status, signature, and supported record length.",
            "kind": "decision"
          },
          {
            "id": "store",
            "label": "Append accepted record",
            "detail": "Preserve the returned record and increment the stored count.",
            "kind": "process"
          },
          {
            "id": "more",
            "label": "Continuation is zero?",
            "detail": "Zero means the just-returned record completed enumeration.",
            "kind": "decision"
          },
          {
            "id": "done",
            "label": "Pass complete map onward",
            "detail": "Normalization can now inspect the complete collection.",
            "kind": "terminal"
          },
          {
            "id": "fail",
            "label": "Report collection failure",
            "detail": "Do not label incomplete or malformed data as a complete map.",
            "kind": "terminal"
          }
        ],
        "edges": [
          {
            "to": "call",
            "label": "Yes",
            "from": "space"
          },
          {
            "to": "fail",
            "label": "No",
            "from": "space"
          },
          {
            "to": "valid",
            "from": "call"
          },
          {
            "to": "store",
            "label": "Yes",
            "from": "valid"
          },
          {
            "to": "fail",
            "label": "No",
            "from": "valid"
          },
          {
            "to": "more",
            "from": "store"
          },
          {
            "to": "done",
            "label": "Yes",
            "from": "more"
          },
          {
            "to": "space",
            "label": "No",
            "from": "more"
          }
        ],
        "caption": "The collector stores the last valid record before acting on its zero continuation token."
      }
    },
    "a20": {
      "title": "An aliasing test asks whether two names share one byte",
      "paragraphs": [
        "Two addresses alias when they select the same underlying storage. A20 masking is a particular hardware reason for aliasing, but the experimental reasoning is general: write distinct values through two names and see whether they remain independent. A successful control-register mode change cannot answer that memory-behavior question.",
        "The test itself is a temporary owner of the probe locations. Choose scratch locations under a documented platform policy, save original contents, prevent conflicting accesses for the required duration, and restore afterward. A test that proves A20 while corrupting a stack or firmware record has not established a usable boot environment."
      ],
      "example": {
        "title": "Predict both possible observations",
        "intro": "For an arithmetic example, consider physical addresses 0x0500 and 0x100500. Do not use them as probes until the actual boot memory ledger establishes that they are safe.",
        "steps": [
          {
            "title": "Compare address bits",
            "explanation": "The addresses differ by 0x100000, which changes bit 20 while retaining the same lower bits."
          },
          {
            "title": "Write distinguishable markers",
            "explanation": "After preserving contents, imagine writing 0x39 through the low address and 0xC6 through the high address. With independent storage, a low-address read still returns 0x39."
          },
          {
            "title": "Recognize aliasing",
            "explanation": "If address bit 20 is masked, the second write changes the same underlying byte and the low-address read returns 0xC6. Restore using a sequence correct for both possible relationships."
          }
        ],
        "conclusion": "The observation measures the address behavior after the enable request."
      },
      "pitfalls": [
        {
          "title": "Assuming protected mode enables A20",
          "text": "Processor mode and the platform’s A20 behavior are different pieces of state. Verify the required behavior before depending on high physical addresses."
        }
      ],
      "transfer": "Why test again after using an enable method? The command may be unsupported, delayed, or ineffective in that environment. Only the follow-up observation establishes the address independence your allocator will rely on."
    },
    "normalize": {
      "title": "Round according to what you are allowed to promise",
      "paragraphs": [
        "The allocator promises a whole writable frame. Therefore usable bytes justify a frame only when they cover every byte of it. A reservation makes the opposite promise: none of its bytes may be overwritten. Therefore any overlap is enough to exclude a frame. These are two different logical questions, so their rounding directions must differ.",
        "Normalize using a wide enough integer type and validate endpoint arithmetic before rounding. An overflowed end can make a huge invalid record appear to be a tiny low-memory interval. Validate the full-width range first, then deliberately clip it to the supported address range."
      ],
      "example": {
        "title": "A reservation crosses two otherwise usable frames",
        "intro": "Use usable interval [0x12003, 0x17900) and reservation [0x14FF8, 0x15008), with 0x1000-byte frames.",
        "steps": [
          {
            "title": "Round usable bounds inward",
            "explanation": "The first fully covered frame starts at 0x13000. The first excluded full-frame boundary is 0x17000, giving starts 0x13000, 0x14000, 0x15000, and 0x16000."
          },
          {
            "title": "Round reservation bounds outward",
            "explanation": "The sixteen-byte reservation crosses the boundary at 0x15000. Exclude both frames beginning at 0x14000 and 0x15000."
          },
          {
            "title": "Read the resulting free set",
            "explanation": "Only frame starts 0x13000 and 0x16000 remain from this example. The free-byte total is 8192, but those two frames are not a contiguous run."
          }
        ],
        "conclusion": "The final set reserves every frame touched by the object."
      },
      "pitfalls": [
        {
          "title": "Letting record order determine ownership",
          "text": "Applying a later usable record after a reservation can accidentally free the same bytes again. Resolve overlapping classifications conservatively and apply live reservations with final precedence."
        }
      ],
      "transfer": "If a reservation is exactly [0x18000, 0x19000), should it exclude frame 0x19000 too? No. The interval excludes its end, so only the frame at 0x18000 is touched."
    },
    "boot-info": {
      "title": "Validate the description before following its pointers",
      "paragraphs": [
        "A handoff structure crosses independently compiled components and sometimes independently versioned loaders. Its fields should describe a stable byte format: fixed-width integers, explicit sizes, and documented address meanings. A C pointer type by itself does not tell another component whether the number is physical, identity-mapped virtual, or an offset.",
        "Validation should move from the outside inward. First establish that the header is available and recognizable. Next validate the structure size and version. Then validate record count, stride, multiplication, and pointed-to extent. Only afterward iterate the records. This ordering prevents an invalid outer description from sending the parser into unrelated memory."
      ],
      "example": {
        "title": "Step through a larger record stride",
        "intro": "Suppose a compatible handoff says the map begins at physical 0x5000, contains five records, and uses a 32-byte stride. Your parser understands the required first 24 bytes of each record.",
        "steps": [
          {
            "title": "Compute the full extent",
            "explanation": "Five times 32 is 160 bytes, so the described map interval is [0x5000, 0x50A0), assuming arithmetic and accessibility checks pass."
          },
          {
            "title": "Advance by the producer’s stride",
            "explanation": "Record starts are 0x5000, 0x5020, 0x5040, 0x5060, and 0x5080. Advancing by your local 24-byte structure size would begin reading extension bytes as another record."
          },
          {
            "title": "Copy into owned storage",
            "explanation": "Accept only versions and extensions your interface permits, then copy the needed information before reclaiming the loader buffer or removing its mapping."
          }
        ],
        "conclusion": "Count, stride, and address semantics are all necessary to turn a pointer into a well-defined collection."
      },
      "pitfalls": [
        {
          "title": "Trusting an extension solely because its size fits",
          "text": "A sufficient size prevents one kind of bounds error. Version and field semantics still determine whether the bytes mean what your parser expects."
        }
      ],
      "transfer": "After paging starts, can you dereference physical value 0x5000 directly? Only if the address space maps that physical storage at virtual 0x5000. Otherwise use an established mapping or a validated earlier copy."
    }
  },
  "drivers-and-irqs": {
    "path": {
      "title": "Separate event delivery from data ownership",
      "paragraphs": [
        "An interrupt is a notification that makes the CPU run a handler. The data still belongs to a device register or software buffer until the handler transfers it. This is why counting interrupts and counting useful input bytes can produce different numbers: protocol responses, spurious events, and queue losses are distinct situations.",
        "A queue creates a clear ownership handoff. Before publication, the producer owns the slot it is filling. After publication, the consumer may read it. The consumer releases the slot only after reading its contents. On this single CPU the selected interrupt discipline can serialize conflicting operations, but the order of data writes and index updates must still express that handoff correctly."
      ],
      "example": {
        "title": "Publish a byte into an empty ring",
        "intro": "Use an eight-slot ring whose documented convention reserves one slot to distinguish full from empty. Let head=tail=3 initially.",
        "steps": [
          {
            "title": "Write the free slot",
            "explanation": "The interrupt-side producer stores a byte in slot 3. It has not yet advanced head, so the consumer should still interpret the published queue as empty."
          },
          {
            "title": "Publish the new head",
            "explanation": "Advance head to 4 under the queue’s synchronization rule. The interval now contains one readable byte.",
            "state": "head = 4; tail = 3"
          },
          {
            "title": "Consume then release",
            "explanation": "The consumer reads slot 3 and advances tail to 4. Both indices match again, indicating empty without changing the capacity convention."
          }
        ],
        "conclusion": "The index update is the publication event. Publishing first could let another execution context observe an unwritten slot."
      },
      "pitfalls": [
        {
          "title": "Treating EOI as consumption",
          "text": "Acknowledging the interrupt controller does not remove data from your software queue or decode a keyboard event. Each layer needs its own completion operation."
        }
      ],
      "transfer": "If seven bytes are already queued in this eight-slot design, can you enqueue one more? No. Reserving one slot gives seven usable entries. A count-based design could use all eight, but it needs different full/empty rules."
    },
    "pic": {
      "title": "Track the vector number and the controller route",
      "paragraphs": [
        "The CPU receives a vector, while driver configuration often begins with an IRQ line. Remapping defines the conversion between them. Keep the line number available when choosing which controller to acknowledge; deriving acknowledgment from an unrelated exception vector can send commands to hardware that never participated.",
        "Masks are shared configuration. A driver that enables one line should preserve the current policy for other lines. This can be expressed as a read-modify-write of a software shadow under the appropriate synchronization. Replacing the entire mask with a convenient constant is valid only when one initialization routine intentionally owns the whole configuration."
      ],
      "example": {
        "title": "Route a real slave interrupt",
        "intro": "With the course remapping, imagine a real IRQ10 event from a configured device. This example excludes the separately handled spurious cases.",
        "steps": [
          {
            "title": "Find the slave input",
            "explanation": "IRQ10 is local slave line 2 because the slave covers IRQ8 through IRQ15. Its vector is 0x28 + 2 = 0x2A."
          },
          {
            "title": "Find all required unmasked lines",
            "explanation": "The slave’s line 2 must be enabled and the master’s cascade line IRQ2 must also be enabled. Opening only one part of the route leaves delivery blocked."
          },
          {
            "title": "Finish servicing the route",
            "explanation": "After the device-specific service protocol, acknowledge the slave and then the master. The route involved both controllers, unlike a master-only IRQ."
          }
        ],
        "conclusion": "The route explains both the mask requirements and why two acknowledgments may be necessary."
      },
      "pitfalls": [
        {
          "title": "Using this sequence blindly for every vector",
          "text": "CPU exceptions have no PIC EOI, and spurious IRQ7 or IRQ15 require their own in-service checks. A common helper must document what classification occurred before it was called."
        }
      ],
      "transfer": "If the timer is enabled and you want to add the keyboard, should you mask the timer again? Usually no. Preserve the timer’s enabled bit while changing only the keyboard policy, unless you are deliberately reinitializing the whole interrupt subsystem."
    },
    "pit": {
      "title": "Convert a requested rate into an actual interval",
      "paragraphs": [
        "The requested timer frequency is a design input; the divisor is the representable hardware setting. Because the divisor is an integer, the configured nominal rate usually differs slightly from the requested one. Store or derive the actual setting so later time conversion does not repeatedly assume an unattainable ideal rate.",
        "A timer interrupt can provide a scheduling opportunity without serving as a calibrated wall clock. A delayed handler can observe a tick later than its nominal event time, and a 64-bit tick value can be torn when read as two 32-bit words. These are separate issues: event latency concerns when code runs, while a consistent snapshot concerns whether the value you read ever actually existed."
      ],
      "example": {
        "title": "Request approximately 250 events per second",
        "intro": "Use nominal input frequency 1,193,182 Hz and round the divisor to the nearest integer.",
        "steps": [
          {
            "title": "Calculate the divisor",
            "explanation": "1,193,182 / 250 = 4772.728, which rounds to 4773. That integer fits the timer’s supported range."
          },
          {
            "title": "Calculate the actual nominal rate",
            "explanation": "1,193,182 / 4773 is about 249.9858 Hz. One period is approximately 4.00023 ms, slightly longer than exactly four milliseconds."
          },
          {
            "title": "Encode the setting",
            "explanation": "4773 is hexadecimal 0x12A5. Under the selected low-byte-then-high-byte access mode, write 0xA5 followed by 0x12."
          }
        ],
        "conclusion": "Small rounding differences are predictable. An accurate elapsed-time measurement must account for the programmed divisor and actual clock behavior."
      },
      "pitfalls": [
        {
          "title": "Reading half of one counter value and half of another",
          "text": "If the lower 32 bits wrap between loads, a naive 64-bit read can combine mismatched halves. Use a consistent snapshot under the chosen interrupt discipline."
        }
      ],
      "transfer": "If a handler runs late, should it automatically add extra ticks guessed from the delay? Not without a defined clock source and accounting policy. A handled-event counter and elapsed-time estimate should have clearly different meanings."
    },
    "keyboard": {
      "title": "A decoder remembers events that have already happened",
      "paragraphs": [
        "Text input is history-dependent. The same letter key can produce different text depending on Shift and layout state. Prefix bytes can also change the interpretation of the following byte. A stateless lookup from every incoming byte to one character cannot represent that history, even when it appears to work for a few ordinary key presses.",
        "Keep command-response handling separate from key decoding. An acknowledgment belongs to an outstanding command transaction; a key release updates key state; a printable press may become text. Combining these categories too early produces mysterious characters and stuck modifiers. A raw-byte trace makes it possible to see which layer first misclassified an event."
      ],
      "example": {
        "title": "Follow a shifted letter through the layers",
        "intro": "Assume a configured scan-code set and translation mode that your decoder explicitly supports. Work with named events so this example does not mix byte encodings from different scan-code sets.",
        "steps": [
          {
            "title": "Press Shift",
            "explanation": "The raw sequence decodes to a Shift-down key event. Record modifier state; do not insert a printable character."
          },
          {
            "title": "Press and release a letter",
            "explanation": "The press becomes a letter key event, and the text-layout layer consults the active Shift state to choose the uppercase character. The release updates state without inserting another character."
          },
          {
            "title": "Release Shift",
            "explanation": "Clear the corresponding modifier state. A later letter press should now use the unshifted mapping, assuming no other active modifier changes it."
          }
        ],
        "conclusion": "The raw decoder produces key meaning; the text layer combines that meaning with layout and modifier history."
      },
      "pitfalls": [
        {
          "title": "Dropping a prefix without resetting partial state",
          "text": "Queue overflow can break a multi-byte sequence. Record the loss and reset or resynchronize the affected decoder state according to its protocol before interpreting the next byte."
        }
      ],
      "transfer": "Why must a command retry not appear in the text queue? Its response is control information for the command state machine. Turning it into text confuses device management with the user’s key events.",
      "flowchart": {
        "title": "Decode outside the interrupt handler",
        "intro": "The fast handler captures bytes; ordinary code performs the stateful interpretation.",
        "nodes": [
          {
            "id": "receive",
            "label": "Capture raw byte",
            "detail": "Read available device data using the controller protocol.",
            "kind": "process"
          },
          {
            "id": "space",
            "label": "Queue has space?",
            "detail": "Use the documented full/empty convention.",
            "kind": "decision"
          },
          {
            "id": "enqueue",
            "label": "Publish queued byte",
            "detail": "Store the byte before advancing the producer position.",
            "kind": "process"
          },
          {
            "id": "drop",
            "label": "Count loss and resynchronize",
            "detail": "Record overflow and recover partial decoder state.",
            "kind": "process"
          },
          {
            "id": "consume",
            "label": "Consume in ordinary context",
            "detail": "Route command responses separately from scan-code data.",
            "kind": "process"
          },
          {
            "id": "complete",
            "label": "Key event complete?",
            "detail": "Prefixes may require another byte.",
            "kind": "decision"
          },
          {
            "id": "event",
            "label": "Update keys and produce text",
            "detail": "Apply modifier and layout rules to completed events.",
            "kind": "terminal"
          }
        ],
        "edges": [
          {
            "to": "space",
            "from": "receive"
          },
          {
            "to": "enqueue",
            "label": "Yes",
            "from": "space"
          },
          {
            "to": "drop",
            "label": "No",
            "from": "space"
          },
          {
            "to": "consume",
            "from": "enqueue"
          },
          {
            "to": "consume",
            "from": "drop"
          },
          {
            "to": "complete",
            "from": "consume"
          },
          {
            "to": "consume",
            "label": "No, await more",
            "from": "complete"
          },
          {
            "to": "event",
            "label": "Yes",
            "from": "complete"
          }
        ],
        "caption": "Waiting for more bytes belongs to decoder state; the IRQ handler does not wait for an entire key sequence."
      }
    },
    "output": {
      "title": "Use pitch when rows contain padding",
      "paragraphs": [
        "A framebuffer’s geometry and storage layout are related but different. Width counts visible pixels; pitch counts bytes from one row start to the next. Padding may exist after the visible pixels of each row. Ignoring that padding makes the first row look correct while each later row drifts farther from its intended location.",
        "The text-console layer should own cursor movement, wrapping, and scrolling. A backend should own the conversion into cells or pixels. This boundary lets you compare VGA and framebuffer output using the same small text-model tests, then separately check address calculations for each hardware representation."
      ],
      "example": {
        "title": "Locate a pixel in a padded framebuffer",
        "intro": "Assume a hypothetical 640-pixel-wide surface with four bytes per pixel, pitch 2688 bytes, and a valid mapped extent large enough for the chosen row.",
        "steps": [
          {
            "title": "Select the row start",
            "explanation": "For zero-based row 9, multiply 9 by pitch to obtain 24192 bytes. Using width × 4 would instead produce 23040, already 1152 bytes too early."
          },
          {
            "title": "Select the pixel within the row",
            "explanation": "Column 13 contributes 13 × 4 = 52 bytes. The correct offset is 24244 bytes from the framebuffer base."
          },
          {
            "title": "Validate the full store",
            "explanation": "Check row and column bounds, overflow in arithmetic, and that the complete four-byte pixel fits the mapped extent. Then encode color according to the declared pixel format."
          }
        ],
        "conclusion": "A correct address is only half the operation; channel ordering determines which color those bytes display."
      },
      "pitfalls": [
        {
          "title": "Scrolling overlapping rows with an arbitrary copy",
          "text": "Moving later rows toward the beginning requires an overlap-safe operation or an appropriate direction. A copy that destroys unread source pixels can repeat or smear rows."
        }
      ],
      "transfer": "Should the panic path acquire the normal console lock? That can deadlock if the fault interrupted its owner. Preserve a minimal bounded diagnostic output route with fewer dependencies than normal rendering."
    },
    "verification": {
      "title": "Measure where input disappears",
      "paragraphs": [
        "Counters are useful when each counts a defined event. “Interrupts received” is different from “bytes read”, “bytes queued”, and “characters produced”. Record the relationship between the two totals and explain any difference. Some bytes are control responses, some complete only part of a key sequence, and some may be dropped under a documented overflow policy.",
        "A controlled workload should change one pressure at a time. First establish the normal path with a fast consumer. Then deliberately slow consumption while keeping the handler short. This reveals queue behavior without introducing an unrelated delay inside the IRQ path. Repeated handler logging can itself cause the latency you are trying to investigate."
      ],
      "example": {
        "title": "Account for a burst against a small queue",
        "intro": "Use a seven-entry usable ring, initially empty, and inject ten ordinary raw data bytes while the consumer is deliberately paused. Assume the chosen policy drops new arrivals when full.",
        "steps": [
          {
            "title": "Predict the retained data",
            "explanation": "The first seven bytes fit, and the final three are rejected. Queue occupancy reaches seven and must not exceed it."
          },
          {
            "title": "Predict the diagnostics",
            "explanation": "The input counter records ten captured data bytes, the enqueue counter records seven successes, and the drop counter records three losses."
          },
          {
            "title": "Resume the consumer",
            "explanation": "It receives the original seven retained bytes in order. If unread entries changed to newer bytes, the implementation silently overwrote data instead of following its declared policy."
          }
        ],
        "conclusion": "Accounting gives overflow a specific expected behavior instead of treating any missing character as a hardware mystery."
      },
      "pitfalls": [
        {
          "title": "Mistaking a clue for a diagnosis",
          "text": "One interrupt followed by silence suggests investigating acknowledgment, but masking, device configuration, and faults can also stop delivery. Compare the relevant counters and machine state."
        }
      ],
      "transfer": "What if raw-byte accounting is correct but text is wrong? Investigate the command routing, scan-code state machine, modifiers, and layout conversion. The evidence now points beyond the initial interrupt and queue handoff."
    }
  },
  "physical-memory": {
    "unit": {
      "title": "Give every bitmap bit a physical interpretation",
      "paragraphs": [
        "The bitmap compresses a large address space into small metadata, so two units coexist in nearly every expression. A frame number selects a unit of physical storage. A byte index and bit position select its metadata. Writing the units beside intermediate values helps catch a mistaken division by eight where a division by 4096 belongs.",
        "Eligibility and current allocation are separate facts. A reserved frame is unavailable because it must never be given to this allocator’s callers. An allocated frame is unavailable because one caller currently owns it. Release changes the busy state while retaining the eligibility decision. Keeping them separate prevents an invalid free from converting the kernel’s own storage into available RAM."
      ],
      "example": {
        "title": "Locate frame 29 in both spaces",
        "intro": "Assume frames are 4096 bytes and each metadata byte stores eight frame bits.",
        "steps": [
          {
            "title": "Find the physical interval",
            "explanation": "Frame 29 begins at 29 × 4096 = 0x1D000 and covers [0x1D000, 0x1E000). This is the storage a successful allocation would identify."
          },
          {
            "title": "Find the metadata byte",
            "explanation": "29 / 8 gives quotient 3 and remainder 5. Use bitmap byte 3 and mask 1 << 5, which is 0x20."
          },
          {
            "title": "Change only its allocation state",
            "explanation": "If the frame is eligible and free, setting its busy bit claims it. The other seven bits in that byte must retain their meanings for other frames."
          }
        ],
        "conclusion": "The metadata location and the allocated memory location describe the same frame in different coordinate systems."
      },
      "pitfalls": [
        {
          "title": "Forgetting metadata storage itself",
          "text": "A bitmap occupies ordinary RAM. Reserve the frames holding it before allowing allocation, or a caller can overwrite the allocator’s own ownership record."
        }
      ],
      "transfer": "How many bytes does one bitmap need for 19 frames? Three: two bytes cover sixteen frames, and a third holds the remaining three bits. Ignore or reserve the unused high bits so only real frames can be returned."
    },
    "initialization": {
      "title": "Construct the free set before exposing the allocator",
      "paragraphs": [
        "Initialization is a transaction over the whole pool. During that transaction a frame may temporarily look usable before a later reservation excludes it. Runtime callers must not observe those intermediate states. Finish map interpretation and reservations before publishing an allocator-ready state.",
        "The conversion from byte ranges to frame-number ranges belongs at an explicit boundary. The helper that marks frames 4 through 8 expects frame indices. Convert the physical byte addresses 0x4000 through 0x8000 to those indices before calling it. Similar-looking integer parameters can express radically different units, so name them accordingly and reject invalid bounds before mutation."
      ],
      "example": {
        "title": "Initialize a twelve-frame teaching pool",
        "intro": "Start with frame numbers 0 through 11 all unavailable. Firmware normalization allows frames [2,11); current kernel reservations exclude [4,6) and [9,10).",
        "steps": [
          {
            "title": "Mark the usable interval",
            "explanation": "Frames 2 through 10 become candidates, giving nine frames before applying live reservations."
          },
          {
            "title": "Subtract reservations",
            "explanation": "Frames 4, 5, and 9 stay unavailable. The final free set is {2,3,6,7,8,10}, containing six frames."
          },
          {
            "title": "Begin runtime allocation",
            "explanation": "A first-fit allocator returns frame 2 at physical 0x2000, then frame 3 at 0x3000. It skips reserved holes and checks each candidate frame’s availability."
          }
        ],
        "conclusion": "The scan loop is only as safe as this initial set. Correct allocation cannot repair an incorrect eligibility map."
      },
      "pitfalls": [
        {
          "title": "Running boot helpers after allocations begin",
          "text": "Marking a range usable again can clear busy bits belonging to live callers. Reclamation needs a separate operation that verifies lifetime conditions before releasing storage."
        }
      ],
      "transfer": "If the map reports memory beyond the implementation’s managed cap, should the frame index wrap into the bitmap? No. Validate and clip intentionally to supported ranges; leave unsupported physical memory unmanaged."
    },
    "concurrency": {
      "title": "Protect the decision and the claim together",
      "paragraphs": [
        "A resource claim is a read followed by a decision followed by a write. The unsafe interleaving happens between these steps, so protecting only the write does not establish exclusive ownership. The protected region also needs to include associated free-count and owner-tag updates, or debugging metadata can disagree with the actual bitmap.",
        "On the initial single CPU, saving and disabling local interrupts can exclude an interrupt-side caller. Restoring the saved state matters for nested use: an allocator invoked with interrupts already disabled must not enable them unexpectedly. Later, another CPU introduces concurrency that this local mechanism cannot stop."
      ],
      "example": {
        "title": "Two callers race for one frame",
        "intro": "Suppose frame 7 is the only eligible free frame and two execution contexts call allocation.",
        "steps": [
          {
            "title": "Observe the unsafe schedule",
            "explanation": "Caller A reads free and is interrupted. Caller B also reads free, claims frame 7, and returns. A resumes and returns the same frame. The final bitmap looks plausible despite duplicated ownership."
          },
          {
            "title": "Move the entire operation under protection",
            "explanation": "The second caller cannot inspect the protected state until A completes its claim. It then observes no free frame and takes the normal failure path."
          },
          {
            "title": "Prepare before publishing",
            "explanation": "If the next owner is a user process, ensure the selected layer clears old contents through a valid mapping before making the frame accessible to that process."
          }
        ],
        "conclusion": "Exclusive claiming and safe initialization solve different problems; both are needed before a new owner can use the storage."
      },
      "pitfalls": [
        {
          "title": "Adding an ordinary spinlock inside a preempted owner’s IRQ",
          "text": "An interrupt can wait forever for a lock held by the context it interrupted. Choose a calling-context policy that prevents that deadlock."
        }
      ],
      "transfer": "What if A has claimed the frame but zeroing fails because no temporary mapping is available? Keep it private, release it through the defined rollback path, and report failure. Do not publish a partially prepared user mapping.",
      "flowchart": {
        "title": "Claim, prepare, then publish",
        "intro": "A frame becomes visible to a caller only after its ownership and required preparation are complete.",
        "nodes": [
          {
            "id": "lock",
            "label": "Enter allocator protection",
            "detail": "Preserve the caller’s interrupt state and serialize the metadata.",
            "kind": "process"
          },
          {
            "id": "found",
            "label": "Free eligible frame found?",
            "detail": "Search the represented range without touching reserved frames.",
            "kind": "decision"
          },
          {
            "id": "claim",
            "label": "Mark frame busy",
            "detail": "Update the ownership metadata as one protected operation.",
            "kind": "process"
          },
          {
            "id": "prepare",
            "label": "Preparation succeeds?",
            "detail": "After leaving metadata protection, establish any required mapping and initialization while the frame stays private.",
            "kind": "decision"
          },
          {
            "id": "publish",
            "label": "Return prepared frame",
            "detail": "The caller can now depend on the promised contents.",
            "kind": "terminal"
          },
          {
            "id": "release",
            "label": "Release private claim",
            "detail": "Undo resources acquired for the failed preparation.",
            "kind": "process"
          },
          {
            "id": "fail",
            "label": "Return failure",
            "detail": "No live caller receives the unprepared frame.",
            "kind": "terminal"
          }
        ],
        "edges": [
          {
            "to": "found",
            "from": "lock"
          },
          {
            "to": "claim",
            "label": "Yes",
            "from": "found"
          },
          {
            "to": "fail",
            "label": "No frame",
            "from": "found"
          },
          {
            "to": "prepare",
            "label": "Unlock",
            "from": "claim"
          },
          {
            "to": "publish",
            "label": "Yes",
            "from": "prepare"
          },
          {
            "to": "release",
            "label": "No",
            "from": "prepare"
          },
          {
            "to": "fail",
            "from": "release"
          }
        ],
        "caption": "Initialization policy can live above the PMM, but publication must still wait until that layer completes its promise."
      }
    },
    "ownership": {
      "title": "Track a frame’s lifetime beyond one mapping",
      "paragraphs": [
        "The same physical frame can be reached through multiple virtual mappings. One mapping can disappear while another remains valid. Therefore page-table removal and frame release are different operations. Decide which object owns the allocation and which references keep that owner alive before writing the last-reference path.",
        "Contiguity also has two meanings. A virtual array can occupy consecutive virtual pages backed by scattered physical frames. A device request may instead require consecutive physical addresses. Four successful ordinary allocations do not establish a four-frame physical run, even when a small test machine happens to return consecutive results."
      ],
      "example": {
        "title": "Release a shared data frame",
        "intro": "Let frame F be mapped into process A and process B under a policy that counts one ownership reference for each active sharing relationship.",
        "steps": [
          {
            "title": "Remove A’s relationship",
            "explanation": "After removing A’s mapping and completing the required translation synchronization, one sharing reference remains. B can still read the frame, so F must stay allocated."
          },
          {
            "title": "Remove B’s relationship",
            "explanation": "Remove B’s mapping and account for other references, such as a kernel operation temporarily using the same storage. A mapping count alone is sufficient only if the ownership policy says it is."
          },
          {
            "title": "Return storage at the real endpoint",
            "explanation": "When no owner or stale permitted access can reach the old lifetime, release F to the PMM. Its next allocation may belong to an unrelated subsystem."
          }
        ],
        "conclusion": "Reference accounting describes lifetimes; mapping synchronization ensures old translations cannot outlive the release decision."
      },
      "pitfalls": [
        {
          "title": "Freeing each entry of a partially acquired run without tracking it",
          "text": "If a multi-frame request fails halfway through, release exactly the frames acquired by that request. Track only initialized result-array entries as ownership records."
        }
      ],
      "transfer": "A pool has free frames {2,4,6,8}. Can it satisfy a four-frame physical run? No. It can satisfy four individual allocations, which a VMM could map consecutively, but physical adjacency is a separate requirement."
    },
    "test": {
      "title": "Use failure to test preservation of ownership",
      "paragraphs": [
        "Allocation tests should verify the required properties of every live result. Alignment and range checks are necessary, but two individually valid addresses can still be duplicates. Keep a set of currently owned frames and reject a result already present in that set.",
        "Failed operations must preserve state according to the API contract. Capture the bitmap and relevant counters before an invalid free or exhausted allocation, then compare afterward. A false return after accidentally clearing a bit is still a corruption bug. Failure-path checks catch errors that successful allocate/free cycles never exercise."
      ],
      "example": {
        "title": "Exhaust a pool with reserved holes",
        "intro": "In a pool with frame numbers 0 through 7, reserve frames 0, 3, and 6. Assume a first-fit policy.",
        "steps": [
          {
            "title": "Predict the complete allocation order",
            "explanation": "The five successful results correspond to frames 1, 2, 4, 5, and 7. The next request fails without modifying the pool or a documented untouched output value."
          },
          {
            "title": "Create controlled reusable holes",
            "explanation": "Free frames 2 and 5. A new pair of allocations should recover exactly those frames under first fit, while every other live frame retains its marker contents."
          },
          {
            "title": "Attack the rejection path",
            "explanation": "Attempt an unaligned free, reserved frame 3, out-of-range frame 8, and a repeated free before reallocation. Every rejection should preserve both allocation bits and eligibility."
          }
        ],
        "conclusion": "The small pool makes every ownership change visible, including the transition from one last free frame to exhaustion."
      },
      "pitfalls": [
        {
          "title": "Expecting a busy bit to identify an old pointer lifetime",
          "text": "After an address is freed and reused, the same number can designate a new allocation. A simple bitmap cannot know that a caller retained a stale reference."
        }
      ],
      "transfer": "Why also test initialization with partial usable pages? Runtime scanning can pass every tiny-pool test while firmware normalization incorrectly exposes a frame containing reserved bytes. The integration boundary has its own invariants."
    }
  },
  "virtual-memory": {
    "walk": {
      "title": "Keep entry addresses separate from the translated byte",
      "paragraphs": [
        "The page walk performs address calculations at three levels. First it locates a directory entry. Then it locates a table entry. Finally it combines the selected frame base with the original offset. The first two results point to metadata; only the final result identifies the requested data byte.",
        "In this non-PAE 4 KiB mode, each entry is four bytes and each table contains 1024 entries. Mask off flag bits before interpreting an entry as an aligned physical base. A pointer the kernel uses to edit that memory may have a different virtual value from the physical base stored in CR3 or the entry."
      ],
      "example": {
        "title": "Walk address 0x00C07ABC",
        "intro": "Assume the directory occupies physical 0x200000, directory entry 3 selects table frame 0x210000, and table entry 7 selects data frame 0x345000. All required presence and permission checks pass.",
        "steps": [
          {
            "title": "Extract the address fields",
            "explanation": "The directory index is 3, the table index is 7, and the offset is 0xABC.",
            "state": "(3 << 22) | (7 << 12) | 0xABC = 0x00C07ABC"
          },
          {
            "title": "Locate the metadata entries",
            "explanation": "Directory entry 3 resides at 0x200000 + 3 × 4 = 0x20000C. Table entry 7 resides at 0x210000 + 7 × 4 = 0x21001C."
          },
          {
            "title": "Locate the requested byte",
            "explanation": "Use the frame base read from the table entry and retain the offset: 0x345000 + 0xABC = 0x345ABC."
          }
        ],
        "conclusion": "The virtual offset survives translation unchanged; the page number is replaced through the tables."
      },
      "pitfalls": [
        {
          "title": "Dereferencing the page-table physical base as an arbitrary C pointer",
          "text": "This works only when a known virtual mapping makes that physical storage accessible at the pointer value being used."
        }
      ],
      "transfer": "What changes for the next virtual byte, 0x00C07ABD? The indices remain 3 and 7; only the offset increases. Crossing 0x00C08000 instead selects a different table entry."
    },
    "bootstrap": {
      "title": "List every address the transition still needs",
      "paragraphs": [
        "Turning on paging does not reset execution to a fresh environment. The next instruction, current stack, return address, descriptor tables, and any diagnostic path must remain reachable. An identity bridge lets these existing numerical addresses continue to name their previous storage during the transition.",
        "The bootstrap table deliberately maps a bounded region. Access to additional physical RAM requires suitable mappings. Once a PMM can return a frame outside that region, the kernel needs a mapping mechanism before writing through it. This is one reason PMM and VMM interfaces should remain distinct from ordinary C allocation."
      ],
      "example": {
        "title": "A stack just outside the initial map",
        "intro": "Assume the initial identity map covers [0x1000, 0x400000), leaving page zero absent. Kernel code is below 1 MiB, but an experimental stack begins at 0x500000.",
        "steps": [
          {
            "title": "Check the next fetch",
            "explanation": "The instruction following the paging-enable write remains mapped because its address is inside the low region. Execution can continue briefly."
          },
          {
            "title": "Check the next stack access",
            "explanation": "A CALL or PUSH near the high stack pointer needs a mapping around 0x4FFFFC. The bootstrap map does not provide it, so that access faults."
          },
          {
            "title": "Check the handler’s own dependency",
            "explanation": "If exception delivery uses the same inaccessible stack, reporting can fail too. Map the intended stack before enabling paging or keep it inside the established bridge."
          }
        ],
        "conclusion": "Reaching one instruction after the control-register change does not prove every immediate dependency is mapped."
      },
      "pitfalls": [
        {
          "title": "Assuming alignment chooses placement",
          "text": "A 4096-byte alignment attribute constrains the object’s boundary. It does not by itself guarantee the object lies inside the region your loader loads or your initial tables map."
        }
      ],
      "transfer": "Why leave page zero unmapped? It turns many null-pointer accesses into observable faults. This diagnostic policy catches accesses to the absent page. Invalid pointers that reach other mapped pages require additional checks."
    },
    "permissions": {
      "title": "Evaluate access through the complete route",
      "paragraphs": [
        "Permissions apply to an attempted access by a particular execution context. A mapping can allow a kernel read while rejecting a user write. State the caller’s privilege and the operation before deciding whether bits are “correct”. Looking at a PTE without its PDE and control-register policy omits part of the access check.",
        "For this chapter’s paging mode, granting user access at the leaf is insufficient if the directory entry restricts the route to supervisor. Similarly, read-only restrictions can come from either level. CR0.WP determines the relevant treatment of supervisor writes to read-only mappings; enabling it lets the kernel detect more of its own accidental writes."
      ],
      "example": {
        "title": "A permissive leaf behind a restricted directory",
        "intro": "Assume both levels are present, the PDE is supervisor-only and writable, and the PTE is user-accessible and writable.",
        "steps": [
          {
            "title": "Attempt a user read",
            "explanation": "The directory’s supervisor restriction rejects the route. The PTE cannot override a restriction imposed earlier in the walk."
          },
          {
            "title": "Attempt a kernel read",
            "explanation": "The supervisor context can use the present mapping under these ordinary permissions. The address has not become generally readable merely because this access works."
          },
          {
            "title": "Change the example to read-only",
            "explanation": "If the route permits supervisor access but its effective write permission is read-only, a supervisor write is rejected with WP enabled. A test must establish WP before drawing that conclusion."
          }
        ],
        "conclusion": "The result belongs to the combination of context, operation, tables, and control settings."
      },
      "pitfalls": [
        {
          "title": "Adding an NX flag to this entry format",
          "text": "The initial 32-bit non-PAE entries used here have no NX bit. Execution-control designs for other paging modes cannot be pasted into this format unchanged."
        }
      ],
      "transfer": "Can two processes share the same supervisor-only kernel mapping while user code is isolated from it? Yes, under a correct permission setup. Shared presence and user permission are separate properties."
    },
    "faults": {
      "title": "A missing translation needs a policy decision",
      "paragraphs": [
        "A page fault reports an attempted access that translation or protection could not permit. The report does not tell the kernel whether the request was reasonable. That judgment requires a virtual-area policy: which ranges belong to the process, which operations they allow, and whether backing memory may be created on demand.",
        "Repair is a transaction. Claim storage, prepare its contents, make the page-table path valid, publish the entry with intended permissions, and complete required translation synchronization. If one step fails, unwind only resources acquired for this repair. Returning to the faulting instruction is justified after the original access can actually succeed."
      ],
      "example": {
        "title": "Compare two writes to absent pages",
        "intro": "Suppose a process owns a demand-zero region [0x400000, 0x408000), and the adjacent range [0x408000, 0x409000) is a deliberate guard page.",
        "steps": [
          {
            "title": "Write inside the permitted region",
            "explanation": "A write to 0x403120 falls in the owned region. If the access type is allowed and resources are available, the kernel can back page 0x403000 with cleared storage."
          },
          {
            "title": "Write into the guard",
            "explanation": "A write to 0x408020 is outside the permitted growth region. Allocating storage there would erase the guard policy and permit the forbidden access."
          },
          {
            "title": "Use the report to explain the outcome",
            "explanation": "Both events can be non-present write faults, but the virtual-area lookup selects repair for the first and rejection for the second. CR2 gives the attempted address; saved EIP locates the instruction."
          }
        ],
        "conclusion": "Identical fault categories can require different responses because ownership policy lives outside the hardware tables."
      },
      "pitfalls": [
        {
          "title": "Demand-allocating every fault",
          "text": "This makes wild pointers acquire storage and can hide serious bugs. Permission violations also require a different explanation from missing backing memory."
        }
      ],
      "transfer": "If allocation fails for the permitted page, should the logical region shrink silently? No. Follow the defined failure policy while preserving coherent ownership and mappings; resource failure does not rewrite the process’s contract by accident.",
      "flowchart": {
        "title": "Decide whether a fault is repairable",
        "intro": "The hardware report identifies the access; the kernel’s region policy decides whether to supply missing storage.",
        "nodes": [
          {
            "id": "capture",
            "label": "Capture fault evidence",
            "detail": "Save the fault address, error code, and instruction location.",
            "kind": "process"
          },
          {
            "id": "allowed",
            "label": "Access valid for its region?",
            "detail": "Check ownership, bounds, and requested operation.",
            "kind": "decision"
          },
          {
            "id": "repairable",
            "label": "Missing backing is allowed?",
            "detail": "Distinguish supported demand allocation from protection errors.",
            "kind": "decision"
          },
          {
            "id": "prepare",
            "label": "Prepare mapping transaction",
            "detail": "Acquire and clear storage, then install the valid route.",
            "kind": "process"
          },
          {
            "id": "success",
            "label": "Repair completed?",
            "detail": "All resources and page-table updates must succeed.",
            "kind": "decision"
          },
          {
            "id": "retry",
            "label": "Return and retry instruction",
            "detail": "The original access can now satisfy the region policy.",
            "kind": "terminal"
          },
          {
            "id": "reject",
            "label": "Reject or report failure",
            "detail": "Release partial resources and apply the kernel’s fault policy.",
            "kind": "terminal"
          }
        ],
        "edges": [
          {
            "to": "allowed",
            "from": "capture"
          },
          {
            "to": "repairable",
            "label": "Yes",
            "from": "allowed"
          },
          {
            "to": "reject",
            "label": "No",
            "from": "allowed"
          },
          {
            "to": "prepare",
            "label": "Yes",
            "from": "repairable"
          },
          {
            "to": "reject",
            "label": "No",
            "from": "repairable"
          },
          {
            "to": "success",
            "from": "prepare"
          },
          {
            "to": "retry",
            "label": "Yes",
            "from": "success"
          },
          {
            "to": "reject",
            "label": "No",
            "from": "success"
          }
        ],
        "caption": "A guard-page access follows rejection even if physical memory is plentiful."
      }
    },
    "tlb": {
      "title": "Invalidate before an old frame acquires a new owner",
      "paragraphs": [
        "A page table is the authoritative description in memory, but a CPU may already have a cached result. Changing the description does not instantly eliminate every cached translation. Complete the required invalidation before reporting the mapping operation finished.",
        "The most serious consequence appears at reuse. If the old frame is returned to the allocator before stale access has been excluded, an old virtual address can reach data belonging to a new owner. This is why reference accounting, page-table locking, and translation invalidation have to cooperate even though they solve distinct pieces of the lifetime problem."
      ],
      "example": {
        "title": "Replace one mapping with a recognizable second frame",
        "intro": "Let virtual page 0x600000 map frame A=0x220000, containing byte 0x41 at offset 0x80. Frame B=0x330000 contains 0x42 at the same offset.",
        "steps": [
          {
            "title": "Establish the old result",
            "explanation": "Read virtual address 0x600080 and observe 0x41. The processor may now have the translation cached."
          },
          {
            "title": "Replace and synchronize",
            "explanation": "Update the PTE to B under the mapping policy and invalidate the relevant virtual page on affected processors. Pass the affected virtual address to INVLPG."
          },
          {
            "title": "Observe and release safely",
            "explanation": "A later read should observe 0x42. Release A only when ownership and translation synchronization establish that no old access can still use its prior lifetime."
          }
        ],
        "conclusion": "The two marker values make a remapping experiment observable without depending on a crash."
      },
      "pitfalls": [
        {
          "title": "Assuming a local invalidation reaches another CPU",
          "text": "The instruction acts on the executing processor. A shared address space running elsewhere needs the appropriate shootdown and completion protocol."
        }
      ],
      "transfer": "Does changing a page from writable to read-only need the same care? Yes. A stale permissive translation can preserve access that the new PTE intends to remove. Permission changes also have a completion boundary."
    }
  },
  "kernel-heap": {
    "layers": {
      "title": "Follow a small object through three ownership layers",
      "paragraphs": [
        "A heap allocation returns a pointer with an object lifetime. The backing virtual pages can outlive that object, and the physical frames can outlive an individual mapping. These nested lifetimes explain why freeing a 40-byte object usually does not immediately return a 4096-byte frame to the PMM.",
        "The first fixed arena lets you isolate object bookkeeping. Its storage already exists, so splitting and coalescing do not need to manipulate page tables. Once those operations are trustworthy, heap growth can request more mapped storage. Keeping the initial arena bounded also makes exhaustion an ordinary state that you can reproduce in a small test."
      ],
      "example": {
        "title": "Allocate two small objects inside one page",
        "intro": "Imagine a heap page backed by physical frame 0x280000 and accessible at virtual page 0xD0000000. The allocator serves two 40-byte requests from it under a 16-byte alignment policy.",
        "steps": [
          {
            "title": "Account for object-level capacity",
            "explanation": "Each request rounds to 48 payload bytes. Headers consume additional storage according to the allocator format; those bytes are not part of either caller’s requested object."
          },
          {
            "title": "Free only the first object",
            "explanation": "The heap can mark that block reusable, but the page still contains the second live object. Unmapping or releasing the whole page would invalidate a valid pointer."
          },
          {
            "title": "Consider eventual page release",
            "explanation": "Only after the page contains no live objects, its metadata is handled, and the heap’s release policy permits it can the VMM remove the mapping and the PMM reclaim backing storage."
          }
        ],
        "conclusion": "Object reuse and frame reuse are related operations at different granularities."
      },
      "pitfalls": [
        {
          "title": "Treating the physical address as the returned object pointer",
          "text": "The caller uses a virtual address in the active address space. The physical frame number identifies backing storage and need not resemble that pointer."
        }
      ],
      "transfer": "Would four free objects totaling one page always allow a page to be returned? No. They may occupy parts of several pages, each still containing live objects. The locations matter as much as the total byte count."
    },
    "implementation": {
      "title": "Derive a split before changing the list",
      "paragraphs": [
        "A split creates a second block header inside storage formerly described as one payload. The new header consumes space, so subtract it from the remainder before publishing the second free payload. The list links and the size fields must agree on exactly the same address partition.",
        "The first-fit policy chooses among adequate blocks. Every selected block must still satisfy the object’s requirements. Alignment, capacity, disjoint live payloads, and consistent metadata are required regardless of placement policy. Use a small address drawing to verify those properties before optimizing the search."
      ],
      "example": {
        "title": "Split a 128-byte free payload",
        "intro": "Use the course’s 16-byte header and 16-byte alignment. Let the existing header be at 0x1000, its payload begin at 0x1010, and the caller request 33 bytes.",
        "steps": [
          {
            "title": "Round the requested capacity",
            "explanation": "33 rounds upward to 48. The allocated payload occupies [0x1010, 0x1040), leaving 80 bytes of the old payload after it."
          },
          {
            "title": "Place the new header",
            "explanation": "The remainder’s header occupies [0x1040, 0x1050). Its payload has 80 - 16 = 64 bytes and occupies [0x1050, 0x1090)."
          },
          {
            "title": "Update and later coalesce",
            "explanation": "After both blocks are free, combine 48 payload bytes, the absorbed 16-byte header, and 64 payload bytes to recover the original 128-byte payload."
          }
        ],
        "conclusion": "The address intervals explain where the metadata overhead goes and why coalescing recovers it."
      },
      "pitfalls": [
        {
          "title": "Splitting every nonzero remainder",
          "text": "A remainder must hold both a new header and the minimum useful payload. Otherwise keep it inside the allocated capacity instead of creating an unusable block."
        }
      ],
      "transfer": "What if a 64-byte payload serves a 49-byte request? Rounding requires all 64 bytes, so there is no remainder to split. The caller still requested 49 usable bytes; the extra capacity is internal fragmentation.",
      "flowchart": {
        "title": "Choose and split a heap block",
        "intro": "Search only free blocks, then decide whether a remainder is large enough to become another block.",
        "nodes": [
          {
            "id": "request",
            "label": "Request valid?",
            "detail": "Check zero and overflow rules, then align a valid requested size.",
            "kind": "decision"
          },
          {
            "id": "candidate",
            "label": "Adequate free block exists?",
            "detail": "First fit scans the list for sufficient payload capacity.",
            "kind": "decision"
          },
          {
            "id": "split",
            "label": "Useful remainder fits?",
            "detail": "The remainder must contain a header and minimum payload.",
            "kind": "decision"
          },
          {
            "id": "new",
            "label": "Create remainder block",
            "detail": "Place its header, size, and next pointer inside the old payload.",
            "kind": "process"
          },
          {
            "id": "whole",
            "label": "Keep the whole capacity",
            "detail": "Avoid creating an unusable fragment.",
            "kind": "process"
          },
          {
            "id": "return",
            "label": "Mark busy and return payload",
            "detail": "The caller receives the address after the chosen header.",
            "kind": "terminal"
          },
          {
            "id": "fail",
            "label": "Return allocation failure",
            "detail": "No list mutation should leak or corrupt capacity.",
            "kind": "terminal"
          }
        ],
        "edges": [
          {
            "to": "candidate",
            "label": "Valid request",
            "from": "request"
          },
          {
            "to": "fail",
            "label": "Invalid",
            "from": "request"
          },
          {
            "to": "split",
            "label": "Yes",
            "from": "candidate"
          },
          {
            "to": "fail",
            "label": "No",
            "from": "candidate"
          },
          {
            "to": "new",
            "label": "Yes",
            "from": "split"
          },
          {
            "to": "whole",
            "label": "No",
            "from": "split"
          },
          {
            "to": "return",
            "from": "new"
          },
          {
            "to": "return",
            "from": "whole"
          }
        ],
        "caption": "Both success branches preserve the same ownership rules even though their unused capacity differs."
      }
    },
    "fragmentation": {
      "title": "Total free bytes do not describe the largest request",
      "paragraphs": [
        "Internal fragmentation is capacity inside a live block that its caller did not request. External fragmentation is free capacity separated by live objects. A statistic called “free memory” can hide both the shape of the free regions and the overhead reserved for block headers. Report quantities with definitions that make them comparable.",
        "Coalescing cannot move a live allocation in this simple pointer-based heap. Existing callers hold addresses that must remain stable until free. Therefore a live middle block is a genuine barrier, regardless of how desirable a larger free block would be. Compaction requires a different model with relocatable references or additional indirection."
      ],
      "example": {
        "title": "A large free total with no large block",
        "intro": "Consider free payload A of 96 bytes, a live payload B of 32 bytes, and free payload C of 96 bytes, each with a 16-byte header and adjacent physical layout.",
        "steps": [
          {
            "title": "Try a 160-byte request",
            "explanation": "A and C contribute 192 free payload bytes in total, but neither individual block is adequate. The request cannot span B without overwriting live ownership."
          },
          {
            "title": "Release the separating object",
            "explanation": "Once B is legitimately freed, coalescing can absorb the two interior headers as well as all three payload regions."
          },
          {
            "title": "Calculate recovered capacity",
            "explanation": "The merged payload is 96 + 16 + 32 + 16 + 96 = 256 bytes. The first header remains metadata and is not counted in that payload."
          }
        ],
        "conclusion": "The largest free block changes from 96 to 256 bytes even though no new backing page was acquired."
      },
      "pitfalls": [
        {
          "title": "Counting header bytes inconsistently",
          "text": "If one statistic includes metadata and another reports only payload capacity, comparing them can look like a leak or a miraculous gain. State each statistic’s unit and boundary."
        }
      ],
      "transfer": "An aligned 17-byte request receives 32 bytes of payload capacity. How much alignment-related internal waste is there? Fifteen bytes, before considering any whole-block remainder or header overhead."
    },
    "defense": {
      "title": "Place a detector next to the boundary it protects",
      "paragraphs": [
        "A canary is a recognizable value placed where a correct caller should not write. It makes a boundary violation observable when checked, but it does not prevent the write. Poison patterns in freed payloads similarly reveal stale use only when later observations inspect them. These tools shorten the distance between cause and symptom without providing isolation.",
        "The allocator’s own diagnostics must avoid recursively needing the allocator. A log formatter that allocates when kmalloc fails can recurse or acquire the same lock again. Keep error capture bounded and use preallocated records or an independent minimal output path. Document which execution contexts may call the general heap at all."
      ],
      "example": {
        "title": "Catch a one-byte overrun near its source",
        "intro": "A temporary debug allocator records a requested length of 23 bytes, rounds capacity to 32, and places a canary immediately after the requested region under its debug layout.",
        "steps": [
          {
            "title": "Write only valid bytes",
            "explanation": "The caller may access offsets 0 through 22. The rounded capacity does not change the API’s requested object length."
          },
          {
            "title": "Introduce the off-by-one",
            "explanation": "A mistaken loop using index <= 23 writes offset 23, changing the first canary byte. The next block’s header might remain untouched, so ordinary allocation could still appear healthy."
          },
          {
            "title": "Check at a deliberate boundary",
            "explanation": "Validate the canary on free or an explicit debug check and report the allocation-site identifier. This localizes the error closer to its writer than waiting for a later list traversal to crash."
          }
        ],
        "conclusion": "The detector is useful because it distinguishes requested length from hidden allocator capacity."
      },
      "pitfalls": [
        {
          "title": "Relying on a canary to make arbitrary writes safe",
          "text": "Privileged code can overwrite the canary and the metadata around it. Detection requires intact enough state to perform and report the check."
        }
      ],
      "transfer": "Why avoid general allocation in an IRQ handler? It can interrupt a heap owner, violate lock assumptions, or create unbounded latency. A fixed preallocated ring often supplies the bounded storage that path actually needs."
    },
    "brk": {
      "title": "Track byte ownership and page coverage independently",
      "paragraphs": [
        "The program break is an exclusive byte endpoint for a logical region. The memory manager backs that region in pages. A page can contain some bytes below the break and some above it, so moving the endpoint inside an already backed page need not change any mapping.",
        "Growth should commit only after every required page is available. If mapping the second new page fails after the first succeeded, preserve the original logical endpoint and undo the new partial work according to the interface. A process must not receive an apparently successful endpoint that includes a missing page in the middle."
      ],
      "example": {
        "title": "Grow across two boundaries, then shrink",
        "intro": "Assume a data region begins at 0x400000, its old break is 0x402F00, and every page below the rounded-up break is backed. Request new break 0x404100.",
        "steps": [
          {
            "title": "Compute the old and new coverage",
            "explanation": "The old exclusive page boundary is 0x403000. The new one is 0x405000. Pages beginning at 0x403000 and 0x404000 need backing."
          },
          {
            "title": "Prepare before committing",
            "explanation": "Acquire and clear suitable frames, install the new mappings, and update the logical break only when the full request can be satisfied."
          },
          {
            "title": "Shrink to 0x403800",
            "explanation": "The page beginning at 0x403000 still contains bytes below the new break, so retain it. Page 0x404000 can become eligible for removal under the release policy."
          }
        ],
        "conclusion": "Rounding is applied to coverage; the logical break itself retains its exact byte value."
      },
      "pitfalls": [
        {
          "title": "Passing a kernel heap pointer to userspace",
          "text": "User heap growth changes a process’s virtual region. Internal kmalloc storage has a different address-space and ownership contract."
        }
      ],
      "transfer": "If growth remains within the old last page, is the request automatically valid? No. Still validate bounds, overflow, collisions, and the logical region policy even when no frame allocation is necessary."
    },
    "verification": {
      "title": "Test that untouched objects remain untouched",
      "paragraphs": [
        "The strongest small heap tests keep several allocations alive together. Fill each requested payload with a different marker, free selected objects, and verify every survivor. This exposes a coalescing error that wrongly absorbs a live neighbor, even if the allocator returns aligned pointers and eventually reports a large free block.",
        "Check restoration after varied histories. A completely freed fixed arena should recover its original one-block shape and capacity. The path to that result matters: forward frees, reverse frees, alternating frees, and allocations into holes stress different link updates. A correct final byte count alone can hide a corrupt intermediate state."
      ],
      "example": {
        "title": "Make a merge bug damage a visible survivor",
        "intro": "Allocate three blocks A, B, and C with requested sizes 17, 48, and 65, and fill them with distinct byte patterns.",
        "steps": [
          {
            "title": "Create separated free regions",
            "explanation": "Free A and C while keeping B live. Verify all 48 bytes of B. No coalescing operation may include B’s payload or header as free space."
          },
          {
            "title": "Allocate into an available hole",
            "explanation": "Make a small request that fits a documented free block. Fill it with a fourth pattern and verify B again; overlap now becomes immediately visible."
          },
          {
            "title": "Release all remaining objects",
            "explanation": "After legitimate frees, check that all internal free neighbors coalesce and recover the initial arena capacity, including the headers created by prior splits."
          }
        ],
        "conclusion": "Survivor contents are an independent witness of non-overlap and lifetime preservation."
      },
      "pitfalls": [
        {
          "title": "Inspecting metadata before validating an arbitrary pointer",
          "text": "A debug free should not blindly subtract a header size from an unrelated address and dereference it. The reference first searches for an exact known payload start."
        }
      ],
      "transfer": "Can this allocator reliably reject a stale pointer after the same address is reallocated? Its simple busy state cannot identify the old lifetime. Caller ownership discipline remains necessary even when double-free checks catch the immediate repeated-free case."
    }
  },
  "threads-and-scheduling": {
    "continuation": {
      "title": "A suspended thread is a stored future return",
      "paragraphs": [
        "At a cooperative call boundary, the compiler has already arranged to tolerate changes in caller-saved registers. That agreement reduces what the small context-switch routine must preserve. The stack holds return addresses and any values spilled by surrounding functions, so retaining the stack preserves the routine’s return path and its spilled values.",
        "A timer interrupt arrives without that cooperation. A register considered caller-saved by the ABI can contain an important intermediate value between two ordinary instructions. The interrupt entry must preserve that interrupted state before scheduling can treat the frame as a resumable continuation. Timer preemption requires that interrupt entry path in addition to the cooperative switch routine."
      ],
      "example": {
        "title": "Pause inside a nested function call",
        "intro": "Thread A runs worker(), which calls process_item(), which eventually calls yield(). Thread B has its own independent stack.",
        "steps": [
          {
            "title": "Identify A’s pending work",
            "explanation": "A’s stack contains the chain needed to return from yield to process_item and eventually to worker. Locals that have been placed on that stack belong to A’s continuation."
          },
          {
            "title": "Save the switch frame",
            "explanation": "The cooperative routine preserves its required callee-saved registers and records the resulting ESP. It does not copy the whole stack because the stack remains allocated and unchanged while A sleeps."
          },
          {
            "title": "Resume later",
            "explanation": "Restoring A’s saved frame lets RET continue A’s suspended call. After B runs, A resumes with its local variables still at their original stack locations."
          }
        ],
        "conclusion": "The mechanism depends on retaining each thread’s private stack across switches."
      },
      "pitfalls": [
        {
          "title": "Reusing a suspended thread’s stack",
          "text": "A saved ESP points into live state. Giving that memory to another thread or allocator destroys the continuation even though the thread is not currently executing."
        }
      ],
      "transfer": "If both kernel threads share one address space, do their local stack variables automatically share storage? No. Each thread has a distinct stack allocation. Shared addressability does not imply identical addresses or shared ownership."
    },
    "switch": {
      "title": "Follow the exact stack pointer used by RET",
      "paragraphs": [
        "The surprising part of a context switch is that one function invocation can return through a different stack. RET has no source-level memory of which thread called the routine. It uses the current stack pointer, so replacing ESP changes where its return target comes from.",
        "A new thread needs an artificial saved frame because it has never called the switch routine. Construct the frame in the same order that the restore sequence consumes it. The trampoline is a controlled initial return target, and it arranges a valid C call before eventually handling thread termination."
      ],
      "example": {
        "title": "Build and restore a synthetic frame",
        "intro": "Let a new thread’s aligned stack top be 0x9000. The restore sequence consumes saved EDI, ESI, EBX, EBP, then a trampoline address.",
        "steps": [
          {
            "title": "Reserve the five words",
            "explanation": "Five four-byte words occupy 20 bytes, so the initial saved ESP is 0x8FEC. Put EDI there, ESI at 0x8FF0, EBX at 0x8FF4, EBP at 0x8FF8, and the trampoline at 0x8FFC."
          },
          {
            "title": "Restore the registers",
            "explanation": "Four POP instructions advance ESP from 0x8FEC to 0x8FFC. They consume the saved values of the corresponding registers."
          },
          {
            "title": "Return into the bootstrap",
            "explanation": "RET consumes the trampoline pointer and leaves ESP=0x9000. The trampoline can now make its ABI-aligned C call, and its non-returning bootstrap ultimately routes completion to thread_exit."
          }
        ],
        "conclusion": "A stack drawing makes the synthetic initial state equivalent to a previously suspended thread at the restore boundary."
      },
      "pitfalls": [
        {
          "title": "Calculating argument offsets before the pushes",
          "text": "The switch routine’s four pushes move the incoming arguments sixteen bytes farther from the new ESP. Offsets must be computed for the point where they are actually read."
        }
      ],
      "transfer": "After four pushes, where is the original return address? At [ESP+16]. The first and second arguments are at [ESP+20] and [ESP+24], explaining the offsets used by the reference routine."
    },
    "states": {
      "title": "Make queue membership follow the lifecycle",
      "paragraphs": [
        "A thread state is a promise about what the scheduler may do with it. RUNNABLE means it is eligible to receive the CPU. BLOCKED means a condition must change before running would be useful. DEAD means its execution has ended, though its resources may still require deferred cleanup.",
        "Queue conventions should make illegal transitions visible. For example, keep the RUNNING thread outside the ready queue, append it only when it becomes RUNNABLE, and remove a selected thread exactly once. An accidental duplicate grants extra turns and can leave a queue entry pointing to a thread whose lifetime has already ended."
      ],
      "example": {
        "title": "Trace round robin with an early block",
        "intro": "Assume current thread A and ready queue [B,C]. The running thread is outside the queue. A has work remaining, B will block early, and C remains runnable.",
        "steps": [
          {
            "title": "A uses its turn",
            "explanation": "A becomes RUNNABLE and is appended, producing [B,C,A]. Select B, leaving [C,A]."
          },
          {
            "title": "B blocks for input",
            "explanation": "B becomes BLOCKED and is not appended. Select C immediately so useful work can proceed while B waits."
          },
          {
            "title": "B later wakes",
            "explanation": "A producer makes B RUNNABLE under the scheduler’s wakeup protocol and appends it once. The documented arrival policy determines its future place in the run queue."
          }
        ],
        "conclusion": "State transitions determine eligibility; the selection policy orders the eligible set."
      },
      "pitfalls": [
        {
          "title": "Treating idle as a normal ready competitor",
          "text": "Idle is the fallback when useful work is unavailable. Giving it ordinary turns while runnable work waits wastes CPU time and distorts fairness measurements."
        }
      ],
      "transfer": "Could strict priority make a low-priority runnable thread wait forever? Yes, if higher-priority work never stops being eligible. The fairness policy must explicitly state how this workload receives CPU time across priority levels.",
      "flowchart": {
        "title": "Choose a runnable continuation",
        "intro": "This simplified policy keeps the current thread outside the ready queue and uses idle only when the queue is empty.",
        "nodes": [
          {
            "id": "event",
            "label": "Scheduling boundary",
            "detail": "The running thread yields, blocks, exits, or reaches a permitted preemption point.",
            "kind": "process"
          },
          {
            "id": "runnable",
            "label": "Current thread still runnable?",
            "detail": "Blocked and dead threads must not rejoin the ready queue.",
            "kind": "decision"
          },
          {
            "id": "append",
            "label": "Append current once",
            "detail": "Maintain the queue-membership invariant.",
            "kind": "process"
          },
          {
            "id": "ready",
            "label": "Ready queue nonempty?",
            "detail": "Choose from eligible ordinary threads.",
            "kind": "decision"
          },
          {
            "id": "select",
            "label": "Remove next ready thread",
            "detail": "Mark the chosen thread RUNNING.",
            "kind": "process"
          },
          {
            "id": "idle",
            "label": "Select idle continuation",
            "detail": "No ordinary runnable work is available.",
            "kind": "process"
          },
          {
            "id": "switch",
            "label": "Switch to selected stack",
            "detail": "Resume the selected continuation.",
            "kind": "terminal"
          }
        ],
        "edges": [
          {
            "to": "runnable",
            "from": "event"
          },
          {
            "to": "append",
            "label": "Yes",
            "from": "runnable"
          },
          {
            "to": "ready",
            "label": "No",
            "from": "runnable"
          },
          {
            "to": "ready",
            "from": "append"
          },
          {
            "to": "select",
            "label": "Yes",
            "from": "ready"
          },
          {
            "to": "idle",
            "label": "No",
            "from": "ready"
          },
          {
            "to": "switch",
            "from": "select"
          },
          {
            "to": "switch",
            "from": "idle"
          }
        ],
        "caption": "A scheduling mechanism follows this policy only after its entry path has saved a valid resumable context."
      }
    },
    "preemption": {
      "title": "Defer rescheduling until the state can survive it",
      "paragraphs": [
        "A timer can request a scheduling decision without performing the switch at the first possible instruction. A need-reschedule flag records that useful work is pending. The kernel then reaches a point where the full interrupted context is saved and its lock and nesting rules permit replacement of the current thread.",
        "Preemption depth counts nested protected regions, including helpers called inside an existing protected region. Only the outermost exit returns the depth to zero. Local interrupt masking is a separate control: a non-preemptible region can still allow interrupts whose handlers only record work, depending on the kernel’s policy."
      ],
      "example": {
        "title": "A timer arrives inside nested protected work",
        "intro": "Thread A enters one non-preemptible region, then calls a helper that enters a second. A timer interrupt requests rescheduling.",
        "steps": [
          {
            "title": "Record the nesting",
            "explanation": "The depth moves from zero to one and then two. The timer records need_resched without treating depth two as a safe switching point."
          },
          {
            "title": "Leave the inner helper",
            "explanation": "Depth falls to one. Enabling preemption here would violate the outer region’s promise and could expose half-updated state."
          },
          {
            "title": "Leave the outer region",
            "explanation": "Depth reaches zero. At a permitted return or scheduling boundary, observe the pending request and switch using a complete saved context."
          }
        ],
        "conclusion": "Deferred work must eventually be checked, or a correct timer counter can coexist with a thread that never yields the CPU."
      },
      "pitfalls": [
        {
          "title": "Saving only cooperative callee-saved registers after arbitrary interruption",
          "text": "An interrupted computation may depend on EAX, ECX, EDX, flags, and other state. Preserve the full context required by the preemption entry path."
        }
      ],
      "transfer": "What should you measure if a newly runnable thread waits too long despite a short quantum? Inspect the duration of non-preemptible regions, interrupt masking, lock contention, and deferred-reschedule checks. The quantum alone does not bound every source of latency."
    },
    "wakeup": {
      "title": "Make condition testing and waiting one protocol",
      "paragraphs": [
        "A wakeup is meaningful only in relation to a condition. The consumer must verify that the queue is nonempty before removing an item. It must become visible as a waiter without leaving a gap after discovering that the condition is false. The producer must update the condition and consult waiters under the same synchronization agreement.",
        "After waking, check the condition again. Another consumer may have used the available item before this thread runs, or the wakeup mechanism may deliberately allow broader notifications. The waiting protocol loops around the predicate so the consumer checks the condition again after every wakeup."
      ],
      "example": {
        "title": "Expose the lost-wakeup interleaving",
        "intro": "Let a queue begin empty and the consumer not yet be registered as waiting.",
        "steps": [
          {
            "title": "Run the unsafe consumer step",
            "explanation": "The consumer observes empty, then loses the CPU before marking itself BLOCKED. No waiter is yet visible."
          },
          {
            "title": "Run the producer",
            "explanation": "The producer inserts an item and finds nobody to wake. Its work is complete under the incomplete protocol."
          },
          {
            "title": "Resume the consumer",
            "explanation": "It now blocks and may wait forever despite the queued item. Repair the protocol by coupling condition inspection, waiter registration, and the scheduler handoff so the producer cannot pass through this gap."
          }
        ],
        "conclusion": "The failure is caused by an interleaving between two individually plausible operations."
      },
      "pitfalls": [
        {
          "title": "Releasing a thread’s current stack inside thread_exit",
          "text": "The thread is still executing on that storage. Mark it dead and switch away before a reaper frees the stack after all remaining references are gone."
        }
      ],
      "transfer": "Why can checking the ready queue and then executing HLT be another lost-wakeup problem? An event can be handled after the check but before sleeping. The idle protocol must coordinate interrupt state and sleep entry so work cannot become stranded in that gap."
    },
    "measure": {
      "title": "Calculate response and waiting from the same timeline",
      "paragraphs": [
        "A scheduling trace should state its simplifying assumptions: arrival times, CPU demand, blocking events, quantum, queue policy, and whether switch overhead is ignored. Without them, two different timelines can both seem reasonable. Begin with a deterministic example before interpreting noisy emulator measurements.",
        "Response time measures first service, while waiting time measures all intervals spent eligible but off the CPU. A task can respond quickly and still wait a long time before finishing. Turnaround time, from arrival to completion, includes both execution and waiting in a workload without blocking. These different measures reveal different policy tradeoffs."
      ],
      "example": {
        "title": "Three jobs with a two-unit quantum",
        "intro": "A, B, and C all arrive at time zero in that order. Their CPU demands are 5, 3, and 1 time units. Ignore switch overhead and blocking.",
        "steps": [
          {
            "title": "Build the execution timeline",
            "explanation": "Run A from 0 to 2, B from 2 to 4, C from 4 to 5, A from 5 to 7, B from 7 to 8, and A from 8 to 9."
          },
          {
            "title": "Read first-response delays",
            "explanation": "A first runs at 0, B at 2, and C at 4. Their response times are therefore 0, 2, and 4, even though C has the smallest total demand."
          },
          {
            "title": "Calculate total waiting",
            "explanation": "Completion times are A=9, B=8, C=5. Subtract each demand to obtain waiting times A=4, B=5, C=4. These differ from the first-response delays."
          }
        ],
        "conclusion": "A concrete timeline lets you compare a changed quantum or arrival policy without confusing the metrics."
      },
      "pitfalls": [
        {
          "title": "Counting blocked time as ready-queue waiting",
          "text": "A thread waiting for input is not eligible for CPU service. Keep that delay separate if the purpose is to evaluate scheduling of runnable work."
        }
      ],
      "transfer": "What should happen if thread creation fails after allocating a control block but before obtaining its stack? Roll back the private partial resources and leave the ready queue unchanged. Publishing a half-constructed runnable entry creates a lifetime bug because the scheduler can select incomplete state."
    }
  }
};
