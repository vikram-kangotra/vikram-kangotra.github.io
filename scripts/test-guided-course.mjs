import { readCourseModule } from './course-loader.mjs';
import { writeFile, mkdtemp, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const {guidedAssemblyBySlug:guide}=await readCourseModule('src/course/guidedAssembly.js');
const {prepareGuidedBuild}=await readCourseModule('src/course/guidedBuild.js');
const {chapters:course}=await readCourseModule('src/course/index.js');
const chapters=course.filter(chapter=>guide[chapter.slug]);
assert.deepEqual(chapters.map(chapter=>chapter.slug).sort(),Object.keys(guide).sort(),'Every registered guide belongs to a published chapter');
assert.equal(guide['assembly-output'].steps.length,4);
const dir=await mkdtemp(join(tmpdir(), 'guided-assembly-'));
let count=0;
const runtime=[];
for(const c of chapters){
 const g=guide[c.slug]; assert(g);assert(g.steps.length>0);assert(g.initialFiles['lesson.asm']);
 let previous=-1;
 for(const [index,step] of g.steps.entries()){
  const position=c.sections.findIndex(s=>s.id===step.sectionId);assert(position>previous);previous=position;
  assert(step.hints.length>=3);assert.equal(typeof step.prediction.answer,'number');
  assert(!step.reference.body.includes('bits 16'));
  const files=prepareGuidedBuild({...step.reference.files,'lesson.asm':step.reference.body,...(step.reference.data?{'data.inc':step.reference.data}:{})},'assembly',step.tests?.cases?.[0]?.input,undefined,step.tests);
  const manifest=JSON.parse(files['build.json']);assert.equal(manifest.type,'assembly-routine');
  const folder=join(dir,c.id+'-'+index);await mkdir(folder);
  for(const [path,source] of Object.entries(files))await writeFile(join(folder,path),source);
  for(const [entry,target] of [[manifest.loader,'boot.bin'],[manifest.entry,'lesson.bin']])execFileSync(process.env.NASM || 'nasm',['-Wall','-Werror','-w-reloc-abs-word','-w-reloc-abs-dword','-f','bin',entry,'-o',target],{cwd:folder});
  const loader=readFileSync(join(folder,'boot.bin'));assert.equal(loader.length,512);assert.equal(loader.readUInt16LE(510),0xaa55);
  const bytes=readFileSync(join(folder,'lesson.bin'));assert(bytes.length>0&&bytes.length<=16384);
  runtime.push({slug:c.slug,checkpoint:index+1,files,expectedOutput:step.expectedOutput});count++;
 }
 const last=g.steps.at(-1);
 if(c.assembly){
  assert.equal(last.sectionId,c.legacySectionIds?.at(-1)||c.sections.at(-1).id);
  assert.equal(last.expectedOutput.replace(/\s+/g,' ').trim(),c.assembly.expectedOutput.replace(/\s+/g,' ').trim());
  assert.equal(last.prediction.answer,c.assembly.question.answer);
 }
}
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(runtime));
console.log('PASS',count,'NASM routine payloads with separate 512-byte loaders;',chapters.length,'ordered chapter checkpoint contracts; final targets/predictions match.');
console.log('Artifacts:',dir);
