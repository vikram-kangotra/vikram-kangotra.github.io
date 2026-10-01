import { useState } from 'react';
import { FiCpu, FiPause, FiPlay, FiArrowUpRight } from 'react-icons/fi';
import styles from './register-inspector.module.css';

const registers = [
  { key: 'eax', short: 'AX', description: 'The accumulator. Many arithmetic instructions use it; MUL and DIV also have implicit inputs or outputs here.', high: 'AH', low: 'AL' },
  { key: 'ebx', short: 'BX', description: 'A general-purpose register. BX can also form memory addresses in 16-bit addressing modes.', high: 'BH', low: 'BL' },
  { key: 'ecx', short: 'CX', description: 'A general-purpose register that also serves as the count for LOOP and repeated string instructions. CL can hold a shift count.', high: 'CH', low: 'CL' },
  { key: 'edx', short: 'DX', description: 'A general-purpose register. DX holds the upper half of some multiply or divide operands, and can select an I/O port.', high: 'DH', low: 'DL' },
  { key: 'esp', short: 'SP', description: 'The stack pointer. PUSH, POP, CALL, and RET use the stack and adjust its pointer. Calls made by the lab wrapper also affect this value.' },
  { key: 'ebp', short: 'BP', description: 'A general-purpose register often used as a stable stack-frame pointer. A routine must establish that frame itself.' },
  { key: 'esi', short: 'SI', description: 'The source index for string instructions, and a general-purpose register. LODSB reads through DS:SI in 16-bit address mode.' },
  { key: 'edi', short: 'DI', description: 'The destination index for string instructions, and a general-purpose register. STOSB writes through ES:DI in 16-bit address mode.' },
];
const flags = [
  { name: 'CF', bit: 0, title: 'Carry', meaning: 'Unsigned carry or borrow; shifts also use this bit.' },
  { name: 'PF', bit: 2, title: 'Parity', meaning: '1 when the result’s low byte has an even number of set bits.' },
  { name: 'AF', bit: 4, title: 'Auxiliary carry', meaning: 'Carry or borrow across bit 3, used by decimal-adjust instructions.' },
  { name: 'ZF', bit: 6, title: 'Zero', meaning: '1 when an instruction’s result is zero.' },
  { name: 'SF', bit: 7, title: 'Sign', meaning: 'Copies the result’s most significant bit.' },
  { name: 'TF', bit: 8, title: 'Trap', meaning: 'Enables the CPU’s single-step debug mechanism.' },
  { name: 'IF', bit: 9, title: 'Interrupt enable', meaning: 'Allows maskable external interrupts when 1. NMI is separate.' },
  { name: 'DF', bit: 10, title: 'Direction', meaning: 'String indices decrease when 1 and increase when 0.' },
  { name: 'OF', bit: 11, title: 'Overflow', meaning: 'Signed arithmetic result did not fit its destination width.' },
];

function numeric(value) { return typeof value === 'number' && Number.isFinite(value); }
function unsigned(value, width = 32) { return width === 16 ? value & 0xffff : value >>> 0; }
function hex(value, width = 32) { return numeric(value) ? `0x${unsigned(value, width).toString(16).toUpperCase().padStart(width / 4, '0')}` : '—'; }
function statusLabel(snapshot, phase) {
  if (phase === 'stopped') return 'Last sample · stopped';
  if (phase === 'paused') return 'Paused';
  if (phase === 'starting') return 'Starting machine';
  if (snapshot?.halted) return 'CPU waiting at HLT';
  return snapshot ? 'Live sample' : 'No sample yet';
}

export function RegisterSummary({ snapshot, phase, onInspect }) {
  const width = snapshot?.code32 ? 32 : 16;
  const summary = [
    ...registers.slice(0, 4).map(register => [width === 32 ? register.key.toUpperCase() : register.short, snapshot?.registers?.[register.key]]),
    [width === 32 ? 'ESP' : 'SP', snapshot?.registers?.esp],
    [width === 32 ? 'EIP' : 'IP', snapshot?.eip],
  ];
  return <div className={styles.summary} data-register-summary>
    <div className={styles.summaryTop}><span><FiCpu aria-hidden="true" /> {statusLabel(snapshot, phase)}</span><button type="button" onClick={onInspect}>Inspect registers <FiArrowUpRight aria-hidden="true" /></button></div>
    {snapshot ? <dl className={styles.summaryValues}>{summary.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{hex(value, width)}</dd></div>)}</dl>
      : <p className={styles.summaryEmpty}>{phase === 'starting' ? 'Register values appear after the machine starts.' : 'Run your code to see the CPU’s register values.'}</p>}
  </div>;
}

