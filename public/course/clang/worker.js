/* global createNasm, API, importScripts */
'use strict';

// Course-owned adapter. NASM and the LLVM/WASI assets remain unmodified upstream.
const LIMITS = { files: 64, source: 1048576, file: 262144, object: 1048576, elf: 2097152, diagnostics: 65536 };
const encoder = new TextEncoder();
let busy = false;
let diagnostics = [];
let diagnosticBytes = 0;
let compilerText = '';
let log = [];

function progress(phase, message, extra = {}) {
  log.push(message);
  self.postMessage({ type: 'progress', phase, message, ...extra });
}

function collect(text) {
  const clean = String(text).replace(/\x1b\[[0-9;]*m/g, '');
  if (diagnosticBytes >= LIMITS.diagnostics) return;
  const bounded = clean.slice(0, LIMITS.diagnostics - diagnosticBytes);
  diagnosticBytes += bounded.length;
  compilerText += bounded;
}

function flushDiagnostics() {
  for (const line of compilerText.split(/\r?\n/)) {
    if (line.trim() && !line.startsWith('> ')) diagnostics.push(line);
  }
  compilerText = '';
}

function pathValid(path) {
  return typeof path === 'string' && path.length > 0 && path.length <= 160
    && /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(path)
    && !path.split('/').some(part => part === '.' || part === '..' || part.startsWith('.course-'));
}

function requirePath(path, files, label) {
  if (!pathValid(path)) throw new Error(`${label}: invalid relative project path.`);
  if (!Object.prototype.hasOwnProperty.call(files, path)) throw new Error(`${label}: missing file ${path}.`);
  return path;
}

function validateProject(files) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Expected a project file map.');
  const entries = Object.entries(files);
  if (!entries.length || entries.length > LIMITS.files) throw new Error('Keep the project between 1 and 64 files.');
  let total = 0;
  for (const [path, source] of entries) {
    if (!pathValid(path) || typeof source !== 'string') throw new Error(`Invalid source file: ${path}.`);
    const bytes = encoder.encode(source).length;
    if (bytes > LIMITS.file) throw new Error(`${path}: source exceeds 256 KiB.`);
    total += bytes;
  }
  if (total > LIMITS.source) throw new Error('Project sources exceed 1 MiB.');
  let manifest;
  try { manifest = files['build.json'] ? JSON.parse(files['build.json']) : { type: 'boot-sector', entry: 'boot.asm' }; }
  catch (error) { throw new Error(`build.json: invalid JSON: ${error.message}`); }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('build.json: expected an object.');
  if (manifest.type === 'boot-sector') {
    manifest.entry = requirePath(manifest.entry || 'boot.asm', files, 'build.json entry');
  } else if (manifest.type === 'kernel32') {
    if (!Array.isArray(manifest.boot) || manifest.boot.length !== 2) throw new Error('build.json: kernel32 requires two boot-stage paths.');
    manifest.boot.forEach(path => requirePath(path, files, 'build.json boot'));
    if (!Array.isArray(manifest.sources) || !manifest.sources.length || manifest.sources.length > 48) throw new Error('build.json: provide between 1 and 48 C or assembly source paths.');
    if (new Set(manifest.sources).size !== manifest.sources.length) throw new Error('build.json: source paths must not repeat.');
    manifest.sources.forEach(path => {
      requirePath(path, files, 'build.json sources');
      if (!/\.(c|asm)$/i.test(path)) throw new Error(`${path}: kernel sources must end in .c or .asm.`);
    });
    requirePath(manifest.linker, files, 'build.json linker');
  } else throw new Error('build.json: supported project types are boot-sector and kernel32.');
  const include = manifest.include || [];
  if (!Array.isArray(include) || include.length > 16 || include.some(path => !pathValid(path))) {
    throw new Error('build.json: include must contain at most 16 relative directory paths.');
  }
  manifest.include = include;
  return manifest;
}

function directories(files) {
  const dirs = new Set();
  for (const path of Object.keys(files)) {
    const parts = path.split('/');
    parts.pop();
    for (let i = 1; i <= parts.length; i += 1) dirs.add(parts.slice(0, i).join('/'));
  }
  return [...dirs].sort((a, b) => a.split('/').length - b.split('/').length);
}

