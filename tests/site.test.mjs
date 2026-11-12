import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
test('SELC stands apart from Hub/Portal and includes community-first messaging',()=>{
 assert.match(html,/BUILT BY THE/);assert.match(html,/Community Educators/);
 assert.match(html,/Leadership Committee/);assert.match(html,/h3ll0nwh33ls/);
 assert.doesNotMatch(html,/Established to lead/i);
});
test('custom SELC logo is used and is accessible',()=>{
 assert.match(html,/assets\/selc-emblem\.svg/);
 assert.ok(existsSync(new URL('../assets/selc-emblem.svg',import.meta.url)));
});
test('mobile navigation and independently styled Headquarters exist',()=>{
 assert.match(html,/id="mobileNavTrigger"/);assert.match(html,/id="headquarters"/);
 assert.match(css,/@media\(max-width:650px\)/);assert.match(css,/prefers-reduced-motion/);
});
test('all requested workspace entries are bound to actual routes',()=>{
 for(const id of ['home','join','coordinator','ballots','applications','work','library','leader','proposals','requests','educators','generalapps','events','volunteer','door','banreports','appeals'])assert.ok(js.includes("'"+id+"'"),id);
 for(const endpoint of ['selc-auth','selc-governance','shifts','education-programs','safety-appeal-review','leadership-library','leadership-queue'])assert.ok(js.includes(endpoint),endpoint);
});
test('public SELC pillars use Leadership, Education and Community rather than Consent branding',()=>{
 assert.match(html,/LEADERSHIP<\/span><span>EDUCATION<\/span><span>COMMUNITY/);
 assert.doesNotMatch(html,/CONSENT<\/span><span>EDUCATION<\/span><span>COMMUNITY/);
});

test('SELC governance respects distinct representative, coordinator and staff roles',()=>{
 assert.match(js,/people\.filter\(x=>x\.role==='representative'\)\.length\+' \/ 3'/);
 assert.match(js,/admincenter:coordinatorAdminPage/);
 assert.match(js,/iacases:iaCasesPage/);
 assert.match(js,/staffpath:staffPathPage/);
 assert.doesNotMatch(js,/\[data-claim-shift\],\[data-release-shift\]/);
 assert.match(js,/Staff and Dungeon Monitor volunteer sign-ups happen exclusively in the Staff Portal/);
 assert.match(js,/Submit feedback|Leadership recommendation/);
});

test('SELC website authenticates against Portal, not a local user list',()=>{
 assert.match(js,/sanctumportal\.org/);
 assert.match(js,/Authorization.*Bearer/);
 assert.match(js,/credentials:'omit'/);
});

test('Advisor sits below Representative and can see only designated participation screens',()=>{
 assert.match(html,/id="publicAdvisors"/);
 assert.match(js,/role==='advisor'/);
 assert.match(js,/advisorHomePage/);
 assert.match(js,/advisorVoteCategories/);
 assert.match(js,/advisorLessons/);
 assert.match(js,/type==='advisor'\?'Advisor certification'/);
 assert.match(js,/data-action="offer-advisor"/);
 assert.match(js,/data-action="reopen"/);
 assert.match(js,/pendingRole==='advisor'/);
 assert.match(js,/canVote=!advisor\(\)\|\|advisorVoteCategories\.has\(p\.category\)/);
 assert.doesNotMatch(js,/\['registry'[^\n]+participantRole/);
 assert.doesNotMatch(js,/\['iacases'[^\n]+participantRole/);
 assert.doesNotMatch(js,/\['door'[^\n]+participantRole/);
});

test('five Advisors, three Representatives, two Coordinators comprise ten appointed SELC seats',()=>{
 assert.match(html,/Five Advisor positions, three Representative positions, two Coordinator positions/);
 assert.match(html,/id="publicAdvisors"/);
 assert.match(html,/id="publicTransitionRepresentatives"/);
 assert.match(js,/people\.filter\(x=>x\.role==='advisor'\)\.length\+' \/ 5'/);
 assert.match(js,/people\.filter\(x=>x\.role==='coordinator'\)\.length\+' \/ 2'/);
 assert.match(js,/target==='advisor'\?'apply_advisor':'apply_representative'/);
 assert.match(js,/const ADVISORFIELDS=/);
});
