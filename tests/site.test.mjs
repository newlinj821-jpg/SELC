import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const html=read('index.html'),js=read('app.js'),css=read('style.css');
test('SELC describes internal event and membership operations',()=>{
 assert.match(html,/THE TEAM BEHIND SANCTUM EROS/);
 assert.match(html,/Dungeon Nights, socials and workshops/);
 assert.match(html,/h3ll0nwh33ls/);
 assert.doesNotMatch(html,/<a[^>]+href="\/community-leaders\/"/);
 assert.match(html,/href="\/advisor\/"/);
});
test('accessible logo, navigation, sign-in and management UI remain',()=>{
 assert.match(html,/assets\/selc-emblem\.svg/);
 assert.ok(existsSync(new URL('../assets/selc-emblem.svg',import.meta.url)));
 for(const id of ['mobileNavTrigger','publicNav','loginDialog','loginForm','headquarters','hqNavigation','hqContent'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(css,/@media\(max-width:650px\)/);
});
test('event management and safety routes remain implemented',()=>{
 for(const id of ['home','founderdesk','admincenter','applications','work','leader','proposals','generalapps','events','volunteer','readiness','iacases','banreports','appeals','myaccount'])assert.ok(js.includes("'"+id+"'"),id);
 for(const endpoint of ['selc-auth','selc-governance','shifts','safety-appeal-review','leadership-queue'])assert.ok(js.includes(endpoint),endpoint);
});
test('retired external programs have no public enrollment forms',()=>{
 const advisor=read('advisor/index.html'),network=read('community-leaders/index.html');
 assert.match(advisor,/INTERNAL ADVISOR APPLICATIONS/);
 assert.match(network,/NETWORK/);
 assert.doesNotMatch(advisor,/<form\b/);
 assert.doesNotMatch(network,/<form\b/);
});
test('governance and staff permissions remain separated',()=>{
 assert.match(js,/admincenter:coordinatorAdminPage/);
 assert.match(js,/iacases:iaCasesPage/);
 assert.match(js,/staffpath:staffPathPage/);
 assert.match(js,/const reviewer=\(\)=>/);
 assert.match(js,/credentials:'omit'/);
 assert.match(js,/const advisor=\(\)=>role\(\)==='advisor'/);
 assert.match(html,/Two Advisors review appropriately shared member feedback/);
});
