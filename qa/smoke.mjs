import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const read=p=>readFileSync(resolve(p),'utf8');
const home=read('index.html'),app=read('app.js'),css=read('style.css');
const purpose=read('purpose/index.html'),education=read('education/index.html');
const leaders=read('community-leaders/index.html'),gateway=read('netlify/functions/portal-gateway.mjs');
for(const p of ['purpose','education','community-leaders'])assert.ok(existsSync(p+'/index.html'),p+' route missing');
assert.match(home,/<a href="\/community-leaders\/">Community Leaders<\/a>/);
assert.match(home,/SANCTUM EROS LEADERSHIP COMMITTEE/);
assert.equal((home.match(/SANCTUM EROS LEADERSHIP COMMITTEE/g)||[]).length,1,'Full name should appear just once in the public landing header');
assert.doesNotMatch(home,/<p class="hero-deck">/,'Do not repeat committee title above hero introduction');
assert.match(home,/SHAPING WHAT COMES NEXT/);
assert.doesNotMatch(home,/SE-SELC/i);
for(const doc of [home,purpose,education,leaders]){
 assert.match(doc,/https:\/\/sanctumportal\.org/, 'Use canonical Portal domain');
 assert.match(doc,/https:\/\/sanctumeroshub\.org\/community\//, 'Use canonical Hub community destination');
}

assert.match(home,/<section class="section community-network"/);
assert.match(home,/<a[^>]+href="\/community-leaders\/"[^>]*>COMMUNITY LEADERS &amp; APPLICATION|href="\/community-leaders\/">COMMUNITY LEADERS & APPLICATION/);
assert.match(home,/href="\/purpose\/">GET TO KNOW US/);
assert.match(home,/href="https:\/\/sanctumportal\.org\/selc-connect\.html"/);
assert.match(home,/login-handoff/);
assert.match(home,/selc-unified-11/);
assert.match(css,/\.login-handoff>\.button/);
assert.match(css,/max-height:calc\(100dvh - 20px\)/);
assert.match(app,/\$\$\('\[data-leader-review\]'\)\.forEach/);
assert.match(app,/if\(!response\.ok\)/);
assert.match(app,/error\?\.requestId/);
assert.match(leaders,/id="leaderApplication"/);
const organizerJS=read('community-leaders/account.js');
const organizerCSS=read('editorial.css');
assert.match(leaders,/data-leader-tab="signin"/);
assert.match(leaders,/data-leader-tab="register"/);
assert.match(leaders,/Yes — I already have an SE account/);
assert.match(leaders,/No — create a Community Leaders account/);
assert.match(leaders,/id="leaderVerify"/);
assert.match(leaders,/id="leaderReset"/);
assert.match(organizerJS,/call\('community-leaders'/);
assert.match(organizerJS,/portal='https:\/\/sanctumportal\.org\/\.netlify\/functions\/'/);
assert.match(organizerJS,/service==='member-auth'/);
assert.doesNotMatch(organizerJS,/base\+encodeURIComponent\(service\)/);
assert.match(organizerJS,/email_reset_request/);
assert.match(organizerJS,/email_reset_complete/);
assert.match(organizerJS,/Verify email in the Portal/);
assert.match(organizerCSS,/leader-account-choice/);
assert.match(app,/committeeRole\(u\)/);
assert.doesNotMatch(app,/u!=='member'/);
assert.match(app,/id="communityMessage"/);
assert.match(app,/id="communitySafety"/);
assert.match(app,/sourceDisposition/);
assert.match(app,/acknowledgeSensitive/);
assert.match(app,/revoke_leader/);
assert.match(app,/revoke_safety_share/);
assert.match(app,/\$\$\('\[data-leader-revoke\]'\)\.forEach/);
assert.match(app,/\$\$\('\[data-share-revoke\]'\)\.forEach/);
assert.match(gateway,/const PRIMARY='https:\/\/sanctumportal\.org'/);
assert.doesNotMatch(gateway,/thesanctumerosportal\.netlify\.app/);
assert.match(gateway,/email_reset_request/);

assert.match(purpose,/href="\/community-leaders\/"/);
assert.match(education,/href="\/community-leaders\/"/);
assert.match(gateway,/const ALLOWED=new Set/);
assert.match(gateway,/'selc-auth'/);
assert.match(gateway,/'community-leaders'/);
assert.match(gateway,/status!==404&&status!==502&&status!==503&&status!==504/);
assert.doesNotMatch(app,/(^|[^$])\$\('[^']+'\)\.forEach/, 'A single-element selector cannot be iterated with forEach');
for(const selector of ['[data-educator-review]','[data-handover]','[data-claim-shift],[data-release-shift]','[data-leader-review]','[data-share-approve],[data-share-decline]']){
 assert.ok(app.includes("$$('"+selector+"').forEach"),'Multi-button handler must use the collection selector: '+selector);
}

assert.match(home,/SELC certification before your committee appointment/);
assert.match(home,/Community Leaders is an independently approved network/);
assert.match(purpose,/followed by SELC certification/);
assert.match(app,/async function certificationPage\(\)/);
assert.match(app,/action.*complete_certification|complete_certification/);
assert.match(app,/\['certification','✓','SELC certification'/);
console.log('SELC public route, branding, login UI, Community Leaders and gateway source checks passed.');

assert.match(app,/const response=await fetch\(url,options\)/);
assert.doesNotMatch(app,/fetch\(local,\{\.\.\.options/,'No credential retry through a second gateway');
assert.match(app,/portal_connection/);
assert.match(app,/requestId/);
assert.doesNotMatch(home,/CONTINUE WITH MEMBER PORTAL|CONTINUE WITH OWNER PORTAL/);