async function loadNasm(files) {
  progress('compiler', 'Loading NASM 2.16.03 for x86 assembly');
  if (typeof createNasm !== 'function') importScripts('../nasm/nasm.js');
  const nasm = await createNasm({
    locateFile: name => new URL(`../nasm/${name}`, self.location.href).href,
    print: line => collect(`${line}\n`), printErr: line => collect(`${line}\n`),
  });
  nasm.FS.mkdir('/project');
  nasm.FS.mkdir('/project/.course-build');
  for (const dir of directories(files)) nasm.FS.mkdir(`/project/${dir}`);
  for (const [path, text] of Object.entries(files)) nasm.FS.writeFile(`/project/${path}`, text);
  nasm.FS.chdir('/project');
  const bounds = new Map();
  const write = nasm.FS.write;
  nasm.FS.write = (stream, buffer, offset, length, position, canOwn) => {
    const bound = bounds.get(stream.path);
    const end = (position === undefined ? stream.position : position) + length;
    if (bound !== undefined && end > bound) throw new Error(`${stream.path.replace('/project/', '')}: output exceeds ${bound} bytes; reduce code, data, or macro expansion.`);
    return write(stream, buffer, offset, length, position, canOwn);
  };
  return { nasm, bounds };
}

function assemble(tool, source, format, output, cap, include, withListing = false) {
  progress('assemble', `Assembling ${source} (${format})`);
  const { nasm, bounds } = tool;
  bounds.set(`/project/${output}`, cap);
  bounds.set(`/project/${output}.lst`, LIMITS.object);
  const sourceDir = source.includes('/') ? source.slice(0, source.lastIndexOf('/')) : '';
  const includePaths = [...new Set([sourceDir, ...include, ''].map(path => path ? `${path}/` : './'))];
  const args = ['-f', format, '-o', output,
    '--limit-passes', '100', '--limit-lines', '100000', '--limit-rep', '10000',
    '--limit-macro-levels', '100', '--limit-macro-tokens', '100000', '--limit-mmacros', '10000',
    ...includePaths.flatMap(path => ['-I', path]),
    ...(withListing ? ['-l', `${output}.lst`] : []), source];
  const result = nasm.callMain(args);
  flushDiagnostics();
  if (result !== 0) throw new Error(`NASM failed while assembling ${source} (status ${result}).`);
  const bytes = new Uint8Array(nasm.FS.readFile(output));
  if (bytes.length > cap) throw new Error(`${source}: assembled output exceeds ${cap} bytes.`);
  const listing = withListing ? nasm.FS.readFile(`${output}.lst`, { encoding: 'utf8' }) : '';
  return { bytes, listing };
}

function validateSector(sector, path) {
  if (sector.length !== 512) throw new Error(`${path}: boot sector must be exactly 512 bytes (received ${sector.length}).`);
  if (sector[510] !== 0x55 || sector[511] !== 0xaa) throw new Error(`${path}: bytes 510–511 must be 55 AA. End with dw 0xaa55.`);
}

