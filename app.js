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
const RANK={founder:'Founder & Chair',coordinator:'SELC Coordinator',representative:'SELC Representative',member:'Community Member','community-applicant':'Community Leaders applicant','community-leader':'Approved Community Leader'};
const committeeRole=u=>['founder','coordinator','representative'].includes(u);
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
  const bySeat=new Map((data.people||[]).map(p=>[Number(p.seat),p]));
  host.innerHTML=[1,2,3,4,5].map(n=>{const person=bySeat.get(n);return '<div class="seat-card"><span>'+String(n).padStart(2,'0')+'</span><strong>'+esc(person?.publicName||'Representative')+'</strong><small>'+esc(person?.role==='coordinator'?'Coordinator & Representative':person?'SELC Representative':n<=3?'Venue + online':'Online-first')+'</small></div>'}).join('');
}
async function beginHeadquarters(){
 const session=await api('selc-auth');
 context.me={role:session.role,displayName:session.displayName,owner:session.owner};
 $('#publicSite').classList.add('hidden');$('#headquarters').classList.remove('hidden');$('#headquarters').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';
 $('#hqUserName').textContent=context.me.displayName||'Member';$('#hqInitials').textContent=initials(context.me.displayName);$('#hqRole').textContent=RANK[role()]||'Community Member';$('#hqRoleChip').textContent=(RANK[role()]||'Member').toUpperCase();
 setupHQNav();const hash=location.hash.split('/')[1];await openPage(hash||(organizerRole(role())?'communityleaders':'home'));
}
const NAV=[
 ['home','⌂','Overview','Your work',u=>!organizerRole(u)],
 ['founderdesk','◈','Founder desk','Leadership',u=>u==='founder'],
 ['join','✎','Apply to SELC','Your work',u=>u==='member'],
 ['certification','✓','SELC certification','Your work',u=>!organizerRole(u)&&u!=='founder'],
 ['coordinator','⇧','Coordinator application','Your work',u=>u==='representative'],
 ['ballots','✓','Coordinator election','Your work',u=>u==='representative'||u==='coordinator'],
 ['applications','▤','SELC applications','Leadership',u=>u==='founder'||u==='coordinator'],
 ['leader','◈','Leadership & appointments','Leadership',u=>u==='founder'||u==='coordinator'||u==='representative'],
 ['availability','◷','My availability','Your work',u=>committeeRole(u)&&u!=='founder'],
 ['work','▣','Leadership Action Center','Leadership',u=>committeeRole(u)],
 ['library','▤','Staff & SELC Handbook','Leadership',u=>committeeRole(u)],
 ['memberdesk','✉','Member messages & complaints','Committee',u=>committeeRole(u)],
 ['suggestionsdesk','◇','Member suggestions','Committee',u=>committeeRole(u)],
 ['feedbackdesk','▤','Event feedback review','Committee',u=>committeeRole(u)],
 ['proposals','◉','Proposals & votes','Committee',u=>committeeRole(u)],
 ['content','✎','Website content','Committee',u=>committeeRole(u)],
 ['chat','▤','Community chat','Community',u=>!['community-applicant'].includes(u)],
 ['requests','↗','Community conversations','Committee',u=>committeeRole(u)],
 ['communityleaders','◇','Community Leaders network','Partnerships'],
 ['applyeducator','✦','Become a Community Educator','Education',u=>!organizerRole(u)],
 ['educatorreviews','▤','Educator applications','Education',u=>u==='founder'||u==='coordinator'],
 ['educators','✦','Education & workshops','Committee',u=>committeeRole(u)],
 ['generalapps','▧','Member & role applications','Event operations',u=>committeeRole(u)],
 ['events','▦','Events & RSVPs','Event operations',u=>committeeRole(u)],
 ['volunteer','✋','Volunteer shifts','Event operations',u=>committeeRole(u)],
 ['readiness','▣','Event readiness','Event operations',u=>committeeRole(u)],
 ['door','⌗','Check-in & tickets','Event operations',u=>committeeRole(u)],
 ['banreports','⚑','Ban Reports','Safety',u=>committeeRole(u)],
 ['banhistory','⌛','Ban history','Safety',u=>committeeRole(u)],
 ['appeals','⚖','Access appeals','Safety',u=>u==='coordinator'||u==='founder'],
 ['myaccount','◎','My account','Your work']
];
function setupHQNav(){
 const root=$('#hqNavigation');let last='';root.innerHTML=NAV.filter(item=>!item[4]||item[4](role())).map(([id,ico,label,group])=>{let groupPart='';if(group!==last){groupPart='<p class="nav-group">'+esc(group)+'</p>';last=group}return groupPart+'<button type="button" data-page="'+esc(id)+'"><span class="nav-emoji">'+esc(ico)+'</span><span>'+esc(label)+'</span></button>'}).join('');
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
 if(context.chatTimer){clearTimeout(context.chatTimer);context.chatTimer=null}
 if(context.editorPickListener){removeEventListener('message',context.editorPickListener);context.editorPickListener=null}
 const allowed=NAV.find(n=>n[0]===page&&(!n[4]||n[4](role())));
 if(!allowed)page=organizerRole(role())?'communityleaders':'home';context.activePage=page;
 $$('#hqNavigation [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 $('#hqCurrentSection').textContent=allowed?.[2]?.toUpperCase()||'HEADQUARTERS';
 if(location.hash!=='#/'+page)history.replaceState(null,'','#/'+page);
 load();
 try{
  const pages={memberdesk:memberDeskPage,suggestionsdesk:suggestionsDeskPage,feedbackdesk:feedbackDeskPage,availability:availabilityPage,founderdesk:founderDeskPage,content:contentManagementPage,chat:communityChatPage,banhistory:banHistoryPage,readiness:eventReadinessPage,home:homePage,join:joinPage,certification:certificationPage,coordinator:coordinatorPage,ballots:ballotsPage,applications:applicationsPage,leader:leaderPage,work:leadershipWorkPage,library:libraryPage,proposals:proposalPage,requests:()=>requestsPage('all'),communityleaders:communityLeadersPage,educators:educationProgramsPage,applyeducator:educatorApplicationPage,educatorreviews:educatorReviewsPage,generalapps:generalAppsPage,events:eventPage,volunteer:volunteerPage,door:doorPage,banreports:banReportsPage,appeals:appealReviewPage,myaccount:accountPage};
  await (pages[page]||homePage)();$('#hqContent')?.scrollTo?.({top:0,behavior:'instant'});
 }catch(error){if(error.status===401){clearAccess();$('#headquarters').classList.add('hidden');$('#publicSite').classList.remove('hidden');document.body.style.overflow='';openLogin();flash('Your session expired. Please sign in again.');return}failure(error)}
}
async function homePage(){
 const jobs=[api('selc-governance',{query:{scope:'home'}})];
 if(leader())jobs.push(api('community-requests'),api('staff-portal'),api('ban-reports'));
 const results=await Promise.allSettled(jobs),home=results[0].status==='fulfilled'?results[0].value:null;
 if(!home)throw results[0].reason||new Error('The leadership workspace is unavailable.');
 context.data.home=home;
 if(!leader()){const pendingCert=(home.myApplications||[]).some(a=>a.status==='Certification Pending');setContent(pageHeader('WELCOME TO SELC','Your next chapter','SELC membership requires approved SE membership, a separate application and acceptance, then certification.')+(pendingCert?card('<h2>Application accepted — certification required</h2><p>Complete your training to activate committee privileges.</p>'+btn('Begin SELC certification','data-page-link="certification"','primary')):card('<h2>Help build something meaningful</h2><p>Apply to join the committee. Acceptance alone never grants internal or voting privileges.</p>'+btn('Apply to be a Representative','data-page-link="join"','primary')))+(home.myApplications?.length?card('<h2>Your applications</h2>'+home.myApplications.map(a=>'<div class="hq-row"><div class="grow"><strong>'+esc(a.type)+' application</strong><p>Submitted '+esc(date(a.createdAt))+'</p></div>'+tag(a.status)+'</div>').join('')):''));bindPageLinks();return}
 const [conv,staff,bans]=results.slice(1).map(r=>r.status==='fulfilled'?r.value:null);
 const proposals=await api('selc-governance',{query:{scope:'proposals'}}).catch(()=>({proposals:[]}));
 const cards=[['SELC SEATS',String(home.occupiedSeats||0)+'/5'],['COORDINATORS',String(home.coordinators||0)+'/2'],['OPEN CONVERSATIONS',number(conv?.openCount||0)],['BAN REPORTS PENDING',number(bans?.pendingCount||0)]];
 let markup=pageHeader('YOUR COMMUNITY / YOUR RESPONSIBILITY','Welcome back, '+(context.me.displayName||'').split(' ')[0],'Leadership is the work we do together—not just the title we hold.',btn('Start a proposal','data-page-link="proposals"','primary'));
 markup+='<div class="hq-stats">'+cards.map(([label,value])=>'<div class="hq-stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></div>').join('')+'</div>';
 markup+='<div class="hq-grid">'+card('<h2>Where your attention can help</h2>'+[
  ['Committee proposals',(proposals.proposals||[]).filter(p=>p.status==='Discussion').length,'proposals'],
  ['Community & educator requests',conv?.openCount||0,'requests'],['Ban Reports awaiting decision',bans?.pendingCount||0,'banreports'],['Upcoming events',activeSELCEvents(staff?.events).length,'events']
 ].map(([label,value,link])=>'<div class="hq-row"><div class="grow"><strong>'+esc(label)+'</strong><p>'+number(value)+' item(s)</p></div>'+btn('Open','data-page-link="'+link+'"')+'</div>').join(''))+
 card('<h2>Quick access</h2><p>All authorized SELC responsibilities live here, using the same event and member records as the Portal.</p><div class="hq-grid-3">'+[['Action Center','work'],['Member messages','memberdesk'],['Suggestions','suggestionsdesk'],['Event feedback','feedbackdesk'],['Applications','generalapps'],['Volunteer shifts','volunteer'],['RSVPs & events','events'],['Door & tickets','door'],['Education','educators'],['Committee vote','ballots'],['Leadership','leader']].map(([label,link])=>btn(label,'data-page-link="'+link+'"')).join('')+'</div>')+'</div>';
 if(!staff)markup+=card('<p>Portal event operations are temporarily unavailable. Other committee tools may still work.</p>');
 setContent(markup);bindPageLinks();
}
function bindPageLinks(root=$('#hqContent')){$$('[data-page-link]',root).forEach(b=>b.addEventListener('click',()=>openPage(b.dataset.pageLink)))}
const REPFIELDS=[['motivation','Why does serving this community matter to you?','Tell us what motivates you and what you hope to build together.'],['experience','What experiences and strengths would you bring?','Community work, kink education, organizing, technical skills, writing, advocacy, or anything else relevant.'],['collaboration','Describe how you handle disagreement or feedback.','We value people who can listen without losing their own voice.'],['consent','How would you support consent, privacy, and community care?','Include how you would handle sensitive information responsibly.'],['participation','How would you like to contribute?','In-person events, online planning, education, outreach, projects, and your realistic availability.'],['example','Tell us about a time you stepped up to help others.','What happened, what did you do, and what would you do differently?']];
function textfield([name,label,hint],value='',required=true){return '<label for="f-'+esc(name)+'">'+esc(label)+'</label><textarea id="f-'+esc(name)+'" name="'+esc(name)+'" rows="4" placeholder="'+esc(hint||'')+'" '+(required?'required':'')+'>'+esc(value)+'</textarea>'}
async function joinPage(){
 const home=context.data.home||await api('selc-governance',{query:{scope:'home'}}),pending=home.myApplications||[];
 let markup=pageHeader('YOUR APPLICATION','Step forward','SELC Representatives help with learning, events, outreach, community connections and thoughtful leadership. Remote participation is welcome.');
 if(pending.length)markup+=card('<h2>Your application history</h2>'+pending.map(a=>'<div class="hq-row"><div class="grow"><strong>Representative application</strong><p>'+esc(date(a.createdAt))+'</p></div>'+tag(a.status)+'</div>').join(''));
 if(role()!=='member'){setContent(markup+card('<h2>You are already on the committee</h2><p>Use the leadership sections to continue your work.</p>'));return}
 markup+=card('<h2>Tell us about yourself</h2><p>This is a chance to tell us what you care about—not a test of who can write the longest answer.</p><form id="repForm" class="hq-form">'+REPFIELDS.map(f=>textfield(f)).join('')+'<label class="checkline"><input type="checkbox" name="truthful" required> These responses reflect my own experience and intentions.</label><p data-status class="hq-form-status" aria-live="polite"></p><button type="submit" class="hq-button primary">Submit Representative application ↗</button></form>');
 setContent(markup);watchForm($('#repForm'),async(data,form)=>{if(!data.truthful)throw new Error('Confirm the accuracy of your application.');const answers=Object.fromEntries(REPFIELDS.map(x=>[x[0],data[x[0]]]));if(answers.motivation.length<80||answers.experience.length<80)throw new Error('Please expand your motivation and experience to at least 80 characters each.');await post('selc-governance','apply_representative',{answers});setStatus(form.querySelector('[data-status]'),'Your application was received.',true);flash('SELC application received.');await openPage('home')})
}

async function certificationPage(){
 const data=await api('selc-governance',{query:{scope:'certification'}}),assignments=data.assignments||[];
 let markup=pageHeader('SELC / REQUIRED TRAINING','SELC certification','Complete training and assessment after Founder acceptance. Your new committee privileges activate only on a verified pass.');
 const completed=data.completed||[];
 if(completed.length)markup+=card('<h2>Your completed certifications</h2>'+completed.map(c=>'<div class="hq-row"><div class="grow"><strong>'+esc(c.type==='coordinator'?'SELC Coordinator':'SELC Representative')+' · Certified</strong><p>Completed '+esc(date(c.completedAt))+' · Version '+esc(c.version)+'</p><small>Record '+esc(c.id)+'</small></div>'+tag('Complete')+'</div>').join(''));
 if(!assignments.length){setContent(markup+(completed.length?'':empty('No outstanding certification','Accepted applications are assigned here. You cannot begin certification before acceptance.')));return}
 const lessons=[
 ['Structure & accountability','SELC is the internal Sanctum Eros committee. Only approved SE members may apply for a seat. The Founder makes final appointments and organizational decisions. An outside Community Leader cannot vote or act as SELC Staff.'],
 ['Consent & safety','Consent is active and revocable. Stop an activity immediately when consent is withdrawn. Social participation can begin at age 18; dungeon play parties are 21+ and subject to venue rules.'],
 ['Confidentiality & reports','Keep member and incident information confidential. Use the established reporting process.'],
 ['Collaboration & escalation','Coordinate community programs, discuss concerns through the appropriate channels, and refer final decisions to the Founder.']
 ];
 markup+=card('<h2>Read before assessment</h2><p>A score of '+esc(data.passPercent)+'% is required. Review and retry missed questions. Your completion is recorded against the accepted application.</p>'+lessons.map(([t,p],i)=>'<div class="hq-row"><div class="grow"><strong>'+(i+1)+'. '+esc(t)+'</strong><p class="hq-prose">'+esc(p)+'</p></div></div>').join(''));
 markup+=assignments.map(a=>card('<span class="hq-eyebrow">'+esc(a.type==='coordinator'?'COORDINATOR ADVANCEMENT':'REPRESENTATIVE ENTRY')+'</span><h2>'+esc(a.type==='coordinator'?'Coordinator certification':'Representative certification')+'</h2><form class="hq-form" data-cert-form="'+esc(a.id)+'">'+a.questions.map((q,i)=>'<fieldset><legend>'+(i+1)+'. '+esc(q.prompt)+'</legend>'+q.options.map(o=>'<label class="checkline"><input type="radio" name="'+esc(q.id)+'" value="'+esc(o.value)+'" required> '+esc(o.label)+'</label>').join('')+'</fieldset>').join('')+'<label class="checkline"><input type="checkbox" name="acknowledge" value="yes" required> I will uphold SELC consent, confidentiality, nonretaliation, impartiality and access-control rules.</label><p data-status class="hq-form-status" role="status"></p><button type="submit" class="hq-button primary">Submit certification assessment</button></form>')).join('');
 setContent(markup);
 document.querySelectorAll('[data-cert-form]').forEach(form=>watchForm(form,async(values,el)=>{
  const acknowledge=el.querySelector('[name="acknowledge"]').checked;
  const answers={...values};delete answers.acknowledge;
  const result=await post('selc-governance','complete_certification',{id:el.dataset.certForm,answers,acknowledge});
  if(!result.passed){setStatus(el.querySelector('[data-status]'),'Score '+result.percent+'%. Review the lessons and try again; all answers must be correct.');return}
  setStatus(el.querySelector('[data-status]'),'Certification passed; appointment activated.',true);
  flash('SELC certification completed. Your updated access is ready.');location.reload();
 }));
}
const COORDFIELDS=[
 ['leadership','MOTIVATION & LEADERSHIP',[['motivation','Why are you applying to be a Coordinator?','What would you improve, and why does this responsibility matter?'],['leadershipStyle','How would you describe your leadership approach?','Explain how you support different perspectives.']]],
 ['contributions','YOUR WORK WITH SELC',[['experience','What have you contributed to SELC so far?','Include specific projects, discussions, events or other contributions.'],['reliability','How would you respond after missing an important commitment?','Be specific about accountability and recovery.']]],
 ['operations','RUNNING OUR WORK',[['administration','Explain how you would handle routine RSVPs, membership reviews, event staffing and ticket issues.','What would you handle yourself and what would you escalate?'],['priorities','Three urgent tasks arrive at the same time. How do you prioritize them?','Describe how you communicate a plan.']]],
 ['judgment','SCENARIOS & DECISION-MAKING',[['scenarioMembership','A Representative recommends approval but a membership application reveals a safety concern. What do you do?','Describe review, documentation and appropriate escalation.'],['scenarioConflict','Two Representatives disagree publicly and the conversation becomes hostile. What do you do?','Describe how you de-escalate while preserving the discussion.'],['scenarioPublish','Someone asks you to publish an event before Eros has given approval. What do you do?','Explain your understanding of committee authority.']]],
 ['safety','PRIVACY, SAFETY & ACCOUNTABILITY',[['confidentiality','A friend asks you for details from a private IA case or membership application. How do you respond?','Describe how access is limited and protected.'],['banDecision','How would you evaluate a Ban Report where facts are disputed and ticket access is temporarily held?','Include evidence, impartiality, timeliness, conflict checks and appeals.']]],
 ['team','SUPPORTING THE TEAM',[['support','How would you support Representatives without micromanaging them?','What does meaningful delegation look like?'],['feedback','How would you handle a Representative who feels you misused your authority?','Explain how you would respond to review or criticism.']]],
 ['commitment','PRACTICAL COMMITMENT',[['availability','What time can you realistically give to Coordinator duties?','Mention both in-person and online work.'],['training','What training or support would help you succeed?','Identify what you still want to learn.']]],
 ['statement','YOUR FINAL STATEMENT',[['vision','What should SELC look like in a year?','Describe a realistic vision connected to education and community.'],['final','Is there anything else the committee and Eros should consider?','Add anything important that has not been covered.']]]
];
async function coordinatorPage(){
 if(role()!=='representative'){setContent(pageHeader('LEADERSHIP ADVANCEMENT','Coordinator application','Only active SELC Representatives can apply.')+empty('This advancement is for Representatives','Join the committee first.'));return}
 const draftKey='selc.coord.draft.'+(context.me?.displayName||'user'),draft=JSON.parse(sessionStorage.getItem(draftKey)||'{}');let markup=pageHeader('LEADERSHIP ADVANCEMENT','Apply for Coordinator','A more detailed application for the responsibilities of operational leadership. Save your progress as you go; drafts remain on this device for this session.');
 markup+=card('<div class="hq-stats"><div class="hq-stat"><small>SECTIONS</small><strong>08</strong></div><div class="hq-stat"><small>COORDINATOR LIMIT</small><strong>02</strong></div></div><p>All active Representatives may apply. Candidates do not vote on themselves. The committee votes first; Eros gives final appointment approval.</p>');
 markup+=card('<form id="coordForm" class="hq-form">'+COORDFIELDS.map(([id,title,fields],i)=>'<fieldset><legend>'+(i+1)+' / '+esc(title)+'</legend>'+fields.map(f=>textfield(f,draft[f[0]]||'',f[0]!=='final')).join('')+'</fieldset>').join('')+'<label class="checkline"><input type="checkbox" name="truthful" required> I understand the expectations of confidentiality, responsibility, and accurate reporting.</label><p data-status class="hq-form-status"></p><button class="hq-button primary" type="submit">Send my Coordinator application</button></form>');
 setContent(markup);const form=$('#coordForm');form.addEventListener('input',()=>{const values=formValues(form);delete values.truthful;sessionStorage.setItem(draftKey,JSON.stringify(values))});
 watchForm(form,async(values,form)=>{if(!values.truthful)throw new Error('Confirm the acknowledgment first.');const answers={...values};delete answers.truthful;if(answers.motivation.length<80||answers.experience.length<80)throw new Error('Expand your motivation and experience to at least 80 characters each.');await post('selc-governance','apply_coordinator',{answers});sessionStorage.removeItem(draftKey);flash('Coordinator application submitted to SELC leadership.');openPage('home')});
}
async function ballotsPage(){
 if(!leader()){setContent(empty('Committee access required'));return}
 const d=await api('selc-governance',{query:{scope:'ballots'}}),rows=d.ballots||[];
 const html=pageHeader('LEADERSHIP / ELECTIONS','Coordinator elections','Candidates sit out their own vote. Eros makes the final appointment after the Representative election.')+(rows.length?rows.map(a=>card('<span class="hq-eyebrow">COORDINATOR CANDIDATE</span><h2>'+esc(a.name)+'</h2><p>'+esc(a.statement)+'</p><div class="hq-actions">'+btn('Support','data-ballot="'+esc(a.id)+'" data-vote="yes"','primary')+btn('Oppose','data-ballot="'+esc(a.id)+'" data-vote="no"')+btn('Abstain','data-ballot="'+esc(a.id)+'" data-vote="abstain"')+'</div>')).join(''):empty('No Coordinator elections are open','Applications and voting opportunities appear here when available.'));
 setContent(html);$$('[data-ballot]').forEach(b=>b.onclick=async()=>{if(!confirmDecision('Record your private vote? You can update it while voting remains open.'))return;try{await post('selc-governance','vote_coordinator',{id:b.dataset.ballot,vote:b.dataset.vote});flash('Your vote was recorded.')}catch(e){flash(e.message)}});
}
async function applicationsPage(){
 if(!reviewer())return;
 const result=await api('selc-governance',{query:{scope:'applications'}}),rows=result.applications||[];
 setContent(pageHeader('LEADERSHIP / PRIVATE REVIEWS','SELC applications','Only you and active Coordinators can see and review these applications. The Founder makes final appointments.')+
 (rows.length?rows.map(a=>card('<div class="hq-row"><div class="grow"><strong>'+esc(a.displayName)+' · '+(a.type==='coordinator'?'Coordinator advancement':'Representative application')+'</strong><p>'+esc(date(a.createdAt))+' · '+esc(a.id)+'</p></div>'+tag(a.status)+btn('Open','data-openapp="'+esc(a.id)+'"')+'</div>')).join(''):empty('No applications here','Applicants and their responses will appear when submitted.')));
 $$('[data-openapp]').forEach(b=>b.onclick=()=>{const a=rows.find(x=>x.id===b.dataset.openapp);if(!a)return;
 const answers=Object.entries(a.answers||{}).map(([k,v])=>'<div class="hq-row"><div class="grow"><strong>'+esc(k.replaceAll('_',' '))+'</strong><p class="hq-prose">'+esc(v)+'</p></div></div>').join('');
 const waiting=a.status==='Certification Pending',closed=['Approved','Declined'].includes(a.status);
 const actionButtons=closed?'<p>'+esc(a.status==='Approved'?'Appointment active after certification.':'Application closed without appointment.')+'</p>':owner()
  ?(waiting?'<p>Accepted; awaiting certification. No new committee privileges have been granted.</p>':btn('Mark under review','data-action="review"')+btn('Accept & assign certification','data-action="appoint"','primary'))+btn(waiting?'Withdraw acceptance':'Decline','data-action="decline"','danger')
  :(waiting?'<p>Founder acceptance recorded; certification pending.</p>':btn('Mark under review','data-action="review"')+btn('Recommend','data-action="recommend"','primary')+btn('Not recommended','data-action="not-recommended"'));
 const reviewMarkup='<p>'+tag(a.status)+' Submitted '+esc(date(a.createdAt))+'</p><div class="hq-card">'+answers+'</div>'+
  '<form class="hq-form" id="appReviewForm"><label>Notes for review</label><textarea name="notes" rows="4">'+esc(a.reviewNotes||'')+'</textarea>'+
  '<label>Public display name (optional)</label><input name="publicName" value="'+esc(a.displayName||'')+'">'+
  '<label class="checkline"><input type="checkbox" name="publicProfile"> Show this person’s name publicly with their consent</label>'+
  '<div class="hq-actions">'+actionButtons+'</div><p data-status class="hq-form-status"></p></form>';
 const d=modal(a.displayName+' · '+a.type,reviewMarkup);
 $$('[data-action]',d).forEach(btnEl=>btnEl.onclick=async()=>{const vals=formValues($('#appReviewForm',d)),action=btnEl.dataset.action;try{
  if(action==='appoint'){if(!confirmDecision('Accept this application and assign SELC certification? Appointment privileges activate only after a passing assessment.'))return;await post('selc-governance','appoint',{id:a.id,...vals,publicProfile:!!$('#appReviewForm input[name=publicProfile]',d).checked})}
  else if(action==='decline')await post('selc-governance','decline',{id:a.id,notes:vals.notes});
  else await post('selc-governance','review_application',{id:a.id,status:action==='review'?'Under Review':action==='recommend'?'Recommended':'Not Recommended',notes:vals.notes});
  d.close();flash(action==='appoint'?'Application accepted; certification assigned.':'Application updated.');applicationsPage()
 }catch(e){setStatus($('[data-status]',d),e.message)}});
 });
}
async function libraryPage(){
 const data=await api('leadership-library'),docs=data.articles||[];
 let markup=pageHeader('KNOWLEDGE / SHARED PRACTICE','Staff & SELC Handbook','Venue operations, consent-response procedures, education, and leadership guidance. Official policies require Founder approval.',
 data.canCreate?btn('Write a guide','data-write-guide','primary'):'');
 markup+=docs.length?docs.map(row=>card('<div class="hq-row"><div class="grow"><span class="hq-eyebrow">'+esc(row.category)+' / '+esc(row.access)+'</span><h2>'+esc(row.title)+'</h2><p>'+esc(row.summary||'Open this guide to read more.')+'</p><p class="hq-micro">'+esc(row.updatedBy)+' · '+esc(date(row.updatedAt))+' · version '+esc(row.version)+'</p></div>'+tag(row.status)+btn('Read','data-guide="'+esc(row.id)+'"')+'</div>')).join(''):empty('Your handbook is ready to build','Add procedures, role expectations, educator resources, and practical event guides here.');
 setContent(markup);
 const editor=(doc={})=>{
  const dlg=modal(doc.id?'Edit a handbook guide':'Write a handbook guide','<form id="guideForm" class="hq-form"><label>Title</label><input name="title" value="'+esc(doc.title||'')+'" required minlength="6"><label>Short summary</label><textarea name="summary" rows="2">'+esc(doc.summary||'')+'</textarea><div class="hq-form-grid"><div><label>Category</label><select name="category">'+(data.categories||[]).map(c=>'<option '+(c===doc.category?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select></div><div><label>Who may read this?</label><select name="access">'+['staff','selc','educator'].map(c=>'<option value="'+c+'" '+(c===(doc.access||'staff')?'selected':'')+'>'+esc(c.toUpperCase())+'</option>').join('')+'</select></div></div><label>Guide content</label><textarea name="body" rows="13" minlength="40" required>'+esc(doc.body||'')+'</textarea><label>Publishing status</label><select name="status"><option value="Draft" '+(doc.status==='Draft'?'selected':'')+'>Draft</option><option value="Published" '+(doc.status==='Published'?'selected':'')+'>Publish internally</option></select><label class="checkline"><input type="checkbox" name="official" '+(doc.official?'checked':'')+' '+(!owner()?'disabled':'')+'> Official organizational policy (Founder only)</label><p data-status class="hq-form-status"></p><button class="hq-button primary" type="submit">Save guide</button></form>');
  watchForm($('#guideForm',dlg),async vals=>{await post('leadership-library','save',{id:doc.id,...vals,official:!!$('#guideForm input[name=official]',dlg).checked});dlg.close();flash('Handbook guide saved.');await libraryPage()});
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
 const data=await api('leadership-queue'),items=data.items||[],counts=data.counts||{};
 const categories={member:'Membership',role:'Role applications',selc:'SELC',ban:'Ban Reports',community:'Community'};
 let markup=pageHeader('LEADERSHIP / WORK IN PROGRESS','Leadership Action Center','See what needs attention, claim a review, and avoid two people working on the same application.',btn('Refresh','data-work-refresh'));
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
      btn('Open','data-page-link="'+route+'"')+'</div></div>';
   }).join(''));
 }).join(''):empty('Everything is up to date','New applications, Ban Reports, and community conversations appear here when they need attention.');
 setContent(markup);bindPageLinks();$('[data-work-refresh]')?.addEventListener('click',leadershipWorkPage);
 $$('[data-queue-action]').forEach(b=>b.onclick=async()=>{b.disabled=true;try{
  await post('leadership-queue',b.dataset.queueAction,{kind:b.dataset.queueKind,id:b.dataset.queueId});
  flash(b.dataset.queueAction==='claim'?'Review assigned to you.':'Review released.');
  await leadershipWorkPage();
 }catch(e){flash(e.message);b.disabled=false}});
}

