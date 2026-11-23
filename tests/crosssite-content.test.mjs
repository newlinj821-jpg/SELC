import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('SELC stays governance-focused while exposing the Hub mission',()=>{
 const home=read('index.html'),purpose=read('purpose/index.html');
 assert.match(home,/THE PEOPLE/);
 assert.match(home,/https:\/\/sanctumeroshub\.org\/about\//);
 assert.match(purpose,/https:\/\/sanctumeroshub\.org\/about\//);
 assert.match(purpose,/https:\/\/sanctumportal\.org\/events\.html/);
 assert.match(home,/two Coordinators, four Representatives and two Advisors/i);
});
test('SELC keeps public learning, application and event pathways connected',()=>{
 const education=read('education/index.html'),advisor=read('advisor/index.html');
 assert.match(education,/https:\/\/sanctumeroshub\.org\/education\//);
 assert.match(education,/https:\/\/sanctumportal\.org\/events\.html/);
 assert.match(advisor,/https:\/\/sanctumeroshub\.org\/about\/#leadership/);
 assert.match(advisor,/\?apply=advisor/);
 assert.match(advisor,/https:\/\/sanctumportal\.org\/membership\.html#apply/);
});
test('Retired external organizer network is closed and the README describes only current SELC roles',()=>{
 const retired=read('community-leaders/index.html'),docs=read('README.md');
 assert.match(retired,/NETWORK\s*(?:<em>)?RETIRED/,'Retired-network notice remains visible with semantic emphasis');
 assert.doesNotMatch(retired,/<form\b/);
 assert.match(docs,/two Coordinator seats, four Representative seats and two Advisor seats/i);
 assert.match(docs,/Community Leaders network is retired/);
 assert.doesNotMatch(docs,/five Advisor seats|three Representative seats|ten leadership positions total|SE membership is optional/i);
});