const headers = {
  // Ask the native target compiler for its integer model, never the WASM host.
  // Keep the macro types as well as their values correct (i386 long is 32-bit).
  'limits.h': `#ifndef COURSE_LIMITS_H
#define COURSE_LIMITS_H
#define CHAR_BIT __CHAR_BIT__
#define SCHAR_MAX __SCHAR_MAX__
#define SCHAR_MIN (-SCHAR_MAX - 1)
#define UCHAR_MAX (SCHAR_MAX * 2 + 1)
#ifdef __CHAR_UNSIGNED__
#define CHAR_MIN 0
#define CHAR_MAX UCHAR_MAX
#else
#define CHAR_MIN SCHAR_MIN
#define CHAR_MAX SCHAR_MAX
#endif
#define SHRT_MAX __SHRT_MAX__
#define SHRT_MIN (-SHRT_MAX - 1)
#define USHRT_MAX (SHRT_MAX * 2 + 1)
#define INT_MAX __INT_MAX__
#define INT_MIN (-INT_MAX - 1)
#define UINT_MAX (INT_MAX * 2U + 1U)
#define LONG_MAX __LONG_MAX__
#define LONG_MIN (-LONG_MAX - 1L)
#define ULONG_MAX (LONG_MAX * 2UL + 1UL)
#define LLONG_MAX __LONG_LONG_MAX__
#define LLONG_MIN (-LLONG_MAX - 1LL)
#define ULLONG_MAX (LLONG_MAX * 2ULL + 1ULL)
/* The supplied freestanding environment uses single-byte characters. */
#define MB_LEN_MAX 1
#endif
`,
  'stddef.h': '#ifndef COURSE_STDDEF_H\n#define COURSE_STDDEF_H\ntypedef __SIZE_TYPE__ size_t;\ntypedef __PTRDIFF_TYPE__ ptrdiff_t;\ntypedef __WCHAR_TYPE__ wchar_t;\ntypedef struct { long long i; long double d; } max_align_t;\n#define NULL ((void *)0)\n#define offsetof(type, member) __builtin_offsetof(type, member)\n#endif\n',
  'stdbool.h': '#ifndef COURSE_STDBOOL_H\n#define COURSE_STDBOOL_H\n#define bool _Bool\n#define true 1\n#define false 0\n#define __bool_true_false_are_defined 1\n#endif\n',
  'stdarg.h': '#ifndef COURSE_STDARG_H\n#define COURSE_STDARG_H\ntypedef __builtin_va_list va_list;\n#define va_start(ap, last) __builtin_va_start(ap, last)\n#define va_end(ap) __builtin_va_end(ap)\n#define va_arg(ap, type) __builtin_va_arg(ap, type)\n#define va_copy(dest, src) __builtin_va_copy(dest, src)\n#endif\n',
  'stdint.h': '#ifndef COURSE_STDINT_H\n#define COURSE_STDINT_H\ntypedef __INT8_TYPE__ int8_t; typedef __UINT8_TYPE__ uint8_t;\ntypedef __INT16_TYPE__ int16_t; typedef __UINT16_TYPE__ uint16_t;\ntypedef __INT32_TYPE__ int32_t; typedef __UINT32_TYPE__ uint32_t;\ntypedef __INT64_TYPE__ int64_t; typedef __UINT64_TYPE__ uint64_t;\ntypedef __INTPTR_TYPE__ intptr_t; typedef __UINTPTR_TYPE__ uintptr_t;\ntypedef __INTMAX_TYPE__ intmax_t; typedef __UINTMAX_TYPE__ uintmax_t;\n#define INT8_MIN (-127-1)\n#define INT8_MAX 127\n#define UINT8_MAX 255U\n#define INT16_MIN (-32767-1)\n#define INT16_MAX 32767\n#define UINT16_MAX 65535U\n#define INT32_MIN (-2147483647-1)\n#define INT32_MAX 2147483647\n#define UINT32_MAX 4294967295U\n#define INT64_MIN (-9223372036854775807LL-1)\n#define INT64_MAX 9223372036854775807LL\n#define UINT64_MAX 18446744073709551615ULL\n#define INTPTR_MIN INT32_MIN\n#define INTPTR_MAX INT32_MAX\n#define UINTPTR_MAX UINT32_MAX\n#define SIZE_MAX UINT32_MAX\n#define PTRDIFF_MIN INT32_MIN\n#define PTRDIFF_MAX INT32_MAX\n#define INT8_C(v) v\n#define UINT8_C(v) v\n#define INT16_C(v) v\n#define UINT16_C(v) v\n#define INT32_C(v) v\n#define UINT32_C(v) v##U\n#define INT64_C(v) v##LL\n#define UINT64_C(v) v##ULL\n#define INTMAX_C(v) v##LL\n#define UINTMAX_C(v) v##ULL\n#endif\n',
};

async function fetchModule(name) {
  const labels = { 'clang.wasm': 'Clang C compiler (about 31 MB)', 'lld.wasm': 'LLD ELF linker (about 20 MB)', 'memfs.wasm': 'compiler memory filesystem' };
  progress('download', `Loading ${labels[name] || name}; the browser can cache it for later builds`);
  const response = await fetch(new URL(name, self.location.href));
  if (!response.ok) throw new Error(`Could not load ${name}: HTTP ${response.status}.`);
  const bytes = await response.arrayBuffer();
  progress('compiler', `Preparing ${labels[name] || name}`);
  return WebAssembly.compile(bytes);
}

