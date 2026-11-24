import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('app.js'),css=read('style.css'),editorial=read('editorial.css'),home=read('index.html');
test('SELC public and Headquarters script parses and keeps original active role constraints',()=>{
 assert.doesNotThrow(()=>new Function(app));
 assert.match(app,/setupHQNav/);
 assert.match(app,/item\[4\]\(role\(\)\)/);
 assert.match(app,/isParticipant\(user\)|participantRole\(u\)/);
});
test('SELC proposal voting and publication controls use valid querySelectorAll collections',()=>{
 assert.match(app,/\$\$\('\[data-open-canonical\]'\)\.forEach/);
 assert.match(app,/\$\$\('\[data-pvote\]',d\)\.forEach/);
 assert.match(app,/record_publication/);
 assert.match(app,/watchForm\(d\.querySelector\('#recordPublication'\)/);
 assert.equal([...app.matchAll(/(?<!\$)\$\(['"][^'"]+['"](?:,[^)]*)?\)\.forEach/g)].length,0);
});
test('action queue remains claimable, delegatable and searchable without changing permissions',()=>{
 assert.match(app,/workAssignmentFilter/);
 assert.match(app,/workTextFilter/);
 assert.match(app,/data-queue-delegate/);
 assert.match(app,/data-queue-action/);
 assert.match(app,/data-work-owned/);
 assert.match(css,/hq-work-controls/);
});
test('directory exposes actual seats and opted-in names without fictional positions',()=>{
 assert.match(home,/id="publicTeamStatus"/);
 assert.match(app,/Position available/);
 assert.match(app,/appointed\+' of 8 committee seats filled/);
 assert.match(app,/loadPublicLeadership/);
});
test('public navigation, motion and original charcoal-red identity remain accessible',()=>{
 assert.match(home,/id="hqNavSearch"/);
 assert.match(app,/document\.querySelectorAll\('#publicNav a'\)/);
 assert.match(css,/--bg:#101114/);
 assert.match(css,/--red:#e6384b/);
 assert.match(css,/selc-motion-arrived/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(editorial,/selc-editorial-rise/);
 assert.match(editorial,/prefers-reduced-motion:reduce/);
});
test('education, leadership and governance routes retain canonical links and fresh styles',()=>{
 for(const path of ['purpose/index.html','education/index.html','advisor/index.html']){
   const page=read(path);
   assert.match(page,/editorial\.css\?v=20261123-refined/);
 }
 assert.match(read('education/index.html'),/FROM PROPOSAL/);
 assert.match(read('purpose/index.html'),/AUTHORITY IS/);
 assert.match(home,/style\.css\?v=20261123-refined/);
 assert.match(home,/app\.js\?v=20261123-motion-2/);
});

test('work queue filters the entire collection and published changes expose audit evidence',()=>{
 assert.ok(app.includes("const rows=$$('[data-work-row]')"));
 assert.match(app,/rows\.forEach\(row=>/);
 assert.match(app,/p\.publicationHistory/);
 assert.match(app,/history\.slice\(\)\.reverse\(\)/);
 assert.match(app,/notes\.textContent=record\.notes/);
 assert.match(css,/\.hq-publication-history/);
});
