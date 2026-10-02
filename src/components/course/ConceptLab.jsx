/* global Set */
'use client';

import { useId, useState } from 'react';
import styles from './course-labs.module.css';

const PAGE = 4096;
const hex = (value, width = 8) => `0x${value.toString(16).toUpperCase().padStart(width, '0')}`;
const parse = (value, max = 0xFFFFFFFF) => {
  const input = String(value).trim();
  if (!/^(?:0x[0-9a-f]+|[0-9]+)$/i.test(input)) return null;
  const result = Number(input);
  return Number.isSafeInteger(result) && result >= 0 && result <= max ? result : null;
};

function Field({ label, value, onChange, hint, ...props }) {
  const id = useId();
  return <label className={styles.field} htmlFor={id}>
    <span>{label}</span>
    <input id={id} value={value} onChange={event => onChange(event.target.value)} spellCheck={false} autoComplete="off" {...props} />
    {hint && <small>{hint}</small>}
  </label>;
}

function Toggle({ label, checked, onChange }) {
  return <label className={styles.toggle}><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} /><span>{label}</span></label>;
}

function Result({ children, success = false }) {
  return <div className={`${styles.result} ${success ? styles.success : ''}`} role="status" aria-live="polite">{children}</div>;
}

function Prediction({ question, expected, explanation, ready = true, prerequisite, onSolved }) {
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState('');
  const [correct, setCorrect] = useState(false);
  const context = `${expected}:${ready}`;
  const [checkedContext, setCheckedContext] = useState('');
  const current = checkedContext === context;
  const check = () => {
    setCheckedContext(context);
    setCorrect(false);
    if (!ready || expected === null) {
      setFeedback(prerequisite || 'Complete the experiment above before checking your prediction.');
      return;
    }
    const value = parse(answer, Number.MAX_SAFE_INTEGER);
    if (value === null) {
      setFeedback('Enter a nonnegative integer in decimal or hexadecimal (for example, 4096 or 0x1000).');
      return;
    }
    if (value !== expected) {
      setFeedback(`Your value ${answer} does not match this state. ${explanation} Rework the calculation and try again.`);
      return;
    }
    setCorrect(true);
    setFeedback(`Verified: ${expected} (${hex(expected)}). ${explanation}`);
    onSolved?.();
  };
  return <div className={styles.challenge}>
    <span className={styles.eyebrow}>Work it out</span>
    <Field label={question} value={answer} onChange={value => { setAnswer(value); setFeedback(''); }} placeholder="Your prediction, decimal or 0x…" />
    <button type="button" onClick={check}>Check my reasoning</button>
    {feedback && current && <Result success={correct}>{feedback}</Result>}
  </div>;
}