async function loadClang(files, include) {
  importScripts('./shared.js');
  const api = new API({
    clang: 'clang.wasm', lld: 'lld.wasm', memfs: 'memfs.wasm',
    compileStreaming: fetchModule,
    // No hosted WASI sysroot is used for the native x86 target.
    readBuffer: async () => new ArrayBuffer(1024),
    hostWrite: collect,
  });
  await api.ready;
  api.memfs.addDirectory('.course-build');
  api.memfs.addDirectory('.course-include');
  for (const dir of directories(files)) api.memfs.addDirectory(dir);
  for (const [path, text] of Object.entries(files)) api.memfs.addFile(path, encoder.encode(text));
  for (const [name, text] of Object.entries(headers)) api.memfs.addFile(`.course-include/${name}`, encoder.encode(text));
  const module = await api.getModule('clang.wasm');
  flushDiagnostics();
  return { api, module, include };
}

async function compileC(tool, path, output) {
  progress('compile', `Compiling ${path} to a native i386 object`);
  const args = ['clang', '-cc1', '-triple', 'i386-unknown-none-elf', '-target-cpu', 'i686',
    '-emit-obj', '-ffreestanding', '-fno-builtin', '-mrelocation-model', 'static', '-msoft-float', '-no-implicit-float',
    '-target-feature', '-sse', '-target-feature', '-sse2', '-target-feature', '-mmx',
    '-std=c11', '-O2', '-Wall', '-Wextra', '-ferror-limit', '20',
    ...tool.include.flatMap(dir => ['-I', dir]), '-I', '.course-include',
    '-o', output, '-x', 'c', path];
  await tool.api.run(tool.module, ...args);
  flushDiagnostics();
  const bytes = new Uint8Array(tool.api.memfs.getFileContents(output));
  if (bytes.length > LIMITS.object) throw new Error(`${path}: compiled object exceeds 1 MiB.`);
  if (bytes.length < 20 || bytes[0] !== 0x7f || bytes[1] !== 0x45 || bytes[4] !== 1 || bytes[18] !== 3 || bytes[19] !== 0) {
    throw new Error(`${path}: compiler did not produce an ELF32 i386 object.`);
  }
  return bytes;
}

