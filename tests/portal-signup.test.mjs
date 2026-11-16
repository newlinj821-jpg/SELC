import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('SELC mobile sign-in links account creation to canonical Portal membership application',()=>{
 const html=read('index.html'),app=read('app.js');
 assert.equal((html.match(/id="selcRegistrationLink"/g)||[]).length,1);
 assert.match(html,/<a href="https:\/\/sanctumportal\.org\/membership\.html#apply" id="selcRegistrationLink">/);
 assert.match(html,/id="loginForm"/);
 assert.match(app,/const PORTAL='https:\/\/sanctumportal\.org'/);
 assert.match(app,/api\('selc-auth',\{method:'POST'/);
 assert.match(app,/credentials:'omit'/);
});

test('Advisor applicant can reach free membership before requesting an SELC appointment',()=>{
 const advisor=read('advisor/index.html');
 assert.match(advisor,/https:\/\/sanctumportal\.org\/membership\.html#apply/);
 assert.match(advisor,/\/\?apply=advisor/);
 assert.match(read('qa/browser-certification.mjs'),/registerLink\.getAttribute\('href'\)/);
});