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
test('SELC website authenticates against Portal, not a local user list',()=>{
 assert.match(js,/sanctumportal\.org/);
 assert.match(js,/Authorization.*Bearer/);
 assert.match(js,/credentials:'omit'/);
});
