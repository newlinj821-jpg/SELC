/* SELC — independent public site and Portal-connected Leadership Headquarters.
 * Canonical data, authorization, identity and tickets remain on Sanctum Eros Portal.
 * Browser-to-Portal requests use an origin-bound bearer token; no duplicated password store.
 */
(()=>{'use strict';
const PORTAL='https://sanctumportal.org',FN=PORTAL+'/.netlify/functions/';
const $=(q,root=document)=>root.querySelector(q),$$=(q,root=document)=>[...root.querySelectorAll(q)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const plain=x=>String(x??'').trim(),date=x=>{if(!x)return 'Not specified';const d=new Date(x);return Number.isNaN(+d)?String(x).slice(0,17):new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'}).format(d)};
const number=x=>Number(x||0).toLocaleString('en-US');const initials=x=>String(x||'SE').split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
const context={token:'',me:null,activePage:'home',data:{},eventId:'',lastScan:null,stream:null};
const TOKEN_KEY='selc.session.v1';
// Discontinued Sanctum Eros events should not be offered in live SELC operations.
// This is a display safeguard; the Portal remains the authoritative event store.
const isDiscontinuedEvent=e=>/\bkink\s+n\s+drinks\b/i.test(String(e?.event?.title||e?.title||e?.name||'').replace(/[^a-z0-9]+/gi,' ').trim());
const activeSELCEvents=events=>(Array.isArray(events)?events:[]).filter(e=>!isDiscontinuedEvent(e));
const RANK={founder:'Founder/Director',coordinator:'SELC Coordinator · Administration',representative:'SELC Representative · Leadership',advisor:'SELC Advisor · Community & Education',staff:'Sanctum Eros Staff',member:'Community Member','community-applicant':'Community Leaders applicant','community-leader':'Approved Community Leader'};
const committeeRole=u=>['founder','coordinator','representative'].includes(u);
const participantRole=u=>committeeRole(u)||u==='advisor';
const advisor=()=>role()==='advisor';
// All active SELC role tiers may vote on committee proposals.
const organizerRole=u=>['community-applicant','community-leader'].includes(u);
const leader=()=>context.me&&['founder','coordinator','representative'].includes(context.me.role);
const reviewer=()=>context.me&&['founder','coordinator'].includes(context.me.role);
const owner=()=>context.me?.role==='founder';
const role=()=>context.me?.role||'member';
function flash(message){const root=$('#notify');if(!root)return;const alert=document.createElement('div');alert.textContent=message;root.append(alert);setTimeout(()=>alert.remove(),6500)}
function setStatus(node,msg,success=false){if(!node)return;node.textContent=msg||'';node.classList.toggle('good',!!success)}
async function api(service,{method='GET',query={},body,token=context.token,timeout=16000}={}){
  const url=new URL(FN+service);
  for(const [key,value]of Object.entries(query))if(value!==undefined&&value!==null&&value!=='')url.searchParams.set(key,String(value));
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  const options={method,mode:'cors',cache:'no-store',credentials:'omit',headers:{...(token?{'Authorization':'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal};
  try{
   // One authoritative identity service. Never retry credentials against a
   // second gateway or silently disguise an authentication error as network loss.
   const response=await fetch(url,options);
   let data={};try{data=await response.json()}catch{}
   if(!response.ok){
    const code=String(data.code||'');
    const categories={
     invalid_credentials:'The Portal did not accept these credentials.',
     session_expired:'Your session has expired. Connect through the Portal again.',
     account_restricted:'This account is restricted. Contact Sanctum Eros for review.',
     access_denied:'Your account is signed in but does not have permission for this action.',
     handoff_expired:'The connection link expired or was already used. Reconnect through the Portal.',
     rate_limited:'Too many sign-in attempts. Try again later.',
     portal_unavailable:'Portal authentication is unavailable. Your password has not been checked.'
    };
    const message=categories[code]||data.error||('Portal returned HTTP '+response.status+'.');
    const error=new Error(message);
    error.status=response.status;error.code=code||'http_'+response.status;
    error.requestId=String(data.requestId||response.headers.get('x-request-id')||'').slice(0,80);
    throw error;
   }
   return data;
  }catch(e){
   if(e.name==='AbortError'){const error=new Error('Portal authentication timed out; your credentials were not verified.');error.code='portal_timeout';throw error}
   if(e instanceof TypeError){const error=new Error('Cannot reach the Sanctum Eros Portal authentication service. This is a connection problem, not necessarily an incorrect password.');error.code='portal_connection';throw error}
   throw e;
  }finally{clearTimeout(timer)}
}
const post=(service,action,data={})=>api(service,{method:'POST',body:{action,...data}});
function setAccess(token){context.token=token;sessionStorage.setItem(TOKEN_KEY,token)}
function clearAccess(){context.token='';context.me=null;sessionStorage.removeItem(TOKEN_KEY);stopCamera()}
function pageHeader(eyebrow,title,subtitle,actions=''){return '<header class="hq-page-header"><div><span class="hq-eyebrow">'+esc(eyebrow)+'</span><h1>'+esc(title)+'</h1>'+(subtitle?'<p>'+esc(subtitle)+'</p>':'')+'</div><div class="hq-actions">'+actions+'</div></header>'}
function card(text){return '<div class="hq-card">'+text+'</div>'}
function empty(title,sub=''){return '<div class="hq-empty"><h3>'+esc(title)+'</h3><p>'+esc(sub)+'</p></div>'}
function tag(status){const st=String(status||'');const tone=/pending|submitted|wait|review|requested|discussion/i.test(st)?'warn':/approved|confirmed|active|complete|accepted|current/i.test(st)?'good':/ban|denied|declined|restricted|held|removed/i.test(st)?'bad':'';return '<span class="hq-tag '+tone+'">'+esc(st||'—')+'</span>'}
function btn(label,attr='',kind=''){return '<button class="hq-button '+kind+'" type="button" '+attr+'>'+esc(label)+'</button>'}
function setContent(markup){const el=$('#hqContent');if(el)el.innerHTML=markup||'';return el}
function load(){setContent('<div class="hq-loading"><span class="spinner"></span><p>Loading your work…</p></div>')}
function failure(error){setContent(card('<h2>This section couldn\'t open</h2><p>'+esc(error.message||'Please try again.')+'</p>'+btn('Try again','data-retry','primary')));$('[data-retry]')?.addEventListener('click',()=>openPage(context.activePage))}
function formValues(form){const data=new FormData(form),out={};for(const [k,v]of data.entries()){if(typeof v==='string')out[k]=v.trim()}return out}
function watchForm(form,handler){if(!form)return;form.addEventListener('submit',async e=>{e.preventDefault();const submit=e.submitter||form.querySelector('[type=submit]');if(submit)submit.disabled=true;try{await handler(formValues(form),form)}catch(error){setStatus(form.querySelector('[data-status]'),error.message);flash(error.message)}finally{if(submit)submit.disabled=false}})}
function modal(title,content){const d=document.createElement('dialog');d.className='login-dialog hq-modal';d.style.maxWidth='min(760px,calc(100vw - 24px))';d.innerHTML='<form method="dialog" class="modal-close-wrap"><button class="modal-close" aria-label="Close dialog">×</button></form><div class="login-inner"><span class="mini-overline">SELC HEADQUARTERS</span><h2 style="font-size:32px;margin:10px 0 20px">'+esc(title)+'</h2>'+content+'</div>';document.body.append(d);d.addEventListener('close',()=>d.remove());d.showModal();return d}
async function confirmDecision(message){return window.confirm(message)}
function closeMobileNav(){const nav=$('#publicNav'),toggle=$('#mobileNavTrigger');nav.classList.remove('open');toggle.setAttribute('aria-expanded','false')}
function openLogin(){closeMobileNav();const d=$('#loginDialog');if(d&&!d.open){d.showModal();$('#loginUser')?.focus()}}
function startPublic(){
 $$('[data-year]').forEach(n=>n.textContent=String(new Date().getFullYear()));
 $('#mobileNavTrigger').addEventListener('click',()=>{const nav=$('#publicNav');const next=!nav.classList.contains('open');nav.classList.toggle('open',next);$('#mobileNavTrigger').setAttribute('aria-expanded',String(next))});
 $$('#publicNav a').forEach(a=>a.addEventListener('click',closeMobileNav));
 $$('[data-signin]').forEach(b=>b.addEventListener('click',openLogin));
 $('#loginDialog').addEventListener('click',e=>{if(e.target.id==='loginDialog')e.target.close()});
 const loginForm=$('#loginForm'),loginMessage=$('#loginStatus');
 loginForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!loginForm.reportValidity())return;
  const submit=loginForm.querySelector('[type="submit"]'),credentials=formValues(loginForm);
  submit.disabled=true;submit.setAttribute('aria-busy','true');
  setStatus(loginMessage,'Checking your Portal account…');
  try{
   const result=await api('selc-auth',{method:'POST',token:'',timeout:12000,body:{action:'login',username:credentials.username,password:credentials.password}});
   if(!result.token)throw new Error('The sign-in service did not establish a session.');
   setAccess(result.token);
   // Verify the new session before dismissing the dialog so failed cross-site
   // sessions never masquerade as successful sign-in.
   await api('selc-auth',{timeout:10000});
   await beginHeadquarters();
   $('#loginDialog').close();loginForm.reset();setStatus(loginMessage,'');
  }catch(error){
   clearAccess();
   const message=(error?.message||'Sign-in could not be completed.')+(error?.requestId?' Reference: '+error.requestId:'');
   setStatus(loginMessage,message);
   loginMessage.setAttribute('role','alert');
  }finally{submit.disabled=false;submit.removeAttribute('aria-busy')}
 });
 loadPublicLeadership().catch(()=>{});
 const params=new URLSearchParams(location.search);
 const ownerCode=params.get('se_owner_handoff');
 if(ownerCode){
  // The code was minted only after the Portal verified its existing Owner session.
  // Exchange it once, then remove it from browser history before opening HQ.
  history.replaceState(null,'',location.pathname+location.hash);
  (async()=>{try{
   const result=await api('selc-auth',{method:'POST',token:'',body:{action:'exchange_owner_handoff',code:ownerCode}});
   if(!result.token||result.role!=='founder')throw new Error('The Owner Portal could not verify this Founder connection.');
   setAccess(result.token);
   await beginHeadquarters();
  }catch(error){flash(error.message);openLogin()}})();
  return;
 }
 const code=params.get('se_handoff');
 if(code&&params.get('se_app')==='selc'){
  const targetPortal=params.get('se_portal');
  history.replaceState(null,'',location.pathname+location.hash);
  if(targetPortal!==PORTAL){flash('This Portal connection was not recognized. Sign in normally.');return}
  (async()=>{try{
    const exchanged=await api('ecosystem-session',{method:'POST',token:'',body:{action:'exchange_handoff',code,target:'selc',clientOrigin:location.origin}});
    if(!exchanged.token)throw new Error('Your Portal connection has expired.');
    const upgraded=await api('selc-auth',{method:'POST',token:exchanged.token,body:{action:'upgrade_handoff'}});
    if(!upgraded.token)throw new Error('Your account could not be connected.');
    setAccess(upgraded.token);await beginHeadquarters();
  }catch(error){flash(error.message);openLogin()}})();
 }else{
  const restored=sessionStorage.getItem(TOKEN_KEY);if(restored){setAccess(restored);beginHeadquarters().catch(()=>clearAccess())}
 }
}
async function loadPublicLeadership(){
  const data=await api('selc-public',{token:'',timeout:5000});
  const host=$('#publicDirectory');if(!host)return;
  const people=Array.isArray(data.people)?data.people:[];
  const bySeat=new Map(people.filter(p=>p.role==='representative').map(p=>[Number(p.seat),p]));
  const advisors=people.filter(p=>p.role==='advisor');
  const grandfatheredRepresentatives=people.filter(p=>p.role==='representative'&&Number(p.seat)>3).sort((a,b)=>Number(a.seat)-Number(b.seat));
  const coordinators=people.filter(p=>p.role==='coordinator').slice(0,2);
  const coordinatorHost=$('#publicCoordinators');
  if(coordinatorHost)coordinatorHost.innerHTML=[0,1].map(n=>{
    const person=coordinators[n];
    return '<div class="seat-card"><span>'+String(n+1).padStart(2,'0')+'</span><strong>'+esc(person?.publicName||'Coordinator')+'</strong><small>'+esc(person?'SELC Coordinator':'Position available')+'</small></div>';
  }).join('');
  host.innerHTML=[1,2,3].map(n=>{
    const person=bySeat.get(n);
    return '<div class="seat-card"><span>'+String(n).padStart(2,'0')+'</span><strong>'+esc(person?.publicName||'Representative')+'</strong><small>'+'SELC Representative'+'</small></div>';
  }).join('');
  const transitionHost=$('#publicTransitionRepresentatives');
  if(transitionHost){
   transitionHost.innerHTML=grandfatheredRepresentatives.map(p=>'<div class="seat-card"><span>•</span><strong>'+esc(p.publicName||'Representative')+'</strong><small>Current Representative · previously accepted role</small></div>').join('');
   transitionHost.classList.toggle('hidden',grandfatheredRepresentatives.length===0);
  }
  const advisorHost=$('#publicAdvisors');
  if(advisorHost)advisorHost.innerHTML=advisors.length?advisors.map((person,i)=>'<div class="seat-card"><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+esc(person.publicName||'Advisor')+'</strong><small>SELC Advisor</small></div>').join(''):'<p class="directory-note">No Advisors have chosen to publish their names yet.</p>';
}
async function beginHeadquarters(){
 const session=await api('selc-auth');
 context.me={role:session.role,displayName:session.displayName,owner:session.owner,isStaff:session.isStaff===true};
 $('#publicSite').classList.add('hidden');$('#headquarters').classList.remove('hidden');$('#headquarters').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
 $('#hqUserName').textContent=context.me.displayName||'Member';$('#hqInitials').textContent=initials(context.me.displayName);const roleLabel=context.me.isStaff&&['representative','coordinator'].includes(role())?'Staff + '+(role()==='representative'?'Representative':'Coordinator'):(RANK[role()]||'Community Member');$('#hqRole').textContent=roleLabel;$('#hqRoleChip').textContent=roleLabel.toUpperCase();
 setupHQNav();const hash=location.hash.split('/')[1];await openPage(hash||(organizerRole(role())?'communityleaders':'home'));
}
const NAV=[
 ['home','⌂','Overview','Your work',u=>!organizerRole(u)],
 ['staffconnection','✉','Staff & SELC Connection','Your work',u=>u==='staff'],
 ['handbook','▤','Staff Handbook','Your work',u=>u==='staff'],
 ['founderdesk','◈','Founder desk','Leadership',u=>u==='founder'],
  ['admincenter','◈','Coordinator administration','Leadership',u=>u==='coordinator'],
 ['join','✎','Apply to SELC','Your work',u=>u==='member'||u==='advisor'],
 ['certification','✓','SELC certification','Your work',u=>!organizerRole(u)&&u!=='founder'],
 ['coordinator','⇧','Coordinator application','Your work',u=>u==='representative'],
 ['ballots','✓','Coordinator election','Your work',u=>participantRole(u)&&u!=='founder'],
 ['applications','▤','SELC applications','Leadership',u=>u==='founder'||u==='coordinator'],
 ['leader','◈','SELC members & advisors','Leadership',u=>participantRole(u)],
 ['availability','◷','My availability','Your work',u=>participantRole(u)&&u!=='founder'],
 ['work','▣','Leadership Action Center','Leadership',u=>committeeRole(u)],
 ['handbook','▤','SELC Handbook Center','Your work',u=>participantRole(u)],
 ['communityinbox','✉','Community Inbox','Committee',u=>participantRole(u)],
 ['memberdesk','✉','Member messages & feedback','Committee',u=>participantRole(u),'hidden'],
 ['suggestionsdesk','◇','Member suggestions','Committee',u=>participantRole(u),'hidden'],
 ['feedbackdesk','▤','Event feedback review','Committee',u=>participantRole(u),'hidden'],
 ['proposals','◉','Proposals & votes','Committee',u=>participantRole(u)],
 ['content','✎','Website content','Committee',u=>committeeRole(u)],
 ['chat','▤','Community chat','Community',u=>!['community-applicant'].includes(u)],
 ['requests','↗','Community conversations','Committee',u=>committeeRole(u)],
 ['communityleaders','◇','Community Leaders network','Partnerships'],
 ['applyeducator','✦','Become a Community Educator','Education',u=>!organizerRole(u)],
 ['educatorreviews','▤','Educator applications','Education',u=>u==='founder'||u==='coordinator'],
 ['educators','✦','Education & workshops','Committee',u=>participantRole(u)],
 ['registry','▤','Member registry','Leadership',u=>committeeRole(u)],
 ['generalapps','▧','Member & role applications','Event operations',u=>committeeRole(u)],
 ['events','▦','Events & RSVPs','Event operations',u=>committeeRole(u)],
 ['volunteer','✋','Staffing overview','Event operations',u=>committeeRole(u)],
  ['staffpath','✓','Apply to become Staff','Your work',u=>u==='representative'||u==='coordinator'],
 ['readiness','▣','Event readiness','Event operations',u=>committeeRole(u)],
 
 ['iacases','▤','Internal Affairs cases','Safety',u=>committeeRole(u)],
  ['banreports','⚑','Ban Reports','Safety',u=>committeeRole(u)],
 ['banhistory','⌛','Ban history','Safety',u=>committeeRole(u)],
 ['appeals','⚖','Access appeals','Safety',u=>u==='coordinator'||u==='founder'],
 ['myaccount','◎','My account','Your work']
];
function setupHQNav(){
 const root=$('#hqNavigation');let last='';const groups={'Your work':'Overview','Leadership':'Leadership','Committee':'Community','Community':'Community','Partnerships':'Community','Education':'Resources','Event operations':'Events','Safety':'Safety'};root.innerHTML=NAV.filter(item=>(!item[4]||item[4](role()))&&item[5]!=='hidden').map(([id,ico,label,group])=>{const groupLabel=groups[group]||group||'Resources';let groupPart='';if(groupLabel!==last){groupPart='<p class="nav-group">'+esc(groupLabel)+'</p>';last=groupLabel}return groupPart+'<button type="button" data-page="'+esc(id)+'"><span class="nav-emoji">'+esc(ico)+'</span><span>'+esc(label)+'</span></button>'}).join('');
 root.addEventListener('click',e=>{const button=e.target.closest('[data-page]');if(button){closeHQNav();openPage(button.dataset.page)}});
 $('#hqMenu').addEventListener('click',()=>{const open=!$('#hqSidebar').classList.contains('open');$('#hqSidebar').classList.toggle('open',open);$('#hqShade').classList.toggle('open',open);$('#hqMenu').setAttribute('aria-expanded',String(open))});
 $('#hqShade').addEventListener('click',closeHQNav);
 $('#hqRefresh').addEventListener('click',()=>openPage(context.activePage));
 $('#hqSignout').addEventListener('click',signOut);
 addEventListener('hashchange',()=>{if($('#headquarters').classList.contains('hidden'))return;const name=location.hash.split('/')[1];if(name&&NAV.some(n=>n[0]===name)&&name!==context.activePage)openPage(name)});
}
function closeHQNav(){$('#hqSidebar').classList.remove('open');$('#hqShade').classList.remove('open');$('#hqMenu').setAttribute('aria-expanded','false')}
async function signOut(){try{await post('selc-auth','logout')}catch{}clearAccess();$('#headquarters').classList.add('hidden');$('#headquarters').setAttribute('aria-hidden','true');$('#publicSite').classList.remove('hidden');document.body.style.overflow='';history.replaceState(null,'',location.pathname);scrollTo(0,0);flash('Signed out of SELC. Your Portal account remains separate.')}
async function openPage(page){
 // Preserve old links while presenting a single source of handbook navigation.
 if(page==='library')page='handbook';
 if(context.chatTimer){clearTimeout(context.chatTimer);context.chatTimer=null}
 if(context.editorPickListener){removeEventListener('message',context.editorPickListener);context.editorPickListener=null}
 const allowed=NAV.find(n=>n[0]===page&&(!n[4]||n[4](role())));
 if(!allowed)page=organizerRole(role())?'communityleaders':'home';context.activePage=page;
 $$('#hqNavigation [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 $('#hqCurrentSection').textContent=allowed?.[2]?.toUpperCase()||'HEADQUARTERS';
 if(location.hash!=='#/'+page)history.replaceState(null,'','#/'+page);
 load();
 try{
  const pages={communityinbox:communityInboxPage,memberdesk:memberDeskPage,suggestionsdesk:suggestionsDeskPage,feedbackdesk:feedbackDeskPage,availability:availabilityPage,admincenter:coordinatorAdminPage,founderdesk:founderDeskPage,content:contentManagementPage,chat:communityChatPage,banhistory:banHistoryPage,readiness:eventReadinessPage,home:homePage,join:joinPage,certification:certificationPage,coordinator:coordinatorPage,ballots:ballotsPage,applications:applicationsPage,leader:leaderPage,work:leadershipWorkPage,handbook:roleHandbookPage,staffconnection:staffConnectionPage,proposals:proposalPage,requests:()=>requestsPage('all'),communityleaders:communityLeadersPage,educators:educationProgramsPage,applyeducator:educatorApplicationPage,educatorreviews:educatorReviewsPage,registry:memberRegistryPage,generalapps:generalAppsPage,events:eventPage,volunteer:volunteerPage,staffpath:staffPathPage,iacases:iaCasesPage,banreports:banReportsPage,appeals:appealReviewPage,myaccount:accountPage};
  await (pages[page]||homePage)();$('#hqContent')?.scrollTo?.({top:0,behavior:'instant'});
 }catch(error){if(error.status===401){clearAccess();$('#headquarters').classList.add('hidden');$('#publicSite').classList.remove('hidden');document.body.style.overflow='';openLogin();flash('Your session expired. Please sign in again.');return}failure(error)}
}
async function staffConnectionPage(){
 const data=await api('community-requests').catch(()=>({requests:[]}));
 const mine=(data.requests||[]).filter(r=>r.kind==='staff_message'||r.submitterKind==='staff');
 let markup=pageHeader('STAFF / SELC','Your connection to SELC','You are part of the Sanctum Eros team. You can ask questions, share ideas and follow conversations with leadership without applying for a committee role.');
 markup+=card('<h2>Working together</h2><p>Contact SELC about event support, Staff suggestions, educational needs or practical improvements. You can also join the Staff & Educators room for ongoing collaboration. Your Staff role is separate from SELC voting and administrative roles.</p><div class="hq-actions">'+btn('Staff & Educators chat','data-page-link="chat"','primary')+btn('Read Staff Handbook','data-page-link="handbook"')+'</div>');
 markup+=card('<h2>Send a message to SELC</h2><form class="hq-form" id="staffMessageForm"><label>Subject<input name="title" minlength="6" maxlength="160" required placeholder="What would you like to discuss?"></label><label>Message<textarea name="details" minlength="20" rows="5" required placeholder="Share the question, suggestion or support you need."></textarea></label><p class="hq-form-status" data-status></p><button class="hq-button primary" type="submit">Send to SELC</button></form>');
 markup+=card('<h2>Your conversations</h2>'+(mine.length?mine.map(r=>'<div class="hq-row"><div class="grow"><strong>'+esc(r.title)+'</strong><p>'+esc(r.details||'').slice(0,130)+'</p><p class="hq-micro">'+esc(date(r.updatedAt))+'</p></div>'+tag(r.status)+btn('Open','data-staff-request="'+esc(r.id)+'"')+'</div>').join(''):'<p>Your messages and replies will appear here.</p>'));
 setContent(markup);bindPageLinks();
 watchForm($('#staffMessageForm'),async data=>{await post('community-requests','create',{kind:'staff_message',title:data.title,details:data.details});flash('Your message was sent to SELC.');await staffConnectionPage()});
 $$('[data-staff-request]').forEach(b=>b.onclick=()=>{
  const r=mine.find(x=>x.id===b.dataset.staffRequest);if(!r)return;
  const dialog=modal(r.title,'<p>'+esc(r.details)+'</p><p class="hq-micro">Status: '+esc(r.status)+'</p>'+(r.messages||[]).map(m=>'<div class="hq-case-message"><strong>'+esc(m.by)+'</strong><p>'+esc(m.message)+'</p></div>').join('')+'<form class="hq-form" id="staffReplyForm"><label>Reply<textarea name="message" rows="3" minlength="2" required></textarea></label><p data-status></p><button class="hq-button primary" type="submit">Send reply</button></form>');
  watchForm($('#staffReplyForm',dialog),async vals=>{await post('community-requests','reply',{id:r.id,message:vals.message});dialog.close();flash('Reply sent.');await staffConnectionPage()});
 });
}
async function advisorHomePage(home){
 const [inbox,proposals]=await Promise.all([
  api('committee-desk',{query:{scope:'messages'}}).catch(()=>({messages:[]})),
  api('selc-governance',{query:{scope:'proposals'}}).catch(()=>({proposals:[]}))
 ]);
 const eligible=(proposals.proposals||[]).filter(p=>p.status==='Discussion');
 const markup=pageHeader('SELC / ADVISOR','Welcome back, '+esc((context.me.displayName||'Advisor').split(' ')[0]),'Support member communications, education, outreach and community improvement. You may provide feedback and vote on committee proposals across all categories.')+
  '<div class="hq-stats"><div class="hq-stat"><small>SHARED MESSAGES</small><strong>'+number(inbox.messages?.length||0)+'</strong></div><div class="hq-stat"><small>ADVISOR-ELIGIBLE VOTES</small><strong>'+number(eligible.length)+'</strong></div></div>'+
  card('<h2>Your Advisor responsibilities</h2><p>Participate in SELC chat, review opted-in member communications and event feedback, contribute educational ideas, and vote on committee proposals. Private IA records, membership approvals, Staff accepted roles and bans remain outside the Advisor role.</p><div class="hq-actions">'+btn('Community inbox','data-page-link="communityinbox"','primary')+btn('Proposals and votes','data-page-link="proposals"')+btn('SELC chat','data-page-link="chat"')+btn('Apply for Representative','data-page-link="join"')+'</div>');
 setContent(markup);bindPageLinks();
}
async function homePage(){
 if(role()==='staff')return staffConnectionPage();
 const jobs=[api('selc-governance',{query:{scope:'home'}})];
 if(leader())jobs.push(api('community-requests'),api('staff-portal'),api('ban-reports'));
 const results=await Promise.allSettled(jobs),home=results[0].status==='fulfilled'?results[0].value:null;
 if(!home)throw results[0].reason||new Error('The leadership workspace is unavailable.');
 context.data.home=home;
 if(advisor())return advisorHomePage(home);
 if(role()==='staff')return staffConnectionPage();
 if(!leader()){const pendingCert=(home.myApplications||[]).some(a=>a.status==='Certification Pending'),underReview=(home.myApplications||[]).some(a=>['Pending','Under Review','Recommended'].includes(a.status));setContent(pageHeader('WELCOME TO SELC','Your next chapter','SELC membership requires approved SE membership, a separate application and acceptance, then certification.')+(pendingCert?card('<h2>Application accepted — certification required</h2><p>Complete your training to activate committee privileges.</p>'+btn('Begin SELC certification','data-page-link="certification"','primary')):underReview?card('<h2>Your application is under review</h2><p>SELC leadership will review your answers. No committee permissions are granted until the application is accepted and certification completed.</p>'):card('<h2>Help build something meaningful</h2><p>Apply for an Advisor or Representative position. No committee privileges activate until acceptance and certification.</p>'+btn('Apply to SELC','data-page-link="join"','primary')))+(home.myApplications?.length?card('<h2>Your applications</h2>'+home.myApplications.map(a=>'<div class="hq-row"><div class="grow"><strong>'+esc(a.type)+' application</strong><p>Submitted '+esc(date(a.createdAt))+'</p></div>'+tag(a.status)+'</div>').join('')):''));bindPageLinks();return}
 const [conv,staff,bans]=results.slice(1).map(r=>r.status==='fulfilled'?r.value:null);
 const proposals=await api('selc-governance',{query:{scope:'proposals'}}).catch(()=>({proposals:[]}));
 const cards=[['SELC POSITIONS',String((home.occupiedSeats||0)+(home.advisors||0))+'/10'],['COORDINATORS',String(home.coordinators||0)+'/2'],['OPEN CONVERSATIONS',number(conv?.openCount||0)],['BAN REPORTS PENDING',number(bans?.pendingCount||0)]];
 let markup=pageHeader('YOUR COMMUNITY / YOUR RESPONSIBILITY','Welcome back, '+(context.me.displayName||'').split(' ')[0],'Leadership is the work we do together—not just the title we hold.',btn('Start a proposal','data-page-link="proposals"','primary'));
 markup+='<div class="hq-stats">'+cards.map(([label,value])=>'<div class="hq-stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></div>').join('')+'</div>';
 markup+='<div class="hq-grid">'+card('<h2>Where your attention can help</h2>'+[
  ['Committee proposals',(proposals.proposals||[]).filter(p=>p.status==='Discussion').length,'proposals'],
  ['Community & educator requests',conv?.openCount||0,'requests'],['Ban Reports awaiting decision',bans?.pendingCount||0,'banreports'],['Upcoming events',activeSELCEvents(staff?.events).length,'events']
 ].map(([label,value,link])=>'<div class="hq-row"><div class="grow"><strong>'+esc(label)+'</strong><p>'+number(value)+' item(s)</p></div>'+btn('Open','data-page-link="'+link+'"')+'</div>').join(''))+
 card('<h2>Quick access</h2><p>All authorized SELC responsibilities live here, using the same event and member records as the Portal.</p><div class="hq-grid-3">'+[['Action Center','work'],['Community inbox','communityinbox'],['Applications','generalapps'],['Member registry','registry'],['Staffing overview','volunteer'],['Become Staff','staffpath'],['RSVPs & events','events'],['Education','educators'],['Committee vote','ballots'],['Leadership','leader']].map(([label,link])=>btn(label,'data-page-link="'+link+'"')).join('')+'</div>')+'</div>';
 if(!staff)markup+=card('<p>Portal event operations are temporarily unavailable. Other committee tools may still work.</p>');
 setContent(markup);bindPageLinks();
}
function bindPageLinks(root=$('#hqContent')){$$('[data-page-link]',root).forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.pageLink)))}
const REPFIELDS=[['motivation','Why does serving this community matter to you?','Tell us what motivates you and what you hope to build together.'],['experience','What experiences and strengths would you bring?','Community work, kink education, organizing, technical skills, writing, advocacy, or anything else relevant.'],['collaboration','Describe how you handle disagreement or feedback.','We value people who can listen without losing their own voice.'],['consent','How would you support consent, privacy, and community care?','Include how you would handle sensitive information responsibly.'],['participation','How would you like to contribute?','In-person events, online planning, education, outreach, projects, and your realistic availability.'],['example','Tell us about a time you stepped up to help others.','What happened, what did you do, and what would you do differently?']];
function textfield([name,label,hint],value='',required=true){return '<label for="f-'+esc(name)+'">'+esc(label)+'</label><textarea id="f-'+esc(name)+'" name="'+esc(name)+'" rows="4" placeholder="'+esc(hint||'')+'" '+(required?'required':'')+'>'+esc(value)+'</textarea>'}
const ADVISORFIELDS=[
 ['motivation','Why do you want to support SELC as an Advisor?','Describe the community or educational contribution you hope to make.'],
 ['experience','What experiences, interests or skills would you bring?','Community knowledge, writing, accessibility, outreach, teaching support, or organizing.'],
 ['collaboration','How do you handle disagreement and competing perspectives?','Explain how you listen and contribute constructively.'],
 ['consent','How will you respect privacy, consent and the limits of the Advisor role?','Sensitive allegations and IA cases must be referred to authorized leadership.'],
 ['participation','What projects or feedback would you like to work on?','Share your practical interests and realistic availability.'],
 ['example','Describe a time you helped improve a group or situation.','What did you contribute, and what did you learn?']
];
async function joinPage(){
 const home=context.data.home||await api('selc-governance',{query:{scope:'home'}}),pending=home.myApplications||[];
 let markup=pageHeader('YOUR APPLICATION','Join SELC','Choose an Advisor or Representative path. Advisors focus on community, education and eligible votes; Representatives independently manage routine membership and organizational reviews. All accepted roles require approval and certification.');
 if(pending.length)markup+=card('<h2>Your application history</h2>'+pending.map(a=>'<div class="hq-row"><div class="grow"><strong>'+esc(a.type==='advisor'?'Advisor':a.type==='coordinator'?'Coordinator':'Representative')+' application</strong><p>'+esc(date(a.createdAt))+'</p></div>'+tag(a.status)+'</div>').join(''));
 if(!['member','advisor'].includes(role())){setContent(markup+card('<h2>Your leadership role is already active</h2><p>Use your leadership sections for current responsibilities.</p>'));return}
 if(pending.some(a=>['Pending','Under Review','Recommended','Certification Pending'].includes(a.status))){setContent(markup+card('<h2>An application is already in progress</h2><p>Finish the existing review or assigned certification before submitting another SELC application.</p>'+btn('Review my status','data-page-link="home"','primary')));bindPageLinks();return}
 const choices=role()==='advisor'?
  '<option value="representative">Representative — advance from Advisor</option>':
  '<option value="advisor">Advisor — community and education</option><option value="representative">Representative — organizational leadership</option>';
 markup+=card('<h2>Select a leadership path</h2><p>Advisor positions are capped at five, Representative positions at three, and Coordinator positions at two. Existing accepted roles remain in place during the transition.</p><form id="repForm" class="hq-form"><label>Position to apply for<select name="targetRole" id="selcTargetRole" required>'+choices+'</select></label><div id="selcApplicationQuestions"></div><label class="checkline"><input type="checkbox" name="truthful" required> These responses reflect my experience and intentions.</label><p data-status class="hq-form-status" aria-live="polite"></p><button type="submit" class="hq-button primary">Submit SELC application</button></form>');
 setContent(markup);
 const selector=$('#selcTargetRole'),questions=$('#selcApplicationQuestions');
 const render=()=>{const fields=selector.value==='advisor'?ADVISORFIELDS:REPFIELDS;questions.innerHTML=fields.map(f=>textfield(f)).join('')};
 selector.addEventListener('change',render);render();
 watchForm($('#repForm'),async(data,form)=>{
  if(!data.truthful)throw new Error('Confirm the accuracy of your application.');
  const target=String(data.targetRole||'');
  if(!['advisor','representative'].includes(target)||(role()==='advisor'&&target!=='representative'))throw new Error('Choose a permitted SELC application path.');
  const fields=target==='advisor'?ADVISORFIELDS:REPFIELDS;
  const answers=Object.fromEntries(fields.map(f=>[f[0],data[f[0]]]));
  if(String(answers.motivation||'').trim().length<80||String(answers.experience||'').trim().length<80)throw new Error('Please expand your motivation and experience to at least 80 characters each.');
  await post('selc-governance',target==='advisor'?'apply_advisor':'apply_representative',{answers});
  setStatus(form.querySelector('[data-status]'),'Your application was received.',true);
  flash('SELC '+(target==='advisor'?'Advisor':'Representative')+' application received.');
  await openPage('home');
 });
}
async function certificationPage(){
 const data=await api('selc-governance',{query:{scope:'certification'}}),assignments=data.assignments||[];
 let markup=pageHeader('SELC / REQUIRED TRAINING','SELC certification','Complete training and assessment after role acceptance. Your new committee privileges activate only on a verified pass.');
 const completed=data.completed||[];
 if(completed.length)markup+=card('<h2>Your completed certifications</h2>'+completed.map(c=>'<div class="hq-row"><div class="grow"><strong>'+esc(c.type==='coordinator'?'SELC Coordinator':c.type==='advisor'?'SELC Advisor':'SELC Representative')+' · Certified</strong><p>Completed '+esc(date(c.completedAt))+' · Version '+esc(c.version)+'</p><small>Record '+esc(c.id)+'</small></div>'+tag('Complete')+'</div>').join(''));
 if(!assignments.length){setContent(markup+(completed.length?'':empty('No outstanding certification','Accepted applications are assigned here. You cannot begin certification before acceptance.')));return}
 const commonLessons=[
  {title:'Mandate, service and authority',objective:'Separate committee participation from operational control and account permissions.',steps:[
    'A Representative contributes to policy, governance, applications, education, IA review and community accountability within the authorized workflow.',
    'An role does not grant Staff, Dungeon Monitor or educator credentials. Each operational position has its own application, training and permission checks.',
    'Use the role shown in your authenticated account. If a screen or case action is unavailable, request a documented permission review rather than borrowing credentials.'
   ],scenario:'You are asked to oversee a play space because you are an SELC member. Arrange coverage by a qualified Dungeon Monitor; committee status does not substitute for DM certification.'},
  {title:'Consent, boundaries and immediate intervention',objective:'Recognize when a concern needs a venue response rather than a committee discussion.',steps:[
    'Consent is informed, specific, ongoing and withdrawable. A past agreement, relationship, or scene role never overrides a present stop or refusal.',
    'If an immediate safety risk exists, pause the activity and involve authorized on-site Staff or a DM. Document facts only after people are safe.',
    'Do not attempt to adjudicate a scene or perform an unfamiliar physical intervention solely because you are a committee member.'
   ],scenario:'A participant withdraws consent mid-scene. Stop participation, call on the on-duty DM where needed, and preserve privacy; do not wait for a vote.'},
  {title:'Confidential IA records and evidence security',objective:'Use comprehensive leadership access responsibly without moving data into uncontrolled channels.',steps:[
    'SELC leadership can inspect IA affairs and active or historical ban records in authorized systems. Access does not itself authorize disclosure, ban enforcement or evidence deletion.',
    'Use only your own login, preserve source materials and access history, and avoid screenshots, personal cloud exports and private group chats.',
    'Keep allegations, witness accounts, third-party reports, established facts and conclusions labeled distinctly. Record the purpose of review and any next step.'
   ],scenario:'A member asks you to forward a confidential allegation. Decline the disclosure and direct them to the established complaint and review channel.'},
  {title:'Fact-finding, fairness and anti-retaliation',objective:'Respond to conflicting accounts without prejudgment or procedural shortcuts.',steps:[
    'Identify the person and event involved; distinguish firsthand information, corroborated facts and unsupported assertions.',
    'Document concerns promptly, identify missing information, invite appropriate responses and declare conflicts of interest before recommending any outcome.',
    'Preserve a safe reporting channel, prohibit retaliation and use an independent reviewer when a committee member or decision-maker is involved.'
   ],scenario:'A friend is named in a complaint. Disclose the relationship and recuse from recommendations or decisions that depend on your impartiality.'},
  {title:'Membership, RSVP and admission operations',objective:'Know which checks must precede approval, ticketing and physical admission.',steps:[
    'Confirm account and membership status, event eligibility, the 21+ play-party minimum, approved attendee names, capacity and any current safety holds.',
    'Tickets and QR check-in remain separate from government-photo-ID collection. The guest acknowledgment flow uses age and venue-rule attestations with review.',
    'Use the leadership work queue and event record to avoid duplicated approvals, preserve audit history and flag payment or eligibility issues for the correct team.'
   ],scenario:'A report has placed an RSVP on hold. Do not override a ticket merely because payment is confirmed; route the safety hold to an authorized reviewer.'},
  {title:'Ban Reports, restrictions and appeals',objective:'Understand the difference between receiving evidence, recommending a response and issuing an enforceable decision.',steps:[
    'A Ban Report creates an interim safety review and may temporarily hold linked admission. It is not a substantiated finding or automatic permanent ban.',
    'Representatives may read records and provide documented feedback, but may not issue, revoke or lift bans through their SELC position.',
    'Use the formal appeal route, preserve independent review when possible and distinguish temporary protective measures from final dispositions.'
   ],scenario:'A Representative strongly supports a ban. They record the basis and conflicts in the report; a separately authorized reviewer decides the enforcement action.'},
  {title:'Committee proposals, voting and follow-through',objective:'Turn ideas and votes into traceable actions rather than informal chat decisions.',steps:[
    'Create a proposal with a clear decision, evidence, affected groups and realistic costs or operational impacts.',
    'Record eligible votes, quorum, conflicts, comments and the result before using the implementation workflow.',
    'Track an accountable person, due date, status, blockers and change history. Coordinator-created events require the approved draft to match the voted version before publication.'
   ],scenario:'An approved event draft changes capacity and content after the vote. It must be reviewed again rather than published using the old approval.'},
  {title:'Community, education and inclusion',objective:'Build services that are credible, accessible and community-focused.',steps:[
    'Evaluate educator competence, safety controls, learning objectives, participant choice and accessible alternatives before recommending a class.',
    'Maintain the boundary between approved external Community Leaders and SELC membership; outside organizers do not inherit committee votes or private IA access.',
    'Use respectful, direct communication and address disability, scheduling and sensory barriers without demanding unnecessary personal disclosure.'
   ],scenario:'A participant needs an accessible workshop format. Work with the instructor on a safe, equivalent alternative and record accommodations only as needed.'},
  {title:'Accountability, handovers and communication',objective:'Make committee work repeatable and reviewable across different members.',steps:[
    'Claim or assign work through tracked queues, set realistic deadlines and document who will follow up with the reporter, applicant or event team.',
    'Use the shared Community Inbox for messages members authorized SELC to see; correspondence addressed privately to Eros stays outside that shared queue.',
    'Correct mistakes openly in the record, notify the appropriate people and preserve an auditable history rather than quietly overwriting decisions.'
   ],scenario:'Two members are independently reviewing the same application. Coordinate an assigned reviewer and keep a single source of truth.'}
 ];
 const roleLessons={
  representative:[
   {title:'Representative judgment and feedback',objective:'Provide useful leadership analysis without crossing enforcement authority.',steps:['Review the complete relevant IA and ban history through your authorized access.','Write specific feedback that separates evidence, uncertainty, proportionality and proposed follow-up.','Recuse when personally involved and escalate urgent concerns through the on-duty safety response.'],scenario:'A Ban Report asks you to support a decision. Submit your supported feedback rather than trying to impose the ban yourself.'},
   {title:'Representative participation and working groups',objective:'Contribute to operations without duplicating the Staff or Coordinator workspace.',steps:['Choose focus areas and work with colleagues on governance, education, events or outreach.','Use the Staff Portal when you also hold a separately accepted and certified Staff or DM role.','Contribute votes and implementation updates within your own role.'],scenario:'A Coordinator is unavailable. Document the pending work and route it to the designated reviewer; do not assume unrestricted administrator credentials.'}
  ],
  coordinator:[
   {title:'Coordinator administration and supervision',objective:'Use delegated administration with disciplined access controls and oversight.',steps:['Review event staffing coverage, member and role queues, application status and time-sensitive safety cases.','Close or reopen volunteer positions through the authorized staffing controls; Staff and DM shift claims still require separate qualification.','Delegate with an identified owner and an escalation route; avoid shared logins and undocumented overrides.'],scenario:'An event has an uncovered DM slot. Do not fill it with a Representative who lacks DM certification; recruit a qualified DM and log the staffing risk.'},
   {title:'Enforcement decision quality and appeals',objective:'Make proportionate, documented enforcement decisions where separately authorized.',steps:['Verify identity and evidence, consider immediate risk and less restrictive measures, and record conflicts before taking action.','Preserve the distinction between a pending Ban Report hold, IA findings, restriction and ban disposition.','Where an appeal concerns your own decision, arrange an independent review and preserve the original record.'],scenario:'A former attendee disputes a temporary ban. Preserve the original rationale and route the appeal to a reviewer without the conflict.'},
   {title:'Operational incident and release control',objective:'Prevent rushed changes from bypassing the committee process.',steps:['For event drafts, secure the correct committee vote and approval before releasing RSVPs.','Do not publish a draft that differs from the reviewed snapshot; restart review when material details change.','Use implementation milestones, operational handovers and audit entries to keep venue and community work coordinated.'],scenario:'A last-minute change alters a voted workshop from discussion to high-risk demonstration. Require review of instructor competence and event safety controls before it goes live.'}
  ]
 };
 const advisorLessons=[
 {title:'Advisor boundaries and participation',objective:'Participate meaningfully without independent administrative or safety authority.',steps:['Advisors advise on community, education and events; Representatives approve routine membership changes and Coordinators oversee higher authority.','Members must explicitly authorize shared correspondence; complaints and IA cases remain restricted.','SELC Advisor status does not grant free admissions, Staff permissions, or access to private member files.'],scenario:'A member asks an Advisor to approve their membership. Route the request to a Representative and offer only procedural guidance.'},
 {title:'Member communications and community care',objective:'Support privacy-respecting communication and constructive feedback.',steps:['Use the authorized Community Inbox for opted-in messages, reviews and suggestions.','Escalate allegations, safeguarding issues and conflicts without attempting an investigation.','Keep replies factual, kind, and linked to the shared record.'],scenario:'A complaint alleges a consent violation. Stop reading and refer to authorized IA/leadership reporting channels.'},
 {title:'Education, projects and accountable voting',objective:'Research, propose and vote within an Advisor remit.',steps:['Advisors may introduce, discuss and vote on all committee proposals, including broader governance topics.','Voting does not authorize Advisors to change pricing, manage Staff, investigate bans or enforce policies independently.','Disclose conflicts, document recommendations and follow approved project handovers.'],scenario:'An Advisor votes on pricing: the vote is recorded, but execution and final approval remain with authorized leadership.'}
 ];
 const modulesFor=type=>type==='advisor'?advisorLessons:[...commonLessons,...(roleLessons[type]||[])];
 const renderModule=(m,i)=>'<details class="hq-card"><summary><strong>'+(i+1)+'. '+esc(m.title)+'</strong></summary>'+
  '<p class="hq-prose"><strong>Outcome:</strong> '+esc(m.objective)+'</p><ol class="hq-prose">'+m.steps.map(step=>'<li>'+esc(step)+'</li>').join('')+'</ol>'+
  '<p class="hq-prose"><strong>Applied scenario:</strong> '+esc(m.scenario)+'</p></details>';
 markup+=card('<h2>Assessment standard</h2><p>Advisor assessments have 10 questions; Representative and Coordinator assessments have 20. A score of '+esc(data.passPercent)+'% is required. The questions are graded on the Portal server. Review the course modules and retry missed questions; your result is linked to the accepted role.</p>');
 markup+=assignments.map(a=>card('<span class="hq-eyebrow">'+esc(a.type==='coordinator'?'COORDINATOR ADVANCEMENT':a.type==='advisor'?'ADVISOR DEVELOPMENT':'REPRESENTATIVE ENTRY')+'</span>'+
  '<h2>'+esc(a.type==='coordinator'?'Coordinator certification':a.type==='advisor'?'Advisor certification':'Representative certification')+'</h2>'+
  '<p class="hq-prose">Read the modules below before completing the assessment. Expand each section for actions, boundaries and a practical example.</p>'+
  '<div class="hq-curriculum">'+modulesFor(a.type).map(renderModule).join('')+'</div>'+
  '<form class="hq-form" data-cert-form="'+esc(a.id)+'">'+a.questions.map((q,i)=>'<fieldset><legend>'+(i+1)+'. '+esc(q.prompt)+'</legend>'+q.options.map(o=>'<label class="checkline"><input type="radio" name="'+esc(q.id)+'" value="'+esc(o.value)+'" required> '+esc(o.label)+'</label>').join('')+'</fieldset>').join('')+
  '<label class="checkline"><input type="checkbox" name="acknowledge" value="yes" required> I have reviewed the course material and will follow the privacy, impartiality, safety, nonretaliation and access-control requirements of my role.</label>'+
  '<p data-status class="hq-form-status" role="status"></p><button type="submit" class="hq-button primary">Submit certification assessment</button></form>')).join('');
 setContent(markup);
 document.querySelectorAll('[data-cert-form]').forEach(form=>watchForm(form,async(values,el)=>{
  const acknowledge=el.querySelector('[name="acknowledge"]').checked;
  const answers={...values};delete answers.acknowledge;
  const result=await post('selc-governance','complete_certification',{id:el.dataset.certForm,answers,acknowledge});
  if(!result.passed){setStatus(el.querySelector('[data-status]'),'Score '+result.percent+'%. Review the lessons and try again; all answers must be correct.');return}
  setStatus(el.querySelector('[data-status]'),'Certification passed; role activated.',true);
  flash('SELC certification completed. Your updated access is ready.');location.reload();
 }));
}
const COORDFIELDS=[
 ['leadership','MOTIVATION & LEADERSHIP',[['motivation','Why are you applying to be a Coordinator?','What would you improve, and why does this responsibility matter?'],['leadershipStyle','How would you describe your leadership approach?','Explain how you support different perspectives.']]],
 ['contributions','YOUR WORK WITH SELC',[['experience','What have you contributed to SELC so far?','Include specific projects, discussions, events or other contributions.'],['reliability','How would you respond after missing an important commitment?','Be specific about accountability and recovery.']]],
 ['operations','RUNNING OUR WORK',[['administration','Explain how you would handle routine RSVPs, membership reviews, event staffing and ticket issues.','What would you handle yourself and what would you escalate?'],['priorities','Three urgent tasks arrive at the same time. How do you prioritize them?','Describe how you communicate a plan.']]],
 ['judgment','SCENARIOS & DECISION-MAKING',[['scenarioMembership','A Representative recommends approval but a membership application reveals a safety concern. What do you do?','Describe review, documentation and appropriate escalation.'],['scenarioConflict','Two Representatives disagree publicly and the conversation becomes hostile. What do you do?','Describe how you de-escalate while preserving the discussion.'],['scenarioPublish','Someone asks you to publish an event before its committee review and release checks are complete. What do you do?','Explain your understanding of committee voting, approved drafts and publication safeguards.']]],
 ['safety','PRIVACY, SAFETY & ACCOUNTABILITY',[['confidentiality','A friend asks you for details from a private IA case or membership application. How do you respond?','Describe how access is limited and protected.'],['banDecision','How would you evaluate a Ban Report where facts are disputed and ticket access is temporarily held?','Include evidence, impartiality, timeliness, conflict checks and appeals.']]],
 ['team','SUPPORTING THE TEAM',[['support','How would you support Representatives without micromanaging them?','What does meaningful delegation look like?'],['feedback','How would you handle a Representative who feels you misused your authority?','Explain how you would respond to review or criticism.']]],
 ['commitment','PRACTICAL COMMITMENT',[['availability','What time can you realistically give to Coordinator duties?','Mention both in-person and online work.'],['training','What training or support would help you succeed?','Identify what you still want to learn.']]],
 ['statement','YOUR FINAL STATEMENT',[['vision','What should SELC look like in a year?','Describe a realistic vision connected to education and community.'],['final','Is there anything else the committee and Eros should consider?','Add anything important that has not been covered.']]]
];
async function coordinatorPage(){
 if(role()!=='representative'){setContent(pageHeader('LEADERSHIP ADVANCEMENT','Coordinator application','Only active SELC Representatives can apply.')+empty('This advancement is for Representatives','Join the committee first.'));return}
 const draftKey='selc.coord.draft.'+(context.me?.displayName||'user'),draft=JSON.parse(sessionStorage.getItem(draftKey)||'{}');let markup=pageHeader('LEADERSHIP ADVANCEMENT','Apply for Coordinator','A more detailed application for the responsibilities of operational leadership. Save your progress as you go; drafts remain on this device for this session.');
 markup+=card('<div class="hq-stats"><div class="hq-stat"><small>SECTIONS</small><strong>08</strong></div><div class="hq-stat"><small>COORDINATOR LIMIT</small><strong>02</strong></div></div><p>All active Representatives may apply. Candidates do not vote on themselves. Committee votes, eligibility checks, and recorded accepted roles are part of the selection process.</p>');
 markup+=card('<form id="coordForm" class="hq-form">'+COORDFIELDS.map(([id,title,fields],i)=>'<fieldset><legend>'+(i+1)+' / '+esc(title)+'</legend>'+fields.map(f=>textfield(f,draft[f[0]]||'',f[0]!=='final')).join('')+'</fieldset>').join('')+'<label class="checkline"><input type="checkbox" name="truthful" required> I understand the expectations of confidentiality, responsibility, and accurate reporting.</label><p data-status class="hq-form-status"></p><button class="hq-button primary" type="submit">Send my Coordinator application</button></form>');
 setContent(markup);const form=$('#coordForm');form.addEventListener('input',()=>{const values=formValues(form);delete values.truthful;sessionStorage.setItem(draftKey,JSON.stringify(values))});
 watchForm(form,async(values,form)=>{if(!values.truthful)throw new Error('Confirm the acknowledgment first.');const answers={...values};delete answers.truthful;if(answers.motivation.length<80||answers.experience.length<80)throw new Error('Expand your motivation and experience to at least 80 characters each.');await post('selc-governance','apply_coordinator',{answers});sessionStorage.removeItem(draftKey);flash('Coordinator application submitted to SELC leadership.');openPage('home')});
}
async function ballotsPage(){
 if(!leader()){setContent(empty('Committee access required'));return}
 const d=await api('selc-governance',{query:{scope:'ballots'}}),rows=d.ballots||[];
 const html=pageHeader('LEADERSHIP / ELECTIONS','Coordinator elections','Candidates sit out their own vote. Candidate votes are excluded from their own selection, and the result follows the recorded role process.')+(rows.length?rows.map(a=>card('<span class="hq-eyebrow">COORDINATOR CANDIDATE</span><h2>'+esc(a.name)+'</h2><p>'+esc(a.statement)+'</p><div class="hq-actions">'+btn('Support','data-ballot="'+esc(a.id)+'" data-vote="yes"','primary')+btn('Oppose','data-ballot="'+esc(a.id)+'" data-vote="no"')+btn('Abstain','data-ballot="'+esc(a.id)+'" data-vote="abstain"')+'</div>')).join(''):empty('No Coordinator elections are open','Applications and voting opportunities appear here when available.'));
 setContent(html);$$('[data-ballot]').forEach(b=>b.onclick=async()=>{if(!confirmDecision('Record your private vote? You can update it while voting remains open.'))return;try{await post('selc-governance','vote_coordinator',{id:b.dataset.ballot,vote:b.dataset.vote});flash('Your vote was recorded.')}catch(e){flash(e.message)}});
}

/* Applicant follow-ups are served by Portal for both SELC HQ and Member Portal. */
function attachFollowupDesk(dialog,record,kind){
 const host=document.createElement('section');host.className='hq-card';host.innerHTML='<h3>Clarifications & assigned learning</h3><p class="se-muted">Select the original answer to request clarification. Replies remain attached to the application. Course assignments appear in the applicant’s Portal.</p><div data-followup-list></div><form class="hq-form" data-followup-form><label>Application answer<select name="questionKey" required></select></label><label>Clarification question<textarea name="question" minlength="8" maxlength="3000" required></textarea></label><p data-status></p><button type="submit" class="hq-button primary">Send clarification request</button></form><form class="hq-form" data-course-form><label>Assign certification or course<select name="courseType" required></select></label><label>Reason or guidance<textarea name="reason" rows="2" maxlength="500"></textarea></label><p data-status></p><button class="hq-button" type="submit">Assign course</button></form>';
 const source=kind==='selc'?(record.answers||{}):record;
 const omit=new Set(['id','accountId','memberId','memberRecordId','createdAt','updatedAt','deletedAt','status','adminNotes','reviewNotes','rulesSecretWord','reviewAssist','applicationVersion','isTestAccount','applicationKind','reviewHistory']);
 const keys=Object.keys(source).filter(k=>!omit.has(k)&&!PRIVATE_APP_KEY.test(k)&&['string','number','boolean'].includes(typeof source[k])&&source[k]!==null);
 const select=host.querySelector('[name=questionKey]');select.innerHTML=keys.map(k=>'<option value="'+esc(k)+'">'+esc(readableLabel(k))+'</option>').join('');
 const course=host.querySelector('[name=courseType]');
 dialog.querySelector('.se-app-detail')?.append(host);
 if(!host.isConnected)dialog.append(host);
 const render=async()=>{
  const data=await api('application-followups',{query:{kind,id:record.id}});
  host.querySelector('[data-followup-list]').innerHTML=(data.followups||[]).length?data.followups.map(x=>'<div class="hq-row"><div class="grow"><strong>'+esc(x.questionLabel)+' · '+esc(x.status)+'</strong><p>'+esc(x.question)+'</p><p class="se-muted">Original: '+esc(x.originalAnswer)+'</p>'+(x.reply?'<p><strong>Applicant response:</strong> '+esc(x.reply)+'</p>':'')+'</div></div>').join(''):'<p class="se-muted">No clarification requests yet.</p>';
  course.innerHTML=(data.courses||[]).map(x=>'<option value="'+esc(x.type)+'">'+esc(x.label)+'</option>').join('');
 };
 render().catch(e=>{host.querySelector('[data-followup-list]').textContent=e.message});
 watchForm(host.querySelector('[data-followup-form]'),async values=>{
  await post('application-followups','request',{kind,id:record.id,questionKey:values.questionKey,questionLabel:readableLabel(values.questionKey),question:values.question});
  flash('Clarification sent to the applicant.');host.querySelector('[name=question]').value='';await render()
 });
 watchForm(host.querySelector('[data-course-form]'),async values=>{
  await post('application-followups','assign_course',{kind,id:record.id,courseType:values.courseType,reason:values.reason});
  flash('Certification assigned to the applicant’s Portal.');await render()
 });
}

async function applicationsPage(){
 if(!reviewer())return;
 const result=await api('selc-governance',{query:{scope:'applications'}}),rows=result.applications||[];
 setContent(pageHeader('LEADERSHIP / PRIVATE REVIEWS','SELC applications','Confidential application review for authorized Coordinators and designated administrators.')+
 (rows.length?rows.map(a=>card('<div class="hq-row"><div class="grow"><strong>'+esc(a.displayName)+' · '+(a.type==='coordinator'?'Coordinator advancement':a.type==='advisor'?'Advisor application':a.pendingRole==='advisor'?'Advisor offer from Representative application':'Representative application')+'</strong><p>'+esc(date(a.createdAt))+' · '+esc(a.id)+'</p></div>'+tag(a.status)+btn('Open','data-openapp="'+esc(a.id)+'"')+'</div>')).join(''):empty('No applications here','Applicants and their responses will appear when submitted.')));
 $$('[data-openapp]').forEach(b=>b.onclick=()=>{const a=rows.find(x=>x.id===b.dataset.openapp);if(!a)return;
 const answers=Object.entries(a.answers||{}).map(([k,v])=>'<div class="hq-row"><div class="grow"><strong>'+esc(k.replaceAll('_',' '))+'</strong><p class="hq-prose">'+esc(v)+'</p></div></div>').join('');
 const waiting=a.status==='Certification Pending',closed=['Approved','Declined'].includes(a.status);
 const actionButtons=closed?(owner()&&a.status==='Declined'&&['representative','advisor'].includes(a.type)?
  '<p class="hq-micro">Declined application · preserved history. Reopen it for another review or, for declined Representative applicants, offer Advisor certification.</p>'+btn('Reopen for review','data-action="reopen"','primary')+(a.type==='representative'?btn('Offer Advisor position','data-action="offer-advisor"'):''):
  '<p>'+esc(a.status==='Approved'?'Position active after certification.':'Application closed without role.')+'</p>'):owner()
  ?(waiting?'<p>Accepted; awaiting certification. No new committee privileges have been granted.</p>':btn('Mark under review','data-action="review"')+btn('Accept & assign certification','data-action="appoint"','primary'))+btn(waiting?'Withdraw acceptance':'Decline','data-action="decline"','danger')
  :(waiting?'<p>Founder acceptance recorded; certification pending.</p>':btn('Mark under review','data-action="review"')+btn('Recommend','data-action="recommend"','primary')+btn('Not recommended','data-action="not-recommended"'));
 const exceptionAvailable=owner()&&a.type==='coordinator'&&a.founderOverrideEligible===true&&!waiting&&!closed;
 const exceptionMarkup=exceptionAvailable?
   '<section class="hq-card"><h3>Early committee role exception</h3><p>There are '+number(a.eligibleVoters||0)+' other active eligible Representatives. Eros may authorize the Coordinator advancement while the committee is forming. Certification is still mandatory.</p>'+
   '<label class="checkline"><input type="checkbox" name="founderOverride"> Use the Founder exception instead of a successful vote</label>'+
   '<label>Reason (at least 20 characters)<textarea name="founderOverrideReason" rows="3" placeholder="Explain why a normal vote is not yet practical."></textarea></label></section>':
   (a.type==='coordinator'&&owner()&&!waiting&&!closed?'<p class="hq-micro">A successful Representative vote is required while two or more other eligible voters are active.</p>':'');
 const reviewMarkup='<p>'+tag(a.status)+' Submitted '+esc(date(a.createdAt))+'</p><div class="hq-card">'+answers+'</div>'+
  '<form class="hq-form" id="appReviewForm"><label>Notes for review</label><textarea name="notes" rows="4">'+esc(a.reviewNotes||'')+'</textarea>'+
  '<label>Public display name (optional)</label><input name="publicName" value="'+esc(a.displayName||'')+'">'+
  '<label class="checkline"><input type="checkbox" name="publicProfile" checked> List this person publicly (they can turn it off in My Account)</label>'+exceptionMarkup+
  '<div class="hq-actions">'+actionButtons+'</div><p data-status class="hq-form-status"></p></form>'+(a.reviewHistory?.length?'<section class="hq-card"><h3>Decision history</h3>'+a.reviewHistory.map(e=>'<p class="hq-micro">'+esc(date(e.at))+' · '+esc(e.action)+' · '+esc(e.reviewedBy||'SELC')+' — '+esc(e.notes||'')+'</p>').join('')+'</section>':'');
 const d=modal(a.displayName+' · '+a.type,reviewMarkup);
 attachFollowupDesk(d,a,'selc');
 $$('[data-action]',d).forEach(btnEl=>btnEl.onclick=async()=>{const vals=formValues($('#appReviewForm',d)),action=btnEl.dataset.action;try{
  if(action==='appoint'){const override=!!$('#appReviewForm input[name=founderOverride]',d)?.checked;if(override&&String(vals.founderOverrideReason||'').trim().length<20)throw new Error('Document the Founder exception with at least 20 characters.');if(!confirmDecision(override?'Record the Founder exception and assign certification?':'Accept this application and assign SELC certification? Role permissions activate after certification is completed.'))return;await post('selc-governance','appoint',{id:a.id,...vals,founderOverride:override,founderOverrideReason:override?vals.founderOverrideReason:'',publicProfile:!!$('#appReviewForm input[name=publicProfile]',d).checked})}
  else if(action==='decline')await post('selc-governance','decline',{id:a.id,notes:vals.notes});
  else if(action==='reopen'||action==='offer-advisor'){
   if(String(vals.notes||'').trim().length<15)throw new Error('Write at least 15 characters explaining the new decision.');
   if(!confirmDecision(action==='reopen'?'Reopen this previously declined SELC application?':'Offer this applicant an SELC Advisor role, pending a passing Advisor certification?'))return;
   await post('selc-governance',action==='reopen'?'reopen_application':'offer_advisor',{id:a.id,notes:vals.notes,publicProfile:!!$('#appReviewForm input[name=publicProfile]',d)?.checked});
  }
  else await post('selc-governance','review_application',{id:a.id,status:action==='review'?'Under Review':action==='recommend'?'Recommended':'Not Recommended',notes:vals.notes});
  d.close();flash(action==='appoint'?'Application accepted; certification assigned.':'Application updated.');applicationsPage()
 }catch(e){setStatus($('[data-status]',d),e.message)}});
 });
}
async function roleHandbookPage(){
 const selected=role()==='staff'?'staff':context.handbookRole||(role()==='founder'?'advisor':role());
 const payload=await api('selc-handbook',{query:{role:selected}}),book=payload.handbook||{},roles=payload.accessibleRoles||[role()];
 // Supplementary articles remain editable in their existing storage; only a single handbook page is exposed.
 const supplemental=committeeRole(role())?await api('leadership-library').catch(()=>null):null;
 const section=(item,index)=>'<details class="hq-handbook-section" '+(index===0?'open':'')+'><summary><span class="hq-handbook-number">'+String(index+1).padStart(2,'0')+'</span><strong>'+esc(item[0])+'</strong><span class="hq-handbook-chevron">⌄</span></summary><div class="hq-handbook-copy">'+esc(item[1])+'</div></details>';
 let markup=pageHeader('SELC / ROLE STANDARDS',role()==='staff'?'Staff Handbook':'SELC Handbook Center',book.overview||'Official role procedures and obligations.');
 markup+='<div class="hq-handbook-hero"><div><span class="hq-eyebrow">'+esc(book.eyebrow||'COMMITTEE OPERATIONS')+'</span><h2>'+esc(book.name||'Leadership')+' · Field Manual</h2><p>Version '+esc(payload.version)+' · Role handbook · Available for your role</p></div><span class="hq-handbook-emblem">SELC</span></div>';
 if(roles.length>1)markup+='<div class="hq-actions">'+roles.map(x=>btn(x.charAt(0).toUpperCase()+x.slice(1),'data-handbook-role="'+esc(x)+'"',x===selected?'primary':'')).join('')+'</div>';
 markup+='<div class="hq-handbook-layout"><div><h2 class="hq-handbook-heading">Position responsibilities</h2>'+(book.sections||[]).map(section).join('')+'</div><div><h2 class="hq-handbook-heading">Standards applying to every position</h2>'+(payload.shared||[]).map(section).join('')+'</div></div>';
 if(supplemental)markup+=await appendSupplementalGuides(supplemental);
 else if(committeeRole(role()))markup+=card('<h2>Supplemental resources temporarily unavailable</h2><p>The official manuals remain available above. Supplemental guide access can be retried later.</p>');
 markup+=card('<h2>Using this handbook</h2><p>Use this guide as a practical reference. Reach out to your team when you need clarification, and complete any required training before taking on specialist duties.</p>');
 setContent(markup);
 if(supplemental)bindSupplementalGuides(supplemental);
 $$('[data-handbook-role]').forEach(b=>b.onclick=()=>{context.handbookRole=b.dataset.handbookRole;roleHandbookPage().catch(failure)});
}
async function appendSupplementalGuides(data){
 const docs=data.articles||[];
 const guideList=docs.length?docs.map(row=>card('<div class="hq-row"><div class="grow"><span class="hq-eyebrow">'+esc(row.category)+' / '+esc(row.access)+'</span><h2>'+esc(row.title)+'</h2><p>'+esc(row.summary||'Open this guide to read more.')+'</p><p class="hq-micro">'+esc(row.updatedBy)+' · '+esc(date(row.updatedAt))+' · version '+esc(row.version)+'</p></div>'+tag(row.status)+btn('Read','data-guide="'+esc(row.id)+'"')+'</div>')).join(''):'<p class="hq-micro">No supplemental guides have been published yet. The official role manuals above are available now.</p>';
 return '<section class="hq-handbook-extras"><div class="hq-row"><div class="grow"><span class="hq-eyebrow">REFERENCE LIBRARY</span><h2>Additional procedures and resources</h2><p>Optional Staff, educator, and leadership guides. These are separate references, not another position handbook.</p></div>'+(data.canCreate?btn('Write a guide','data-write-guide','primary'):'')+'</div>'+guideList+'</section>';
}
function bindSupplementalGuides(data){
 const editor=(doc={})=>{
  const dlg=modal(doc.id?'Edit a handbook guide':'Write a handbook guide','<form id="guideForm" class="hq-form"><label>Title</label><input name="title" value="'+esc(doc.title||'')+'" required minlength="6"><label>Short summary</label><textarea name="summary" rows="2">'+esc(doc.summary||'')+'</textarea><div class="hq-form-grid"><div><label>Category</label><select name="category">'+(data.categories||[]).map(c=>'<option '+(c===doc.category?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select></div><div><label>Who may read this?</label><select name="access">'+['staff','selc','educator'].map(c=>'<option value="'+c+'" '+(c===(doc.access||'staff')?'selected':'')+'>'+esc(c.toUpperCase())+'</option>').join('')+'</select></div></div><label>Guide content</label><textarea name="body" rows="13" minlength="40" required>'+esc(doc.body||'')+'</textarea><label>Publishing status</label><select name="status"><option value="Draft" '+(doc.status==='Draft'?'selected':'')+'>Draft</option><option value="Published" '+(doc.status==='Published'?'selected':'')+'>Publish internally</option></select><label class="checkline"><input type="checkbox" name="official" '+(doc.official?'checked':'')+' '+(!owner()?'disabled':'')+'> Official organizational policy (Founder only)</label><p data-status class="hq-form-status"></p><button class="hq-button primary" type="submit">Save guide</button></form>');
  watchForm($('#guideForm',dlg),async vals=>{await post('leadership-library','save',{id:doc.id,...vals,official:!!$('#guideForm input[name=official]',dlg).checked});dlg.close();flash('Handbook guide saved.');await roleHandbookPage()});
 };
 $('[data-write-guide]')?.addEventListener('click',()=>editor());
 $$('[data-guide]').forEach(b=>b.onclick=async()=>{
  try{const d=await api('leadership-library',{query:{id:b.dataset.guide}}),doc=d.articles?.[0];if(!doc)return flash('Guide no longer available.');
   const dlg=modal(doc.title,'<p>'+tag(doc.status)+' '+esc(doc.category)+' · '+esc(doc.access)+'</p><p class="hq-prose" style="line-height:1.9">'+esc(doc.body)+'</p><p class="hq-micro">Updated '+esc(date(doc.updatedAt))+' by '+esc(doc.updatedBy)+'</p><div class="hq-actions">'+(doc.canEdit?btn('Edit guide','data-edit-guide','primary'):'')+'</div>');
   $('[data-edit-guide]',dlg)?.addEventListener('click',()=>{dlg.close();editor(doc)});
  }catch(error){flash(error.message)}
 });
}
async function leadershipWorkPage(){
 const data=await api('leadership-queue'),items=data.items||[],counts=data.counts||{},canDelegate=!!data.canDelegate,delegates=data.delegates||[];
 const categories={member:'Membership',role:'Role applications',selc:'SELC',ban:'Ban Reports',community:'Community'};
 let markup=pageHeader('SELC / LEADERSHIP','Leadership Action Center','Coordinators delegate and supervise; Representatives independently resolve eligible reviews. Every assignment is recorded in Portal.',btn('Refresh','data-work-refresh'));
 if(canDelegate)markup+=card('<p>Delegation is available for active SELC Representatives and Coordinators. Staff accepted roles remain separate, and assigned review work never grants additional enforcement authority.</p>');
 markup+='<div class="hq-stats">'+Object.entries(categories).filter(([k])=>counts[k]).map(([key,label])=>'<div class="hq-stat"><small>'+esc(label)+'</small><strong>'+number(counts[key]||0)+'</strong></div>').join('')+'</div>';
 markup+=items.length?Object.entries(categories).map(([kind,label])=>{
  const filtered=items.filter(x=>x.kind===kind);if(!filtered.length)return '';
  return card('<h2>'+esc(label)+' ('+filtered.length+')</h2>'+
   filtered.map(row=>{
    const mine=row.claim?.mine,claimed=row.claim&&!mine,route={member:'generalapps',role:'generalapps',selc:'applications',ban:'banreports',community:'requests'}[kind];
    return '<div class="hq-row"><div class="grow"><strong>'+esc(row.title)+' · '+esc(row.name)+'</strong><p>'+tag(row.status)+' '+esc(date(row.createdAt))+'</p>'+
      (row.dueAt?'<p class="hq-micro">Review target: '+esc(date(row.dueAt))+'</p>':'')+
      (row.claim?'<p class="hq-micro">'+(mine?'You claimed this review.':'Being reviewed by '+esc(row.claim.by))+ ' · until '+esc(date(row.claim.until))+'</p>':'<p class="hq-micro">Unassigned · available to claim</p>')+'</div><div class="hq-actions">'+
      (mine?btn('Release','data-queue-action="release" data-queue-kind="'+kind+'" data-queue-id="'+esc(row.id)+'"'):claimed?tag('Claimed'):btn('Claim','data-queue-action="claim" data-queue-kind="'+kind+'" data-queue-id="'+esc(row.id)+'"','primary'))+
      (canDelegate&&delegates.length?btn(claimed?'Reassign':'Delegate','data-queue-delegate="yes" data-queue-kind="'+kind+'" data-queue-id="'+esc(row.id)+'"'):'')+
      btn('Open','data-page-link="'+route+'"')+'</div></div>';
   }).join(''));
 }).join(''):empty('Everything is up to date','New applications, Ban Reports, and community conversations appear here when they need attention.');
 setContent(markup);bindPageLinks();$('[data-work-refresh]')?.addEventListener('click',leadershipWorkPage);
 $$('[data-queue-delegate]').forEach(button=>button.onclick=()=>{
  const kind=button.dataset.queueKind,id=button.dataset.queueId,row=items.find(item=>item.kind===kind&&item.id===id);
  if(!row)return;
  const options=delegates.map(m=>'<option value="'+esc(m.accountId)+'"'+(row.claim?.by===m.name?' selected':'')+'>'+esc(m.name)+' · '+esc(m.role==='coordinator'?'Coordinator':'Representative')+'</option>').join('');
  const dialog=modal('Delegate leadership review','<p>Assign <strong>'+esc(row.title)+'</strong> for <strong>'+esc(row.name)+'</strong> to an active SELC leader. The assignee may perform only actions already permitted by their own role.</p><form class="hq-form" id="delegateReview"><label>Assigned leader<select name="assigneeAccountId" required><option value="">Choose a leader</option>'+options+'</select></label><p class="hq-micro">Only Coordinators can reassign someone else’s work. Delegation does not permit Representatives to issue bans or approve advanced IA Staff accepted roles.</p><p data-status></p><button class="hq-button primary" type="submit">Save delegation</button></form>');
  watchForm($('#delegateReview',dialog),async(values)=>{
   await post('leadership-queue','delegate',{kind,id,assigneeAccountId:values.assigneeAccountId});
   dialog.close();flash('Leadership review delegated and recorded.');await leadershipWorkPage();
  });
 });
 $$('[data-queue-action]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{
  await post('leadership-queue',b.dataset.queueAction,{kind:b.dataset.queueKind,id:b.dataset.queueId});
  flash(b.dataset.queueAction==='claim'?'Review assigned to you.':'Review released.');
  await leadershipWorkPage();
 }catch(e){flash(e.message);b.disabled=false}});
}

async function leaderPage(){
 const data=await api('selc-governance',{query:{scope:'members'}}),people=(data.members||[]).sort((a,b)=>({coordinator:0,representative:1,advisor:2}[a.role]??3)-({coordinator:0,representative:1,advisor:2}[b.role]??3)||String(a.displayName||'').localeCompare(String(b.displayName||'')));
 let markup=pageHeader('THE PEOPLE BEHIND THE WORK','SELC leadership','Five Advisors, three Representatives and two Coordinators, plus Eros as Founder/Director. All three accepted leadership tiers may discuss and vote on committee proposals; action and approval permissions remain role-specific.');
 markup+='<div class="hq-stats"><div class="hq-stat"><small>REPRESENTATIVE SEATS</small><strong>'+people.filter(x=>x.role==='representative').length+' / 3</strong></div><div class="hq-stat"><small>COORDINATORS</small><strong>'+people.filter(x=>x.role==='coordinator').length+' / 2</strong></div><div class="hq-stat"><small>ADVISORS</small><strong>'+people.filter(x=>x.role==='advisor').length+' / 5</strong></div></div>';
 if(people.filter(x=>x.role==='representative').length>3)markup+=card('<h3>Representative transition</h3><p>The new standard capacity is three Representatives. Existing accepted roles above this number remain valid during a deliberate transition. No one is automatically demoted; new Representative accepted roles stay paused until a vacancy opens within the three-seat cap.</p>');
 markup+=card('<h2>Committee members and Advisors</h2>'+people.map(p=>'<div class="hq-row"><div class="grow"><strong>'+esc(p.displayName)+'</strong><p>'+(p.role==='advisor'?'Advisor · project and community participation':'Seat '+esc(p.seat)+' · '+esc(RANK[p.role]||p.role))+' · '+esc(p.availability?.status||'Available')+(p.availability?.until?' through '+esc(p.availability.until):'')+'</p></div>'+tag(p.role)+(owner()?btn('Remove','data-remove="'+esc(p.accountId)+'"','danger'):'')+'</div>').join(''));
 if(owner())markup+=card('<h2>Lead the role process</h2><p>Review and appoint Representatives or Coordinators from applications. Coordinator applications follow a documented selection process and committee voting where eligible.</p>'+btn('Review SELC applications','data-page-link="applications"','primary'));
 setContent(markup);bindPageLinks();$$('[data-remove]').forEach(b=>b.onclick=async()=>{if(!confirmDecision('Remove this SELC leadership role? Their regular membership remains separate.'))return;try{await post('selc-governance','remove',{accountId:b.dataset.remove});flash('Leadership role ended.');leaderPage()}catch(e){flash(e.message)}});
}
async function proposalPage(){
 const [d,team]=await Promise.all([api('selc-governance',{query:{scope:'proposals'}}),api('selc-governance',{query:{scope:'members'}}).catch(()=>({members:[]}))]),rows=d.proposals||[],members=team.members||[];
 const actions=btn('Bring an idea forward','data-new-proposal','primary');
 let markup=pageHeader('COMMITTEE WORK','Discuss, decide, improve','From workshops and venue improvements to pricing and event ideas—every proposal deserves a real discussion.',actions);
 markup+=rows.length?rows.map(p=>card('<div class="hq-row"><div class="grow"><span class="hq-eyebrow">'+esc((p.category||'').replaceAll('_',' '))+'</span><h2>'+esc(p.title)+'</h2><p>'+esc(p.description||'').slice(0,210)+'</p><p class="hq-micro">Started by '+esc(p.createdBy)+' · '+esc(date(p.createdAt))+' · '+(p.comments?.length||0)+' replies</p></div>'+tag(p.status)+btn('Discuss','data-proposal="'+esc(p.id)+'"')+'</div>')).join(''):empty('No ideas on the table yet','Start a proposal, invite perspectives, and move it toward a decision.');
 setContent(markup);
 $('[data-new-proposal]').onclick=()=>{
  const d=modal('Bring an idea forward','<form class="hq-form" id="newProposal"><label>What is your idea called?</label><input name="title" required minlength="8" placeholder="Give it a clear name"><label>Area of community life</label><select name="category"><option value="education">Education & workshops</option><option value="events">Events & socials</option><option value="equipment">Equipment</option><option value="work_sessions">Venue work sessions</option><option value="rules">Rules & expectations</option><option value="pricing">Pricing & admission</option><option value="outreach">Community outreach</option><option value="community">Community initiatives</option><option value="accessibility">Accessibility</option><option value="other">Something else</option></select><label>What should happen and why?</label><textarea name="description" required rows="6" minlength="40"></textarea><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Start discussion</button></form>');
  watchForm($('#newProposal',d),async vals=>{await post('selc-governance','create_proposal',vals);d.close();flash('Proposal added for discussion.');proposalPage()})
 };
 $$('[data-proposal]').forEach(b=>b.onclick=()=>{const p=rows.find(x=>x.id===b.dataset.proposal);if(!p)return;
  const voteSummary=p.voteSummary||{},tally={yes:voteSummary.yes||0,no:voteSummary.no||0,abstain:voteSummary.abstain||0};
  const canVote=participantRole(role()),canTrack=reviewer()&&['Chair Approved','In Progress','Blocked','Completed'].includes(p.status);
  const d=modal(p.title,'<p class="hq-eyebrow">'+esc(p.category||'')+' / '+esc(p.status)+'</p><p class="hq-prose">'+esc(p.description)+'</p><p>Committee votes: '+number(tally.yes)+' support · '+number(tally.no)+' oppose · '+number(tally.abstain)+' abstain</p><p class="hq-micro">'+number(voteSummary.participating||0)+' of '+number(voteSummary.eligible||0)+' eligible · quorum '+number(voteSummary.quorumNeeded||0)+' · '+(voteSummary.passed?'Majority reached':voteSummary.quorumMet?'Awaiting majority':'Awaiting quorum')+'</p><div class="hq-actions">'+(canVote&&p.status==='Discussion'?btn('Support','data-pvote="yes"','primary')+btn('Oppose','data-pvote="no"')+btn('Abstain','data-pvote="abstain"'):'<p class="hq-micro">'+(advisor()?'Advisors may comment on this proposal, but its vote is reserved for Representatives and Coordinators.':'Voting is closed.')+'</p>')+'</div><hr style="border:0;border-top:1px solid #545058;margin:18px 0"><h3>Discussion ('+(p.comments?.length||0)+')</h3><div class="hq-panel-list">'+(p.comments||[]).map(m=>'<div class="hq-row"><div class="grow"><strong>'+esc(m.from)+'</strong><p class="hq-prose">'+esc(m.message)+'</p><p class="hq-micro">'+esc(date(m.at))+'</p></div></div>').join('')+'</div><form class="hq-form" id="commentProposal"><label>Add your perspective</label><textarea name="message" required></textarea><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Add comment</button></form>'+(owner()&&p.status==='Discussion'?'<h3>Decision</h3><div class="hq-actions">'+btn('Approve proposal','data-chair="approved"','primary')+btn('Return for changes','data-chair="returned"')+btn('Decline','data-chair="declined"','danger')+'</div>':''));
  if(canTrack){
    const options=['Not Started','In Progress','Blocked','Completed'];
    const section=document.createElement('section');
    section.className='hq-card';
    section.innerHTML='<h3>Implementation tracking</h3><form class="hq-form" id="implementationForm">'+
      '<label>Responsible member<select name="assigneeId"><option value="">Unassigned</option><option value="owner"'+(p.implementationAssigneeId==='owner'?' selected':'')+'>Eros</option>'+members.map(m=>'<option value="'+esc(m.accountId)+'"'+(p.implementationAssigneeId===m.accountId?' selected':'')+'>'+esc(m.displayName||m.screenName||'SELC Member')+'</option>').join('')+'</select></label>'+
      '<label>Status<select name="implementationStatus">'+options.map(x=>'<option value="'+esc(x)+'"'+((p.implementationStatus||'Not Started')===x?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>'+
      '<label>Due date<input type="date" name="dueAt" value="'+esc(p.implementationDueAt||'')+'"></label>'+
      '<label>Notes<textarea name="notes" rows="4">'+esc(p.implementationNotes||'')+'</textarea></label><p data-status></p><button class="hq-button primary" type="submit">Save implementation</button></form>';
    d.appendChild(section);
    watchForm(d.querySelector('#implementationForm'),async values=>{await post('selc-governance','track_proposal',{id:p.id,...values});d.close();flash('Implementation updated.');proposalPage()});
  }
  $$('[data-pvote]',d).forEach(x=>x.onclick=async()=>{try{await post('selc-governance','vote_proposal',{id:p.id,vote:x.dataset.pvote});flash('Vote recorded.');d.close();proposalPage()}catch(e){flash(e.message)}});
  watchForm($('#commentProposal',d),async vals=>{await post('selc-governance','comment_proposal',{id:p.id,message:vals.message});d.close();proposalPage()});
  $$('[data-chair]',d).forEach(x=>x.onclick=async()=>{const reason=prompt('Give a reason or brief summary for this decision:')||'';if(!reason)return;try{await post('selc-governance','decide_proposal',{id:p.id,decision:x.dataset.chair,reason});d.close();proposalPage()}catch(e){flash(e.message)}});
 });
}
async function educatorApplicationPage(){
 const d=await api('educator-applications'),mine=d.mine||[];
 const questions=[
  ['motivation','Why do you want to educate others through Sanctum Eros?','What you hope participants gain, what good teaching looks like to you, and your approach to responsibility.'],
  ['topics','What kink or BDSM subjects would you teach?','Specific topics, practical skills, discussions, or demonstrations.'],
  ['experience','Tell us about your lived and practical experience.','Include relevant scene practice, instruction, mentorship, or other learning. A formal credential is not required.'],
  ['teaching','How would you structure a class and support beginners?','Your approach to questions, demonstrations, checking comprehension, and boundaries.'],
  ['safety','How do you teach consent, negotiation, risk awareness, and aftercare?','Explain what you would cover, when you would stop a demo, and how you manage uncertainty.'],
  ['accessibility','How will you make learning accessible to different people?','Consider disabilities, varied experience, language, sensory needs, and nonparticipation.'],
  ['format','Preferred formats (optional)','Discussion, online seminar, demonstration, hands-on workshop, or mentoring.'],
  ['availability','Availability and support needs (optional)','Your schedule, supplies, training, or a mentor you may need.']
 ];
 let markup=pageHeader('LEARN / TEACH / SHARE','Become a Community Educator','Teaching is a community contribution, not a title to collect. SELC reviews educator applications. Educator acceptance and individual workshop approval are separate.');
 if(mine.length)markup+=card('<h2>Your application history</h2>'+mine.map(x=>'<div class="hq-row"><div class="grow"><strong>'+esc(x.status)+'</strong><p>Submitted '+esc(date(x.submittedAt))+'</p><p>'+esc(x.notes||'Your application is with the committee.')+'</p></div></div>').join(''));
 if(!mine.some(x=>!['Declined','Withdrawn'].includes(x.status))){
  markup+=card('<h2>Community Educator application</h2><p>Be specific. We value actual experience, willingness to learn, strong consent practices, and the ability to teach without gatekeeping.</p><form id="educatorApplication" class="hq-form">'+questions.map(([key,label,hint])=>'<label>'+esc(label)+'</label><p class="hq-muted">'+esc(hint)+'</p><textarea name="'+key+'" rows="'+(['motivation','safety','teaching'].includes(key)?5:3)+'" '+(['format','availability'].includes(key)?'':'required')+'></textarea>').join('')+'<label class="hq-checkbox"><input type="checkbox" name="acknowledge" value="true" required> I agree to follow the venue’s consent, safety, privacy, and educational standards and understand that submitting does not grant permission to teach.</label><p data-status></p><button class="hq-button primary" type="submit">Submit to SELC</button></form>');
 }
 setContent(markup);
 const form=$('#educatorApplication');if(form)watchForm(form,async values=>{values.acknowledge=values.acknowledge==='true';await post('educator-applications','apply',values);flash('Your educator application was submitted.');educatorApplicationPage()});
}
async function educatorReviewsPage(){
 const d=await api('educator-applications'),rows=d.review||[];
 let markup=pageHeader('EDUCATION / LEADERSHIP','Educator applications','SELC Coordinators assess teaching experience, consent literacy, accessibility, and readiness. Only Eros may approve a Community Educator role.');
 markup+=rows.length?rows.map(x=>card('<div class="hq-row"><div class="grow"><h2>'+esc(x.applicantName)+'</h2><p>Topics: '+esc(x.topics)+'</p><p>Experience: '+esc(x.experience)+'</p><p>Approach: '+esc(x.teaching)+'</p><p>Consent & safety: '+esc(x.safety)+'</p><p>Accessibility: '+esc(x.accessibility)+'</p></div>'+tag(x.status)+btn('Record review','data-educator-review="'+esc(x.id)+'"')+'</div>')).join(''):empty('No educator applications to review','Applications submitted by Portal members appear here.');
 setContent(markup);
 $$('[data-educator-review]').forEach(b=>b.onclick=()=>{const x=rows.find(r=>r.id===b.dataset.educatorReview);if(!x)return;const dlg=modal('Community Educator · '+x.applicantName,'<form id="educatorReviewForm" class="hq-form"><label>Review decision</label><select name="status"><option>Changes Requested</option><option>Recommended</option><option>Declined</option>'+(owner()?'<option>Approved</option>':'')+'</select><label>Reasoning and next steps</label><textarea name="notes" rows="5" required minlength="20"></textarea><p data-status></p><button class="hq-button primary" type="submit">Save review</button></form>');attachFollowupDesk(dlg,x,'educator');watchForm($('#educatorReviewForm',dlg),async values=>{await post('educator-applications','review',{id:x.id,...values});dlg.close();flash('Educator review saved.');educatorReviewsPage()})});
}

function openSEEducationTeacherMaterials(courseId){
 if(!courseId){flash('No SE Education course is linked to this event.');return}
 const path='/teacher-materials.html?course='+encodeURIComponent(courseId);
 window.location.assign(path);
}

async function educationProgramsPage(){
 const [data,catalog,prepared]=await Promise.all([api('education-programs'),api('se-education-courses',{query:{mode:'catalog'}}).catch(()=>({courses:[],unavailable:true})),owner()?api('se-education-courses',{query:{mode:'prepared'}}).catch(()=>({courses:[]})):Promise.resolve({courses:[]})]),plans=data.plans||[];
 const byId=new Map();for(const x of prepared.courses||[])byId.set(x.id,x);for(const x of catalog.courses||[])byId.set(x.id,x);
 const courses=[...byId.values()].sort((a,b)=>String(a.title).localeCompare(String(b.title)));
 let markup=pageHeader('LEARN / TEACH / SHARE','Community Education Program','Work with educators to shape practical workshops. No class becomes a published event until Eros approves its scheduling.',btn('Education conversations','data-page-link="requests"'));
 markup+='<div class="hq-stats">'+[['WORKSHOP IDEAS',plans.length],['UNDER SELC REVIEW',plans.filter(p=>p.status==='SELC Review').length],['AWAITING FOUNDER',plans.filter(p=>p.status==='Ready for Founder').length],['APPROVED TO SCHEDULE',plans.filter(p=>p.status==='Approved for Scheduling').length]].map(([label,n])=>'<div class="hq-stat"><small>'+label+'</small><strong>'+number(n)+'</strong></div>').join('')+'</div>';
 markup+=plans.length?plans.map(p=>card('<div class="hq-row"><div class="grow"><span class="hq-eyebrow">'+esc(p.educatorName||'Community Educator')+'</span><h2>'+esc(p.title)+'</h2><p>'+esc(p.summary||p.objectives||'Workshop proposal')+'</p><p class="hq-micro">Updated '+esc(date(p.updatedAt))+'</p></div>'+tag(p.status)+btn('Review plan','data-edu-plan="'+esc(p.requestId)+'"')+'</div>')).join(''):empty('Start building your education calendar','Educators can propose workshops in their Member Portal. Approved plans appear here for review, mentoring, and scheduling.');
 markup+='<div class="hq-section"><div class="hq-row"><div class="grow"><h2>SE Education Class Library</h2><p>Full lessons, quizzes and instructor guides for linked Workshop events. Publishing requires Founder approval.</p></div><a class="hq-button" href="https://sanctumportal.org/se-education-studio.html">Open visual Classroom Builder</a>'+(owner()?btn('Load 12 prepared drafts','data-edu-import="1"'):'')+'</div></div>';
 markup+=(catalog.unavailable&&!courses.length)?card('<p>The live class catalog is unavailable. No prepared courses could be retrieved for this account.</p>'):courses.length?courses.map(x=>card('<div class="hq-row"><div class="grow"><span class="hq-eyebrow">'+esc(x.level||'Workshop')+' · '+esc(x.duration||'')+'</span><h2>'+esc(x.title)+'</h2><p>'+esc(x.summary||'')+'</p><p class="hq-micro">'+esc(x.resourceCount||0)+' lesson modules · Version '+esc(x.version||0)+'</p></div>'+tag(x.status||'Development')+btn('Teacher materials','data-edu-preview="'+esc(x.id)+'"')+btn('Open curriculum','data-se-course="'+esc(x.id)+'"')+'</div>')).join(''):empty('No class records imported yet','The founder can import the prepared drafts. Approved educators can then build out lessons through the Classroom Builder.');
 setContent(markup);bindPageLinks();
 $('[data-edu-import]')?.addEventListener('click',async()=>{
  if(!(await confirmDecision('Load the twelve prepared classes as unpublished drafts? Existing courses will not be overwritten.')))return;
  try{const r=await post('se-education-courses','import_prepared',{});flash('Imported '+(r.added||[]).length+' courses; '+(r.skipped||[]).length+' already existed.');educationProgramsPage()}catch(e){flash(e.message)}
 });
 $$('[data-edu-preview]').forEach(b=>b.onclick=()=>openSEEducationTeacherMaterials(b.dataset.eduPreview));
 $$('[data-se-course]').forEach(b=>b.onclick=()=>openSEEducationTeacherMaterials(b.dataset.seCourse));
 $$('[data-edu-plan]').forEach(b=>b.onclick=()=>{
  const p=plans.find(x=>x.requestId===b.dataset.eduPlan);if(!p)return;
  const body='<p>'+tag(p.status)+' · '+esc(p.educatorName||'Educator')+'</p><h3>Learning objectives</h3><p class="hq-prose">'+esc(p.objectives||'To be developed')+'</p><h3>Course outline</h3><p class="hq-prose">'+esc(p.outline||'To be developed')+'</p><h3>Consent and safety</h3><p class="hq-prose">'+esc(p.consentSafety||'To be developed')+'</p><h3>Equipment & accessibility</h3><p class="hq-prose">'+esc(p.equipment||'Not specified')+'</p><p class="hq-prose">'+esc(p.accessibility||'Not specified')+'</p><h3>Mentorship and notes</h3><p class="hq-prose">'+esc(p.mentorRequest||'No mentor requested')+'</p>'+(p.notes||[]).map(n=>'<div class="hq-row"><div class="grow"><strong>'+esc(n.by)+'</strong><p class="hq-prose">'+esc(n.text)+'</p></div></div>').join('')+
  '<form class="hq-form" id="eduReview"><label>Review outcome</label><select name="status"><option value="Development">Keep in development</option><option value="Changes Requested">Request changes</option><option value="Ready for Founder">Ready for Founder review</option></select><label>Notes for the educator</label><textarea name="note" minlength="15" required rows="4"></textarea><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Send review</button></form>'+
  (owner()?'<form class="hq-form" id="eduFounder"><h3>Founder decision</h3><label>Decision</label><select name="decision"><option value="approve">Approve for scheduling</option><option value="return">Return for revision</option><option value="decline">Decline proposal</option><option value="complete">Mark completed after the workshop</option></select><label>Reason</label><textarea name="note" minlength="15" required></textarea><p data-status class="hq-form-status"></p><button class="hq-button primary" type="submit">Record decision</button></form>':'');
  const dlg=modal(p.title,body);
  watchForm($('#eduReview',dlg),async vals=>{await post('education-programs','review',{requestId:p.requestId,...vals});dlg.close();flash('Workshop review saved.');educationProgramsPage()});
  watchForm($('#eduFounder',dlg),async vals=>{if(!confirmDecision('Record the Founder decision? This does not automatically publish an event.'))return;await post('education-programs','decision',{requestId:p.requestId,...vals});dlg.close();flash('Education decision recorded.');educationProgramsPage()});
 });
}

async function requestsPage(filter='all'){
 const d=await api('community-requests'),rows=(d.requests||[]).filter(r=>filter==='education'?r.kind?.startsWith('educator_')||r.kind==='member_class_request':true);
 const title=filter==='education'?'Education & workshops':'Community conversations';
 let markup=pageHeader(filter==='education'?'EDUCATION IN ACTION':'WORKING TOGETHER',title,filter==='education'?'Build workshops and learning experiences with Community Educators. Review class ideas, supplies, and support needs.':'Staff, educators, and committee members can stay in conversation here.',btn(filter==='education'?'Propose a workshop':'Start a conversation','data-newrequest','primary'));
 markup+=rows.length?rows.map(r=>card('<div class="hq-row"><div class="grow"><span class="hq-eyebrow">'+esc((r.kind||'').replaceAll('_',' '))+'</span><h2>'+esc(r.title)+'</h2><p>'+esc(r.details||'').slice(0,220)+'</p><p class="hq-micro">'+esc(r.submittedBy)+' · '+esc(date(r.updatedAt))+'</p></div>'+tag(r.status)+btn('Open','data-openrequest="'+esc(r.id)+'"')+'</div>')).join(''):empty('Nothing waiting here','Once someone sends an idea, request, or question, it will be easy to follow up.');
 setContent(markup);
 $('[data-newrequest]').onclick=()=>{const dialog=modal('Start a conversation','<form class="hq-form" id="requestForm"><label>What is this about?</label><select name="kind"><option value="educator_class">Propose a class or workshop</option><option value="educator_resources">Request teaching equipment or supplies</option><option value="educator_support">Ask for teaching support</option><option value="staff_message">Reach the committee</option><option value="event_support">Help with an event</option><option value="equipment">Equipment proposal</option><option value="venue_work">Venue project</option><option value="member_class_request">Request a class topic</option><option value="general">Something else</option></select><label>Subject</label><input name="title" required minlength="6"><label>Tell us what you have in mind</label><textarea name="details" required minlength="20" rows="6"></textarea><label>Resources, supplies or support needed</label><textarea name="needs" rows="3"></textarea><label>Preferred date (optional)</label><input name="requestedDate" type="date"><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Send to SELC</button></form>');
  watchForm($('#requestForm',dialog),async values=>{await post('community-requests','create',values);dialog.close();flash('Request received by the committee.');requestsPage(filter)})
 };
 $$('[data-openrequest]').forEach(b=>b.onclick=()=>{const r=rows.find(x=>x.id===b.dataset.openrequest);if(!r)return;
  const dialog=modal(r.title,'<p>'+tag(r.status)+' · '+esc(r.submittedBy)+'</p><p class="hq-prose">'+esc(r.details)+'</p>'+(r.needs?'<h3>What they need</h3><p class="hq-prose">'+esc(r.needs)+'</p>':'')+'<h3>Conversation</h3><div class="hq-panel-list">'+(r.messages||[]).map(m=>'<div class="hq-row"><div class="grow"><strong>'+esc(m.by)+'</strong><p class="hq-prose">'+esc(m.message)+'</p><small>'+esc(date(m.at))+'</small></div></div>').join('')+'</div><form class="hq-form" id="replyForm"><label>Write a reply</label><textarea name="message" required rows="3"></textarea><p data-status class="hq-form-status"></p><button class="hq-button primary" type="submit">Send reply</button></form><h3>Share a file</h3><input type="file" id="attachInput" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"><button class="hq-button" id="attachSend" type="button">Upload file (3 MB max)</button><div id="requestFiles">'+(r.attachments||[]).map(a=>'<div class="hq-row"><div class="grow"><strong>'+esc(a.name)+'</strong></div>'+btn('Download','data-download="'+esc(a.id)+'"')+'</div>').join('')+'</div><hr style="border:0;border-top:1px solid #555;margin:16px 0"><label class="hq-muted">Request status</label><div class="hq-actions">'+['In Conversation','Planning','Awaiting Chair','Completed','Declined','Closed'].map(x=>btn(x,'data-rstatus="'+esc(x)+'"')).join('')+'</div>');
  watchForm($('#replyForm',dialog),async data=>{await post('community-requests','reply',{id:r.id,message:data.message});dialog.close();requestsPage(filter)});
  $('#attachSend',dialog).onclick=async()=>{const file=$('#attachInput',dialog).files[0];if(!file)return flash('Choose a file first.');if(file.size>3*1024*1024)return flash('Attachments must be smaller than 3 MB.');const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});try{await post('community-requests','attach',{id:r.id,file:{name:file.name,type:file.type,data:encoded}});dialog.close();requestsPage(filter)}catch(error){flash(error.message)}};
  $$('[data-download]',dialog).forEach(b=>b.onclick=async()=>{const a=(r.attachments||[]).find(x=>x.id===b.dataset.download);try{const url=FN+'community-requests?id='+encodeURIComponent(r.id)+'&attachment='+encodeURIComponent(b.dataset.download);const response=await fetch(url,{headers:{Authorization:'Bearer '+context.token},credentials:'omit'});if(!response.ok)throw new Error('Unable to open attachment.');const blob=await response.blob(),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=a?.name||'attachment';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)}catch(e){flash(e.message)}});
  $$('[data-rstatus]',dialog).forEach(b=>b.onclick=async()=>{try{await post('community-requests','update',{id:r.id,status:b.dataset.rstatus});dialog.close();requestsPage(filter)}catch(e){flash(e.message)}});
 });
}

const APP_LABELS={name:'Name',preferredName:'Preferred name',fetlife:'FetLife username',loginEmail:'Email',generalArea:'General area',about:'About the applicant',experience:'Experience',limits:'Limits and boundaries',whyJoin:'Why they want to join',communityConflict:'Handling community conflict',reviewAssist:'Review assistance',adminNotes:'Internal notes',eventTitle:'Event',requestType:'Request type',createdAt:'Submitted',updatedAt:'Updated'};
const PRIVATE_APP_KEY=/password|hash|salt|secret|token|securityAnswer|authorization|credential|session|twoFactor|recoveryCode/i;
function readableLabel(k){return APP_LABELS[k]||String(k).replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_-]/g,' ').replace(/^./,c=>c.toUpperCase())}
function assistSummary(raw){
 if(!raw)return '';
 let a=raw;
 if(typeof a==='string'){try{a=JSON.parse(a)}catch{return '<section class="se-review-assist"><h3>Review assistance</h3><p>'+esc(a)+'</p></section>'}}
 if(!a||typeof a!=='object')return '';
 const parts=[['Consent',a.consent],['Accountability',a.accountability],['Conduct and boundaries',a.conduct]].filter(([,v])=>v&&typeof v==='object'&&v.excerpt);
 return '<section class="se-review-assist"><div class="se-section-head"><h3>Review assistance</h3><span>Supporting information only</span></div><p class="se-muted">This is not an approval, denial, or safety determination. Read the complete answers before deciding.</p>'+
 (parts.length?'<div class="se-review-grid">'+parts.map(([name,v])=>'<article><strong>'+esc(name)+'</strong><p>'+esc(v.excerpt)+'</p></article>').join('')+'</div>':'')+
 (Array.isArray(a.flags)&&a.flags.length?'<p><strong>Review flags:</strong> '+esc(a.flags.join(' · '))+'</p>':'')+
 (Array.isArray(a.notes)&&a.notes.length?'<p class="se-muted">'+esc(a.notes.join(' '))+'</p>':'')+'</section>';
}

const MEMBER_QUESTION_ORDER=[
['name','Name'],['age','Age'],['fetlife','FetLife username'],['loginEmail','Email'],['couple','Couple application'],['partner','Partner name'],['partnerAge','Partner age'],['partnerFetlife','Partner FetLife'],['partnerEmail','Partner email'],
['contact','Contact information'],['generalArea','General area'],['referralSource','How did you hear about us?'],['hasCommunityReference','Do you have a community reference?'],['communityReferenceName','Reference name'],['communityReferenceRelationship','Relationship to reference'],['communityReferenceContact','Reference contact'],['communityReferenceContactPermission','Permission to contact reference'],
['experience','Describe your experience'],['communityHistory','Community involvement and history'],['expectations','What do you expect from Sanctum Eros?'],
['consentUnderstanding','What does consent mean to you?'],['freezeResponse','How would you respond if someone froze?'],['boundaryAccountability','How do you take accountability for a boundary violation?'],['rejectionBoundaryResponse','How would you respond when someone says no?'],['observedBoundaryResponse','What would you do if you witnessed a boundary violation?'],['privacyResponse','How do you protect member privacy?'],['communityConductResponse','How do you handle community conduct concerns?'],['safetyJudgment','How do you approach safety?'],
['rulesCheck','Venue rules knowledge'],['priorVenueAction','Prior venue or organization actions'],['priorVenueActionDetails','Details of prior actions'],['priorSexCharge','Disclosed sexual offenses or charges'],['priorSexChargeDetails','Details disclosed'],['priorSeriousComplaint','Disclosed serious complaints'],['priorSeriousComplaintDetails','Complaint details'],['priorProtectiveOrder','Disclosed protective orders'],['priorProtectiveOrderDetails','Protective order details'],['safetyDisclosures','Other safety disclosures'],['acknowledgements','Applicant acknowledgements']];
const APP_ADMIN_ONLY=new Set(['id','deletedAt','isTestAccount','reviewAssist','applicationVersion','createdAt','updatedAt','accountId','memberId','coupleRelationshipId','linkedPartnerMemberId','attendanceCategorySource','attendanceCategorySelectedAt','legacyAttendanceQuestionRequired','accessStatus','status','adminNotes','attendanceCategory','rulesSecretWord','notificationEmail','emailNotificationsOptIn','loginType','hasFetlife','rulesCheckPassed']);
function applicationValue(value){
 if(value===null||value===undefined||value==='')return '<em class="se-unanswered">No answer recorded</em>';
 if(typeof value==='boolean')return '<p>'+(value?'Yes':'No')+'</p>';
 if(Array.isArray(value))return value.length?value.map(v=>applicationValue(v)).join(''):'<em class="se-unanswered">No answer recorded</em>';
 if(typeof value==='object')return '<div class="se-nested-answers">'+Object.entries(value).filter(([k])=>!PRIVATE_APP_KEY.test(k)).map(([key,v])=>'<div><strong>'+esc(readableLabel(key))+'</strong>'+applicationValue(v)+'</div>').join('')+'</div>';
 return '<p>'+esc(value)+'</p>';
}
function applicationDetails(record){
 const source=record||{},membership=('applicationVersion' in source)||('consentUnderstanding' in source)||('boundaryAccountability' in source);
 const ordered=membership?MEMBER_QUESTION_ORDER:[];
 const listed=new Set(ordered.map(([key])=>key));
 const extra=Object.keys(source).filter(key=>!listed.has(key)&&!APP_ADMIN_ONLY.has(key)&&!PRIVATE_APP_KEY.test(key)).map(key=>[key,readableLabel(key)]);
 const questions=ordered.concat(extra).filter(([key])=>!PRIVATE_APP_KEY.test(key)&&key!=='rulesSecretWord'&&(!(key.startsWith('partner')&&source.couple!=='Yes')||source[key]!==undefined&&source[key]!==null&&source[key]!==''));
 const markup=questions.map(([key,label],index)=>'<article class="se-question-answer"><div class="se-question-heading"><span>'+String(index+1).padStart(2,'0')+'</span><h3>'+esc(label)+'</h3></div><div class="se-question-response">'+applicationValue(source[key])+'</div></article>').join('');
 const facts=[['Application version',source.applicationVersion],['Submitted',source.createdAt?date(source.createdAt):''],['Status',source.status]].filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>'<span><strong>'+esc(k)+':</strong> '+esc(v)+'</span>').join('');
 return '<div class="se-full-application"><h3>Complete application responses</h3><p class="se-muted">Full recorded answers appear below, without abbreviating or rewriting the applicant’s words. Unanswered fields are indicated.</p><div class="se-application-facts">'+facts+'</div><div class="se-complete-answers">'+markup+'</div></div>'+assistSummary(source.reviewAssist);
}
function membershipDashboard(members){
 const count=status=>members.filter(m=>String(m.status||'').toLowerCase()===status).length;
 const flagged=members.filter(m=>/ban|restrict|re-vett/i.test(String(m.accessStatus||''))).length;
 return '<div class="se-metrics">'+[['Member records',members.length],['Approved',count('approved')],['Pending',count('pending')],['Access concerns',flagged]].map(([l,n])=>'<div><strong>'+number(n)+'</strong><span>'+esc(l)+'</span></div>').join('')+'</div>';
}
async function memberRegistryPage(){
 if(!leader())return openPage('home');
 const result=await api('members'),members=(Array.isArray(result.members)?result.members:[]).filter(m=>m&&!m.deletedAt&&!m.isTestAccount);
 let search='',status='All',access='All';
 const statuses=['All','approved','pending','denied'],accessLevels=['All','Active','Restricted','Temp-Banned','Banned','Inactive','Re-vetting Required'];
 let html=pageHeader('SELC / MEMBERSHIP','Member management','Review member records and permitted corrections. Portal remains the authoritative membership database.',btn('Review applications','data-page-link="generalapps"','primary'));
 html+='<section class="se-membership">'+membershipDashboard(members)+'<div class="se-work-panel"><div class="se-section-head"><div><h2>Member directory</h2><p class="se-muted">Confidential records · Activity is subject to role-based authorization</p></div></div><div class="se-filters"><label>Search<input id="registrySearch" type="search" placeholder="Name, FetLife, email or member ID"></label><label>Membership<select id="registryStatus">'+statuses.map(v=>'<option value="'+esc(v)+'">'+esc(v==='All'?'All statuses':v)+'</option>').join('')+'</select></label><label>Venue access<select id="registryAccess">'+accessLevels.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('')+'</select></label></div><div id="registryResults" aria-live="polite"></div></div></section>';
 setContent(html);bindPageLinks();
 const render=()=>{
  const selected=members.filter(m=>(status==='All'||String(m.status||'').toLowerCase()===status)&&(access==='All'||String(m.accessStatus||'Active').toLowerCase()===access.toLowerCase())&&(!search||[m.memberId,m.name,m.preferredName,m.fetlife,m.loginEmail].some(v=>String(v||'').toLowerCase().includes(search))));
  const target=$('#registryResults');
  target.innerHTML='<p class="se-muted">'+selected.length+' matching records'+(selected.length>150?' · Showing first 150':'')+'</p>'+(selected.length?'<div class="se-directory">'+selected.slice(0,150).map(m=>'<article class="se-member-row"><div class="se-avatar">'+esc(initials(m.preferredName||m.name))+'</div><div class="se-member-main"><strong>'+esc(m.preferredName||m.name||'Member')+'</strong><span>'+esc(m.memberId||'No member number')+' · '+esc(m.fetlife?'@'+m.fetlife:(m.loginEmail||'No username'))+'</span><div>'+tag(m.status)+tag(m.accessStatus||'Active')+'</div></div>'+btn('View profile','data-registry-edit="'+esc(m.id)+'"')+'</article>').join('')+'</div>':empty('No matching members','Adjust the search or filters.'));
  $$('[data-registry-edit]',target).forEach(button=>button.onclick=()=>{
   const m=members.find(x=>String(x.id)===button.dataset.registryEdit);if(!m)return;
   const form='<div class="hq-form-grid"><label>Member name<input name="name" required maxlength="120" value="'+esc(m.name||'')+'"></label><label>Contact<input name="contact" maxlength="180" value="'+esc(m.contact||'')+'"></label></div><label>Attendance category<select name="attendanceCategory">'+['new','returning','established'].map(x=>'<option value="'+x+'"'+(x===(m.attendanceCategory||'new')?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label><label>Internal registry notes<textarea name="adminNotes" rows="4">'+esc(m.adminNotes||'')+'</textarea></label><p class="se-muted">Access restrictions, bans and certifications require their separate authorized workflows.</p><p data-status class="hq-form-status"></p><button class="hq-button primary" type="submit">Save registry correction</button>';
   const d=modal('Member · '+(m.preferredName||m.name||m.memberId||'Profile'),'<div class="se-app-detail">'+applicationDetails(m)+'</div><h3>Correct registry information</h3><form class="hq-form" id="registryEditForm">'+form+'</form><div class="hq-actions">'+btn('Applications','data-page-link="generalapps"')+btn('Restriction history','data-page-link="banhistory"')+'</div>');
   d.classList.add('se-wide-modal');bindPageLinks(d);
   watchForm($('#registryEditForm',d),async values=>{await api('members',{method:'POST',body:{adminAction:'selc_registry_update',id:m.id,...values}});d.close();flash('Registry correction saved.');await memberRegistryPage()});
  });
 };
 $('#registrySearch').oninput=e=>{search=e.target.value.trim().toLowerCase();render()};
 $('#registryStatus').onchange=e=>{status=e.target.value;render()};
 $('#registryAccess').onchange=e=>{access=e.target.value;render()};
 render();
}
async function generalAppsPage(){
 const [apps,result]=await Promise.all([api('applications'),api('members',{query:{status:'pending'}})]);
 const all=Array.isArray(apps.applications)?apps.applications:[],members=(Array.isArray(result.members)?result.members:[]).filter(m=>m&&!m.deletedAt);
 const roles=all.filter(a=>a.type!=='admission_assistance'),assistance=all.filter(a=>a.type==='admission_assistance'&&!a.eventArchived&&['pending','under review','approved'].includes(String(a.status||'').toLowerCase()));
 const buckets={membership:members,roles,assistance};let active='membership',filter='';
 const header=pageHeader('SELC / APPLICATIONS','Application review','Complete application records, supporting information, and documented decisions.');
 let html=header+'<div class="se-membership"><div class="se-metrics">'+[['Pending members',members.length],['Role applications',roles.length],['Admission assistance',assistance.length]].map(([l,n])=>'<div><strong>'+number(n)+'</strong><span>'+esc(l)+'</span></div>').join('')+'</div><section class="se-work-panel"><div class="se-section-head"><h2>Review queue</h2>'+btn('Member directory','data-page-link="registry"')+'</div><div class="se-app-tabs" role="group" aria-label="Application type">'+[['membership','Membership'],['roles','Roles and educators'],['assistance','Admission assistance']].map(([key,label])=>'<button type="button" data-app-tab="'+key+'" class="'+(key===active?'active':'')+'">'+label+' <span>'+buckets[key].length+'</span></button>').join('')+'</div><label class="se-app-search">Search applications<input id="seAppSearch" type="search" placeholder="Applicant, handle, type or event"></label><div id="seAppResults" aria-live="polite"></div></section></div>';
 setContent(html);bindPageLinks();
 const render=()=>{
  const rows=buckets[active].filter(a=>!filter||[a.name,a.preferredName,a.fetlife,a.loginEmail,a.type,a.eventTitle,a.event,a.status].some(v=>String(v||'').toLowerCase().includes(filter)));
  $('#seAppResults').innerHTML=rows.length?'<div class="se-directory">'+rows.map(a=>'<article class="se-member-row"><div class="se-avatar">'+esc(initials(a.name||a.preferredName||'SE'))+'</div><div class="se-member-main"><strong>'+esc(a.name||a.preferredName||'Applicant')+'</strong><span>'+esc(active==='membership'?(a.fetlife?'@'+a.fetlife:a.loginEmail||'Membership application'):active==='assistance'?(a.eventTitle||a.event||'Event assistance'):readableLabel(a.type||'Role application'))+'</span><div>'+tag(a.status||'Pending')+'</div></div>'+btn('Review application','data-review-id="'+esc(a.id)+'"')+'</article>').join('')+'</div>':empty('No applications found','Adjust the search or switch queues.');
  $$('[data-review-id]').forEach(b=>b.onclick=()=>openReview(rows.find(a=>String(a.id)===b.dataset.reviewId),active));
 };
 function openReview(record,kind){
  if(!record)return;
  const isMember=kind==='membership',isAssistance=kind==='assistance';
  const name=record.preferredName||record.name||'Applicant';
  const elevated=['staff','staff_dm','dungeon_monitor','ia_staff'].includes(record.type)&&!reviewer();
  const form=isMember?'<label>Private review notes<textarea name="adminNotes" rows="4">'+esc(record.adminNotes||'')+'</textarea></label>':(isAssistance?'<label>Admission option<select name="approvedAdmissionType"><option value="free">Free admission</option><option value="discounted">Reduced admission</option><option value="barter">Barter</option></select></label><label>Approved amount (if reduced)<input type="number" min="0" name="approvedAmount"></label>':'')+'<label>Internal notes<textarea name="adminNotes" rows="4">'+esc(record.adminNotes||'')+'</textarea></label><label>Message for applicant<textarea name="memberResponse" rows="3"></textarea></label>';
  const buttons=isMember?btn('Approve','data-member-decision="approved"','primary')+btn('Decline','data-member-decision="denied"','danger')+btn('Keep pending','data-member-decision="pending"'):
   elevated?btn('Recommend approval','data-role-decision="Recommended"','primary')+btn('Recommend decline','data-role-decision="Not Recommended"')+btn('Continue review','data-role-decision="Under Review"'):
   btn('Approve','data-role-decision="Approved"','primary')+btn('Decline','data-role-decision="Declined"','danger')+btn('Under review','data-role-decision="Under Review"');
  const dlg=modal((isMember?'Membership':isAssistance?'Admission assistance':'Role')+' · '+name,'<div class="se-app-detail"><p class="se-muted">Application details supplied by the Portal. Missing questions cannot be reconstructed from a partial saved record.</p>'+applicationDetails(record)+'</div><form class="hq-form" id="seReviewForm">'+form+'<p data-status class="hq-form-status"></p><div class="se-review-actions">'+buttons+'</div></form>');
  dlg.classList.add('se-wide-modal');
  $$('[data-member-decision]',dlg).forEach(b=>b.onclick=async()=>{
   if(!await confirmDecision('Record this membership decision?'))return;
   b.disabled=true;try{await api('members',{method:'POST',body:{adminAction:b.dataset.memberDecision,id:record.id,...formValues($('#seReviewForm',dlg))}});dlg.close();flash('Membership review saved.');await generalAppsPage()}catch(e){setStatus($('[data-status]',dlg),e.message)}finally{b.disabled=false}
  });
  $$('[data-role-decision]',dlg).forEach(b=>b.onclick=async()=>{
   if(!await confirmDecision('Record this application decision?'))return;
   b.disabled=true;try{await api('applications',{method:'POST',body:{adminAction:'review',id:record.id,status:b.dataset.roleDecision,...formValues($('#seReviewForm',dlg))}});dlg.close();flash('Application review saved.');await generalAppsPage()}catch(e){setStatus($('[data-status]',dlg),e.message)}finally{b.disabled=false}
  });
 }
 $$('[data-app-tab]').forEach(b=>b.onclick=()=>{active=b.dataset.appTab;$$('[data-app-tab]').forEach(t=>t.classList.toggle('active',t===b));render()});
 $('#seAppSearch').oninput=e=>{filter=e.target.value.trim().toLowerCase();render()};
 render();
}
async function staffPathPage(){
 if(!['representative','coordinator'].includes(role()))return openPage('home');
 const p=await api('workspace-profile').catch(()=>null);
 const recognized=!!context.me?.isStaff;
 const steps=[
  ['Apply','Use the Member Portal Staff application. Give your preferred responsibilities, relevant experience, availability and examples of sound judgment. Your SELC position is not a substitute for this application.'],
  ['Verification','Your approved Portal membership, linked member identity and submitted application are reviewed. You cannot approve or verify your own Staff application.'],
  ['Staff role acceptance','After acceptance, an active Staff role must be linked to your existing member identity. You retain your Representative or Coordinator role.'],
  ['Certification','Complete the separate Staff certification (and Dungeon Monitor certification if applicable) before working a safety-sensitive shift.'],
  ['Volunteer','Open the Staff Portal and claim an available event position. Your shift and complimentary Staff admission are recorded in Portal, not SELC.']
 ];
 let markup=pageHeader('YOUR DEVELOPMENT','Become Sanctum Eros Staff','SELC leadership is a governance role. Staff is a separate operational role, with its own verification and certification.');
 markup+=card('<h2>Your connected roles</h2><p>'+esc(context.me.isStaff?'An active Staff role is linked to your SELC identity.':'You are recognized as '+(role()==='coordinator'?'Coordinator':'Representative')+'. No active linked Staff role was confirmed by SELC sign-in.')+'</p>'+(p?.roles?.length?'<p>'+esc(p.roles.join(' · '))+'</p>':'')+'<p class="hq-micro">Representatives lead committee work; Coordinators supervise and administer. Neither role alone certifies someone to run an event shift.</p>');
 markup+=card('<h2>Application and verification pathway</h2>'+steps.map(([name,description],i)=>'<div class="hq-row"><strong>'+String(i+1)+'. '+esc(name)+'</strong><p class="hq-prose">'+esc(description)+'</p></div>').join('')+'<div class="hq-actions"><a class="hq-button primary" href="'+PORTAL+'/member.html#applications">Open Staff application in Portal</a><a class="hq-button" href="'+PORTAL+'/staff.html#shifts">Open Staff Portal</a></div>');
 markup+=card('<h2>Verification status</h2><p>'+(recognized?'Linked Staff role detected. Use the Staff Portal for certification and event shifts.':'No linked active Staff role is detected. After submitting your application, track the decision in the Member Portal. An accepted application is not the same as an active certified Staff role.')+'</p>');
 setContent(markup);
}
async function volunteerPage(){
 const data=await api('shifts'),events=activeSELCEvents(data.events),me=data.me||{},canManageShifts=owner()||role()==='coordinator',openPositions=events.reduce((n,e)=>n+Number(e.coverage?.open||0),0);
 let html=pageHeader('EVENT OPERATIONS','Staffing overview','Staff and Dungeon Monitor volunteer sign-ups happen exclusively in the Staff Portal. SELC provides event staffing oversight and handover information.');
 html+='<div class="hq-stats"><div class="hq-stat"><small>OPEN STAFF POSITIONS</small><strong>'+openPositions+'</strong></div><div class="hq-stat"><small>EVENTS WITH SHIFTS</small><strong>'+events.length+'</strong></div></div>'+card('<h2>Volunteer through the Staff Portal</h2><p>SELC leadership status does not replace Staff certification. Staff + Representative and Staff + Coordinator accounts claim, release and manage shifts in Portal.</p><a class="hq-button primary" href="'+PORTAL+'/staff.html#shifts">Open Staff Portal volunteering ↗</a>');
 if(!owner()&&!me.linked)html+=card('<h2>Staff role required for volunteering</h2><p>Your SELC position does not automatically confer a Staff role. Apply through the Member Portal if you want to work a shift.</p><a class="hq-button" href="'+PORTAL+'/member.html">Go to Member Portal</a>');
 else if(!owner()&&!me.certified)html+=card('<h2>Complete your Staff certification first</h2><p>Event shifts involve actual responsibilities. Current Staff certification is required, and Dungeon Monitor shifts separately require DM certification.</p><a class="hq-button" href="'+PORTAL+'/staff.html#cert">Open certification</a>');
 html+=events.map(e=>{
  const coverage=e.coverage||{},head='<div class="hq-row"><div class="grow"><h2>'+esc(e.event.title)+'</h2><p>'+esc(date(e.event.start))+' · '+coverage.filled+'/'+coverage.needed+' roles filled</p></div>'+tag(e.recruitmentClosed?'Sign-ups closed':coverage.complete?'Fully covered':'Open positions')+'</div>';
  const shifts=e.slots.map(slot=>{
   const own=slot.claims.some(c=>c.mine);
   return '<div class="hq-row"><div class="grow"><strong>'+esc(slot.label)+(slot.role==='dm'?' · Certified DM':'')+'</strong><p>'+esc(slot.description||'Help make this event run smoothly.')+'</p><p class="hq-micro">'+slot.filled+'/'+slot.count+' filled'+(slot.closed?' · Closed to new volunteers':'')+(slot.claims.length?' · '+slot.claims.map(c=>esc(c.mine?'You':c.name)).join(', '):'')+'</p></div>'+
    (canManageShifts?btn(slot.positionClosed?'Reopen':'Close','data-position-toggle="'+esc(e.event.id)+'|'+esc(slot.id)+'|'+(slot.positionClosed?'open':'closed')+'"'):tag(own?'Assigned to you':slot.closed?'Closed':slot.open>0?'Open in Staff Portal':'Full'))+'</div>';
  }).join('');
  return card(head+'<div class="hq-panel-list">'+shifts+'</div><div class="hq-actions">'+btn('Event handover notes','data-handover="'+esc(e.event.id)+'"')+(canManageShifts?btn(e.recruitmentClosed?'Reopen all sign-ups':'Close all sign-ups','data-event-recruitment="'+esc(e.event.id)+'|'+(e.recruitmentClosed?'open':'closed')+'"')+btn('Manage volunteer positions','data-manage-shifts="'+esc(e.event.id)+'"','primary'):'')+'</div>');
 }).join('');
 if(!events.length)html+=empty('No upcoming volunteer shifts','Positions will appear automatically when an event is published.');
 setContent(html);
 $$('[data-position-toggle]').forEach(button=>button.onclick=async()=>{
  const [eventId,slotId,mode]=button.dataset.positionToggle.split('|');
  button.disabled=true;
  try{await post('shifts','set_position_status',{eventId,slotId,closed:mode==='closed'});flash(mode==='closed'?'Position closed to new volunteers.':'Position reopened.');await volunteerPage()}
  catch(error){flash(error.message);button.disabled=false}
 });
 $$('[data-event-recruitment]').forEach(button=>button.onclick=async()=>{
  const [eventId,mode]=button.dataset.eventRecruitment.split('|');
  if(mode==='closed'&&!confirmDecision('Close all new volunteer sign-ups for this event? Existing assignments will remain.'))return;
  button.disabled=true;
  try{await post('shifts','set_event_recruitment',{eventId,closed:mode==='closed'});flash(mode==='closed'?'Volunteer sign-ups closed.':'Volunteer sign-ups reopened.');await volunteerPage()}
  catch(error){flash(error.message);button.disabled=false}
 });
 $$('[data-handover]').forEach(b=>b.onclick=async()=>{
  try{const eventId=b.dataset.handover,d=await api('shifts',{query:{eventId}}),notes=d.handoffs||[];
  const entries=notes.map(n=>'<div class="hq-row"><div class="grow"><strong>'+esc(n.by)+' · '+esc(n.kind)+'</strong><p class="hq-prose">'+esc(n.text)+'</p><small>'+esc(date(n.at))+'</small></div></div>').join('');
  const dlg=modal('Shift handover · '+(d.event?.title||'Event'),'<p class="hq-muted">Share operational updates, staffing changes and equipment checks. Private investigations belong in the separate IA workflow.</p>'+entries+'<form id="handoverForm" class="hq-form"><label>Type</label><select name="kind">'+['arrival','equipment','support','staffing','closing','general'].map(k=>'<option value="'+k+'">'+esc(k)+'</option>').join('')+'</select><label>What does the incoming team need to know?</label><textarea name="text" minlength="15" rows="4" required></textarea><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Save handover</button></form>');
  watchForm($('#handoverForm',dlg),async vals=>{await post('shifts','handoff',{eventId,...vals});dlg.close();flash('Handover note saved.');volunteerPage()});
  }catch(e){flash(e.message)}
 });
 $$('[data-manage-shifts]').forEach(button=>button.onclick=async()=>{
  const eventId=button.dataset.manageShifts;
  try{
   const data=await api('shifts',{query:{eventId}}),slots=data.slots||[];
   const form='<form id="manageShiftForm" class="hq-form">'+slots.map((slot,i)=>
    '<fieldset class="hq-card"><legend>'+esc(slot.label)+'</legend><input type="hidden" name="id'+i+'" value="'+esc(slot.id)+'"><label>Position<select name="role'+i+'"><option value="staff" '+(slot.role==='staff'?'selected':'')+'>Staff</option><option value="dm" '+(slot.role==='dm'?'selected':'')+'>Dungeon Monitor</option></select></label><label>Shift name<input name="label'+i+'" value="'+esc(slot.label)+'" required></label><label>Positions needed<input type="number" name="count'+i+'" min="1" max="20" value="'+number(slot.count)+'"></label><label>Description<input name="description'+i+'" value="'+esc(slot.description||'')+'"></label><label class="checkline"><input type="checkbox" name="closed'+i+'" '+(slot.positionClosed?'checked':'')+'> Close this position to new volunteers</label>'+
    slot.claims.map(c=>'<div class="hq-row"><span>'+esc(c.name)+'</span>'+btn('Remove volunteer','data-remove-volunteer="'+esc(eventId)+'|'+esc(slot.id)+'|'+esc(c.staffId||'')+'"','danger')+'</div>').join('')+'</fieldset>').join('')+
    '<fieldset class="hq-card"><legend>Add another position (optional)</legend><label>Type<select name="newRole"><option value="staff">Staff</option><option value="dm">Dungeon Monitor</option></select></label><label>Title<input name="newLabel" placeholder="Setup / Door / DM"></label><label>Number needed<input type="number" name="newCount" min="1" max="20" value="1"></label></fieldset><p data-status></p><button class="hq-button primary">Save volunteer positions</button></form>';
   const dlg=modal('Volunteer management · '+esc(data.event.title),form);
   watchForm($('#manageShiftForm',dlg),async values=>{
    const result=slots.map((x,i)=>({id:values['id'+i],role:values['role'+i],label:values['label'+i],count:Number(values['count'+i]),description:values['description'+i],closed:values['closed'+i]==='on'}));
    if(values.newLabel)result.push({role:values.newRole,label:values.newLabel,count:Number(values.newCount)||1});
    await post('shifts','set_slots',{eventId,slots:result});
    dlg.close();flash('Volunteer positions saved.');volunteerPage();
   });
   $$('[data-remove-volunteer]',dlg).forEach(b=>b.onclick=async()=>{
    const [ev,slotId,staffId]=b.dataset.removeVolunteer.split('|');
    if(!staffId||!confirmDecision('Remove this volunteer from the shift?'))return;
    try{await post('shifts','remove_claim',{eventId:ev,slotId,staffId});dlg.close();flash('Volunteer removed.');volunteerPage()}catch(error){flash(error.message)}
   });
  }catch(e){flash(e.message)}
 });

}

async function eventPage(){
 const coordinator=role()==='coordinator',canManageDrafts=coordinator||owner();
 const [operational,calendar,proposalResult]=await Promise.all([api('staff-portal'),canManageDrafts?api('events').catch(()=>({events:[]})):Promise.resolve(null),canManageDrafts?api('selc-governance',{query:{scope:'proposals'}}).catch(()=>({proposals:[]})):Promise.resolve(null)]);
 const evs=activeSELCEvents(operational.events),drafts=canManageDrafts?(calendar?.events||[]).filter(e=>e.published===false&&!e.deletedAt&&!e.cancelledAt):[],relatedProposals=proposalResult?.proposals||[];
 let markup=pageHeader('EVENT OPERATIONS','Events & RSVPs','Review RSVPs, event assignments, and guest lists. Coordinators may draft events here without publishing them.',coordinator?btn('Create event draft','data-new-event-draft','primary'):'');
 if(canManageDrafts)markup+=card('<h2>Unpublished event drafts</h2><p class="hq-muted">Drafts do not open RSVPs. Submit an event proposal for a committee vote before publication.</p>'+
  (drafts.length?drafts.map(e=>{
   const proposal=relatedProposals.find(p=>p.linkedEventId===e.id&&p.status!=='Declined');
   return '<div class="hq-row"><div class="grow"><strong>'+esc(e.title)+'</strong><p>'+esc(date(e.start))+' · '+esc(e.eventType||'play')+'</p>'+
    (proposal?'<p class="hq-micro">Committee review: '+esc(proposal.status)+' · '+(proposal.voteSummary?.passed?'Majority recorded':String(proposal.voteSummary?.participating||0)+' votes recorded')+'</p>':'<p class="hq-micro">Not yet submitted to committee</p>')+
    '</div><div class="hq-actions">'+(coordinator?btn('Edit draft','data-edit-event-draft="'+esc(e.id)+'"'):'')+
    (proposal?btn('Open proposal','data-page-link="proposals"'):coordinator?btn('Submit for committee vote','data-propose-event="'+esc(e.id)+'"','primary'):'')+
    (owner()&&proposal?.voteSummary?.passed&&proposal?.chairDecision==='approved'?btn('Publish approved event','data-publish-event="'+esc(e.id)+'"','primary'):'')+'</div></div>';
  }).join(''):empty('No event drafts','Create a draft to begin planning.')));

 markup+=evs.length?evs.map(e=>card('<div class="hq-row"><div class="grow"><strong>'+esc(e.title||'Event')+'</strong><p>'+esc(date(e.start))+' · '+esc(e.eventType||'')+'</p></div>'+btn('RSVP queue','data-event-rsvp="'+esc(e.id)+'"','primary')+(e.eventType==='workshop'&&e.classId?btn('Teacher materials','data-event-teacher="'+esc(e.classId)+'"'):'')+'</div>')).join(''):empty('No upcoming published events','New events will appear as they are scheduled.');
 setContent(markup);bindPageLinks();
 $$('[data-event-rsvp]').forEach(b=>b.onclick=()=>rsvpPage(b.dataset.eventRsvp));
 
 $$('[data-event-teacher]').forEach(b=>b.onclick=()=>openSEEducationTeacherMaterials(b.dataset.eventTeacher));
 const editor=(prior={})=>{
  const opts=[['play','Play party'],['social','Social'],['workshop','Workshop / Class']];
  const str=x=>esc(x??'');
  const form='<p class="hq-muted">Only an unpublished draft can be saved here. A Coordinator cannot publish an event using this form.</p><form class="hq-form" id="eventDraftForm">'+
   '<label>Event title<input name="title" required minlength="6" maxlength="180" value="'+str(prior.title||'')+'"></label>'+
   '<label>Type<select name="eventType">'+opts.map(([v,label])=>'<option value="'+v+'"'+(prior.eventType===v?' selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
   '<div class="hq-form-grid"><label>Starts<input type="datetime-local" name="start" required value="'+str(String(prior.start||'').slice(0,16))+'"></label><label>Ends<input type="datetime-local" name="end" value="'+str(String(prior.end||'').slice(0,16))+'"></label></div>'+
   '<label>Attendance limit<input type="number" name="capacity" min="1" max="10000" required value="'+str(prior.capacity||20)+'"></label>'+
   '<label>Workshop class ID (required for Workshop/Class)<input name="classId" value="'+str(prior.classId||'')+'"></label>'+
   '<label>Description<textarea name="description" rows="5">'+str(prior.description||'')+'</textarea></label>'+
   '<p data-status class="hq-form-status"></p><button class="hq-button primary" type="submit">Save unpublished draft</button></form>';
  const dlg=modal(prior.id?'Edit event draft':'Create event draft',form);
  watchForm($('#eventDraftForm',dlg),async values=>{
   if(values.eventType==='workshop'&&!values.classId)throw new Error('Choose an existing SE Education class ID for a workshop.');
   const payload={...prior,...values,capacity:Number(values.capacity),id:prior.id||undefined,published:false,rsvpOpen:false,hubVisible:false,freeAdmission:prior.freeAdmission===true};
   await post('events','create_draft',payload);
   dlg.close();flash('Unpublished event draft saved for leadership review.');await eventPage();
  });
 };
 if(coordinator){
  $('[data-new-event-draft]')?.addEventListener('click',()=>editor());
  $$('[data-edit-event-draft]').forEach(el=>el.onclick=()=>{const item=drafts.find(x=>x.id===el.dataset.editEventDraft);if(item)editor(item)});
  $$('[data-propose-event]').forEach(el=>el.onclick=async()=>{
    const item=drafts.find(x=>x.id===el.dataset.proposeEvent);if(!item)return;
    if(!confirmDecision('Submit this unpublished event to SELC for discussion and a committee vote?'))return;
    const details=(item.description||'').trim(),description=('Proposal to schedule '+item.title+' on '+date(item.start)+'. '+(details||'Review the audience, staffing, accessibility, safety, cost and available venue space.')).slice(0,12000);
    el.disabled=true;
    try{await post('selc-governance','create_proposal',{title:'Event: '+item.title,description,category:'events',linkedEventId:item.id});flash('Event proposal submitted for committee review.');await proposalPage()}
    catch(err){flash(err.message);el.disabled=false}
  });
 }
 if(owner())$$('[data-publish-event]').forEach(el=>el.onclick=async()=>{
   const draft=drafts.find(e=>e.id===el.dataset.publishEvent);if(!draft)return;
   if(!confirmDecision('Publish the committee-approved event and open RSVPs?'))return;
   el.disabled=true;
   try{await post('events','publish_approved_draft',{id:draft.id});flash('Approved event published.');await eventPage()}
   catch(err){flash(err.message);el.disabled=false}
 });
}
async function rsvpPage(eventId){
 context.eventId=eventId;load();
 const d=await api('rsvps',{query:{eventId,detail:'requirements'}}),rows=d.rsvps||[];
 let markup=pageHeader('EVENT OPERATIONS','RSVP requests','Review applications for this event, manage capacity and record decisions.',btn('Back to events','data-page-link="events"'));
 for(const [st,name] of [['requested','Waiting for review'],['waitlisted','Waitlist'],['confirmed','Confirmed'],['declined','Declined']]){
  const list=rows.filter(r=>r.rsvpStatus===st);
  markup+=card('<h2>'+esc(name)+' <span class="hq-muted">('+list.length+')</span></h2>'+(list.length?list.map(r=>'<div class="hq-row"><div class="grow"><strong>'+esc(r.name||'Guest')+(r.partySize===2?' + '+esc(r.guestName||'partner'):'')+'</strong><p>'+esc(r.firstEvent==='yes'?'First event':'Returning')+' · '+esc(r.memberStatus||'')+' · '+esc(r.paymentStatus||'')+(r.banMatch?' · Banned-person match':'')+'</p></div><div class="hq-actions">'+(st!=='confirmed'?btn('Approve','data-rsvp-decision="confirmed" data-rsvp-id="'+esc(r.id)+'"','primary'):'')+(st==='requested'?btn('Waitlist','data-rsvp-decision="waitlisted" data-rsvp-id="'+esc(r.id)+'"'):'')+(st!=='declined'?btn(st==='confirmed'?'Remove':'Decline','data-rsvp-decision="declined" data-rsvp-id="'+esc(r.id)+'"','danger'):'')+'</div></div>').join(''):'<p class="hq-muted">Nobody here right now.</p>'));
 }
 setContent(markup);bindPageLinks();
 $$('[data-rsvp-decision]').forEach(b=>b.onclick=async()=>{const r=rows.find(x=>x.id===b.dataset.rsvpId),choice=b.dataset.rsvpDecision;let removalReason='';
  if(choice==='declined'&&r?.rsvpStatus==='confirmed'){removalReason=prompt('Provide a factual reason for removing this attendee (at least 30 characters). The ticket will be revoked; refund review is separate.')||'';if(removalReason.length<30)return flash('Please document the reason in at least 30 characters.')}
  if(!confirmDecision(choice==='declined'?'Record this decision? An existing ticket may be revoked.':'Update this RSVP?'))return;
  try{await api('rsvps',{method:'PATCH',body:{eventId,id:r.id,rsvpStatus:choice,removalReason}});flash('RSVP updated.');rsvpPage(eventId)}catch(e){flash(e.message)}
 });
}
async function doorPage(){
 stopCamera();const data=await api('staff-portal'),events=activeSELCEvents(data.events);
 if(!events.length){setContent(pageHeader('EVENT OPERATIONS','Check-in & tickets','All authorized event admission tools are available here.')+empty('No upcoming events','Your guest lists will appear when an event is scheduled.'));return}
 const ev=events.find(e=>e.id===context.eventId)||events[0];context.eventId=ev.id;
 let markup=pageHeader('EVENT OPERATIONS','Check-in & tickets','Look up a guest, scan their unique code, or check them in manually.');
 markup+=card('<div class="hq-form"><label>Event</label><select id="doorEvent">'+events.map(e=>'<option value="'+esc(e.id)+'" '+(e.id===ev.id?'selected':'')+'>'+esc(e.title)+' · '+esc(date(e.start))+'</option>').join('')+'</select></div>');
 markup+='<div class="hq-grid">'+card('<h2>Scan a ticket</h2><p>Use the camera when available or enter the SE- door code printed below a QR ticket.</p><form id="scanForm" class="hq-form"><label>Ticket QR or door code</label><input name="ticket" placeholder="SE-XXXXXXX or SE-TICKET:…" required><p data-status class="hq-form-status"></p><button class="hq-button primary" type="submit">Check ticket</button> '+btn('Use camera','data-camera')+'</form><div id="scanResult"></div><div id="cameraArea" hidden><video id="cameraVideo" playsinline autoplay muted style="width:100%;max-height:250px;border:1px solid #555;background:black"></video><p class="hq-micro">Aim the camera at a Sanctum Eros QR ticket.</p>'+btn('Stop camera','data-stop-camera')+'</div></div>')+
 card('<h2>Guest list</h2><label class="hq-muted" for="guestLookup">Search guest name, FetLife, or door code</label><input id="guestLookup" type="search" style="width:100%;padding:10px;margin:8px 0 12px;background:#121318;color:white;border:1px solid #666" placeholder="Start typing a name…"><div id="guestList"><p>Loading guests…</p></div>');
 markup+='</div>';setContent(markup);
 $('#doorEvent').onchange=e=>{context.eventId=e.target.value;doorPage()};
 $('#guestLookup').oninput=e=>{const q=e.target.value.toLowerCase();$$('#guestList [data-guest-row]').forEach(row=>row.hidden=!row.dataset.search.includes(q))};
 await loadDoorGuests(ev.id);
 watchForm($('#scanForm'),async values=>{const result=await api('payments',{method:'POST',body:{action:'scan',ticket:values.ticket,eventId:ev.id}});context.lastScan=result;displayScan(result,ev.id)});
 $('[data-camera]').onclick=()=>startCamera(ev.id);$('[data-stop-camera]').onclick=stopCamera;
}
async function loadDoorGuests(eventId){
 const d=await api('rsvps',{query:{eventId,detail:'door'}}),rows=(d.rsvps||[]).filter(r=>r.rsvpStatus==='confirmed'),host=$('#guestList');if(!host)return;
 host.innerHTML=rows.length?rows.map(r=>'<div class="hq-row" data-guest-row data-search="'+esc([r.name,r.guestName,r.fetlife,r.doorCode].join(' ').toLowerCase())+'"><div class="grow"><strong>'+esc(r.name)+(r.partySize===2?' & '+esc(r.guestName||'Partner'):'')+'</strong><p>'+esc(r.memberStatus||'')+' · '+esc(r.paymentStatus||'')+'</p></div>'+tag(r.primaryCheckedIn?'Checked in':r.banMatch?'Access concern':'Confirmed')+btn('Check in','data-manual-checkin="'+esc(r.id)+'"','primary')+'</div>').join(''):empty('No confirmed guests','Guests appear when RSVPs are approved.');
 $$('[data-manual-checkin]',host).forEach(b=>b.onclick=async()=>{const r=rows.find(x=>x.id===b.dataset.manualCheckin);if(!r)return;const who=Number(r.partySize)===2?prompt('Type primary or guest to choose who to check in:','primary'):'primary';if(!['primary','guest'].includes(who))return;
  if(!confirmDecision('Check in '+(who==='guest'?r.guestName:r.name)+'? The server will verify admission requirements and restrictions.'))return;
  try{await api('rsvps',{method:'PATCH',body:{action:'attendance',eventId,id:r.id,who,field:'checkedIn',value:true}});flash('Guest checked in.');loadDoorGuests(eventId)}catch(e){flash(e.message)}
 });
}
function displayScan(data,eventId){
 const host=$('#scanResult');if(!host)return;
 const t=data.ticket||{};
 host.innerHTML=card('<h3>'+esc(t.attendee||'Ticket found')+'</h3><p>'+esc(t.eventTitle||'')+' · '+esc(t.admissionLabel||t.admissionKind||'')+'</p>'+tag(t.valid===false?'Not valid':'Found')+'<div class="hq-actions">'+btn('Check in primary','data-scan-checkin="primary"','primary')+(t.couple?btn('Check in partner','data-scan-checkin="guest"'):'')+'</div>');
 $$('[data-scan-checkin]',host).forEach(b=>b.onclick=async()=>{if(!t.rsvpId)return flash('The scanner did not return an RSVP link.');try{await api('rsvps',{method:'PATCH',body:{action:'attendance',eventId:t.eventId||eventId,id:t.rsvpId,who:b.dataset.scanCheckin,field:'checkedIn',value:true}});flash('Guest checked in.');await loadDoorGuests(eventId)}catch(e){flash(e.message)}})
}
async function startCamera(eventId){
 const area=$('#cameraArea'),video=$('#cameraVideo');if(!area||!video)return;
 if(!navigator.mediaDevices?.getUserMedia||!('BarcodeDetector'in window))return flash('This browser does not support native QR scanning. Enter the ticket code above, or use the Portal scanner.');
 try{
  context.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});area.hidden=false;video.srcObject=context.stream;await video.play();
  const detector=new BarcodeDetector({formats:['qr_code']}),generation=context.stream;
  const scan=async()=>{if(context.stream!==generation)return;try{const codes=await detector.detect(video);if(codes.length){stopCamera();const input=$('#scanForm input[name=ticket]');if(input)input.value=codes[0].rawValue;const result=await api('payments',{method:'POST',body:{action:'scan',ticket:codes[0].rawValue,eventId}});displayScan(result,eventId);return}}catch{}setTimeout(scan,400)};
  scan();
 }catch(error){stopCamera();flash('Camera could not open. You can enter the SE- code manually.')}
}
function stopCamera(){if(context.stream){context.stream.getTracks().forEach(track=>track.stop());context.stream=null}const area=$('#cameraArea');if(area)area.hidden=true}
async function addBanAttendeePicker(dialog,form){
 const panel=document.createElement('div');panel.className='hq-card';panel.innerHTML='<h3>Find the right attendee</h3><p>Choose the event and person. Their verified RSVP details will fill the fields for you, including whether this concerns the primary attendee or their partner.</p><div class="hq-form"><label>Event</label><select id="banPickerEvent"><option value="">Choose an event</option></select><label>Person on guest list</label><select id="banPickerPerson"><option value="">Choose an attendee</option></select></div>';
 form.prepend(panel);const eventSelect=$('#banPickerEvent',panel),personSelect=$('#banPickerPerson',panel);
 try{
  const d=await api('staff-portal');
  eventSelect.innerHTML='<option value="">Choose an event</option>' +activeSELCEvents(d.events).map(ev=>'<option value="'+esc(ev.id)+'">'+esc(ev.title)+' · '+esc(date(ev.start))+'</option>').join('');
  eventSelect.onchange=async()=>{personSelect.innerHTML='<option value="">Loading guest list…</option>';if(!eventSelect.value)return;
   try{const d=await api('rsvps',{query:{eventId:eventSelect.value,detail:'door'}});const options=[];for(const r of d.rsvps||[]){if(['cancelled','declined'].includes(r.rsvpStatus))continue;options.push({id:r.id,who:'primary',name:r.name||'Attendee',memberId:r.memberId||''});if(Number(r.partySize)===2)options.push({id:r.id,who:'guest',name:r.guestName||'Partner',memberId:r.guestMemberId||''})}panel._targets=options;personSelect.innerHTML='<option value="">Choose the person involved</option>'+options.map((t,i)=>'<option value="'+i+'">'+esc(t.name)+(t.who==='guest'?' (partner)':'')+'</option>').join('')}catch(e){flash(e.message);personSelect.innerHTML='<option value="">Unable to load guest list</option>'}
  };
  personSelect.onchange=()=>{const t=panel._targets?.[Number(personSelect.value)];if(!t)return;for(const [key,value]of Object.entries({person:t.name,memberRecordId:t.memberId,eventId:eventSelect.value,rsvpId:t.id,subjectWho:t.who})){const el=form.elements.namedItem(key);if(el)el.value=value}flash('Verified attendee selected. Complete the report below.')};
 }catch(e){panel.querySelector('p').textContent='You can still enter a verified member record or exact event RSVP manually. '+e.message}
}

async function iaCasesPage(){
 if(!leader())return openPage('home');
 const d=await api('ia-reports'),rows=d.reports||[];
 let markup=pageHeader('CONFIDENTIAL / INTERNAL AFFAIRS','IA case registry','Restricted to authenticated SELC leadership. Review evidence, allegations, findings and case history only for committee responsibilities.');
 markup+='<div class="hq-stats">'+[['OPEN',rows.filter(r=>r.status==='Open').length],['UNDER REVIEW',rows.filter(r=>r.status==='Under Review').length],['TOTAL CASES',rows.length]].map(([label,count])=>'<div class="hq-stat"><small>'+esc(label)+'</small><strong>'+number(count)+'</strong></div>').join('')+'</div>';
 markup+=card('<p class="hq-micro">These are confidential records. Access is role-checked by the Portal. Do not share documents, identifying data or allegations outside authorized review channels. An allegation is not a finding.</p>');
 markup+=rows.length?rows.map((r,i)=>card('<div class="hq-row"><div class="grow"><strong>'+esc(r.caseNumber||'Case')+'</strong><p>'+esc(r.reportedPerson||'Subject not listed')+' · '+esc(date(r.createdAt))+'</p><p>'+esc(r.priority||'Untriaged')+' · '+esc(r.assignedTo||'Unassigned')+'</p></div>'+tag(r.status)+btn('Review case','data-open-ia="'+i+'"','primary')+'</div>')).join(''):empty('No IA cases available','Authorized cases will appear here when filed.');
 setContent(markup);
 $$('[data-open-ia]').forEach(button=>button.onclick=()=>{
  const r=rows[Number(button.dataset.openIa)];if(!r)return;
  const sections=[['Original account',r.initialAccount],['Immediate safety steps',r.immediateActions],['Evidence and sources',r.evidenceDescription],['Witnesses',r.witnesses],['Reviewer notes',r.reviewNotes],['Decision rationale',r.decisionRationale],['Disposition',r.disposition],['Follow-up',r.followUp]];
  const history=(r.activity||[]).map(h=>'<div class="hq-row"><div class="grow"><strong>'+esc(h.actor||'Reviewer')+'</strong><p>'+esc(h.action||'Action recorded')+'</p><small>'+esc(date(h.at))+'</small></div></div>').join('');
  const dialog=modal('IA case · '+esc(r.caseNumber||r.id),'<p>'+tag(r.status)+' · '+esc(r.priority||'Untriaged')+'</p><p><strong>Subject:</strong> '+esc(r.reportedPerson||'Not recorded')+'</p><p><strong>Reported:</strong> '+esc(date(r.createdAt))+'</p>'+sections.filter(([,v])=>v).map(([label,value])=>'<section class="hq-card"><h3>'+esc(label)+'</h3><p class="hq-prose">'+esc(value)+'</p></section>').join('')+'<h3>Activity history</h3>'+(history||'<p>No activity recorded.</p>')+'<h3>Leadership observations</h3>'+((r.leadershipNotes||[]).length?(r.leadershipNotes||[]).map(n=>'<section class="hq-row"><div class="grow"><strong>'+esc(n.by||'SELC reviewer')+'</strong><p class="hq-prose">'+esc(n.note||'')+'</p><small>'+esc(date(n.at))+'</small></div></section>').join(''):'<p class="hq-muted">No observations have been added.</p>')+
    '<form id="iaObservationForm" class="hq-form"><label>Document an observation</label><textarea name="note" minlength="20" rows="5" required placeholder="Separate observations from allegations and findings."></textarea><p class="hq-micro">This note does not change the case status or impose restrictions.</p><p data-status></p><button class="hq-button primary" type="submit">Save observation</button></form>'+
    '<p class="hq-micro">Case access does not itself authorize enforcement, disclosure or destruction of evidence.</p>');
  watchForm(dialog.querySelector('#iaObservationForm'),async vals=>{await post('ia-reports','add_note',{id:r.id,note:vals.note});dialog.close();flash('Observation saved to the IA case.');await iaCasesPage()});
 });
}
async function banReportsPage(){
 const d=await api('ban-reports'),rows=d.reports||[];
 let markup=pageHeader('CONFIDENTIAL / SAFETY','Ban Reports','Ban Reports are separate from IA investigations. An unresolved report places linked admission on hold—not a finding of misconduct.',btn('Submit Ban Report','data-new-ban','primary'));
 markup+=rows.length?rows.map(r=>card('<div class="hq-row"><div class="grow"><strong>'+esc(r.person)+' · '+esc(r.reportNumber||'')+'</strong><p>'+esc(r.createdBy)+' · '+esc(date(r.createdAt))+' · '+number(r.ticketsRevoked)+' ticket(s) held</p></div>'+tag(r.status)+btn('Review','data-open-ban="'+esc(r.id)+'"')+'</div>')).join(''):empty('No Ban Reports','New reports and admission holds appear here.');
 setContent(markup);$('[data-new-ban]').onclick=()=>{
  const dlg=modal('Submit a Ban Report','<p class="hq-muted">A linked ticket will be held while an authorized reviewer considers this report. Provide verified identity—not a name-only guess.</p><form id="banForm" class="hq-form"><label>Person involved</label><input name="person" required><input type="hidden" name="subjectWho" value="primary"><div class="hq-form-grid"><div><label>Verified member record ID</label><input name="memberRecordId" placeholder="From member lookup"></div><div><label>Incident date</label><input type="date" name="incidentDate"></div><div><label>Event ID (optional)</label><input name="eventId"></div><div><label>RSVP ID (optional)</label><input name="rsvpId"></div></div><label>What happened? Give a clear factual account.</label><textarea name="summary" rows="7" minlength="40" required></textarea><label>Witnesses</label><textarea name="witnesses"></textarea><label>Evidence / documentation</label><textarea name="evidenceDescription"></textarea><label>Immediate actions taken</label><textarea name="immediateActions"></textarea><label>Safety concern</label><textarea name="safetyConcern"></textarea><label>Related IA case (optional, separate)</label><input name="relatedIaCase"><label>Outcome being requested</label><input name="requestedOutcome"><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Submit report & hold linked admission</button></form>');
  addBanAttendeePicker(dlg,$('#banForm',dlg));
  watchForm($('#banForm',dlg),async vals=>{if(!vals.memberRecordId&&(!vals.eventId||!vals.rsvpId))throw new Error('Link a verified member record or an exact event and RSVP.');await post('ban-reports','submit',vals);dlg.close();flash('Ban Report submitted; linked admission is on hold.');banReportsPage()});
 };
 $$('[data-open-ban]').forEach(b=>b.onclick=()=>{const r=rows.find(x=>x.id===b.dataset.openBan);if(!r)return;
  const dlg=modal('Ban Report '+r.reportNumber,'<p>'+tag(r.status)+' · '+esc(r.createdBy)+' · '+esc(date(r.createdAt))+'</p><h3>Person involved</h3><p>'+esc(r.person)+'</p><h3>Incident account</h3><p class="hq-prose">'+esc(r.summary)+'</p><h3>Evidence and witnesses</h3><p class="hq-prose">'+esc(r.evidenceDescription||'')+'</p><p class="hq-prose">'+esc(r.witnesses||'')+'</p><h3>Admission status</h3><p>'+number(r.ticketsRevoked)+' ticket(s) held · '+esc(r.memberRecordId||r.rsvpId||'No link')+'</p>'+(r.decision?'<div class="hq-card"><strong>Decision</strong><p>'+esc(r.decisionReason)+'</p><small>'+esc(r.decidedBy)+'</small></div>':'')+'<h3>SELC feedback</h3>'+((r.feedback||[]).length?(r.feedback||[]).map(f=>'<div class="hq-row"><div class="grow"><strong>'+esc(f.by||'SELC')+' · '+esc((f.position||'').replaceAll('_',' '))+'</strong><p class="hq-prose">'+esc(f.note||'')+'</p><small>'+esc(date(f.at))+'</small></div></div>').join(''):'<p class="hq-muted">No committee feedback recorded.</p>')+(d.canProvideFeedback&&r.status==='Pending'?'<form id="banFeedback" class="hq-form"><label>Leadership recommendation</label><select name="position"><option value="more_information">Request more information</option><option value="support">Recommend restriction</option><option value="oppose">Recommend declining</option><option value="recuse">Recuse due to conflict</option></select><label>Documented reasoning</label><textarea name="note" minlength="30" rows="4" required></textarea><p class="hq-micro">This is an advisory recommendation. It cannot issue, alter or lift a ban.</p><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Submit feedback</button></form>':'')+(d.canDecide&&r.status==='Pending'?'<form id="banDecision" class="hq-form"><label>Decision</label><select name="decision"><option value="decline">Decline / lift hold</option><option value="approve">Approve ban</option></select><label>Ban duration (if approved)</label><select name="kind"><option value="permanent">Permanent</option><option value="temporary">Temporary</option></select><label>End date (temporary)</label><input type="datetime-local" name="expiresAt"><label>Decision rationale (30 characters minimum)</label><textarea name="decisionReason" minlength="30" required></textarea><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Record decision</button></form>':''));
  watchForm($('#banFeedback',dlg),async vals=>{await post('ban-reports','feedback',{id:r.id,...vals});dlg.close();flash('Leadership feedback recorded.');banReportsPage()});
  watchForm($('#banDecision',dlg),async vals=>{if(vals.decision==='approve'&&vals.kind==='temporary'&&!vals.expiresAt)throw new Error('Choose an expiration for a temporary ban.');if(!confirmDecision('Confirm this formal access decision? Every outcome is recorded and visible in Owner Administration.'))return;await post('ban-reports','decide',{id:r.id,...vals,expiresAt:vals.expiresAt?new Date(vals.expiresAt).toISOString():''});dlg.close();flash('Decision recorded.');banReportsPage()});
 });
}
async function appealReviewPage(){
 const d=await api('safety-appeal-review'),rows=d.appeals||[];
 let markup=pageHeader('CONFIDENTIAL / ACCESS DECISIONS','Access appeals','Separate from the original Ban Report and any IA case. The person who issued the ban must recuse themselves from recommending its appeal outcome.');
 markup+=rows.length?rows.map(a=>card('<div class="hq-row"><div class="grow"><strong>Appeal '+esc(a.id.slice(0,8))+'</strong><p>Received '+esc(date(a.createdAt))+' · '+(a.relatedBanReports||[]).length+' linked Ban Report(s)</p></div>'+tag(a.status)+btn('Review','data-review-appeal="'+esc(a.accountId)+'|'+esc(a.id)+'"')+'</div>')).join(''):empty('No access appeals','Appeals from members under a restriction appear here after submission.');
 setContent(markup);
 $$('[data-review-appeal]').forEach(b=>b.onclick=()=>{
  const [accountId,id]=b.dataset.reviewAppeal.split('|'),a=rows.find(r=>r.id===id&&r.accountId===accountId);if(!a)return;
  const prior=(a.originalDecisions||[]).map(dec=>'<div class="hq-row"><div class="grow"><strong>'+esc(dec.by||'Decision-maker')+'</strong><p>'+esc(date(dec.at))+' · '+esc(dec.kind)+'</p></div></div>').join('');
  const notes=(a.recommendations||[]).map(n=>'<div class="hq-row"><div class="grow"><strong>'+esc(n.by)+' · '+esc(n.outcome)+'</strong><p class="hq-prose">'+esc(n.note)+'</p><small>'+esc(date(n.at))+'</small></div></div>').join('');
  const form='<form id="appealRecommend" class="hq-form"><label>Independent recommendation</label><select name="outcome"><option value="support">Support appeal</option><option value="deny">Recommend upholding restriction</option><option value="information">More information needed</option><option value="recuse">Recuse due to conflict</option></select><label>Factual rationale</label><textarea name="note" rows="5" minlength="30" required></textarea><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Record recommendation</button></form>';
  const dlg=modal('Access appeal','<p>'+tag(a.status)+'</p><h3>Member statement</h3><p class="hq-prose">'+esc(a.statement)+'</p><h3>Supporting information</h3><p class="hq-prose">'+esc(a.supportingInfo||'None included')+'</p><h3>Related records</h3><p class="hq-muted">Ban Reports: '+esc((a.relatedBanReports||[]).join(', ')||'None linked')+'</p><p class="hq-muted">IA cases: '+esc((a.relatedIaCases||[]).join(', ')||'None linked')+'</p><h3>Original access decisions</h3>'+prior+'<h3>Review history</h3>'+notes+form+(owner()?'<p><a class="hq-button" href="'+PORTAL+'/admin.html#safety/appeals">Open final appeal decision in Owner Portal ↗</a></p>':'<p class="hq-muted">Your recommendation is recorded for independent review; it does not automatically change the ban.</p>'));
  watchForm($('#appealRecommend',dlg),async vals=>{await post('safety-appeal-review','recommend',{accountId,id,...vals});dlg.close();flash('Review recommendation recorded.');appealReviewPage()});
 });
}


async function renderApplicantFollowups(root,items,kind){
 if(!root||!items?.length)return;
 const results=await Promise.allSettled(items.map(async item=>({item,result:await api('application-followups',{query:{kind,id:item.id}})})));
 if(!root.isConnected)return;
 const active=results.filter(x=>x.status==='fulfilled').map(x=>x.value).filter(x=>(x.result.followups||[]).length);
 if(!active.length)return;
 const section=document.createElement('section');section.className='hq-card';section.innerHTML='<h2>Questions from SELC</h2><p>Your original application remains unchanged. Respond to each follow-up below.</p>';
 for(const {item,result} of active)for(const f of result.followups){
  const area=document.createElement('div');area.className='hq-row';
  const label=document.createElement('strong');label.textContent=f.questionLabel+' · '+f.status;area.append(label);
  const question=document.createElement('p');question.textContent=f.question;area.append(question);
  if(f.reply){const answer=document.createElement('p');answer.textContent='Your reply: '+f.reply;area.append(answer)}
  else if(f.status==='Awaiting Applicant'){
   const form=document.createElement('form');form.className='hq-form';const input=document.createElement('textarea');input.required=true;input.minLength=2;input.maxLength=5000;input.rows=3;input.placeholder='Your response';form.append(input);
   const submit=document.createElement('button');submit.type='submit';submit.className='hq-button primary';submit.textContent='Send clarification';form.append(submit);
   const status=document.createElement('p');status.className='hq-form-status';form.append(status);
   form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{await post('application-followups','respond',{kind,id:item.id,followupId:f.id,reply:input.value});flash('Clarification sent.');const p=document.createElement('p');p.textContent='Your reply: '+input.value;form.replaceWith(p)}catch(err){setStatus(status,err.message)}finally{submit.disabled=false}};
   area.append(form);
  }
  section.append(area);
 }
 root.append(section);
}

async function communityLeadersPage(){
 const d=await api('community-leaders'),canDiscuss=!!d.canDiscuss;
 let markup=pageHeader('SELC / COMMUNITY PARTNERSHIPS','Community Leaders','A verified network for people who organize kink education, socials, and community spaces. Membership in this program never grants SELC or Staff authority.');
 if(!canDiscuss){
  markup+=card('<h2>Apply with your existing SE account—or a separate organizer account</h2><p>Owners and authorized organizers can apply without Sanctum Eros membership. Verify your email, submit the application, and await Founder approval. No Staff or committee permissions are included.</p><a class="hq-button primary" href="/community-leaders/#apply">Choose your account &amp; apply ↗</a>');
  if((d.ownApplications||[]).length)markup+=card('<h2>My application</h2>'+(d.ownApplications||[]).map(a=>'<div class="hq-row"><div class="grow"><strong>'+esc(a.organization)+'</strong><p>'+esc(a.status)+'</p><small>Submitted '+esc(date(a.submittedAt))+'</small></div></div>').join(''));
 }
 if(canDiscuss){
  const directory=d.directory||[];
  markup+=card('<h2>Message Community Leaders, SELC or Eros</h2><p>Messages are visible only to the selected recipients. Other Sanctum Eros Staff do not receive Community Leaders messages.</p><form id="communityMessage" class="hq-form"><label>Send to</label><select name="audience" id="communityAudience"><option value="network">All approved organizers and SELC</option><option value="committee">SELC committee</option><option value="founder">Founder / Eros only</option><option value="leader">One Community Leader</option></select><div id="communityRecipientWrap" hidden><label>Choose an approved organizer</label><select name="recipientId"><option value="">Select a recipient</option>'+directory.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.organization||p.name||'Community Leader')+'</option>').join('')+'</select></div><label>Subject</label><input name="topic" minlength="5" maxlength="140" required><label>Your message</label><textarea name="message" rows="5" minlength="20" maxlength="5000" required></textarea><p data-status></p><button class="hq-button primary">Send message</button></form>');
  markup+=card('<h2>Conversations</h2>'+((d.messages||[]).length?(d.messages||[]).map(m=>'<div class="hq-row"><div class="grow"><strong>'+esc(m.topic)+'</strong><p class="hq-prose">'+esc(m.message)+'</p><small>'+esc(m.organization||'Organizer')+' · '+esc(m.by||'Leader')+' · '+esc(m.audience==='network'?'Network':m.audience==='committee'?'SELC committee':m.audience==='founder'?'Founder only':'Direct leader')+' · '+esc(date(m.at))+'</small></div></div>').join(''):empty('No conversations yet','Start a message with the network, SELC, Eros or another approved organizer.')));
  markup+=card('<h2>Reviewed safety notices</h2><p>Updates approved for the Community Leaders network.</p>'+((d.sharedSafety||[]).length?d.sharedSafety.map(x=>'<div class="hq-row"><div class="grow"><strong>'+esc(x.title)+'</strong><p class="hq-prose">'+esc(x.summary)+'</p><small>'+esc(x.sourceOrganization||'Source')+' · '+esc(x.sourceDisposition||'Reported')+' · '+esc(date(x.at))+'</small></div></div>').join(''):empty('No shared notices','Approved network notices appear here.')));
  markup+=card('<h2>Propose a reviewed safety notice</h2><p>Submit a brief notice for Founder review.</p><form id="communitySafety" class="hq-form"><label>Category</label><select name="category"><option value="incident">Incident report</option><option value="restriction">Organization restriction</option><option value="ban">Organization-issued ban</option><option value="practice">Policy guidance</option></select><label>Status at source organization</label><select name="sourceDisposition"><option value="Reported">Reported, unverified</option><option value="Under Review">Under review</option><option value="Organization Restriction">Organization restriction</option><option value="Organization Ban">Organization ban</option><option value="Organizational Guidance">Organizational guidance</option></select><label>Notice title</label><input name="title" minlength="5" maxlength="140" required><label>Subject name (only if necessary and legally appropriate)</label><input name="subjectName" maxlength="140"><label>Minimized factual summary</label><textarea name="summary" minlength="80" maxlength="3500" rows="5" required></textarea><label>Documented consent or other lawful disclosure basis</label><textarea name="disclosureBasis" minlength="50" maxlength="1500" rows="3" required></textarea><label><input name="acknowledgeSensitive" type="checkbox" required> I have removed raw IA evidence, unnecessary identities, and unsupported allegations.</label><p data-status></p><button class="hq-button">Request Founder review</button></form>');
 }
 if(d.canReview){
  markup+=card('<h2>Community Leader applications</h2>'+((d.applications||[]).length?d.applications.map(a=>'<div class="hq-row"><div class="grow"><strong>'+esc(a.organization)+' · '+esc(a.leaderName)+'</strong><p>'+esc(a.experience)+'</p><p>'+esc(a.motivation)+'</p><small>'+esc(a.status)+' · '+esc(date(a.submittedAt))+'</small></div>'+btn('Review','data-leader-review="'+esc(a.id)+'"')+'</div>').join(''):empty('No applications','Applications from other organizations appear here.')));
 }
 if(d.canReview){
  markup+=card('<h2>Approved Community Leaders</h2><p>These accounts have organizer-network access only. Revoking access does not change Sanctum Eros membership status or any event reservation.</p>'+((d.directory||[]).length?d.directory.map(x=>'<div class="hq-row"><div class="grow"><strong>'+esc(x.organization||x.name)+'</strong><p>'+esc(x.name||'Approved organizer')+'</p></div>'+btn('Revoke network access','data-leader-revoke="'+esc(x.id)+'"','danger')+'</div>').join(''):empty('No approved external organizers','Approved applications appear here with independent access controls.')));
  markup+=card('<h2>Withdraw a previously shared notice</h2><p>A withdrawal immediately removes the notice from the approved network. Portal retains an audit reference marked as withdrawn, not an active source disclosure.</p>'+((d.sharedSafety||[]).length?d.sharedSafety.map(x=>'<div class="hq-row"><div class="grow"><strong>'+esc(x.title)+'</strong><p>'+esc(x.sourceOrganization)+' · '+esc(x.sourceDisposition)+'</p></div>'+btn('Withdraw disclosure','data-share-revoke="'+esc(x.id)+'"','danger')+'</div>').join(''):empty('Nothing to withdraw','No active approved notices are shared at this time.')));
 }
 if(owner()&&(d.pendingSafety||[]).length){
  markup+=card('<h2>Founder’s disclosure decisions</h2>'+d.pendingSafety.map(x=>'<div class="hq-row"><div class="grow"><strong>'+esc(x.title)+'</strong><p>'+esc(x.summary)+'</p><p>Disclosure basis: '+esc(x.disclosureBasis)+'</p></div>'+btn('Approve','data-share-approve="'+esc(x.id)+'"')+btn('Decline','data-share-decline="'+esc(x.id)+'"')+'</div>').join(''));
 }
 setContent(markup);
 renderApplicantFollowups($('#hqContent'),d.ownApplications||[],'community').catch(error=>console.error('Community application followups',error));
 const messageForm=$('#communityMessage');if(messageForm){const audience=messageForm.querySelector('#communityAudience'),recipient=messageForm.querySelector('#communityRecipientWrap');audience.onchange=()=>{recipient.hidden=audience.value!=='leader'};watchForm(messageForm,async values=>{if(values.audience==='leader'&&!values.recipientId)throw new Error('Choose an approved Community Leader.');await post('community-leaders','message',values);flash('Message sent to the selected audience.');communityLeadersPage()})}
 const shareForm=$('#communitySafety');if(shareForm)watchForm(shareForm,async values=>{await post('community-leaders','propose_safety_share',{...values,acknowledgeSensitive:values.acknowledgeSensitive==='on'});flash('Notice submitted for Founder review.');communityLeadersPage()});
 $$('[data-leader-review]').forEach(button=>button.onclick=()=>{
   const item=(d.applications||[]).find(x=>x.id===button.dataset.leaderReview);
   if(!item)return;
   const dlg=modal('Review '+item.organization,'<p>Applicant: '+esc(item.leaderName)+'</p><p>'+esc(item.motivation)+'</p><form class="hq-form" id="leaderDecision"><label>Decision</label><select name="status"><option>Needs Verification</option><option>Approved</option><option>Declined</option></select><label>Review notes</label><textarea name="notes" rows="3"></textarea><p data-status></p><button class="hq-button primary">Save review</button></form>');
   attachFollowupDesk(dlg,item,'community');
   watchForm($('#leaderDecision',dlg),async values=>{await post('community-leaders','review',{id:item.id,...values});dlg.close();flash('Community Leader review saved.');communityLeadersPage()});
 });
 $$('[data-leader-revoke]').forEach(button=>button.onclick=()=>{
  const id=button.dataset.leaderRevoke,person=(d.directory||[]).find(x=>x.id===id);if(!person)return;
  const dlg=modal('Revoke Community Leaders access','<p>This only closes the private organizer network. It does not ban someone from Sanctum Eros, modify an IA case, or change an SE membership.</p><form id="leaderRevoke" class="hq-form"><label>Reason for revocation</label><textarea name="reason" rows="3" minlength="10" required></textarea><p data-status></p><button class="hq-button danger">Revoke organizer access</button></form>');
  watchForm($('#leaderRevoke',dlg),async values=>{await post('community-leaders','revoke_leader',{accountId:id,...values});dlg.close();flash('Community Leaders network access revoked.');communityLeadersPage()});
 });
 $$('[data-share-revoke]').forEach(button=>button.onclick=async()=>{
  if(!await confirmDecision('Withdraw this shared safety notice from other Community Leaders? Existing Portal references will be marked as withdrawn.'))return;
  try{await post('community-leaders','revoke_safety_share',{id:button.dataset.shareRevoke});flash('Shared disclosure withdrawn.');communityLeadersPage()}catch(e){flash(e.message)}
 });
 $$('[data-share-approve],[data-share-decline]').forEach(button=>button.onclick=async()=>{
  const id=button.dataset.shareApprove||button.dataset.shareDecline,decision=button.dataset.shareApprove?'Approved':'Declined';
  if(!await confirmDecision('Record '+decision+' for this inter-organizational safety summary? This action is auditable.'))return;
  try{await post('community-leaders','approve_safety_share',{id,decision});communityLeadersPage()}catch(e){flash(e.message)}
 });
}


