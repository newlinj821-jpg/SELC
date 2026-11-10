import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
const root=new URL('../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
test('standalone site publishes only its public directory',()=>{
 const config=read('netlify.toml');
 assert.match(config,/publish\s*=\s*"public"/);
 assert.match(config,/X-Content-Type-Options/);
 const visible=readdirSync(new URL('public/',root));
 assert.ok(visible.includes('index.html'));assert.ok(visible.includes('app.js'));
 assert.ok(!visible.includes('drafts'));assert.ok(!visible.includes('course-seeds'));
});
test('seeducational site is reachable from Portal and keeps private curriculum in authenticated API',()=>{
 const html=read('public/index.html'),app=read('public/app.js');
 assert.match(html,/<title>SE Education/);
 assert.match(html,/id="liveEducationCatalog"/);
 assert.match(html,/id="learnerWorkspace"/);
 assert.match(app,/se-education-courses/);
 assert.match(app,/action:'progress'/);
 assert.match(app,/action:'completion'/);
 assert.match(app,/returnUrl=/);
 assert.doesNotMatch(html,/teacherPlan|speakerNotes|answer:/);
 const check=spawnSync(process.execPath,['--check',new URL('public/app.js',root).pathname],{encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
});
test('all prepared classes have private lesson data, module lists and quizzes',()=>{
 const rows=readdirSync(new URL('course-seeds/',root)).filter(x=>x.endsWith('.json'));
 assert.equal(rows.length,10);
 for(const filename of rows){
  const course=JSON.parse(read('course-seeds/'+filename));
  assert.ok(course.modules.length>=5,filename);
  assert.ok(course.quiz.length>=6,filename);
  assert.ok(course.teacherPlan.length>1500,filename);
  assert.equal(course.published,false,filename);
 }
});
