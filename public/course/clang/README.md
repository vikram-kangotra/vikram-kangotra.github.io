# Browser x86 C project compiler

`worker.js` is a course-owned adapter. It executes the upstream Clang, LLD,
and memory-filesystem WebAssembly modules inside a disposable browser worker.
Clang **emits native ELF32/i386 object files**, LLD links those objects with the
learner's linker script, and the course image builder packs the validated load
segments into an x86 boot disk. The output kernel is not a WebAssembly program.
There is no compilation service, upload, shared memory, or cross-origin isolation
requirement. The compiler is loaded lazily only for `kernel32` projects.

## Provenance and licenses

The unmodified binary modules and `shared.js` come from
<https://github.com/binji/wasm-clang> at commit
`648c4a89997a351eef75cdaec3ef5b89d4937dec`. The modules report LLVM/LLD 8.0.1.
`provenance.json` records each source URL, exact byte length, and SHA-256 digest.
The upstream files named `clang`, `lld`, and `memfs` have been renamed with a
`.wasm` suffix for correct static-host MIME handling. See `LICENSE` and
`LICENSE.llvm` for the upstream license notices. The upstream WASI JavaScript
support retains its copyright and Apache-2.0 notice in `shared.js`.

The Clang and LLD assets are approximately 31 MB and 20 MB uncompressed. They
are individual static files, below GitHub's per-file size limit. A first build
downloads them; subsequent builds can use the browser's ordinary HTTP cache.
We deliberately retain the compiler version in the interface and provenance
rather than presenting a 2019 toolchain as the latest LLVM release.

## Project format

Source paths are relative, use letters, digits, `_`, `-`, `.`, and `/`, and may
not contain `.` or `..` path components. `.course-` prefixes are reserved for
private build files. The file tree is a private memory filesystem; it has no
access to host files. Limits are 64 text files, 256 KiB per file, and 1 MiB total
UTF-8 source. The main-thread bridge enforces a 120-second build deadline and
terminates the worker for cancellation, timeout, completion, or failure.

With no `build.json`, the project is a `boot-sector` build of `boot.asm`.
An explicit assembly manifest can select another entry and include directories:

```json
{"type":"boot-sector","entry":"boot.asm","include":["include"]}
```

A linked kernel uses two raw boot stages, NASM ELF32 assembly sources, C sources,
include directories, and a linker script:

```json
{
  "type": "kernel32",
  "boot": ["boot/stage1.asm", "boot/stage2.asm"],
  "sources": ["kernel/entry.asm", "kernel/main.c", "kernel/vga.c"],
  "include": ["include"],
  "linker": "linker.ld"
}
```

NASM's command-line globals are not reset between repeated `callMain` calls.
Each assembly translation unit therefore receives a fresh NASM instance, as it
would with separate native processes. `%include` resolves against its source
directory, declared include directories, and the project root. NASM output
writes and macro-expansion limits are bounded; it is not a toy assembler.

## C environment

Clang runs its in-process `-cc1` frontend with target `i386-unknown-none-elf`,
CPU `i686`, C11, `-O2 -Wall -Wextra -ffreestanding -fno-builtin`, static
relocation, soft-float with implicit floating-point code disabled, and
SSE/SSE2/MMX disabled. Each `.c` is a separate translation unit.
LLD runs as `ld.lld --no-threads -m elf_i386 -T linker.ld --build-id=none`.
No host libc, hosted startup, compiler support library, or WASI sysroot is
linked. Unresolved symbols produce actual LLD diagnostics. There is no implicit
`printf`, `malloc`, file I/O, floating-point runtime, or system-call service.

The adapter provides small freestanding `stddef.h`, `stdint.h`, `stdbool.h`,
and `stdarg.h` headers based on Clang's target type macros and builtins. This is
a documented subset for the course, not a complete hosted standard library.
Project include directories precede these fallback headers, so a learner can
supply their own definitions. Additional headers and function implementations
must be added explicitly to the project.

## Disk and loader invariants

The result is a zero-initialized 16-MiB raw disk. Its first 512-byte sector must
end in `55 aa`. Stage 2 occupies at most eight sectors beginning at LBA 1. The
kernel occupies at most 32 sectors beginning at LBA 9. Unused slot bytes are
zero-filled, and no source file writes directly to a host disk.

LLD produces an ELF32 executable. The builder checks machine, endianness,
program-header bounds, entry `0x10000`, matching physical/virtual addresses,
nonoverlapping PT_LOAD memory ranges, file-backed addresses below `0x14000`,
and total memory ranges below `0x60000`. Dynamic/interpreter segments are
rejected. It copies file-backed segments at offsets relative to `0x10000`,
preserving holes. BSS is validated but not copied from disk: the provided entry
stub zeroes `__bss_start` through `__bss_end`, with the stack at `0x70000`.

The worker returns the raw disk, first sector, emitted objects, ELF executable,
flattened kernel bytes, build log, and real source/line diagnostics. Compiler
warnings are retained. A successful build is not a claim that arbitrary learner
code obeys the hardware contract; runtime faults remain observable in v86.

## Verification

`scripts/test-project-compiler.cjs` uses Playwright to execute the actual worker,
compile two C files and an ELF32 assembly entry, link them, and boot the resulting
image in v86. It compares VGA and COM1 output, checks multi-file NASM includes,
compiler/linker diagnostics, invalid inputs, bounded output, and cancellation.
Set `PLAYWRIGHT_PATH` and `CHROME_PATH` if using an existing local installation.
