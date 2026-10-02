export const assemblyStackDepth = {
  "assembly-stack": {
    "ownership": {
      "title": "Track who may reuse each byte",
      "paragraphs": [
        "A saved stack value has an owner and a lifetime. The owner is the active routine that reserved the slot; the lifetime is the interval during which that routine relies on the stored value. A nested routine can reserve lower addresses without taking over the caller’s existing slots. That separation is what makes one temporary-storage rule useful at several nesting depths.",
        "Think of SP as a boundary between live stack entries and space that later pushes may claim. Moving the boundary upward releases an entry even if its bit pattern remains. Returning to the entry boundary also does not repair an overwritten return address: both the boundary and the words it exposes must still be correct. In the following paper trace, every operation uses a two-byte word and SS stays zero."
      ],
      "example": {
        "title": "Borrow AX for a temporary calculation",
        "intro": "The lesson receives AX = 0x03E8, representing 1000 decimal, and needs AX temporarily to calculate 12 + 7. The original 1000 must survive.",
        "steps": [
          {
            "title": "Create a private copy",
            "explanation": "push ax moves SP from 0x7BFE to 0x7BFC. The original word now exists in AX and in the newly owned stack slot. The setup return remains at 0x7BFE.",
            "state": "SP = 7BFC; [SS: 7BFC] = 03E8"
          },
          {
            "title": "Use the register",
            "explanation": "mov ax,12 followed by add ax,7 produces 19 in AX. The saved word remains 1000 because a register write does not update its earlier memory copy. Move the temporary result to DX if it is needed later.",
            "state": "AX = 0013; DX = 0013; saved word = 03E8"
          },
          {
            "title": "End the temporary lifetime",
            "explanation": "pop ax restores 1000 and moves SP back to 0x7BFE. AX now holds the old value, DX holds 19, and the next outer ret can consume the setup continuation.",
            "state": "AX = 03E8; DX = 0013; SP = 7BFE"
          }
        ],
        "conclusion": "Saving a register is useful only when you can identify which later operation restores that particular incoming value."
      },
      "pitfalls": [
        {
          "title": "Restoration can erase a result",
          "text": "If the answer was left only in AX, pop ax intentionally replaces it. Choose an output location before restoring an input."
        }
      ],
      "transfer": "Could a second routine save its own AX while your AX is saved? Yes. Its call return and saved value occupy lower addresses, and it must release them before your pop ax. Each routine restores its own entry boundary, so their temporary lifetimes nest safely."
    },
    "push-bytes": {
      "title": "Distinguish reservation from initialization",
      "paragraphs": [
        "A word occupies two consecutive byte addresses, but the stack pointer names only the first. For a push, calculate the new address before writing either byte. This avoids a common drawing error in which a learner stores at the old SP and only afterward moves the boundary, accidentally overwriting a live entry.",
        "Allocation means claiming space. Initialization means placing a meaningful value there. push ax performs both for its two-byte slot, whereas sub sp,2 claims two bytes without filling them. Until you write that reserved memory, its contents depend on earlier users of the same addresses. The arithmetic in this example assumes ordinary real-mode stack addressing and stays comfortably inside the available region."
      ],
      "example": {
        "title": "Three distinct words in increasing address order",
        "intro": "Begin at the actual lesson entry SP = 0x7BFE. Save 0x0A1B, 0x2C3D, and 0x4E5F as three successive word values.",
        "steps": [
          {
            "title": "Write the first word",
            "explanation": "The first push reserves 0x7BFC through 0x7BFD. Low byte 1B goes at 0x7BFC and high byte 0A at 0x7BFD. The return word starts two bytes higher.",
            "state": "7BFC: 1B  7BFD: 0A"
          },
          {
            "title": "Add a second independent slot",
            "explanation": "The next push changes SP to 0x7BFA and writes 3D then 2C. It leaves both bytes of the first word untouched. Existing entries stay put while the boundary moves.",
            "state": "7BFA: 3D  7BFB: 2C  7BFC: 1B  7BFD: 0A"
          },
          {
            "title": "Read the complete byte drawing",
            "explanation": "After the third push, SP = 0x7BF8. Increasing addresses contain 5F 4E 3D 2C 1B 0A, followed by the incoming return word. The next word pop therefore reads 0x4E5F.",
            "state": "SP = 7BF8; active temporary storage = 6 bytes"
          }
        ],
        "conclusion": "The reversed word order comes from downward allocation. The low-byte-first order inside each word comes from little-endian storage; these are different rules."
      },
      "pitfalls": [
        {
          "title": "Reversing every byte",
          "text": "LIFO reverses the order of whole pushed operands. It does not turn the word 0x0A1B into 0x1B0A when that word is popped."
        }
      ],
      "transfer": "If you reserve four bytes with sub sp,4, can you immediately read two known zero words? No. Reservation does not initialize RAM. Store each intended word explicitly, then include all four bytes in the eventual cleanup."
    },
    "pop-bytes": {
      "title": "Separate recovered values from expired addresses",
      "paragraphs": [
        "Use a ledger with one row for each live word and a separate column for register contents. A pop into a register reads the current row, replaces the destination register, and advances the boundary. It does not know which register originally produced the word. The relationship between saved values and later destinations is a decision made by your program.",
        "This distinction explains why a program can print the wrong answer and still return safely. The net stack change may be zero while the destinations are swapped. It also explains an apparently correct debugger experiment: released bytes can look unchanged until the next instruction that claims them. Valid ownership also requires that the stored object’s lifetime is still active."
      ],
      "example": {
        "title": "Reuse a released top slot",
        "intro": "Start with SP = 0x7BFE. Push the words 0x1123 and 0x4567, in that order. The newer word occupies 0x7BFA and the older word occupies 0x7BFC.",
        "steps": [
          {
            "title": "Remove the newer value",
            "explanation": "pop dx reads 0x4567 and advances SP to 0x7BFC. The bytes at 0x7BFA and 0x7BFB may still be 67 and 45, but they are outside the currently live stack area.",
            "state": "DX = 4567; SP = 7BFC"
          },
          {
            "title": "Reuse the same addresses",
            "explanation": "Load AX = 0x89AB and execute push ax. SP returns to 0x7BFA, and bytes AB 89 replace the released word. A stale pointer to 0x7BFA now observes a different object.",
            "state": "[SS: 7BFA] = 89AB; old 4567 no longer stored there"
          },
          {
            "title": "Finish the remaining releases",
            "explanation": "pop bx recovers 0x89AB, then pop ax recovers 0x1123. SP reaches 0x7BFE again. DX still holds 0x4567 because that earlier pop copied the value into a separate register.",
            "state": "AX = 1123; BX = 89AB; DX = 4567; SP = 7BFE"
          }
        ],
        "conclusion": "A copied value can outlive its original stack slot. A pointer to that slot does not acquire the same guarantee."
      },
      "pitfalls": [
        {
          "title": "Inspecting after a helper call",
          "text": "A printing helper may reuse released slots while it runs. Snapshot the value into a register before calling it if that value is what you intend to observe."
        }
      ],
      "transfer": "What happens if the final two pops both target AX? The stack still balances, but the second pop overwrites the first recovered value. AX ends as 0x1123; the 0x89AB result needs another destination if it must survive."
    },
    "width": {
      "title": "Explain a mixed-width trace without changing modes",
      "paragraphs": [
        "There are three independent sizes to keep apart: the instruction’s encoded length, the value’s operand width, and the width of the pointer used to locate the stack. A longer machine instruction does not necessarily reserve more stack bytes. In this BITS 16 lab, push eax uses an operand-size override to save four bytes while ordinary stack addressing still uses SP.",
        "A useful audit writes signed byte changes beside every instruction. push eax contributes minus four; pop ax contributes plus two. A balanced total is necessary before returning, but also verify the interpretation of each recovered piece. Two word pops can intentionally split a saved dword into halves, provided the program expects the lower half first and eventually releases both."
      ],
      "example": {
        "title": "Split one dword and retain both halves",
        "intro": "For this independent experiment, let EAX = 0x9ABCDEF0 and start at SP = 0x7BFE. Use a dword push followed by two word pops.",
        "steps": [
          {
            "title": "Reserve four bytes at once",
            "explanation": "push eax moves SP to 0x7BFA. Increasing byte addresses hold F0 DE BC 9A. The original EAX remains unchanged immediately after the push.",
            "state": "SP = 7BFA; bytes = F0 DE BC 9A"
          },
          {
            "title": "Consume the low word",
            "explanation": "pop bx reads 0xDEF0 from 0x7BFA and advances SP to 0x7BFC. This uses only half of the reserved storage; the next live word is 0x9ABC.",
            "state": "BX = DEF0; SP = 7BFC; remaining temporary bytes = 2"
          },
          {
            "title": "Consume the high word",
            "explanation": "pop dx reads 0x9ABC and restores SP to 0x7BFE. Now the routine can use BX and DX separately or reconstruct a wider value under a stated convention.",
            "state": "DX = 9ABC; stack change = -4+2+2 = 0"
          }
        ],
        "conclusion": "Do not place ret between the two pops: that would load IP with 0x9ABC while leaving the setup return word on the stack."
      },
      "pitfalls": [
        {
          "title": "Counting immediate bytes",
          "text": "An encoding can carry a short immediate that the processor sign-extends to the pushed operand width. Count the resulting word or dword when calculating stack space."
        }
      ],
      "transfer": "Would replacing the two word pops with pop ebx preserve the original dword? Yes: it consumes all four saved bytes and gives EBX = 0x9ABCDEF0. Replacing them with only pop bx loses neither RAM nor magic state, but leaves a live half-word in front of the return address."
    },
    "segments": {
      "title": "Put segment selection into the address calculation",
      "paragraphs": [
        "An offset alone cannot identify a real-mode memory byte. The segment contributes a base address, and the effective address contributes the offset within that segment. Most early examples have DS = SS = 0, so a mistaken segment can remain invisible until the program changes its memory layout. A deliberately unequal pair of segments makes the assumption visible on paper.",
        "BP is convenient because the classic BP-based forms select SS by default. Using BX to hold the same numeric offset does not transfer that default to BX. An explicit segment override can request SS for a BX-based memory access, but it does not change the value in BX. Keep the register choice, segment choice, and operand width as three separate decisions."
      ],
      "example": {
        "title": "The same offset selects two different words",
        "intro": "Work through these addresses on paper while keeping the lab scaffold unchanged. Assume DS = 0x2000, SS = 0x2400, and BP = BX = 0x0100. Suppose the two resulting physical locations contain different words.",
        "steps": [
          {
            "title": "Compute the stack address",
            "explanation": "The base selected by SS is 0x24000. Adding BP = 0x0100 gives physical 0x24100. A word load from [bp] reads the bytes at 0x24100 and 0x24101.",
            "state": "SS: BP = 2400: 0100 -> 24100"
          },
          {
            "title": "Compute the data address",
            "explanation": "The base selected by DS is 0x20000. Adding the identical BX offset gives 0x20100. A word load from [bx] reads a different pair of bytes, despite the equal register values.",
            "state": "DS: BX = 2000: 0100 -> 20100"
          },
          {
            "title": "Choose deliberately",
            "explanation": "mov ax,[ss:bx] uses the stack segment explicitly and therefore reads the same address as [bp] in this example. Saving BP before using it as an inspection anchor also changes SP and must be included in your frame drawing.",
            "state": "[ss: bx] and [bp] select 24100 here"
          }
        ],
        "conclusion": "Address calculations become reliable when each memory operand is expanded into its segment base plus offset before interpreting the bytes."
      },
      "pitfalls": [
        {
          "title": "Inventing a sixteen-bit operand",
          "text": "[sp] is not a classic 16-bit effective-address form. Use a legal BP-based form and account for preserving BP if required by your interface."
        }
      ],
      "transfer": "After push bp followed by mov bp,sp, where is the word that was previously on top? It is at [bp+2], because preserving the old BP inserted a two-byte slot below it. [bp] now names saved BP, regardless of whether DS equals SS."
    },
    "frame": {
      "title": "Use an anchor that survives temporary stack movement",
      "paragraphs": [
        "A frame is a layout convention maintained by the routine’s own instructions. Establishing BP gives all participants a stable reference for that layout. SP can then move below BP as the routine reserves locals or calls helpers. Those changes do not move the local bytes, so a name such as [bp-4] keeps referring to the same slot.",
        "The stability has a condition: code must keep BP unchanged while using these offsets. A helper that overwrites BP without restoring it would break the convention even if its own stack balance were correct. Our supplied printing helpers preserve general registers, so they preserve BP. When you write your own nested routine, state explicitly whether it preserves BP."
      ],
      "example": {
        "title": "Keep three local words across a print",
        "intro": "Begin at lesson entry SP = 0x7BFE with an arbitrary incoming BP. Reserve three local words for the independent values 14, 25, and their sum.",
        "steps": [
          {
            "title": "Build the layout",
            "explanation": "push bp followed by mov bp,sp establishes BP = 0x7BFC. sub sp,6 sets SP = 0x7BF6. The local words are at BP-2, BP-4, and BP-6.",
            "state": "saved BP: 7BFC; locals: 7BFA, 7BF8, 7BF6"
          },
          {
            "title": "Initialize and compute",
            "explanation": "Store 14 at [bp-2] and 25 at [bp-4]. Load the first into AX, add the second, then store AX at [bp-6]. AX and the third local now contain decimal 39, hexadecimal 0x0027.",
            "state": "[BP-6] = 0027; BP remains 7BFC"
          },
          {
            "title": "Observe and leave",
            "explanation": "Load the third local into AX and call print_hex16. After the helper returns, restore SP with mov sp,bp and recover the caller’s BP with pop bp. AX still contains the result and SP is 0x7BFE.",
            "state": "output = 0027; incoming BP restored; return word exposed"
          }
        ],
        "conclusion": "Locals keep intermediate values available independently of temporary register reuse, but every result needed after return must have a destination outside the released frame."
      },
      "pitfalls": [
        {
          "title": "Reading before storing",
          "text": "sub sp,6 reserves space only. The sum is meaningful because both input slots were explicitly initialized before either memory operand was read."
        }
      ],
      "transfer": "What if another word is pushed after the locals are created? SP moves to 0x7BF4 while the local offsets stay unchanged. Pop or otherwise release that temporary before the epilogue, and restore any promised register before discarding its saved slot."
    },
    "balance": {
      "title": "Make every branch obey the same return conditions",
      "paragraphs": [
        "Treat the point where branches rejoin as a small contract. Each incoming path must agree on the current stack depth and on what each remaining slot represents. If one branch leaves saved BX on top while another leaves a temporary status word, a shared pop bx is correct for only one of them, even though both paths have used two bytes.",
        "This is similar to checking that both branches of a calculation produce the same kind of result. Here the result of a path includes invisible machine state: SP, saved-register slots, and the location of the continuation. Shared cleanup reduces the number of places that need an independent restoration proof. It works only when all incoming paths actually have the layout that cleanup expects."
      ],
      "example": {
        "title": "Two outcomes with one saved register",
        "intro": "A hypothetical routine preserves BX, uses four bytes of temporary storage, and returns AX = 0 for success or AX = 1 for rejected input. Both outcomes must use the same epilogue.",
        "steps": [
          {
            "title": "Reserve before choosing a path",
            "explanation": "At entry SP = 0x7BFE. push bx sets SP = 0x7BFC; sub sp,4 sets SP = 0x7BF8. The saved BX word remains above the four-byte local area.",
            "state": "relative depth = -6; saved BX at 7BFC"
          },
          {
            "title": "Prepare either result",
            "explanation": "A validation branch chooses success or rejection. Each branch sets AX and then reaches .cleanup without changing SP. The result differs; the frame layout remains identical.",
            "state": "success: AX = 0; rejection: AX = 1; both SP = 7BF8"
          },
          {
            "title": "Undo the shared layout",
            "explanation": "At .cleanup, add sp,4 releases the local area and pop bx restores the incoming register. SP is 0x7BFE before ret. AX is unaffected by these two cleanup operations.",
            "state": "depth = -6+4+2 = 0; BX restored"
          }
        ],
        "conclusion": "If the rejected path jumps directly to ret, the CPU consumes a local word as its return offset. The visible failure occurs later than the missing cleanup."
      },
      "pitfalls": [
        {
          "title": "Jumping into cleanup too early",
          "text": "A branch taken before the reservation cannot use this same epilogue unless it first creates the expected layout. Otherwise cleanup releases storage that path never owned."
        }
      ],
      "transfer": "Does identical SP at a merge prove identical state? No. Two paths can each leave one word while storing different kinds of values there. Record the meaning and ownership of live slots alongside their byte counts, then verify every predecessor of the merge.",
      "flowchart": {
        "title": "One cleanup path for both outcomes",
        "intro": "Only the result changes at the branch. Each route carries the same six-byte frame to cleanup.",
        "nodes": [
          {
            "id": "save",
            "label": "Save BX and reserve locals",
            "detail": "push bx reserves two bytes; sub sp,4 reserves four more.",
            "kind": "process"
          },
          {
            "id": "check",
            "label": "Is the input valid?",
            "detail": "Both outcomes start with SP six bytes below entry.",
            "kind": "decision"
          },
          {
            "id": "good",
            "label": "Set success result",
            "detail": "Set AX to zero without moving the stack pointer.",
            "kind": "process"
          },
          {
            "id": "bad",
            "label": "Set rejection result",
            "detail": "Set AX to one without moving the stack pointer.",
            "kind": "process"
          },
          {
            "id": "release",
            "label": "Release locals and restore BX",
            "detail": "add sp,4 then pop bx undo the layout on either route.",
            "kind": "process"
          },
          {
            "id": "return",
            "label": "Return through the entry word",
            "detail": "SP is back at its entry value before ret consumes the continuation.",
            "kind": "terminal"
          }
        ],
        "edges": [
          {
            "to": "check",
            "from": "save"
          },
          {
            "to": "good",
            "label": "Yes",
            "from": "check"
          },
          {
            "to": "bad",
            "label": "No",
            "from": "check"
          },
          {
            "to": "release",
            "from": "good"
          },
          {
            "to": "release",
            "from": "bad"
          },
          {
            "to": "return",
            "from": "release"
          }
        ],
        "caption": "The paths may produce different AX values, but they must agree on the frame presented to the shared cleanup code."
      }
    },
    "observation": {
      "title": "Keep an observation from changing its own meaning",
      "paragraphs": [
        "A snapshot is a copied value measured at a particular instruction. If AX receives SP before call print_hex16, AX retains that earlier number even while the helper’s calls and saves move the real stack pointer. The displayed value records SP at the instant of the copy.",
        "Diagnostics have their own inputs too. To print a space, mov al,32 changes the low byte of AX before putc begins. putc preserves the AX it receives, including that new low byte. Therefore register preservation by a helper does not undo setup instructions in its caller. When several values must remain available, keep them in other registers or owned storage and reload AX for each observation."
      ],
      "example": {
        "title": "Measure a saved word without losing the snapshots",
        "intro": "At lesson entry, collect SP before and after reserving one word. Use BX and DX for snapshots so preparing a separator in AL cannot corrupt them.",
        "steps": [
          {
            "title": "Remember the first boundary",
            "explanation": "mov bx,sp records 0x7BFE. Set AX to a chosen temporary value, such as 0x3142, and execute push ax. The top now moves down two bytes.",
            "state": "BX = 7BFE; SP = 7BFC; saved word = 3142"
          },
          {
            "title": "Remember the second boundary",
            "explanation": "mov dx,sp records 0x7BFC. To display, move BX into AX and call print_hex16, prepare a space in AL and call putc, then move DX into AX and call print_hex16.",
            "state": "output = 7BFE 7BFC; snapshots survive in BX and DX"
          },
          {
            "title": "Restore the measured object",
            "explanation": "pop ax recovers 0x3142 and returns SP to 0x7BFE. The printing calls temporarily used more stack but left no extra active words when they returned.",
            "state": "AX = 3142; SP = 7BFE"
          }
        ],
        "conclusion": "The difference between the two measurements is two bytes. It reports the two bytes reserved by the word push. Measuring peak depth requires observations inside the helper as well."
      },
      "pitfalls": [
        {
          "title": "Inferring peak use from two samples",
          "text": "Before-and-after snapshots can be identical even when a helper used many temporary bytes between them. Capacity needs a separate maximum-depth analysis."
        }
      ],
      "transfer": "Can you insert print_hex16 between cmp and a conditional jump in this lab? The supplied helper preserves FLAGS, so the call itself preserves that comparison. Still inspect all added argument-setup instructions: a new arithmetic instruction can replace the flags before the helper ever runs."
    },
    "limits": {
      "title": "Budget for the deepest simultaneous stack use",
      "paragraphs": [
        "A stack budget concerns the most memory occupied at one instant. Sequential calls reuse the same region after returning, whereas nested calls keep their callers’ frames alive. Counting the total number of calls over a program’s lifetime therefore says little about the required capacity. Draw the longest chain that can coexist, including each routine’s local storage and saves.",
        "Ordinary control flow is only one source of growth. The BIOS operation used by a printing helper creates an interrupt frame while the helper’s own saved values remain present. An external interrupt may add further work at a moment chosen by hardware. For a small deterministic exercise you can bound the ordinary path; a production budget must also account for whatever asynchronous nesting the system permits."
      ],
      "example": {
        "title": "Separate a recurrence estimate from available capacity",
        "intro": "Use a paper budget of 96 bytes for one bounded call chain. Each active recursive level in this example uses a two-byte near return, a two-byte saved BP, and six local bytes.",
        "steps": [
          {
            "title": "Calculate one complete level",
            "explanation": "The cost per level is 2 + 2 + 6 = 10 bytes. Include the return word even though call created it before the callee’s first instruction. Otherwise every nesting level would be undercounted.",
            "state": "per-level cost = 10 bytes"
          },
          {
            "title": "Reserve fixed headroom",
            "explanation": "Suppose this paper design sets aside 26 bytes for caller overhead and other bounded work. That leaves 70 bytes for recursive levels, so the calculated limit is seven simultaneously active levels.",
            "state": "96-26 = 70; floor(70/10) = 7"
          },
          {
            "title": "Test the boundary in the model",
            "explanation": "An eighth level would require 80 bytes for the chain, or 106 including the fixed allowance. Every eventual pop could be correct and the peak would still exceed the proposed capacity by ten bytes.",
            "state": "7 levels = 96 total; 8 levels = 106 total"
          }
        ],
        "conclusion": "These numbers illustrate budgeting only. The paper exercise assumes the 26-byte allowance. Measure the course helpers separately and keep the supplied stack setup unchanged."
      },
      "pitfalls": [
        {
          "title": "Ignoring helpers in a measurement",
          "text": "A routine’s own frame size excludes its descendants. A useful maximum must include the deepest permitted descendant path and any allowed interrupt handling."
        }
      ],
      "transfer": "Would replacing recursion with a loop always eliminate extra memory use? It removes repeated return frames, but an explicit work list may still grow. State what information must remain pending, choose where it lives, and bound that storage as carefully as a call stack."
    },
    "practice": {
      "title": "Prove value order, output order, and restoration separately",
      "paragraphs": [
        "For the final exercise, make three predictions before editing: which value each pop retrieves, which register receives it, and which value each print reads from AX. Those are three related but different questions. Separating them makes a wrong display diagnosable: you can tell whether the error lies in saving, recovery, or presentation.",
        "Also predict the stack pointer immediately before the outer return. Printing fewer values must not leave more saved words behind. One simple organization restores all values first, then branches only around optional display work. Because the conditional display no longer owns unreleased slots, every path can finish with the same stack state. Use the playground for independent constants while keeping checkpoint computations tied to their supplied inputs."
      ],
      "example": {
        "title": "Recover three inputs before choosing what to display",
        "intro": "In an independent playground trace, save the words 0x1358, 0x2469, and 0x357A in that order. Print the first and third always, and the middle one only when a separate condition requests it.",
        "steps": [
          {
            "title": "Predict the storage order",
            "explanation": "Three word pushes consume six bytes. From SP = 0x7BFE the new top is 0x7BF8, where 0x357A lives. The other saved words are at 0x7BFA and 0x7BFC.",
            "state": "top-to-bottom values = 357A, 2469, 1358"
          },
          {
            "title": "Recover before branching",
            "explanation": "pop dx gets 0x357A, pop cx gets 0x2469, and pop bx gets 0x1358. SP is now back at 0x7BFE. All print paths start from this already balanced state.",
            "state": "BX = 1358; CX = 2469; DX = 357A; SP = 7BFE"
          },
          {
            "title": "Choose presentation explicitly",
            "explanation": "Move BX to AX for the first print, optionally move CX to AX for the middle print, then move DX to AX for the last print. Reload AX after preparing any separator with AL.",
            "state": "full output = 1358 2469 357A; short output = 1358 357A"
          }
        ],
        "conclusion": "Both output choices use the same recovered values and leave the same return word exposed. Optional presentation does not change the storage proof."
      },
      "pitfalls": [
        {
          "title": "Restoring only displayed values",
          "text": "Skipping a print never excuses skipping the pop that releases its saved input. The saved word remains real stack state even when no text is produced."
        }
      ],
      "transfer": "How could you test ordering without relying on a familiar pattern? Use three unequal, non-palindromic words and predict every destination on paper. Then change all three inputs. Correct data movement should preserve the relationship for both sets, while a hardcoded display will fail that second experiment."
    }
  },
  "assembly-calls": {
    "continuation": {
      "title": "Match each unfinished call to one return word",
      "paragraphs": [
        "Calling a routine creates an unfinished obligation: resume the caller after the call instruction. Nested calls create nested obligations, so their continuations fit the stack’s last-in, first-out ordering. The inner routine finishes first, exposes its caller’s continuation, and lets that caller continue toward its own eventual return.",
        "Give return addresses symbolic names in your drawing before assigning numbers. The word belonging to the setup call can be “resume setup,” while the word belonging to a helper call can be “resume lesson.” Both are ordinary instruction offsets, but those names make ownership visible. A call does not reserve an entire frame of locals or save every register; any additional layout must come from explicit instructions."
      ],
      "example": {
        "title": "Follow three active continuations",
        "intro": "Imagine lesson calls .first, which immediately calls .second. This trace uses default word-sized near calls, no additional pushes, and the scaffold’s starting SP.",
        "steps": [
          {
            "title": "Enter the first routine",
            "explanation": "The setup call already left “resume setup” at 0x7BFE. call .first adds “resume lesson” at 0x7BFC and transfers execution into .first.",
            "state": "SP = 7BFC; two unfinished calls"
          },
          {
            "title": "Enter and leave the second",
            "explanation": "call .second adds “resume .first” at 0x7BFA. Its ret reads that newest offset and restores SP to 0x7BFC, so execution resumes after the inner call inside .first.",
            "state": "deepest SP = 7BFA; after inner ret = 7BFC"
          },
          {
            "title": "Finish outward in reverse order",
            "explanation": ".first returns through the word at 0x7BFC, bringing SP to 0x7BFE. Later lesson returns through the setup continuation and restores the setup boundary at 0x7C00.",
            "state": "return order = .second, .first, lesson"
          }
        ],
        "conclusion": "One return consumes one continuation in this model. The instruction pointer takes the offset stored at the current stack top."
      },
      "pitfalls": [
        {
          "title": "Jumping to an ordinary callee",
          "text": "jmp .first does not create “resume lesson.” A later ret inside .first consumes the older word already at the top. A deliberate tail jump needs a compatible existing frame and a different continuation intention."
        }
      ],
      "transfer": "If .second pushes AX and forgets to pop it, which return fails first? Its own ret reads the saved AX as an offset. The older continuation words may remain intact, but the youngest obligation is no longer at the top, so unwinding fails immediately."
    },
    "direct-call": {
      "title": "Make code layout agree with the routine interface",
      "paragraphs": [
        "A callable routine has two interfaces at once. Its data interface defines inputs, outputs, and preserved state. Its control-flow interface defines how execution enters and exits. Correct arithmetic satisfies only the first. When a routine body is placed inside a larger lesson’s instruction stream, the caller must also avoid entering that body by ordinary fall-through after the intended call has already returned.",
        "For a word addition routine using AX and BX, the calculation itself can be add ax,bx followed by ret. BX is preserved because the add instruction does not write its source operand. AX changes intentionally to hold the result; arithmetic flags describe that result. Any wider preservation promise would require examining every instruction that can execute before return."
      ],
      "example": {
        "title": "Call once and then pass around the body",
        "intro": "In an independent playground example, AX begins as 0x001D and BX as 0x000B. The local routine .sum appears later in the same lesson, followed by .finished.",
        "steps": [
          {
            "title": "Compute through the interface",
            "explanation": "call .sum saves the continuation after that call. The add inside .sum computes 29 + 11 = 40 decimal, or 0x0028. Its ret returns to the saved continuation with BX still 0x000B.",
            "state": "AX = 0028; BX = 000B"
          },
          {
            "title": "Observe the result",
            "explanation": "call print_hex16 displays 0028. The supplied helper preserves both general registers and FLAGS, so the caller can still inspect the agreed arithmetic state after it returns.",
            "state": "printed value comes from returned AX"
          },
          {
            "title": "Keep the routine out of fall-through",
            "explanation": "The caller executes jmp .finished after its observation. This passes around .sum’s body, so that body runs only through the intended call. The eventual lesson return uses the setup continuation.",
            "state": "executions of .sum = 1"
          }
        ],
        "conclusion": "Without the jump around the body, execution can add BX a second time and reach ret without a fresh call continuation for that second entry."
      },
      "pitfalls": [
        {
          "title": "Renaming labels by capitalization",
          "text": "NASM symbol spelling is significant. Keep .sum, .finished, lesson, and print_hex16 exactly consistent; mnemonic capitalization does not make labels case-insensitive."
        }
      ],
      "transfer": "Would the interface work for AX = 0xFFFE and BX = 5? The low word is 0x0003 with unsigned carry set. BX remains 5. Decide whether the caller requires just the low word or also overflow status, and preserve that status through any later cleanup.",
      "flowchart": {
        "title": "Call the routine, then bypass its body",
        "intro": "A routine stored below its caller is also ordinary bytes in the instruction stream. The explicit jump prevents a second accidental entry.",
        "nodes": [
          {
            "id": "call",
            "label": "Call .sum with input registers",
            "detail": "The near call saves a continuation in the lesson.",
            "kind": "process"
          },
          {
            "id": "compute",
            "label": "Compute AX plus BX",
            "detail": "The callee returns AX while preserving BX.",
            "kind": "process"
          },
          {
            "id": "resume",
            "label": "Resume after the call",
            "detail": "The saved offset brings execution back to the caller.",
            "kind": "process"
          },
          {
            "id": "route",
            "label": "Does the caller jump around?",
            "detail": "Compare the intended jmp .finished with a broken fall-through variant.",
            "kind": "decision"
          },
          {
            "id": "safe",
            "label": "Reach .finished",
            "detail": "The lesson can now return using its original setup continuation.",
            "kind": "terminal"
          },
          {
            "id": "again",
            "label": "Enter .sum a second time",
            "detail": "Fall-through repeats arithmetic without creating a new continuation.",
            "kind": "process"
          },
          {
            "id": "wrong",
            "label": "Return through the older word",
            "detail": "The second ret consumes the lesson’s setup return unexpectedly.",
            "kind": "terminal"
          }
        ],
        "edges": [
          {
            "to": "compute",
            "from": "call"
          },
          {
            "to": "resume",
            "from": "compute"
          },
          {
            "to": "route",
            "from": "resume"
          },
          {
            "to": "safe",
            "label": "Yes",
            "from": "route"
          },
          {
            "to": "again",
            "label": "No",
            "from": "route"
          },
          {
            "to": "wrong",
            "from": "again"
          }
        ],
        "caption": "The branch is a review question about two code layouts. Only the route through jmp .finished is the intended implementation."
      }
    },
    "call-encoding": {
      "title": "Read a backward call in both code and stack memory",
      "paragraphs": [
        "The displacement in a direct relative call belongs to the instruction encoding. The return offset belongs to runtime stack state. They can have very different bit patterns because they answer different questions. One expresses how far to travel from the next instruction; the other is the exact location that execution should resume after the callee finishes.",
        "Backward destinations are a useful test of this distinction. Their relative displacement is negative, represented in the instruction’s fixed-width two’s-complement field. Adding that field to the next offset reaches an earlier instruction. The saved return offset is still the next instruction, regardless of whether the destination is ahead or behind. In this worked trace, all addresses are offsets in the same code segment."
      ],
      "example": {
        "title": "Decode a three-byte call to an earlier label",
        "intro": "Suppose a default 16-bit direct near call starts at offset 0x1200 and its target .worker is at 0x11F0. The instruction is three bytes long.",
        "steps": [
          {
            "title": "Locate the continuation",
            "explanation": "The instruction following the call begins at 0x1203. This is the word the CPU saves for a later near ret. With entry SP = 0x7BFE, the saved continuation occupies 0x7BFC.",
            "state": "return offset = 1203; saved bytes = 03 12"
          },
          {
            "title": "Calculate the destination field",
            "explanation": "Subtract 0x1203 from 0x11F0. The result is minus 0x13, or minus 19 decimal. As a 16-bit two’s-complement displacement this is 0xFFED, stored low byte first.",
            "state": "relative field = FFED; bytes = ED FF"
          },
          {
            "title": "Verify both directions",
            "explanation": "The call reaches 0x11F0 because 0x1203 + (-19) = 0x11F0. After the routine restores its temporary state, ret reads 0x1203 from the stack and resumes after the original call.",
            "state": "call target = 11F0; return target = 1203"
          }
        ],
        "conclusion": "The complete direct-call encoding begins with E8 and follows with ED FF here. Labels let the assembler redo this calculation whenever instruction sizes or positions change."
      },
      "pitfalls": [
        {
          "title": "Assuming every call is three bytes",
          "text": "The size used here belongs to this default direct near form. Indirect calls and calls with different operand sizes have different encodings and require their own next-instruction calculation."
        }
      ],
      "transfer": "If a preceding instruction grows by two bytes while .worker stays fixed, what changes? The call and its continuation move forward two bytes, so the required backward displacement becomes two bytes more negative. Reassemble symbolic labels so NASM recalculates the encoded offsets."
    },
    "register-contract": {
      "title": "Preserve a value because it is still live",
      "paragraphs": [
        "A value is live across a call when the caller will use that same value after the callee returns. The register holding it may be caller-saved or callee-saved according to the chosen interface. Those terms assign responsibility; they do not mean the processor automatically saves anything. Saving instructions must exist somewhere if a live value would otherwise be overwritten.",
        "This lets routines use a limited register set without knowing each other’s internals. The caller trusts promised registers and protects only the needed values in unpromised ones. The callee may use a promised register temporarily if it restores the incoming value on every exit. The result register is different: replacing it is the purpose of the call, so restoring its old value would hide the answer."
      ],
      "example": {
        "title": "Keep a loop count while allowing scratch work",
        "intro": "For this hypothetical interface, .compute accepts AX, returns AX, may overwrite CX and DX, and must preserve BX. Its caller has a still-needed count 5 in CX and a sentinel 0xA27C in BX.",
        "steps": [
          {
            "title": "Protect the caller-owned live value",
            "explanation": "The caller executes push cx before call .compute. CX was not promised by the callee, so this saved copy belongs to the caller’s recovery plan. The call then adds its separate return word.",
            "state": "saved caller count = 0005"
          },
          {
            "title": "Use and restore the promised register",
            "explanation": "If .compute needs BX as scratch, it saves the incoming 0xA27C before changing BX. Its cleanup restores that saved word while leaving the computed answer in AX.",
            "state": "BX after return = A27C; AX contains result"
          },
          {
            "title": "Recover what the caller protected",
            "explanation": "After the callee returns, pop cx restores the count 5. The caller can continue its loop regardless of the scratch value .compute left in CX. No restoration of AX is performed because its new value is wanted.",
            "state": "CX = 0005; BX = A27C; temporary stack debt = 0"
          }
        ],
        "conclusion": "The caller and callee protected different values for different reasons, yet their stack operations compose because the callee restores its entry boundary."
      },
      "pitfalls": [
        {
          "title": "Testing one sentinel only",
          "text": "Preservation requires restoring the actual incoming BX value. Repeat with another incoming BX and exercise every exit to verify that restoration follows the incoming value."
        }
      ],
      "transfer": "What if the caller does not need CX after the call? It need not save CX merely because the callee may clobber it. The convention permits the change, and avoiding an unnecessary save reduces both instructions and peak stack use without weakening the interface."
    },
    "arguments": {
      "title": "Derive argument offsets from a concrete caller boundary",
      "paragraphs": [
        "Argument positions come from an agreed sequence of storage operations. For this word-sized teaching convention, the caller puts the second argument on the stack before the first, and the near call then inserts a return word below both. When the callee saves BP, it inserts one more word. Only after these insertions does BP become the reference used to name arguments.",
        "A frame diagram should include addresses as well as offsets. Absolute addresses reveal which earlier write produced a later read, while relative offsets explain why the same routine can work at another stack location. Saving another register after establishing BP changes SP but does not change the already established relationship between BP and the argument slots."
      ],
      "example": {
        "title": "Read two unequal arguments from a nested frame",
        "intro": "Start at the lesson boundary SP = 0x7BFE. In a separate worked example, pass a = 12 and b = 19 by pushing b first and then a.",
        "steps": [
          {
            "title": "Construct the caller portion",
            "explanation": "push word 19 stores b at 0x7BFC. push word 12 stores a at 0x7BFA. call .sum places the continuation at 0x7BF8, so that word is topmost when the callee starts.",
            "state": "7BFC: b = 0013; 7BFA: a = 000C; 7BF8: return"
          },
          {
            "title": "Establish the callee anchor",
            "explanation": "push bp stores the old BP at 0x7BF6; mov bp,sp fixes BP there. Thus BP+2 is 0x7BF8, BP+4 is 0x7BFA, and BP+6 is 0x7BFC.",
            "state": "BP = 7BF6; a = [BP+4]; b = [BP+6]"
          },
          {
            "title": "Read values according to the map",
            "explanation": "Loading the two argument slots produces 12 and 19, whose sum is 31, or 0x001F. Reading the first slot twice produces 24, even though stack restoration may remain perfect.",
            "state": "correct sum = 001F; duplicated-first sum = 0018"
          }
        ],
        "conclusion": "The wrong arithmetic result can expose an addressing error without any crash. Unequal arguments make this particular mistake observable."
      },
      "pitfalls": [
        {
          "title": "Treating an offset as a universal rule",
          "text": "BP+4 is the first argument only for the frame just constructed. Different operand widths, a far call, or a different prologue require a newly derived layout."
        }
      ],
      "transfer": "If push bx follows mov bp,sp, does b move to BP+8? No. BP remains fixed at 0x7BF6, and the argument stays at 0x7BFC. The new saved BX is below BP at BP-2; only SP changes."
    },
    "cleanup": {
      "title": "Release the right bytes without losing a status result",
      "paragraphs": [
        "Argument cleanup is a separate responsibility from returning. The callee’s plain ret releases its near-call continuation, but the caller’s argument words remain live until their agreed owner releases them. This separation lets a caller use the returned AX while also bringing its stack boundary back to the value it had before argument preparation.",
        "There is another result channel to consider: FLAGS. A carry returned by an addition routine is meaningful only until another instruction changes it. add sp,4 leaves AX alone but calculates its own arithmetic flags. When carry is part of the interface, capture it immediately into an agreed register or memory slot. On the 386-or-newer machine in this course, setc dl copies CF into DL without changing the arithmetic result in AX."
      ],
      "example": {
        "title": "Keep overflow through caller cleanup",
        "intro": "Use two word arguments a = 0xFFFF and b = 2. Assume .sum returns their low-word sum in AX, leaves carry from the addition, and has restored its own saved registers using flag-preserving pops.",
        "steps": [
          {
            "title": "Return with arguments still present",
            "explanation": "Starting from SP = 0x7BFE, two argument pushes leave SP = 0x7BFA. After the call and the callee’s matching return, SP is again 0x7BFA. AX = 1 and CF = 1 report the overflowing sum.",
            "state": "AX = 0001; CF = 1; SP = 7BFA"
          },
          {
            "title": "Turn the transient flag into data",
            "explanation": "Execute setc dl before any arithmetic cleanup. DL becomes 1. If DX previously held a live value, the interface or caller must provide a different safe status location. setc defines DL; the existing DH value remains unchanged.",
            "state": "DL = 01; returned AX remains 0001"
          },
          {
            "title": "Release the caller-owned arguments",
            "explanation": "add sp,4 restores SP to 0x7BFE. Its flags now describe the pointer addition, but DL still records the earlier carry. Later code may test DL to choose an overflow message.",
            "state": "SP = 7BFE; status remains in DL"
          }
        ],
        "conclusion": "The cleanup owner releases exactly four argument bytes once. Separately, the status owner keeps the sum’s overflow information alive as ordinary data."
      },
      "pitfalls": [
        {
          "title": "Mixing two conventions",
          "text": "Using ret 4 in the callee and add sp,4 in the caller releases the arguments twice. Choose caller cleanup or callee cleanup consistently; a correct numerical result does not excuse an incorrect boundary."
        }
      ],
      "transfer": "Why not test CF after add sp,4? At SP = 0x7BFA, adding four does not carry out of sixteen bits, so it clears CF in this trace. That zero describes stack-pointer arithmetic and would falsely report no overflow for the sum."
    },
    "frames-locals": {
      "title": "Give every negative offset a named purpose",
      "paragraphs": [
        "The phrase “below BP” identifies a region that may already contain saved state. Saved registers and local variables can both occupy negative offsets. Assign the slots in the same order as the actual prologue, then write each memory access against that map. A local store aimed at a saved-register slot can produce the right immediate answer while corrupting the caller’s later computation.",
        "Cleanup must reverse ownership as well as allocation. Discarding a slot by moving SP does not restore the register saved there. If a routine promised to preserve BX, its old value must reach BX before the saved slot is released. The convenient mov sp,bp epilogue is appropriate only when doing so does not skip a still-needed register restoration."
      ],
      "example": {
        "title": "Keep an intermediate sum separate from saved BX",
        "intro": "At callee entry in this paper trace, SP = 0x7BF8. The caller expects BX = 0xC37D to survive. The routine wants one local word to hold an intermediate result 37.",
        "steps": [
          {
            "title": "Name each prologue slot",
            "explanation": "push bp and mov bp,sp establish BP = 0x7BF6. push bx places saved BX at 0x7BF4, or BP-2. sub sp,2 reserves the local at 0x7BF2, or BP-4.",
            "state": "[BP] = old BP; [BP-2] = C37D; local = [BP-4]"
          },
          {
            "title": "Write only the local slot",
            "explanation": "Store decimal 37 as word 0x0025 at [bp-4]. BX may now be used as scratch because its incoming value remains at [bp-2]. Before cleanup, load the local into AX as the returned result.",
            "state": "AX = 0025; saved BX still C37D"
          },
          {
            "title": "Restore in layout order",
            "explanation": "add sp,2 releases the local; pop bx recovers 0xC37D; pop bp restores the caller’s anchor. SP is back at 0x7BF8, where ret consumes the continuation.",
            "state": "BX = C37D; AX = 0025; entry frame restored"
          }
        ],
        "conclusion": "If the local store mistakenly targets [bp-2], pop bx recovers 0x0025. The returned sum can be correct while the preservation contract fails."
      },
      "pitfalls": [
        {
          "title": "Returning the local address",
          "text": "A pointer to 0x7BF2 remains a number after return, but the caller cannot rely on that expired local. Subsequent calls may claim and overwrite the same bytes."
        }
      ],
      "transfer": "Can a nested routine write into the local while this frame is active? Yes, if explicitly given a suitable address under a segment-aware interface and permission to modify it. The outer frame remains live during the nested call; the permission ends when its owner releases that storage."
    },
    "cdecl": {
      "title": "Rebuild the boundary for a real thirty-two-bit caller",
      "paragraphs": [
        "The ELF32 example belongs to a different execution environment from the boot-sector lesson. Its caller, object format, instruction decoding, and calling convention must agree. Merely replacing BITS 16 with BITS 32 changes assembly defaults, so it cannot supply protected-mode entry, a compatible C runtime, or a correctly prepared stack.",
        "An application binary interface specifies how independently compiled units meet. For the ordinary two-unsigned-int i386 System V example, each argument is four bytes and the result occupies EAX. A frame using EBP inserts four-byte saved state, so its offsets must be derived again. Alignment is another boundary condition: before this ordinary call, the caller arranges ESP on a sixteen-byte boundary, and call itself then subtracts four."
      ],
      "example": {
        "title": "Draw an aligned caller with two integer arguments",
        "intro": "Use a separate protected-mode ELF32 environment for this paper trace. Suppose ESP = 0x9000 before preparing sum32(21,34), and the caller chooses stack pushes for argument placement.",
        "steps": [
          {
            "title": "Reserve padding and place arguments",
            "explanation": "The two arguments require eight bytes. Reserve eight padding bytes first, then push b = 34 and a = 21 as dwords. ESP becomes 0x8FF0, divisible by sixteen immediately before call sum32.",
            "state": "padding = 8; arguments = 8; ESP before call = 8FF0"
          },
          {
            "title": "Derive the callee frame",
            "explanation": "call saves its four-byte return address at 0x8FEC. push ebp then mov ebp,esp sets EBP = 0x8FE8. The first argument is at EBP+8 = 0x8FF0 and the second at EBP+12 = 0x8FF4.",
            "state": "a = [EBP+8] = 21; b = [EBP+12] = 34"
          },
          {
            "title": "Return and release preparation",
            "explanation": "The callee returns decimal 55 in EAX after restoring EBP and all promised registers it used. Its ret returns ESP to 0x8FF0. The caller releases sixteen total preparation bytes, including padding, to regain 0x9000.",
            "state": "EAX = 00000037; caller ESP = 9000"
          }
        ],
        "conclusion": "The alignment requirement is checked before the call; the pushed continuation explains why the callee does not initially see the same aligned ESP."
      },
      "pitfalls": [
        {
          "title": "Copying the teaching-helper promise",
          "text": "Ordinary i386 System V calls may change EAX, ECX, and EDX. Preserve EBX, ESI, EDI, and EBP as required, and keep DF clear at the interface. The lab helper contract is stronger and separate."
        }
      ],
      "transfer": "Would add esp,8 fully clean this caller’s preparation? It would remove only the two arguments, leaving eight bytes of padding reserved. Track both padding and argument ownership, and consult the exact target ABI again when parameter types or calling conventions change."
    },
    "interrupts": {
      "title": "Identify frames by the mechanism that created them",
      "paragraphs": [
        "An interrupt handler resumes interrupted machine execution, so its continuation must include the required execution state. In the word-sized real-mode case used here, the saved state includes the code segment and flags as well as IP. The stack still follows ordinary downward storage rules, but the return mechanism must consume the complete shape created by interrupt entry.",
        "An explicit INT instruction can occur inside a routine that was entered with call. Both frames then exist simultaneously, separated by any registers the routine saved. The BIOS interrupt return must restore the helper’s execution state first. Only after the helper undoes its own saves can its near ret resume the lesson. Labeling frames by creator prevents confusing these distinct obligations."
      ],
      "example": {
        "title": "Inspect a minimal real-mode interrupt frame",
        "intro": "For an isolated paper trace, assume SP = 0x7000 immediately before a word-sized int instruction. Let the saved FLAGS be 0x0202, CS be 0x1000, and the resume offset after the INT be 0x0042.",
        "steps": [
          {
            "title": "Save flags and the code segment",
            "explanation": "The processor saves FLAGS at 0x6FFE and CS at 0x6FFC. These words describe the interrupted context; the handler’s current flags and code location may differ while it runs.",
            "state": "6FFE: 0202; 6FFC: 1000"
          },
          {
            "title": "Save the continuation offset",
            "explanation": "The saved IP occupies 0x6FFA, which becomes the top. In increasing addresses, the frame is IP, CS, FLAGS. The handler must restore any additional state it saves before returning through this frame.",
            "state": "SP = 6FFA; frame words = 0042, 1000, 0202"
          },
          {
            "title": "Consume the complete frame",
            "explanation": "A matching word-sized iret restores IP = 0x0042, CS = 0x1000, and FLAGS = 0x0202, releasing six bytes and restoring SP = 0x7000. A near ret would consume only the first word.",
            "state": "after iret: SP = 7000; interrupted state resumed"
          }
        ],
        "conclusion": "The six-byte accounting concerns this real-mode frame only. Protected-mode exceptions and privilege changes require the expanded layouts taught in the interrupt chapter."
      },
      "pitfalls": [
        {
          "title": "Using a plausible IP as proof",
          "text": "A near ret may load the expected offset but leaves saved CS and FLAGS on the stack and does not restore them. A plausible next address alone does not prove a valid interrupt return."
        }
      ],
      "transfer": "Does the BIOS handler’s iret also remove the helper’s normal call return? No. That older return belongs to the separate call into the helper. The handler restores its interrupt frame, then the helper restores its own saves and eventually executes its near ret."
    },
    "practice": {
      "title": "Test the whole calling agreement with distinguishable evidence",
      "paragraphs": [
        "A complete routine test needs several independent observations. The sum checks that both argument values reach the arithmetic. A preserved-register sentinel checks that temporary work does not damage the caller. The restored stack pointer checks ownership of return addresses and argument storage. A normal-looking printed answer can satisfy the first condition while violating either of the others.",
        "Use inputs chosen to make likely mistakes visible. Unequal arguments distinguish the two slots. A sentinel unlike either argument or their sum makes an accidental overwrite recognizable. A second input pair prevents a hardcoded answer from masquerading as data movement. Finally, reason through an overflow pair separately: a word result is the low sixteen bits, while unsigned carry is another output only if the interface includes it."
      ],
      "example": {
        "title": "Audit an independent sum and preservation case",
        "intro": "For a playground review, pass a = 0x0021 and b = 0x0046 with BX = 0xC59A. The desired sum is decimal 103, hexadecimal 0x0067. Use the chapter’s caller-cleaned, BP-based word convention.",
        "steps": [
          {
            "title": "Trace the two actual reads",
            "explanation": "Push b then a, call .sum, and derive the callee’s BP frame. The argument slots provide 33 and 70. Reading the first slot twice would produce 66, so 0x0042 is a useful signature of that bug.",
            "state": "expected AX = 0067; duplicated-first AX = 0042"
          },
          {
            "title": "Check restoration independently",
            "explanation": "The callee may borrow BX only after preserving its incoming 0xC59A. After its epilogue and return, inspect BX before preparing the display. A sum of 0x0067 does not prove this second requirement.",
            "state": "returned BX must equal C59A"
          },
          {
            "title": "Close the caller’s obligation",
            "explanation": "After the callee’s plain ret, release the two word arguments once. From lesson entry SP = 0x7BFE, this brings the caller back to 0x7BFE before its own outer return. Reload AX deliberately when printing the sentinel.",
            "state": "SP before outer return = 7BFE; output = 0067 C59A"
          }
        ],
        "conclusion": "The evidence is a relationship among incoming values, result, preserved state, and final boundary. Change the inputs and keep that relationship unchanged."
      },
      "pitfalls": [
        {
          "title": "Omitting caller cleanup",
          "text": "Immediately after the callee returns, the first argument is at the caller’s top. If the lesson executes ret then, it loads IP with 0x0021 while leaving the setup continuation on the stack."
        }
      ],
      "transfer": "What extra test distinguishes modulo arithmetic from ordinary small sums? Try 0xFFFD plus 5: AX should contain 0x0002. If overflow is part of the interface, capture CF before add sp,4. The preserved BX and final SP checks still apply even when the sum wraps."
    }
  }
};
