/* global Uint8Array */
import { useEffect, useRef, useState } from 'react';
import { bootExample } from '@/course/bootAssembler';
import { buildProject } from '@/course/projectCompiler';
import { prepareGuidedBuild, learnerHasCode } from '@/course/guidedBuild';
import { runCheckpointTests } from '@/course/machineGrader';
import { savePlaygroundCopy } from '@/course/playground';
import { assemblyCaseInitialization } from '@/course/machineTestHarness';
import CodeBlock from './CodeBlock';
import RegisterInspector, { RegisterSummary } from './RegisterInspector';
import useCpuRegisters from './useCpuRegisters';
import { FiFileText, FiRotateCcw, FiDownload, FiPlay, FiSquare, FiTerminal, FiCheckCircle, FiCode, FiHelpCircle, FiCpu, FiAlertTriangle, FiExternalLink } from 'react-icons/fi';
import ProjectEditor from './ProjectEditor';
import ProjectGuide from './ProjectGuide';
import useProjectFiles from './useProjectFiles';
import styles from './assembly-workbench.module.css';
import checkStyles from './behavior-checks.module.css';

const challengeExample = bootExample
  .replace('mov ah, 0x0e', 'mov ah, 0x0f ; TODO: choose the BIOS service that prints AL')
  .replace('I booted my own code!', 'OS READY');
const targetMessage = 'OS READY';

let runtimePromise;
function loadRuntime() {
  if (window.V86 || window.V86Starter) return Promise.resolve();
  if (!runtimePromise) runtimePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const timeout = setTimeout(() => finish(new Error('The emulator script did not load within 30 seconds. Reload the page and try again.')), 30000);
    function finish(error) {
      if (settled) return;
      settled = true; clearTimeout(timeout);
      if (error) { runtimePromise = null; script.remove(); reject(error); }
      else resolve();
    }
    script.src = '/course/v86/libv86.js';
    script.onload = () => finish(window.V86 || window.V86Starter ? null : new Error('The emulator script loaded without its runtime. Reload the page and try again.'));
    script.onerror = () => finish(new Error('The emulator runtime could not load. Retry or download the QEMU project.'));
    document.head.appendChild(script);
  });
  return runtimePromise;
}
function dumpBytes(bytes) {
  const rows = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const row = bytes.slice(offset, offset + 16);
    rows.push(`${(0x7c00 + offset).toString(16).padStart(4, '0')}  ${Array.from(row, (value) => value.toString(16).padStart(2, '0')).join(' ').padEnd(47)}  ${Array.from(row, (value) => value >= 32 && value < 127 ? String.fromCharCode(value) : '.').join('')}`);
  }
  return rows.join('\n');
}
function messageAddress(bytes) {
  const target = [...targetMessage].map((character) => character.charCodeAt(0)).concat(0);
  const matches = [];
  for (let offset = 0; offset <= bytes.length - target.length; offset += 1) {
    if (target.every((byte, index) => bytes[offset + index] === byte)) matches.push(0x7c00 + offset);
  }
  return matches.length === 1 ? matches[0] : null;
}

