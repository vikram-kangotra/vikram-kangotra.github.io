// Original teaching models and worked examples. Hosted APIs are labeled explicitly.
const ost = (file, section) => ({ label: 'OSTEP: ' + section, url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/' + file + '.pdf', section });
const osc = section => ({ label: 'Operating System Concepts, tenth edition: ' + section, url: 'https://www.os-book.com/OS10/slide-dir/index.html', section });
const ref = (label, url, section) => ({ label, url, section });
const prose = (title, ...paragraphs) => ({ type: 'prose', title, paragraphs });
const table = (caption, columns, rows) => ({ type: 'table', caption, columns, rows });
const trace = (caption, columns, rows) => ({ type: 'trace', caption, columns, rows });
const code = (title, language, source, ...notes) => ({ type: 'code', title, language, code: source, notes });
const steps = (title, items) => ({ type: 'steps', title, items: items.map(([title, text]) => ({ title, text })) });
const exercise = (title, prompt, tasks, solution, checks) => ({ type: 'exercise', title, prompt, tasks, solution, checks });
const flow = (title, intro, nodes, edges, caption) => ({ type: 'flow', title, intro, nodes: nodes.map(([id,label,detail,kind='process'])=>({id,label,detail,kind})), edges: edges.map(([from,to,label])=>({from,to,...(label?{label}:{})})), caption });
const topic = (id, sectionId, title, intro, blocks, references) => ({id,sectionId,title,intro,blocks,references});
export const systemsHandbook = {};

systemsHandbook['threads-and-scheduling'] = [
  topic('process-lifecycle-pcb', 'continuation', 'Build the process record and trace fork, exec, exit, and wait', [
    'A process is an ownership and protection unit: its address space, descriptor table, credentials, and lifecycle belong together. A thread is one execution stream inside that unit. Two threads can share a heap while having different stacks, register values, and scheduling states. Record that distinction explicitly so a context switch, a process exit, and closing one descriptor each release the correct resources.',
    'The process control block, or PCB, is the kernel record through which these responsibilities become concrete. Its fields contain identifiers and references to owned or shared objects. A pointer in the PCB therefore needs a lifetime rule. A process may retain a reference to a shared open-file object while another process closes its own descriptor referring to that same object.'
  ], [
    table('A small process and thread model', ['Record', 'Illustrative fields', 'Ownership rule'], [
      ['Process', 'pid, parent, exit_status, address_space, files, credentials', 'Address-space and descriptor-table references survive while the process can execute. Exit status survives until collection.'],
      ['Thread', 'tid, process, saved_sp, kernel_stack, run_state, wait_channel', 'The scheduler owns queue membership. Stack reclamation occurs after execution has moved elsewhere.'],
      ['Open file description', 'object, offset, access_mode, reference_count', 'Duplicated descriptors can share offset and access mode. Removing one descriptor drops one reference.'],
      ['Wait record', 'child identifier, termination status, notification state', 'A parent observes termination once through a serialized collection path.']
    ]),
    prose('Separate creation from publication',
      'Constructing a PCB is a transaction. Reserve an identifier, allocate a kernel stack, create or retain address-space mappings, copy the descriptor table while incrementing object references, and prepare the child continuation. Only then make the child runnable. If the fifth allocation fails, undo the first four in reverse ownership order. A partially initialized child must remain invisible to the scheduler because its first instruction could otherwise use missing memory.',
      'Under a traditional fork interface, the child initially sees a virtual memory snapshot of its parent and receives return value zero; the parent receives the child identifier. Copy-on-write can implement the snapshot by sharing read-only frames until a write fault creates a private copy. File descriptors often refer to shared open-file descriptions, so a file position can remain shared even while ordinary heap writes become private. These are separate sharing decisions.'),
    trace('Parent 41 starts a command in child 58', ['Event', 'Parent state', 'Child state', 'Important resource change'], [
      ['fork succeeds', 'RUNNABLE; result 58', 'RUNNABLE; result 0', 'Both descriptor 4 entries refer to open-file object F, offset 100.'],
      ['child reads 12 bytes from fd 4', 'Unchanged execution state', 'Runs library and kernel read paths', 'Shared object F now has offset 112; a later parent read begins there.'],
      ['child execs another image', 'Still owns its old image', 'Same process identifier 58; new mappings and entry stack', 'Executable replacement commits after validation. Close-on-exec descriptors are closed.'],
      ['child exits with status 7', 'May still be runnable', 'No longer runnable; termination record retained', 'Address space and ordinary open descriptors are released; collection data remains.'],
      ['parent waits for 58', 'Receives identifier 58 and encoded status', 'Termination record collected', 'Final process bookkeeping can be reclaimed safely.']
    ]),
    prose('Understand replacement and collection',
      'An exec operation replaces the calling process image. It validates the executable, constructs a usable address space and startup stack, and commits the replacement so execution begins at the new entry point. A successful exec never returns to its old instruction stream. For this teaching loader, a failed exec returns an error while preserving a usable old process. A first teaching implementation can require a single-threaded caller; production behavior also needs rules for the other threads, signal state, and descriptor flags.',
      'A terminated process awaiting collection is commonly called a zombie. Its remaining record allows a parent to learn why the child stopped. Keeping its entire user address space would waste memory; deleting every record immediately would lose the result. If the parent exits first, define who adopts and collects children. If two parent threads wait concurrently, serialize the act of claiming a child result to prevent duplicate collection.',
      'The distinction also guides debugging. A process with no runnable threads may be correctly waiting for disk completion. A process with a runnable thread that never receives service exposes scheduling policy. A termination record that accumulates after children finish exposes a missing wait path. Start from the lifecycle and its retained objects before changing timer settings.'),
    exercise('Account for shared and private state', 'Parent 41 has an integer x=9 and descriptor 4 at offset 100. It forks, the child changes x to 20, reads 12 bytes, and then exits.',
      ['Predict the parent’s x and next file offset under snapshot memory and shared open-file descriptions.', 'Describe rollback if child stack allocation fails, and identify what must remain until wait completes.'],
      ['The parent retains x=9 because the child writes its own logical address-space snapshot. The shared open-file description advances to offset 112, so the parent’s next read starts at 112.', 'A failed creation publishes no runnable child and releases each acquired reference or allocation. After successful child exit, retain its identifier, parent relationship, and status until collection; reclaim its active memory and file references according to their ownership rules.'],
      ['Parent x=9; shared offset=112.', 'No runnable half-child; one collection of exit status.'])
  ], [ost('cpu-api','Chapter 5: Process API'), osc('Chapter 3: Processes')]),

  topic('scheduling-gantt-metrics', 'measure', 'Derive FCFS, SJF, and SRTF from one arrival trace', [
    'A scheduler trace needs a workload, a selection rule, and accounting conventions. Here one CPU executes one job at a time; CPU bursts are known exactly; jobs perform no I/O; context switches cost zero; ties preserve arrival order. The interval [2,4) includes time 2 and ends immediately before time 4. Recording intervals this way makes arrivals and completions unambiguous.',
    'For job i, arrival A_i is when it becomes eligible, first service S_i is when it first runs, completion C_i is when its final CPU work finishes, and burst B_i is its total CPU demand. Turnaround is C_i-A_i. Response is S_i-A_i. With no I/O, waiting is C_i-A_i-B_i. With blocked periods, subtract those periods too; a thread waiting for disk is outside the ready queue.'
  ], [
    table('One original workload used for all three policies', ['Job', 'Arrival', 'CPU burst'], [['A','0','7'],['B','2','4'],['C','4','1'],['D','5','3']]),
    trace('Gantt intervals and the reason for each choice', ['Policy', 'Execution intervals', 'Selection reasoning'], [
      ['FCFS', 'A [0,7), B [7,11), C [11,12), D [12,15)', 'Run each job to completion in arrival order. Arrivals join the tail.'],
      ['SJF, nonpreemptive', 'A [0,7), C [7,8), D [8,11), B [11,15)', 'A is the only job at time 0. At time 7, choose bursts 1, then 3, then 4.'],
      ['SRTF, preemptive', 'A [0,2), B [2,4), C [4,5), B [5,7), D [7,10), A [10,15)', 'At time 2 B needs 4 while A needs 5. At time 4 C needs 1 while B needs 2. At time 5 B still wins over D’s 3.']
    ]),
    table('Every metric derived from the intervals', ['Policy', 'Completion A/B/C/D', 'Waiting A/B/C/D', 'Response A/B/C/D', 'Mean turnaround'], [
      ['FCFS','7 / 11 / 12 / 15','0 / 5 / 7 / 7','0 / 5 / 7 / 7','(7+9+8+10)/4 = 8.5'],
      ['SJF','7 / 15 / 8 / 11','0 / 9 / 3 / 3','0 / 9 / 3 / 3','(7+13+4+6)/4 = 7.5'],
      ['SRTF','15 / 7 / 5 / 10','8 / 1 / 0 / 2','0 / 0 / 0 / 2','(15+5+1+5)/4 = 6.5']
    ]),
    prose('Derive the optimization before trusting it',
      'Suppose two available jobs have lengths x and y with x greater than y. Running x then y makes their completion-time sum 2x+y. Running y then x makes it x+2y. Swapping them reduces that sum by x-y. Repeating this exchange argument produces shortest-job order for jobs available together, under our zero-overhead assumptions. Release times and preemption change the admissible choices, which is why the first SJF interval still belongs to A.',
      'SRTF repeats the shortest-work comparison when an arrival or completion changes the eligible set. The stored key is remaining work. Comparing B’s original burst 4 with A’s remaining work 3 halfway through execution would mix different quantities. With a heap, arrival insertion and selecting or updating the minimum cost O(log n), while a simple scan costs O(n). A teaching simulator can prefer scanning because its state is easy to inspect.',
      'Real systems estimate future CPU bursts. An exponential predictor can use next_estimate = alpha*last_burst + (1-alpha)*old_estimate. With alpha=1/2, old estimate 10 and observed burst 4, the new estimate is 7. That number is a prediction; applications can change behavior immediately afterward. A useful experiment varies the estimate while preserving the measured burst to expose how misprediction changes policy outcomes.'),
    steps('Build an event-driven simulator', [
      ['Represent remaining work', 'Keep arrival, original burst, remaining burst, first-start sentinel, and completion time separately. First start is written exactly once.'],
      ['Advance to the next event', 'Run until completion or the next arrival that can cause preemption. If the ready set is empty, jump to the next arrival and record idle time.'],
      ['Update all boundaries', 'Subtract the actual interval from the running job. Admit arrivals at the boundary before applying the stated tie rule. Complete jobs with zero remaining work.'],
      ['Check conservation', 'The timeline supplies exactly 15 CPU units here. Each job receives its own burst total and every waiting interval occurs after arrival and before completion.']
    ]),
    prose('Use the averages with a workload explanation',
      'The mean waiting times are 4.75, 3.75, and 2.75 for FCFS, SJF, and SRTF respectively. Yet A finishes eight units later under SRTF than under FCFS. An endless stream of sufficiently short jobs could repeatedly postpone a large job. Add aging or a service guarantee if long-job progress matters. Mean improvement alone says little about the maximum delay seen by one client.',
      'Adding a switch cost changes both the elapsed timeline and arrivals relative to service. Charge the switch interval explicitly and identify whether switching to idle or starting the first task has a cost. A result calculated with zero overhead should remain labeled as a policy model when compared with kernel measurements.'),
    exercise('Recompute a changed burst', 'Change C’s burst from 1 to 6 while retaining every arrival. Apply SRTF with the current job winning equal remaining-time ties.',
      ['Write the complete timeline and A’s completion time.', 'Explain whether C should preempt B at time 4.'],
      ['A runs [0,2), B [2,6), D [6,9), A [9,14), and C [14,20). A therefore completes at 14. At time 5 B has one unit left and continues.', 'At time 4 B has two units left; C requires six. B continues because its remaining demand is smaller. Comparing original bursts would conceal the work already completed.'],
      ['Total execution is 20 units.', 'Completion order B, D, A, C.'])
  ], [ost('cpu-sched','Chapter 7: CPU Scheduling'), osc('Chapter 5: CPU Scheduling')]),

  topic('round-robin-priority-mlfq', 'states', 'Implement round robin, priorities, and feedback queues with explicit budgets', [
    'Round robin gives each eligible thread a bounded turn called a quantum. A thread that finishes or blocks releases the CPU immediately. A thread whose quantum expires joins the queue tail. Keep queue membership separate from the currently running slot so an enqueue operation cannot accidentally award a thread two turns.',
    'Priority scheduling chooses from the highest eligible priority first. Equal-priority tasks still need a tie rule such as round robin. A priority value encodes policy; define whether a lower or higher numeric value wins before writing a comparison. The examples here call Q0 the highest-priority queue.'
  ], [
    trace('Round robin with quantum 2 and all arrivals at zero', ['Interval', 'Runs', 'Remaining A/B/C afterward', 'Ready queue afterward'], [
      ['[0,2)','A','3 / 3 / 1','B,C,A'],['[2,4)','B','3 / 1 / 1','C,A,B'],['[4,5)','C','3 / 1 / 0','A,B'],['[5,7)','A','1 / 1 / 0','B,A'],['[7,8)','B','1 / 0 / 0','A'],['[8,9)','A','0 / 0 / 0','empty']
    ]),
    prose('Calculate responsiveness and the cost of a turn',
      'The three bursts are A=5, B=3, and C=1. Their first service times are 0, 2, and 4, so mean response is 2. Their completion times are 9, 8, and 5, and their waits are 4, 5, and 4. A short quantum gives waiting peers frequent opportunities, while increasing how often the machine saves state and disturbs caches. For a saturated workload with useful quantum q and switch cost s, the simple useful-time fraction is q/(q+s). With q=2 ms and s=0.1 ms it is about 95.24%. This estimate ignores blocking and cache costs beyond s.',
      'A low-priority lock owner can delay a high-priority waiter if medium-priority work repeatedly preempts the owner. Priority inheritance temporarily raises the owner’s effective priority to reflect the dependency. The owner releases the lock sooner, then its inherited priority is removed or recomputed from remaining waiters. Aging solves a different problem: it raises the priority of tasks that have waited a long time even without a lock dependency.'),
    table('A complete illustrative MLFQ policy', ['Rule', 'Value', 'Reason for recording it'], [
      ['Queues', 'Q0, Q1, Q2; Q0 highest', 'Only the highest nonempty queue supplies the running task.'],
      ['Quanta', '2, 4, 8 time units', 'Lower queues amortize switches for long CPU bursts.'],
      ['Per-level CPU allotment', '2 at Q0, 4 at Q1; unlimited at Q2', 'CPU use accumulates across early yields and I/O episodes.'],
      ['New task', 'Enter Q0', 'Initially unknown work receives a prompt first opportunity.'],
      ['Boost', 'Every 20 units, move all live tasks to Q0 and reset allotment', 'Blocked tasks retain the boosted level when they wake. Queue ordering at the boost is defined deterministically.'],
      ['Preemption', 'A higher-queue arrival preempts; retain used allotment', 'An interrupted lower-priority slice cannot regain spent budget.']
    ]),
    trace('A needs 9 units; B arrives at 3 and needs 1', ['Interval', 'Task and queue', 'Accounting at the end'], [
      ['[0,2)','A at Q0','A consumed its 2-unit allotment and moves to Q1 with 7 remaining.'],
      ['[2,3)','A at Q1','One of four Q1 units consumed. B arrives in Q0 and preempts.'],
      ['[3,4)','B at Q0','B completes. A still has three Q1 allotment units.'],
      ['[4,7)','A at Q1','A uses the remaining three Q1 units; 3 total work units remain.'],
      ['[7,10)','A at Q2','A completes before its 8-unit quantum expires.']
    ]),
    code('Budget update at a scheduling event', 'text', `used = now - dispatch_time
remaining_work -= used
level_cpu_used += used
if finished: transition to DEAD
else if blocked: leave run queue, retain level_cpu_used
else if level_cpu_used >= allotment[level]:
    level = min(level + 1, LAST_LEVEL)
    level_cpu_used = 0
    append to queue[level]
else: append to queue[level]`,
      'This model assumes dispatch intervals end exactly at the relevant budget boundary. A real timer must handle overshoot explicitly and charge all consumed time.',
      'The blocked branch retains accounting. A task repeatedly yielding just before a timer fires therefore still exhausts its cumulative allotment.'),
    prose('Test transitions, including adversarial ones',
      'A feedback queue interprets observed behavior, so it needs a policy for workload phase changes. A formerly CPU-bound task may become interactive. Periodic boosts provide another opportunity at high priority, while cumulative accounting prevents tiny deliberate sleeps from manufacturing unlimited high-priority service. Record boost ordering, wakeup placement, and preemption behavior in tests because different reasonable choices produce different Gantt charts.',
      'A timer interrupt also interacts with locks and preemption depth. The handler can set a reschedule flag while a protected region defers the switch. The eventual dispatch must charge the whole elapsed running interval. Forgetting the deferred portion both understates CPU use and rewards tasks that enter long critical sections.'),
    exercise('Expose a feedback accounting bug', 'A Q0 task has a two-unit allotment. It runs for 1.5 units, blocks briefly, wakes, and runs for another 0.5.',
      ['State its next queue under cumulative accounting.', 'Explain the result if every wake resets used time, and give one relevant test.'],
      ['The task has consumed 2 total Q0 CPU units and is demoted to Q1 at the next budget boundary. Its blocked time consumes no CPU allotment.', 'Resetting use on every wake lets repeated 1.5-unit bursts remain in Q0 indefinitely. A deterministic test should repeat this sequence and assert that total charged CPU, across all bursts, triggers demotion.'],
      ['Charged use is 1.5+0.5=2.', 'Blocked duration never increases charged CPU use.'])
  ], [ost('cpu-sched-mlfq','Chapter 8: Multi-Level Feedback Queue'), osc('Chapter 5: Priority and multilevel feedback scheduling')]),

  topic('weighted-fair-share-lottery', 'measure', 'Turn CPU shares into tickets, stride values, and measurable service', [
    'A proportional-share scheduler assigns a weight to each runnable client. If A has weight 3 and B has weight 1, the target is that A receives three quarters of the available CPU while both remain runnable. A blocked client temporarily leaves the competition. Weights describe relative entitlement among eligible clients, so a lone runnable task can use the whole CPU.',
    'The word client deserves a design decision. Awarding every process an equal share lets a user gain service by starting more processes. A hierarchy can allocate half the machine to each of two users and then divide each user’s allocation among that user’s runnable processes. The measured entity and the scheduling entity must match the fairness claim.'
  ], [
    table('User shares and process shares are different accounting levels', ['Configuration', 'User U has three tasks', 'User V has one task'], [
      ['Equal shares per task','U gets 3/4 in total; each task 1/4','V gets 1/4'],
      ['Equal shares per user, then per task','U gets 1/2 in total; each task 1/6','V gets 1/2']
    ]),
    prose('A lottery implements probability',
      'Give A tickets 0 through 2 and B ticket 3. Draw uniformly from the four ticket values each scheduling decision, then run the owner for one quantum. An unbiased generator matters: mapping a source range to tickets with a remainder operation can bias outcomes unless the source range is an exact multiple of the total tickets or rejection sampling removes the excess.',
      'For N independent draws, B’s service count has expected value N/4 and variance N*(1/4)*(3/4). At N=16, the expectation is 4 and standard deviation is sqrt(3), approximately 1.73. The possibility of short-term imbalance is part of the algorithm. A particular trace with B selected once in sixteen draws is unusual but possible. Tests should verify interval ownership and the random-selection procedure; requiring an exact 3:1 split in every four turns would reject valid lotteries.'),
    trace('A deterministic stride alternative', ['Turn', 'Selected', 'Pass A/B before', 'Pass A/B after'], [
      ['1','A','0 / 0','4 / 0'],['2','B','4 / 0','4 / 12'],['3','A','4 / 12','8 / 12'],['4','A','8 / 12','12 / 12'],['5','A','12 / 12','16 / 12'],['6','B','16 / 12','16 / 24'],['7','A','16 / 24','20 / 24'],['8','A','20 / 24','24 / 24']
    ]),
    prose('Derive the stride update',
      'Choose scale K=12 and define stride=K/weight. A’s stride is 4 and B’s is 12. Select the runnable task with smallest pass value, with A winning ties in this trace, then add that task’s stride. The eight turns give A six quanta and B two. A smaller increment lets a larger-weight task return to the minimum sooner. Pass behaves like service measured in inverse-weight units.',
      'Finite integers introduce implementation choices. A small scale rounds many different weights to the same stride, while zero stride would let a task monopolize the minimum. Use a documented weight range, sufficient scale, and nonzero strides. Prevent counter overflow by periodically subtracting a shared base from all pass values, preserving their differences. A task waking after a long sleep needs placement near current virtual time; restoring a very stale minimum can award a large catch-up burst.'),
    code('A bounded selector for a static runnable set', 'c', `#include <stddef.h>
#include <stdint.h>
struct share_task { uint64_t pass, stride; int runnable; };
int least_pass(const struct share_task *tasks, size_t count) {
    int best = -1;
    if (count > 1024 || (count && !tasks)) return -1;
    for (size_t i = 0; i < count; ++i)
        if (tasks[i].runnable &&
            (best < 0 || tasks[i].pass < tasks[best].pass))
            best = (int)i;
    return best;
}`,
      'The lowest index wins a tie. Selection scans at most 1024 records and returns -1 when no task is eligible.',
      'The caller serializes mutations and performs checked pass updates. Selection alone provides neither context switching nor a wakeup-placement policy.'),
    prose('Relate the model to weighted virtual runtime',
      'Another design charges elapsed CPU time multiplied by a reference weight and divided by the task’s weight. The smallest accumulated virtual runtime receives preference. Running for two milliseconds at twice the weight adds the same virtual service as one millisecond at the reference weight. This arithmetic describes a family of fair schedulers; it does not fix every production scheduler’s exact queue, latency, eligibility, or deadline rules.',
      'To measure service, report both actual CPU time and the interval during which each task was runnable. A task asleep for most of an experiment should not be treated as having been denied its entire wall-clock entitlement. For a hierarchy, aggregate CPU use at each level and compare it with the weight shares active during that interval.'),
    exercise('Change the entitlement', 'Use K=30 for runnable tasks A with weight 3, B with weight 2, and C with weight 1. All pass values begin at zero and ties choose alphabetically.',
      ['Derive the strides and the first six selections.', 'Give the expected service fractions for a ticket lottery using the same weights.'],
      ['Strides are 10, 15, and 30. Selections are A, B, C, A, B, A. After six turns the pass values are all 30, and service counts are 3, 2, and 1.', 'The ticket fractions are 3/6, 2/6, and 1/6. These are expectations over random draws; the stride trace reaches the exact ratio in this particular six-turn example.'],
      ['Final pass vector 30/30/30.', 'Ticket probabilities sum to one.'])
  ], [ost('cpu-sched-lottery','Chapter 9: Proportional-Share Scheduling'), osc('Chapter 5: Scheduling evaluation')]),

  topic('real-time-edf-rate-monotonic', 'preemption', 'Analyze periodic deadlines with EDF and rate-monotonic scheduling', [
    'A real-time job has a release time, a worst-case execution demand, and a deadline. Finishing the computation after its deadline can make the result useless even when its value is correct. Hard real-time design requires a justified upper bound on demand and interference. An average observed runtime cannot supply that bound.',
    'Use a uniprocessor model with independent, fully preemptible periodic tasks, no shared-resource blocking, zero scheduling overhead, and deadlines equal to periods. Task A releases every 4 units and needs 1 unit; task B releases every 6 units and needs 2. Each release creates a new job. The common repeating window is lcm(4,6)=12 units.'
  ], [
    table('Task parameters and utilization', ['Task', 'Execution C', 'Period and relative deadline T', 'Utilization C/T'], [['A','1','4','1/4'],['B','2','6','1/3'],['Total','','','7/12, approximately 0.5833']]),
    trace('One deadline-safe schedule over [0,12)', ['Interval', 'Job', 'Absolute deadline', 'Result'], [
      ['[0,1)','A0','4','Completes at 1.'],['[1,3)','B0','6','Completes at 3.'],['[3,4)','idle','None','No eligible work.'],['[4,5)','A1','8','Completes at 5.'],['[5,6)','idle','None','No eligible work.'],['[6,8)','B1','12','Completes at 8.'],['[8,9)','A2','12','Completes at 9.'],['[9,12)','idle','None','All released jobs have completed.']
    ]),
    prose('Compare static and dynamic priorities',
      'Rate-monotonic scheduling gives the shorter period higher static priority, so A always outranks B. Earliest-deadline-first, or EDF, chooses the released unfinished job with the closest absolute deadline. Both produce the displayed schedule for this workload under the stated tie rule. At time 8, B’s second job has already completed, so the simultaneous deadline at 12 creates no conflict.',
      'For this ideal implicit-deadline task model, EDF can schedule the task set when total utilization is at most one. Rate-monotonic scheduling has the sufficient bound n*(2^(1/n)-1). With two tasks that bound is about 0.8284; our 0.5833 is below it. Exceeding the sufficient bound requires a stronger test. It does not alone prove that deadlines will be missed. Different deadlines, release jitter, blocking, and multiprocessor placement require different analysis.'),
    steps('Use response-time analysis for fixed priorities', [
      ['Choose a task', 'For task i, collect worst-case execution C_i, blocking B_i, and every higher-priority task’s execution and period. The response includes execution and interference before completion.'],
      ['Start a fixed-point iteration', 'Set R=C_i+B_i. Recompute R_next=C_i+B_i+sum(ceil(R/T_h)*C_h). Each ceiling counts higher-priority releases that can interfere during the candidate response window.'],
      ['Stop with an explanation', 'If R_next equals R, the bound has converged. Compare it with the relative deadline. If it exceeds the deadline, this task fails the model’s schedulability test.'],
      ['Apply to B', 'Start R=2. Compute 2+ceil(2/4)*1=3. Recompute 2+ceil(3/4)*1=3. B’s worst-case response bound is 3, within its deadline 6.']
    ]),
    prose('See why the assumptions matter',
      'Suppose a lower-priority task holds a lock that A needs for a bounded 2-unit critical section. A’s one-unit computation can now wait for that owner. The simple utilization calculation omitted this delay. A priority-inheritance or priority-ceiling protocol changes the interference model and can bound some forms of inversion, but the critical section still consumes time. Include its maximum blocking contribution before claiming a deadline guarantee.',
      'An interrupt handler can also consume CPU time outside ordinary task budgets. If a device interrupts at a bounded rate, incorporate that interference. If no rate bound exists, the scheduler alone cannot guarantee service. Memory faults, allocator pauses, cache misses, and device queues matter whenever they can lie on the critical path. A first educational real-time model can deliberately exclude them while listing those exclusions beside its results.',
      'Admission control decides whether accepting a new periodic task preserves the analyzed guarantees. Overload policy decides what happens when actual demand exceeds assumptions: reject work, shed optional jobs, reduce quality, or signal a missed deadline. Specify whether unfinished jobs carry into the next period or are discarded; retaining them without a budget can amplify overload.'),
    exercise('A utilization bound that is inconclusive', 'A has C=2,T=5 and B has C=3,T=7. Deadlines equal periods and the ideal single-CPU assumptions hold.',
      ['Calculate total utilization and compare it with the two-task rate-monotonic sufficient bound.', 'Run the response-time iteration for lower-priority B and decide whether both tasks meet deadlines.'],
      ['Utilization is 2/5+3/7=29/35, approximately 0.828571. This slightly exceeds approximately 0.828427, so the simple bound is inconclusive.', 'A completes within 2 units. For B, start R=3, then 3+ceil(3/5)*2=5; recomputing with R=5 still gives 5. B therefore has response bound 5, within deadline 7, and this task set passes exact fixed-priority response-time analysis under the model.'],
      ['U=29/35.', 'B converges at R=5.'])
  ], [osc('Chapter 5: Real-time CPU scheduling'), ref('Liu and Layland original scheduling paper', 'https://dl.acm.org/doi/10.1145/321738.321743', 'Periodic scheduling model and utilization bounds')])
];

systemsHandbook['ipc-and-synchronization'] = [
  topic('atomic-publication-and-locks', 'locks', 'Separate atomic updates, memory ordering, and object lifetime', [
    'An atomic operation has one indivisible effect on the designated atomic object. A counter increment implemented as a load, addition, and store has three separately observable steps. Two CPUs can both load 10, both compute 11, and both store 11. The intended two increments have produced only one. An atomic fetch-add establishes a single ordering of updates to that counter.',
    'A second question is when surrounding data becomes visible. A message can contain ordinary payload bytes and an atomic ready flag. The consumer needs a rule that connects observing readiness with observing the completed payload. Acquire and release ordering provide that connection when the acquire reads the released value through the required synchronization relationship.'
  ], [
    trace('Why an ordinary increment loses an update', ['Step', 'CPU A', 'CPU B', 'Shared value'], [['1','load -> 10','idle','10'],['2','compute 11','load -> 10','10'],['3','store 11','compute 11','11'],['4','continue','store 11','11']]),
    code('One-shot publication with an explicit C11 contract', 'c', `#include <stdatomic.h>
struct message {
    unsigned payload;
    atomic_uint ready;
};
void message_init(struct message *m) {
    m->payload = 0;
    atomic_init(&m->ready, 0);
}
void publish_once(struct message *m, unsigned value) {
    m->payload = value;
    atomic_store_explicit(&m->ready, 1, memory_order_release);
}
int try_read_once(struct message *m, unsigned *out) {
    if (!atomic_load_explicit(&m->ready, memory_order_acquire))
        return 0;
    *out = m->payload;
    return 1;
}`,
      'Initialize before sharing. Exactly one producer publishes once, and no thread modifies the payload afterward. The object and output pointer remain alive for each call.',
      'The successful acquire observation orders the subsequent payload read after the producer’s earlier payload write. Returning zero gives a nonblocking retry opportunity.',
      'This example explains the language memory model. A particular freestanding target still needs compiler support for its chosen atomic width and any required runtime helpers.'),
    prose('Follow the happens-before path',
      'Within the producer, payload initialization is sequenced before the release store. The consumer’s acquire load that observes ready=1 synchronizes with that release. Its later payload read is therefore ordered after the initialization. The chain is the proof. Changing both flag accesses to relaxed preserves indivisible flag access but removes this publication guarantee for ordinary payload memory.',
      'Volatile describes access requirements useful for some hardware-facing objects. It does not provide this inter-thread synchronization relationship. Similarly, disabling interrupts affects the local CPU’s interrupt delivery; another CPU can still run. Match the mechanism to all execution agents that can access the state. A device performing DMA introduces additional ownership and cache-coherency requirements discussed in the block-device handbook.'),
    table('Choose the guarantee the operation actually needs', ['Mechanism', 'Useful guarantee', 'Additional responsibility'], [
      ['Relaxed atomic counter','Indivisible updates and an atomic modification order','No general publication of adjacent ordinary data.'],
      ['Release/acquire handoff','Prior producer writes become ordered before consumer use when synchronization occurs','Ensure the observed flag identifies the intended generation.'],
      ['Mutex lock/unlock','Exclusive access with synchronization between owners','Keep every access to the protected invariant within the protocol.'],
      ['Reference ownership','An object remains allocated while a valid reference is held','Acquire the reference through a protected lookup; an already freed pointer cannot safely be rescued.']
    ]),
    prose('Extend the proof to a lock',
      'A test-and-set spinlock atomically changes an unlocked flag to locked and reports its old value. Exactly one contender observes the unlocked state and enters. Use acquire ordering for successful ownership and release ordering when unlocking. The protected structure can then use ordinary accesses while the lock is held. Busy waiting consumes a CPU, so use it only when the owner can run and the protected operation is short.',
      'Compare-and-exchange checks an expected value and updates only if it still matches. A weak comparison may fail spuriously and therefore belongs in a retry loop. Even a successful comparison protects only the compared value. If a pointer changes from object A to B and then back to the same numeric address after reuse, a comparison may miss the intervening lifetime change. This ABA problem needs a suitable generation or reclamation scheme; adding an atomic pointer by itself leaves lifetime unresolved.'),
    exercise('Attempt a second publication', 'After publishing payload 37, the producer resets ready to zero and immediately writes payload 52 while a consumer may still be reading 37.',
      ['Identify the new race and explain why release/acquire on ready alone is insufficient.', 'Describe a correct ownership handoff for repeated reuse.'],
      ['The producer can overwrite the non-atomic payload while a consumer still accesses it. The first acquire allowed a read of the completed first message; it did not reserve the slot against later reuse.', 'Add an acknowledged empty/full state protocol in which only the producer owns an empty slot and only the consumer owns a full slot. The consumer releases the empty state after its final payload access; the producer acquires that state before rewriting. A mutex around each full transaction is another valid design.'],
      ['Every payload write occurs under exclusive slot ownership.', 'The previous consumer finishes before reuse begins.'])
  ], [ost('threads-locks','Chapter 28: Locks'), ref('GCC atomic builtins', 'https://gcc.gnu.org/onlinedocs/gcc/_005f_005fatomic-Builtins.html', 'Acquire, release, relaxed, and compare-exchange semantics'), osc('Chapter 6: Synchronization tools')]),

  topic('monitor-producer-consumer', 'lost-wakeup', 'Build a bounded buffer with mutexes, semaphores, and condition variables', [
    'A bounded buffer has two predicates: consumers can remove an item when count is greater than zero, and producers can insert when count is less than capacity. The count, head, tail, and slots form one invariant. A mutex gives one thread at a time permission to inspect and modify that invariant. A condition variable lets a thread release the mutex and sleep while a predicate is false.',
    'A monitor packages the shared state and its synchronized operations behind one interface. In the monitor used here, condition waiting atomically registers the waiter and releases the mutex, then returns with the mutex reacquired. Notifications make waiters eligible to run. Each awakened thread tests its predicate again because another thread can consume the resource before it acquires the mutex.'
  ], [
    code('Monitor algorithm for a byte queue with clean shutdown', 'text', `put(byte):
    lock(mutex)
    while count == capacity and not closed:
        wait(space_available, mutex)
    if closed:
        unlock(mutex)
        return CLOSED
    slots[tail] = byte
    tail = (tail + 1) mod capacity
    count = count + 1
    signal(data_available)
    unlock(mutex)
    return OK

get():
    lock(mutex)
    while count == 0 and not closed:
        wait(data_available, mutex)
    if count == 0:
        unlock(mutex)
        return EOF
    byte = slots[head]
    head = (head + 1) mod capacity
    count = count - 1
    signal(space_available)
    unlock(mutex)
    return BYTE(byte)

close():
    lock(mutex)
    closed = true
    broadcast(data_available)
    broadcast(space_available)
    unlock(mutex)`,
      'Capacity is positive and fixed. Head, tail, count, closed, and all slots are accessed under this mutex. Wait atomically releases and reacquires that same mutex.',
      'Close rejects future insertions while preserving buffered bytes for readers. Broadcast lets all blocked readers and writers discover the terminal state.'),
    trace('Two consumers compete for one produced byte', ['Step', 'Action under the monitor contract', 'Count and outcome'], [
      ['1','C1 sees zero and waits; releasing the mutex is part of registration.','count=0; C1 registered'],
      ['2','Producer appends byte 0x51 and signals C1.','count=1; C1 eligible'],
      ['3','C2 acquires the mutex first and removes the byte.','count=0; C2 returns 0x51'],
      ['4','C1 reacquires the mutex and repeats its while test.','count=0; C1 waits again'],
      ['5','Producer closes and broadcasts.','C1 wakes, sees closed and empty, returns EOF']
    ]),
    prose('The predicate carries the durable meaning',
      'The queue records whether data exists. A condition notification is a hint that this recorded condition may now permit progress. If a producer inserts while no consumer is waiting, the inserted byte remains in the queue. A later consumer sees count>0 and proceeds without needing an old notification to be remembered. The mutex protects both this test and the transition into waiting.',
      'Using if in place of while would let C1 proceed after step four and remove a nonexistent item. The same loop handles spurious wakeups when an implementation permits them. Wakeup order and mutex acquisition order may differ, so the monitor’s safety proof should avoid requiring that a signaled thread runs immediately. Fairness, cancellation, and timeout behavior require explicit additional rules.'),
    table('Three synchronization interfaces', ['Primitive', 'What its state represents', 'Typical operation'], [
      ['Mutex','Which thread owns access to an invariant','Acquire ownership, update state, release ownership.'],
      ['Counting semaphore','Number of available permits','Wait atomically acquires a permit or blocks; post adds one.'],
      ['Condition variable','Waiters interested in a predicate protected elsewhere','Wait with a mutex; recheck shared state after reacquiring it.']
    ]),
    prose('Derive a semaphore version carefully',
      'For a fixed-capacity queue of N slots, initialize empty=N, full=0, and a mutex unlocked. A producer waits on empty, locks the queue, inserts one item, unlocks, then posts full. A consumer waits on full, locks, removes one item, unlocks, then posts empty. The permit counts prevent overfill and underflow; the mutex serializes head, tail, and slot changes for multiple producers or consumers.',
      'Permit acquisition precedes taking the mutex. If a producer held the mutex while waiting for an empty permit, a consumer could need that mutex to remove an item and create the permit, forming a deadlock. Failure paths matter too: a producer that acquires empty and then aborts before insertion must return its reservation. During an operation, empty+full can be below N because a thread holds an in-flight reservation; include those reservations in the conservation equation.',
      'Shutdown is often clearer in the monitor form because closed is a predicate shared with queue state. A semaphore design needs an explicit scheme for waking blocked threads without inventing nonexistent data. Decide whether closure drains queued items, cancels pending producers, and waits for active operations before freeing the object. Freeing immediately after broadcast is unsafe while awakened threads still reference the mutex or slots.'),
    exercise('Trace capacity and closure', 'A capacity-three queue contains bytes A and B. One consumer removes A, a producer inserts C, and then close executes.',
      ['List the remaining consumer results, including the terminal result.', 'For a semaphore implementation, state the quiescent empty and full counts before closure.'],
      ['The remaining bytes are B then C, followed by EOF. A closed queue can still contain readable data; get checks emptiness before producing the terminal result.', 'After all three operations settle, count=2, full=2, empty=1. In-flight reservations can temporarily lower the sum of the semaphore counters, so inspect a quiescent point or count reservations too.'],
      ['Order B, C, EOF.', 'Settled permits 1 empty and 2 full.'])
  ], [ost('threads-cv','Chapter 30: Condition Variables'), ost('threads-sema','Chapter 31: Semaphores'), osc('Chapter 7: Producer-consumer synchronization')]),

  topic('deadlock-conditions-prevention', 'locks', 'Recognize deadlock and remove a concrete dependency condition', [
    'Deadlock is a state in which a set of participants cannot proceed because each waits for resources or events that only another member can supply. A slow task may eventually run; a starving task may repeatedly lose service; a deadlocked set has a dependency structure that prevents its members from enabling one another. Draw the requested and held resources before proposing a repair.',
    'Consider a filesystem operation that holds the inode lock and waits for the cache lock. Concurrently, a flush worker holds the cache lock and waits for the same inode lock. Each lock owner can release its lock only after finishing code that now waits for the other. This is a two-node cycle in the wait-for graph.'
  ], [
    table('Four conditions in the lock example', ['Condition', 'Concrete evidence', 'A prevention design'], [
      ['Mutual exclusion','Each mutex has one owner.','Make a resource shareable when its semantics permit immutable or replicated access.'],
      ['Hold and wait','Each thread retains its first lock while requesting the second.','Acquire the required resource set together, or release and retry under a validated protocol.'],
      ['No forced preemption','Another thread cannot safely take a live mutex away from its owner.','Use rollback-capable transactions for resources whose state can be restored.'],
      ['Circular wait','Inode owner waits for cache owner, which waits for inode owner.','Assign a global lock order and acquire in increasing order.']
    ]),
    trace('The smallest failing interleaving', ['Time', 'Thread A', 'Thread B', 'Dependency'], [['0','lock(inode)','idle','A owns inode'],['1','continues','lock(cache)','B owns cache'],['2','lock(cache) blocks','continues','A -> B'],['3','blocked','lock(inode) blocks','B -> A; cycle complete']]),
    prose('Prove what an ordering rule excludes',
      'Assign inode rank 10 and cache rank 20, and require every thread to acquire lower ranks before higher ranks. A thread holding cache cannot request inode. In any supposed cycle, following each waiting edge would require strictly increasing lock ranks. Returning to the starting rank would contradict strict increase. This is the reason the ordering removes circular wait.',
      'Real code needs an order among two locks of the same class as well. If two inode objects must be locked, compare stable inode identifiers or another documented ordering key, then acquire the lower key first. Handle the case where both references designate the same lock by acquiring it once. An ordering key that changes while objects are locked cannot support the proof.'),
    code('Ordered acquisition for two distinct object locks', 'text', `transfer(source, destination):
    if source == destination:
        return validated_noop
    first, second = order_by_stable_id(source, destination)
    lock(first)
    lock(second)
    validate transfer preconditions while both are held
    apply both sides of the update
    unlock(second)
    unlock(first)`,
      'Object references remain valid before lock acquisition. Stable ordering prevents the two-lock cycle even when callers reverse source and destination.',
      'The validation under both locks matters because balances, mappings, or file sizes may change while the operation waits.'),
    prose('Recognize the cost of each repair',
      'Requiring all resources up front removes hold-and-wait but may reserve scarce resources long before they are used. Releasing a first lock after try-lock fails can avoid sleeping in a cycle, but the operation must discard assumptions that depended on the released lock and retry validation. Two symmetric threads that repeatedly collide and retry can livelock: both remain active while neither completes. Backoff or arbitration can reduce this behavior.',
      'A timeout detects that waiting exceeded a chosen bound. It does not by itself prove deadlock, and returning from a timed-out request must release every owned resource and cancel any outstanding operation safely. A disk write may complete after its caller times out. Treating the timeout as proof that nothing happened can corrupt recovery logic.',
      'Recovery after detection needs a policy for selecting a victim and restoring invariants. Killing a user process can release kernel-managed descriptors and pages, but a kernel thread stopped in the middle of a two-object update may leave shared state inconsistent. Transaction logs, idempotent cleanup, or a deliberately limited set of abortable operations make recovery explainable. Record why the victim can be terminated safely before claiming that termination repairs the system.'),
    exercise('Three locks and one cycle', 'A holds L1 and requests L2. B holds L2 and requests L3. C holds L3 and requests L1. The locks are exclusive and no owner releases while waiting.',
      ['Draw the wait-for edges and identify all four conditions.', 'Apply ranks L1=1, L2=2, L3=3 and identify the first forbidden acquisition.'],
      ['The edges are A->B, B->C, C->A. Each resource is exclusive, each task holds while waiting, owners cannot be safely displaced, and the graph contains a cycle.', 'C’s request for L1 while holding L3 violates increasing rank. A valid rewrite acquires L1 before L3, or releases L3 and restarts from a state whose assumptions are revalidated.'],
      ['Cycle length is three.', 'No descending-rank acquisition remains.'])
  ], [ost('threads-bugs','Chapter 32: Concurrency Bugs and deadlock'), osc('Chapter 8: Deadlock conditions, prevention, and recovery')]),

  topic('banker-safety-detection', 'fairness', 'Run the Banker safety test and distinguish an unsafe grant from current deadlock', [
    'Deadlock avoidance asks whether a proposed resource grant leaves some order in which every participant could finish within its declared maximum claim. Represent each resource type as one vector coordinate. Available counts unallocated instances; Allocation records current holdings; Max records a promised upper bound; Need=Max-Allocation records the remaining possible demand.',
    'Use two reusable resource types, X and Y, with total counts (6,4). There are three processes. A completed process returns its whole allocation. Processes obey their maximum claims, and the allocator serializes each request with the safety test. These assumptions make the model suitable for a paper allocator or controlled resource pool; arbitrary real applications often cannot predict such maxima.'
  ], [
    table('Original state before a new request', ['Process', 'Allocation X,Y', 'Maximum X,Y', 'Need X,Y'], [['P0','(2,0)','(4,2)','(2,2)'],['P1','(1,2)','(3,3)','(2,1)'],['P2','(1,1)','(3,2)','(2,1)'],['Totals','(4,3)','Declared per process','Available=(2,1)']]),
    trace('A safety witness is a simulated completion order', ['Step', 'Work before', 'Eligible process and reason', 'Work after simulated completion'], [
      ['0','(2,1)','P1 Need=(2,1) fits componentwise','(3,3), adding P1 Allocation=(1,2)'],
      ['1','(3,3)','P0 Need=(2,2) fits','(5,3), adding P0 Allocation=(2,0)'],
      ['2','(5,3)','P2 Need=(2,1) fits','(6,4), adding P2 Allocation=(1,1)']
    ]),
    code('Bounded safety algorithm', 'text', `work = copy(available)
finished[0..n) = false
repeat at most n times:
    found = false
    for i in 0..n:
        if not finished[i] and need[i] <= work componentwise:
            work += allocation[i]
            finished[i] = true
            found = true
    if every finished[i]: return SAFE
    if not found: return UNSAFE
return UNSAFE`,
      'A simulated completion adds the process’s current allocation. The remaining need is conceptually loaned and returned during that simulated run, so its net contribution is zero.',
      'The scan costs O(n squared times m) for n processes and m resource types in this simple implementation. Vector additions require checked bounds and valid nonnegative inputs.'),
    prose('Test a request as a tentative transaction',
      'P0 requests (1,0). The request fits both its Need=(2,2) and Available=(2,1). Tentatively grant it: Available becomes (1,1), P0 Allocation becomes (3,0), and its Need becomes (1,2). P1 and P2 still need (2,1). No process’s need fits (1,1), so the safety scan makes no progress. Restore the old values and defer the request.',
      'This tentative state is unsafe because the allocator lacks a guaranteed completion order for all declared demands. It need not be currently deadlocked. A process might release a resource early, terminate with less than its maximum, or request a smaller increment that permits progress. Avoidance protects against the worst permitted future demand. Current deadlock detection uses what processes are actually waiting for now.'),
    trace('A different grant succeeds', ['Action', 'Available', 'P1 Allocation / Need', 'Safety reasoning'], [
      ['Start again from original state','(2,1)','(1,2) / (2,1)','Original state is safe.'],
      ['Grant P1 request (1,0)','(1,1)','(2,2) / (1,1)','P1 can receive its remaining need and complete.'],
      ['Simulate P1 completion','(3,3)','Finished','P0 can then finish, followed by P2.']
    ]),
    prose('Build a detector with the correct input',
      'For current multi-instance deadlock detection, replace maximum remaining Need with each blocked process’s current outstanding Request. Initialize work to Available and simulate any process whose current request can be satisfied, releasing its holdings when it finishes for the purposes of the test. A standard detector can initially mark zero-allocation processes as finished because they cannot be holding the resources that sustain a resource-allocation deadlock. Their inability to progress can still be a consequence of another deadlocked set.',
      'If the unsafe P0 grant had been made and all three processes then blocked requesting exactly their full remaining need, Available=(1,1) would satisfy none of them. With each retaining nonzero holdings and no external releases, detection identifies the blocked set. Recovery could abort an explicitly abortable participant and return its holdings, then repeat the test. Choose victims using actual rollback cost, restartability, and fairness so the same process is not repeatedly sacrificed.',
      'The allocator must serialize validation, tentative mutation, safety testing, and commit or rollback. Two CPUs testing requests against the same old Available vector and committing independently can overallocate even if each isolated test passes. A safety proof over a stale snapshot is useful only when commit checks that the relevant state still matches that snapshot.'),
    exercise('Validate a resource request before searching', 'Starting from the original table, P2 requests (2,2). Then consider a separate request from P1 for (1,0).',
      ['Identify every check that rejects the P2 request.', 'Give the safe completion order after granting the P1 request.'],
      ['P2’s Y request 2 exceeds its remaining Y need 1 and also exceeds the available Y count 1. The allocator rejects the malformed claim or waits for resources according to its API before any tentative commit; a request beyond Max violates the declared contract.', 'The P1 request produces Available=(1,1), Need(P1)=(1,1), so P1 can finish first. Its returned allocation gives (3,3), then P0 finishes and finally P2.'],
      ['All comparisons are componentwise.', 'Final simulated Work equals total resources (6,4).'])
  ], [osc('Chapter 8: Banker algorithm, safety, and detection')])
];

systemsHandbook['block-devices'] = [
  topic('io-completion-dma-buffering', 'layers', 'Trace a request through polling, interrupts, DMA, and buffers', [
    'A device request has a submission phase, a period in flight, and a completion result. Separate three questions: how software learns that work finished, how payload bytes move, and who owns the buffer during each phase. Polling or interrupts answer the completion question. Programmed I/O or DMA answer the transfer question. They can be combined in several ways.',
    'Programmed I/O makes the CPU execute accesses that move payload through device registers or a memory-mapped window. Direct memory access lets a device transfer bytes using addresses supplied through a device-specific command. The CPU still creates descriptors, validates lengths, establishes mappings, and handles completion. The DMA address supplied to a device may differ from the CPU’s virtual or physical address because an IOMMU or bus mapping participates.'
  ], [
    table('Four useful combinations', ['Payload transfer', 'Completion method', 'Example behavior'], [['PIO','Polling','CPU waits for ready, then copies words through a data port.'],['PIO','Interrupt','Device interrupts when data can be transferred; handler or worker performs CPU copies.'],['DMA','Polling','CPU submits a descriptor and later polls a completion ring.'],['DMA','Interrupt','Device fills mapped memory and interrupts after recording completion.']]),
    steps('Ownership of a DMA read buffer', [
      ['Allocate and prepare', 'Reserve a buffer whose lifetime extends beyond completion. Validate alignment, maximum transfer size, addressability, and descriptor count.'],
      ['Map for the device', 'Use the platform DMA mapping interface with the transfer direction. Handle mapping failure and retain the returned device address.'],
      ['Publish descriptor', 'Write address and length fields, apply the required ordering barrier, then transfer descriptor ownership or ring the device doorbell.'],
      ['Device owns transfer', 'Prevent incompatible CPU accesses or reuse while the device writes. Mapping and cache synchronization rules depend on the platform and mapping type.'],
      ['Observe completion', 'Read completion status using the device protocol, establish required DMA synchronization, then make successful bytes available to the caller.'],
      ['Release mapping and lifetime', 'Unmap or recycle according to the API, report partial or failed completion accurately, and only then release the final buffer reference.']
    ]),
    prose('Why coherent memory still needs ordering',
      'Coherent DMA memory can keep CPU and device views coherent without explicit cache flushing for every access, yet descriptor fields can still require a memory barrier before publishing the valid bit. The device must never observe “ready” with an old address or length. Streaming DMA mappings may require synchronization when ownership changes. Use the operating system’s DMA API because the requirements depend on architecture and device.',
      'A timeout adds a cancellation problem. A caller can stop waiting while the device still has permission to write. Freeing or reassigning the buffer immediately would turn late completion into a write to somebody else’s object. Quiesce, cancel, reset, or otherwise prove that DMA has stopped before dropping ownership. A generation number on descriptors can help reject stale completion records, while buffer lifetime still needs actual protection.'),
    trace('A double-buffered read pipeline', ['Interval', 'Device activity', 'CPU activity', 'Buffer ownership'], [['0','Fill A','Prepare request B','A device-owned; B prepared'],['1','Fill B','Process completed A','B device-owned; A CPU-owned'],['2','Fill A after CPU releases it','Process completed B','A reused only after ownership return']]),
    prose('Derive the benefit and its limit',
      'If filling a buffer takes 3 ms and processing it takes 2 ms, a single-buffer serial path needs 5 ms per buffer. With two buffers and overlap, the steady-state cadence can approach max(3,2)=3 ms per buffer, after startup. The device remains the bottleneck. Adding more buffers absorbs bursts but cannot raise sustained throughput beyond the slowest stage.',
      'A queue needs backpressure when all buffers are owned. Reject, block, or throttle new producers according to the API. Silently overwriting the oldest in-flight slot corrupts ownership. Track buffer identifiers and generations in a trace so a request can be followed from caller to descriptor to completion to reuse.',
      'Polling spends CPU time checking status. Interrupts can save that work at low event rates, but each interrupt has entry and scheduling costs. High-rate devices often batch completions or switch to bounded polling after an interrupt. A budget caps how much work one poll pass performs before other tasks get service. Choosing a strategy is a latency and CPU-cost decision tied to measured traffic.'),
    exercise('Account for overlap and cancellation', 'A device needs 5 ms to fill each buffer and a CPU needs 2 ms to consume it. A DMA request times out before its completion is observed.',
      ['Calculate ideal serial time and steady-state double-buffer cadence.', 'List the proof required before reusing the timed-out buffer.'],
      ['Serial time is 7 ms per buffer; ideal overlapped cadence is 5 ms. Startup and drain add finite overhead to a short batch.', 'Prove the device can no longer write to the mapping, handle any stale completion, and perform required DMA synchronization or unmapping. A software timer expiring supplies none of those facts by itself.'],
      ['Throughput is limited by the five-millisecond stage.', 'No buffer reuse while device ownership remains possible.'])
  ], [ost('file-devices','Chapter 36: I/O Devices'), ref('Linux DMA API guide', 'https://docs.kernel.org/core-api/dma-api-howto.html', 'DMA addresses, coherent and streaming mappings, ownership'), osc('Chapter 12: I/O Systems')]),

  topic('hdd-scheduling-latency', 'poll', 'Calculate disk latency and compare FCFS, SSTF, SCAN, and LOOK', [
    'A simplified rotating disk request pays seek time to move the head, rotational delay until the desired sector arrives, and transfer time while bytes pass under the head. Queueing adds time before service starts. Logical block addresses give software a linear interface, while firmware translates them to media locations; a cylinder model is an explicit teaching approximation.',
    'A 7200 RPM disk completes 120 revolutions per second, so one revolution takes 8.333 ms and a uniformly distributed arrival waits an average 4.167 ms for rotation. With an illustrative 4 ms seek and 64 KiB transfer at 128 MiB/s, transfer time is 0.488 ms. The approximate service time is 8.655 ms before queueing, controller overhead, and retries.'
  ], [
    table('An original head-movement workload', ['Assumption', 'Value'], [['Tracks','Integers 0 through 199'],['Initial head','50'],['Outstanding requests in arrival order','82, 170, 43, 140, 24, 16, 190'],['Initial sweep direction','Toward increasing track numbers'],['Arrival behavior','All seven are already queued; no new arrivals during this comparison'],['Cost model','Absolute track distance; wrap movement is charged']]),
    trace('Every service order and total movement', ['Policy', 'Path after initial 50', 'Distance'], [
      ['FCFS','82,170,43,140,24,16,190','32+88+127+97+116+8+174 = 642'],
      ['SSTF','43,24,16,82,140,170,190','7+19+8+66+58+30+20 = 208'],
      ['LOOK upward first','82,140,170,190,43,24,16','140 upward +174 downward = 314'],
      ['SCAN upward first','82,140,170,190,199,43,24,16','149 to physical end +183 back = 332'],
      ['C-LOOK upward','82,140,170,190,16,24,43','140 +174 wrap +27 = 341'],
      ['C-SCAN upward','82,140,170,190,199,0,16,24,43','149 +199 wrap +43 = 391']
    ]),
    prose('Derive the policies from their state',
      'FCFS needs a queue ordered by arrival. Shortest-seek-time-first, SSTF, picks the pending request nearest the current head. At 50 the nearest is 43, then from 43 the nearest remaining is 24. A linear scan takes O(n) per selection; an ordered structure can find nearby predecessor and successor candidates more efficiently. The model optimizes seek distance locally and ignores rotational position.',
      'SCAN maintains a direction and sweeps to the physical boundary before reversing. LOOK reverses at the last pending request in that direction, saving an empty trip to the boundary. Their circular variants service in one direction, move back to the starting side without servicing on that wrap, and resume the forward sweep. Define whether the wrap costs time before comparing totals. Our table counts all physical movement.',
      'The finite batch makes SSTF look strong, but a continuous stream near the current head can indefinitely delay a far request. A sweep policy limits how repeated nearby arrivals can obstruct travel when its admission rules are defined. Production schedulers may add deadlines, merge adjacent requests, separate reads from writes, and rely on device queueing to optimize the final media order.'),
    code('Distance accounting independent of scheduling policy', 'c', `#include <stddef.h>
#include <stdint.h>
int movement(unsigned start, const unsigned *path,
             size_t count, uint64_t *total) {
    if (start > 199 || !total || (count && !path)) return 0;
    if (count > 1000000) return 0;
    uint64_t sum = 0;
    for (size_t i = 0; i < count; ++i) {
        unsigned next = path[i];
        if (next > 199) return 0;
        sum += next >= start ? next - start : start - next;
        start = next;
    }
    *total = sum;
    return 1;
}`,
      'Path includes boundary and wrap positions when the policy visits them. The one-million-entry bound keeps the maximum sum far inside uint64_t.',
      'Invalid input leaves the output unchanged. This function checks arithmetic for a supplied path; it does not choose the scheduling order.'),
    prose('Connect locality with throughput and delay',
      'Merging four contiguous 4 KiB requests can reduce repeated command overhead and exploit a single sequential transfer. It can also delay a request while the queue waits for merge opportunities. Track both total bytes per second and per-request latency percentiles. A policy that minimizes aggregate movement can still produce a poor worst-case wait.',
      'SSD access lacks the mechanical seek and rotation modeled here. Applying a cylinder-distance heuristic to an SSD would optimize an imaginary movement cost. SSD schedulers still manage fairness, batching, queue depth, and controller parallelism. Keep the workload model attached to the conclusion so the same graph is not mistakenly used as evidence for every storage device.'),
    exercise('Change the sweep direction', 'Use the same requests and head position, but let LOOK begin toward lower tracks.',
      ['Write the complete service order and total distance.', 'Explain why this different total does not contradict the original table.'],
      ['The order is 43,24,16,82,140,170,190. Movement is (50-16)+(190-16)=34+174=208 tracks.', 'The original LOOK policy began upward. Direction is part of scheduler state, so changing it changes the admissible first sweep and the resulting path.'],
      ['All seven requests appear exactly once.', 'Total movement is 208.'])
  ], [ost('file-disks','Chapter 37: Hard Disk Drives'), osc('Chapter 11: Mass-storage scheduling')]),

  topic('ssd-ftl-garbage-collection', 'identify', 'Follow an SSD update through the FTL, garbage collection, and wear leveling', [
    'A flash page is programmed as a unit, while erasure operates on a larger erase block containing many pages. Rewriting arbitrary logical sectors in place would require expensive erase operations and preserving neighboring data. A flash translation layer, or FTL, maps host logical addresses to physical flash locations and can place an update in a fresh page.',
    'Use a deliberately small model: each page is 4 KiB and each erase block holds 16 pages, totaling 64 KiB. These are teaching geometry choices. The FTL map stores the currently valid physical page for each logical page. An overwritten old page becomes invalid, meaning its bytes remain physically present but the current mapping no longer names them.'
  ], [
    trace('Update logical page L7 twice', ['Event', 'Physical write', 'Mapping after commit', 'Old-page state'], [['Initial data','P12 contains version 1','L7 -> P12','None'],['First update','Write version 2 to erased P35','L7 -> P35','P12 becomes invalid'],['Second update','Write version 3 to erased P49','L7 -> P49','P35 becomes invalid']]),
    prose('Make the mapping crash-consistent',
      'A controller must order the new data and the mapping publication so a crash cannot leave the current mapping pointing to unwritten contents. It may use journals, sequence numbers, checksums, checkpointed tables, or protected volatile state. The exact mechanism is controller-specific. A filesystem sees the device’s advertised durability operations; it cannot infer internal persistence from observing a fast completion alone.',
      'A map for every 4 KiB logical page also consumes memory. A 1 TiB logical space contains 2^28 such pages. At four bytes per map entry, a simple full table needs 2^30 bytes, or 1 GiB, before other metadata. Real FTLs can use different granularity, compression, caching, or hybrid mapping schemes. The arithmetic explains why mapping architecture is a significant design choice.'),
    steps('Garbage collect one block', [
      ['Choose a victim', 'Inspect validity metadata and wear information. A block with few live pages usually requires less copying, while wear policy may justify another choice.'],
      ['Move live pages', 'Copy each still-current page to a fresh location, verify required integrity metadata, and update its mapping under the controller’s persistence protocol.'],
      ['Erase the victim', 'Only after live data has a recoverable new location may the erase block be reset. Erasure makes all its pages available for programming again.'],
      ['Return free capacity', 'Add the erased block to the free pool and record its erase count. Reserve sufficient spare space so collection can complete even when host-visible capacity is nearly full.']
    ]),
    table('Write amplification from one collection cycle', ['Quantity', 'Value', 'Derivation'], [['Victim pages','16','6 valid + 10 invalid'],['Copies required','6 physical page writes','Each live page must be preserved.'],['Net new host pages supported','10','Six replacement pages consume part of the reclaimed capacity.'],['Total physical writes for 10 host writes','16','6 copies + 10 new host pages'],['Write amplification','1.6','16/10, excluding metadata and other controller work']]),
    prose('Separate spare space and wear policy',
      'Suppose 120 physical pages back a 100-page logical namespace. There are 20 spare pages, equal to 20% of logical capacity or 16.67% of physical capacity. State the denominator whenever quoting overprovisioning. Spare space gives the controller room to place updates and collect blocks, while workloads and placement choices determine actual write amplification.',
      'Dynamic wear leveling spreads new writes among available blocks. Static wear leveling may relocate cold data so a lightly worn block can participate in future writes while a more worn block holds infrequently changing data. That relocation itself costs writes. The controller balances erase-count distribution, copy cost, latency, and available free space.',
      'A discard or trim request tells a device that selected logical data is no longer needed under the interface contract. This can let collection skip its old pages. It does not automatically establish a secure-erasure claim, because stale physical copies, remapping, or controller behavior can leave data elsewhere. Security requires a separately specified erase or cryptographic destruction mechanism.'),
    exercise('Compare two victim blocks', 'Two 16-page blocks are eligible for collection. Block A has four live pages and block B has twelve. Ignore metadata costs and assume enough relocation space.',
      ['Compute the ideal write amplification for each cycle if net reclaimed slots are filled with new host pages.', 'Identify one reason a wear policy might still select B.'],
      ['A copies 4 pages and supports 12 host writes, giving (4+12)/12=4/3, approximately 1.333. B copies 12 and supports 4 host writes, giving 16/4=4.', 'Erase-count imbalance or placement constraints can make another choice useful, although the immediate copy cost is higher. A full policy must account for both endurance and latency goals.'],
      ['A yields 12 net slots; B yields 4.', 'Metadata costs would raise the simplified amplification.'])
  ], [ost('file-ssd','Chapter 44: Flash-based SSDs'), osc('Chapter 11: Nonvolatile memory and storage structure')]),

  topic('raid-parity-and-failure', 'tests', 'Compute RAID capacity, parity updates, and degraded-read costs', [
    'A disk array distributes data across drives and may store redundancy that allows reconstruction after a failure. Striping partitions consecutive data into stripe units placed on different drives. Mirroring stores additional copies. Parity stores a relation among data units that can recover missing information under a stated failure model.',
    'Assume four equally sized drives of 1 TiB each, ignoring metadata and spare capacity. RAID 0 stripes without redundancy and exposes 4 TiB. Pairwise mirrored RAID 10 exposes 2 TiB. Single-parity RAID 5 exposes 3 TiB. Dual-parity RAID 6 exposes 2 TiB. These capacities follow from how many drive-equivalents hold redundant information.'
  ], [
    table('Failure tolerance needs the exact layout', ['Layout', 'Usable capacity', 'Failure behavior'], [['RAID 0','4 TiB','Any missing drive loses part of the striped dataset.'],['RAID 10, two mirror pairs','2 TiB','One failure in each pair can be tolerated; losing both members of one pair loses that pair’s data.'],['RAID 5','3 TiB','Any one whole-drive failure can be reconstructed.'],['RAID 6','2 TiB','Any two whole-drive failures can be reconstructed with the appropriate independent parity equations.']]),
    trace('One-byte RAID 5 stripe, for arithmetic clarity', ['Operation', 'Data or calculation', 'Result'], [['Initial data','D0=0x3c, D1=0xa5, D2=0x6e','P=D0 XOR D1 XOR D2 = 0xf7'],['Recover missing D2','P XOR D0 XOR D1','0xf7 XOR 0x3c XOR 0xa5 = 0x6e'],['Replace D1 with 0x91','Pnew=Pold XOR D1old XOR D1new','0xf7 XOR 0xa5 XOR 0x91 = 0xc3'],['Verify new stripe','0x3c XOR 0x91 XOR 0x6e','0xc3']]),
    prose('Derive the small-write penalty',
      'A read-modify-write update reads the old data unit and old parity, computes the parity delta, then writes the new data and new parity. That gives two reads and two writes for one small logical write in the simplified healthy RAID 5 model. Drives may execute some operations in parallel. The four physical I/Os describe the operation count; dependency and overlap determine elapsed latency.',
      'A full-stripe write supplies all data units. The controller can compute parity directly from the new data and write the whole stripe without reading old data or parity. A reconstruction-write variant reads unaffected data to build new parity; the cheaper choice depends on how much of the stripe changes. Cache and batching can turn several small writes into a full-stripe operation.'),
    prose('Explain the write hole as a failed equation',
      'Suppose the controller writes D1=0x91 but power fails before parity changes from 0xf7 to 0xc3. The data and parity no longer describe one consistent stripe generation. If D2 is later unavailable, reconstruction computes 0xf7 XOR 0x3c XOR 0x91 = 0x5a, which differs from the correct 0x6e. A parity check can reveal inconsistency, but parity alone may not identify which member is wrong.',
      'A journal, protected controller write cache, or another atomic stripe-update protocol can address this partial-update problem. The protection must include recovery ordering after restart. Simply issuing both writes close together leaves a power-failure interval between their durable effects. Device caches and flush behavior belong to the array’s persistence contract.'),
    table('Healthy and degraded work', ['Request', 'Healthy RAID 5', 'With one missing data drive'], [['Read a present unit','Usually one data read','Still one read when that unit is present'],['Read a missing unit','One read when healthy','Read the surviving stripe units needed for reconstruction'],['Rebuild a replacement drive','No rebuild traffic','Read surviving stripes and write reconstructed contents; competes with foreground I/O'],['Another unrecoverable error','Redundancy remains available','May exceed the remaining correction capability in the affected stripe']]),
    prose('Define availability and recovery claims precisely',
      'RAID redundancy handles certain device failures while preserving service. It also replicates accidental deletion and can propagate corrupted writes to every redundant copy. A separate versioned backup or replication history is needed to recover earlier logical states. Checksums can detect corruption and, when combined with a known-good redundant copy, guide repair.',
      'Rebuild time depends on capacity scanned, read bandwidth, replacement write bandwidth, foreground load, and error recovery. An ideal 1 TiB rebuild at a sustained 100 MiB/s takes 1,048,576/100 seconds, about 2.91 hours. This throughput calculation assumes a constant rate; a repair-window guarantee requires bounds on the other delays. During degraded operation, both performance and remaining failure tolerance change.'),
    exercise('Recover a failed stripe and assess a two-drive loss', 'Use the original stripe with parity 0xf7. D0 is missing. Separately, a RAID 10 array has mirror pairs {A,B} and {C,D}.',
      ['Recover D0 and show the XOR calculation.', 'Compare failures {A,C} with failures {A,B}.'],
      ['D0=P XOR D1 XOR D2=0xf7 XOR 0xa5 XOR 0x6e=0x3c. XORing known members removes their contribution to parity.', '{A,C} leaves B and D as surviving copies, so both mirror pairs remain readable. {A,B} removes every copy in the first pair, so that array loses the data stored there.'],
      ['Recovered byte 0x3c.', 'Failure placement matters for mirrored pairs.'])
  ], [ost('file-raid','Chapter 38: Redundant Disk Arrays'), osc('Chapter 11: RAID structure and reliability')])
];

const fatSpec = ref('Microsoft FAT on-disk specification', 'https://www.pcjs.org/documents/papers/microsoft/MS_FAT_OVERVIEW_103-2000-12-06.pdf', 'Version 1.03: BPB, allocation entries, directory records, and write rules');
systemsHandbook['fat-read-driver'] = [
  topic('vfs-pathnames-and-descriptors', 'directories', 'Walk a pathname through dentries, inodes, and open-file descriptions', [
    'The virtual filesystem, or VFS, presents operations such as open, read, and lookup through a common interface while individual filesystems implement their storage rules. A directory maps names to objects. An inode-like object represents file identity and metadata. A directory entry cache, often called a dentry cache, remembers name lookup results. An open-file description represents one active opening, including its current offset and access mode.',
    'A descriptor is a small integer in one process’s table. Looking up descriptor 5 first finds a table entry, which references an open-file description, which references the underlying file object. This separation explains why duplicating a descriptor can share a file offset, why two independent opens can have different offsets, and why removing a name can leave an already open file usable.'
  ], [
    table('Trace open("/home/ada/log", read-only)', ['Stage', 'Object or check', 'Result'], [['Choose starting directory','Absolute path begins at the process’s root directory','Hold a reference to that directory.'],['Resolve home','Search permission and lookup of name home','A directory object for home.'],['Resolve ada','Search permission and lookup of name ada','A directory object for ada.'],['Resolve log','Lookup the final name; apply open policy and file permissions','A reference to the file object.'],['Create open description','Set access mode and initial offset zero','One reference-counted open instance.'],['Install descriptor','Choose a free slot in the caller’s descriptor table','Return integer 5, for example.']]),
    prose('Names and open references have different lifetimes',
      'A hard link adds another directory name referring to the same file identity. A symbolic link is an object containing a path to resolve. Removing one hard link decreases the link count; the data can be reclaimed only when no directory links and no other required references remain. A symbolic link can become dangling if its target path stops resolving. Relative symbolic-link targets are interpreted in relation to the directory containing the link.',
      'Path traversal must bound symbolic-link expansion and component sizes. It must also coordinate with concurrent rename and unlink operations so object references remain valid. A teaching implementation can serialize directory mutations under one filesystem lock. A scalable implementation needs more detailed locking, sequence validation, or lookup restart rules. The filesystem interface should state which namespace snapshot, if any, one operation observes.'),
    trace('Shared offsets after dup and independent offsets after open', ['Action', 'Descriptor references', 'Offsets'], [['open file twice','fd3 -> F; fd4 -> G; both point to inode I','F=0, G=0'],['dup fd3 to fd7','fd3 and fd7 -> F; fd4 -> G','F=0, G=0'],['read 10 through fd7','Read uses F','F=10, G=0'],['read 4 through fd3','Read begins at F offset 10','F=14, G=0'],['read 6 through fd4','Read uses independent G','F=14, G=6']]),
    prose('Permissions apply to operations',
      'On a Unix-style filesystem, directory search permission permits traversal through a name, while directory read permission permits enumerating names. File read permission controls reading file contents. Deleting a name primarily involves modification of its parent directory, with additional rules such as sticky-directory policy on systems that implement them. These decisions belong to the operation being attempted, so checking only the final file’s mode misses pathname restrictions.',
      'FAT does not natively store the same Unix owner, group, and mode-bit model. A FAT driver exposed through a Unix-like VFS must define how mount options, stored attributes, or external metadata produce access policy. The same VFS method can therefore be implemented over different on-disk structures without pretending that every format stores identical metadata.'),
    steps('Unwind a failed open', [['Retain lookup objects','Acquire references while traversing and release superseded intermediate references.'],['Validate before installation','Check object type, permission, and requested flags before returning a descriptor.'],['Handle allocation failure','If allocating the open description or descriptor slot fails, release the inode and any newly created state according to the operation contract.'],['Publish once','Install a fully initialized open description in the descriptor table under its synchronization rule. Another thread must never observe a half-initialized entry.']]),
    exercise('Unlink an open file', 'A file has names /a and /b and one open descriptor. The program unlinks /a, then /b, then reads from the descriptor before closing it.',
      ['Track the link count and whether the open descriptor can still identify the file.', 'State the earliest point when storage reclamation is possible under this model.'],
      ['The link count changes from two to one to zero. The open-file reference still holds the file object, so the descriptor can continue to access it according to its existing open mode.', 'Reclamation becomes possible after the final open reference closes and all other required references are released. Removing the final pathname alone does not end the lifetime of the open object.'],
      ['Link counts 2,1,0.', 'Descriptor lifetime is accounted separately.'])
  ], [ref('Linux VFS documentation','https://docs.kernel.org/filesystems/vfs.html','Superblocks, inodes, dentries, and files'), ost('file-intro','Chapter 39: Files and Directories'), osc('Chapters 13 and 15: File interfaces and virtual filesystems')]),

  topic('fat-geometry-byte-decoding', 'geometry', 'Derive FAT geometry and decode entries at exact byte offsets', [
    'The BIOS parameter block describes a FAT volume using little-endian fields. Decode bytes explicitly so alignment and host structure padding cannot change the interpretation. Geometry determines which byte ranges belong to reserved sectors, FAT copies, the fixed root directory on FAT12/16, and the data area. Every later cluster lookup depends on these initial calculations.',
    'Use an original small-volume model: bytes per sector 512, sectors per cluster 2, reserved sectors 1, FAT copies 2, sectors per FAT 9, root entries 224, and total sectors 2880. The enclosing partition begins at disk LBA 2048. The field values are already decoded; validation still checks allowed sector and cluster sizes and that every derived region fits the enclosing volume.'
  ], [
    trace('Derive each coordinate once', ['Quantity', 'Calculation', 'Result'], [['Fixed root sectors','ceil(224*32/512)','14'],['First data sector','1 + 2*9 + 14','33, volume-relative'],['Data sectors','2880 - 33','2847'],['Data cluster count','floor(2847/2)','1423'],['FAT classification','1423 < 4085','FAT12'],['Cluster 5 first sector','33 + (5-2)*2','39, volume-relative'],['Cluster 5 disk address','2048 + 39','2087, disk-relative']]),
    prose('Derive type from usable cluster count',
      'FAT type follows the data-cluster count: below 4085 selects FAT12, below 65525 selects FAT16, and larger supported counts select FAT32. The label text in a boot sector is descriptive metadata. The allocation-table format must agree with geometry and capacity. FAT32 has a root directory cluster chain and therefore uses no fixed FAT12/16 root-entry region.',
      'Validate intermediate arithmetic before reading sectors. The count of FAT bytes must be large enough to represent entries for reserved clusters 0 and 1 plus all usable data clusters. A last odd data sector in this example cannot form a complete two-sector cluster and remains outside the allocatable cluster count. First-data-sector must lie inside the declared total, and the declared volume must fit the enclosing partition.'),
    table('Allocation-table entry locations', ['Format', 'Byte offset for cluster c', 'Decoded value'], [['FAT12','c + floor(c/2)','Even c: low 12 bits of the two-byte window. Odd c: high 12 bits.'],['FAT16','2*c','Little-endian 16-bit value.'],['FAT32','4*c','Little-endian 32-bit value masked with 0x0fffffff.']]),
    code('A bounded FAT12 decoder over an already loaded byte array', 'c', `#include <stddef.h>
#include <stdint.h>
int fat12_value(const uint8_t *fat, size_t bytes,
                uint32_t cluster, uint16_t *out) {
    uint64_t offset = (uint64_t)cluster + cluster / 2;
    if (!fat || !out || bytes < 2 || offset > bytes - 2)
        return 0;
    size_t i = (size_t)offset;
    uint16_t pair = (uint16_t)fat[i] |
                    ((uint16_t)fat[i + 1] << 8);
    *out = cluster & 1 ? pair >> 4 : pair & 0x0fff;
    return 1;
}`,
      'The function validates a two-byte window and reports a raw entry. Callers separately check whether the input cluster belongs to the volume and whether the result means next cluster, free, reserved, bad, or end-of-chain.',
      'For a sector cache, fetch both bytes even when they live in different sectors. A two-byte cast at the end of one sector buffer would access beyond that buffer.'),
    trace('Two packed entries and a boundary entry', ['Case', 'Bytes', 'Derivation'], [['Clusters 2 and 3','FAT bytes at offsets 3..5 are 56 c4 ab','Entry 2: 0xc456 & 0x0fff = 0x456. Entry 3: 0xabc4 >> 4 = 0xabc.'],['Cluster 341','Offset 341+170=511; bytes 511 and 512 are a0 bc','The window crosses a 512-byte sector boundary. Odd entry: 0xbca0 >> 4 = 0xbca.'],['FAT32 raw entry','Raw 0xa0000123','Usable low 28 bits give cluster value 0x123; the high nibble is outside that value.']]),
    prose('Classify before following a link',
      'A next-cluster value must be inside the usable data-cluster range and outside the format’s reserved marker ranges. FAT12 end-of-chain values start at 0xff8; 0xff7 marks a bad cluster and zero marks free space. Corresponding FAT16 markers use 0xfff8 and 0xfff7, while FAT32 uses masked 28-bit markers 0x0ffffff8 and 0x0ffffff7. An allocated file encountering a free or bad marker before its declared bytes finish is malformed.',
      'Keep raw decoding and semantic classification separate. That lets a test cover every packed nibble combination without constructing an entire filesystem, while a volume test verifies type thresholds and chain policies. Both layers are necessary because a mathematically correct 12-bit decode can still produce an invalid link for the current volume.'),
    exercise('Translate a byte inside a file cluster', 'In the model volume, a file’s second cluster is cluster 9. You need byte offset 1500 within the file, and each cluster holds 1024 bytes.',
      ['Compute the cluster index, offset within that cluster, volume sector, disk sector, and byte offset within the sector.', 'Explain why the FAT12 entry for cluster 341 needs two cached sectors.'],
      ['1500/1024 gives cluster index 1 and remainder 476. Cluster 9 begins at volume sector 33+(9-2)*2=47. Remainder 476 lies in that first sector, so disk LBA is 2048+47=2095 and byte offset is 476.', 'Its packed window starts at FAT byte 511 and includes byte 512. Those bytes belong to adjacent 512-byte FAT sectors.'],
      ['Disk LBA 2095, byte 476.', 'Never assume a packed entry stays within one sector.'])
  ], [fatSpec, osc('Chapter 14: Allocation methods and filesystem implementation')]),

  topic('fat-directory-chain-reader', 'read', 'Parse directory bytes and read a bounded, possibly corrupt cluster chain', [
    'A directory is a sequence of 32-byte records. A short record contains an eleven-byte space-padded base-and-extension name, attribute flags, timestamps, the starting cluster, and a 32-bit file size. Parse these fields from known offsets. A C structure with compiler-selected padding does not establish the required on-disk layout.',
    'A reader combines two independent bounds: the directory’s logical file size and the volume’s finite set of clusters. File size limits bytes returned to the application. The chain defines which clusters supply those bytes. A hostile chain can loop, leave the volume, end early, or cross into reserved markers, so a disk image must be treated as untrusted input.'
  ], [
    table('Selected fields of a short directory entry', ['Byte offset', 'Length', 'Meaning'], [['0','11','Eight base-name bytes followed by three extension bytes; spaces pad unused positions.'],['11','1','Attributes; 0x0f identifies a long-name entry.'],['20','2','High cluster word for FAT32; handled according to format.'],['26','2','Low cluster word.'],['28','4','File size in bytes, little-endian.']]),
    prose('Recognize record state before interpreting a name',
      'A first byte of 0x00 ends the used directory sequence; entries after it are unused. A first byte of 0xe5 marks a deleted slot. A stored first byte 0x05 represents an actual leading character value 0xe5 in a short name. Attribute checks distinguish directories, volume labels, and long-name fragments from ordinary short file entries. A long-name run requires its own validation before attaching text to the following short entry.',
      'For a FAT32 regular file, combine the starting-cluster high word and low word and validate the resulting identifier under the format’s usable range. A zero-length file can have starting cluster zero. A nonempty file needs a valid first data cluster. Subdirectories are walked as directory chains, while the FAT12/16 root directory occupies its fixed region and does not use the same starting-cluster calculation.'),
    trace('Read a 2500-byte file with a 1024-byte cluster size', ['Chain position', 'Cluster', 'Bytes returned', 'Cumulative logical bytes'], [['0','5','1024','1024'],['1','9','1024','2048'],['2','6','452','2500'],['After final logical byte','Entry 6 is end-of-chain in this valid example','0 further bytes','Exactly 2500']]),
    code('Bounded read planning', 'text', `remaining = directory_file_size
cluster = first_cluster
visited = empty set
while remaining > 0:
    require cluster is a valid data-cluster number
    require cluster is absent from visited
    require visited_count < volume_data_cluster_count
    add cluster to visited
    take = min(remaining, bytes_per_cluster)
    read exactly take logical bytes from this cluster
    remaining -= take
    if remaining > 0:
        next = decode_and_classify_fat_entry(cluster)
        require next has class DATA_CLUSTER
        cluster = next.value
return SUCCESS`,
      'The sketch plans a complete read. A real API may return partial bytes before a later I/O error; its result must record how much data became visible.',
      'A visited bitmap uses one bit per data cluster. A strict traversal budget gives a bounded alternative when memory is scarce, though a visited set detects repetition earlier.',
      'If performing a consistency check, also inspect the tail link after the logical bytes finish. A longer chain can indicate leaked or excess allocation even though the file read itself must stop at its declared size.'),
    prose('Handle corruption without inventing content',
      'If cluster 9 points back to 5, the visited set rejects the repetition. If cluster 9 is end-of-chain, the 2500-byte file lacks its last 452 bytes. If a sector read fails midway through cluster 6, return the defined partial-read result or fail an internal all-or-nothing buffer fill. Filling missing disk bytes with zeros would manufacture file content and hide corruption.',
      'The final cluster contains 572 bytes beyond the file’s logical end. Those bytes are allocation slack and must not be returned by an ordinary read. A secure extension path also needs an initialization policy before formerly invisible bytes become part of the file. Reading the whole last sector into a private cache is fine; copying all its bytes into the caller’s requested logical result would expose slack.',
      'Caching chain positions can make repeated random reads faster. Store the mapping from a logical cluster index to a physical cluster only while its generation remains valid. A concurrent writer can change a chain, so the read path needs a file lock, immutable snapshot, or revalidation protocol. The educational read-only driver can state that the volume remains unchanged during traversal.'),
    exercise('Detect the first contradictory fact', 'The directory says size 2500 and first cluster 5. Cluster size is 1024, and the FAT says 5->9 and 9->end-of-chain.',
      ['Compute how many clusters the logical size requires and how many bytes the chain supplies.', 'State a bounded reader’s outcome and distinguish it from a zero-length file.'],
      ['ceil(2500/1024)=3 clusters are required. The supplied chain has only two clusters, totaling 2048 bytes, so 452 logical bytes are missing.', 'The reader reports truncation or corruption under its API, possibly after returning the first 2048 bytes as an explicitly partial result. A zero-length file requires no data-cluster traversal and returns immediate EOF.'],
      ['Required clusters 3; present clusters 2.', 'No fabricated final 452 bytes.'])
  ], [fatSpec, ost('file-implementation','Chapter 40: File System Implementation')]),

  topic('block-indexing-extents-cache', 'compare', 'Compare pointer trees, extents, and the page-cache writeback state machine', [
    'A file maps logical byte positions to storage blocks. FAT represents the mapping as a linked chain, which makes reaching a distant cluster require traversing earlier links unless a cache helps. An inode can hold direct block pointers and roots of indirect pointer arrays. An extent stores one contiguous range using a logical start, physical start, and length.',
    'Use a teaching inode with twelve direct pointers, one single-indirect pointer, and one double-indirect pointer. Data blocks are 4096 bytes and block numbers occupy four bytes, so one indirect block holds 1024 pointers. The actual filesystem also needs validity flags, checksums, bounds, and allocation metadata; this model isolates the indexing arithmetic.'
  ], [
    table('Logical block ranges in the pointer model', ['Region', 'Logical blocks', 'Data capacity'], [['Direct','0 through 11','12*4096 = 48 KiB'],['Single indirect','12 through 1035','1024*4096 = 4 MiB'],['Double indirect','1036 through 1049611','1024*1024*4096 = 4 GiB'],['Total modeled capacity','12+1024+1048576 blocks','4 GiB + 4 MiB + 48 KiB']]),
    trace('Map file byte offset 5,000,123', ['Step', 'Calculation', 'Result'], [['Logical block and displacement','5,000,123 = 1220*4096 + 3003','Block 1220, byte 3003'],['Choose region','1220 exceeds direct and single-indirect coverage','Double-indirect region'],['Subtract preceding blocks','1220 - 12 - 1024','184'],['Select pointer indices','184/1024 and 184%1024','Top index 0, second-level index 184'],['Finish physical access','Read the selected data block, then select byte 3003','The pointer values determine the final physical block']]),
    prose('Derive metadata read costs and extents',
      'With a cold cache and the inode already available, a direct block needs one data-block read. A single-indirect block needs an indirect-block read and a data read. A double-indirect lookup needs two pointer-block reads and a data read. Metadata caching can remove some of these I/Os for later accesses. These are dependency counts; read-ahead and parallelism may affect elapsed time.',
      'An extent (logical=100, physical=900, length=8) covers logical blocks 100 through 107. Logical block 104 maps to physical block 900+(104-100)=904. A long contiguous file can be represented by a small number of extents. Fragmentation increases the number of records, and a tree may be needed to find the extent containing an arbitrary logical block. Insertion and splitting require updates to both mapping metadata and allocation accounting.'),
    table('A cache page has several independent properties', ['Property', 'Meaning', 'Consequence'], [['Present and valid','The cache contains initialized bytes for this file range','Readers may use them after the appropriate lock or reference acquisition.'],['Dirty','Memory contains changes that need persistence','Eviction must arrange writeback or discard according to the contract.'],['Writeback in progress','A submitted I/O owns a snapshot or pinned representation','Completion must correspond to the submitted generation.'],['Referenced or locked','An active operation depends on the page remaining alive','Reclamation waits or chooses another page.']]),
    prose('Avoid losing a write during writeback',
      'Suppose a page contains version 4 and writeback starts. Before the I/O completes, a writer creates version 5 in memory. Completing the version-4 write must not mark version 5 clean. One implementation can clear the dirty state when selecting a stable writeback snapshot, then let later writers set it again. Completion clears only the writeback state, preserving any newly recorded dirty state. Another implementation can compare generations.',
      'The page cache can satisfy a read from memory even when the underlying disk contains an older version. This is correct for normal cached I/O under the filesystem’s consistency rules. A durability operation must drive the necessary dirty data and metadata to the device’s persistence boundary and report failures. Closing a descriptor alone is insufficient as a universal durability specification.',
      'Read-ahead predicts future access and issues I/O before a caller asks. Sequential scans benefit when prediction is accurate; random access can waste bandwidth and evict useful pages. A cache policy should account separately for clean eviction, dirty writeback, metadata locality, and memory pressure. Measure hit rate together with writeback latency because a high hit rate can coexist with long stalls when dirty memory must be reclaimed.'),
    exercise('Resolve one more pointer and one dirty generation', 'In the same inode model, map logical block 2062. A cache page begins writeback at generation 11 and is modified to generation 12 before completion.',
      ['Compute the two double-indirect indices.', 'State the correct dirty state after generation-11 I/O completes.'],
      ['Subtract 1036 to obtain 1026. Dividing by 1024 gives top index 1 and second-level index 2.', 'Generation 12 remains dirty and needs another writeback. Completing the older request can release its own I/O state, but cannot erase evidence of the newer modification.'],
      ['Indices 1 and 2.', 'Newer dirty generation survives old completion.'])
  ], [ost('file-implementation','Chapter 40: File System Implementation'), ref('Linux ext4 mapping documentation','https://docs.kernel.org/filesystems/ext4/ifork.html','Direct/indirect blocks and extent trees'), osc('Chapter 14: Allocation and caching')])
];

systemsHandbook['fat-write-driver'] = [
  topic('fat-packed-update-allocation-lfn', 'entries', 'Update packed FAT entries, reserve clusters, and publish long names', [
    'A FAT update changes shared on-disk bytes. In FAT12, two entries occupy three bytes, so changing one entry requires preserving the neighboring entry’s nibble. A lock must cover the complete read-modify-write operation for every overlapping byte window. Separate locks keyed only by cluster number would allow adjacent entries to race on their shared byte.',
    'Allocation adds a second transaction: choose a free cluster, reserve it against competing writers, initialize its data, link it into a chain, and eventually publish the new file size. An in-memory reservation can prevent two running threads from choosing the same free cluster, while crash consistency still depends on the order and durability of on-disk updates.'
  ], [
    code('Preserve the neighboring FAT12 entry', 'c', `#include <stddef.h>
#include <stdint.h>
int fat12_store(uint8_t *fat, size_t bytes,
                uint32_t cluster, uint16_t value) {
    uint64_t offset = (uint64_t)cluster + cluster / 2;
    if (!fat || value > 0x0fff || bytes < 2 || offset > bytes - 2)
        return 0;
    size_t i = (size_t)offset;
    uint16_t pair = (uint16_t)fat[i] |
                    ((uint16_t)fat[i + 1] << 8);
    if (cluster & 1)
        pair = (pair & 0x000f) | (uint16_t)(value << 4);
    else
        pair = (pair & 0xf000) | value;
    fat[i] = (uint8_t)pair;
    fat[i + 1] = (uint8_t)(pair >> 8);
    return 1;
}`,
      'The caller validates the cluster’s semantic range and holds the lock protecting both bytes. This function changes an in-memory image; persistence requires a separate sector-write protocol.',
      'If the two-byte window crosses a sector boundary, both cache sectors participate in locking, dirty tracking, error handling, and crash tests.'),
    trace('Update entries 2 and 3 independently', ['State', 'Packed bytes at offsets 3..5', 'Decoded values'], [['Initial','56 c4 ab','Entry 2=0x456; entry 3=0xabc'],['Set entry 2 to 0x123','23 c1 ab','Entry 2=0x123; entry 3 remains 0xabc'],['Then set entry 3 to 0x789','23 91 78','Entry 2 remains 0x123; entry 3=0x789']]),
    prose('Preserve bits and locate the authoritative table',
      'A FAT32 entry stores its allocation value in the low 28 bits. To replace it, combine (old_raw & 0xf0000000) with (new_value & 0x0fffffff). Updating raw 0xa0000123 to value 0x0456789 therefore produces 0xa0456789. The preserved high nibble is part of the on-disk update rule even though readers mask it from the cluster value.',
      'FAT32 extended flags specify whether FAT mirroring is enabled; with mirroring disabled, the selected active FAT determines normal access. When mirroring is enabled, updating copies creates multiple persistence events. A failure between them can leave disagreement. Define mount and repair behavior explicitly. FSInfo free-count and next-free fields accelerate allocation, but they are hints that must be checked against actual table entries; an unknown count or stale hint cannot authorize reuse of an allocated cluster.'),
    steps('Reserve one cluster without duplicating ownership', [['Search','Start from a validated hint and scan a bounded number of usable cluster entries, wrapping once.'],['Serialize selection','Under the allocation lock, confirm the candidate is still free and mark it reserved in the allocator’s state.'],['Initialize','Write the intended contents or zeros for bytes that may become visible. Handle I/O failure before linking the cluster into a live file.'],['Link and account','Apply the chosen persistence order, update the chain, and record free-space accounting. Failed publication must leave either a recoverable reservation or a correctly rolled-back allocation.']]),
    table('A two-record long filename for experiment.txt', ['Record on disk', 'Ordinal', 'UTF-16 content', 'Common validation'], [['First long-name record','0x42: final-record bit plus ordinal 2','The final t, then terminator and padding','Attribute 0x0f, type zero, short-name checksum, zero first-cluster field'],['Second long-name record','0x01','The first thirteen units: experiment.tx','Same checksum and descending ordinal sequence'],['Following short record','Ordinary short entry','A generated unique 8.3 alias','Its eleven name bytes must match the long-name checksum']]),
    prose('Publish names as a validated sequence',
      'Long-name records store thirteen UTF-16 code units split among byte ranges 1..10, 14..25, and 28..31. Reassemble units with little-endian reads, bound the number of records, validate descending ordinals and a consistent checksum, and handle the terminator and padding. A malformed run should not supply a trusted long name to an unrelated following short entry.',
      'Name creation requires enough directory slots for the long-name run and short entry. A crash can leave fragments, so the writer and reader must agree on what makes a name sequence visible and valid. A conservative nonjournaled design can prepare fragments before publishing the final short entry, while acknowledging that FAT provides no general multi-sector transaction. Collision handling for the short alias and Unicode comparison rules are separate policies that need their own tests.'),
    exercise('Prove a neighbor survives', 'Begin with bytes 56 c4 ab, representing entries 2 and 3. Change only entry 3 to 0x002.',
      ['Calculate the resulting three bytes and decode both entries.', 'Explain what synchronization is required if another writer simultaneously changes entry 2.'],
      ['The two-byte odd-entry window starts at offset 4. Preserve its low nibble 4 and insert 0x002<<4, giving pair 0x0024. The full bytes become 56 24 00. Entry 2 still decodes to 0x456 and entry 3 to 0x002.', 'Both operations touch byte 4, so one lock or a compatible cache-sector locking protocol must serialize their read-modify-write windows. Per-entry locking without overlap coordination can lose one writer’s preserved nibble.'],
      ['Bytes 56 24 00.', 'Unchanged neighbor value 0x456.'])
  ], [fatSpec, osc('Chapter 14: Free-space management and consistency')]),

  topic('write-ordering-journal-recovery', 'ordering', 'Derive crash states and a write-ahead journal commit protocol', [
    'A filesystem update often changes data blocks, allocation metadata, a file’s mapping, and its visible size. Power can fail after any subset becomes durable. Correctness therefore needs a model of persistence: which write sizes are atomic, what completion means, whether a cache is volatile, and which flush or ordering operations the device honors.',
    'Start with appending a new cluster to a FAT file. Publishing a larger file size before the new data and chain are durable can expose missing or stale bytes. Writing and allocating a new cluster first can leave an unreachable allocation after a crash. The latter state can be discovered and reclaimed by a checker, while the former can misrepresent already acknowledged file contents.'
  ], [
    table('Nonjournaled append stages and crash evidence', ['Durable stage reached', 'Possible post-crash state', 'Recovery question'], [['New cluster data initialized','Old file remains unchanged; new bytes are unreachable','Is the cluster still free or held by a recoverable reservation?'],['New cluster allocated with end marker','Allocated cluster has no directory path','Can a full allocation scan identify it as unreachable?'],['Old tail linked to new cluster','Chain is longer while old logical size may remain','Can excess allocation be retained safely or trimmed?'],['Larger size published','New logical bytes are visible','Were all data and chain writes durable before this publication?']]),
    prose('A journal turns a group into a recoverable decision',
      'For an illustrative filesystem with a journal, store a transaction identifier, destination block numbers, new metadata block images, and a commit record. The commit record is the durable decision that recovery should install the transaction. Plain FAT has no general journal; adding this protocol requires a documented additional layer or filesystem format feature. The lesson derives the mechanism independently of FAT’s baseline layout.',
      'Assume metadata block images and commit records carry enough length, identity, and integrity information to reject torn or stale log entries. Also assume the storage interface provides the required persistence ordering. A checksum alone does not establish that the right generation reached stable storage, so transaction identifiers and log-position rules remain part of validation.'),
    steps('Commit metadata with ordered data', [['Prepare data','Initialize new data blocks and make them durable before committing metadata that exposes them. This chosen mode orders data without placing every data byte in the metadata journal.'],['Write log payload','Write the transaction descriptor and new metadata images into reserved log space. Retain enough free log capacity to complete the operation.'],['Persist the payload','Use the device’s required flush or persistence primitive so a later durable commit cannot precede its log contents.'],['Persist the commit','Write the validated commit record and establish its durability. Recovery can now replay this transaction after a crash.'],['Checkpoint home blocks','Copy committed images to their ordinary filesystem locations. Repeating these same block-image writes is idempotent.'],['Reclaim the log','Only after home blocks are durable may the log space be reused under the log’s generation protocol.']]),
    trace('Cut power after different journal events', ['Crash point', 'Recovery action', 'Reason'], [['Payload partly written, no valid commit','Ignore incomplete transaction','No durable decision authorizes publication.'],['Payload durable, commit absent','Ignore transaction','Prepared work is still uncommitted.'],['Commit durable, home blocks old','Replay every committed metadata image','Log contains the decision and complete replacement state.'],['Some home blocks updated','Replay the same committed images again','Whole-image replay restores the transaction without incrementing counters twice.'],['Home blocks durable, log space reusable','Use installed state and valid log-generation rules','Recycled old bytes must not masquerade as a new committed transaction.']]),
    prose('Choose what atomicity means for the caller',
      'Metadata journaling can protect structural consistency while allowing recently written file data to be lost under its documented mode. Data journaling also records payload bytes, increasing log traffic while changing recovery guarantees. Ordered mode establishes a particular relation between new data and metadata publication. Each is a concrete contract; the presence of a journal alone does not describe which writes an application can rely on after a crash.',
      'A file replacement procedure can create a temporary file, write contents, synchronize it, rename it over the destination, and synchronize the containing directory when the filesystem and API require that for durable namespace changes. The exact guarantees are filesystem-specific. A teaching kernel should expose a precise sync operation and test its promised ordering against the storage contract.',
      'Failure injection should stop after every persistence event, remount a fresh image, and validate reachability, allocation uniqueness, initialized visible bytes, and acknowledged durability. Process termination tests a different boundary from power loss because the operating system may keep flushing caches after a process dies.'),
    exercise('Find an invalid commit ordering', 'A journal implementation writes the commit record, flushes it, then writes metadata images into the log. Power fails midway through those images.',
      ['Explain why the recovery rule cannot safely replay this transaction.', 'Give the necessary ordering and an idempotent replay representation.'],
      ['The durable commit claims that a complete transaction exists, but some required images may be absent or torn. Recovery cannot infer the missing new metadata from the decision alone.', 'Persist the descriptor and all log images before persisting the commit. Store complete destination block images with transaction identity and integrity checks, then replay the same images after a crash; repeated replay installs the same state.'],
      ['Payload durability precedes commit durability.', 'Log reuse follows durable checkpointing.'])
  ], [ost('file-journaling','Chapter 42: Crash Consistency and Journaling'), fatSpec, osc('Chapter 14: Recovery')]),

  topic('log-structured-checksums', 'crash', 'Follow a log-structured update, clean a segment, and verify block identity', [
    'A log-structured filesystem writes new versions into free sequential regions called segments. Updating a data block also creates new mapping metadata that points to its new location. A checkpoint identifies a recoverable root of the current mapping. Reading follows that mapping to the latest live version, even though older physical copies may still occupy previous segments.',
    'This layout converts scattered logical updates into grouped physical writes, but obsolete versions accumulate. A cleaner must find live records, copy them elsewhere, update their mappings, and reclaim a segment only after the moved records remain recoverable. Cleaning is therefore part of the normal space-management algorithm.'
  ], [
    trace('One file block changes twice', ['Generation', 'New log records', 'Current mapping after commit', 'Obsolete records'], [['10','Data at block 800; inode version at 801','file block 2 -> 800','None from this example'],['11','Data at 920; inode version at 921','file block 2 -> 920','Old data 800 and superseded metadata 801'],['12','Data at 1000; inode version at 1001','file block 2 -> 1000','Earlier versions remain physically present until cleaning']]),
    prose('Find live data by identity and generation',
      'A segment summary can record which file and logical block each physical record represents. To decide whether a record is still live, compare it with the current mapping and generation. A record whose logical identity now points elsewhere is obsolete. Copying every old record as live would resurrect superseded data and eliminate the space benefit of cleaning.',
      'Moving live data also moves the metadata that locates it. The cleaner must publish these changes using the filesystem’s checkpoint or transaction protocol. A crash before publication should leave the old recoverable mapping intact; a crash after publication should find the new locations. Erasing or reusing the old segment before establishing that boundary can destroy the only durable copy.'),
    table('Cleaning arithmetic for a 100-block segment', ['Live fraction', 'Blocks copied', 'Net blocks made available', 'Ideal write amplification when refilled'], [['20%','20','80','(20+80)/80 = 1.25'],['60%','60','40','(60+40)/40 = 2.5'],['90%','90','10','(90+10)/10 = 10']]),
    prose('Derive the free-space tradeoff',
      'If a victim segment contains live fraction u, copying requires u*S writes for segment size S and yields (1-u)*S net space. Filling that net space with new host data produces S total physical writes, so the simplified amplification is 1/(1-u). This ignores metadata, reads, and repeated cleaning interactions. The formula explains why collecting nearly full live segments can be expensive.',
      'Separating frequently updated data from cold data can create victims with many obsolete records. Segment selection can consider age, utilization, and cleaning cost. Enough free segments must remain to relocate live data; an allocator that consumes every free destination can deadlock its own cleaner. Reserve emergency space and define what foreground writers do while reclamation catches up.'),
    table('An integrity record needs context', ['Covered field', 'Why include it'], [['Payload bytes','Detect accidental changes to the data.'],['Logical block identity','Detect a valid block delivered to the wrong logical address.'],['Generation or transaction identifier','Distinguish a stale but internally intact version from the expected current version.'],['Length and format version','Bound parsing and identify which representation the checksum describes.']]),
    prose('Distinguish detection, repair, and authenticity',
      'A checksum maps a block to a shorter value and can detect many accidental corruptions. Collisions remain possible. A checksum cannot reconstruct arbitrary lost bytes by itself; repair needs another valid copy, parity sufficient for the failure, or regeneration from a trusted source. Storing the checksum beside data also requires a strategy for corruption of the checksum metadata.',
      'An unkeyed checksum does not authenticate a maliciously modified block when an attacker can recompute it. A message authentication code or authenticated storage design can bind contents to a secret key and appropriate context. Encryption protects confidentiality under its scheme, while integrity and rollback resistance require their own properties. Record the threat model before choosing primitives.',
      'For an educational integrity test, corrupt one payload byte, swap two complete records, and replay a valid older generation. A payload-only checksum may catch the first case and accept the other two. Binding logical identity and generation into the expected verification context lets the reader reject misdirection and stale replay according to the checkpoint’s authoritative state.'),
    exercise('A correct checksum on the wrong block', 'Logical block 5 expects generation 18. A device returns the complete bytes and valid stored checksum of logical block 6 at generation 18.',
      ['Explain why verifying only the returned payload and its stored checksum can succeed.', 'Describe the verification input that exposes the mistake, then calculate cleaning amplification at live fraction 0.25.'],
      ['The returned block and checksum agree with each other, so a payload-only check sees no internal corruption. The error is its identity relative to the request.', 'Verify the expected logical identity and generation from trusted mapping state as part of the checksum or authenticated context. At u=0.25, ideal amplification is 1/(1-0.25)=4/3.'],
      ['Identity mismatch is detected.', 'Amplification is approximately 1.333.'])
  ], [ost('file-lfs','Chapter 43: Log-structured File Systems'), ost('file-integrity','Chapter 45: Data Integrity and Protection'), osc('Chapter 14: Log-structured filesystems and recovery')])
];

systemsHandbook['libc-and-shell'] = [
  topic('syscall-abi-errors-progress', 'libc', 'Trace the syscall ABI and preserve partial I/O progress', [
    'The course syscall ABI uses EAX for the operation number and result, with EBX, ECX, and EDX carrying three arguments. A C call follows the compiler’s function ABI first; a wrapper then translates its arguments into the syscall register convention. The kernel entry saves the required user state, dispatches the operation, validates access, and returns a signed result.',
    'For a write of eight bytes at user address 0x00400ffc, the buffer crosses a page boundary: four bytes occupy the end of page 0x00400000 and four occupy page 0x00401000. A descriptor check alone establishes no right to read that memory. The handler needs a fault-aware copy and a mapping-lifetime policy as well as permission checks for every touched page.'
  ], [
    trace('A write request across the boundary', ['Boundary', 'State', 'Responsibility'], [['C caller','write(fd=3, buffer=0x00400ffc, length=8)','Keep the buffer valid for the operation’s documented duration.'],['Course wrapper','EAX=1, EBX=3, ECX=0x00400ffc, EDX=8','Apply the exact i386 non-PIC wrapper constraints from the lesson.'],['Kernel dispatch','Saved frame identifies operation 1','Validate descriptor rights, range, pages, and transfer policy.'],['Partial completion','EAX=5','Five bytes transferred; three remain.'],['Library-facing translation','Return 5 for progress, or translate a raw negative error','Preserve the distinction between a byte count and an error code.']]),
    prose('Describe both compiler and kernel obligations',
      'A GCC extended-assembly operand such as +a states that EAX is both input and output. Inputs constrained to b, c, and d select EBX, ECX, and EDX. A memory clobber tells the compiler that the assembly can affect memory beyond the listed C operands; it does not validate user pointers or implement a device memory barrier. The cc clobber records condition-code effects. Compile assumptions such as i386, non-PIC, and non-PIE belong beside the wrapper.',
      'A libc-style error convention can turn raw result -5 into return value -1 and errno=5. That storage is library state, and concurrent threads need independent errno storage. The course’s raw os_write interface continues to return negative codes directly. Mixing the two conventions can turn an expected retry decision into a comparison against the wrong value.'),
    code('A transport-independent loop that reports both progress and error', 'c', `#include <stdint.h>
#include <limits.h>
struct write_result { uint32_t done; int32_t error; };
typedef int32_t (*writer_fn)(void *, const unsigned char *, uint32_t);
struct write_result send_bytes(writer_fn write_one, void *context,
                               const unsigned char *data, uint32_t count) {
    struct write_result result = {0, 0};
    if (!write_one || count > INT32_MAX || (count && !data)) {
        result.error = -22;
        return result;
    }
    while (result.done < count) {
        uint32_t left = count - result.done;
        int32_t n = write_one(context, data + result.done, left);
        if (n < 0) { result.error = n; break; }
        if (n == 0 || (uint32_t)n > left) {
            result.error = -5;
            break;
        }
        result.done += (uint32_t)n;
    }
    return result;
}`,
      'This standalone model uses illustrative -22 for invalid input and -5 for failed progress. The callback contract returns completed bytes, zero, or a negative error and preserves already completed effects.',
      'The function stops at the first error and reports the completed prefix. It performs no automatic retry of interruptions or nonblocking conditions because those policies belong to the surrounding API.',
      'The caller supplies a valid array of count bytes. Kernel pointer validation remains a separate obligation if the callback crosses into the kernel.'),
    trace('Twelve requested bytes with a later error', ['Call', 'Pointer offset', 'Requested count', 'Result', 'Accumulated result'], [['1','0','12','5','done=5, error=0'],['2','5','7','3','done=8, error=0'],['3','8','4','-7','done=8, error=-7']]),
    prose('Retry only the operation whose semantics permit it',
      'Retrying the entire twelve-byte request after the third call would duplicate the first eight bytes on an append-only output. Retrying the remaining four bytes can be valid if the error and stream state permit it. A network or device operation may have an ambiguous outcome after failure, so even the reported progress contract must be defined by that interface.',
      'Blocking, nonblocking, and interruption behavior belong in the contract. A nonblocking writer can ask the caller to wait for readiness, while a blocking writer can sleep internally. Repeatedly retrying a no-progress result consumes CPU without improving readiness. Event loops register interest in writable state and resume only when the scheduling protocol says another attempt is useful.',
      'A zero-length request should follow the API’s documented rule without forming invalid pointer arithmetic or dereferencing a null buffer. Large lengths also need a representable result range. The explicit INT32_MAX check keeps positive byte counts distinguishable from negative errors in this model.'),
    exercise('Handle a partial prefix', 'A nine-byte write returns 4, then -11. The caller wants eventual complete delivery, and the stream contract confirms that exactly four bytes were accepted.',
      ['State the next pointer and length after readiness permits retry.', 'Explain what additional information would be required if acceptance were ambiguous.'],
      ['Resume at original pointer+4 with length 5. Preserve the completed prefix in caller state and wait according to the meaning of -11 in the chosen API.', 'An ambiguous remote effect needs a protocol such as an operation identifier, offset-based idempotent write, or acknowledgement/query mechanism. Replaying bytes blindly can duplicate effects.'],
      ['Retry begins at offset 4.', 'Raw error codes and libc errno conventions stay distinct.'])
  ], [ref('GCC extended assembly','https://gcc.gnu.org/onlinedocs/gcc/Extended-Asm.html','Operands, constraints, and clobbers'), osc('Chapter 2: System-call interfaces'), ost('file-intro','Chapter 39: File I/O interfaces')]),

  topic('shell-pipeline-fd-lifetimes', 'session', 'Construct a three-process pipeline and close every unused endpoint', [
    'A shell pipeline connects a producer’s standard output to another program’s standard input using pipe objects and descriptor references. The programs run concurrently because a finite pipe can fill before the producer finishes. The shell parses the whole command into an execution plan, creates the required pipes, launches all stages, closes its own unused endpoints, and then waits.',
    'Use the illustrative command generate | filter | count > result.txt. This is a design exercise for a Unix-like process API. It describes fork, descriptor duplication, and exec semantics explicitly; it does not imply that every hosted API is already implemented by the course kernel.'
  ], [
    table('Two pipes before any child closes descriptors', ['Pipe', 'Read descriptor', 'Write descriptor', 'Intended data path'], [['P','3','4','generate -> filter'],['Q','5','6','filter -> count']]),
    table('Descriptor plan for each child after redirection', ['Process', 'fd 0', 'fd 1', 'fd 2', 'Original pipe fds to close'], [['generate','Inherited input','Duplicate of P write end','Inherited diagnostics','3,4,5,6 after successful duplication'],['filter','Duplicate of P read end','Duplicate of Q write end','Inherited diagnostics','3,4,5,6 after successful duplication'],['count','Duplicate of Q read end','Opened result.txt','Inherited diagnostics','3,4,5,6 plus temporary output fd after duplication'],['parent shell','Interactive input','Interactive output','Diagnostics','3,4,5,6 after all launches']]),
    prose('Derive closure from references',
      'Duplicating descriptor 4 onto descriptor 1 makes both refer to the same pipe writer until the original 4 is closed. The producer therefore closes original pipe descriptors after installing its standard streams. The consumer sees EOF only when the pipe buffer is empty and every writer reference is gone. A parent shell that keeps descriptor 4 open can keep filter waiting even after generate exits.',
      'For this table, assume descriptors 0, 1, and 2 were already open, so newly created pipes use 3 through 6. A general executor must handle collisions if a standard descriptor was initially closed. A close list that blindly closes a pipe descriptor equal to a newly installed standard descriptor can destroy the desired redirection. Descriptor actions should be planned and tested under those edge cases.'),
    steps('Execute the pipeline without serializing its stages', [['Parse and bound','Produce three command nodes with argument arrays and one final output redirection. Reject syntax and capacity errors before changing live descriptors.'],['Create channels','Allocate both pipes and retain an error-cleanup list. If the second pipe fails, close both ends of the first.'],['Launch each stage','In each child, install input/output descriptors, close unused references, and exec the selected executable. On failure, report through a retained diagnostic channel and terminate the child path.'],['Release parent endpoints','After launches, close all parent copies so they cannot hold writers or readers alive accidentally.'],['Wait and collect','Collect every child result, retry interrupted waits according to the API, and compute the pipeline status under a documented shell policy.']]),
    trace('Why waiting before launching the consumer hangs', ['Event', 'Producer', 'Consumer', 'Parent'], [['Producer launched','Writes into P','Does not yet exist','Calls wait on producer'],['P reaches capacity','Blocks waiting for a reader to free space','Does not exist','Still waiting for producer exit'],['Dependency','Needs consumer execution','Needs parent to launch it','Needs producer completion']]),
    prose('A failure path is part of the pipeline',
      'If the middle stage fails to exec, it must close its endpoints when terminating. The first stage can then discover the lack of readers under the pipe API’s broken-pipe behavior, while the last stage eventually sees EOF when Q has no writers. A course kernel may return a designated error; a hosted Unix environment may also deliver SIGPIPE. Document the chosen mechanism and make utilities handle the resulting termination or error coherently.',
      'If process creation fails after one child has started, the parent still owns that child and every remaining descriptor. A cleanup policy may close channels, signal the partial pipeline if supported, and reap the already created children. Returning directly to the prompt without tracking them leaks lifecycle state and can leave writers blocked forever.',
      'Redirection order can affect diagnostics. A shell language that accepts 2>&1 after >file redirects both streams to the file, while applying 2>&1 before >file can leave diagnostics attached to the old output description. The parser should preserve ordered redirection operations if it supports that syntax. A minimal shell can reject unsupported forms explicitly while still implementing a precise smaller language.'),
    exercise('Find the hidden writer', 'generate exits successfully, filter is blocked reading an empty P, and the parent still holds descriptor 4. All other P writer references are closed.',
      ['Identify the action that permits EOF and explain why another timer tick cannot fix the reference count.', 'Specify a test that forces the pipeline to use both blocking and EOF paths.'],
      ['Closing the parent’s descriptor 4 removes the final writer reference. The empty pipe then meets its EOF condition. Scheduling time cannot remove an owned descriptor by itself.', 'Generate substantially more data than the pipe capacity, launch all stages before waiting, verify the final byte or line count, and assert that every child exits after the parent closes its endpoints. The oversized payload forces backpressure before testing EOF.'],
      ['All unused parent write ends close.', 'Every launched child is collected.'])
  ], [ref('Linux pipe interface documentation','https://man7.org/linux/man-pages/man2/pipe.2.html','Pipe endpoints and fork inheritance'), ref('Linux descriptor duplication','https://man7.org/linux/man-pages/man2/dup.2.html','Shared open-file descriptions and dup2'), ref('Linux exec interface','https://man7.org/linux/man-pages/man2/execve.2.html','Process-image replacement and inherited descriptors'), osc('Chapter 3: Process creation and communication')]),

  topic('protection-acl-capabilities', 'boundary', 'Design authorization with ACLs, capabilities, and object-bound checks', [
    'Protection controls which operations a subject may perform on an object. A subject can be a process acting with credentials; an object can be a file, pipe endpoint, device, or address space. Authentication establishes an identity claim. Authorization evaluates whether that identity or authority permits a requested action. Keep these decisions separate in the system model.',
    'Begin with an access matrix: rows are subjects, columns are objects, and each cell contains permitted operations. An access-control list stores an object-oriented view of that matrix. A capability is an unforgeable reference that designates an object together with rights. Either design still needs a trusted enforcement path and explicit rules for delegation, revocation, and lifetime.'
  ], [
    table('An illustrative access matrix', ['Subject', 'report file', 'printer', 'log file'], [['Editor process','read, write','submit','append'],['Viewer process','read','none','none'],['Print service','read through a supplied reference','administer','append']]),
    prose('Make authority concrete',
      'An ACL-based open can inspect the file’s access list and the caller’s effective credentials, then create an open description with an allowed mode. A capability-based request can present a handle already carrying read authority to the exact file object. A kernel descriptor table can protect handles against fabrication by userspace: guessing a number refers only to that process’s existing table entry, and the kernel checks the requested right.',
      'A capability can be attenuated by producing a derived handle with fewer rights. For example, an editor passes a read-only handle to a preview worker while retaining its own writable handle. The worker gains access to that one object without receiving broad directory traversal authority. This model requires that the worker cannot reconstruct greater authority through another inherited handle or unrestricted service.'),
    trace('A pathname check can race with a later use', ['Step', 'Privileged service', 'Concurrent namespace change', 'Risk'], [['1','Checks that /tmp/job refers to an allowed file','None yet','Check applies to object A.'],['2','Pauses before opening the path','Another process replaces the path with a link or different object','Name now designates object B.'],['3','Opens /tmp/job with broad authority','Replacement remains','Use can affect B even though A was checked.']]),
    prose('Bind the decision to the object used',
      'Open or resolve through an interface that enforces the intended traversal restrictions, obtain a stable object reference, validate that object, and perform the authorized operation through that reference. If a directory-relative handle API is available, use it to constrain the lookup root and define whether symbolic links or mount crossings are permitted. The exact primitive depends on the kernel; a separate check followed by a separate unrestricted pathname lookup leaves a race.',
      'The confused-deputy problem appears when a privileged service uses its own broad authority on behalf of a caller whose request lacks equivalent rights. A printing service asked to read a private pathname might accidentally expose contents the caller cannot access. Accepting an appropriately authorized file handle can make the caller’s intended authority explicit. The service still validates the handle’s type and requested operation.'),
    table('Revocation and cached authority', ['Design question', 'One possible policy', 'What the implementation must enforce'], [['ACL changes after open','Existing open modes remain valid until close','Document that revocation applies to future opens, and track current open references.'],['Immediate revocation required','Check a revocation generation on each protected use','Updates invalidate or reject cached authority consistently.'],['Delegated capability revoked','Route derived handles through a revocable indirection object','Every use follows the indirection or validates a current generation.'],['Object deleted and storage reused','Handles retain identity and generation','A stale handle cannot acquire the rights of an unrelated replacement object.']]),
    prose('Build the security argument in layers',
      'Least privilege assigns each component only the authority needed for its work. Complete mediation checks the relevant authority at every protected operation or uses a previously granted object whose continued validity is itself enforced. Fail-closed behavior rejects requests when required authorization evidence is missing or malformed. These properties need tests at syscall boundaries and service interfaces, including error and concurrent mutation paths.',
      'Isolation also needs resource limits. A process with no permission to modify another process’s memory can still consume all available memory, descriptors, or CPU without quotas and scheduling policy. Bounds on parser work, request sizes, and outstanding operations protect availability. Memory safety, input validation, auditing, and controlled privilege transitions support the same protection boundary.',
      'Linux also uses the term capabilities for a mechanism that divides traditional privileged powers into named sets. That mechanism is a concrete credential model. The general object-capability model taught here attaches authority to object references, so specify which meaning applies in an API discussion.'),
    exercise('Delegate a preview safely', 'An editor can read and write document D and access a private directory. A preview worker needs to read D and return rendered bytes.',
      ['List the minimum object handles the worker needs.', 'Describe a revocation policy and one test for accidental excess authority.'],
      ['Give the worker a read-only reference to D and a channel for returning output. Omit the editor’s writable document handle and broad private-directory handle.', 'For immediate revocation, use a generation-checked indirection that every worker read consults. Test that write requests through the delegated handle fail and that unrelated pathname access cannot recover omitted authority.'],
      ['Read access is limited to D.', 'Revocation semantics are stated explicitly.'])
  ], [ost('security-access','Chapter 55: Access Control'), osc('Chapters 16 and 17: Security and Protection')])
];

systemsHandbook['capstone'] = [
  topic('virtual-machines-nested-paging', 'architecture', 'Translate guest execution through a hypervisor and nested page tables', [
    'A virtual machine monitor, or hypervisor, supplies a guest with virtual CPUs, guest physical memory, and devices. The guest kernel manages its own processes and page tables within that environment. Hardware-assisted virtualization can execute much guest code directly while transferring control to the hypervisor for configured events. Device emulation and address translation determine which real resources those guest operations reach.',
    'Keep three address names in the trace: a guest virtual address is used by guest software; a guest physical address is produced by the guest page tables; a host physical address identifies the actual memory backing the guest. Nested translation, called EPT on Intel or NPT on AMD, lets hardware compose the guest and hypervisor mappings while enforcing their permissions.'
  ], [
    trace('One two-stage translation with 4 KiB pages', ['Stage', 'Input', 'Mapping', 'Output'], [['Guest page lookup','GVA 0x0000000040123456','Guest virtual page 0x40123 -> guest physical frame 0x2ab','GPA 0x002ab456'],['Nested page lookup','GPA 0x002ab456','Guest physical frame 0x2ab -> host physical frame 0x19f00','HPA 0x19f00456'],['Byte selection','Offset 0x456','The 12-bit page offset survives both page-granular mappings','Host byte at 0x19f00456']]),
    prose('Distinguish faults by which mapping rejected access',
      'If the guest page tables reject a user write, the event belongs to the guest’s virtual-memory contract and can be delivered as a guest page fault. If the nested mapping blocks access to a guest physical page, the hypervisor must handle that second-stage condition. It may allocate backing memory, emulate a device region, enforce a protection rule, or terminate a faulty guest according to policy. The guest cannot grant itself host authority merely by placing a value in its own page table.',
      'Shadow paging is another implementation approach: the hypervisor maintains composed mappings and tracks relevant guest page-table changes so the shadow remains consistent. Nested paging lets hardware perform the two-stage walk, reducing some software interception work while introducing additional translation structures. Both need invalidation rules when mappings change. Cached translations must stop authorizing a mapping once the architecture requires revocation to take effect.'),
    table('Cold-walk cost in a deliberately uncached four-level model', ['Work', 'Count', 'Why'], [['Read four guest page-table entries','4 * (4 nested-table reads + 1 guest-entry read) = 20','Each guest page-table entry itself resides at a guest physical address that needs nested translation.'],['Translate final guest data address','4 nested-table reads','Find the host frame backing the final guest physical page.'],['Access requested data','1','Read or write the actual host memory byte or cache line.'],['Total memory references','25','24 translation-related references plus the final data access.']]),
    prose('Interpret the cost as a bound for the model',
      'The 25-reference count assumes four levels at both stages, no large pages, and no translation or page-walk cache hits. Real processors cache combined translations and intermediate walk results, so a steady-state access can be much cheaper. A guest large page and a suitable nested large-page mapping can reduce walk work, while fragmentation and protection granularity can limit their use.',
      'A virtual CPU is usually also a schedulable entity in the host. A guest thread may be runnable while its virtual CPU waits for host service. A guest spinlock can therefore waste a running virtual CPU if the lock owner’s virtual CPU has been descheduled. Oversubscription, interrupt delivery, and virtual timer behavior add a second scheduling layer that guest-only measurements cannot fully explain.'),
    steps('Trace an intercepted device operation', [['Guest instruction','The guest performs an I/O operation or accesses a configured emulated device region.'],['Controlled exit','Virtualization hardware saves the required guest state and enters the hypervisor with an exit reason and access information.'],['Validate and emulate','The hypervisor checks the request, updates virtual-device state, and may submit work to a host device backend.'],['Resume with a defined result','Advance or restore guest execution according to the instruction and device protocol. An asynchronous completion can later produce a virtual interrupt.']]),
    prose('Draw the isolation boundary around devices too',
      'Assigning a physical device to a guest can reduce emulation overhead, but DMA must be confined to memory the guest is allowed to access. An IOMMU maps device-generated addresses and restricts their reach. Interrupt remapping and reset behavior also matter to safe assignment. CPU page tables alone cannot constrain a device that issues independent bus transactions.',
      'A container usually shares the host kernel and uses namespace, credential, and resource-control mechanisms to isolate workloads. A virtual machine includes a guest kernel behind a virtual hardware boundary. Both designs can be useful, and both require their own attack-surface and lifecycle analysis. In a course capstone, state which resources are emulated, directly executed, shared, or assigned before making an isolation claim.'),
    exercise('Count a shorter nested walk', 'Assume a guest translation uses three page-table levels and the nested translation uses four. Every translation structure is cold, all pages use the modeled size, and no walk caching helps.',
      ['Derive the number of memory references including the final data access.', 'Explain whether guest page-table permission to write guarantees that the final write succeeds.'],
      ['Each of three guest entries costs four nested reads plus its own read: 3*5=15. Final nested translation and data access cost another 4+1=5. Total is 20.', 'The nested mapping can independently deny the access or lack backing. Both translation stages and their permission rules must permit the operation.'],
      ['Total 20 references under the stated model.', 'Guest authority remains bounded by the hypervisor mapping.'])
  ], [ost('vmm-intro','Appendix: Virtual Machine Monitors'), ref('Linux KVM MMU documentation','https://docs.kernel.org/virt/kvm/x86/mmu.html','Guest virtual, guest physical, and host physical mappings'), osc('Chapter 18: Virtual Machines')]),

  topic('rpc-retries-nfs-consistency', 'definition', 'Design RPC retries, duplicate suppression, and NFS-style persistence', [
    'A remote procedure call sends a request to another machine and waits for a reply describing the result. Messages can be delayed, duplicated, or lost, and either endpoint can restart. A timeout therefore means that the caller lacks a timely result. The server may have done nothing, may be executing, or may have completed while its reply was lost.',
    'An idempotent operation has the same externally relevant effect when repeated with the same arguments under its stated context. Setting a record to a particular value can be idempotent; incrementing a balance usually is not. Concurrency and object generations can change that analysis, so define the operation’s identity and preconditions along with its bytes.'
  ], [
    trace('A lost reply to an increment operation', ['Step', 'Client action', 'Server state', 'Client knowledge'], [['1','Send request R to add 7','Balance initially 100','No result yet'],['2','Wait','Apply R; balance becomes 107','Reply has not arrived'],['3','Timeout and resend R','Original reply was lost','Outcome still ambiguous'],['4, naive server','Receive same request bytes again','Apply again; balance becomes 114','A successful reply hides the duplicate effect'],['4, deduplicating server','Recognize the same operation identity','Return saved result 107 without reapplying','Client learns the original outcome']]),
    prose('Bind duplicate detection to a durable effect',
      'Give each operation a unique key such as client identity, client incarnation, and sequence number. The server stores a result indexed by that key. To survive a crash between applying an update and recording its result, commit the effect and duplicate record in one recoverable transaction. If only a volatile reply cache remembers the key, a reboot can forget that the operation already ran.',
      'The record also needs the request’s meaning. Receiving the same key with different arguments should be rejected as a protocol error. Retention is a design choice: deleting old records makes very late retries ambiguous unless the protocol has an acknowledged sequence window or epoch rule that rejects them. Unbounded retention consumes storage, so a production interface must define when both sides can safely forget an operation.'),
    table('Delivery and effect promises', ['Promise', 'Mechanism', 'Remaining limitation'], [['At-least-once attempt','Retry until a reply or policy limit','The server may execute a repeated non-idempotent operation multiple times.'],['At-most-once within a defined window','Detect duplicate operation identifiers and reuse results','A request may never execute; retention and crash behavior must be specified.'],['One durable effect for a recognized operation','Atomically persist effect plus deduplication result','External systems outside that transaction need compatible coordination or idempotence.']]),
    prose('Acknowledge the distributed boundary',
      'Suppose an RPC transaction updates a database and also asks an external printer to print a page. A database commit that records “printed” cannot by itself make the physical print atomic with the database update. A crash between those effects still needs reconciliation, an idempotent printer request identifier, or another protocol. Exactly-once claims must name the effect boundary they actually cover.',
      'Use exponential backoff with jitter to reduce synchronized retry storms, and bound outstanding requests so timeouts do not create unlimited work. A cancellation request is another message with an outcome to establish. The original operation can complete before cancellation arrives. Return a result that distinguishes confirmed cancellation from an unknown outcome.'),
    table('NFS version 3 write persistence concepts', ['Concept', 'Meaning for a client'], [['UNSTABLE write','The server can acknowledge data held in volatile state; further commitment is required for the promised stable result.'],['DATA_SYNC or FILE_SYNC result','The returned commitment level reports the persistence accomplished under the protocol.'],['COMMIT','Ask the server to make a previously unstable range stable.'],['Write verifier','A value that lets the client detect a server state change requiring replay of unstable writes.']]),
    prose('Relate cached reads to the consistency contract',
      'A network filesystem client caches both data and attributes to avoid a network round trip for every access. A common close-to-open discipline flushes relevant writes on close and revalidates cached state when another client opens. Concurrent clients that keep files open can still observe behavior governed by the specific cache and locking rules. A shared pathname alone does not establish instantaneous coherence among all cached copies.',
      'NFS version 3 illustrates an interface designed around restartable server operations and explicit file handles, while clients still maintain caches and protocol state. Later NFS versions add other stateful facilities. Identify the protocol version when discussing locks, opens, retry behavior, and recovery. A stale file handle, a permission error, and a network timeout represent different failures and should remain distinguishable to higher layers.',
      'An original capstone test can drop the first reply after a server commits, reboot the server before the retry, and verify that the effect remains single under the promised durable-deduplication design. A second test accepts an unstable write, changes the server verifier on restart, and checks that the client resends the needed data before declaring it durable.'),
    exercise('Crash between effect and reply', 'Request key (client C, incarnation 4, sequence 19) increments a counter from 30 to 31. The server commits the effect and its result record atomically, then crashes before replying.',
      ['State what a retry with the same key and arguments should return after recovery.', 'Explain what changes if the result record was only in volatile memory.'],
      ['Recovery finds both the counter update and saved result. The retry returns 31 and performs no second increment. The operation key identifies the already committed effect.', 'The server may forget the earlier execution and increment to 32 on retry. Preventing that outcome requires durable duplicate state tied to the effect or an operation whose repeated application is safe under its defined semantics.'],
      ['Counter remains 31 with durable deduplication.', 'Timeout is treated as an unknown result until resolved.'])
  ], [ost('dist-intro','Chapter 48: Distributed Systems'), ost('dist-nfs','Chapter 49: Network File System'), ref('RFC 5531: ONC RPC','https://www.rfc-editor.org/rfc/rfc5531','RPC transaction identifiers and call semantics'), ref('RFC 1813: NFS version 3','https://www.rfc-editor.org/rfc/rfc1813','WRITE, COMMIT, stable storage, and write verifiers'), osc('Chapter 19: Networks and Distributed Systems')])
];

// Algorithm diagrams supplement the numeric tables with control and ownership paths.
systemsHandbook['threads-and-scheduling'][2].blocks.push(flow(
  'One scheduling decision and its accounting', 'Every exit from a running interval records elapsed CPU before choosing the next eligible task.',
  [['event','Scheduling event','A timer, block, exit, or higher-priority arrival ends the current accounting interval.'],['charge','Charge elapsed service','Update the current task’s remaining budget and cumulative level allotment.'],['eligible','Any runnable task?','Inspect only eligible tasks under the queue lock.','decision'],['choose','Choose highest ready queue','Apply the stated priority and equal-priority rotation rules.'],['idle','Run idle safely','Enter the architecture’s coordinated idle and wakeup protocol.'],['dispatch','Restore chosen continuation','Install the selected context and record its dispatch time.','terminal']],
  [['event','charge'],['charge','eligible'],['eligible','choose','Yes'],['eligible','idle','No'],['choose','dispatch'],['idle','event','Wake event']],
  'Queue policy chooses the continuation; elapsed-time accounting remains necessary on every transition.'
));
systemsHandbook['ipc-and-synchronization'][1].blocks.push(flow(
  'Wait on the predicate under one mutex', 'A consumer wakes to reconsider shared state after reacquiring the same mutex.',
  [['lock','Acquire queue mutex','Own the queue invariant before reading count or closed.'],['data','Data available?','Check count greater than zero while holding the mutex.','decision'],['remove','Remove one byte','Advance head, decrease count, notify a producer, then unlock.','terminal'],['closed','Queue closed?','An empty closed queue has reached EOF.','decision'],['eof','Unlock and return EOF','Release the mutex and report the terminal condition.','terminal'],['wait','Wait and reacquire','Atomically register and release, sleep, then reacquire the mutex.']],
  [['lock','data'],['data','remove','Yes'],['data','closed','No'],['closed','eof','Yes'],['closed','wait','No'],['wait','data','Wake']],
  'The while loop is represented by the edge from wait back to the data predicate.'
));
systemsHandbook['block-devices'][0].blocks.push(flow(
  'A DMA buffer remains owned through completion', 'Cancellation must establish that the device has stopped before software recycles the memory.',
  [['map','Map and prepare buffer','Validate size and direction, establish the device address, and retain the buffer.'],['submit','Publish descriptor','Order descriptor fields before making the request visible to the device.'],['done','Completion observed?','Inspect status through the device protocol.','decision'],['sync','Synchronize completed data','Apply required DMA synchronization and validate the transferred length.'],['stop','Timeout or cancel path','Quiesce or reset according to the device contract; establish that DMA has ended.'],['release','Release or recycle buffer','Drop mapping and ownership only after all device access has ceased.','terminal']],
  [['map','submit'],['submit','done'],['done','sync','Yes'],['done','stop','Timeout'],['sync','release'],['stop','release','Stopped']],
  'A timer expiring transfers no buffer ownership by itself.'
));
systemsHandbook['fat-read-driver'][2].blocks.push(flow(
  'Bound a file read by size and chain validity', 'Each iteration accounts for both logical bytes and the finite cluster graph.',
  [['remaining','Logical bytes remain?','The directory file size supplies the remaining byte count.','decision'],['finish','Return exact file bytes','Stop at the logical end without exposing allocation slack.','terminal'],['valid','Fresh valid cluster?','Check range, marker classification, visited set, and traversal budget.','decision'],['error','Report corruption or I/O error','Preserve accurate partial-progress information under the read API.','terminal'],['read','Read bounded cluster bytes','Transfer the minimum of remaining bytes and cluster size; I/O failures take the error path.'],['next','Advance chain and byte count','Subtract completed logical bytes and decode a next cluster only when more are required.']],
  [['remaining','finish','No'],['remaining','valid','Yes'],['valid','error','No'],['valid','read','Yes'],['read','next','Success'],['read','error','I/O failure'],['next','remaining']],
  'A repeated cluster and an early end marker produce bounded failures.'
));
systemsHandbook['fat-write-driver'][1].blocks.push(flow(
  'Recover using the durable commit decision', 'Recovery validates the log before deciding which complete transactions can be installed.',
  [['scan','Scan transaction records','Check length, identity, generation, and integrity metadata.'],['commit','Valid durable commit?','A commit must refer to a complete validated payload.','decision'],['discard','Ignore incomplete work','Leave the prior committed filesystem state authoritative.','terminal'],['replay','Replay committed images','Install each destination block image idempotently.'],['persist','Persist home locations','Ensure checkpointed metadata has reached the promised durability boundary.'],['reclaim','Reclaim eligible log space','Advance the log generation or tail under the reuse protocol.','terminal']],
  [['scan','commit'],['commit','discard','No'],['commit','replay','Yes'],['replay','persist'],['persist','reclaim']],
  'The commit follows durable payload; log reclamation follows durable home-block installation.'
));
systemsHandbook['libc-and-shell'][1].blocks.push(flow(
  'Launch all pipeline stages before waiting', 'The parent owns partial construction and must clean up every failed launch.',
  [['parse','Parse and allocate pipes','Build a bounded execution plan and acquire both endpoint pairs.'],['launch','Launch next stage','The child installs its intended descriptors and executes its command.'],['success','Launch succeeded?','Process creation either produced a tracked child or returned an error.','decision'],['cleanup','Close and reap partial pipeline','Apply the failure policy, close channels, and collect every created child.','terminal'],['more','More stages remain?','Track how many execution-plan nodes have been launched.','decision'],['close','Close parent endpoints','Release unused pipe references before waiting for normal completion.'],['wait','Collect all child statuses','Wait under the shell’s status and interruption policy.','terminal']],
  [['parse','launch'],['launch','success'],['success','cleanup','No'],['success','more','Yes'],['more','launch','Yes'],['more','close','No'],['close','wait']],
  'A full pipe can block a producer, so the consumer must exist before the parent waits for the producer.'
));
systemsHandbook['capstone'][1].blocks.push(flow(
  'Deduplicate an operation across retries', 'The result record and effect share a durable transaction in this model.',
  [['receive','Receive operation key','Validate caller, incarnation, sequence, and argument identity.'],['known','Committed key exists?','Look up the durable result for the exact operation.','decision'],['saved','Return saved result','Report the prior outcome without reapplying its effect.','terminal'],['apply','Prepare effect and result','Check operation preconditions and prepare both records together.'],['commit','Commit atomically','Persist the effect and duplicate-suppression record in one recoverable transaction.'],['reply','Send result','A lost reply is handled by the same-key retry path.','terminal']],
  [['receive','known'],['known','saved','Yes'],['known','apply','No'],['apply','commit'],['commit','reply']],
  'The server can recover the recognized outcome even when the reply disappears.'
));
