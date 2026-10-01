// Real browser / native x86 regression. Set PLAYWRIGHT_PATH and CHROME_PATH when
// using existing tools. Default mode checks representative positives and fault
// cases; --all additionally executes every published reference contract.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const types = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.bin': 'application/octet-stream' };
const server = http.createServer((req, res) => {
  const route = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  if (route === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Machine grader tests</title>'); return; }
  let file = route.startsWith('/src/') ? path.join(root, route) : path.join(root, 'public', route);
  if (!path.extname(file) && fs.existsSync(`${file}.js`)) file += '.js';
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
  try {
    const page = await browser.newPage(); const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async () => {
      window.grade = (await import('/src/course/machineGrader.js')).runCheckpointTests;
      window.guides = (await import('/src/course/guidedAssembly.js')).guidedAssemblyBySlug;
      window.kernel = (await import('/src/course/kernelProject.js')).kernelProjectFiles;
      window.kernelTests = (await import('/src/course/checkpointTests.js')).kernelCheckpointTests;
    });
    const run = (slug, index, body, options = {}) => page.evaluate(async ({ slug, index, body, options }) => {
      const step = structuredClone(window.guides[slug].steps[index]); if (options.oneCase) step.tests.cases = step.tests.cases.slice(0, 1);
      return window.grade({ files: { 'lesson.asm': body || step.reference.body, ...(step.reference.data ? { 'data.inc': step.reference.data } : {}) }, guide: { step } });
    }, { slug, index, body, options });
    const verify = (label, report, expected) => { assert.equal(report.passed, expected, `${label}: ${JSON.stringify(report)}`); console.log(`PASS ${label}`); };
    if (!process.argv.includes('--cancel-init-only')) {
    verify('Correct arithmetic across carry, sign, and zero boundaries', await run('assembly-arithmetic', 0), true);
    verify('Hardcoded printed answer fails other inputs', await run('assembly-arithmetic', 0, 'mov ax, 42\ncall print_hex16'), false);
    verify('Wrong carry capture fails the no-carry input', await run('assembly-arithmetic', 1, 'add ax, 1\nmov bl, 1\ncall print_hex16\ncall newline\nmovzx ax, bl\ncall print_hex16'), false);
    const memoryBody = await page.evaluate(() => window.guides['assembly-memory'].steps[2].reference.body);
    verify('Correct memory copy leaves data guards intact', await run('assembly-memory', 2), true);
    verify('Correct screen but omitted memory store fails', await run('assembly-memory', 2, memoryBody.replace('mov [copy], ax', '; store omitted').replace('mov ax, [copy]', 'mov ax, [packet]')), false);
    verify('One-byte data overrun fails the boundary guard', await run('assembly-memory', 2, `${memoryBody}\nmov byte [copy+2], 0`), false);
    verify('Direct BIOS output is captured from VGA', await run('assembly-debugging', 1), true);
    const infiniteRoutine = await run('assembly-loops', 0, '.again: jmp .again', { oneCase: true });
    verify('An infinite loop is a timeout, never a successful boot', infiniteRoutine, false);
    assert.equal(infiniteRoutine.cases[0].assertions[0].label, 'Execution completed within the time limit');
    verify('A lost return address fails execution completion', await run('assembly-stack', 0, 'push ax\ncall print_hex16', { oneCase: true }), false);
    const cancelled = await page.evaluate(async () => {
      const controller = new AbortController(); setTimeout(() => controller.abort(), 10);
      try { await window.grade({ files: { 'lesson.asm': 'ret' }, guide: { step: window.guides['assembly-first-instructions'].steps[0] }, signal: controller.signal }); return 'resolved'; }
      catch (error) { return error.name; }
    });
    assert.equal(cancelled, 'AbortError'); console.log('PASS Cancellation terminates an active compiler worker');
    }
    const initializationAbort = await page.evaluate(async () => {
      if (!window.V86 && !window.V86Starter) await new Promise((resolve, reject) => { const script = document.createElement('script'); script.src = '/course/v86/libv86.js'; script.onload = resolve; script.onerror = reject; document.head.appendChild(script); });
      const Native = window.V86 || window.V86Starter;
      const controller = new AbortController(); let instance; let ready;
      window.V86 = function (options) {
        instance = new Native(options);
        ready = new Promise(resolve => instance.add_listener('emulator-ready', resolve));
        controller.abort(); return instance;
      };
      let name;
      try { await window.grade({ files: { 'lesson.asm': 'ret' }, guide: { step: window.guides['assembly-first-instructions'].steps[0] }, signal: controller.signal }); name = 'resolved'; }
      catch (error) { name = error.name; }
      finally { window.V86 = Native; }
      await ready; await new Promise(resolve => setTimeout(resolve, 100));
      return { name, running: instance.is_running() };
    });
    assert.deepEqual(initializationAbort, { name: 'AbortError', running: false }); console.log('PASS Cancellation while firmware loads cannot leave a running hidden VM');
    if (!process.argv.includes('--cancel-init-only')) {
    // Real firmware may spend most of a ten-second budget before the lesson
    // even starts. Delay an actual VM past that old deadline, then boot the
    // unmodified C reference; this must not consume its execution allowance.
    const delayedStartup = await page.evaluate(async () => {
      const { chapters } = await import('/src/course/index.js');
      const { getCExerciseTests } = await import('/src/course/cExerciseTests.js');
      const exercise = getCExerciseTests(chapters.find(chapter => chapter.slug === 'descriptors-and-interrupts'));
      window.deadlineExercise = exercise;
      const Native = window.V86 || window.V86Starter;
      let requestedAt, startedAt, destroyed = false;
      window.V86 = function (options) {
        const machine = new Native(options);
        const run = machine.run.bind(machine), destroy = machine.destroy.bind(machine);
        let pending;
        machine.run = () => {
          requestedAt = performance.now();
          pending = setTimeout(() => { startedAt = performance.now(); run(); }, 11000);
        };
        machine.destroy = (...args) => { clearTimeout(pending); destroyed = true; return destroy(...args); };
        return machine;
      };
      try {
        const report = await window.grade({ files: { [exercise.file]: exercise.reference }, guide: { step: { tests: exercise.tests } } });
        return { report, delayMs: startedAt - requestedAt, destroyed };
      } finally { window.V86 = Native; }
    });
    verify('A delayed firmware start does not consume the C execution deadline', delayedStartup.report, true);
    assert(delayedStartup.delayMs >= 10500); assert(delayedStartup.destroyed);
    const infiniteFunction = await page.evaluate(() => {
      const exercise = window.deadlineExercise;
      const source = '#include <stdint.h>\nvoid encode_gate(uint8_t out[8], uint32_t handler) { (void)out; (void)handler; for (;;) { __asm__ volatile (""); } }\n';
      return window.grade({ files: { [exercise.file]: source }, guide: { step: { tests: exercise.tests } } });
    });
    verify('A C function that enters but never returns still times out', infiniteFunction, false);
    assert.equal(infiniteFunction.cases[0].assertions[0].label, 'Execution completed within the time limit');
    assert.equal(infiniteFunction.cases[1].assertions[0].label, 'Case reached');
    const missingEntry = await page.evaluate(async () => {
      const Native = window.V86 || window.V86Starter;
      let runningAtDestroy;
      window.V86 = function (options) {
        const machine = new Native(options), destroy = machine.destroy.bind(machine);
        // The VM initializes, but firmware never executes: no entry cookie.
        machine.run = () => {};
        machine.destroy = (...args) => { runningAtDestroy = machine.is_running(); return destroy(...args); };
        return machine;
      };
      try {
        const exercise = window.deadlineExercise;
        const report = await window.grade({ files: { [exercise.file]: exercise.reference }, guide: { step: { tests: exercise.tests } } });
        return { report, runningAtDestroy };
      } finally { window.V86 = Native; }
    });
    verify('Startup without learner entry reports a boot failure instead of an algorithm timeout', missingEntry.report, false);
    assert.equal(missingEntry.report.cases[0].assertions[0].label, 'Boot reached the checkpoint entry within 30 seconds');
    assert.match(missingEntry.report.cases[1].assertions[0].hint, /learner cases have not run/);
    assert.equal(missingEntry.runningAtDestroy, false);
    const kernel = await page.evaluate(() => window.grade({ files: window.kernel, guide: { step: { tests: window.kernelTests } } }));
    verify('Real kernel enters C, returns, and satisfies CPU/VGA/serial assertions', kernel, true);
    const incompleteKernel = await page.evaluate(() => window.grade({ files: { ...window.kernel, 'kernel/main.c': 'void kernel_main(void) { }' }, guide: { step: { tests: window.kernelTests } } }));
    verify('Entering C alone does not satisfy the output contract', incompleteKernel, false);
    if (process.argv.includes('--all')) {
      const locations = await page.evaluate(() => Object.entries(window.guides).flatMap(([slug, guide]) => guide.steps.map((_, index) => ({ slug, index }))));
      for (const { slug, index } of locations) verify(`${slug} checkpoint ${index + 1}`, await run(slug, index), true);
      const exercises = await page.evaluate(async () => {
        const { chapters } = await import('/src/course/index.js'); const { getCExerciseTests } = await import('/src/course/cExerciseTests.js');
        return chapters.map(chapter => ({ slug: chapter.slug, ...getCExerciseTests(chapter) })).filter(exercise => exercise.tests);
      });
      for (const exercise of exercises) {
        const report = await page.evaluate(exercise => window.grade({ files: { [exercise.file]: exercise.reference }, guide: { step: { tests: exercise.tests } } }), exercise);
        verify(`${exercise.slug} C function contract`, report, true);
      }
    }
    }
    assert.deepEqual(errors, []); console.log('PASS No browser runtime exceptions');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
