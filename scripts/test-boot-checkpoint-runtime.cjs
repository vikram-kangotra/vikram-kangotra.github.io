// Compile and execute the progressive boot path with the shipped browser tools.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const route = decodeURIComponent(new URL(req.url, 'http://local').pathname);
  if (route === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Boot checkpoint tests</title>'); return; }
  let file = path.join(root, route.startsWith('/src/') ? route : '/public' + route);
  if (!path.extname(file) && fs.existsSync(file + '.js')) file += '.js';
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
  const reports = [];
  try {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.evaluate(async () => {
      window.grade = (await import('/src/course/machineGrader.js')).runCheckpointTests;
      window.guide = (await import('/src/course/guidedKernel.js')).guidedKernel;
      window.reference = (await import('/src/course/kernelProject.js')).kernelProjectFiles;
      window.prepare = (await import('/src/course/kernelCheckpointBuild.js')).prepareKernelCheckpointBuild;
      window.build = (await import('/src/course/projectCompiler.js')).buildProject;
    });
    async function verify(label, index, mutation, expected) {
      const report = await page.evaluate(async ({ index, mutation }) => {
        const step = window.guide.steps[index];
        let files = Object.fromEntries(step.tests.requiredFiles.map(file => [file, window.reference[file]]));
        if (mutation === 'readme') files = { 'README.md': 'I understand the entire boot sequence.' };
        if (mutation === 'comment') files[step.filesToCreate[0]] = '; source will go here\n';
        if (mutation === 'prose') files[step.filesToCreate[0]] = 'The BIOS loads this program and starts executing it.';
        if (mutation === 'syntax') files[step.filesToCreate[0]] = 'bits 16\nmov ax,\n';
        if (mutation === 'missing-earlier') delete files['boot/stage1.asm'];
        if (mutation === 'future-draft') for (const file of Object.keys(step.tests.scaffoldFiles)) files[file] = 'invalid future draft';
        if (mutation === 'wrong-runtime') files['kernel/main.c'] = 'void kernel_main(void) {}\n';
        if (mutation === 'broken-stage') {
          const edits = {
            0: ['boot/stage1.asm', 'call read_disk', 'nop'],
            1: ['boot/disk.inc', 'mov ah, 0x42', 'mov ah, 0x41'],
            2: ['boot/stage2.asm', 'or eax, 1', 'and eax, 0xfffffffe'],
            3: ['kernel/entry.asm', 'call kernel_main', 'nop'],
          };
          const [file, before, after] = edits[index]; files[file] = files[file].replace(before, after);
        }
        const saved = JSON.stringify(files);
        const report = await window.grade({ files, guide: { ...window.guide, step } });
        if (JSON.stringify(files) !== saved) throw new Error('Grading changed the learner source');
        return report;
      }, { index, mutation });
      reports.push({ label, ...report });
      assert.equal(report.passed, expected, `${label}: ${JSON.stringify(report)}`);
      console.log(`PASS ${label}`);
    }
    for (let index = 0; index < 8; index++) await verify(`Stage ${index + 1}: learner sources compile and execute`, index, null, true);
    await verify('README alone cannot pass', 0, 'readme', false);
    await verify('Comment-only source cannot pass', 0, 'comment', false);
    await verify('Written explanation in source cannot pass', 0, 'prose', false);
    await verify('Invalid assembly cannot pass', 0, 'syntax', false);
    await verify('Missing earlier implementation cannot use a reference replacement', 2, 'missing-earlier', false);
    await verify('Unfinished future drafts stay isolated and unchanged', 0, 'future-draft', true);
    await verify('Valid C with incorrect behavior fails machine assertions', 4, 'wrong-runtime', false);
    for (let index = 0; index < 4; index++) await verify(`Stage ${index + 1}: buildable broken boot code fails execution`, index, 'broken-stage', false);
    const run = await page.evaluate(async () => {
      const step = window.guide.steps[0];
      const built = await window.build(window.prepare({ 'boot/stage1.asm': window.reference['boot/stage1.asm'] }, step.tests));
      return { type: built.type, artifacts: Object.keys(built.artifacts), signature: [...built.sector.slice(510)] };
    });
    assert.equal(run.type, 'kernel32'); assert.deepEqual(run.signature, [0x55, 0xaa]); assert(run.artifacts.includes('kernel.elf'));
    console.log('PASS ordinary Run produces a native kernel image from the first checkpoint');
    assert.deepEqual(errors, []);
  } finally {
    if (process.env.BOOT_REPORT_PATH) fs.writeFileSync(process.env.BOOT_REPORT_PATH, JSON.stringify(reports, null, 2));
    await browser.close(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