export default function RegisterInspector({ snapshot, error, phase, stale, onTogglePause, pauseBusy, routineMode, sourceLabel }) {
  const [displayWidth, setDisplayWidth] = useState(null);
  const [selected, setSelected] = useState('eax');
  const width = displayWidth || (snapshot?.protectedMode && !snapshot?.virtual8086 ? 32 : 16);
  const register = registers.find(item => item.key === selected);
  const rawValue = snapshot?.registers?.[selected];
  const value = numeric(rawValue) ? unsigned(rawValue, width) : null;
  const signed = value === null ? null : width === 16 ? (value & 0x8000 ? value - 0x10000 : value) : value | 0;
  const binary = value === null ? [] : value.toString(2).padStart(width, '0').match(/.{4}/g);
  const name = width === 32 ? selected.toUpperCase() : register.short;
  const paused = phase === 'paused';
  const canPause = !pauseBusy && (phase === 'running' || paused);
  function moveSelection(event, index) {
    const offsets = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? registers.length - 1 : offsets[event.key] ? (index + offsets[event.key] + registers.length) % registers.length : null;
    if (next === null) return;
    event.preventDefault();
    setSelected(registers[next].key);
    event.currentTarget.parentElement.querySelectorAll('button')[next]?.focus();
  }
  return <section className={styles.inspector} aria-label="CPU register inspector" data-register-inspector data-cpu-registers>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}><FiCpu aria-hidden="true" /> Inside the CPU</p><h3>Registers</h3></div>
      <button type="button" className={styles.pause} disabled={!canPause} onClick={onTogglePause} aria-label={pauseBusy ? 'Please wait…' : paused ? 'Resume machine' : 'Pause machine'}>{paused ? <FiPlay aria-hidden="true" /> : <FiPause aria-hidden="true" />}{pauseBusy ? 'Please wait…' : paused ? 'Resume' : 'Pause'}</button>
    </header>
    {error && <p className={styles.notice} role="status">{typeof error === 'string' ? error : error.message || 'The CPU register sample is unavailable.'}</p>}
    {stale && <p className={styles.notice}>Your files have changed. These registers belong to the previous build; run again to inspect the new version.</p>}
    {!snapshot ? <div className={styles.empty}><FiCpu aria-hidden="true" /><h4>{phase === 'starting' ? 'Waiting for the CPU' : 'See your instructions change the CPU'}</h4><p>{phase === 'starting' ? 'The first register sample will appear when the x86 machine starts.' : 'Build and run your code, then inspect the actual register values here. Pause the machine to keep a sample still while you read it.'}</p></div>
      : <>
        <div className={styles.machineState}>
          <span className={styles.stateBadge}>{statusLabel(snapshot, phase)}</span>
          <span>{snapshot.virtual8086 ? 'Virtual 8086 mode' : snapshot.protectedMode ? 'Protected mode' : 'Real mode'} · {snapshot.code32 ? '32-bit' : '16-bit'} code · {snapshot.stack32 ? '32-bit' : '16-bit'} stack</span>
          <span>Ring {numeric(snapshot.cpl) ? snapshot.cpl : '—'} · Paging {snapshot.paging ? 'on' : 'off'}</span>
        </div>
        {sourceLabel && <p className={styles.sectionHint}>CPU source: <strong>{sourceLabel}</strong> · loaded disk image.</p>}

        <div className={styles.sectionHeading}><h4>General-purpose registers</h4><div className={styles.widthToggle} role="group" aria-label="Register display width">{[16, 32].map(bits => <button type="button" key={bits} aria-pressed={width === bits} onClick={() => setDisplayWidth(bits)}>{bits}-bit</button>)}</div></div>
        <p className={styles.sectionHint}>{width === 16 ? 'Showing the low 16 bits of each register.' : 'Showing all 32 bits of each register.'} Select a register to unpack its value. This changes the display, not the CPU mode.</p>
        <div className={styles.registerGrid} role="group" aria-label="Select a register">
          {registers.map((item, index) => <button type="button" key={item.key} data-register={item.key} data-value={hex(snapshot.registers?.[item.key], width)} onClick={() => setSelected(item.key)} onKeyDown={event => moveSelection(event, index)} aria-pressed={selected === item.key} aria-label={`${width === 32 ? item.key.toUpperCase() : item.short}: ${hex(snapshot.registers?.[item.key], width)}`}><span>{width === 32 ? item.key.toUpperCase() : item.short}</span><code>{hex(snapshot.registers?.[item.key], width)}</code></button>)}
        </div>
        <details className={styles.sampling}><summary>How to read this CPU sample</summary><p>{phase === 'stopped' ? 'This is the last captured sample, saved when the machine stopped.' : paused ? 'The machine is paused. Resume it to continue execution.' : 'These are periodic samples from the running CPU, not an instruction-by-instruction trace. Pause to inspect a stable state.'} {routineMode ? 'After your routine returns, the lab wrapper regains control: SP may be 0x7C00, IP points into the wrapper, and its CLI clears IF. Checkpoint tests inspect your routine at their own capture point.' : 'Samples include firmware and startup code as well as your program. If a lab wrapper has regained control, IP and SP describe the wrapper rather than your last instruction.'}</p></details>
        <div className={styles.valueDetail}>
          <h4>{name} <span>One bit pattern, several ways to read it</span></h4>
          <p>{register.description}</p>
          <dl className={styles.interpretations}><div><dt>Hexadecimal</dt><dd>{hex(rawValue, width)}</dd></div><div><dt>Unsigned decimal</dt><dd>{value === null ? '—' : value}</dd></div><div><dt>Signed decimal</dt><dd>{signed === null ? '—' : signed}</dd></div></dl>
          <div className={styles.binary}><span>Binary · bit {width - 1} → bit 0</span><code>{binary.length ? binary.map((nibble, index) => <span key={index}>{nibble}</span>) : '—'}</code></div>
          <p className={styles.interpretationNote}>The CPU stores bits. Signed and unsigned interpretations use the same bits; your instruction decides how to use them.</p>
          {register.high && <div className={styles.aliases}><span>Overlapping names</span><dl>{width === 32 && <div><dt>{register.short} · bits 15–0</dt><dd>{hex(rawValue, 16)}</dd></div>}<div><dt>{register.high} · bits 15–8</dt><dd>{numeric(rawValue) ? hex(rawValue >>> 8 & 0xff, 8) : '—'}</dd></div><div><dt>{register.low} · bits 7–0</dt><dd>{numeric(rawValue) ? hex(rawValue & 0xff, 8) : '—'}</dd></div></dl><p>These are parts of the same register, not separate storage.</p></div>}
        </div>
        <div className={styles.sectionHeading}><h4>Instruction pointer & segments</h4></div>
        <dl className={styles.addresses}><div data-register="eip" data-value={hex(snapshot.eip, snapshot.code32 ? 32 : 16)}><dt>{snapshot.code32 ? 'EIP' : 'IP'} <span>offset in CS</span></dt><dd>{hex(snapshot.eip, snapshot.code32 ? 32 : 16)}</dd></div><div data-register="linearIp" data-value={hex(snapshot.linearIp)}><dt>Linear IP <span>before paging</span></dt><dd>{hex(snapshot.linearIp)}</dd></div>{['cs', 'ds', 'es', 'ss', 'fs', 'gs'].map(segment => <div key={segment} data-segment={segment} data-value={hex(snapshot.segments?.[segment], 16)}><dt>{segment.toUpperCase()}</dt><dd>{hex(snapshot.segments?.[segment], 16)}</dd></div>)}</dl>
        <p className={styles.sectionHint}>{snapshot.protectedMode && !snapshot.virtual8086 ? 'Segment registers contain selectors. Their descriptor bases help turn offsets into linear addresses.' : 'In ordinary real mode and virtual 8086 mode, a segment contributes its value × 16 to an address.'} Paging, when enabled, translates linear addresses into physical addresses.</p>
        <div className={styles.sectionHeading}><h4>Flags</h4><code className={styles.rawFlags}>EFLAGS {hex(snapshot.eflags)}</code></div>
        <p className={styles.sectionHint}>A flag is one bit: 1 means set, 0 means clear. Each instruction specifies which flags it changes, preserves, or leaves undefined; a sampled bit alone does not tell you which instruction set it.</p>
        <dl className={styles.flags}>{flags.map(flag => { const bit = numeric(snapshot.eflags) ? snapshot.eflags >>> flag.bit & 1 : null; return <div key={flag.name} data-flag={flag.name} data-value={bit === null ? '' : bit} data-set={bit === 1}><dt><abbr title={flag.title}>{flag.name}</abbr><span>bit {flag.bit}</span><code>{bit === null ? '—' : bit}</code></dt><dd><strong>{flag.title}</strong>{flag.meaning}</dd></div>; })}</dl>
      </>}
  </section>;
}
