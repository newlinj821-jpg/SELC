import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';

const root=resolve(new URL('..',import.meta.url).pathname);
const read=p=>readFileSync(resolve(root,p),'utf8');
const app=read('app.js'),advisor=read('advisor/advisor.js');

test('every local public HTML asset and navigation destination exists',()=>{
 const pages=['index.html','advisor/index.html','purpose/index.html','education/index.html','community-leaders/index.html','teacher-materials.html','se-education/index.html','se-education/public/index.html'];
 for(const page of pages){
  const html=read(page);
  for(const [,url] of html.matchAll(/(?:href|src)=["']([^"'?#]+)(?:[?#][^"']*)?["']/g)){
   if(!url||url==='/'||/^(?:https?:|\/\/|mailto:|tel:|data:|javascript:|#)/.test(url))continue;
   const target=url.startsWith('/')?resolve(root,'.'+url):resolve(root,dirname(page),url);
   assert.ok(existsSync(target)||existsSync(resolve(target,'index.html'))||existsSync(target+'.html'),page+': missing local target '+url);
  }
 }
});

test('SELC application decisions and clarification responses stay wired',()=>{
 assert.match(app,/\$\$\('\[data-member-decision\]',dlg\)\.forEach/);
 assert.doesNotMatch(app,/(?<!\$)\$\(['"][^'"]+['"](?:,[^)]*)?\)\.forEach/);
 assert.match(app,/renderApplicantFollowups\(\$\('#hqContent'\),context\.data\.home\?\.myApplications\|\|\[\],'selc'\)/);
 assert.match(app,/context\.activePage!==openedPage/);
 assert.match(app,/post\('application-followups','respond'/);
 assert.match(app,/function applicationDetails\(record\)/);
 assert.match(app,/Complete application responses/);
});

test('the new independent Advisor journey has account, email, application, and certification controls',()=>{
 const html=read('advisor/index.html');
 for(const id of ['registerForm','verifyForm','signInForm','applyForm','priorApps'])assert.ok(html.includes('id="'+id+'"'),id+' missing');
 assert.match(advisor,/selc-advisor-registration/);
 assert.match(advisor,/apply_advisor/);
 assert.match(advisor,/sessionStorage\.setItem\(TOKEN_KEY,token\)/);
 assert.match(advisor,/Your session has been preserved/);
 assert.match(app,/SELC_ADVISOR|SELC Advisor/);
 assert.match(read('index.html'),/href="\/advisor\/"/);
});

test('SELC role-based navigation keeps private operations away from Advisors',()=>{
 const nav=app.slice(app.indexOf('const NAV=['),app.indexOf('function setupHQNav()'));
 for(const route of ['registry','generalapps','events','iacases','banreports'])assert.match(nav,new RegExp("\\['"+route+"'.*committeeRole\\(u\\)"),route+' needs an authorization predicate');
 for(const route of ['communityinbox','proposals','chat','myaccount'])assert.ok(nav.includes("'"+route+"'"),route+' missing');
 assert.match(app,/const reviewer=\(\)=>/);
 assert.match(app,/\['founder','coordinator'\]/);
});