function GdtLab({ onSolved }) {
  const [base, setBase] = useState('0x00000000');
  const [limit, setLimit] = useState('0xFFFFF');
  const [granularity, setGranularity] = useState(true);
  const [code, setCode] = useState(true);
  const [present, setPresent] = useState(true);
  const [dpl, setDpl] = useState('0');
  const [wide, setWide] = useState(true);
  const [changed, setChanged] = useState(false);
  const update = setter => value => { setter(value); setChanged(true); };
  const b = parse(base), l = parse(limit, 0xFFFFF);
  const access = (present ? 0x80 : 0) | (Number(dpl) << 5) | 0x10 | (code ? 0x0A : 0x02);
  const flags = (granularity ? 0x80 : 0) | (wide ? 0x40 : 0);
  const bytes = b === null || l === null ? null : [l & 255, (l >>> 8) & 255, b & 255, (b >>> 8) & 255, (b >>> 16) & 255, access, ((l >>> 16) & 15) | flags, (b >>> 24) & 255];
  const effectiveLimit = l === null ? null : granularity ? l * PAGE + (PAGE - 1) : l;
  return <>
    <p>Build a legacy protected-mode, nonconforming code or expand-up data descriptor. Base and limit are split across an 8-byte little-endian record.</p>
    <div className={styles.fields}>
      <Field label="Segment base (32-bit)" value={base} onChange={update(setBase)} />
      <Field label="Encoded limit (20-bit)" value={limit} onChange={update(setLimit)} hint="Maximum 0xFFFFF; the limit is inclusive." />
      <label className={styles.field}><span>DPL</span><select value={dpl} onChange={event => update(setDpl)(event.target.value)}>{[0, 1, 2, 3].map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className={styles.toggles}>
      <Toggle label="G: 4 KiB granularity" checked={granularity} onChange={update(setGranularity)} />
      <Toggle label="D/B: 32-bit default" checked={wide} onChange={update(setWide)} />
      <Toggle label="P: present" checked={present} onChange={update(setPresent)} />
      <Toggle label="Executable (readable code; otherwise writable data)" checked={code} onChange={update(setCode)} />
    </div>
    {bytes ? <>
      <div className={styles.bytes} aria-label="Descriptor bytes in ascending memory address order">
        {bytes.map((byte, index) => <div key={index}><small>byte {index}</small><strong>{hex(byte, 2)}</strong><small>{['limit 7:0', 'limit 15:8', 'base 7:0', 'base 15:8', 'base 23:16', 'access', 'flags + limit', 'base 31:24'][index]}</small></div>)}
      </div>
      <dl className={styles.metrics}><div><dt>Accessible offset range</dt><dd>0 … {hex(effectiveLimit)}</dd></div><div><dt>Segment size</dt><dd>{(effectiveLimit + 1).toLocaleString()} bytes</dd></div><div><dt>Access byte</dt><dd>{hex(access, 2)}</dd></div></dl>
      <p className={styles.note}>S=1, accessed=0, L=0, AVL=0. Code is readable and nonconforming; data is writable and expands upward. DPL does not by itself switch the current privilege level. A clear present bit causes a fault when the descriptor is used.</p>
    </> : <Result>Base must be 0…0xFFFFFFFF and the encoded limit 0…0xFFFFF.</Result>}
    <Prediction question="How many bytes fit in this segment, including offset zero?" expected={effectiveLimit === null ? null : effectiveLimit + 1} ready={changed && bytes !== null} prerequisite="Change at least one descriptor field and keep the base and limit in range." explanation={granularity ? 'With G=1, effective limit = encoded limit × 4096 + 4095. Add one because the limit is inclusive.' : 'With G=0, the encoded limit is a byte offset. Add one to include offset zero.'} onSolved={onSolved} />
  </>;
}

function InterruptLab({ onSolved }) {
  const [masked, setMasked] = useState(true);
  const [iflag, setIflag] = useState(true);
  const [pending, setPending] = useState(false);
  const [service, setService] = useState(false);
  const [delivered, setDelivered] = useState(0);
  const [eois, setEois] = useState(0);
  const [message, setMessage] = useState('The PIT uses master-PIC IRQ0. The master PIC has been remapped to vector base 0x20.');
  const deliver = () => {
    if (!pending) return setMessage('No interrupt request is pending. Pulse the PIT first.');
    if (masked) return setMessage('IRQ0 is masked: the request remains pending in this model. Unmask the line.');
    if (!iflag) return setMessage('CPU IF=0: maskable external interrupts cannot be accepted yet.');
    if (service) return setMessage('IRQ0 is still in service. The PIC will not deliver another IRQ0 until EOI clears its in-service bit.');
    setPending(false); setService(true); setDelivered(delivered + 1); setIflag(false);
    setMessage('CPU accepted vector 0x20. A 32-bit interrupt gate saves EFLAGS/CS/EIP (and SS/ESP on a privilege change), clears IF, and enters the handler.');
  };
  const returnInterrupt = () => {
    if (!service) return setMessage('There is no active handler to complete.');
    setService(false); setIflag(true); setEois(eois + 1);
    setMessage('The handler sends EOI to the master PIC, restores saved registers, then executes IRETD. This scenario restores IF=1. A PIT IRQ has no CPU-pushed error code.');
  };
  return <>
    <p>Explore interrupt masking, pending requests, and the missing-EOI bug. This bounded model has one PIC line and one active interrupt handler; it does not model nested IRQs or APIC delivery.</p>
    <div className={styles.toggles}><Toggle label="PIC IRQ0 masked" checked={masked} onChange={setMasked} /><Toggle label="CPU EFLAGS.IF enabled" checked={iflag} onChange={setIflag} /></div>
    <div className={styles.pipeline}><span>PIT pulse</span><span>IRR: {pending ? 'pending' : 'clear'}</span><span>IMR: {masked ? 'masked' : 'open'}</span><span>ISR: {service ? 'in service' : 'clear'}</span><span>CPU IF: {iflag ? '1' : '0'}</span></div>
    <div className={styles.actions}>
      <button type="button" onClick={() => { setPending(true); setMessage(pending ? 'A request is already pending. The PIC records the pending request in a single bit, so further pulses can coalesce.' : 'PIT edge latched as pending IRQ0.'); }}>Pulse PIT</button>
      <button type="button" onClick={deliver}>Attempt delivery</button>
      <button type="button" onClick={returnInterrupt}>Send EOI + IRETD</button>
    </div>
    <Result>{message}</Result>
    <p className={styles.note}>{delivered} delivered; {eois} completed. An interrupt gate descriptor is 8 bytes in this 32-bit IDT. IDTR.limit is table byte size − 1.</p>
    <Prediction question="For 256 entries of 8 bytes, what value belongs in IDTR.limit?" expected={2047} ready={eois >= 2} prerequisite="Deliver and complete two PIT interrupts. Try pulsing the second while the first is still in service to reproduce the missing-EOI symptom." explanation="The table occupies 256 × 8 = 2048 bytes; a table-register limit is the last valid byte offset." onSolved={onSolved} />
  </>;
}

function MemoryLab({ onSolved }) {
  const fresh = () => Array.from({ length: 24 }, (_, index) => index < 4 ? 'reserved' : 'free');
  const [frames, setFrames] = useState(fresh);
  const [count, setCount] = useState('3');
  const [message, setMessage] = useState('Frames 0–3 are reserved for this toy machine. Click free frames to reserve them, or allocated frames to free them.');
  const [allocatedOnce, setAllocatedOnce] = useState(false);
  const [freedOnce, setFreedOnce] = useState(false);
  const allocate = () => {
    const requested = parse(count, 24);
    if (requested === null || requested === 0) return setMessage('Request between 1 and 24 frames.');
    const free = frames.map((state, index) => state === 'free' ? index : -1).filter(index => index >= 0);
    if (free.length < requested) return setMessage(`Out of physical memory: ${requested} requested, ${free.length} free. This batch operation is atomic: the bitmap is unchanged.`);
    const chosen = free.slice(0, requested);
    setFrames(frames.map((state, index) => chosen.includes(index) ? 'allocated' : state));
    setAllocatedOnce(true);
    setMessage(`Allocated frames ${chosen.join(', ')}. Physical addresses = frame index × 4096. These frames need not be contiguous.`);
  };
  const click = index => {
    if (index < 4) return setMessage('Boot/kernel frames are permanently reserved in this experiment. They must never be handed to the allocator.');
    const old = frames[index];
    const state = old === 'allocated' || old === 'reserved' ? 'free' : 'reserved';
    setFrames(frames.map((frame, i) => i === index ? state : frame));
    if (old === 'allocated') setFreedOnce(true);
    setMessage(`Frame ${index}: ${old} → ${state}. ${old === 'allocated' ? 'Its physical page is available for reuse.' : 'This edits the toy input memory map. A real pmm_free must never release firmware, MMIO, or kernel reservations.'}`);
  };
  const next = frames.indexOf('free');
  return <>
    <p>Every square is one 4 KiB physical frame. The bitmap records unavailable frames with bit 1; separate ownership metadata distinguishes reserved memory from allocations. Toggling a reservation edits this toy memory map; only freeing an allocated frame models pmm_free.</p>
    <div className={styles.bitmap} aria-label="Physical frame allocation map">
      {frames.map((state, index) => <button type="button" key={index} className={styles[state]} onClick={() => click(index)} aria-label={`Frame ${index}, ${state}, address ${hex(index * PAGE)}${index < 4 ? ', permanently reserved' : ''}`}><strong>{index}</strong><small>{state}</small></button>)}
    </div>
    <div className={styles.fields}><Field label="Frames to allocate (1–24)" value={count} onChange={setCount} /><div className={styles.actions}><button type="button" onClick={allocate}>Allocate first available</button><button type="button" onClick={() => { setFrames(fresh()); setAllocatedOnce(false); setFreedOnce(false); setMessage('Bitmap reset.'); }}>Reset bitmap</button></div></div>
    <Result>{message}</Result>
    <p className={styles.note}>Free: {frames.filter(frame => frame === 'free').length} · Allocated: {frames.filter(frame => frame === 'allocated').length} · Reserved: {frames.filter(frame => frame === 'reserved').length}. A real PMM initializes from the firmware memory map and reserves every overlapping boot/kernel page.</p>
    <Prediction question="What physical address will the next single-frame allocation return?" expected={next < 0 ? null : next * PAGE} ready={allocatedOnce && freedOnce && next >= 0} prerequisite="Allocate a batch, free an allocated frame by clicking it, and leave at least one frame free." explanation="First-fit scans frame indices upward; multiply the first free frame index by 4096. Freeing a frame does not erase its contents." onSolved={onSolved} />
  </>;
}

function PagingLab({ onSolved }) {
  const [address, setAddress] = useState('0x00403ABC');
  const [frame, setFrame] = useState('0x00900000');
  const [directory, setDirectory] = useState({ present: true, write: true, user: true });
  const [table, setTable] = useState({ present: true, write: false, user: true });
  const [write, setWrite] = useState(true);
  const [user, setUser] = useState(true);
  const [changed, setChanged] = useState(false);
  const setFlag = (setter, state, flag, value) => { setter({ ...state, [flag]: value }); setChanged(true); };
  const va = parse(address), pa = parse(frame);
  const valid = va !== null && pa !== null && pa % PAGE === 0;
  const pd = va === null ? 0 : Math.floor(va / 0x400000), pt = va === null ? 0 : Math.floor(va / PAGE) % 1024, offset = va === null ? 0 : va % PAGE;
  const present = directory.present && table.present;
  const denied = (user && !(directory.user && table.user)) || (write && !(directory.write && table.write));
  const fault = !present || denied;
  const error = (present ? 1 : 0) | (write ? 2 : 0) | (user ? 4 : 0);
  return <>
    <p>Walk legacy 32-bit, non-PAE paging: 10 directory bits, 10 table bits, 12 offset bits. CR0.WP=1; CR4.PSE=0. This experiment edits the selected PDE and PTE, with other entries omitted.</p>
    <div className={styles.fields}>
      <Field label="Virtual address (32-bit)" value={address} onChange={value => { setAddress(value); setChanged(true); }} />
      <Field label="Mapped physical frame base" value={frame} onChange={value => { setFrame(value); setChanged(true); }} hint="Must be aligned to 4096 bytes." />
    </div>
    <div className={styles.pipeline}><span>CR3 = 0x00100000</span><span>PD index {pd}<small>PDE @ {hex(0x100000 + pd * 4)}</small></span><span>PT index {pt}<small>PTE @ {hex(0x101000 + pt * 4)}</small></span><span>Offset {offset}<small>{hex(offset, 3)}</small></span></div>
    <p className={styles.note}>The selected PDE points to the page table at 0x00101000. Both entry types are 4 bytes.</p>
    <div className={styles.permissionGrid}>
      {[[directory, setDirectory, 'Directory entry'], [table, setTable, 'Table entry']].map(([state, setter, title]) => <fieldset key={title}><legend>{title}</legend>{['present', 'write', 'user'].map(flag => <Toggle key={flag} label={`${flag.toUpperCase()} bit`} checked={state[flag]} onChange={value => setFlag(setter, state, flag, value)} />)}</fieldset>)}
      <fieldset><legend>Requested access</legend><Toggle label="Write (off = read)" checked={write} onChange={value => { setWrite(value); setChanged(true); }} /><Toggle label="Ring 3 (off = supervisor)" checked={user} onChange={value => { setUser(value); setChanged(true); }} /></fieldset>
    </div>
    {!valid ? <Result>Enter valid 32-bit addresses and align the physical frame to 0x1000.</Result> : fault ? <Result>Page fault (#PF), CR2={hex(va)}. {!present ? `${!directory.present ? 'PDE' : 'PTE'} is not present.` : user && !(directory.user && table.user) ? 'A user access needs U/S=1 at both levels.' : 'A write needs R/W=1 at both levels; supervisor writes also obey permissions with CR0.WP=1.'} Error bits: P={present ? 1 : 0}, W/R={write ? 1 : 0}, U/S={user ? 1 : 0}. RSVD=0; this legacy configuration has no NX bit.</Result> : <Result success>Translation succeeds. Take the aligned PTE frame base and add the 12-bit byte offset. Permissions are the intersection of both levels.</Result>}
    <Prediction question={fault ? 'What numeric page-fault error code does this access produce?' : 'What physical byte address does this access reach?'} expected={!valid ? null : fault ? error : pa + offset} ready={valid && changed} prerequisite="Change an address, permission, or access type; use valid aligned addresses." explanation={fault ? 'Encode P in bit 0, W/R in bit 1, and U/S in bit 2. P identifies whether the fault was a protection violation.' : `Physical address = ${hex(pa || 0)} + offset ${offset}. Changing a live mapping also requires an appropriate TLB invalidation in a real kernel.`} onSolved={onSolved} />
  </>;
}

function HeapLab({ onSolved }) {
  const [blocks, setBlocks] = useState([{ start: 0, size: 256, free: true }]);
  const [request, setRequest] = useState('24');
  const [serial, setSerial] = useState(1);
  const [allocated, setAllocated] = useState(false);
  const [freed, setFreed] = useState(false);
  const [message, setMessage] = useState('A 256-byte arena begins at 0xC1000000. Each block contains a 16-byte header.');
  const allocate = () => {
    const bytes = parse(request, 240);
    if (!bytes) return setMessage('Choose a payload size from 1 through 240 bytes.');
    const needed = Math.ceil(bytes / 16) * 16 + 16;
    const index = blocks.findIndex(block => block.free && block.size >= needed);
    if (index < 0) return setMessage(`No single free block can hold ${needed} bytes including header and alignment. Total free space alone cannot guarantee success.`);
    const block = blocks[index];
    const split = block.size - needed >= 32;
    const replacement = [{ ...block, free: false, size: split ? needed : block.size, id: serial, request: bytes }];
    if (split) replacement.push({ start: block.start + needed, size: block.size - needed, free: true });
    setBlocks([...blocks.slice(0, index), ...replacement, ...blocks.slice(index + 1)]);
    setSerial(serial + 1); setAllocated(true);
    setMessage(`Allocation #${serial}: payload ${hex(0xC1000000 + block.start + 16)}. ${needed - 16 - bytes} alignment bytes. ${split ? 'Split the remaining free block.' : 'Remainder too small for a header plus 16-byte payload; keep it in this allocation.'}`);
  };
  const free = index => {
    if (blocks[index].free) return setMessage('This block is already free; a real allocator must reject the invalid free before changing metadata.');
    const next = blocks.map((block, i) => i === index ? { start: block.start, size: block.size, free: true } : { ...block });
    const merged = [];
    next.forEach(block => {
      const previous = merged[merged.length - 1];
      if (previous?.free && block.free) previous.size += block.size;
      else merged.push(block);
    });
    setBlocks(merged); setFreed(true); setMessage('Freed the allocation and coalesced adjacent free blocks. Bytes are not returned to the PMM in this bounded arena.');
  };
  const largest = Math.max(0, ...blocks.filter(block => block.free).map(block => block.size - 16));
  return <>
    <p>First-fit heap allocation with 16-byte alignment, splitting, and adjacent-block coalescing. Allocate several sizes, free a block in the middle, and watch fragmentation.</p>
    <div className={styles.heap} aria-label="Heap blocks in address order">{blocks.map((block, index) => <button type="button" key={block.start} onClick={() => free(index)} className={block.free ? styles.free : styles.allocated} style={{ flexGrow: block.size }} aria-label={`${block.free ? 'Free block' : `Allocation ${block.id}`}, offset ${block.start}, ${block.size} bytes. ${block.free ? 'Already free' : 'Click to free'}`}><strong>{block.free ? 'Free' : `#${block.id}`}</strong><small>{block.size} B</small><small>+{block.start}</small></button>)}</div>
    <div className={styles.fields}><Field label="Requested payload bytes" value={request} onChange={setRequest} /><div className={styles.actions}><button type="button" onClick={allocate}>kmalloc</button><button type="button" onClick={() => { setBlocks([{ start: 0, size: 256, free: true }]); setSerial(1); setAllocated(false); setFreed(false); setMessage('Arena reset.'); }}>Reset arena</button></div></div>
    <Result>{message}</Result>
    <p className={styles.note}>Block sizes include headers. The smallest splittable remainder is 32 bytes (16-byte header + 16-byte payload). Click an allocated block to kfree it.</p>
    <Prediction question="What is the largest payload request that can currently succeed (0 if none)?" expected={largest} ready={allocated && freed} prerequisite="Allocate at least one block and then free an allocation to observe coalescing." explanation="Find the largest single free block and subtract its 16-byte header. Alignment and external fragmentation both matter." onSolved={onSolved} />
  </>;
}

const JOBS = [{ id: 'A', burst: 5, priority: 2 }, { id: 'B', burst: 3, priority: 1 }, { id: 'C', burst: 2, priority: 3 }];
const schedulerInitial = () => ({ time: 0, remaining: { A: 5, B: 3, C: 2 }, queue: ['A', 'B', 'C'], current: null, slice: 0, history: [], finish: {}, first: {} });

function SchedulerLab({ onSolved }) {
  const [policy, setPolicy] = useState('rr');
  const [quantum, setQuantum] = useState('2');
  const [state, setState] = useState(schedulerInitial);
  const [message, setMessage] = useState('All three jobs arrive at t=0. A CPU tick consumes one unit of burst time. Context-switch cost is zero in this model.');
  const tick = () => {
    const q = parse(quantum, 10);
    if (policy === 'rr' && !q) return setMessage('Use a quantum from 1 through 10 ticks.');
    if (state.time >= 10) return setMessage('All jobs have completed. Compare response, turnaround, and waiting time below.');
    let queue = [...state.queue], current = state.current, slice = state.slice;
    if (policy === 'priority') {
      current = [...JOBS].filter(job => state.remaining[job.id] > 0).sort((a, b) => a.priority - b.priority)[0].id;
      queue = JOBS.filter(job => job.id !== current && state.remaining[job.id] > 0).map(job => job.id);
    } else if (!current) {
      current = queue.shift(); slice = 0;
    }
    const running = current;
    const remaining = { ...state.remaining, [running]: state.remaining[running] - 1 };
    const finish = { ...state.finish }, first = { ...state.first };
    if (first[running] === undefined) first[running] = state.time;
    slice += 1;
    if (remaining[running] === 0) { finish[running] = state.time + 1; current = null; slice = 0; }
    else if (policy === 'rr' && slice === q) { queue.push(running); current = null; slice = 0; }
    setState({ time: state.time + 1, remaining, finish, first, current, slice, queue, history: [...state.history, running] });
    setMessage(`t=${state.time}→${state.time + 1}: ${running} ran. ${remaining[running] === 0 ? `${running} completed.` : current ? `${running} keeps the CPU.` : `${running} goes to the back of the ready queue.`}`);
  };
  return <>
    <p>Observe the tradeoff between fairness and priority. Smaller numeric priorities win. Priority scheduling can starve low-priority work if higher-priority work keeps arriving.</p>
    <div className={styles.fields}>
      <label className={styles.field}><span>Scheduling policy (resets the run)</span><select value={policy} onChange={event => { setPolicy(event.target.value); setState(schedulerInitial()); setMessage('Policy changed; run reset.'); }}><option value="rr">Round robin</option><option value="priority">Strict priority</option></select></label>
      <Field label="Round-robin quantum (1–10)" value={quantum} disabled={policy !== 'rr' || state.time > 0} onChange={setQuantum} hint="Reset before changing the quantum." />
    </div>
    <div className={styles.timeline} aria-label="CPU schedule">{Array.from({ length: 10 }, (_, index) => <div key={index} className={state.history[index] ? styles[`job${state.history[index]}`] : ''}><strong>{state.history[index] || '·'}</strong><small>{index}–{index + 1}</small></div>)}</div>
    <div className={styles.actions}><button type="button" onClick={tick} disabled={state.time === 10}>Run one CPU tick</button><button type="button" onClick={() => { setState(schedulerInitial()); setMessage('Schedule reset; all jobs are ready at t=0.'); }}>Reset schedule</button></div>
    <Result>{message}</Result>
    <p className={styles.note}>Ready queue: {state.queue.length ? state.queue.join(' → ') : '(empty)'}{state.current ? ` · Running: ${state.current}` : ''}</p>
    <div className={styles.tableWrap} role="region" aria-label="Scheduler timing metrics" tabIndex={0}><table><caption>Metrics in ticks; arrival time is zero for every job</caption><thead><tr><th>Job</th><th>Burst</th><th>Priority</th><th>Remaining</th><th>Response</th><th>Turnaround</th><th>Waiting</th></tr></thead><tbody>{JOBS.map(job => <tr key={job.id}><th>{job.id}</th><td>{job.burst}</td><td>{job.priority}</td><td>{state.remaining[job.id]}</td><td>{state.first[job.id] ?? '-'}</td><td>{state.finish[job.id] ?? '-'}</td><td>{state.finish[job.id] === undefined ? '-' : state.finish[job.id] - job.burst}</td></tr>)}</tbody></table></div>
    <Prediction question="After this run, how many ticks did job A spend waiting (not executing)?" expected={state.finish.A === undefined ? null : state.finish.A - 5} ready={state.time === 10} prerequisite="Step through all 10 CPU ticks to complete the run." explanation="Waiting = completion − arrival − CPU burst. A arrived at zero and needed five CPU ticks. Compare the result after changing the policy or quantum." onSolved={onSolved} />
  </>;
}

function PrivilegeLab({ onSolved }) {
  const [pointer, setPointer] = useState('0x00800FF0');
  const [length, setLength] = useState('32');
  const [copyToUser, setCopyToUser] = useState(false);
  const [pages, setPages] = useState([{ present: true, user: true, write: true }, { present: false, user: true, write: false }, { present: true, user: false, write: true }, { present: true, user: true, write: true }]);
  const [changed, setChanged] = useState(false);
  const [checked, setChecked] = useState(false);
  const ptr = parse(pointer), len = parse(length, 65536), limit = 0xC0000000;
  let message, touched = 0, valid = false;
  if (ptr === null || len === null) message = 'Use a 32-bit pointer and a length from 0 through 65536 bytes.';
  else if (len === 0) { valid = true; message = 'Zero-length operation: this API succeeds without dereferencing the pointer. No page is touched.'; }
  else if (ptr >= limit || len > limit - ptr) message = 'Reject: the nonempty range crosses USER_TOP=0xC0000000. Subtract before comparing to avoid unsigned addition overflow.';
  else {
    const first = Math.floor(ptr / PAGE), last = Math.floor((ptr + len - 1) / PAGE);
    touched = last - first + 1; valid = true;
    for (let page = first; page <= last; page += 1) {
      const entry = pages[page - 0x800];
      const reason = !entry?.present ? 'not present' : !entry.user ? 'supervisor-only' : copyToUser && !entry.write ? 'read-only' : null;
      if (reason) { valid = false; message = `Reject at ${hex(page * PAGE)}: page is ${reason}. The entire buffer must satisfy the copy direction’s permissions.`; break; }
    }
    if (valid) message = `Range accepted: [${hex(ptr)}, ${hex(ptr + len)}), ${touched} page${touched === 1 ? '' : 's'} checked. ${copyToUser ? 'Kernel writes require writable user pages.' : 'Kernel reads do not require the user page to be writable.'}`;
  }
  const update = setter => value => { setter(value); setChecked(false); setChanged(true); };
  return <>
    <p>A system call must treat a userspace pointer as untrusted. Repair the missing page in the default two-page buffer, then experiment with a kernel address, a boundary crossing, and read-only memory.</p>
    <div className={styles.fields}><Field label="User buffer start" value={pointer} onChange={update(setPointer)} /><Field label="Byte length (0–65536)" value={length} onChange={update(setLength)} /></div>
    <Toggle label="copy_to_user (off = copy_from_user)" checked={copyToUser} onChange={update(setCopyToUser)} />
    <div className={styles.permissionGrid}>{pages.map((page, index) => <fieldset key={index}><legend>{hex(0x800000 + index * PAGE)}</legend>{['present', 'user', 'write'].map(flag => <Toggle key={flag} label={flag.toUpperCase()} checked={page[flag]} onChange={value => update(setPages)(pages.map((entry, i) => i === index ? { ...entry, [flag]: value } : entry))} />)}</fieldset>)}</div>
    <div className={styles.actions}><button type="button" onClick={() => setChecked(true)}>Validate entire buffer</button></div>
    {checked && <Result success={valid}>{message}</Result>}
    <p className={styles.note}>Only the four shown pages can be mapped. This is a permission model with a stable address space. Production copy helpers also need fault recovery and protection against concurrent unmapping; checking once does not eliminate those races.</p>
    <Prediction question="How many pages does the current nonempty buffer touch?" expected={touched} ready={checked && changed && valid && touched >= 2} prerequisite="Make a valid buffer spanning at least two pages, then press “Validate entire buffer”. The default buffer needs its second page marked present." explanation="For nonzero length: floor((start + length − 1) / 4096) − floor(start / 4096) + 1. Count both partially touched end pages." onSolved={onSolved} />
  </>;
}

const initialFat = () => ['3', '4', '3', '0', '0', '0', '0', '0'];
function walkFat(entries, format) {
  const max = format === '12' ? 0xFFF : 0xFFFFFFFF;
  const mask = format === '12' ? 0xFFF : 0x0FFFFFFF;
  const bad = format === '12' ? 0xFF7 : 0x0FFFFFF7;
  const eoc = bad + 1, reserved = bad - 7;
  const visited = new Set(), path = [];
  let cluster = 2;
  for (let steps = 0; steps <= entries.length; steps += 1) {
    if (visited.has(cluster)) return { path, valid: false, message: `Cycle detected: cluster ${cluster} was already visited. Stop traversal and report the cycle.` };
    if (cluster < 2 || cluster >= entries.length + 2) return { path, valid: false, message: `Cluster ${cluster} is outside this eight-cluster data region.` };
    visited.add(cluster); path.push(cluster);
    const raw = parse(entries[cluster - 2], max);
    if (raw === null) return { path, valid: false, message: `Invalid ${format === '12' ? '12' : '32'}-bit FAT entry at cluster ${cluster}.` };
    const value = raw & mask;
    if (value >= eoc) return { path, valid: true, message: `End-of-chain at cluster ${cluster}. ${path.length} data clusters visited.` };
    if (value === bad) return { path, valid: false, message: `Bad-cluster marker at cluster ${cluster}; report an I/O/corruption error.` };
    if (value >= reserved || value === 1) return { path, valid: false, message: `Reserved FAT value ${hex(value)} at cluster ${cluster}; reject this reserved link value.` };
    if (value === 0) return { path, valid: false, message: `Cluster ${cluster} is marked free inside a live file chain. The filesystem is inconsistent.` };
    cluster = value;
  }
  return { path, valid: false, message: 'Traversal exceeded the volume cluster count; reject the chain.' };
}

function FatLab({ onSolved }) {
  const [format, setFormat] = useState('12');
  const [entries, setEntries] = useState(initialFat);
  const [walked, setWalked] = useState(false);
  const result = walkFat(entries, format);
  const required = Math.ceil(3000 / 1024);
  const enough = result.valid && result.path.length === required;
  return <>
    <p>A directory entry describes a 3000-byte file starting at cluster 2. Each cluster holds 1024 bytes. Its current FAT chain contains a cycle. Repair the entries and prove that a bounded traversal ends correctly.</p>
    <label className={styles.field}><span>Entry encoding (resets this small model)</span><select value={format} onChange={event => { setFormat(event.target.value); setEntries(initialFat()); setWalked(false); }}><option value="12">FAT12: 12-bit entries</option><option value="32">FAT32: low 28 bits of a 32-bit entry</option></select></label>
    <p className={styles.note}>{format === '12' ? 'EOC: 0xFF8–0xFFF. Bad: 0xFF7. Reserved: 0xFF0–0xFF6 and 1. Free: 0. Packed byte offset for cluster n is n + floor(n / 2); adjacent entries share a byte.' : 'EOC: 0x0FFFFFF8–0x0FFFFFFF. Bad: 0x0FFFFFF7. Mask off the high four bits when reading; preserve them when writing. This graph models FAT32 entries. A complete FAT32 volume also requires valid geometry and metadata.'}</p>
    <div className={styles.fatEntries}>{entries.map((value, index) => <Field key={index} label={`FAT[${index + 2}] →`} value={value} onChange={next => { setEntries(entries.map((entry, i) => i === index ? next : entry)); setWalked(false); }} />)}</div>
    <div className={styles.actions}><button type="button" onClick={() => setWalked(true)}>Walk from cluster 2</button><button type="button" onClick={() => { setEntries(initialFat()); setWalked(false); }}>Restore broken chain</button></div>
    {walked && <><div className={styles.pipeline} aria-label="Visited cluster chain">{result.path.map(cluster => <span key={cluster}>Cluster {cluster}</span>)}<span>{result.valid ? 'EOC' : 'STOP'}</span></div><Result success={enough}>{result.message} {result.valid && (enough ? 'Chain length matches the file’s required cluster count.' : `This file needs exactly ${required} clusters in this repair exercise; the chain has ${result.path.length}.`)}</Result></>}
    <Prediction question="After a correct repair, how many allocated bytes lie beyond the file’s 3000-byte logical end?" expected={72} ready={walked && enough} prerequisite="Repair the chain so it reaches EOC after exactly three distinct data clusters, then walk it." explanation="Allocated bytes = ceil(file size / cluster size) × cluster size. Subtract the logical file size; readers must not return this tail slack as file data." onSolved={onSolved} />
  </>;
}

const ELF_INITIAL = [
  { vaddr: '0x08048000', offset: '0x1000', filesz: '512', memsz: '384', align: '4096', flags: 'RX' },
  { vaddr: '0x08049000', offset: '0x2000', filesz: '256', memsz: '1024', align: '4096', flags: 'RW' },
];

function validateElf(segments) {
  const userLow = 0x00400000, userTop = 0xB0000000;
  const parsed = [];
  for (let index = 0; index < segments.length; index += 1) {
    const source = segments[index], segment = { flags: source.flags };
    for (const key of ['vaddr', 'offset', 'filesz', 'memsz', 'align']) {
      segment[key] = parse(source[key]);
      if (segment[key] === null) return { valid: false, message: `PT_LOAD ${index}: ${key} must be a 32-bit nonnegative integer.` };
    }
    if (segment.filesz > segment.memsz) return { valid: false, message: `PT_LOAD ${index}: p_filesz (${segment.filesz}) exceeds p_memsz (${segment.memsz}). The file bytes cannot fit in the memory image.` };
    if (segment.offset > 0x4000 || segment.filesz > 0x4000 - segment.offset) return { valid: false, message: `PT_LOAD ${index}: file range extends beyond the 16 KiB input file.` };
    if (segment.vaddr < userLow || segment.vaddr >= userTop || segment.memsz > userTop - segment.vaddr) return { valid: false, message: `PT_LOAD ${index}: memory range violates the course loader policy: start at or above 0x00400000, with an exclusive end no higher than 0xB0000000.` };
    if (segment.memsz === 0) return { valid: false, message: `PT_LOAD ${index}: this exercise requires nonempty segments. ELF can contain zero-sized loadable segments; a real loader may skip those.` };
    if (segment.align > 1 && (!Number.isInteger(Math.log2(segment.align)) || segment.vaddr % segment.align !== segment.offset % segment.align)) return { valid: false, message: `PT_LOAD ${index}: p_align must be 0, 1, or a power of two, and p_vaddr ≡ p_offset (mod p_align).` };
    if (segment.vaddr % PAGE !== segment.offset % PAGE) return { valid: false, message: `PT_LOAD ${index}: this page-based loader requires p_vaddr and p_offset to have the same 4 KiB page offset.` };
    if (segment.flags === 'RWX') return { valid: false, message: `PT_LOAD ${index}: this loader’s W^X policy rejects writable-and-executable segments. The loader chooses this security policy; ELF itself permits RWX segments.` };
    parsed.push(segment);
  }
  const [a, b] = parsed;
  if (a.vaddr < b.vaddr + b.memsz && b.vaddr < a.vaddr + a.memsz) return { valid: false, message: 'The PT_LOAD memory ranges overlap. This educational loader rejects overlaps explicitly.' };
  const pageStart = segment => Math.floor(segment.vaddr / PAGE) * PAGE;
  const pageEnd = segment => Math.ceil((segment.vaddr + segment.memsz) / PAGE) * PAGE;
  if (pageStart(a) < pageEnd(b) && pageStart(b) < pageEnd(a) && a.flags !== b.flags) return { valid: false, message: 'Segments share a physical mapping page but request different permissions. This loader rejects ambiguous shared-page permissions.' };
  return { valid: true, parsed, zero: parsed.reduce((sum, segment) => sum + segment.memsz - segment.filesz, 0), message: 'Accepted by this model: copy each file range to p_vaddr, zero [p_vaddr + p_filesz, p_vaddr + p_memsz), and apply final permissions.' };
}

function ElfLab({ onSolved }) {
  const [segments, setSegments] = useState(ELF_INITIAL);
  const [checked, setChecked] = useState(false);
  const result = validateElf(segments);
  const update = (index, field, value) => { setSegments(segments.map((segment, i) => i === index ? { ...segment, [field]: value } : segment)); setChecked(false); };
  return <>
    <p>Repair two ELF32 PT_LOAD headers. The file is 16 KiB; the first header deliberately claims less memory than file data. Use the same address policy as the lesson’s <code>segment_ok</code>: loadable bytes belong in [0x00400000, 0xB0000000), including the lower boundary and excluding the upper one. Section headers are not needed to load a process.</p>
    <div className={styles.elfSegments}>{segments.map((segment, index) => <fieldset key={index}><legend>PT_LOAD {index}</legend><div className={styles.fields}>{['vaddr', 'offset', 'filesz', 'memsz', 'align'].map(key => <Field key={key} label={`p_${key}`} value={segment[key]} onChange={value => update(index, key, value)} />)}<label className={styles.field}><span>Permissions</span><select value={segment.flags} onChange={event => update(index, 'flags', event.target.value)}>{['R', 'RX', 'RW', 'RWX'].map(flags => <option key={flags}>{flags}</option>)}</select></label></div></fieldset>)}</div>
    <div className={styles.actions}><button type="button" onClick={() => setChecked(true)}>Validate and map image</button><button type="button" onClick={() => { setSegments(ELF_INITIAL); setChecked(false); }}>Restore malformed ELF</button></div>
    {checked && <><Result success={result.valid}>{result.message}</Result>{result.valid && <div className={styles.memoryBars}>{result.parsed.map((segment, index) => <div key={index}><span>Segment {index} @ {hex(segment.vaddr)}</span><div className={styles.segmentBar}><span style={{ flexGrow: segment.filesz || 0 }} className={styles.fileBytes}>File: {segment.filesz} B</span>{segment.memsz > segment.filesz && <span style={{ flexGrow: segment.memsz - segment.filesz }} className={styles.zeroBytes}>Zero: {segment.memsz - segment.filesz} B</span>}</div></div>)}</div>}</>}
    <p className={styles.note}>This validates selected program-header rules and stricter loader policies. A complete loader must also validate the ELF header, architecture, endianness, header-table bounds, entry point, resource limits, and page ownership. Legacy non-PAE x86 cannot enforce NX per page; executable permissions require suitable hardware support.</p>
    <Prediction question="How many bytes across both segments must the loader explicitly zero?" expected={result.valid ? result.zero : null} ready={checked && result.valid} prerequisite="Repair the malformed header and validate both loadable segments." explanation="For each PT_LOAD, zero p_memsz − p_filesz bytes after the copied file data, then add the two counts. The excess is commonly .bss; it has no stored file payload." onSolved={onSolved} />
  </>;
}

const LABS = {
  gdt: ['Build a segment descriptor', GdtLab],
  interrupts: ['An interrupt’s round trip', InterruptLab],
  memory: ['Manage physical frames', MemoryLab],
  paging: ['Walk a virtual address', PagingLab],
  heap: ['Allocate, fragment, coalesce', HeapLab],
  scheduler: ['Run the scheduler', SchedulerLab],
  privilege: ['Cross the trust boundary', PrivilegeLab],
  fat: ['Repair a cluster chain', FatLab],
  elf: ['Load a process image', ElfLab],
};

export default function ConceptLab({ type = 'gdt', onSolved }) {
  const [title, Lab] = LABS[type] || LABS.gdt;
  return <section className={styles.lab} aria-label={`${title} interactive concept lab`}>
    <div className={styles.labHeader}><span className={styles.eyebrow}>Interactive concept lab</span><span className={styles.badge}>Interactive concept simulation</span></div>
    <h3>{title}</h3>
    <Lab key={type} onSolved={onSolved} />
  </section>;
}
