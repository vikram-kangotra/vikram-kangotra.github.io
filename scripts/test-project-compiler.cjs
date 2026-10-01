// Run with Playwright installed; PLAYWRIGHT_PATH may name an existing installation.
// Builds actual NASM/Clang/LLD WASM assets in a browser worker, then boots the image.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const reports = [];
const record = (name, detail = '') => { reports.push({ name, detail }); console.log(`PASS ${name}${detail ? `: ${detail}` : ''}`); };
const types = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const route = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  if (route === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Project compiler test</title><div id="screen"><div></div><canvas></canvas></div>'); return; }
  const file = route.startsWith('/src/') ? path.join(root, route) : path.join(root, 'public', route);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async () => {
      window.buildProject = (await import('/src/course/projectCompiler.js')).buildProject;
      window.files = (await import('/src/course/kernelProject.js')).kernelProjectFiles;
      window.progress = [];
    });

    const simple = "bits 16\norg 0x7c00\n%include \"message.inc\"\ncli\nhlt\ntimes 510-($-$$) db 0\ndw 0xaa55\n";
    const assembly = await page.evaluate(async source => {
      const result = await window.buildProject({ 'boot.asm': source, 'message.inc': 'mov ax, 0x1234\n' });
      return { type: result.type, size: result.disk.length, sector: [...result.sector.slice(0, 5)], signature: [...result.sector.slice(510)], artifacts: Object.keys(result.artifacts) };
    }, simple);
    assert.equal(assembly.type, 'boot-sector'); assert.equal(assembly.size, 16 * 1024 * 1024); assert.deepEqual(assembly.sector.slice(0, 3), [0xb8, 0x34, 0x12]); assert.deepEqual(assembly.signature, [0x55, 0xaa]);
    record('multi-file NASM boot sector with %include');

    const kernel = await page.evaluate(async () => {
      window.result = await window.buildProject(window.files, { onProgress: progress => window.progress.push(progress) });
      const result = window.result, elf = result.artifacts['kernel.elf'];
      return { type: result.type, size: result.disk.length, artifacts: Object.keys(result.artifacts), diagnostics: result.diagnostics,
        elf: [...elf.slice(0, 20)], kernelSize: result.artifacts['kernel.bin'].length, phases: window.progress.map(x => x.phase) };
    });
    assert.equal(kernel.type, 'kernel32'); assert.equal(kernel.size, 16 * 1024 * 1024); assert.equal(kernel.elf[4], 1); assert.equal(kernel.elf[18], 3); assert(kernel.kernelSize > 0 && kernel.kernelSize <= 16384);
    assert(kernel.artifacts.includes('objects/kernel/main.o') && kernel.artifacts.includes('objects/kernel/vga.o'));
    record('native ELF32 C compilation and cross-file linking', `${kernel.kernelSize} kernel bytes`);
    assert(kernel.phases.includes('compile') && kernel.phases.includes('link') && kernel.phases.includes('image'));
    record('phase-specific build progress');

    // Use the repository's actual v86 assets to execute the image from this build.
    const publicV86 = path.join(root, 'public/course/v86');
    if (fs.existsSync(path.join(publicV86, 'libv86.js'))) {
      await page.addScriptTag({ url: '/course/v86/libv86.js' });
      await page.evaluate(() => {
        window.serial = '';
        window.machine = new V86({ wasm_path: '/course/v86/v86.wasm', memory_size: 32 * 1024 * 1024,
          vga_memory_size: 2 * 1024 * 1024, screen_container: document.getElementById('screen'),
          bios: { url: '/course/v86/seabios.bin' }, vga_bios: { url: '/course/v86/vgabios.bin' },
          hda: { buffer: window.result.disk.buffer }, boot_order: 0x213, autostart: true, disable_keyboard: true, disable_mouse: true });
        window.machine.add_listener('serial0-output-byte', byte => { window.serial += String.fromCharCode(byte); });
      });
      await page.waitForFunction(() => window.serial.includes('C KERNEL READY'), { timeout: 45000 });
      const visible = await page.locator('#screen').innerText();
      assert(visible.includes('C KERNEL READY'));
      record('browser-built kernel boots in real v86', 'matching VGA and COM1 output');
      await page.evaluate(async () => { await window.machine.stop(); window.machine.destroy(); });
    } else throw new Error('v86 assets were not found; runtime verification is required.');

    const errorsToTest = [
      ['invalid path', { '../escape.c': 'x' }, /Invalid project path/],
      ['invalid manifest', { 'build.json': '{', 'boot.asm': simple }, /build\.json/],
      ['NASM syntax diagnostic', { 'boot.asm': 'bits 16\nmov ax,\ntimes 510-($-$$) db 0\ndw 0xaa55' }, /boot\.asm:2/],
      ['boot signature validation', { 'boot.asm': 'times 512 db 0' }, /55 AA/],
      ['boot output bounds', { 'boot.asm': 'times 513 db 0' }, /exceeds 512/],
    ];
    for (const [name, files, pattern] of errorsToTest) {
      const error = await page.evaluate(async files => { try { await window.buildProject(files); return ''; } catch (e) { return e.message; } }, files);
      assert.match(error, pattern); record(name);
    }
    const badC = await page.evaluate(async () => {
      try { await window.buildProject({ ...window.files, 'kernel/main.c': '#include "vga.h"\nvoid kernel_main(void) { invalid syntax; }' }); return ''; }
      catch (error) { return error.message; }
    });
    assert.match(badC, /kernel\/main\.c:2:/); record('file and line C diagnostics');
    const unresolved = await page.evaluate(async () => {
      const manifest = JSON.parse(window.files['build.json']);
      manifest.sources = manifest.sources.filter(path => path !== 'kernel/vga.c');
      try { await window.buildProject({ ...window.files, 'build.json': JSON.stringify(manifest) }); return ''; }
      catch (error) { return error.message; }
    });
    assert.match(unresolved, /undefined symbol.*vga_/); record('real linker rejects unresolved cross-file symbols');
    const headerBuild = await page.evaluate(async () => {
      const files = { ...window.files };
      files['kernel/main.c'] = '#include <stdint.h>\n#include <stddef.h>\n#include <stdbool.h>\n#include <stdarg.h>\n#include <limits.h>\n' + files['kernel/main.c'];
      files['kernel/main.c'] += `
_Static_assert(sizeof(uintptr_t) == 4, "target pointer size");
_Static_assert(sizeof(size_t) == 4, "target size type");
_Static_assert(CHAR_BIT == 8 && CHAR_MIN == -128 && UCHAR_MAX == 255, "i386 byte bounds");
_Static_assert(SHRT_MIN == -32768 && USHRT_MAX == 65535, "i386 short bounds");
_Static_assert(sizeof(int) == 4 && INT_MAX == 2147483647 && INT_MIN == (-2147483647 - 1), "i386 signed int bounds");
_Static_assert(sizeof(long) == 4 && LONG_MAX == 2147483647L && LONG_MIN == (-2147483647L - 1L), "i386 signed long bounds");
_Static_assert(UINT_MAX == UINT32_MAX && ULONG_MAX == UINT32_MAX, "i386 unsigned bounds");
_Static_assert(sizeof(long long) == 8 && LLONG_MAX == INT64_MAX && LLONG_MIN == INT64_MIN && ULLONG_MAX == UINT64_MAX, "64-bit long long bounds");
_Static_assert(_Generic(LONG_MIN, long: 1, default: 0) && _Generic(ULONG_MAX, unsigned long: 1, default: 0), "limits keep the target integer types");
/* A scheduler rejects counts beyond its int result range before conversion. */
_Static_assert((size_t)INT_MAX + 1u > (size_t)INT_MAX, "scheduler count boundary must not overflow size_t");
static uint32_t header_probe(bool enabled) { return enabled ? UINT32_MAX : 0; }
`;
      const result = await window.buildProject(files);
      return { size: result.artifacts['kernel.bin'].length, diagnostics: result.diagnostics };
    });
    assert(headerBuild.size > 0); record('ordinary kernel builds provide freestanding headers and i386 integer limits');
    assert(headerBuild.diagnostics.some(line => /unused function/.test(line))); record('compiler warnings are retained');
    const movedEntry = await page.evaluate(async () => {
      const files = { ...window.files, 'linker.ld': window.files['linker.ld'].replace('ENTRY(_start)', 'ENTRY(kernel_main)').replace('ASSERT(_start == 0x10000, "kernel entry moved")', '') };
      try { await window.buildProject(files); return ''; } catch (error) { return error.message; }
    });
    assert.match(movedEntry, /entry must be exactly 0x10000/); record('ELF entry must match the loader');
    const oversized = await page.evaluate(async () => {
      const files = { ...window.files };
      files['kernel/main.c'] += '\nvolatile unsigned char excessive_data[16384] = { 1 };\n';
      files['linker.ld'] = files['linker.ld'].replace('ASSERT(__file_end <= 0x14000, "kernel exceeds 32-sector slot")', '');
      try { await window.buildProject(files); return ''; } catch (error) { return error.message; }
    });
    assert.match(oversized, /file-backed kernel exceeds/); record('ELF file bytes are bounded independently of linker assertions');
    const oversizedBss = await page.evaluate(async () => {
      const files = { ...window.files };
      files['kernel/main.c'] += '\nvolatile unsigned char excessive_bss[0x60000];\n';
      files['linker.ld'] = files['linker.ld'].replace('ASSERT(__bss_end <= 0x60000, "kernel overlaps reserved stack region")', '');
      try { await window.buildProject(files); return ''; } catch (error) { return error.message; }
    });
    assert.match(oversizedBss, /reserved stack region/); record('ELF BSS cannot overlap the reserved stack region');
    const cancel = await page.evaluate(async () => {
      const controller = new AbortController();
      const build = window.buildProject(window.files, { signal: controller.signal });
      controller.abort();
      try { await build; return ''; } catch (error) { return error.name; }
    });
    assert.equal(cancel, 'AbortError'); record('cancellation terminates build worker');
    const preCancelled = await page.evaluate(async () => {
      const controller = new AbortController(); controller.abort();
      try { await window.buildProject(window.files, { signal: controller.signal }); return ''; } catch (error) { return error.name; }
    });
    assert.equal(preCancelled, 'AbortError'); record('pre-cancelled build does not start');
    assert.deepEqual(errors, []); record('no browser page errors');
    console.log(JSON.stringify({ passed: reports.length, reports }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