// Validate loader assumptions before turning an ELF executable into raw sectors.
function flattenElf(bytes) {
  const fail = message => { throw new Error(`kernel.elf: ${message}`); };
  if (bytes.length < 52 || bytes.length > LIMITS.elf) fail('ELF size is outside the 52-byte to 2-MiB limit.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = offset => view.getUint16(offset, true);
  const u32 = offset => view.getUint32(offset, true);
  if (u32(0) !== 0x464c457f || bytes[4] !== 1 || bytes[5] !== 1 || bytes[6] !== 1) fail('expected little-endian ELF32.');
  if (u16(16) !== 2 || u16(18) !== 3 || u32(20) !== 1 || u16(40) !== 52) fail('expected an executable for i386.');
  const base = 0x10000;
  const entry = u32(24), phoff = u32(28), phentsize = u16(42), phnum = u16(44);
  if (entry !== base) fail('entry must be exactly 0x10000 to match stage 2.');
  if (phentsize !== 32 || !phnum || phnum > 64 || phoff + phnum * phentsize > bytes.length) fail('invalid program-header table.');
  const segments = [];
  let end = base;
  let executableEntry = false;
  for (let i = 0; i < phnum; i += 1) {
    const p = phoff + i * phentsize;
    const type = u32(p);
    if (type === 2 || type === 3) fail('dynamic linking and interpreter segments are unsupported in this freestanding loader.');
    if (type !== 1) continue;
    const offset = u32(p + 4), virtual = u32(p + 8), physical = u32(p + 12);
    const fileSize = u32(p + 16), memorySize = u32(p + 20), flags = u32(p + 24);
    if (fileSize > memorySize || offset + fileSize > bytes.length) fail('invalid PT_LOAD file range.');
    if (!memorySize) continue;
    if (virtual !== physical) fail('virtual and physical load addresses must match before paging is enabled.');
    if (physical < base || physical + memorySize > 0x60000) fail('loadable memory must stay within 0x10000–0x60000, below the reserved stack region.');
    if (fileSize && physical + fileSize > base + 16384) fail('file-backed kernel exceeds its 16-KiB disk slot.');
    if (segments.some(s => physical < s.physical + s.memorySize && s.physical < physical + memorySize)) fail('overlapping PT_LOAD memory ranges.');
    segments.push({ offset, physical, fileSize, memorySize });
    if (fileSize) end = Math.max(end, physical + fileSize);
    if ((flags & 1) && entry >= physical && entry < physical + fileSize) executableEntry = true;
  }
  if (!segments.length || !executableEntry || end <= base) fail('entry is not backed by executable bytes.');
  const raw = new Uint8Array(end - base);
  for (const segment of segments) {
    if (segment.fileSize) raw.set(bytes.subarray(segment.offset, segment.offset + segment.fileSize), segment.physical - base);
  }
  return raw;
}

self.onmessage = async ({ data }) => {
  if (busy) return;
  busy = true;
  try {
    const files = data?.files;
    const manifest = validateProject(files);
    progress('validate', `Validated ${Object.keys(files).length} project files`);
    let nasm = await loadNasm(files);
    const artifacts = {};
    let sector, listing = '', stage2, kernel;
    if (manifest.type === 'boot-sector') {
      const assembled = assemble(nasm, manifest.entry, 'bin', '.course-build/boot.bin', 512, manifest.include, true);
      sector = assembled.bytes;
      listing = assembled.listing;
      validateSector(sector, manifest.entry);
      artifacts['boot.bin'] = sector;
    } else {
      sector = assemble(nasm, manifest.boot[0], 'bin', '.course-build/stage1.bin', 512, manifest.include).bytes;
      validateSector(sector, manifest.boot[0]);
      // NASM's command-line globals outlive callMain; use a fresh instance for
      // every translation unit, as separate native NASM processes would do.
      nasm = await loadNasm(files);
      stage2 = assemble(nasm, manifest.boot[1], 'bin', '.course-build/stage2.bin', 4096, manifest.include).bytes;
      if (!stage2.length) throw new Error(`${manifest.boot[1]}: stage 2 cannot be empty.`);
      const clang = await loadClang(files, manifest.include);
      const objectNames = [];
      for (let i = 0; i < manifest.sources.length; i += 1) {
        const source = manifest.sources[i];
        const output = `.course-build/object-${i}.o`;
        let object;
        if (/\.asm$/i.test(source)) {
          nasm = await loadNasm(files);
          object = assemble(nasm, source, 'elf32', output, LIMITS.object, manifest.include).bytes;
          clang.api.memfs.addFile(output, object);
        } else object = await compileC(clang, source, output);
        objectNames.push(output);
        artifacts[`objects/${source.replace(/\.(c|asm)$/i, '.o')}`] = object;
      }
      progress('link', 'Linking ELF32 kernel with your linker script');
      const lld = await clang.api.getModule('lld.wasm');
      await clang.api.run(lld, 'ld.lld', '--no-threads', '-m', 'elf_i386', '-T', manifest.linker,
        '--build-id=none', '-o', '.course-build/kernel.elf', ...objectNames);
      flushDiagnostics();
      const elf = new Uint8Array(clang.api.memfs.getFileContents('.course-build/kernel.elf'));
      progress('validate', 'Checking ELF entry, load ranges, BSS bounds, and the 16-KiB kernel slot');
      kernel = flattenElf(elf);
      artifacts['kernel.elf'] = elf;
      artifacts['kernel.bin'] = kernel;
      artifacts['stage1.bin'] = sector;
      artifacts['stage2.bin'] = stage2;
    }
    progress('image', 'Building the 16-MiB boot disk');
    const disk = new Uint8Array(16 * 1024 * 1024);
    disk.set(sector, 0);
    if (stage2) disk.set(stage2, 512);
    if (kernel) disk.set(kernel, 9 * 512);
    artifacts['os.img'] = disk;
    flushDiagnostics();
    progress('ready', manifest.type === 'kernel32' ? 'Build complete: native x86 kernel is ready to boot' : 'Build complete: boot sector is ready to run');
    const buffers = new Set([sector.buffer, disk.buffer, ...Object.values(artifacts).map(value => value.buffer)]);
    self.postMessage({ ok: true, type: manifest.type, entry: manifest.entry || manifest.sources[0], sector, disk, artifacts, listing, diagnostics, log }, [...buffers]);
  } catch (error) {
    flushDiagnostics();
    const detail = error instanceof Error ? error.message : String(error);
    const messages = diagnostics.join('\n');
    self.postMessage({ ok: false, error: messages && !detail.includes(messages) ? `${messages}\n${detail}` : detail, diagnostics, log });
  }
};
