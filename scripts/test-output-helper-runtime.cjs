// Real NASM and v86 checks for the learner-owned BIOS output implementations.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const report = { started: new Date().toISOString(), checks: [], errors: [] };
const reportPath = process.env.OUTPUT_HELPER_REPORT_PATH || '/private/tmp/os-output-helper-runtime.json';
const save = () => fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
const server = http.createServer((request, response) => {
  const route = decodeURIComponent(new URL(request.url, 'http://local').pathname);
  if (route === '/') {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><title>Output helper runtime checks</title><div id="screen"><div></div><canvas></canvas></div>');
    return;
  }
  let file = path.join(root, route.startsWith('/src/') ? route : '/public' + route);
  if (!path.extname(file) && fs.existsSync(file + '.js')) file += '.js';
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
  fs.createReadStream(file).pipe(response);
});

(async () => {
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
    const page = await browser.newPage();
    page.setDefaultTimeout(120000);
    page.on('pageerror', error => { report.errors.push(error.message); save(); });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async () => {
      window.guide = (await import('/src/course/guidedOutput.js')).guidedOutput;
      window.grade = (await import('/src/course/machineGrader.js')).runCheckpointTests;
      window.prepare = (await import('/src/course/guidedBuild.js')).prepareGuidedBuild;
      window.build = (await import('/src/course/projectCompiler.js')).buildProject;
    });
    async function verify(label, index, mutation = null, expected = false, caseIndex = null, assertionPattern = null) {
      const result = await page.evaluate(async ({ index, mutation, caseIndex }) => {
        const step = structuredClone(window.guide.steps[index]);
        if (caseIndex !== null) step.tests.cases = [step.tests.cases[caseIndex]];
        const files = { ...step.reference.files, 'lesson.asm': step.reference.body, 'data.inc': step.reference.data };
        let source = files['console.asm'];
        const replace = (before, after) => {
          if (!source.includes(before)) throw new Error(`Mutation cannot find ${JSON.stringify(before)}`);
          source = source.replace(before, after);
        };
        if (mutation === 'missing') delete files['console.asm'];
        if (mutation === 'readme') { delete files['console.asm']; files['README.md'] = 'I can explain each output helper.'; }
        if (mutation === 'comment') source = '; My output library will go here.\n';
        if (mutation === 'hardcoded') replace('mov ah, 0x0e', "mov al, 'A'\n    mov ah, 0x0e");
        if (mutation === 'wrong-service') replace('mov ah, 0x0e', 'mov ah, 0x0f');
        if (mutation === 'no-bios') replace('int 0x10', 'nop');
        if (mutation === 'flags') replace('popfd', 'add sp, 4');
        if (mutation === 'upper-register') replace('popad', 'popad\n    xor eax, 0x10000');
        if (mutation === 'segment') replace('pop ds', 'pop ds\n    push ax\n    xor ax, ax\n    mov ds, ax\n    pop ax');
        if (mutation === 'stack') replace('    ret', '    ret 2');
        if (mutation === 'missing-cr') replace('    mov al, 13\n    call putc\n', '');
        if (mutation === 'missing-lf') replace('    mov al, 10\n    call putc\n', '');
        if (mutation === 'backward-string') replace('puts:\n    pushfd\n    pushad\n    cld', 'puts:\n    pushfd\n    pushad');
        if (mutation === 'pointer') replace('.done:\n    popad', '.done:\n    popad\n    inc esi');
        if (mutation === 'fixed-string-length') {
          replace('puts:\n    pushfd\n    pushad\n    cld', 'puts:\n    pushfd\n    pushad\n    cld\n    mov cx, 6');
          replace('    test al, al\n    jz .done\n', '');
          replace('    jmp .next', '    loop .next');
        }
        if (mutation === 'lowercase') replace('add al, 7', 'add al, 39');
        if (mutation === 'short-hex') replace('mov cx, 4', 'mov cx, 3');
        if (mutation === 'reversed-hex') replace('rol dx, 4', 'ror dx, 4');
        if (mutation === 'constant-hex') replace('mov dx, ax', 'xor dx, dx');
        if (mutation === 'fake-caller') files['lesson.asm'] = "mov al, 'A'\nmov ah, 0x0e\nmov bx, 7\nint 0x10\n";
        if (mutation === 'invalid-caller') files['lesson.asm'] = 'This unfinished Run caller is not valid assembly.\n';
        if (mutation === 'missing-caller') delete files['lesson.asm'];
        if (!['missing', 'readme'].includes(mutation)) files['console.asm'] = source;
        if (mutation === 'fake-caller') files['console.asm'] = 'putc:\n    ret\n';
        const saved = JSON.stringify(files);
        const result = await window.grade({ files, guide: { ...window.guide, step } });
        if (JSON.stringify(files) !== saved) throw new Error('Grading mutated the saved helper source');
        return result;
      }, { index, mutation, caseIndex });
      report.checks.push({ label, mutation, expected, result }); save();
      const failures = result.cases.flatMap(test => test.assertions.filter(assertion => !assertion.passed).map(assertion => ({ case: test.name, ...assertion })));
      assert.equal(result.passed, expected, `${label}: ${JSON.stringify(failures)}`);
      if (assertionPattern) assert(result.cases.some(test => test.assertions.some(assertion => !assertion.passed && assertionPattern.test(assertion.label))), `${label}: expected a failure matching ${assertionPattern}`);
      console.log(`PASS ${label}`);
    }
    for (let index = 0; index < 4; index++) await verify(`Reference ${['putc', 'newline', 'puts', 'print_hex16'][index]} passes every varied machine input`, index, null, true);
    await verify('Correct helper passes independently of an invalid exploratory caller', 0, 'invalid-caller', true, 0);
    await verify('Correct helper passes independently of a missing exploratory caller', 0, 'missing-caller', true, 0);
    await verify('Missing helper source has no hidden implementation fallback', 0, 'missing', false, 0);
    await verify('A README explanation cannot replace executable helpers', 0, 'readme', false, 0);
    await verify('Comment-only console source cannot pass', 0, 'comment', false, 0);
    await verify('Correct-looking output in the caller cannot replace the directly tested helper', 0, 'fake-caller', false, 0, /Actual VGA|Memory at/);
    await verify('Hardcoded A fails a different character', 0, 'hardcoded', false, 1, /Actual VGA|Memory at/);
    await verify('A BIOS query without output fails', 0, 'wrong-service', false, 0, /Actual VGA|Memory at/);
    await verify('Omitting INT 10h cannot pass', 0, 'no-bios', false, 0, /Actual VGA|Memory at/);
    await verify('Correct output with lost caller FLAGS fails', 0, 'flags', false, 1, /flag/);
    await verify('Correct output with damaged high EAX bits fails', 0, 'upper-register', false, 0, /EAX/);
    await verify('Correct output with changed DS fails', 0, 'segment', false, 1, /DS/);
    await verify('An incorrect RET stack adjustment fails', 0, 'stack', false, 0, /Stack|ESP/);
    await verify('LF alone fails exact cursor-column checks', 1, 'missing-cr', false, 0, /Memory at 0x450|Memory at 1104/);
    await verify('CR alone fails exact cursor-row checks', 1, 'missing-lf', false, 1, /Memory at 0x450|Memory at 1104/);
    await verify('A string loop that inherits DF=1 fails forward traversal', 2, 'backward-string', false, 3);
    await verify('Correct string output with advanced ESI fails', 2, 'pointer', false, 0, /ESI/);
    await verify('Fixed-length output exposes text after the first zero terminator', 2, 'fixed-string-length', false, 4, /Actual VGA|Memory at/);
    await verify('Lowercase hexadecimal digits fail', 3, 'lowercase', false, 5, /Actual VGA|Memory at/);
    await verify('Dropping a leading hexadecimal zero fails', 3, 'short-hex', false, 0, /Actual VGA|Memory at/);
    await verify('Reversing the nibble traversal fails mixed input', 3, 'reversed-hex', false, 6, /Actual VGA|Memory at/);
    await verify('Printing a fixed zero word fails varied AX', 3, 'constant-hex', false, 7, /Actual VGA|Memory at/);

    // Ordinary Run links the same learner library, without supplied helpers.
    const preview = await page.evaluate(async () => {
      const step = window.guide.steps[3];
      const files = { ...step.reference.files, 'lesson.asm': 'mov ax, 0xBEEF\ncall print_hex16\ncall newline\nmov si, text\ncall puts\n', 'data.inc': 'text: db "OWN HELPERS", 0\n' };
      const source = JSON.stringify(files);
      const built = await window.build(window.prepare(files, 'assembly', undefined, undefined, window.guide));
      if (JSON.stringify(files) !== source) throw new Error('Run changed the learner library');
      const V86 = window.V86 || window.V86Starter;
      window.previewMachine = new V86({ wasm_path: '/course/v86/v86.wasm', memory_size: 32 * 1024 * 1024, vga_memory_size: 2 * 1024 * 1024,
        bios: { url: '/course/v86/seabios.bin' }, vga_bios: { url: '/course/v86/vgabios.bin' }, screen_container: document.getElementById('screen'),
        hda: { buffer: built.disk.buffer }, autostart: true, boot_order: 0x213, disable_keyboard: true, disable_mouse: true });
      return { type: built.type, payloadBytes: built.artifacts['lesson.bin'].length };
    });
    await page.waitForFunction(() => document.getElementById('screen').innerText.includes('OWN HELPERS'), null, { timeout: 120000 });
    const actual = await page.evaluate(() => {
      const memory = (address, length) => Array.from({ length }, (_, index) => window.previewMachine.v86.cpu.read8(address + index));
      return { text: document.getElementById('screen').innerText, cursor: memory(0x450, 2), top: memory(0xb8000, 8), nextRow: memory(0xb80a0, 22) };
    });
    assert.match(actual.text, /BEEF/); assert.deepEqual(actual.cursor, [11, 1]);
    assert.equal(actual.top.filter((_, index) => index % 2 === 0).map(byte => String.fromCharCode(byte)).join(''), 'BEEF');
    assert.equal(actual.nextRow.filter((_, index) => index % 2 === 0).map(byte => String.fromCharCode(byte)).join(''), 'OWN HELPERS');
    assert.equal(preview.type, 'assembly-routine');
    await page.evaluate(async () => { await window.previewMachine.destroy(); });
    report.checks.push({ label: 'Ordinary Run executes the cumulative learner library through BIOS with exact two-row output', preview, actual }); save();
    console.log('PASS Ordinary Run executes all learner helpers without supplied replacements');
    assert.deepEqual(report.errors, []); report.ok = true;
  } catch (error) {
    report.ok = false; report.failure = error.stack; console.error(error); process.exitCode = 1;
  } finally {
    report.finished = new Date().toISOString(); save();
    await browser?.close(); await new Promise(resolve => server.close(resolve));
  }
})();
