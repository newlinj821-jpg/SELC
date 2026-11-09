import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {join,resolve,extname,sep} from 'node:path';
import {chromium,webkit} from 'playwright';
const root=resolve('.');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const server=createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://localhost'),relative=decodeURIComponent(u.pathname);
  let target=resolve(root,'.'+relative);
  if(target!==root&&!target.startsWith(root+sep)){res.writeHead(403).end();return}
  const s=await stat(target).catch(()=>null);
  if(s?.isDirectory())target=join(target,'index.html');
  const bytes=await readFile(target);
  res.writeHead(200,{'content-type':types[extname(target)]||'application/octet-stream'}).end(bytes);
 }catch{res.writeHead(404).end('Not found')}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await (process.env.QA_BROWSER==='webkit'?webkit:chromium).launch({headless:true});
let role='member',certified=false,assessments=0;
const answers={'r-role':'b','r-consent':'a','r-privacy':'c','r-evidence':'b','r-conflict':'a','r-network':'c','r-admission':'b','r-safety':'a'};
const questions=[
 ['r-role','Who makes final SELC appointments?','b'],
 ['r-consent','What happens when consent is withdrawn?','a'],
 ['r-privacy','How should private records be handled?','c'],
 ['r-evidence','How should an allegation be handled?','b'],
 ['r-conflict','What do you do with a personal conflict?','a'],
 ['r-network','Do Community Leaders receive committee votes?','c'],
 ['r-admission','What is required for SELC membership?','b'],
 ['r-safety','How do you respond to retaliation?','a']
].map(([id,prompt,correct])=>({id,prompt,options:['a','b','c'].map(value=>({value,label:'Answer '+value}))}));
async function mockPortal(route){
 const req=route.request(),url=new URL(req.url()),service=url.pathname.split('/').pop(),method=req.method();
 const body=method==='POST'?req.postDataJSON():{};
 let data={},status=200;
 if(service==='selc-public')data={people:[]};
 else if(service==='selc-auth'){
  if(method==='POST'&&body.action==='exchange_owner_handoff'){assert.match(body.code,/^[a-z]{43}$/);role='founder';data={token:'y'.repeat(44),role,displayName:'Eros'}}
  else if(method==='POST'&&body.action==='login')data={token:'x'.repeat(44),role,displayName:'Test Account'};
  else if(method==='POST'&&body.action==='logout')data={ok:true};
  else data={authenticated:true,role,displayName:'Test Account'};
 }else if(service==='selc-governance'){
  if(method==='GET'&&url.searchParams.get('scope')==='home')data={me:{role},leadership:[],occupiedSeats:certified?1:0,coordinators:0,myApplications:[{id:'accepted-case',type:'representative',status:certified?'Approved':'Certification Pending',createdAt:'2026-11-08T12:00:00Z'}]};
  else if(method==='GET'&&url.searchParams.get('scope')==='certification')data={passPercent:100,version:'2026.11',assignments:certified?[]:[{id:'accepted-case',type:'representative',questions}],completed:certified?[{id:'certificate-1',type:'representative',completedAt:'2026-11-08T12:30:00Z',version:'2026.11'}]:[]};
  else if(method==='GET'&&url.searchParams.get('scope')==='proposals')data={proposals:[]};
  else if(method==='POST'&&body.action==='complete_certification'){
   assessments++;
   assert.equal(body.id,'accepted-case');assert.equal(body.acknowledge,true);
   const passed=Object.entries(answers).every(([id,correct])=>body.answers?.[id]===correct);
   if(passed){certified=true;role='representative'}
   data={passed,percent:passed?100:88,missed:passed?[]:['r-role'],member:passed?{role:'representative'}:undefined};
  }else data={applications:[],members:[],ballots:[],proposals:[]};
 }else if(service==='community-leaders')data={role,canDiscuss:role==='community-leader',approvedLeader:role==='community-leader',directory:[],messages:[],sharedSafety:[]};
 else if(service==='community-chat'){
  if(method==='GET'&&url.searchParams.get('room'))data={room:url.searchParams.get('room'),messages:[]};
  else if(method==='POST')data={ok:true,joined:body.action==='join',message:{id:'message',message:body.message||'',name:'Synthetic Test'}};
  else data={rooms:role==='founder'?
    ['selc','leaders','educators','network','staff-educators'].map(id=>({id,name:id,description:id+' shared room',joined:true})):
    role==='community-leader'?[{id:'leaders',name:'Community Leaders',description:'Approved organizers',joined:true},{id:'network',name:'Community Collaboration',description:'Shared network',joined:true}]:
    role==='representative'?[{id:'selc',name:'SELC',description:'Committee room',joined:true},{id:'leaders',name:'Community Leaders',description:'Leaders',joined:false}]:[]};
 }
 else if(service==='selc-content')data={proposals:[],canPublish:role==='founder'};
 else if(service==='event-readiness')data={events:[{id:'event1',title:'Test Event',start:'2026-11-20T17:00:00Z',ready:false,outstanding:1,checks:[{id:'staff',label:'Volunteer coverage',complete:false,detail:'1 of 2 filled'}]}],ready:0,needsAttention:1};
 else if(service==='ban-history')data={records:[{id:'historic',name:'Synthetic Previous Ban',status:'Lifted',kind:'temporary',bannedAt:'2026-10-01',liftedAt:'2026-10-15',reason:'Synthetic test only'}]};
 else if(service==='shifts')data={events:[],me:{linked:true,certified:true,dm:false}};
 else if(service==='applications')data={applications:[]};
 else if(service==='members')data={members:[]};
 else if(service==='community-requests')data={openCount:0};
 else if(service==='staff-portal')data={events:[]};
 else if(service==='ban-reports')data={pendingCount:0};
 else data={};
 await route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'},body:JSON.stringify(data)});
}
try{
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 await context.route('https://sanctumportal.org/.netlify/functions/**',mockPortal);
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 await page.locator('[data-signin]').first().click();
 await page.locator('#loginUser').fill('test-member');
 await page.locator('#loginPass').fill('synthetic-secret');
 await page.locator('#loginForm [type=submit]').click();
 await page.locator('#hqNavigation [data-page="certification"]').waitFor({timeout:12000});
 assert.equal((await page.locator('#hqRole').textContent()).trim(),'Community Member');
 await page.locator('#hqNavigation [data-page="certification"]').click();
 await page.locator('[data-cert-form="accepted-case"]').waitFor();
 assert.equal(await page.locator('[data-cert-form="accepted-case"] fieldset').count(),8);
 for(const [id,correct] of Object.entries(answers))await page.locator('[data-cert-form="accepted-case"] input[name="'+id+'"][value="'+(id==='r-role'?'a':correct)+'"]').check();
 await page.locator('[data-cert-form="accepted-case"] input[name="acknowledge"]').check();
 await page.locator('[data-cert-form="accepted-case"] [type=submit]').click();
 await page.getByText('Score 88%',{exact:false}).waitFor({timeout:8000});
 assert.equal(certified,false,'A failed assessment cannot activate access');
 await page.locator('[data-cert-form="accepted-case"] input[name="r-role"][value="b"]').check();
 await page.locator('[data-cert-form="accepted-case"] [type=submit]').click();
 await page.waitForFunction(()=>document.querySelector('#hqRole')?.textContent?.includes('Representative'),undefined,{timeout:12000});
 assert.equal(certified,true);assert.equal(assessments,2);
 await page.locator('#hqNavigation [data-page="certification"]').click();
 await page.getByText('Your completed certifications',{exact:false}).waitFor();
 assert.equal(errors.length,0,'No browser JavaScript errors: '+errors.join('; '));
 await context.close();
 role='community-leader';certified=false;
 const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await mobile.route('https://sanctumportal.org/.netlify/functions/**',mockPortal);
 const p=await mobile.newPage();
 await p.goto(base+'/',{waitUntil:'domcontentloaded'});
 if(!(await p.locator('[data-signin]:visible').count()))await p.locator('#mobileNavTrigger').click();
 await p.locator('[data-signin]:visible').first().click();
 await p.locator('#loginUser').fill('test-external-organizer');
 await p.locator('#loginPass').fill('synthetic-secret');
 await p.locator('#loginForm [type=submit]').click();
 await p.locator('#hqNavigation [data-page="communityleaders"]').waitFor({timeout:12000});
 assert.equal(await p.locator('#hqNavigation [data-page="work"]').count(),0);
 assert.equal(await p.locator('#hqNavigation [data-page="certification"]').count(),0);
 assert.equal(await p.locator('#hqNavigation [data-page="generalapps"]').count(),0);
 await p.locator('#hqMenu').click();
 await p.locator('#hqNavigation [data-page="communityleaders"]').click();
 await p.getByText('Message Community Leaders, SELC or Eros',{exact:false}).waitFor();
 assert.equal(await p.locator('#hqRole').count(),1);
 await mobile.close();
 const founderContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await founderContext.route('https://sanctumportal.org/.netlify/functions/**',mockPortal);
 const founderPage=await founderContext.newPage();
 const founderErrors=[];
 founderPage.on('pageerror',e=>founderErrors.push(e.message));
 await founderPage.goto(base+'/?se_owner_handoff='+'a'.repeat(43),{waitUntil:'domcontentloaded'});
 await founderPage.waitForFunction(()=>document.querySelector('#hqRole')?.textContent?.includes('Founder'),undefined,{timeout:12000});
 assert.equal((await founderPage.locator('#hqRole').textContent()).trim(),'Founder & Chair');
 assert.ok(!founderPage.url().includes('se_owner_handoff'),'Owner handoff code must be erased from browser history');
 assert.equal(await founderPage.locator('#hqNavigation [data-page="applications"]').count(),1);
 assert.equal(await founderPage.locator('#hqNavigation [data-page="work"]').count(),1);
 assert.equal(await founderPage.locator('#hqNavigation [data-page="founderdesk"]').count(),1);
 for(const section of ['founderdesk','content','chat','readiness','banhistory','volunteer']){
  await founderPage.locator('#hqMenu').click();
  await founderPage.locator('#hqNavigation [data-page="'+section+'"]').click();
  await founderPage.waitForFunction(name=>document.querySelector('#hqContent')?.textContent?.includes(name),{
   founderdesk:'Founder command center',content:'Website & content management',chat:'Messages',readiness:'Event readiness',banhistory:'Current & previous bans',volunteer:'Volunteer for an event'
  }[section],{timeout:12000});
 }
 assert.equal(founderErrors.length,0,'Founder browser JavaScript errors: '+founderErrors.join('; '));
 await founderContext.close();
 console.log('SELC authenticated UI browser simulation passed: acceptance, retry, certification, role activation and mobile organizer isolation.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