async function leaderPage(){
 const data=await api('selc-governance',{query:{scope:'members'}}),people=data.members||[];
 let markup=pageHeader('THE PEOPLE BEHIND THE WORK','SELC leadership','Five Representative seats, including no more than two Coordinators. Members keep one committee vote regardless of title.');
 markup+='<div class="hq-stats"><div class="hq-stat"><small>REPRESENTATIVE SEATS</small><strong>'+people.length+' / 5</strong></div><div class="hq-stat"><small>COORDINATORS</small><strong>'+people.filter(x=>x.role==='coordinator').length+' / 2</strong></div></div>';
 markup+=card('<h2>Committee members</h2>'+people.map(p=>'<div class="hq-row"><div class="grow"><strong>'+esc(p.displayName)+'</strong><p>Seat '+esc(p.seat)+' · '+esc(RANK[p.role]||p.role)+' · '+esc(p.availability?.status||'Available')+(p.availability?.until?' through '+esc(p.availability.until):'')+'</p></div>'+tag(p.role)+(owner()?btn('Remove','data-remove="'+esc(p.accountId)+'"','danger'):'')+'</div>').join(''));
 if(owner())markup+=card('<h2>Lead the appointment process</h2><p>Review and appoint Representatives or Coordinators from applications. Coordinator appointments require a successful committee vote.</p>'+btn('Review SELC applications','data-page-link="applications"','primary'));
 setContent(markup);bindPageLinks();$$('[data-remove]').forEach(b=>b.onclick=async()=>{if(!confirmDecision('Remove this SELC leadership appointment? Their regular membership remains separate.'))return;try{await post('selc-governance','remove',{accountId:b.dataset.remove});flash('Appointment ended.');leaderPage()}catch(e){flash(e.message)}});
}
async function proposalPage(){
 const d=await api('selc-governance',{query:{scope:'proposals'}}),rows=d.proposals||[];
 const actions=btn('Bring an idea forward','data-new-proposal','primary');
 let markup=pageHeader('COMMITTEE WORK','Discuss, decide, improve','From workshops and venue improvements to pricing and event ideas—every proposal deserves a real discussion.',actions);
 markup+=rows.length?rows.map(p=>card('<div class="hq-row"><div class="grow"><span class="hq-eyebrow">'+esc((p.category||'').replaceAll('_',' '))+'</span><h2>'+esc(p.title)+'</h2><p>'+esc(p.description||'').slice(0,210)+'</p><p class="hq-micro">Started by '+esc(p.createdBy)+' · '+esc(date(p.createdAt))+' · '+(p.comments?.length||0)+' replies</p></div>'+tag(p.status)+btn('Discuss','data-proposal="'+esc(p.id)+'"')+'</div>')).join(''):empty('No ideas on the table yet','Start a proposal, invite perspectives, and move it toward a decision.');
 setContent(markup);
 $('[data-new-proposal]').onclick=()=>{
  const d=modal('Bring an idea forward','<form class="hq-form" id="newProposal"><label>What is your idea called?</label><input name="title" required minlength="8" placeholder="Give it a clear name"><label>Area of community life</label><select name="category"><option value="education">Education & workshops</option><option value="events">Events & socials</option><option value="equipment">Equipment</option><option value="work_sessions">Venue work sessions</option><option value="rules">Rules & expectations</option><option value="pricing">Pricing & admission</option><option value="outreach">Community outreach</option><option value="other">Something else</option></select><label>What should happen and why?</label><textarea name="description" required rows="6" minlength="40"></textarea><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Start discussion</button></form>');
  watchForm($('#newProposal',d),async vals=>{await post('selc-governance','create_proposal',vals);d.close();flash('Proposal added for discussion.');proposalPage()})
 };
 $$('[data-proposal]').forEach(b=>b.onclick=()=>{const p=rows.find(x=>x.id===b.dataset.proposal);if(!p)return;
  const tally=Object.values(p.votes||{}).reduce((a,v)=>(a[v.vote]=(a[v.vote]||0)+1,a),{yes:0,no:0,abstain:0});
  const d=modal(p.title,'<p class="hq-eyebrow">'+esc(p.category||'')+' / '+esc(p.status)+'</p><p class="hq-prose">'+esc(p.description)+'</p><p>Committee votes: '+number(tally.yes)+' support · '+number(tally.no)+' oppose · '+number(tally.abstain)+' abstain</p><div class="hq-actions">'+btn('Support','data-pvote="yes"','primary')+btn('Oppose','data-pvote="no"')+btn('Abstain','data-pvote="abstain"')+'</div><hr style="border:0;border-top:1px solid #545058;margin:18px 0"><h3>Discussion ('+(p.comments?.length||0)+')</h3><div class="hq-panel-list">'+(p.comments||[]).map(m=>'<div class="hq-row"><div class="grow"><strong>'+esc(m.from)+'</strong><p class="hq-prose">'+esc(m.message)+'</p><p class="hq-micro">'+esc(date(m.at))+'</p></div></div>').join('')+'</div><form class="hq-form" id="commentProposal"><label>Add your perspective</label><textarea name="message" required></textarea><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Add comment</button></form>'+(owner()?'<h3>Founder decision</h3><div class="hq-actions">'+btn('Approve proposal','data-chair="approved"','primary')+btn('Return for changes','data-chair="returned"')+btn('Decline','data-chair="declined"','danger')+'</div>':''));
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
 let markup=pageHeader('LEARN / TEACH / SHARE','Become a Community Educator','Teaching is a community contribution, not a title to collect. SELC reviews applications and Eros makes final appointments. Teaching and workshop approval are separate.');
 if(mine.length)markup+=card('<h2>Your application history</h2>'+mine.map(x=>'<div class="hq-row"><div class="grow"><strong>'+esc(x.status)+'</strong><p>Submitted '+esc(date(x.submittedAt))+'</p><p>'+esc(x.notes||'Your application is with the committee.')+'</p></div></div>').join(''));
 if(!mine.some(x=>!['Declined','Withdrawn'].includes(x.status))){
  markup+=card('<h2>Community Educator application</h2><p>Be specific. We value actual experience, willingness to learn, strong consent practices, and the ability to teach without gatekeeping.</p><form id="educatorApplication" class="hq-form">'+questions.map(([key,label,hint])=>'<label>'+esc(label)+'</label><p class="hq-muted">'+esc(hint)+'</p><textarea name="'+key+'" rows="'+(['motivation','safety','teaching'].includes(key)?5:3)+'" '+(['format','availability'].includes(key)?'':'required')+'></textarea>').join('')+'<label class="hq-checkbox"><input type="checkbox" name="acknowledge" value="true" required> I agree to follow the venue’s consent, safety, privacy, and educational standards and understand that submitting does not grant permission to teach.</label><p data-status></p><button class="hq-button primary" type="submit">Submit to SELC</button></form>');
 }
 setContent(markup);
 const form=$('#educatorApplication');if(form)watchForm(form,async values=>{values.acknowledge=values.acknowledge==='true';await post('educator-applications','apply',values);flash('Your educator application was submitted.');educatorApplicationPage()});
}
async function educatorReviewsPage(){
 const d=await api('educator-applications'),rows=d.review||[];
 let markup=pageHeader('EDUCATION / LEADERSHIP','Educator applications','SELC Coordinators assess teaching experience, consent literacy, accessibility, and readiness. Only Eros may approve a Community Educator appointment.');
 markup+=rows.length?rows.map(x=>card('<div class="hq-row"><div class="grow"><h2>'+esc(x.applicantName)+'</h2><p>Topics: '+esc(x.topics)+'</p><p>Experience: '+esc(x.experience)+'</p><p>Approach: '+esc(x.teaching)+'</p><p>Consent & safety: '+esc(x.safety)+'</p><p>Accessibility: '+esc(x.accessibility)+'</p></div>'+tag(x.status)+btn('Record review','data-educator-review="'+esc(x.id)+'"')+'</div>')).join(''):empty('No educator applications to review','Applications submitted by Portal members appear here.');
 setContent(markup);
 $$('[data-educator-review]').forEach(b=>b.onclick=()=>{const x=rows.find(r=>r.id===b.dataset.educatorReview);if(!x)return;const dlg=modal('Community Educator · '+x.applicantName,'<form id="educatorReviewForm" class="hq-form"><label>Review decision</label><select name="status"><option>Changes Requested</option><option>Recommended</option><option>Declined</option>'+(owner()?'<option>Approved</option>':'')+'</select><label>Reasoning and next steps</label><textarea name="notes" rows="5" required minlength="20"></textarea><p data-status></p><button class="hq-button primary" type="submit">Save review</button></form>');watchForm($('#educatorReviewForm',dlg),async values=>{await post('educator-applications','review',{id:x.id,...values});dlg.close();flash('Educator review saved.');educatorReviewsPage()})});
}

async function educationProgramsPage(){
 const [data]=await Promise.all([api('education-programs')]),plans=data.plans||[];
 let markup=pageHeader('LEARN / TEACH / SHARE','Community Education Program','Work with educators to shape practical workshops. No class becomes a published event until Eros approves its scheduling.',btn('Education conversations','data-page-link="requests"'));
 markup+='<div class="hq-stats">'+[['WORKSHOP IDEAS',plans.length],['UNDER SELC REVIEW',plans.filter(p=>p.status==='SELC Review').length],['AWAITING FOUNDER',plans.filter(p=>p.status==='Ready for Founder').length],['APPROVED TO SCHEDULE',plans.filter(p=>p.status==='Approved for Scheduling').length]].map(([label,n])=>'<div class="hq-stat"><small>'+label+'</small><strong>'+number(n)+'</strong></div>').join('')+'</div>';
 markup+=plans.length?plans.map(p=>card('<div class="hq-row"><div class="grow"><span class="hq-eyebrow">'+esc(p.educatorName||'Community Educator')+'</span><h2>'+esc(p.title)+'</h2><p>'+esc(p.summary||p.objectives||'Workshop proposal')+'</p><p class="hq-micro">Updated '+esc(date(p.updatedAt))+'</p></div>'+tag(p.status)+btn('Review plan','data-edu-plan="'+esc(p.requestId)+'"')+'</div>')).join(''):empty('Start building your education calendar','Educators can propose workshops in their Member Portal. Approved plans appear here for review, mentoring, and scheduling.');
 setContent(markup);bindPageLinks();
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
async function generalAppsPage(){
 const [apps,members]=await Promise.all([api('applications'),api('members',{query:{status:'pending'}})]),all=apps.applications||[],roles=all.filter(a=>a.type!=='admission_assistance'),assistance=all.filter(a=>a.type==='admission_assistance'&&!a.eventArchived&&['Pending','Under Review','Approved'].includes(a.status)),reviewable=[...roles,...assistance],memberRows=members.members||[];
 let markup=pageHeader('MEMBERS & OPPORTUNITIES','Applications','SELC Representatives can help review routine membership and role applications. Elevated IA Staff appointments receive additional review.');
 markup+='<div class="hq-tabs"><button class="active" data-app-tab="membership">Membership ('+memberRows.length+')</button><button data-app-tab="roles">Roles & educators ('+roles.length+')</button><button data-app-tab="assistance">Admission Assistance ('+assistance.length+')</button></div>';
 markup+='<section id="membershipTab">'+(memberRows.length?memberRows.map(m=>card('<div class="hq-row"><div class="grow"><strong>'+esc(m.name||'Applicant')+'</strong><p>'+esc(m.fetlife?'@'+m.fetlife:m.loginEmail)+' · '+esc(date(m.createdAt))+'</p></div>'+tag(m.status)+btn('Review','data-member-app="'+esc(m.id)+'"')+'</div>')).join(''):empty('No pending memberships'))+'</section>';
 markup+='<section id="roleTab" hidden>'+(roles.length?roles.map(a=>card('<div class="hq-row"><div class="grow"><strong>'+esc(a.name||'Applicant')+'</strong><p>'+esc((a.type||'').replaceAll('_',' '))+' · '+esc(date(a.createdAt))+'</p></div>'+tag(a.status)+btn('Review','data-role-app="'+esc(a.id)+'"')+'</div>')).join(''):empty('No role applications'))+'</section>';
 markup+='<section id="assistanceTab" hidden>'+(assistance.length?assistance.map(a=>card('<div class="hq-row"><div class="grow"><strong>'+esc(a.name||'Applicant')+'</strong><p>Event: '+esc(a.eventTitle||a.event||'Unknown event')+' · '+esc(date(a.eventStart))+'</p><p>'+esc(a.requestType||'Admission Assistance')+'</p></div>'+tag(a.status)+btn('Review','data-role-app="'+esc(a.id)+'"')+'</div>')).join(''):empty('No current Admission Assistance requests','Requests for previous events are retained in Portal history but no longer appear in this queue.'))+'</section>';
 setContent(markup);
 $$('[data-app-tab]').forEach(b=>b.onclick=()=>{$$('[data-app-tab]').forEach(x=>x.classList.toggle('active',x===b));$('#membershipTab').hidden=b.dataset.appTab!=='membership';$('#roleTab').hidden=b.dataset.appTab!=='roles';$('#assistanceTab').hidden=b.dataset.appTab!=='assistance'});
 $$('[data-member-app]').forEach(b=>b.onclick=()=>{const m=memberRows.find(x=>x.id===b.dataset.memberApp);if(!m)return;
  const details=['name','fetlife','loginEmail','generalArea','about','experience','limits','whyJoin','communityConflict','adminNotes','reviewAssist'].filter(k=>m[k]).map(k=>'<div class="hq-row"><div class="grow"><strong>'+esc(k)+'</strong><p class="hq-prose">'+esc(typeof m[k]==='object'?JSON.stringify(m[k]):m[k])+'</p></div></div>').join('');
  const dlg=modal('Membership application','<div class="hq-card">'+details+'</div><form class="hq-form" id="memberReview"><label>Private review notes</label><textarea name="adminNotes" rows="4"></textarea><p data-status class="hq-form-status"></p><div class="hq-actions">'+btn('Approve','data-membership-decision="approved"','primary')+btn('Decline','data-membership-decision="denied"','danger')+btn('Keep pending','data-membership-decision="pending"')+'</div></form>');
  $$('[data-membership-decision]',dlg).forEach(x=>x.onclick=async()=>{if(!confirmDecision('Record this membership decision?'))return;try{await api('members',{method:'POST',body:{adminAction:x.dataset.membershipDecision,id:m.id,...formValues($('#memberReview',dlg))}});dlg.close();flash('Membership updated.');generalAppsPage()}catch(e){setStatus($('[data-status]',dlg),e.message)}});
 });
 $$('[data-role-app]').forEach(b=>b.onclick=()=>{const a=reviewable.find(x=>x.id===b.dataset.roleApp);if(!a)return;const details=Object.entries(a).filter(([k,v])=>!['passwordHash','salt','securityAnswerHash'].includes(k)&&v!==null&&typeof v!=='object').slice(0,25).map(([k,v])=>'<div class="hq-row"><div class="grow"><strong>'+esc(k)+'</strong><p class="hq-prose">'+esc(v)+'</p></div></div>').join('');
  const dlg=modal(a.type==='admission_assistance'?'Admission Assistance · '+(a.eventTitle||a.event||'Event'):'Role application','<div class="hq-card">'+(a.type==='admission_assistance'?'<h3>Event: '+esc(a.eventTitle||a.event||'Unknown event')+'</h3><p>'+esc(date(a.eventStart))+'</p>':'')+details+'</div><form class="hq-form" id="roleReview">'+(a.type==='admission_assistance'?'<label>Admission option</label><select name="approvedAdmissionType"><option value="free">Free admission</option><option value="discounted">Reduced admission</option><option value="barter">Barter</option></select><label>Approved amount (if reduced)</label><input type="number" min="0" name="approvedAmount">':'')+'<label>Internal notes</label><textarea name="adminNotes"></textarea><label>Message for applicant</label><textarea name="memberResponse"></textarea><p data-status class="hq-form-status"></p><div class="hq-actions">'+btn('Approve','data-role-decision="Approved"','primary')+btn('Decline','data-role-decision="Declined"','danger')+btn('Under review','data-role-decision="Under Review"')+'</div></form>');
  $$('[data-role-decision]',dlg).forEach(x=>x.onclick=async()=>{try{await api('applications',{method:'POST',body:{adminAction:'review',id:a.id,status:x.dataset.roleDecision,...formValues($('#roleReview',dlg))}});dlg.close();flash('Application updated.');generalAppsPage()}catch(e){setStatus($('[data-status]',dlg),e.message)}});
 });
}
async function volunteerPage(){
 const data=await api('shifts'),events=activeSELCEvents(data.events),me=data.me||{},mine=events.reduce((n,e)=>n+e.slots.reduce((x,s)=>x+s.claims.filter(c=>c.mine).length,0),0);
 let html=pageHeader('EVENT OPERATIONS','Volunteer for an event','Upcoming events offer volunteer shifts automatically. Choose where you can help; Eros can still adjust the positions when needed.');
 html+='<div class="hq-stats"><div class="hq-stat"><small>YOUR SHIFTS</small><strong>'+mine+'</strong></div><div class="hq-stat"><small>EVENTS WITH SHIFTS</small><strong>'+events.length+'</strong></div></div>';
 if(!owner()&&!me.linked)html+=card('<h2>Connect your membership</h2><p>Your Staff profile must be linked to an approved Portal member account before volunteering.</p><a class="hq-button" href="'+PORTAL+'/member.html">Go to Member Portal</a>');
 else if(!owner()&&!me.certified)html+=card('<h2>Complete your Staff certification first</h2><p>Event shifts involve actual responsibilities. Current Staff certification is required, and Dungeon Monitor shifts separately require DM certification.</p><a class="hq-button" href="'+PORTAL+'/staff.html#cert">Open certification</a>');
 html+=events.map(e=>{
  const coverage=e.coverage||{},head='<div class="hq-row"><div class="grow"><h2>'+esc(e.event.title)+'</h2><p>'+esc(date(e.event.start))+' · '+coverage.filled+'/'+coverage.needed+' roles filled</p></div>'+tag(coverage.complete?'Fully covered':'Open positions')+'</div>';
  const shifts=e.slots.map(slot=>{
   const own=slot.claims.some(c=>c.mine);
   return '<div class="hq-row"><div class="grow"><strong>'+esc(slot.label)+(slot.role==='dm'?' · Certified DM':'')+'</strong><p>'+esc(slot.description||'Help make this event run smoothly.')+'</p><p class="hq-micro">'+slot.filled+'/'+slot.count+' filled'+(slot.claims.length?' · '+slot.claims.map(c=>esc(c.mine?'You':c.name)).join(', '):'')+'</p></div>'+
    (owner()?'':own?btn('Release','data-release-shift="'+esc(e.event.id)+'|'+esc(slot.id)+'"','danger'):slot.open>0&&me.certified&&me.linked&&(slot.role!=='dm'||me.dm)?btn('Volunteer','data-claim-shift="'+esc(e.event.id)+'|'+esc(slot.id)+'"','primary'):tag(slot.open>0?'Requires qualification':'Full'))+'</div>';
  }).join('');
  return card(head+'<div class="hq-panel-list">'+shifts+'</div><div class="hq-actions">'+btn('Event handover notes','data-handover="'+esc(e.event.id)+'"')+(owner()?btn('Manage volunteer positions','data-manage-shifts="'+esc(e.event.id)+'"','primary'):'')+'</div>');
 }).join('');
 if(!events.length)html+=empty('No upcoming volunteer shifts','Positions will appear automatically when an event is published.');
 setContent(html);
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
    '<fieldset class="hq-card"><legend>'+esc(slot.label)+'</legend><input type="hidden" name="id'+i+'" value="'+esc(slot.id)+'"><label>Position<select name="role'+i+'"><option value="staff" '+(slot.role==='staff'?'selected':'')+'>Staff</option><option value="dm" '+(slot.role==='dm'?'selected':'')+'>Dungeon Monitor</option></select></label><label>Shift name<input name="label'+i+'" value="'+esc(slot.label)+'" required></label><label>Positions needed<input type="number" name="count'+i+'" min="1" max="20" value="'+number(slot.count)+'"></label><label>Description<input name="description'+i+'" value="'+esc(slot.description||'')+'"></label>'+
    slot.claims.map(c=>'<div class="hq-row"><span>'+esc(c.name)+'</span>'+btn('Remove volunteer','data-remove-volunteer="'+esc(eventId)+'|'+esc(slot.id)+'|'+esc(c.staffId||'')+'"','danger')+'</div>').join('')+'</fieldset>').join('')+
    '<fieldset class="hq-card"><legend>Add another position (optional)</legend><label>Type<select name="newRole"><option value="staff">Staff</option><option value="dm">Dungeon Monitor</option></select></label><label>Title<input name="newLabel" placeholder="Setup / Door / DM"></label><label>Number needed<input type="number" name="newCount" min="1" max="20" value="1"></label></fieldset><p data-status></p><button class="hq-button primary">Save volunteer positions</button></form>';
   const dlg=modal('Volunteer management · '+esc(data.event.title),form);
   watchForm($('#manageShiftForm',dlg),async values=>{
    const result=slots.map((x,i)=>({id:values['id'+i],role:values['role'+i],label:values['label'+i],count:Number(values['count'+i]),description:values['description'+i]}));
    if(values.newLabel)result.push({role:values.newRole,label:values.newLabel,count:Number(values.newCount)||1});
    await post('shifts','set_slots',{eventId,slots:result});
    dlg.close();flash('Volunteer positions saved.');volunteerPage();
   });
   $('[data-remove-volunteer]',dlg).forEach(b=>b.onclick=async()=>{
    const [ev,slotId,staffId]=b.dataset.removeVolunteer.split('|');
    if(!staffId||!confirmDecision('Remove this volunteer from the shift?'))return;
    try{await post('shifts','remove_claim',{eventId:ev,slotId,staffId});dlg.close();flash('Volunteer removed.');volunteerPage()}catch(error){flash(error.message)}
   });
  }catch(e){flash(e.message)}
 });
 $$('[data-claim-shift],[data-release-shift]').forEach(button=>button.onclick=async()=>{
  const claim=!!button.dataset.claimShift,ids=(button.dataset.claimShift||button.dataset.releaseShift).split('|'),[eventId,slotId]=ids;
  if(!claim&&!confirmDecision('Release your volunteer shift? This could leave the event short-staffed.'))return;
  button.disabled=true;try{const result=await post('shifts',claim?'claim':'release',{eventId,slotId});flash(result.message||'Shift updated.');await volunteerPage()}catch(error){flash(error.message);button.disabled=false}
 });
}

