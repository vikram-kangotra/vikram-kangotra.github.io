import { readCourseModule } from './course-loader.mjs';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const {guidedAssemblyBySlug:guide}=await readCourseModule('src/course/guidedAssembly.js');
const {assemblyCaseInitialization}=await readCourseModule('src/course/machineTestHarness.js');
const {bootProgram}=await readCourseModule('src/course/assemblyPrograms.js');
const chapters=[];
for(const name of ['assemblyBasics','assemblyMemory','assemblyControl'])chapters.push(...(await readCourseModule('src/course/'+name+'.js'))[name]);
assert.equal(Object.keys(guide).length,12);
const dir=await mkdtemp(join(tmpdir(), 'guided-assembly-'));
let count=0;
const runtime=[];
for(const c of chapters){
 const g=guide[c.slug]; assert(g);assert.equal(g.steps.length,3);assert(g.initialFiles['lesson.asm']);
 let previous=-1;
 for(const [index,step] of g.steps.entries()){
  const position=c.sections.findIndex(s=>s.id===step.sectionId);assert(position>previous);previous=position;
  assert(step.hints.length>=3);assert.equal(typeof step.prediction.answer,'number');
  assert(!step.reference.body.includes('bits 16'));
  const program=bootProgram(step.reference.body,step.reference.data||'',assemblyCaseInitialization(step.tests?.cases?.[0]?.input));
  const file=dir+'/'+c.id+'-'+index+'.asm';await writeFile(file,program);
  execFileSync(process.env.NASM || 'nasm',['-Wall','-Werror','-w-reloc-abs-word','-f','bin',file,'-o',file+'.bin']);
  const bytes=readFileSync(file+'.bin');assert.equal(bytes.length,512);assert.equal(bytes.readUInt16LE(510),0xaa55);
  runtime.push({slug:c.slug,checkpoint:index+1,source:program,expectedOutput:step.expectedOutput});count++;
 }
 assert.equal(g.steps[2].sectionId,c.sections.at(-1).id);
 assert.equal(g.steps[2].expectedOutput.replace(/\s+/g,' ').trim(),c.assembly.expectedOutput.replace(/\s+/g,' ').trim());
 assert.equal(g.steps[2].prediction.answer,c.assembly.question.answer);
}
if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(runtime));
console.log('PASS',count,'512-byte NASM programs; 12 ordered chapter checkpoint contracts; final targets/predictions match.');
console.log('Artifacts:',dir);
