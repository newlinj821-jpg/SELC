import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const SELC='https://se-selc.netlify.app/',PORTAL='https://sanctumportal.org';
const users=[
 ['member','SE_AUTH_MEMBER_USERNAME','SE_AUTH_MEMBER_PASSWORD','Community Member'],
 ['representative','SE_AUTH_REP_USERNAME','SE_AUTH_REP_PASSWORD','SELC Representative'],
 ['coordinator','SE_AUTH_COORD_USERNAME','SE_AUTH_COORD_PASSWORD','SELC Coordinator'],
 ['community-leader','SE_AUTH_LEADER_USERNAME','SE_AUTH_LEADER_PASSWORD','Approved Community Leader'],
 ['owner','SE_AUTH_OWNER_USERNAME','SE_AUTH_OWNER_PASSWORD','Founder & Chair'],
];
const missing=users.flatMap(([role,u,p])=>[u,p].filter(key=>!process.env[key]).map(key=>role+': '+key));
if(missing.length)throw Error('Live authentication gate requires configured private test credentials: '+missing.join(', '));
const browser=await chromium.launch({headless:true});
const safeError=e=>String(e?.message||e).replace(/(password|token|code)=\S+/gi,'$1=[REDACTED]');
const result=[];
try{
 for(const [role,loginKey,passwordKey,expected] of users){
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(safeError(e)));
  const username=process.env[loginKey],password=process.env[passwordKey];
  try{
   const response=await page.goto(SELC,{waitUntil:'domcontentloaded',timeout:25000});
   assert.equal(response?.status(),200,'SELC public site must be available without login');
   if(!(await page.locator('[data-signin]:visible').count()))await page.locator('#mobileNavTrigger').click();
   await page.locator('[data-signin]:visible').first().click();
   await page.getByRole('link',{name:/CONTINUE WITH SANCTUM EROS PORTAL/i}).click();
   await page.waitForURL(url=>url.origin===PORTAL,{timeout:20000});
   await page.getByRole('link',{name:role==='owner'?/Sign in with Owner Administration/i:/Sign in with Member Portal/i}).click();
   if(role==='owner'){
    await page.locator('#ou').waitFor({timeout:15000});
    await page.locator('#ou').fill(username);
    await page.locator('#op').fill(password);
    await page.locator('#ogo').click();
   }else{
    await page.locator('#si-login').waitFor({timeout:15000});
    await page.locator('#si-login').fill(username);
    await page.locator('#si-pass').fill(password);
    await page.locator('#si-go').click();
   }
   await page.waitForURL(url=>url.origin===new URL(SELC).origin,{timeout:30000});
   await page.locator('#hqRole').waitFor({timeout:25000});
   const actual=(await page.locator('#hqRole').textContent()||'').trim();
   assert.equal(actual,expected,role+' role mismatch after Portal-to-SELC SSO');
   assert.ok(!page.url().includes('se_handoff')&&!page.url().includes('se_owner_handoff'),'Single-use code must not remain in browser URL');
   assert.equal(errors.length,0,'Browser errors: '+errors.join('; '));
   await page.locator('#hqSignout').click();
   await page.locator('#publicSite:not(.hidden)').waitFor({timeout:12000});
   result.push({role,passed:true});
  }catch(error){
   result.push({role,passed:false,error:safeError(error)});
  }finally{await context.close()}
 }
}finally{await browser.close()}
for(const item of result)console.log(JSON.stringify(item));
if(result.some(x=>!x.passed))throw Error('Live production SELC authentication release gate failed for '+result.filter(x=>!x.passed).map(x=>x.role).join(', '));
console.log('Live Portal/SELC production SSO passed across all required account roles.');