export default function BootMachine({ chapterSlug = 'bootloading', onSolved, onInvalidate, onSourceChange, exercise, challengeEnabled = false, guided, playground }) {
  const exampleSource = exercise?.example || bootExample;
  const challengeSource = exercise?.starter || challengeExample;
  const expectedText = guided?.step?.expectedOutput || exercise?.expectedOutput || targetMessage;
  const isGuided = Boolean(guided);
  const isPlayground = Boolean(playground);
  const isCExercise = guided?.step?.tests?.kind === 'c-function';
  const canRunCheckpoint = !guided || (guided.ready && guided.step.runnable !== false);
  const entryPath = guided?.kind === 'assembly' ? 'lesson.asm' : guided ? guided.file || 'README.md' : null;
  const screen = useRef(null);
  const outputTabs = useRef({});
  const emulator = useRef(null);
  const generation = useRef(0);
  const timer = useRef(null);
  const compiler = useRef(null);
  const grader = useRef(null);
  const submission = useRef(null);
  const pendingBoot = useRef(null);
  const activity = useRef({});
  const guideRef = useRef(guided);
  guideRef.current = guided;
  const mounted = useRef(false);
  const activeRun = useRef(null);
  const sourceRevision = useRef(0);
  const sourceRef = useRef(exampleSource);
  const callbacks = useRef({ onSolved, onInvalidate, onSourceChange });
  callbacks.current = { onSolved, onInvalidate, onSourceChange };
  const [status, setStatus] = useState(guided ? 'Read this section, then write and test its checkpoint.' : 'Ready. Build your project and boot it on the x86 machine.');
  const [feedback, setFeedback] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [inspectionMachine, setInspectionMachine] = useState(null);
  const [inspectionRevision, setInspectionRevision] = useState(null);
  const [inspectionSource, setInspectionSource] = useState('');
  const [paused, setPaused] = useState(false);
  const [pauseBusy, setPauseBusy] = useState(false);
  const pausePending = useRef(false);
  const registers = useCpuRegisters(inspectionMachine);
  const [stopping, setStopping] = useState(false);
  const [serial, setSerial] = useState('');
  const [hex, setHex] = useState('');
  const [diagnostics, setDiagnostics] = useState([]);
  const [hint, setHint] = useState(0);
  const [error, setError] = useState(false);
  const [buildLog, setBuildLog] = useState([]);
  const [artifacts, setArtifacts] = useState({});
  const [revealLocation, setRevealLocation] = useState(null);
  const [referenceVisible, setReferenceVisible] = useState(false);
  const [testReport, setTestReport] = useState(null);
  const [previewReport, setPreviewReport] = useState(null);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const importInput = useRef(null);
  const [outputTab, setOutputTab] = useState(isGuided ? 'check' : 'machine');
  const [toolsOpen, setToolsOpen] = useState(!isGuided);
  const [hasBooted, setHasBooted] = useState(false);
  const [blankDisplay, setBlankDisplay] = useState(false);
  const project = useProjectFiles({ chapterSlug, exampleSource, challengeSource, challengeEnabled, guided, playground,
    onMutate: (files, mode) => {
      sourceRevision.current += 1;
      sourceRef.current = files[entryPath || 'boot.asm'] || '';
      setHex(''); setArtifacts({}); setDiagnostics([]); invalidate();
      if (guided) callbacks.current.onSourceChange?.(JSON.stringify(files));
      else if (mode !== 'kernel') callbacks.current.onSourceChange?.(files['boot.asm'] || '');
      if (activeRun.current) setStatus(guided ? 'Project changed. Run to experiment, or Submit to check this version.' : 'Project changed. Build & run again to test this version.');
    },
  });
  const { mode: example, loaded: restored } = project;
  const routineMode = guided?.kind === 'assembly' || (playground && example === 'example');
  const currentEntryPath = routineMode ? 'lesson.asm' : entryPath || (example === 'kernel' ? 'kernel/main.c' : 'boot.asm');
  sourceRef.current = project.files[entryPath || 'boot.asm'] || '';
  const hasWritten = guided?.kind === 'assembly'
    ? learnerHasCode({ 'lesson.asm': project.files['lesson.asm'] || '' })
    : learnerHasCode(project.files) || (guided && JSON.stringify(project.files) !== JSON.stringify(guided.initialFiles));
  useEffect(() => { if (restored) setOutputTab(isGuided || (!isPlayground && example === 'challenge') ? 'check' : 'machine'); }, [restored, example, isGuided, isPlayground]);
  useEffect(() => {
    guideRef.current?.onBusyChange?.(Boolean(busy || testing || submitting || stopping || Object.keys(activity.current).length || submission.current || grader.current || compiler.current || pendingBoot.current));
  }, [busy, testing, submitting, stopping]);
  useEffect(() => {
    if (!guided) return;
    cancelSubmission();
    grader.current?.abort(); grader.current = null; setTesting(false); setTestReport(null); setPreviewReport(null);
    delete activity.current.test; publishActivity();
    setReferenceVisible(false); setFeedback(''); setVerified(false); setHint(0);
    setOutputTab('check');
    setToolsOpen(false);
    // The guide may change as progress saves; only entering another checkpoint resets its UI.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guided?.stepIndex, guided?.ready]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; generation.current += 1; clearTimeout(timer.current);
      submission.current?.abort(); submission.current = null; finishBoot(false);
      compiler.current?.abort();
      grader.current?.abort();
      activity.current = {};
      const machine = emulator.current; emulator.current = null;
      if (machine) Promise.resolve(machine.destroy()).catch(() => {});
      guideRef.current?.onBusyChange?.(false);
    };
  }, []);
  useEffect(() => {
    if (!running || !hasBooted) { setBlankDisplay(false); return; }
    let emptySince = Date.now();
    const interval = setInterval(() => {
      const display = screen.current?.firstElementChild;
      const textMode = display && display.style.display !== 'none';
      const hasText = !!display?.textContent.trim();
      if (!textMode || hasText) emptySince = Date.now();
      setBlankDisplay(!!textMode && !hasText && Date.now() - emptySince >= 4000);
    }, 500);
    return () => clearInterval(interval);
  }, [running, hasBooted]);
  function finishBoot(success) {
    const waiting = pendingBoot.current;
    pendingBoot.current = null;
    waiting?.resolve(success);
  }
  function publishActivity() {
    if (mounted.current) guideRef.current?.onBusyChange?.(Boolean(Object.keys(activity.current).length || submission.current || grader.current || compiler.current || pendingBoot.current));
  }
  function startActivity(kind) {
    const token = {};
    activity.current[kind] = token;
    guideRef.current?.onBusyChange?.(true);
    return token;
  }
  function finishActivity(kind, token) {
    // An aborted operation can settle after a replacement has already started.
    if (activity.current[kind] !== token) return;
    delete activity.current[kind];
    publishActivity();
  }
  function cancelSubmission() {
    if (!submission.current) return;
    submission.current.abort(); submission.current = null;
    generation.current += 1;
    compiler.current?.abort(); compiler.current = null;
    delete activity.current.submit; delete activity.current.compile;
    clearTimeout(timer.current); finishBoot(false); activeRun.current = null;
    const machine = emulator.current; emulator.current = null;
    if (machine) Promise.resolve(machine.destroy()).catch(() => {});
    if (mounted.current) {
      setSubmitting(false); setBusy(false); setRunning(false); setInspectionMachine(null);
      setStatus('Submission cancelled. Submit again when your edits are ready.');
    }
  }
  function currentSubmission(controller) {
    return mounted.current && submission.current === controller && !controller.signal.aborted
      && controller.revision === sourceRevision.current && controller.checkpoint === guideRef.current?.stepIndex
      && guideRef.current?.ready;
  }
  function invalidate({ preserveSubmission } = {}) {
    if (submission.current !== preserveSubmission) cancelSubmission();
    grader.current?.abort(); grader.current = null; setTesting(false); setPreviewReport(null);
    delete activity.current.test; publishActivity();
    setTestReport(null);
    setVerified(false); setFeedback('');
    if (guided || challengeEnabled) callbacks.current.onInvalidate?.();
  }
  function finishTestReport(report) {
    setVerified(report.passed);
    setFeedback(report.passed ? 'Checkpoint passed. Continue the lesson when you are ready.' : 'Your code did not pass all machine cases. Inspect the failed checks and try again.');
    if (report.passed) { guided.onPassed?.(); guided.onBoot?.(); }
    else callbacks.current.onInvalidate?.();
  }
  function chooseExample(name) {
    project.selectMode(name); setHint(0); setRevealLocation(null);
    setOutputTab(!isPlayground && name === 'challenge' ? 'check' : 'machine');
    setStatus(name === 'kernel' ? 'C kernel project loaded. The first build downloads Clang and LLD (~50 MB); progress appears in Build.' : playground ? 'Your saved project is ready. Edit its files, then build and run.' : name === 'challenge' ? 'Challenge draft loaded. Compare its output with the task and repair the program.' : 'Example draft loaded. Build & run to boot this version.');
  }
  function download(contents, name, type = 'application/octet-stream') {
    const url = URL.createObjectURL(new Blob([contents], { type }));
    const link = document.createElement('a'); link.href = url; link.download = name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportProject() {
    download(JSON.stringify({ version: 1, files: project.filesRef.current }, null, 2), `${chapterSlug}-${example}-project.json`, 'application/json');
  }
  function downloadBinary() {
    const name = ['kernel.bin', 'boot.bin', 'boot-sector.bin', 'os.img', 'disk.img'].find(path => artifacts[path]) || Object.keys(artifacts).find(path => /\.(bin|img)$/.test(path));
    if (name) download(artifacts[name], name);
  }
  function openPlayground() {
    try {
      const files = { ...project.filesRef.current };
      let setupFile;
      if (guided?.kind === 'assembly' && guided.step.tests?.cases?.[0]?.input) {
        const initialization = assemblyCaseInitialization(guided.step.tests.cases[0].input);
        if (initialization) {
          setupFile = 'playground-inputs.inc';
          let suffix = 1;
          while (Object.hasOwn(files, setupFile)) setupFile = `playground-inputs-${suffix++}.inc`;
          files[setupFile] = `; Inputs copied from the checkpoint's first test case.\n; Edit these to try a different input before lesson.asm runs.\n${initialization}\n`;
        }
      }
      const url = savePlaygroundCopy(files, guided?.kind || (example === 'kernel' ? 'kernel' : 'boot-sector'), { activeFile: project.activeFile, title: chapterSlug.replace(/-/g, ' '), setupFile });
      window.location.assign(url);
    } catch (caught) { setError(true); setStatus(`Could not copy your files: ${caught.message}. Export the project to keep your work.`); }
  }
  async function importProject(event) {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('Choose a project JSON file smaller than 2 MiB.');
      const data = JSON.parse(await file.text());
      if (data.version !== 1) throw new Error('Choose an exported version 1 course project.');
      project.importFiles(data.files); setError(false);
      setStatus('Project imported. Build & run to test it; Undo project change restores your previous files.');
    } catch (caught) { setError(true); setStatus(`Import error: ${caught.message}`); }
  }
  function locationFor(line) {
    for (const path of Object.keys(project.files).sort((a, b) => b.length - a.length)) {
      const at = line.indexOf(`${path}:`);
      if (at < 0) continue;
      const match = line.slice(at + path.length + 1).match(/^(\d+)(?::(\d+))?/);
      if (match) return { path, line: Number(match[1]), column: Number(match[2] || 1) };
    }
    return null;
  }
  function openDiagnostic(location) {
    project.selectFile(location.path);
    setRevealLocation({ ...location, nonce: Date.now() });
  }
  function openProblemFile(path) {
    try {
      if (Object.hasOwn(project.filesRef.current, path)) project.selectFile(path);
      else project.createFile(path);
    } catch (caught) { setStatus(`Could not open file: ${caught.message}`); }
  }
  function begin(message, submissionController) {
    guideRef.current?.onBusyChange?.(true);
    finishBoot(false);
    const id = ++generation.current;
    compiler.current?.abort(); compiler.current = null;
    clearTimeout(timer.current); activeRun.current = null;
    setInspectionMachine(null); setInspectionRevision(null); setInspectionSource(''); registers.reset();
    setPaused(false); setPauseBusy(false); pausePending.current = false;
    setToolsOpen(true); setOutputTab('machine'); setHasBooted(false); setBlankDisplay(false);
    if (document.activeElement?.closest('[role=tabpanel][id^=assembly-panel-]')) requestAnimationFrame(() => outputTabs.current.machine?.focus());
    setBusy(true); setRunning(false); setSerial(''); setStatus(message); setError(false); setDiagnostics([]); invalidate({ preserveSubmission: submissionController });
    return id;
  }
  function current(id) { return mounted.current && id === generation.current; }
  async function disposeMachine() {
    const previous = emulator.current;
    emulator.current = null;
    setInspectionMachine(null);
    if (previous) await previous.destroy();
  }
  async function boot(buffer, name, id, run) {
    if (!current(id)) return false;
    setStatus('Loading the x86 emulator and firmware…');
    await loadRuntime();
    if (!current(id)) return false;
    if (screen.current?.firstElementChild) screen.current.firstElementChild.textContent = '';
    setHasBooted(true); setToolsOpen(true); setOutputTab('machine');
    return new Promise((resolve) => {
      pendingBoot.current = { id, resolve };
      const V86 = window.V86 || window.V86Starter;
      const machine = new V86({
        wasm_path: '/course/v86/v86.wasm', memory_size: 32 * 1024 * 1024,
        vga_memory_size: 2 * 1024 * 1024, screen_container: screen.current,
        bios: { url: '/course/v86/seabios.bin' },
        vga_bios: { url: '/course/v86/vgabios.bin' },
        hda: { buffer }, autostart: true, boot_order: 0x213,
        disable_keyboard: !playground, disable_mouse: true, disable_speaker: true,
      });
      emulator.current = machine;
      if (playground) machine.keyboard_set_status(false);
      activeRun.current = { ...run, generation: id, ready: false };
      machine.add_listener('emulator-ready', () => {
        if (!current(id)) return;
        clearTimeout(timer.current); activeRun.current.ready = true;
        // The keyboard adapter is created asynchronously, after the constructor.
        // Activate it only when the guest screen owns focus, never for editor input.
        machine.keyboard_set_status(Boolean(playground && screen.current?.contains(document.activeElement)));
        setBusy(false); setRunning(true);
        setInspectionMachine(machine); setInspectionRevision(run.revision ?? null); setPaused(false);
        setInspectionSource(run.kind === 'image' ? name : '');
        setStatus(run.kind !== 'image' && run.revision !== sourceRevision.current
          ? guided ? 'The running preview uses older files. Run or Submit again to use your current code.' : 'The submitted project is running, but files have changed. Build & run again to test your current project.'
          : `${name} is running. Watch the VGA display as the BIOS boots your code.`);
        if (pendingBoot.current?.id === id) finishBoot(true);
      });
      machine.add_listener('serial0-output-byte', (byte) => {
        if (current(id)) setSerial((text) => (text + String.fromCharCode(byte)).slice(-6000));
      });
      timer.current = setTimeout(() => {
        if (current(id)) {
          generation.current += 1; activeRun.current = null;
          Promise.resolve(machine.destroy()).catch(() => {}); emulator.current = null;
          setBusy(false); setRunning(false); setError(true);
          setStatus('The emulator did not become ready within 30 seconds. Retry, or use the downloadable QEMU project.');
          if (pendingBoot.current?.id === id) finishBoot(false);
        }
      }, 30000);
    });
  }
  function fail(id, message) {
    if (current(id)) { clearTimeout(timer.current); finishBoot(false); setBusy(false); setRunning(false); setError(true); setStatus(message); }
  }
  async function compile({ submissionController } = {}) {
    if (!canRunCheckpoint) return null;
    if (guided && !hasWritten) {
      const message = 'Write your checkpoint code first. Your program starts with your own instructions.';
      setError(true); setStatus(message);
      if (submissionController) { setFeedback(message); setOutputTab('check'); }
      return null;
    }
    guided?.onAttempt?.();
    const submittedFiles = { ...project.filesRef.current };
    const submittedSource = submittedFiles[entryPath || 'boot.asm'] || '';
    const revision = sourceRevision.current;
    const activityToken = startActivity('compile');
    const id = begin('Preparing the project build…', submissionController);
    setBuildLog([]); setArtifacts({}); setHex(''); setOutputTab('build');
    let buildController;
    try {
      await disposeMachine();
      if (!current(id)) return;
      buildController = new AbortController(); compiler.current = buildController;
      const setupFile = playground?.setupFile || Object.keys(submittedFiles).find(path => /^playground-inputs(?:-\d+)?\.inc$/.test(path));
      const buildFiles = guided ? prepareGuidedBuild(submittedFiles, guided.kind, guided.step.tests?.cases?.[0]?.input) : routineMode ? prepareGuidedBuild(submittedFiles, 'assembly', undefined, setupFile) : submittedFiles;
      const result = await buildProject(buildFiles, { signal: buildController.signal,
        onProgress: ({ message }) => {
          if (!current(id)) return;
          setStatus(message);
          setBuildLog((previous) => previous[previous.length - 1] === message ? previous : [...previous.slice(-199), message]);
        },
      });
      if (compiler.current === buildController) compiler.current = null;
      if (!current(id)) return;
      setBuildLog([...result.log, ...result.diagnostics]);
      if (revision === sourceRevision.current) { setHex(dumpBytes(result.sector)); setDiagnostics(result.diagnostics); setArtifacts(result.artifacts); }
      const ready = await boot(result.disk.buffer, result.type === 'kernel32' ? 'Your C kernel' : 'Your assembly', id, {
        kind: result.type === 'boot-sector' ? 'assembly' : 'project', source: submittedSource, revision, sector: result.sector, checkpoint: guided?.stepIndex,
      });
      if (!ready && submissionController && currentSubmission(submissionController)) {
        setOutputTab('check'); setFeedback('The preview machine could not start. Inspect the build output, then Submit again.');
      }
      return ready ? { generation: id, revision, checkpoint: guided?.stepIndex } : null;
    } catch (caught) {
      if (!current(id)) return;
      setBuildLog([...(caught.log || []), ...(caught.diagnostics || []), caught.message]);
      fail(id, `Build / boot error: ${caught.message}`);
      if (submissionController) { setOutputTab('check'); setFeedback(`Submission could not build or boot: ${caught.message}`); }
      else setOutputTab('build');
      return null;
    } finally {
      if (compiler.current === buildController) compiler.current = null;
      finishActivity('compile', activityToken);
    }
  }
  async function stop() {
    if (stopping || activity.current.stop) return;
    const activityToken = startActivity('stop');
    cancelSubmission(); finishBoot(false);
    const id = ++generation.current;
    compiler.current?.abort(); compiler.current = null;
    grader.current?.abort(); grader.current = null; setTesting(false);
    delete activity.current.compile; delete activity.current.test;
    clearTimeout(timer.current); activeRun.current = null;
    setStopping(true); setBusy(false); setRunning(false);
    setPaused(false); setPauseBusy(false); pausePending.current = false;
    let failure;
    try {
      const machine = emulator.current;
      try {
        if (machine) {
          await machine.stop();
          if (current(id)) registers.sample(machine);
        }
      } finally { await disposeMachine(); }
    }
    catch (caught) { failure = caught; }
    finally {
      if (current(id)) {
        setStopping(false);
        if (failure) setError(true);
        setStatus(failure ? `Machine shutdown reported an error: ${failure.message}` : 'Machine powered off. Your source and last register sample are preserved.');
      }
      finishActivity('stop', activityToken);
    }
  }
  async function togglePause() {
    const machine = emulator.current;
    const id = generation.current;
    if (!machine || !running || busy || stopping || pausePending.current) return;
    pausePending.current = true; setPauseBusy(true);
    try {
      if (paused) await machine.run();
      else await machine.stop();
      if (!current(id) || emulator.current !== machine) return;
      registers.sample(machine);
      setPaused(!paused);
      setStatus(paused ? 'Machine resumed. Registers show samples of the running CPU.' : 'Machine paused. Inspect its registers, then Resume to continue this run.');
    } catch (caught) {
      if (current(id)) setStatus(`Could not ${paused ? 'resume' : 'pause'} the machine: ${caught.message}`);
    } finally {
      if (current(id)) { setPauseBusy(false); pausePending.current = false; }
    }
  }
  async function bootKernel() {
    const id = begin('Loading the tested two-stage C kernel…');
    try {
      await disposeMachine();
      if (!current(id)) return;
      const response = await fetch('/course/module-1.img');
      if (!response.ok) throw new Error(`Image request failed (${response.status})`);
      const buffer = await response.arrayBuffer();
      if (current(id)) await boot(buffer, 'Module 1 C kernel', id, { kind: 'image' });
    } catch (caught) { fail(id, `Image error: ${caught.message}`); }
  }
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size < 512 || file.size > 32 * 1024 * 1024 || file.size % 512) {
      setError(true); setStatus('Choose a raw BIOS image between 512 bytes and 32 MiB, with a whole number of 512-byte sectors.'); return;
    }
    const id = begin('Reading your disk image…');
    try {
      await disposeMachine();
      if (!current(id)) return;
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (bytes[510] !== 0x55 || bytes[511] !== 0xaa) throw new Error('The first sector has no 55 aa signature.');
      if (current(id)) await boot(buffer, file.name, id, { kind: 'image' });
    } catch (caught) { fail(id, `Image error: ${caught.message}`); }
  }
  async function testBehavior({ preview = false, submissionController } = {}) {
    if (!guided?.ready || !guided.step.tests || testing || grader.current) return;
    const activityToken = startActivity('test');
    setToolsOpen(true); setOutputTab('check');
    guided.onAttempt?.();
    const controller = new AbortController(); grader.current = controller;
    const revision = sourceRevision.current;
    const checkpoint = guided.stepIndex;
    const abort = () => controller.abort();
    submissionController?.signal.addEventListener('abort', abort, { once: true });
    const testGuide = preview ? { ...guided, step: { ...guided.step, tests: { ...guided.step.tests, cases: guided.step.tests.cases.slice(0, 1) } } } : guided;
    setTesting(true); setVerified(false); setTestReport(null); setPreviewReport(null);
    setError(false); setFeedback(preview ? 'Running the first sample case on x86. This does not submit the checkpoint.' : 'Building and testing your submission on x86…');
    setStatus(preview ? 'Running one C sample case…' : 'Checking your submission…');
    try {
      const report = await runCheckpointTests({ files: { ...project.filesRef.current }, guide: testGuide, signal: controller.signal,
        onProgress: value => { if (!controller.signal.aborted && mounted.current) setFeedback(typeof value === 'string' ? value : value.message || 'Testing your program…'); },
      });
      if (controller.signal.aborted || grader.current !== controller || !mounted.current || revision !== sourceRevision.current || checkpoint !== guideRef.current?.stepIndex || !guideRef.current?.ready || (submissionController && !currentSubmission(submissionController))) return;
      if (preview) {
        setPreviewReport(report); setFeedback('');
        setStatus(report.passed ? 'Sample run complete. Submit to check every case and complete the checkpoint.' : 'The sample needs attention. Inspect its result before submitting.');
      } else {
        setTestReport({ ...report, sourceRevision: revision, checkpoint });
        finishTestReport(report);
        setStatus('Submission checked. See the code test results in Check.');
      }
    } catch (caught) {
      if (!controller.signal.aborted && mounted.current) {
        setFeedback(`${preview ? 'Sample run' : 'Submission'} could not finish: ${caught.message}`);
        setError(true); setStatus(caught.message);
      }
    } finally {
      submissionController?.signal.removeEventListener('abort', abort);
      if (grader.current === controller) { grader.current = null; setTesting(false); }
      finishActivity('test', activityToken);
    }
  }
  async function runSample() {
    if (!canRunCheckpoint || !restored || busy || testing || stopping || Object.keys(activity.current).length || submission.current || grader.current) return;
    if (isCExercise) { invalidate(); await testBehavior({ preview: true }); }
    else await compile();
  }
  async function submitCheckpoint() {
    if (!guided?.ready || !restored || busy || testing || stopping || Object.keys(activity.current).length || submission.current || grader.current) return;
    if (guided.step.runnable === false) { setOutputTab('check'); reviewStage(); return; }
    invalidate();
    const activityToken = startActivity('submit');
    const controller = new AbortController();
    controller.revision = sourceRevision.current;
    controller.checkpoint = guided.stepIndex;
    submission.current = controller; setSubmitting(true);
    setToolsOpen(true); setOutputTab('check');
    try {
      // The visible preview is useful for assembly and a complete kernel. The
      // grader separately builds/boots each case and waits for learner execution.
      // A C function uses the supplied test kernel, not an incomplete project.
      if (!isCExercise) {
        const built = await compile({ submissionController: controller });
        if (!built || !currentSubmission(controller)) return;
      }
      if (!currentSubmission(controller)) return;
      if (!guided.step.tests) { setOutputTab('check'); setFeedback('This checkpoint has no automated test contract. Inspect its stated requirements before continuing.'); return; }
      await testBehavior({ submissionController: controller });
    } finally {
      if (submission.current === controller) { submission.current = null; setSubmitting(false); }
      finishActivity('submit', activityToken);
    }
  }
  function skipCheckpoint() {
    if (busy || testing || stopping || submitting || Object.keys(activity.current).length || submission.current || grader.current || compiler.current || pendingBoot.current || guided?.passed || guided?.skipped) return;
    cancelSubmission(); grader.current?.abort(); grader.current = null;
    guided?.onSkip?.();
  }
  function verify() {
    // Guided checkpoints are assessed exclusively by Submit's machine tests.
    if (guided || testing) return;
    const run = activeRun.current;
    setVerified(false);
    if (!run || run.kind !== 'assembly' || !run.ready || run.generation !== generation.current || !running) {
      setFeedback('Run your assembly and wait for its display before checking. A prebuilt kernel or uploaded image is not your submitted assembly.'); return;
    }
    if (run.source !== sourceRef.current || run.revision !== sourceRevision.current) { setFeedback('Your source has changed since this boot. Build & run again before checking.'); return; }
    const display = screen.current?.firstElementChild;
    const actual = display?.textContent.replace(/\s+/g, ' ').trim() || '';
    if (display?.style.display === 'none' || actual !== expectedText.replace(/\s+/g, ' ').trim()) {
      setFeedback(`The running machine has not displayed exactly “${expectedText}” on an otherwise clear text screen. Wait for boot to finish, then trace the instructions against the task. The check reads the real VGA display.`); return;
    }
    if (!exercise && messageAddress(run.sector) === null) {
      setFeedback('For this exercise, store exactly one null-terminated OS READY string in the assembled boot sector.'); return;
    }
    setVerified(true); setFeedback(`Verified on the x86 machine: the VGA output matches “${expectedText}”.`);
    callbacks.current.onSolved?.({ type: 'assembly-v1' });
  }
  function reviewStage() {
    if (!guided?.ready) return;
    const missing = (guided.step.filesToCreate || []).filter(path => !project.files[path]?.trim() || (/\.md$/i.test(path) ? project.files[path] === guided.initialFiles[path] : !learnerHasCode({ [path]: project.files[path] })));
    if (!hasWritten || missing.length) { setFeedback(missing.length ? `Write these files first: ${missing.join(', ')}.` : 'Write your own notes or implementation before reviewing this stage.'); return; }
    guided.onAttempt?.();
    setVerified(true); setFeedback('Draft recorded. Your files have not been compiled or tested. This stage is not bootable on its own; submit the connected project at the build checkpoint to check it on x86.'); guided.onPassed?.();
  }
  const hints = guided?.step?.hints || exercise?.hints || [
    'INT 0x10 selects a BIOS video service using AH. The starter asks for the current video mode; querying it does not print AL.',
    'The teletype output service uses AH = 0x0e. Keep AL as the character loaded by LODSB, and initialize BH to the display page.',
    'The BIOS loads the sector at physical 0x7c00. In the emitted-byte view, locate the ASCII message in the right column; each row is labelled with its loaded physical address. Count bytes across the row to its first O.',
  ];
  const runtimePanels = [
    { id: 'machine', label: 'Machine', Icon: FiTerminal },
    { id: 'registers', label: 'Registers', Icon: FiCpu },
    { id: 'build', label: 'Build', Icon: FiCode },
    ...(!playground && !isGuided ? [{ id: 'check', label: 'Check', Icon: FiCheckCircle }] : []),
    { id: 'bytes', label: 'Bytes', Icon: FiCode },
    { id: 'help', label: 'Help', Icon: FiHelpCircle },
  ];
  const panels = isGuided
    ? [{ id: 'check', label: 'Check', Icon: FiCheckCircle }, ...(toolsOpen ? runtimePanels : [])]
    : runtimePanels;
  const registerPhase = busy ? 'starting' : running ? paused ? 'paused' : 'running' : registers.snapshot ? 'stopped' : 'idle';
  const registerStale = inspectionRevision !== null && inspectionRevision !== sourceRevision.current;
  function inspectRegisters() {
    setToolsOpen(true); setOutputTab('registers');
    requestAnimationFrame(() => outputTabs.current.registers?.focus());
  }
  function outputKey(event, id) {
    const index = panels.findIndex((panel) => panel.id === id);
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % panels.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + panels.length) % panels.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = panels.length - 1;
    else return;
    event.preventDefault();
    setOutputTab(panels[next].id); outputTabs.current[panels[next].id]?.focus();
  }
  return <div className={styles.workbench} data-playground={playground ? 'true' : undefined} data-guided={isGuided ? 'true' : undefined} data-tools-open={isGuided ? toolsOpen : undefined} data-output-tab={outputTab}>
    <div className={styles.editorHeader}>
      <span className={styles.filename}><FiFileText aria-hidden="true" /><span>{guided ? `Checkpoint ${guided.stepIndex + 1} of ${guided.stepCount}` : playground ? 'Your playground' : 'Project'}</span></span>
      {!guided && <select className={styles.examplePicker} aria-label="Project" value={example} disabled={!restored || busy || stopping || testing} onChange={(event) => chooseExample(event.target.value)}><option value="example">{playground ? 'Assembly routine' : 'Assembly example'}</option>{(challengeEnabled || playground) && <option value="challenge">{playground ? 'Boot sector' : 'Debug challenge'}</option>}<option value="kernel">C kernel project</option></select>}
      <span className={styles.compilerBadge}>{guided?.kind === 'assembly' ? 'NASM · x86' : example === 'kernel' ? 'C + NASM · i386' : 'NASM · x86'}</span>
      <div className={styles.headerActions}>
        {project.undoAvailable && <button type="button" aria-label="Undo project change" title="Undo the last delete, reset, or import" disabled={busy || stopping} onClick={project.undoChange}>↶</button>}
        {guided && <button type="button" aria-label="Open a copy in playground" title="Experiment with an independent copy of these files" disabled={!restored} onClick={openPlayground}><FiExternalLink aria-hidden="true" /></button>}
        <button type="button" aria-label="Reset project" title="Restore this project's starting files (can be undone)" disabled={!restored || busy || stopping} onClick={() => { project.reset(); setHint(0); }}><FiRotateCcw aria-hidden="true" /></button>
        <button type="button" aria-label="Export project" title="Download all source files as project JSON" disabled={!restored} onClick={exportProject}><FiDownload aria-hidden="true" /></button>
      </div>
    </div>
    {playground && <ProjectGuide mode={example} onFile={(path) => { if (Object.hasOwn(project.files, path)) project.selectFile(path); else setStatus('This saved draft has no README.md. Open a fresh starter for the complete project walkthrough.'); }} />}
    {!project.storageAvailable && <p className={styles.storageWarning} role="status">Browser storage is unavailable. Export your project to keep your work.</p>}
    {project.storageConflict && example === 'kernel' && <div className={styles.storageWarning} role="status">Another tab changed the saved C project. Your draft is preserved here. <button type="button" onClick={exportProject}>Export this draft</button> <button type="button" disabled={busy || stopping} onClick={project.reloadKernel}>Load latest saved project</button></div>}
    <div className={styles.editorArea}>
      <ProjectEditor key={example} projectMode={example} files={project.files} activeFile={project.activeFile} onSelectFile={project.selectFile} onEditFile={project.editFile} onCreateFile={project.createFile} onRenameFile={project.renameFile} onDeleteFile={project.deleteFile} startAt={!guided && exercise && example !== 'kernel' ? 'lesson:' : undefined} entryPath={currentEntryPath} revealLocation={revealLocation} disabled={!restored || busy || stopping || submitting} onRun={runSample} />
    </div>
    <div className={styles.actionBar}>
      <div className={styles.actions}>
        {(!guided || guided.step.runnable !== false) && <button className={`${styles.run} ${guided ? styles.sampleRun : ''}`} type="button" disabled={!restored || busy || stopping || testing || submitting || !canRunCheckpoint} onClick={runSample} title={guided ? 'Run an experiment without submitting this checkpoint' : undefined}><FiPlay aria-hidden="true" />{guided ? 'Run' : busy ? 'Building / booting…' : 'Build & run'}</button>}
        {guided && <button className={styles.submit} type="button" disabled={!restored || busy || stopping || testing || submitting || !guided.ready} aria-busy={submitting} onClick={submitCheckpoint} title={guided.step.runnable === false ? 'Record your draft without compiling or testing it' : 'Build, run, and check this checkpoint'}><FiCheckCircle aria-hidden="true" />Submit</button>}
        {(!guided || busy || running || testing || stopping || submitting) && <button className={styles.stop} type="button" disabled={stopping || (!busy && !running && !testing && !submitting)} onClick={stop}><FiSquare aria-hidden="true" />{stopping ? 'Stopping…' : 'Stop'}</button>}
        {playground && <button className={styles.stop} type="button" disabled={!Object.keys(artifacts).length} onClick={downloadBinary}><FiDownload aria-hidden="true" />Download binary</button>}
        {(!guided || guided.step.runnable !== false) && <span className={styles.shortcut}>Ctrl / ⌘ + Enter</span>}
        <span className={styles.saved}>{project.storageConflict && example === 'kernel' ? 'Separate draft saved' : project.storageAvailable ? 'Saved in browser' : 'Export to save'}</span>
      </div>
      {guided && !guided.ready && <p className={styles.checkpointNote}>Open this section’s coding checkpoint to enable its controls.</p>}
      <p className={`${styles.status} ${error ? styles.error : ''}`} role="status" title={status}><span className={styles.statusDot} data-state={error ? 'error' : busy || testing || submitting ? 'busy' : running ? 'running' : 'idle'} /><span className={styles.statusText}>{status}</span></p>
    </div>
    <div className={styles.console}>
      <div className={styles.consoleHeader}>
      <div className={styles.outputTabs} role="tablist" aria-label="Build and machine output">
        {panels.map(({ id, label, Icon }) => <button key={id} id={`assembly-tab-${id}`} ref={(node) => { outputTabs.current[id] = node; }} type="button" role="tab" aria-controls={`assembly-panel-${id}`} aria-selected={outputTab === id} tabIndex={outputTab === id ? 0 : -1} onClick={() => setOutputTab(id)} onKeyDown={(event) => outputKey(event, id)}><Icon aria-hidden="true" />{label}{id === 'check' && verified && <span className={styles.verifiedDot} role="img" aria-label={guided?.step.runnable === false ? 'Recorded' : 'Verified'} />}{id === 'machine' && diagnostics.length > 0 && <span className={styles.diagnosticCount}>{diagnostics.length}</span>}</button>)}
        {(!guided || toolsOpen) && <span className={styles.machineState}><span data-running={running && !paused} />{paused ? 'Paused' : running ? 'Powered on' : busy ? 'Starting' : 'Powered off'}</span>}
      </div>
      {guided && <button type="button" className={styles.toolsToggle} aria-expanded={toolsOpen} title={toolsOpen ? 'Hide runtime tools' : 'Open runtime tools'} onClick={() => { setToolsOpen(value => !value); setOutputTab('check'); }}>{toolsOpen ? 'Hide tools' : 'Open tools'}</button>}
      </div>
      <div className={styles.outputBody}>
        <section id="assembly-panel-machine" role="tabpanel" tabIndex={0} aria-labelledby="assembly-tab-machine" hidden={outputTab !== 'machine'} className={`${styles.outputPanel} ${styles.machinePanel}`}>
          {error && <pre className={styles.errorOutput} aria-label="Assembly error">{status}</pre>}
          {diagnostics.length > 0 && <details className={styles.diagnostics} open><summary><FiAlertTriangle aria-hidden="true" /> Compiler diagnostics</summary><pre role="status" aria-label="Compiler diagnostics">{diagnostics.join('\n')}</pre></details>}
          <div className={styles.screenShell}>
            <div ref={screen} className={styles.screen} role="region" tabIndex={0} aria-label="Emulated VGA text screen" onPointerDown={playground ? () => screen.current?.focus() : undefined} onFocus={playground ? () => emulator.current?.keyboard_set_status(true) : undefined} onBlur={playground ? () => emulator.current?.keyboard_set_status(false) : undefined} onKeyDownCapture={playground ? event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); emulator.current?.keyboard_set_status(false); screen.current?.blur(); outputTabs.current.machine?.focus(); } } : undefined}><div /><canvas /></div>
            {!hasBooted && <div className={styles.emptyMachine}><FiCpu aria-hidden="true" /><strong>{busy ? 'Starting your machine…' : guided && !guided.ready ? 'Build understanding before booting.' : isCExercise ? 'Test your C function on x86.' : example === 'kernel' ? 'Build your first C kernel.' : 'Run this chapter’s assembly.'}</strong><span>{isCExercise ? 'Run previews one function case. Submit compiles and checks every case in a separate test kernel; results appear in Check. To boot your complete kernel here, choose Run kernel project in Build.' : guided ? 'Write your own program. Use Run to see what it does, then Submit to check the checkpoint.' : playground ? 'Build your project to see its output here. Open Project guide for the reference output and file walkthrough.' : example === 'kernel' ? 'Editable sources → native x86 machine code → a bootable disk.' : exercise ? 'The lesson routine runs on the x86 CPU. Read its result on VGA here.' : example === 'challenge' ? 'This debugging starter prints nothing until you repair the BIOS call.' : 'The working example prints “I booted my own code!”, then halts.'}</span>{!guided && challengeEnabled && example !== 'kernel' && <button type="button" onClick={() => { setOutputTab('check'); requestAnimationFrame(() => outputTabs.current.check?.focus()); }}>{example === 'challenge' ? 'View the challenge →' : 'What should I try next? →'}</button>}</div>}
          </div>
          {blankDisplay && <div className={styles.displayNotice} role="status"><strong>No VGA text yet.</strong><p>{!exercise && activeRun.current?.source === challengeSource ? 'This debugging starter deliberately uses the wrong BIOS video service. It clears the screen, then halts without printing. Open Check for the task and hints.' : 'The emulator is powered on, but the text display is empty. Check your output instructions and loop. A program can reach HLT without printing anything.'}</p>{!guided && challengeEnabled && example !== 'kernel' && <button type="button" onClick={() => { setOutputTab('check'); requestAnimationFrame(() => outputTabs.current.check?.focus()); }}>Open Check</button>}</div>}
          {!blankDisplay && hasBooted && activeRun.current?.source === exampleSource && <p className={styles.runNote}>{exercise ? 'After the lesson returns, the scaffold halts. The printed result stays visible; change the program and run again.' : 'This example prints once, then halts. Its text stays on screen; edit the message and run again.'}</p>}
          <div className={styles.displayFooter}><span>VGA text display</span><span>v86 · 32 MiB RAM · BIOS</span></div>
          <RegisterSummary snapshot={registers.snapshot} phase={registerPhase} onInspect={inspectRegisters} />
          {playground && <p className={styles.small}>Click the display to send keyboard input to your machine. Escape returns the keyboard to the editor.</p>}
          {serial && <details className={styles.serialDetails}><summary>Serial output</summary><pre className={styles.serial} aria-live="polite">{serial}</pre></details>}
        </section>
        <section id="assembly-panel-registers" role="tabpanel" tabIndex={0} aria-labelledby="assembly-tab-registers" hidden={outputTab !== 'registers'} className={styles.outputPanel}>
          <RegisterInspector snapshot={registers.snapshot} error={registers.error} phase={registerPhase} stale={registerStale} onTogglePause={togglePause} pauseBusy={pauseBusy || stopping} routineMode={routineMode && !inspectionSource} sourceLabel={inspectionSource} />
          {isCExercise && <p className={styles.small}>This view shows the visible machine. To inspect your complete C kernel, choose Run kernel project in Build. Run previews one function case; Submit checks every case in separate x86 machines and reports results in Check.</p>}
        </section>
        <section id="assembly-panel-build" role="tabpanel" tabIndex={0} aria-labelledby="assembly-tab-build" hidden={outputTab !== 'build'} className={`${styles.outputPanel} ${styles.padded}`}>
          <div className={styles.panelHeading}><h3>Build output</h3><span>{example === 'kernel' ? 'NASM → Clang → LLD → disk' : 'NASM → boot sector → disk'}</span></div>
          <p className={styles.small}>Builds use a snapshot of all files. Click a source diagnostic to jump to that line.</p>
          {isCExercise && <div className={styles.secondaryActions}><button type="button" disabled={!restored || busy || stopping || testing || submitting || !canRunCheckpoint} onClick={compile}>Run kernel project</button><p className={styles.small}>Build your complete kernel for integration experiments. Submit checks the exercise function independently.</p></div>}
          <div className={styles.buildLog} aria-label="Compiler output">{buildLog.length ? buildLog.map((line, index) => {
            const location = locationFor(line);
            return location ? <button type="button" key={index} onClick={() => openDiagnostic(location)}>{line}</button> : <div key={index}>{line}</div>;
          }) : <p>{guided ? 'Run or Submit to see build steps and diagnostics here.' : 'Build & run to see build steps and diagnostics here.'}</p>}</div>
          {Object.keys(artifacts).length > 0 && <div className={styles.artifacts}><h4>Download build artifacts</h4>{Object.entries(artifacts).map(([name, bytes]) => <button type="button" key={name} onClick={() => download(bytes, name)}><FiDownload aria-hidden="true" />{name}<span>{bytes.length.toLocaleString()} bytes</span></button>)}</div>}
        </section>
        <section id="assembly-panel-check" role="tabpanel" tabIndex={0} aria-labelledby="assembly-tab-check" hidden={outputTab !== 'check'} className={`${styles.outputPanel} ${styles.padded}`}>
          {guided ? <div className={`${styles.check} ${styles.guidedCheck}`}>
            <div className={styles.checkTitle}><h3>{guided.step.title}</h3><span>{guided.step.runnable === false ? verified ? 'Draft recorded' : 'Draft review' : verified ? 'Verified' : 'Practice'}</span></div>
            <div className={checkStyles.fileActions} aria-label="Checkpoint files">{guided.step.brief?.files.map(path => <button type="button" key={path} disabled={!restored || busy || stopping || testing} onClick={() => openProblemFile(path)}><FiFileText aria-hidden="true" /><span>{Object.hasOwn(project.files, path) ? 'Edit' : 'Create'} <code>{path}</code></span></button>)}</div>
            {!guided.ready ? <p className={styles.small}>Continue reading <strong>{guided.sectionTitle}</strong>, then choose <strong>Open coding checkpoint</strong>.</p> : <>
              <p className={styles.small}>{guided.step.runnable === false ? 'Submit records your written draft. This stage does not compile or test your files yet.' : isCExercise ? 'Run tries the first function case without grading. Submit builds the exercise kernel and checks every case.' : 'Run lets you experiment. Submit builds your code and runs the machine checks.'}</p>
              {previewReport && <>
                <div className={styles.sampleResult} role="status" aria-label="Sample run result"><strong>{previewReport.passed ? 'Sample run complete' : 'Sample run needs attention'}</strong><p>One sample ran on x86. This is an ungraded experiment; use Submit to check every case and complete the checkpoint.</p></div>
                <div className={checkStyles.report} aria-label="Sample run details">{previewReport.cases.map((test, index) => <details key={test.name || index} open={!test.passed}><summary>{test.name}</summary>{test.assertions.map((assertion, assertionIndex) => <div className={checkStyles.assertion} key={assertionIndex}><strong>{assertion.passed ? '✓' : '×'} {assertion.label}</strong><dl><dt>Expected</dt><dd>{typeof assertion.expected === 'string' ? assertion.expected : JSON.stringify(assertion.expected)}</dd><dt>Actual</dt><dd>{typeof assertion.actual === 'string' ? assertion.actual : JSON.stringify(assertion.actual)}</dd></dl>{!assertion.passed && assertion.hint && <p>{assertion.hint}</p>}</div>)}</details>)}</div>
              </>}
              {testReport && <div className={checkStyles.checkpointResult} data-passed={verified} role="status" aria-label="Checkpoint result">
                <strong>{verified ? 'Checkpoint passed' : 'Checkpoint not passed yet'}</strong>
                <dl><dt>Code tests</dt><dd>{testReport.passed ? 'Passed' : 'Needs correction'} · {testReport.cases.filter(test => test.passed).length}/{testReport.cases.length} cases</dd></dl>
                <p id="checkpoint-feedback">{verified ? 'Your code passed all machine cases. Continue the lesson when you are ready.' : 'Fix the failed code checks below, then Submit the updated program.'}</p>
              </div>}
              {feedback && !testReport && <p id="submission-feedback" className={`${styles.feedback} ${verified ? styles.success : ''}`} role="status">{feedback}</p>}
              <div className={styles.supportActions}>
                {guided.step.hints?.length > 0 && <button className={styles.hintButton} type="button" disabled={hint >= guided.step.hints.length} onClick={() => setHint(value => value + 1)}>Reveal a hint</button>}
                {(guided.step.reference || Object.keys(guided.step.referenceFiles || {}).length > 0) && <button className={styles.hintButton} type="button" onClick={() => setReferenceVisible(value => !value)} aria-expanded={referenceVisible}>{referenceVisible ? 'Hide answer' : 'Peek at answer'}</button>}
                {guided.onSkip && !guided.passed && !guided.skipped && <button type="button" className={styles.hintButton} disabled={busy || testing || stopping || submitting} onClick={skipCheckpoint}>Skip checkpoint</button>}
                {(feedback || testReport || verified) && <button type="button" className={`${styles.continueButton} ${checkStyles.continueAction}`} disabled={!verified || testing || busy || stopping || submitting} aria-describedby={!verified ? testReport ? 'checkpoint-feedback' : feedback ? 'submission-feedback' : undefined : undefined} onClick={guided.onContinue}>Continue the lesson</button>}
              </div>
              {guided.step.hints?.slice(0, hint).map((text, index) => <p className={styles.hint} key={text}><strong>Hint {index + 1}.</strong> {text}</p>)}
              {referenceVisible && <div className={styles.referenceAnswer}><p className={styles.small}>One possible answer. Compare it with your draft; your files stay unchanged.</p>{guided.step.reference ? <><CodeBlock code={{ language: 'asm', filename: 'lesson.asm: one possible answer', source: guided.step.reference.body }} />{guided.step.reference.data && <CodeBlock code={{ language: 'asm', filename: 'data.inc', source: guided.step.reference.data }} />}</> : Object.entries(guided.step.referenceFiles || {}).map(([path,source]) => <CodeBlock key={path} code={{ language: /\.(c|h)$/.test(path) ? 'c' : /\.(asm|inc)$/.test(path) ? 'asm' : /\.json$/.test(path) ? 'json' : /\.md$/.test(path) ? 'markdown' : 'text', filename:path,source }} />)}</div>}
              {guided.step.interface && <details className={styles.details} key={`interface-${guided.stepIndex}`}><summary>View the function interface</summary><CodeBlock code={{ language: 'c', filename: guided.file, source: guided.step.interface }} /></details>}
              {(guided.step.expectedOutput || guided.step.tests) && <details className={styles.details} key={`criteria-${guided.stepIndex}`}><summary>Expected result and test cases</summary>
                {guided.step.expectedOutput && <div className={checkStyles.target}><strong>Expected VGA output · sample input</strong><pre>{guided.step.expectedOutput}</pre></div>}
                {guided.step.tests && <div className={checkStyles.contract}><p>{guided.step.tests.contract || guided.step.tests.scope}</p><p>{guided.step.tests.cases?.length || 1} machine cases · {guided.kind === 'assembly' ? 'Registers, flags, memory and return state' : guided.step.tests.kind === 'c-function' ? 'Function results and boundary behavior' : 'Kernel execution and memory behavior'}</p><details><summary>View test cases</summary>{guided.step.tests.cases?.map((test, index) => <div key={test.name || index}><strong>{test.name}</strong>{test.input && Object.keys(test.input).length ? <pre>{JSON.stringify(test.input, null, 2)}</pre> : <p>{test.hint || 'Uses the stated machine and function contract.'}</p>}{test.body && <details><summary>View assertions</summary><CodeBlock code={{ language: 'c', filename: test.name, source: test.body }} /></details>}</div>)}</details>{isCExercise && <p>These tests check the exercise function. Use Further experiments in Progress to record full-kernel integration evidence.</p>}</div>}
              </details>}
              {testReport && <div className={checkStyles.report} aria-label="Behavior test results"><h4 className={checkStyles.reportHeading}>Code test details</h4><p className={styles.small}>{testReport.scope}</p>{testReport.cases.map((test, index) => <details key={test.name || index} open={!test.passed}><summary><span className={test.passed ? checkStyles.pass : checkStyles.fail}>{test.passed ? 'CODE PASS' : 'CODE FAIL'}</span>{test.name}</summary>{test.assertions.map((assertion, assertionIndex) => <div className={checkStyles.assertion} key={`${assertion.label}-${assertionIndex}`}><strong>{assertion.passed ? '✓' : '×'} {assertion.label}</strong><dl><dt>Expected</dt><dd>{typeof assertion.expected === 'string' ? assertion.expected : JSON.stringify(assertion.expected)}</dd><dt>Actual</dt><dd>{typeof assertion.actual === 'string' ? assertion.actual : JSON.stringify(assertion.actual)}</dd></dl>{!assertion.passed && assertion.hint && <p>{assertion.hint}</p>}</div>)}</details>)}</div>}
            </>}
          </div> : example === 'kernel' ? <div className={styles.check}><span className={styles.taskBadge}>C KERNEL EXPERIMENT</span><h3>Follow the code across files.</h3><p>Build the project and find <code>C KERNEL READY</code> on VGA. In <code>kernel/main.c</code>, change the text; in <code>include/vga.h</code>, change the attribute. Rebuild and inspect how the screen changes.</p><p>Read the declaration in <code>include/vga.h</code> beside its implementation in <code>kernel/vga.c</code>. Remove that C file from <code>build.json</code> and explain the linker error. Restore it and rebuild.</p><p>The shared C project is a playground. Select Debug challenge to verify this chapter’s assembly exercise.</p></div> : challengeEnabled && example === 'example' ? <div className={styles.check}>
            <span className={styles.taskBadge}>FIRST, SEE IT RUN</span><h3>Boot something you can see.</h3>
            <p>{exercise ? <>Press <strong>Build &amp; run</strong> to execute this chapter’s worked example. Trace the instructions under <code>lesson:</code> and inspect their printed result.</> : <>Press <strong>Build &amp; run</strong>. The working example prints <code>I booted my own code!</code> on VGA, then stops at <code>hlt</code>. That is its expected result.</>}</p>
            <p>{exercise ? 'Change one operand, run the code, and inspect the new result. Then try the chapter’s repair challenge below.' : 'Change the message and run again. When you are ready, open the debugging challenge and repair a broken BIOS call.'}</p>
            <div className={styles.secondaryActions}><button type="button" disabled={!restored || busy || stopping} onClick={() => { chooseExample('challenge'); requestAnimationFrame(() => outputTabs.current.check?.focus()); }}>Start debugging challenge</button></div>
            <p className={styles.small}>The selector above the editor switches between the example and challenge. Each keeps its own draft.</p>
          </div> : challengeEnabled ? <div className={styles.check}>
            <div className={styles.checkTitle}><span className={styles.taskBadge}>YOUR TASK</span><span>{verified ? 'Verified on x86' : 'Not verified yet'}</span></div>
            <h3>{exercise?.title || 'Make this machine say OS READY'}</h3>
            <p>{exercise?.instructions || <>The starter selects the wrong BIOS video service. Repair the print routine so an otherwise clear VGA screen shows exactly <code>OS READY</code>. Keep one null-terminated message in the boot sector.</>}</p>
            {exercise && <p className={styles.small}>Expected VGA output: <code>{expectedText}</code>. Whitespace between lines is normalized.</p>}
            <div className={styles.answer}><button type="button" onClick={verify} disabled={busy || stopping}><FiCheckCircle aria-hidden="true" />Check this run</button></div>
            <p className={`${styles.feedback} ${verified ? styles.success : ''}`} role="status">{feedback || (exercise ? 'We check the actual VGA output. Use Progress to record your further experiments.' : 'We check the running VGA output and your actual assembled bytes.')}</p>
            <button className={styles.hintButton} type="button" disabled={hint >= hints.length} onClick={() => setHint((value) => value + 1)}><FiHelpCircle aria-hidden="true" />{hint === 0 ? 'Give me a hint' : hint < hints.length ? 'Reveal the next hint' : 'All hints revealed'}</button>
            {hints.slice(0, hint).map((text, index) => <p className={styles.hint} key={text}><strong>Hint {index + 1}.</strong> {text}</p>)}
          </div> : <div className={styles.check}>
            <span className={styles.taskBadge}>EXPERIMENT</span><h3>Write. Run. Inspect.</h3>
            <p>Change one instruction, run the code, and inspect the machine’s output. Trace the instructions to explain what changed.</p>
            <p>Try changing the BIOS service, the string pointer, or the terminator. Use the Bytes tab to connect assembly labels to physical addresses.</p>
            <p>This is a boot-sector playground. Progress contains this chapter’s further experiments.</p>
          </div>}
        </section>
        <section id="assembly-panel-bytes" role="tabpanel" tabIndex={0} aria-labelledby="assembly-tab-bytes" hidden={outputTab !== 'bytes'} className={`${styles.outputPanel} ${styles.padded}`}>
          <div className={styles.panelHeading}><h3>Emitted boot-sector bytes</h3><span>512 bytes</span></div>
          <p className={styles.small}>Physical address after loading at 0x7c00 · hexadecimal · ASCII. The final two bytes are <code>55 aa</code>.</p>
          <pre className={styles.hex} aria-label="Emitted machine code">{hex || (guided ? 'Run or Submit to inspect its bytes here.' : 'Build & run to inspect its bytes here.')}</pre>
        </section>
        <section id="assembly-panel-help" role="tabpanel" tabIndex={0} aria-labelledby="assembly-tab-help" hidden={outputTab !== 'help'} className={`${styles.outputPanel} ${styles.padded}`}>
          <h3>Your local x86 workbench</h3>
          {guided?.kind === 'assembly' && <details className={styles.details}><summary>What does the lab supply?</summary><p>You write <code>lesson.asm</code> and, when needed, <code>data.inc</code>. The execution harness establishes 16-bit real mode with CS=DS=ES=SS=0, SP=0x7bfe and DF=0, calls your routine, then halts. It supplies <code>putc</code> (AL), <code>print_hex16</code> (AX), <code>newline</code>, and <code>puts</code> (DS:SI), preserving general registers and flags. The bootloading chapter teaches you to replace this harness.</p></details>}
          {playground && <details className={styles.details} open><summary>Assembly routines and copied inputs</summary><p>Assembly routine mode runs <code>lesson.asm</code> with the course’s real-mode startup and printing helpers. Put data in <code>data.inc</code>. Copied checkpoint inputs live in <code>playground-inputs.inc</code>; edit that file to try different starting values. Boot sector mode gives you control of the complete 512-byte loader. C mode builds the files listed in <code>build.json</code>.</p><p>Download binary saves the current <code>boot.bin</code> or <code>kernel.bin</code>. The Build tab also offers the complete bootable <code>os.img</code> and, for C projects, <code>kernel.elf</code>. A raw kernel binary needs its loader; use <code>os.img</code> to boot the complete project.</p></details>}
          <p className={styles.small}>NASM 2.16.03, Clang 8.0.1, and LLD run locally in WebAssembly. They emit native x86 machine code, which v86 executes. Your lesson drafts stay with each chapter. The C project you write follows you across later kernel chapters. Earlier playground drafts are retained separately in browser storage.</p>
          {guided?.kind !== 'assembly' && <details className={styles.details}><summary>NASM syntax and machine limits</summary><p>Use labels, arithmetic, memory operands, macros, and 16/32-bit instructions. This entry point assembles one flat 512-byte boot sector: start with <code>bits 16</code> and <code>org 0x7c00</code>; pad with <code>times 510-($-$$) db 0</code> and end with <code>dw 0xaa55</code>.</p><p>The CPU enters in real mode. Changing BITS does not change the CPU mode. NASM reports source line numbers for errors and warnings.</p><p>The C project targets freestanding 32-bit x86. Use the local QEMU toolchain for x86-64 and UEFI. {playground ? 'Click the display to send keyboard input to the guest; press Escape to return to the editor.' : 'The course display is read-only. Open a copy in Playground to send keyboard input to your guest.'}</p></details>}
          <details className={styles.details} open><summary>Project files and the C build</summary><p>Add files using New file. Folders come from paths such as <code>include/console.h</code>. List new C and assembly translation units in <code>build.json</code>; headers are found through its include paths. Renaming a file also requires updating its includes and manifest references.</p><p>The first C build downloads approximately 50 MB of compiler assets. Build progress and source diagnostics appear in Build. The example uses two BIOS boot stages, an ELF32 linker script, and a C entry point. Its fixed boot layout allows a 16 KiB kernel image; memory bounds and ELF segments are checked before boot.</p></details>
          <details className={styles.details}><summary>Save and restore a project</summary><p>Drafts save automatically in this browser. Export a project JSON file to back up every source file or move it to another browser. Import replaces the selected project; Undo project change can restore the previous files.</p><div className={styles.secondaryActions}><button type="button" onClick={exportProject}>Export project JSON</button><button type="button" disabled={busy || stopping} onClick={() => importInput.current?.click()}>Import project JSON</button></div>{project.recoveredKernelFiles && <div className={styles.secondaryActions}><button type="button" onClick={() => download(JSON.stringify({ version: 1, files: project.recoveredKernelFiles }, null, 2), 'recovered-kernel-project.json', 'application/json')}>Export previous C draft</button></div>}<input ref={importInput} aria-label="Import project JSON file" type="file" accept=".json,application/json" hidden onChange={importProject} /></details>
          {!guided && <details className={styles.details}><summary>Boot a prebuilt kernel or disk image</summary><p>Build the chapter project with NASM and the cross-compiler, then upload its raw <code>build/os.img</code>. You can also boot the tested Module 1 C kernel.</p><div className={styles.secondaryActions}><button type="button" disabled={busy || stopping} onClick={bootKernel}><FiPlay aria-hidden="true" />Boot Module 1 kernel</button><a href="/course/module-1-source.tar.gz" download>Download C project ↗</a></div><label className={styles.file}>Raw BIOS disk image<input type="file" accept=".img,.bin" disabled={busy || stopping} onChange={upload} /></label></details>}
          <details className={styles.details}><summary>Editor shortcuts</summary><p>{guided ? 'Ctrl/⌘ + Enter runs your current code (the first sample for a C function). Use Submit to complete the checkpoint.' : 'Ctrl/⌘ + Enter builds your current project and boots its disk.'} Ctrl/⌘ + F searches the editor. Ctrl/⌘ + Z undoes changes. Tab indents; press Escape then Tab to leave the editor using the keyboard.</p></details>
          <a className={styles.sourceLink} href="/course/THIRD-PARTY.txt">Assembler and emulator licenses ↗</a><br /><a className={styles.sourceLink} href="/course/clang/README.md">C compiler sources &amp; licenses ↗</a>
        </section>
      </div>
    </div>
  </div>;
}