async function eventPage(){
 const data=await api('staff-portal'),evs=activeSELCEvents(data.events);
 let markup=pageHeader('EVENT OPERATIONS','Events & RSVPs','The same RSVP decisions, assignments and guest lists as the Sanctum Eros Portal.',btn('Open check-in','data-page-link="door"'));
 markup+=evs.length?evs.map(e=>card('<div class="hq-row"><div class="grow"><strong>'+esc(e.title||'Event')+'</strong><p>'+esc(date(e.start))+' · '+esc(e.eventType||'')+'</p></div>'+btn('RSVP queue','data-event-rsvp="'+esc(e.id)+'"','primary')+btn('Check in','data-event-door="'+esc(e.id)+'"')+'</div>')).join(''):empty('No upcoming events','New events will appear as they are scheduled.');
 setContent(markup);bindPageLinks();
 $$('[data-event-rsvp]').forEach(b=>b.onclick=()=>rsvpPage(b.dataset.eventRsvp));
 $$('[data-event-door]').forEach(b=>b.onclick=()=>{context.eventId=b.dataset.eventDoor;openPage('door')});
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
  const dlg=modal('Ban Report '+r.reportNumber,'<p>'+tag(r.status)+' · '+esc(r.createdBy)+' · '+esc(date(r.createdAt))+'</p><h3>Person involved</h3><p>'+esc(r.person)+'</p><h3>Incident account</h3><p class="hq-prose">'+esc(r.summary)+'</p><h3>Evidence and witnesses</h3><p class="hq-prose">'+esc(r.evidenceDescription||'')+'</p><p class="hq-prose">'+esc(r.witnesses||'')+'</p><h3>Admission status</h3><p>'+number(r.ticketsRevoked)+' ticket(s) held · '+esc(r.memberRecordId||r.rsvpId||'No link')+'</p>'+(r.decision?'<div class="hq-card"><strong>Decision</strong><p>'+esc(r.decisionReason)+'</p><small>'+esc(r.decidedBy)+'</small></div>':'')+(d.canDecide&&r.status==='Pending'?'<form id="banDecision" class="hq-form"><label>Decision</label><select name="decision"><option value="decline">Decline / lift hold</option><option value="approve">Approve ban</option></select><label>Ban duration (if approved)</label><select name="kind"><option value="permanent">Permanent</option><option value="temporary">Temporary</option></select><label>End date (temporary)</label><input type="datetime-local" name="expiresAt"><label>Decision rationale (30 characters minimum)</label><textarea name="decisionReason" minlength="30" required></textarea><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Record decision</button></form>':''));
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
 const messageForm=$('#communityMessage');if(messageForm){const audience=messageForm.querySelector('#communityAudience'),recipient=messageForm.querySelector('#communityRecipientWrap');audience.onchange=()=>{recipient.hidden=audience.value!=='leader'};watchForm(messageForm,async values=>{if(values.audience==='leader'&&!values.recipientId)throw new Error('Choose an approved Community Leader.');await post('community-leaders','message',values);flash('Message sent to the selected audience.');communityLeadersPage()})}
 const shareForm=$('#communitySafety');if(shareForm)watchForm(shareForm,async values=>{await post('community-leaders','propose_safety_share',{...values,acknowledgeSensitive:values.acknowledgeSensitive==='on'});flash('Notice submitted for Founder review.');communityLeadersPage()});
 $$('[data-leader-review]').forEach(button=>button.onclick=()=>{
   const item=(d.applications||[]).find(x=>x.id===button.dataset.leaderReview);
   if(!item)return;
   const dlg=modal('Review '+item.organization,'<p>Applicant: '+esc(item.leaderName)+'</p><p>'+esc(item.motivation)+'</p><form class="hq-form" id="leaderDecision"><label>Decision</label><select name="status"><option>Needs Verification</option><option>Approved</option><option>Declined</option></select><label>Review notes</label><textarea name="notes" rows="3"></textarea><p data-status></p><button class="hq-button primary">Save review</button></form>');
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


async function founderDeskPage(){
 if(!owner())return openPage('home');
 const sections=[
  ['Website approvals','content','Review and publish voted changes'],
  ['Event readiness','readiness','Identify staffing and operational gaps'],
  ['Community messages','chat','Oversee participating rooms'],
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
 setContent(pageHeader('FOUNDER & CHAIR','Founder command center','One place for decisions and operational oversight without crowding the workspace.')+
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
  $('[data-content-vote]',dialog).forEach(x=>x.onclick=async()=>{try{await post('selc-content','vote',{id:p.id,vote:x.dataset.contentVote});dialog.close();contentManagementPage()}catch(e){flash(e.message)}});
  $('[data-content-decision]',dialog).forEach(x=>x.onclick=async()=>{try{await post('selc-content','decide',{id:p.id,decision:x.dataset.contentDecision,reason:''});dialog.close();contentManagementPage()}catch(e){flash(e.message)}});
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
async function memberDeskPage(){
 const d=await api('committee-desk',{query:{scope:'messages'}}),rows=d.messages||[];
 let markup=pageHeader('MEMBER CORRESPONDENCE','Messages & complaints','A shared inbox for communications members have authorized SELC to see. Eros-only conversations stay private.');
 markup+='<div class="hq-stats"><div class="hq-stat"><small>CONVERSATIONS</small><strong>'+rows.length+'</strong></div><div class="hq-stat"><small>NEED REVIEW</small><strong>'+Number(d.counts?.new||0)+'</strong></div></div>';
 markup+=rows.length?rows.map((r,i)=>card('<div class="hq-row"><div class="grow"><span class="hq-eyebrow">'+esc(r.kind==='incident'?'Opted-in IA report':r.type==='complaint'?'Complaint':r.type==='portal_problem'?'Portal issue':'Member message')+'</span><h2>'+esc(r.subject||'Message')+'</h2><p>'+esc(String(r.message||'').slice(0,180))+'</p><p class="hq-micro">'+esc(r.username||r.caseNumber||'Member')+' · '+esc(date(r.updatedAt||r.createdAt))+'</p></div>'+tag(r.status)+btn('Open conversation','data-member-msg="'+i+'"','primary')+'</div>')).join(''):empty('No shared messages right now','Opted-in member conversations and reports appear here.');
 setContent(markup);
 $('[data-member-msg]').forEach(el=>el.onclick=()=>{
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
 $('[data-suggestion]').forEach(el=>el.onclick=()=>{
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
 $('[data-event-feedback]').forEach(el=>el.onclick=()=>{
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
 if(!me)return setContent(empty('No active committee appointment','Only active SELC Representatives and Coordinators can change availability.'));
 const current=me.availability||{status:'Available',note:'',until:''};
 let markup=pageHeader('YOUR PARTICIPATION','Availability','Set when you can take new committee assignments. Other SELC members can see your status and optional return date.');
 markup+=card('<h2>Your status</h2><form class="hq-form" id="availabilityForm"><label>Status</label><select name="status">'+['Available','Busy','Away','Unavailable'].map(x=>'<option value="'+x+'"'+(current.status===x?' selected':'')+'>'+x+'</option>').join('')+'</select><label>Note (optional)</label><input type="text" name="note" maxlength="180" value="'+esc(current.note||'')+'" placeholder="For example, unavailable for event setup this week"><label>Until (optional)</label><input type="date" name="until" value="'+esc(current.until||'')+'"><p data-status></p><button class="hq-button primary" type="submit">Save availability</button></form>');
 markup+=card('<h2>Team availability</h2>'+(d.members||[]).map(x=>'<div class="hq-row"><div class="grow"><strong>'+esc(x.displayName)+'</strong><p>'+esc(x.availability?.note||'')+(x.availability?.until?' · Through '+esc(x.availability.until):'')+'</p></div>'+tag(x.availability?.status||'Available')+'</div>').join(''));
 setContent(markup);
 watchForm($('#availabilityForm'),async x=>{await post('selc-governance','update_availability',x);flash('Availability updated.');await availabilityPage()});
}

async function accountPage(){
 const external=organizerRole(role());
 const [shared,committee]=await Promise.all([
  api('workspace-profile').catch(()=>null),
  committeeRole(role())?api('selc-governance',{query:{scope:'members'}}).catch(()=>null):Promise.resolve(null)
 ]);
 const me=(committee?.members||[]).find(p=>p.accountId===context.data?.home?.me?.accountId)||null;
 let markup=pageHeader('YOUR ACCOUNT',external?'Community Leaders account':'Your SELC space',external?'Your verified account does not grant Sanctum Eros membership or committee access.':'Your Portal account is linked to your SELC appointment, but your public screen name can be different.');
 markup+=card('<div class="hq-row"><div class="grow"><strong>'+esc(context.me.displayName)+'</strong><p>'+esc(RANK[role()]||role())+'</p></div>'+tag('Active session')+'</div>'+(shared?.roles?.length?'<h3>Your connected roles</h3><div class="hq-actions">'+shared.roles.map(r=>tag(r)).join('')+'</div>':'')+'<p>'+(external?'Use the Community Leaders network to check application status and collaborate after approval. Account recovery uses the Portal email service.':'Your personal Portal handles your member profile, password, tickets and course records. A SELC screen name does not change your login.')+'</p>');
 if(me&&role()!=='founder'){
  markup+=card('<h2>Public-facing SELC name</h2><p>Choose the name that appears in the committee directory and SELC replies. Your account name and sign-in stay unchanged.</p><form class="hq-form" id="selcIdentityForm"><label for="selcScreenName">Your SELC screen name</label><input id="selcScreenName" name="publicName" required minlength="2" maxlength="80" value="'+esc(me.screenName||me.displayName||'')+'"><label class="hq-check"><input type="checkbox" name="publicProfile" '+(me.publicProfile?'checked':'')+'> Show my name and committee position on the public SELC website</label><p class="hq-micro">When this is turned off, your name remains visible to authorized committee members but not in the public directory.</p><p data-status role="status"></p><button class="hq-button primary" type="submit">Save my SELC name</button></form>');
 }
 markup+=card('<h2>Connected account</h2><div class="hq-actions">'+(external?'<a class="hq-button" href="/community-leaders/#apply">Organizer account &amp; password help ↗</a>':'<a class="hq-button" href="'+PORTAL+'/member.html#account" rel="noopener noreferrer">Manage member account ↗</a>')+btn('Sign out of SELC','data-signout','danger')+'</div>');
 setContent(markup);
 $('[data-signout]').onclick=signOut;
 const f=$('#selcIdentityForm');
 if(f)watchForm(f,async(values,form)=>{
  const data=await post('selc-governance','update_public_identity',{publicName:values.publicName,publicProfile:form.querySelector('[name=publicProfile]').checked});
  const name=data.member?.screenName||values.publicName;
  setStatus(form.querySelector('[data-status]'),'Saved. Your SELC screen name is '+name+'.');
  flash('SELC name updated.');
  await loadPublicLeadership().catch(()=>{});
 });
}
addEventListener('DOMContentLoaded',startPublic);
})();