async function coordinatorAdminPage(){
 if(role()!=='coordinator')return openPage('home');
 const results=await Promise.allSettled([
  api('leadership-queue'),api('event-readiness'),api('ban-reports'),
  api('selc-governance',{query:{scope:'applications'}}),
  api('educator-applications')
 ]);
 const [tasks,readiness,bans,applications,educators]=results.map(r=>r.status==='fulfilled'?r.value:null);
 const pending=(applications?.applications||[]).filter(x=>['Pending','Under Review','Recommended','Not Recommended'].includes(x.status)).length;
 const educatorReviews=(educators?.review||[]).filter(x=>['Pending','Under Review','Changes Requested','Recommended'].includes(x.status)).length;
 const actionCards=[
  ['Leadership reviews',tasks?.items?.length||0,'work','Claim or delegate pending work'],
  ['SELC applications',pending,'applications','Review Representative and Coordinator applications'],
  ['Staff and member applications',(tasks?.counts?.role||0)+(tasks?.counts?.member||0),'generalapps','Verify and approve eligible Staff accepted roles'],
  ['Internal Affairs','View','iacases','Inspect private cases and evidence using authorized access'],
  ['Ban Reports',bans?.pendingCount||0,'banreports','Review reports, documented decisions and admission holds'],
  ['Access appeals','Review','appeals','Support independent and impartial case review'],
  ['Event readiness',readiness?.needsAttention||0,'readiness','Check staffing and operational gaps'],
  ['Workshop review',educatorReviews,'educatorreviews','Evaluate educator candidates and course readiness']
 ];
 let markup=pageHeader('SELC / ADMINISTRATION','Coordinator administration','Manage committee operations with delegated administrative authority. All decisions and sensitive case work use individual accounts, explicit permissions, and audit records.');
 markup+=card('<p>Coordinators supervise Representatives, coordinate operational reviews, oversee Staff applications and participate in sensitive case decisions. Staff and DM certification remain separate for physical event shifts.</p>');
 markup+='<div class="hq-grid">'+actionCards.map(([name,count,route,desc])=>card('<span class="hq-eyebrow">'+esc(name)+'</span><h2>'+esc(count)+'</h2><p>'+esc(desc)+'</p>'+btn('Open','data-page-link="'+esc(route)+'"','primary'))).join('')+'</div>';
 if(results.some(r=>r.status==='rejected'))markup+=card('<p class="hq-micro">Some administrative summaries are unavailable. Individual tools can still be opened and will show their own service status.</p>');
 setContent(markup);bindPageLinks();
}
async function founderDeskPage(){
 if(!owner())return openPage('home');
 const sections=[
  ['Website approvals','content','Review and publish voted changes'],
  ['Event readiness','readiness','Identify staffing and operational gaps'],
  ['Community inbox','communityinbox','Review opted-in member communications and feedback'],
  ['Volunteer management','volunteer','Manage positions, claims and coverage'],
  ['Education programs','educators','Review workshop planning'],
  ['Ban history','banhistory','Review current and prior restrictions'],
  ['Member applications','generalapps','Membership and role decisions'],
  ['Committee proposals','proposals','Review votes and recommendations']
 ];
 const results=await Promise.allSettled([api('selc-content'),api('event-readiness'),api('community-chat'),api('founder-weekly-pulse')]);
 const content=results[0].status==='fulfilled'?results[0].value:{proposals:[]};
 const readiness=results[1].status==='fulfilled'?results[1].value:{events:[],needsAttention:0};
 const chats=results[2].status==='fulfilled'?results[2].value:{rooms:[]};
 const digest=results[3].status==='fulfilled'?results[3].value:null;
 const pending=(content.proposals||[]).filter(x=>x.status==='Awaiting Founder').length;
 const unread=(chats.rooms||[]).reduce((n,x)=>n+Number(x.unread||0),0);
 setContent(pageHeader('FOUNDER / DIRECTOR','Founder command center','One place for decisions and operational oversight without crowding the workspace.')+
  '<div class="hq-stats">'+
  card('<span class="hq-eyebrow">Approval queue</span><h2>'+number(pending)+'</h2><p>Content changes awaiting your decision</p>'+btn('Review decisions','data-go="content"','primary'))+
  card('<span class="hq-eyebrow">Event readiness</span><h2>'+number(readiness.needsAttention)+'</h2><p>Upcoming events requiring attention</p>'+btn('Review events','data-go="readiness"'))+
  card('<span class="hq-eyebrow">Conversations</span><h2>'+number(unread)+'</h2><p>Unread chat messages in joined rooms</p>'+btn('Open messages','data-go="chat"'))+
  card('<span class="hq-eyebrow">Oversight</span><h2>Activity</h2><p>Committee, safety and staffing workflows</p>'+btn('Review operations','data-go="volunteer"'))+'</div>'+
  '<details class="hq-card" style="margin-top:18px"><summary style="cursor:pointer;font-weight:800">Weekly organization digest</summary>'+
  (digest?'<p class="hq-muted">Last 7 days · '+esc(date(digest.weekStart))+' – '+esc(date(digest.weekEnd))+'</p><div class="hq-stats">'+(digest.sections||[]).map(r=>'<div class="hq-card"><strong>'+number(r.value)+'</strong><p>'+esc(r.label)+'</p></div>').join('')+'</div>'+btn('Copy weekly summary','data-copy-digest'):
  '<p>The weekly summary is unavailable right now.</p>')+'</details>'+
  '<div class="hq-grid" style="margin-top:20px">'+sections.map(([title,target,desc])=>'<button type="button" class="hq-card" data-go="'+esc(target)+'" style="text-align:left;cursor:pointer"><strong>'+esc(title)+'</strong><p>'+esc(desc)+'</p></button>').join('')+'</div>');
 if(digest)$('[data-copy-digest]').onclick=async()=>{const text='Sanctum Eros · Founder weekly summary\n'+(digest.sections||[]).map(x=>x.label+': '+x.value).join('\n');try{await navigator.clipboard.writeText(text);flash('Weekly summary copied.')}catch(e){flash('Unable to copy summary on this device.')}};

 $$('[data-go]').forEach(el=>el.onclick=()=>openPage(el.dataset.go));
}
async function eventReadinessPage(){
 const d=await api('event-readiness'),events=activeSELCEvents(d.events);
 const rows=events.map(ev=>card('<div class="hq-row"><div class="grow"><strong>'+esc(ev.title)+'</strong><p>'+esc(date(ev.start))+' · '+(ev.ready?'Ready':number(ev.outstanding)+' items need attention')+'</p>'+
 '<div class="hq-panel-list">'+(ev.checks||[]).map(check=>'<div class="hq-row"><span>'+esc(check.complete?'✓':'○')+' '+esc(check.label)+'</span>'+tag(check.complete?'Complete':'Needs attention')+(check.detail?'<small>'+esc(check.detail)+'</small>':'')+'</div>').join('')+'</div></div></div>')).join('');
 setContent(pageHeader('EVENT OPERATIONS','Event readiness','Review staffing, handovers, schedule and admission configuration before doors open.')+
 card('<div class="hq-row"><strong>'+number(events.filter(ev=>ev.ready).length)+' ready</strong><strong>'+number(events.filter(ev=>!ev.ready).length)+' need attention</strong></div>')+
 (events.length?rows:empty('No upcoming events','Published future events will appear here.')));
}
async function banHistoryPage(){
 const d=await api('ban-history'),rows=d.records||[];
 let filter='all',search='';
 function render(){
  const visible=rows.filter(x=>(filter==='all'||x.status===filter)&&(!search||[x.name,x.fetlife,...(x.aliases||[])].join(' ').toLowerCase().includes(search)));
  const stats='<p class="hq-muted">'+rows.length+' historical and current records · '+rows.filter(x=>['Active','Temporary'].includes(x.status)).length+' currently in force</p>';
  $('#banRows').innerHTML=stats+(visible.length?visible.map(x=>card('<div class="hq-row"><div class="grow"><strong>'+esc(x.name)+'</strong><p>'+esc(x.fetlife?'@'+x.fetlife:'')+' · '+esc(x.kind)+' · '+esc(date(x.bannedAt))+'</p><p>'+esc(x.reason||'No public-facing reason recorded')+'</p><small>'+(x.liftedAt?'Lifted '+esc(date(x.liftedAt))+' · ':'')+(x.expiredAt?'Expired '+esc(date(x.expiredAt))+' · ':'')+(x.expiresAt?'End '+esc(date(x.expiresAt)):'')+'</small></div>'+tag(x.status)+'</div>')).join(''):empty('No matching records','Change the filter or search.'));
 }
 setContent(pageHeader('RESTRICTION HISTORY','Current & previous bans','Search the complete Sanctum Eros restriction ledger. Decisions and investigation records remain separate.')+
  card('<div class="hq-form-grid"><label>Search<input id="banSearch" type="search" placeholder="Name or username"></label><label>Status<select id="banFilter"><option value="all">All statuses</option><option>Active</option><option>Temporary</option><option>Lifted</option><option>Expired</option><option>Inactive</option></select></label></div>')+'<div id="banRows"></div>');
 $('#banSearch').oninput=e=>{search=e.target.value.toLowerCase();render()};
 $('#banFilter').onchange=e=>{filter=e.target.value;render()};render();
}
async function communityChatPage(){
 const data=await api('community-chat'),rooms=data.rooms||[];
 let active=context.chatRoom||rooms.find(r=>r.joined)?.id||rooms[0]?.id||'';
 if(!rooms.some(r=>r.id===active))active=rooms[0]?.id||'';
 context.chatRoom=active;
 const room=rooms.find(r=>r.id===active);
 const roomIcon={selc:'◈',leaders:'◇',educators:'✦',network:'◎','staff-educators':'▤'};
 const tabs=rooms.map(r=>'<button type="button" class="messenger-room'+(r.id===active?' active':'')+'" data-chat-room="'+esc(r.id)+'" aria-current="'+(r.id===active?'true':'false')+'"><span class="messenger-room-icon">'+esc(roomIcon[r.id]||'◈')+'</span><span class="messenger-room-name">'+esc(r.name)+'</span>'+(r.unread?'<span class="messenger-unread">'+number(r.unread)+'</span>':'')+(r.joined?'<span class="messenger-joined" title="Joined">●</span>':'')+'</button>').join('');
 const main=room?'<section class="messenger-conversation"><div class="messenger-header"><div class="messenger-room-icon">'+esc(roomIcon[room.id]||'◈')+'</div><div class="messenger-header-text"><h2>'+esc(room.name)+'</h2><p>'+esc(room.description)+'</p></div>'+(room.joined?'<button class="messenger-leave" data-chat-leave title="Leave room">Leave</button>':'')+'</div>'+
 (room.joined?
 '<div class="messenger-search"><input id="chatSearch" type="search" placeholder="Search this conversation" aria-label="Search messages"></div><div id="chatPinned" class="messenger-pinned" hidden></div><div id="chatMessages" class="messenger-messages" role="log" aria-live="polite" aria-relevant="additions"><div class="messenger-empty">Loading conversation…</div></div><div id="chatReplyPreview" class="messenger-reply-preview" hidden><span id="chatReplyText"></span><button type="button" id="chatCancelReply" aria-label="Cancel reply">×</button></div><form id="chatSend" class="messenger-composer"><label class="sr-only" for="chatMessage">Message</label><textarea id="chatMessage" name="message" rows="1" maxlength="1200" placeholder="Message '+esc(room.name)+'…" required></textarea><button type="submit" aria-label="Send message"><span aria-hidden="true">➤</span></button></form><p id="chatStatus" class="messenger-status" role="status"></p>':
 '<div class="messenger-welcome"><span class="messenger-welcome-icon">'+esc(roomIcon[room.id]||'◈')+'</span><h3>'+esc(room.name)+'</h3><p>Join this conversation to see messages and participate.</p>'+btn('Join conversation','data-chat-join','primary')+'</div>')+'</section>':
 '<div class="messenger-welcome"><h3>No conversations available</h3><p>Approved roles can join their eligible rooms.</p></div>';
 setContent('<section class="messenger-shell" aria-label="Community conversations"><div class="messenger-intro"><span class="hq-eyebrow">SELC / CONVERSATIONS</span><h1>Messages</h1><p>Keep your teams connected, without mixing private channels.</p></div><div class="messenger-layout"><aside class="messenger-sidebar"><div class="messenger-sidebar-title">Your rooms <span>'+number(rooms.length)+'</span></div><nav class="messenger-rooms" aria-label="Chat rooms">'+tabs+'</nav></aside>'+main+'</div></section>');
 $$('[data-chat-room]').forEach(button=>button.onclick=()=>{context.chatRoom=button.dataset.chatRoom;communityChatPage()});
 if(!room)return;
 if(!room.joined){$('[data-chat-join]').onclick=async()=>{try{await post('community-chat','join',{room:active});communityChatPage()}catch(error){flash(error.message)}};return}
 $('[data-chat-leave]').onclick=async()=>{if(!confirmDecision('Leave '+room.name+'? You can join again later.'))return;try{await post('community-chat','leave',{room:active});communityChatPage()}catch(error){flash(error.message)}};
 const form=$('#chatSend'),textarea=$('#chatMessage'),messages=$('#chatMessages'),pinned=$('#chatPinned'),search=$('#chatSearch');
 let latest=[],lastRead='',busy=false;
 const me=String(context.me?.accountId||context.me?.id||'');
 const myMessage=m=>m.by==='member:'+me||m.by==='owner:'+me||m.by==='staff:'+me||(role()==='founder'&&m.by?.startsWith('owner:'));
 const avatar=name=>'<span class="messenger-avatar" aria-hidden="true">'+esc(initials(name))+'</span>';
 const time=at=>{const d=new Date(at);return Number.isFinite(+d)?new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit'}).format(d):''};
 function render(all){
  const bottom=messages.scrollHeight-messages.scrollTop-messages.clientHeight<100;
  const index=new Map(all.map(m=>[m.id,m]));
  messages.innerHTML=all.length?all.map((m,i)=>{
   const mine=myMessage(m),parent=index.get(m.parentId),same=(i>0&&all[i-1].by===m.by&&Math.abs(new Date(m.createdAt)-new Date(all[i-1].createdAt))<300000);
   return '<article class="messenger-message'+(mine?' mine':'')+(same?' grouped':'')+'" data-message-id="'+esc(m.id)+'">'+(same?'':avatar(m.name))+'<div class="messenger-bubble-wrap">'+(same?'':'<div class="messenger-sender">'+esc(m.name)+'</div>')+
    '<div class="messenger-bubble">'+(parent?'<div class="messenger-quote">'+esc(parent.name)+': '+esc(parent.message||'Original message removed')+'</div>':'')+
    '<p>'+esc(m.message)+'</p></div><div class="messenger-meta">'+time(m.createdAt)+(m.editedAt?' · edited':'')+(m.pinned?' · Pinned':'')+'</div>'+
    '<div class="messenger-message-actions"><button type="button" data-chat-reply="'+esc(m.id)+'">Reply</button>'+(mine||leader()?'<button type="button" data-chat-edit="'+esc(m.id)+'">Edit</button><button type="button" data-chat-delete="'+esc(m.id)+'">Delete</button>':'')+(leader()?'<button type="button" data-chat-pin="'+esc(m.id)+'" data-pinned="'+(!m.pinned)+'">'+(m.pinned?'Unpin':'Pin')+'</button>':'')+'</div></div></article>'
  }).join(''):'<div class="messenger-empty"><span>✦</span><h3>No messages yet</h3><p>Start the conversation.</p></div>';
  const pins=all.filter(m=>m.pinned);
  pinned.hidden=!pins.length;
  pinned.innerHTML=pins.length?'<strong>Pinned</strong><span>'+pins.slice(-2).map(m=>esc(m.message.slice(0,90))).join(' · ')+'</span>':'';
  $$('[data-chat-reply]',messages).forEach(b=>b.onclick=()=>{const m=index.get(b.dataset.chatReply);if(!m)return;form.dataset.replyTo=m.id;$('#chatReplyText').textContent='Replying to '+m.name+': '+m.message.slice(0,90);$('#chatReplyPreview').hidden=false;textarea.focus()});
  $$('[data-chat-edit]',messages).forEach(b=>b.onclick=async()=>{const m=index.get(b.dataset.chatEdit);if(!m)return;const next=prompt('Edit message',m.message);if(next===null||next===m.message)return;try{await post('community-chat','edit',{room:active,messageId:m.id,message:next});await refresh()}catch(e){flash(e.message)}});
  $$('[data-chat-delete]',messages).forEach(b=>b.onclick=async()=>{if(!confirmDecision('Delete this message?'))return;try{await post('community-chat','delete',{room:active,messageId:b.dataset.chatDelete});await refresh()}catch(e){flash(e.message)}});
  $$('[data-chat-pin]',messages).forEach(b=>b.onclick=async()=>{try{await post('community-chat','pin',{room:active,messageId:b.dataset.chatPin,pinned:b.dataset.pinned==='true'});await refresh()}catch(e){flash(e.message)}});
  if(bottom)messages.scrollTop=messages.scrollHeight;
 }
 async function refresh(){
  if(context.activePage!=='chat'||context.chatRoom!==active||busy)return;
  busy=true;
  try{
   const result=await api('community-chat',{query:{room:active,search:search.value.trim()}});
   latest=result.messages||[];render(latest);
   const newest=latest.at(-1)?.createdAt||'';
   if(newest&&newest!==lastRead&&!search.value.trim()){lastRead=newest;await post('community-chat','read',{room:active}).catch(()=>{})}
  }catch(e){$('#chatStatus').textContent=e.message}finally{
   busy=false;
   if(context.activePage==='chat'&&context.chatRoom===active)context.chatTimer=setTimeout(refresh,12000);
  }
 }
 $('#chatCancelReply').onclick=()=>{delete form.dataset.replyTo;$('#chatReplyPreview').hidden=true};
 form.addEventListener('submit',async e=>{
  e.preventDefault();const message=textarea.value.trim();if(!message)return;
  const button=form.querySelector('button[type="submit"]');button.disabled=true;
  try{await post('community-chat','send',{room:active,message,parentId:form.dataset.replyTo||''});textarea.value='';textarea.style.height='';delete form.dataset.replyTo;$('#chatReplyPreview').hidden=true;await refresh();$('#chatStatus').textContent=''}
  catch(error){$('#chatStatus').textContent=error.message}finally{button.disabled=false}
 });
 textarea.oninput=()=>{textarea.style.height='auto';textarea.style.height=Math.min(120,textarea.scrollHeight)+'px'};
 textarea.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit()}};
 let debounce;search.oninput=()=>{clearTimeout(debounce);debounce=setTimeout(()=>refresh(),240)};
 await refresh();
}
async function contentManagementPage(){
 const result=await api('selc-content'),rows=result.proposals||[];
 const choices=[['hub','Hub'],['portal','Member Portal'],['selc','SELC website']];
 let html=pageHeader('WEBSITE EDITOR','Website & content management','Edit written content, review the committee vote and publish only after Founder approval.')+
  card('<h2>Propose a change</h2><form id="newContent" class="hq-form"><div class="hq-form-grid"><label>Website<select name="site">'+choices.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></label><label>Page path<input name="path" placeholder="/about/" value="/" required></label></div><label>Exact existing text<textarea name="original" rows="3" required maxlength="2000"></textarea></label><label>Replacement text<textarea name="replacement" rows="4" required maxlength="2000"></textarea></label><label>Reason or context<input name="summary" maxlength="400"></label><p class="hq-muted">This changes displayed wording only. It cannot change code, calculations, permissions or payments. Multiple identical matches on a page will all update.</p><p data-status></p><button class="hq-button primary">Send to committee vote</button></form>');
 html+='<h2 style="margin:20px 0 10px">Change proposals</h2>';
 html+=rows.length?rows.map(p=>card('<div class="hq-row"><div class="grow"><small>'+esc(p.site.toUpperCase())+' · '+esc(p.path)+'</small><strong>'+esc(p.summary||p.original.slice(0,90))+'</strong><p><del>'+esc(p.original.slice(0,180))+'</del></p><p>'+esc(p.replacement.slice(0,180))+'</p><small>Votes: '+number(p.tally?.yes)+' support / '+number(p.tally?.needed)+' needed · '+number(p.tally?.no)+' oppose</small></div>'+tag(p.status)+btn('Review','data-content-id="'+esc(p.id)+'"')+'</div>')).join(''):empty('No changes submitted yet');
 setContent(html);
 const editor=$('#newContent');
 const action=document.createElement('div');action.className='hq-actions';
 const picker=document.createElement('button');picker.type='button';picker.className='hq-button primary';picker.textContent='Select wording on a live page';
 const hint=document.createElement('small');hint.className='hq-muted';hint.textContent='Choose the page, then tap the exact text you want to change.';
 action.append(picker,hint);
 const preview=document.createElement('div');preview.className='editor-copy-compare';
 const current=document.createElement('section'),proposed=document.createElement('section');
 const previousLabel=document.createElement('strong');previousLabel.textContent='Original';
 const proposedLabel=document.createElement('strong');proposedLabel.textContent='Proposed';
 const beforeText=document.createElement('p'),afterText=document.createElement('p');
 current.append(previousLabel,beforeText);proposed.append(proposedLabel,afterText);preview.append(current,proposed);
 editor.querySelector('[data-status]').before(action,preview);
 const updatePreview=()=>{
  beforeText.textContent=editor.elements.original.value.trim()||'Select a paragraph, heading, or button.';
  afterText.textContent=editor.elements.replacement.value.trim()||'Your replacement text appears here.';
 };
 editor.addEventListener('input',updatePreview);updatePreview();
 picker.onclick=()=>{
  const site=editor.elements.site.value,path=editor.elements.path.value.trim();
  const origins={hub:'https://sanctumeroshub.org',portal:'https://sanctumportal.org',selc:'https://se-selc.netlify.app'};
  if(!/^\/[a-zA-Z0-9/_.-]*$/.test(path)||path.includes('..')){flash('Use a valid page path beginning with /.');return}
  const origin=origins[site];if(!origin)return;
  const target=new URL(path,origin);target.searchParams.set('selc_pick','1');
  const popup=window.open(target.href,'_blank');
  if(!popup){flash('The page picker was blocked. Open the page and copy the text manually.');return}
  if(context.editorPickListener)removeEventListener('message',context.editorPickListener);
  context.editorPickListener=e=>{
   if(e.origin!==origin||e.source!==popup||e.data?.type!=='SELC_COPY_PICK'||e.data.site!==site||typeof e.data.text!=='string')return;
   const selected=e.data.text.trim().slice(0,2000);
   if(!selected)return;
   editor.elements.original.value=selected;
   editor.elements.path.value=String(e.data.path||path).split('?')[0].slice(0,220);
   updatePreview();
   flash('Wording selected. Enter the replacement and submit it for voting.');
   editor.elements.replacement.focus();
  };
  addEventListener('message',context.editorPickListener);
 };
 watchForm(editor,async values=>{await post('selc-content','propose',values);flash('Sent for committee vote.');contentManagementPage()});
 $$('[data-content-id]').forEach(b=>b.onclick=()=>{
  const p=rows.find(x=>x.id===b.dataset.contentId);if(!p)return;
  const base=p.site==='hub'?'https://sanctumeroshub.org':p.site==='selc'?'https://se-selc.netlify.app':'https://sanctumportal.org';
  const votes=p.status==='Voting'&&!owner()?'<h3>Vote</h3><div class="hq-actions">'+btn('Support','data-content-vote="yes"','primary')+btn('Oppose','data-content-vote="no"')+btn('Abstain','data-content-vote="abstain"')+'</div>':'';
  const founder=owner()?'<h3>Founder review</h3><div class="hq-actions">'+(p.tally?.passed&&['Voting','Awaiting Founder'].includes(p.status)?btn('Approve & publish','data-content-decision="approve"','primary'):'')+(p.status==='Published'?btn('Rollback change','data-content-decision="rollback"'):'')+(p.status==='Voting'||p.status==='Awaiting Founder'?btn('Return for edits','data-content-decision="return"')+btn('Decline','data-content-decision="decline"','danger'):'')+'</div>':'';
  const dialog=modal('Review website text','<p><a target="_blank" rel="noopener noreferrer" href="'+base+esc(p.path)+'">View affected page ↗</a></p><h3>Current wording</h3>'+card('<p class="hq-prose">'+esc(p.original)+'</p>')+'<h3>Proposed wording</h3>'+card('<p class="hq-prose">'+esc(p.replacement)+'</p>')+'<p>'+tag(p.status)+' · '+number(p.tally?.yes)+' support · '+number(p.tally?.needed)+' required</p>'+votes+founder);
  $$('[data-content-vote]',dialog).forEach(x=>x.onclick=async()=>{try{await post('selc-content','vote',{id:p.id,vote:x.dataset.contentVote});dialog.close();contentManagementPage()}catch(e){flash(e.message)}});
  $$('[data-content-decision]',dialog).forEach(x=>x.onclick=async()=>{try{await post('selc-content','decide',{id:p.id,decision:x.dataset.contentDecision,reason:''});dialog.close();contentManagementPage()}catch(e){flash(e.message)}});
 });
}


/* -----------------------------------------------------------------
   Shared member correspondence, idea review and volunteer availability.
   These screens read and write the Portal's one authoritative datastore.
------------------------------------------------------------------ */
const deskRoleLabel=()=>RANK[role()]||'SELC Representative';
function deskThreadHtml(row){
 const thread=row.kind==='incident'?[{from:'member',text:row.message||'',at:row.createdAt},...(row.thread||[])]:row.thread||[{from:'member',text:row.message||'',at:row.createdAt}];
 return '<div class="desk-conversation">'+thread.map(m=>'<div class="hq-message '+(m.from==='member'?'hq-member-message':'hq-selc-message')+'"><p>'+esc(m.text||'').replaceAll('\n','<br>')+'</p><small>'+esc(m.from==='member'?'Member':(m.by||'Sanctum Eros')+' — '+(m.role||deskRoleLabel()))+' · '+esc(date(m.at))+'</small></div>').join('')+'</div>';
}
async function communityInboxPage(){
 const scopes=['messages','suggestions','feedback'];
 const loaded=await Promise.allSettled(scopes.map(scope=>api('committee-desk',{query:{scope}})));
 const data=loaded.map(x=>x.status==='fulfilled'?x.value:null);
 const cards=[
  ['Member messages & complaints',(data[0]?.messages||[]).length,'memberdesk','Read and respond to member-authorized conversations, complaints and opted-in reports'],
  ['Suggestions',(data[1]?.suggestions||[]).length,'suggestionsdesk','Review ideas, respond where permitted and promote them to committee proposals'],
  ['Event feedback',(data[2]?.reviews||[]).length,'feedbackdesk','Review member event experiences and approved public comments']
 ];
 let markup=pageHeader('COMMUNITY / CORRESPONDENCE','Community Inbox','One place to triage communications while preserving the independent privacy controls on each record.');
 markup+='<div class="hq-grid">'+cards.map(([name,count,page,desc])=>card('<span class="hq-eyebrow">'+esc(name)+'</span><h2>'+number(count)+'</h2><p>'+esc(desc)+'</p>'+btn('Open','data-page-link="'+esc(page)+'"','primary'))).join('')+'</div>';
 if(data.some(x=>!x))markup+=card('<p>One or more message services are temporarily unavailable. Open the relevant category to see its current status.</p>');
 markup+=card('<p class="hq-micro">Private correspondence addressed directly to Eros is not included in SELC shared queues unless the sender explicitly authorized sharing. Incident records remain subject to IA access controls.</p>');
 setContent(markup);bindPageLinks();
}
async function memberDeskPage(){
 const d=await api('committee-desk',{query:{scope:'messages'}}),rows=d.messages||[];
 let markup=pageHeader('MEMBER CORRESPONDENCE','Messages & complaints','A shared inbox for communications members have authorized SELC to see. Eros-only conversations stay private.');
 markup+='<div class="hq-stats"><div class="hq-stat"><small>CONVERSATIONS</small><strong>'+rows.length+'</strong></div><div class="hq-stat"><small>NEED REVIEW</small><strong>'+Number(d.counts?.new||0)+'</strong></div></div>';
 markup+=rows.length?rows.map((r,i)=>card('<div class="hq-row"><div class="grow"><span class="hq-eyebrow">'+esc(r.kind==='incident'?'Opted-in IA report':r.type==='complaint'?'Complaint':r.type==='portal_problem'?'Portal issue':'Member message')+'</span><h2>'+esc(r.subject||'Message')+'</h2><p>'+esc(String(r.message||'').slice(0,180))+'</p><p class="hq-micro">'+esc(r.username||r.caseNumber||'Member')+' · '+esc(date(r.updatedAt||r.createdAt))+'</p></div>'+tag(r.status)+btn('Open conversation','data-member-msg="'+i+'"','primary')+'</div>')).join(''):empty('No shared messages right now','Opted-in member conversations and reports appear here.');
 setContent(markup);
 $$('[data-member-msg]').forEach(el=>el.onclick=()=>{
  const r=rows[Number(el.dataset.memberMsg)],dialog=modal(r.subject||'Member conversation',
   '<p class="hq-micro">'+esc(r.kind==='incident'?'Private report':r.type==='complaint'?'Complaint':'Message')+' · '+esc(r.status||'Submitted')+'</p>'+
   '<section class="hq-case-message"><h3>Full member message / question</h3><p style="white-space:pre-wrap;overflow-wrap:anywhere">'+esc(r.message||'')+'</p>'+(r.kind==='incident'&&r.requestedFollowUp?'<h4>Follow-up requested</h4><p style="white-space:pre-wrap">'+esc(r.requestedFollowUp)+'</p>':'')+'</section>'+deskThreadHtml(r)+
   '<div class="hq-actions">'+btn('Mark reviewed','data-mark-message','')+'</div>'+
   '<form class="hq-form" id="deskReplyForm"><label>Reply as '+esc(context.me.screenName||context.me.displayName)+' — '+esc(deskRoleLabel())+'</label><textarea name="message" rows="5" maxlength="6000" required placeholder="Write a reply to this member…"></textarea><p data-status></p><button class="hq-button primary" type="submit">Send reply</button></form>');
  dialog.querySelector('[data-mark-message]').onclick=async()=>{try{await post('committee-desk','review_message',{kind:r.kind,id:r.id,accountId:r.accountId});dialog.close();flash('Marked reviewed.');await memberDeskPage()}catch(e){flash(e.message)}};
  watchForm(dialog.querySelector('#deskReplyForm'),async values=>{await post('committee-desk','reply_message',{kind:r.kind,id:r.id,accountId:r.accountId,message:values.message});dialog.close();flash('Reply sent to member Portal.');await memberDeskPage()});
 });
}
async function suggestionsDeskPage(){
 const d=await api('committee-desk',{query:{scope:'suggestions'}}),rows=d.suggestions||[];
 let markup=pageHeader('COMMUNITY IDEAS','Suggestions to review','Ideas are submitted through the Member Portal. Review them, reply where permitted, or promote an idea to a committee proposal.');
 markup+=rows.length?rows.map((s,i)=>card('<div class="hq-row"><div class="grow"><span class="hq-eyebrow">'+esc((s.category||'other').replaceAll('_',' '))+'</span><h2>'+esc(s.title)+'</h2><p>'+esc((s.details||'').slice(0,190))+'</p><p class="hq-micro">'+esc(s.name||'Anonymous')+' · '+esc(date(s.createdAt))+(s.proposalId?' · Linked committee proposal':'')+'</p></div>'+tag(s.status)+btn('Review','data-suggestion="'+i+'"','primary')+'</div>')).join(''):empty('No suggestions yet','Member suggestions appear here after submission.');
 setContent(markup);
 $$('[data-suggestion]').forEach(el=>el.onclick=()=>{
  const row=rows[Number(el.dataset.suggestion)];
  const dialog=modal(row.title,
   '<p>'+esc(row.details||'').replaceAll('\n','<br>')+'</p>'+(row.link?'<p><a href="'+esc(row.link)+'" target="_blank" rel="noopener noreferrer">Reference link ↗</a></p>':'')+
   (row.thread?.length?'<h3>Replies</h3>'+row.thread.map(m=>'<div class="hq-message"><p>'+esc(m.text)+'</p><small>'+esc(m.by||'SELC')+' — '+esc(m.role||'SELC Representative')+'</small></div>').join(''):'')+
   '<form class="hq-form" id="ideaStatus"><label>Review status</label><select name="status">'+[['reviewed','Reviewed'],['considering','Considering'],['planned','Planned'],['done','Completed'],['not_now','Not right now']].map(([id,label])=>'<option value="'+id+'"'+(row.status===id?' selected':'')+'>'+label+'</option>').join('')+'</select><p data-status></p><button class="hq-button" type="submit">Save review</button></form>'+
   (row.replyAllowed?'<form class="hq-form" id="ideaReply"><label>Reply to the member</label><textarea name="message" rows="4" maxlength="6000" required></textarea><p data-status></p><button class="hq-button" type="submit">Send reply</button></form>':'<p class="hq-micro">The sender has not enabled Portal replies.</p>')+
   (row.proposalId?'<p class="hq-micro">Already forwarded to committee voting.</p>':btn('Move into committee proposals','data-promote-suggestion','primary')));
  watchForm(dialog.querySelector('#ideaStatus'),async x=>{await post('committee-desk','review_suggestion',{id:row.id,status:x.status});dialog.close();flash('Suggestion reviewed.');await suggestionsDeskPage()});
  if(row.replyAllowed)watchForm(dialog.querySelector('#ideaReply'),async x=>{await post('committee-desk','reply_suggestion',{id:row.id,message:x.message});dialog.close();flash('Reply sent.');await suggestionsDeskPage()});
  dialog.querySelector('[data-promote-suggestion]')?.addEventListener('click',async()=>{
   try{await post('committee-desk','promote_suggestion',{id:row.id});dialog.close();flash('Added to committee proposals. Voting and final Chair approval happen there.');await suggestionsDeskPage()}catch(e){flash(e.message)}
  });
 });
}
async function feedbackDeskPage(){
 const d=await api('committee-desk',{query:{scope:'feedback'}}),rows=d.reviews||[];
 let markup=pageHeader('EVENT EXPERIENCE','Event feedback review','Member ratings and opted-in private feedback. Only explicitly approved public comments can appear on the 30-day community board.');
 markup+=rows.length?rows.map((r,i)=>card('<div class="hq-row"><div class="grow"><span class="hq-eyebrow">'+esc(r.eventTitle)+'</span><h2>'+Number(r.rating||0)+'/5 · '+esc(r.reviewStatus||'New')+'</h2>'+(r.publicReview?'<p>Public comment: '+esc(r.publicReview).slice(0,180)+'</p>':'')+(r.privateFeedback?'<p>Private: '+esc(r.privateFeedback).slice(0,180)+'</p>':'')+'<p class="hq-micro">'+esc(date(r.updatedAt||r.createdAt))+' · '+(r.publicConsent?'Approved by member for possible publication':'No publication consent')+'</p></div>'+tag(r.showOnBoard?'On public board':r.reviewStatus)+btn('Review','data-event-feedback="'+i+'"','primary')+'</div>')).join(''):empty('No feedback ready for review','Submitted event feedback appears here when members choose to share it with SELC.');
 setContent(markup);
 $$('[data-event-feedback]').forEach(el=>el.onclick=()=>{
  const r=rows[Number(el.dataset.eventFeedback)];
  const dialog=modal('Event feedback — '+r.eventTitle,'<p><strong>Rating:</strong> '+r.rating+'/5</p><p><strong>Public comment:</strong> '+esc(r.publicReview||'None').replaceAll('\n','<br>')+'</p><p><strong>Private feedback:</strong> '+esc(r.privateFeedback||'Not shared').replaceAll('\n','<br>')+'</p>'+
   '<form class="hq-form" id="reviewFeedback"><label>Review decision</label><select name="status">'+[['Reviewed','Reviewed'],['For Discussion','For discussion'],['Closed','Closed']].map(([v,l])=>'<option value="'+v+'"'+(r.reviewStatus===v?' selected':'')+'>'+l+'</option>').join('')+'</select>'+
   '<label>Public feedback board</label><select name="boardAction"><option value="">Do not change</option>'+(r.publicConsent&&r.publicReview?'<option value="publish">Publish anonymously for 30 days</option>':'')+'<option value="remove">Remove from public board</option></select>'+
   '<p class="hq-micro">Board removal retains the internal review record, ratings and audit history.</p><p data-status></p><button class="hq-button primary" type="submit">Save review</button></form>');
  watchForm(dialog.querySelector('#reviewFeedback'),async x=>{await post('committee-desk','review_feedback',{id:r.id,status:x.status,boardAction:x.boardAction});dialog.close();flash('Event feedback updated.');await feedbackDeskPage()});
 });
}
async function availabilityPage(){
 const [home,d]=await Promise.all([api('selc-governance',{query:{scope:'home'}}),api('selc-governance',{query:{scope:'members'}})]);
 const me=(d.members||[]).find(x=>x.accountId===home.me?.accountId);
 if(!me)return setContent(empty('No active committee role','Only active SELC Representatives and Coordinators can change availability.'));
 const current=me.availability||{status:'Available',note:'',until:''};
 let markup=pageHeader('YOUR PARTICIPATION','Availability','Set when you can take new committee assignments. Other SELC members can see your status and optional return date.');
 markup+=card('<h2>Your status</h2><form class="hq-form" id="availabilityForm"><label>Status</label><select name="status">'+['Available','Busy','Away','Unavailable'].map(x=>'<option value="'+x+'"'+(current.status===x?' selected':'')+'>'+x+'</option>').join('')+'</select><label>Note (optional)</label><input type="text" name="note" maxlength="180" value="'+esc(current.note||'')+'" placeholder="For example, unavailable for event setup this week"><label>Until (optional)</label><input type="date" name="until" value="'+esc(current.until||'')+'"><p data-status></p><button class="hq-button primary" type="submit">Save availability</button></form>');
 markup+=card('<h2>Team availability</h2>'+(d.members||[]).map(x=>'<div class="hq-row"><div class="grow"><strong>'+esc(x.displayName)+'</strong><p>'+esc(x.availability?.note||'')+(x.availability?.until?' · Through '+esc(x.availability.until):'')+'</p></div>'+tag(x.availability?.status||'Available')+'</div>').join(''));
 setContent(markup);
 watchForm($('#availabilityForm'),async x=>{await post('selc-governance','update_availability',x);flash('Availability updated.');await availabilityPage()});
}

async function accountPage(){
 const external=organizerRole(role());
 const [shared,home,committee]=await Promise.all([
  api('workspace-profile').catch(()=>null),
  participantRole(role())?api('selc-governance',{query:{scope:'home'}}).catch(()=>null):Promise.resolve(null),
  participantRole(role())?api('selc-governance',{query:{scope:'members'}}).catch(()=>null):Promise.resolve(null)
 ]);
 const me=(committee?.members||[]).find(p=>p.accountId===home?.me?.accountId)||null;
 let markup=pageHeader('YOUR ACCOUNT',external?'Community Leaders account':'Your SELC space',external?'Your verified account does not grant Sanctum Eros membership or committee access.':'Your Portal account is linked to your SELC role, but your public screen name can be different.');
 markup+=card('<div class="hq-row"><div class="grow"><strong>'+esc(context.me.displayName)+'</strong><p>'+esc(context.me.isStaff&&['representative','coordinator'].includes(role())?'Staff + '+(role()==='coordinator'?'Coordinator':'Representative'):(RANK[role()]||role()))+'</p></div>'+tag('Active session')+'</div>'+(shared?.roles?.length?'<h3>Your connected roles</h3><div class="hq-actions">'+shared.roles.map(r=>tag(r)).join('')+'</div>':'')+'<p>'+(external?'Use the Community Leaders network to check application status and collaborate after approval. Account recovery uses the Portal email service.':'Your personal Portal handles your member profile, password, tickets and course records. A SELC screen name does not change your login.')+'</p>');
 if(me&&role()!=='founder'){
  markup+=card('<h2>Public-facing SELC name</h2><p>Your public directory listing is enabled by default. You can turn it off at any time. Separately, choose the name shown publicly; this never changes your account login.</p><form class="hq-form" id="selcIdentityForm"><label for="selcScreenName">Public display name (separate from your login)</label><input id="selcScreenName" name="publicName" required minlength="2" maxlength="80" value="'+esc(me.screenName||me.displayName||'')+'"><label class="hq-check"><input type="checkbox" name="publicProfile" '+(me.publicProfile!==false?'checked':'')+'> Show my public display name and leadership role on the SELC website</label><p class="hq-micro">When this is turned off, your name remains visible to authorized committee members but not in the public directory.</p><p data-status role="status"></p><button class="hq-button primary" type="submit">Save my SELC name</button></form>');
 }
 markup+=card('<h2>Connected account</h2><div class="hq-actions">'+(external?'<a class="hq-button" href="/community-leaders/#apply">Organizer account &amp; password help ↗</a>':'<a class="hq-button" href="'+PORTAL+'/member.html#account" rel="noopener noreferrer">Manage member account ↗</a>')+btn('Sign out of SELC','data-signout','danger')+'</div>');
 setContent(markup);
 $('[data-signout]').onclick=signOut;
 const f=$('#selcIdentityForm');
 if(f)watchForm(f,async(values,form)=>{
  const data=await post('selc-governance','update_public_identity',{publicName:values.publicName,publicParticipation:values.publicParticipation,publicProfile:form.querySelector('[name=publicProfile]').checked});
  const name=data.member?.screenName||values.publicName;
  setStatus(form.querySelector('[data-status]'),'Saved. Your SELC screen name is '+name+'.');
  flash('SELC name updated.');
  await loadPublicLeadership().catch(()=>{});
 });
}
addEventListener('DOMContentLoaded',startPublic);
})();
