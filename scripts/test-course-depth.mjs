import assert from 'node:assert/strict';
import { readCourseModule } from './course-loader.mjs';

const { chapters } = await readCourseModule('src/course/index.js');
const maps = await Promise.all(['assembly', 'foundations', 'systems'].map(async name => (await readCourseModule(`src/course/${name}Depth.js`))[`${name}Depth`]));
const depthMap = Object.assign({}, ...maps);
const { assemblyOutput } = await readCourseModule('src/course/assemblyOutput.js');
const inlineChapters = new Map(assemblyOutput.map(chapter => [chapter.slug, chapter]));
function words(value) {
  if (typeof value === 'string') return value.trim().split(/\s+/).filter(Boolean).length;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + words(item), 0);
  if (value && typeof value === 'object') return Object.entries(value).reduce((sum, [key, item]) => sum + (['id', 'kind', 'from', 'to'].includes(key) ? 0 : words(item)), 0);
  return 0;
}
let examples = 0;
let inlineExamples = 0;
let charts = 0;
let addedWords = 0;

assert.deepEqual(new Set([...Object.keys(depthMap), ...inlineChapters.keys()]), new Set(chapters.map(chapter => chapter.slug)), 'every chapter has registered teaching material, either a depth map or inline sections');
for (const chapter of chapters) {
  const mapped = depthMap[chapter.slug];
  const rawInline = inlineChapters.get(chapter.slug);
  assert.deepEqual((mapped ? Object.keys(mapped) : rawInline.sections.map(section => section.id)).sort(), chapter.sections.filter(section => !section.parentSectionId).map(section => section.id).sort(), `${chapter.slug}: no missing or orphaned original lesson content`);
  let chapterCharts = 0;
  assert.equal(chapter.minutes, chapter.studyPlan.readingMinutes + chapter.studyPlan.practiceMinutes);
  assert(chapter.studyPlan.practiceMinutes >= 20, 'study estimate reserves time for practice');
  for (const section of chapter.sections) {
    if (section.parentSectionId) {
      assert(section.topics?.length === 1 && section.topics[0].blocks.length >= 3, `${chapter.slug}/${section.id}: standalone mechanism has substantive content`);
      continue;
    }
    const label = `${chapter.slug}/${section.id}`;
    const dive = section.deepDive;
    assert(Number.isInteger(section.studyMinutes) && section.studyMinutes > 0);
    if (!mapped) {
      assert(section.paragraphs.length >= 3 && section.paragraphs.every(text => typeof text === 'string' && text.trim()), `${label}: inline lesson explains its mechanism`);
      const teaching = section.teaching;
      for (const field of ['goal', 'bridge', 'takeaway']) assert(typeof teaching?.[field] === 'string' && teaching[field].trim(), `${label}: ${field} exists`);
      assert(teaching.check?.prompt && teaching.check.answer, `${label}: core teaching includes a check and its explanation`);
      assert(words([section.paragraphs, teaching]) >= 200, `${label}: inline core teaching is substantive`);
      assert.equal(!!dive, !!rawInline.sections.find(item => item.id === section.id).deepDive, `${label}: published chapter preserves its inline worked example`);
      if (!dive) continue;
    }
    assert(dive?.title && dive.paragraphs.length >= 1, `${label}: explanation exists`);
    assert(dive.paragraphs.every(text => typeof text === 'string' && text.trim()), label);
    assert(dive.example?.title && dive.example.intro && dive.example.conclusion, `${label}: example has setup and interpretation`);
    assert(dive.example.steps.length >= 2 && dive.example.steps.every(step => step.title && step.explanation), `${label}: example traces its intermediate steps`);
    assert(dive.pitfalls.length && dive.pitfalls.every(pitfall => pitfall.title && pitfall.text), `${label}: failure cases are explained`);
    assert(dive.transfer && words(dive.transfer) >= 15, `${label}: transfer case is explained`);
    assert(words(dive) >= 200, `${label}: added lesson is substantive`);
    assert(!JSON.stringify(dive).includes('\u2014'), `${label}: no em dashes`);
    if (mapped) examples++; else inlineExamples++;
    addedWords += words(dive);
    if (!dive.flowchart) continue;
    chapterCharts++;
    charts++;
    const chart = dive.flowchart;
    const ids = new Set(chart.nodes.map(node => node.id));
    assert(chart.title && chart.intro && chart.caption, `${label}: diagram has context`);
    assert.equal(ids.size, chart.nodes.length, `${label}: unique diagram nodes`);
    assert(chart.nodes.length >= 4 && chart.nodes.length <= 7, `${label}: readable diagram size`);
    for (const node of chart.nodes) {
      assert(node.label && node.label.length <= 36 && node.detail, `${label}: concise node label and full explanation`);
      assert(!node.kind || ['process', 'decision', 'terminal'].includes(node.kind));
      if (node.kind === 'decision') {
        const branches = chart.edges.filter(edge => edge.from === node.id);
        assert(branches.length >= 2 && branches.every(edge => edge.label), `${label}: decisions name their alternatives`);
      }
    }
    for (const edge of chart.edges) {
      assert(ids.has(edge.from) && ids.has(edge.to), `${label}: edge endpoints exist`);
      assert.notEqual(edge.from, edge.to, `${label}: use a separate step for a loop condition`);
    }
    const reached = new Set([chart.nodes[0].id]);
    for (let i = 0; i < chart.nodes.length; i++) for (const edge of chart.edges) if (reached.has(edge.from)) reached.add(edge.to);
    assert.equal(reached.size, ids.size, `${label}: all nodes reachable from the start`);
  }
  assert(chapterCharts > 0, `${chapter.slug}: contains a flowchart`);
}
assert.equal(examples, 234, 'all existing lessons are expanded');
assert.equal(inlineExamples, assemblyOutput.flatMap(chapter => chapter.sections).filter(section => section.deepDive).length, 'all registered inline worked examples are validated');
console.log(`PASS: ${examples} mapped and ${inlineExamples} inline expanded lessons, ${charts} connected flowcharts, complete examples and accessible diagram data; approximately ${addedWords.toLocaleString()} added words including labels`);
