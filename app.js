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
const RANK={founder:'Founder & Chair',coordinator:'SELC Coordinator',representative:'SELC Representative',member:'Community Member'};
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
  try{
   const response=await fetch(url,{method,mode:'cors',cache:'no-store',credentials:'omit',headers:{...(token?{'Authorization':'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});
   let data={};try{data=await response.json()}catch{}
   if(!response.ok){const error=new Error(data.error||('Request failed ('+response.status+')'));error.status=response.status;throw error}
   return data;
  }catch(e){if(e.name==='AbortError')throw new Error('The Portal is taking too long to respond. Please try again.');throw e}finally{clearTimeout(timer)}
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
 watchForm($('#loginForm'),async b=>{
  setStatus($('#loginStatus'),'Checking your Portal account…');
  const result=await api('selc-auth',{method:'POST',token:'',body:{action:'login',username:b.username,password:b.password}});
  if(!result.token)throw new Error('The sign-in service did not return a session.');
  setAccess(result.token);$('#loginDialog').close();$('#loginForm').reset();await beginHeadquarters();
 });
 loadPublicLeadership().catch(()=>{});
 const params=new URLSearchParams(location.search);
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
 setupHQNav();const hash=location.hash.split('/')[1];await openPage(hash||'home');
}
const NAV=[
 ['home','⌂','Overview','Your work'],
 ['join','✎','Apply to SELC','Your work',u=>u==='member'],
 ['coordinator','⇧','Coordinator application','Your work',u=>u==='representative'],
 ['ballots','✓','Coordinator election','Your work',u=>u==='representative'||u==='coordinator'],
 ['applications','▤','SELC applications','Leadership',u=>u==='founder'||u==='coordinator'],
 ['leader','◈','Leadership & appointments','Leadership',u=>u==='founder'||u==='coordinator'||u==='representative'],
 ['proposals','◉','Proposals & votes','Committee',u=>u!=='member'],
 ['requests','↗','Community conversations','Committee',u=>u!=='member'],
 ['educators','✦','Education & workshops','Committee',u=>u!=='member'],
 ['generalapps','▧','Member & role applications','Event operations',u=>u!=='member'],
 ['events','▦','Events & RSVPs','Event operations',u=>u!=='member'],
 ['door','⌗','Check-in & tickets','Event operations',u=>u!=='member'],
 ['banreports','⚑','Ban Reports','Safety',u=>u!=='member'],
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
 const allowed=NAV.find(n=>n[0]===page&&(!n[4]||n[4](role())));
 if(!allowed)page='home';context.activePage=page;
 $$('#hqNavigation [data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
 $('#hqCurrentSection').textContent=allowed?.[2]?.toUpperCase()||'HEADQUARTERS';
 if(location.hash!=='#/'+page)history.replaceState(null,'','#/'+page);
 load();
 try{
  const pages={home:homePage,join:joinPage,coordinator:coordinatorPage,ballots:ballotsPage,applications:applicationsPage,leader:leaderPage,proposals:proposalPage,requests:()=>requestsPage('all'),educators:()=>requestsPage('education'),generalapps:generalAppsPage,events:eventPage,door:doorPage,banreports:banReportsPage,myaccount:accountPage};
  await (pages[page]||homePage)();$('#hqContent')?.scrollTo?.({top:0,behavior:'instant'});
 }catch(error){if(error.status===401){clearAccess();$('#headquarters').classList.add('hidden');$('#publicSite').classList.remove('hidden');document.body.style.overflow='';openLogin();flash('Your session expired. Please sign in again.');return}failure(error)}
}
async function homePage(){
 const jobs=[api('selc-governance',{query:{scope:'home'}})];
 if(leader())jobs.push(api('community-requests'),api('staff-portal'),api('ban-reports'));
 const results=await Promise.allSettled(jobs),home=results[0].status==='fulfilled'?results[0].value:null;
 if(!home)throw results[0].reason||new Error('The leadership workspace is unavailable.');
 context.data.home=home;
 if(!leader()){setContent(pageHeader('WELCOME TO SELC','Your next chapter','Interested in contributing to the community? Your active Portal membership gives you access to the Representative application.')+card('<h2>Help build something meaningful</h2><p>We welcome people who care about better education, thoughtful events, stronger connections, and practical support for the community.</p>'+btn('Apply to be a Representative','data-page-link="join"','primary'))+(home.myApplications?.length?card('<h2>Your applications</h2>'+home.myApplications.map(a=>'<div class="hq-row"><div class="grow"><strong>'+esc(a.type)+' application</strong><p>Submitted '+esc(date(a.createdAt))+'</p></div>'+tag(a.status)+'</div>').join('')):''));bindPageLinks();return}
 const [conv,staff,bans]=results.slice(1).map(r=>r.status==='fulfilled'?r.value:null);
 const proposals=await api('selc-governance',{query:{scope:'proposals'}}).catch(()=>({proposals:[]}));
 const cards=[['SELC SEATS',String(home.occupiedSeats||0)+'/5'],['COORDINATORS',String(home.coordinators||0)+'/2'],['OPEN CONVERSATIONS',number(conv?.openCount||0)],['BAN REPORTS PENDING',number(bans?.pendingCount||0)]];
 let markup=pageHeader('YOUR COMMUNITY / YOUR RESPONSIBILITY','Welcome back, '+(context.me.displayName||'').split(' ')[0],'Leadership is the work we do together—not just the title we hold.',btn('Start a proposal','data-page-link="proposals"','primary'));
 markup+='<div class="hq-stats">'+cards.map(([label,value])=>'<div class="hq-stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong></div>').join('')+'</div>';
 markup+='<div class="hq-grid">'+card('<h2>Where your attention can help</h2>'+[
  ['Committee proposals',(proposals.proposals||[]).filter(p=>p.status==='Discussion').length,'proposals'],
  ['Community & educator requests',conv?.openCount||0,'requests'],['Ban Reports awaiting decision',bans?.pendingCount||0,'banreports'],['Upcoming events',staff?.events?.length||0,'events']
 ].map(([label,value,link])=>'<div class="hq-row"><div class="grow"><strong>'+esc(label)+'</strong><p>'+number(value)+' item(s)</p></div>'+btn('Open','data-page-link="'+link+'"')+'</div>').join(''))+
 card('<h2>Quick access</h2><p>All authorized SELC responsibilities live here, using the same event and member records as the Portal.</p><div class="hq-grid-3">'+[['Applications','generalapps'],['RSVPs & events','events'],['Door & tickets','door'],['Education','educators'],['Committee vote','ballots'],['Leadership','leader']].map(([label,link])=>btn(label,'data-page-link="'+link+'"')).join('')+'</div>')+'</div>';
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
 const d=modal(a.displayName+' · '+a.type,'<p>'+tag(a.status)+' Submitted '+esc(date(a.createdAt))+'</p><div class="hq-card">'+answers+'</div><form class="hq-form" id="appReviewForm"><label>Notes for review</label><textarea name="notes" rows="4" placeholder="Record questions, findings, recommendations, or appointment reasons">'+esc(a.reviewNotes||'')+'</textarea><label>Public display name (optional)</label><input name="publicName" value="'+esc(a.displayName||'')+'"><label class="checkline"><input type="checkbox" name="publicProfile"> Show this person's name publicly with their consent</label><div class="hq-actions">'+btn('Mark under review','data-action="review"')+(owner()?btn('Appoint','data-action="appoint"','primary')+btn('Decline','data-action="decline"','danger'):btn('Recommend','data-action="recommend"','primary')+btn('Not recommended','data-action="not-recommended"'))+'</div><p data-status class="hq-form-status"></p></form>');
 $$('[data-action]',d).forEach(btnEl=>btnEl.onclick=async()=>{const vals=formValues($('#appReviewForm',d)),action=btnEl.dataset.action;try{
  if(action==='appoint'){if(!confirmDecision('Appoint this person? Committee limits and votes are checked by the Portal.'))return;await post('selc-governance','appoint',{id:a.id,...vals,publicProfile:!!$('#appReviewForm input[name=publicProfile]',d).checked})}
  else if(action==='decline')await post('selc-governance','decline',{id:a.id,notes:vals.notes});
  else await post('selc-governance','review_application',{id:a.id,status:action==='review'?'Under Review':action==='recommend'?'Recommended':'Not Recommended',notes:vals.notes});
  d.close();flash('Application updated.');applicationsPage()
 }catch(e){setStatus($('[data-status]',d),e.message)}});
 });
}
async function leaderPage(){
 const data=await api('selc-governance',{query:{scope:'members'}}),people=data.members||[];
 let markup=pageHeader('THE PEOPLE BEHIND THE WORK','SELC leadership','Five Representative seats, including no more than two Coordinators. Members keep one committee vote regardless of title.');
 markup+='<div class="hq-stats"><div class="hq-stat"><small>REPRESENTATIVE SEATS</small><strong>'+people.length+' / 5</strong></div><div class="hq-stat"><small>COORDINATORS</small><strong>'+people.filter(x=>x.role==='coordinator').length+' / 2</strong></div></div>';
 markup+=card('<h2>Committee members</h2>'+people.map(p=>'<div class="hq-row"><div class="grow"><strong>'+esc(p.displayName)+'</strong><p>Seat '+esc(p.seat)+' · '+esc(RANK[p.role]||p.role)+'</p></div>'+tag(p.role)+(owner()?btn('Remove','data-remove="'+esc(p.accountId)+'"','danger'):'')+'</div>').join(''));
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
 const [apps,members]=await Promise.all([api('applications'),api('members',{query:{status:'pending'}})]),roles=apps.applications||[],memberRows=members.members||[];
 let markup=pageHeader('MEMBERS & OPPORTUNITIES','Applications','SELC Representatives can help review routine membership and role applications. Elevated IA Staff appointments receive additional review.');
 markup+='<div class="hq-tabs"><button class="active" data-app-tab="membership">Membership ('+memberRows.length+')</button><button data-app-tab="roles">Roles & educators ('+roles.length+')</button></div>';
 markup+='<section id="membershipTab">'+(memberRows.length?memberRows.map(m=>card('<div class="hq-row"><div class="grow"><strong>'+esc(m.name||'Applicant')+'</strong><p>'+esc(m.fetlife?'@'+m.fetlife:m.loginEmail)+' · '+esc(date(m.createdAt))+'</p></div>'+tag(m.status)+btn('Review','data-member-app="'+esc(m.id)+'"')+'</div>')).join(''):empty('No pending memberships'))+'</section>';
 markup+='<section id="roleTab" hidden>'+(roles.length?roles.map(a=>card('<div class="hq-row"><div class="grow"><strong>'+esc(a.name||'Applicant')+'</strong><p>'+esc((a.type||'').replaceAll('_',' '))+' · '+esc(date(a.createdAt))+'</p></div>'+tag(a.status)+btn('Review','data-role-app="'+esc(a.id)+'"')+'</div>')).join(''):empty('No role applications'))+'</section>';
 setContent(markup);
 $$('[data-app-tab]').forEach(b=>b.onclick=()=>{$$('[data-app-tab]').forEach(x=>x.classList.toggle('active',x===b));$('#membershipTab').hidden=b.dataset.appTab!=='membership';$('#roleTab').hidden=b.dataset.appTab!=='roles'});
 $$('[data-member-app]').forEach(b=>b.onclick=()=>{const m=memberRows.find(x=>x.id===b.dataset.memberApp);if(!m)return;
  const details=['name','fetlife','loginEmail','generalArea','about','experience','limits','whyJoin','communityConflict','adminNotes','reviewAssist'].filter(k=>m[k]).map(k=>'<div class="hq-row"><div class="grow"><strong>'+esc(k)+'</strong><p class="hq-prose">'+esc(typeof m[k]==='object'?JSON.stringify(m[k]):m[k])+'</p></div></div>').join('');
  const dlg=modal('Membership application','<div class="hq-card">'+details+'</div><form class="hq-form" id="memberReview"><label>Private review notes</label><textarea name="adminNotes" rows="4"></textarea><p data-status class="hq-form-status"></p><div class="hq-actions">'+btn('Approve','data-membership-decision="approved"','primary')+btn('Decline','data-membership-decision="denied"','danger')+btn('Keep pending','data-membership-decision="pending"')+'</div></form>');
  $$('[data-membership-decision]',dlg).forEach(x=>x.onclick=async()=>{if(!confirmDecision('Record this membership decision?'))return;try{await api('members',{method:'POST',body:{adminAction:x.dataset.membershipDecision,id:m.id,...formValues($('#memberReview',dlg))}});dlg.close();flash('Membership updated.');generalAppsPage()}catch(e){setStatus($('[data-status]',dlg),e.message)}});
 });
 $$('[data-role-app]').forEach(b=>b.onclick=()=>{const a=roles.find(x=>x.id===b.dataset.roleApp);if(!a)return;const details=Object.entries(a).filter(([k,v])=>!['passwordHash','salt','securityAnswerHash'].includes(k)&&v!==null&&typeof v!=='object').slice(0,25).map(([k,v])=>'<div class="hq-row"><div class="grow"><strong>'+esc(k)+'</strong><p class="hq-prose">'+esc(v)+'</p></div></div>').join('');
  const dlg=modal('Role application','<div class="hq-card">'+details+'</div><form class="hq-form" id="roleReview"><label>Internal notes</label><textarea name="adminNotes"></textarea><label>Message for applicant</label><textarea name="memberResponse"></textarea><p data-status class="hq-form-status"></p><div class="hq-actions">'+btn('Approve','data-role-decision="Approved"','primary')+btn('Decline','data-role-decision="Declined"','danger')+btn('Under review','data-role-decision="Under Review"')+'</div></form>');
  $$('[data-role-decision]',dlg).forEach(x=>x.onclick=async()=>{try{await api('applications',{method:'POST',body:{adminAction:'review',id:a.id,status:x.dataset.roleDecision,...formValues($('#roleReview',dlg))}});dlg.close();flash('Application updated.');generalAppsPage()}catch(e){setStatus($('[data-status]',dlg),e.message)}});
 });
}
async function eventPage(){
 const data=await api('staff-portal'),evs=data.events||[];
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
 stopCamera();const data=await api('staff-portal'),events=data.events||[];
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
async function banReportsPage(){
 const d=await api('ban-reports'),rows=d.reports||[];
 let markup=pageHeader('CONFIDENTIAL / SAFETY','Ban Reports','Ban Reports are separate from IA investigations. An unresolved report places linked admission on hold—not a finding of misconduct.',btn('Submit Ban Report','data-new-ban','primary'));
 markup+=rows.length?rows.map(r=>card('<div class="hq-row"><div class="grow"><strong>'+esc(r.person)+' · '+esc(r.reportNumber||'')+'</strong><p>'+esc(r.createdBy)+' · '+esc(date(r.createdAt))+' · '+number(r.ticketsRevoked)+' ticket(s) held</p></div>'+tag(r.status)+btn('Review','data-open-ban="'+esc(r.id)+'"')+'</div>')).join(''):empty('No Ban Reports','New reports and admission holds appear here.');
 setContent(markup);$('[data-new-ban]').onclick=()=>{
  const dlg=modal('Submit a Ban Report','<p class="hq-muted">A linked ticket will be held while an authorized reviewer considers this report. Provide verified identity—not a name-only guess.</p><form id="banForm" class="hq-form"><label>Person involved</label><input name="person" required><div class="hq-form-grid"><div><label>Verified member record ID</label><input name="memberRecordId" placeholder="From member lookup"></div><div><label>Incident date</label><input type="date" name="incidentDate"></div><div><label>Event ID (optional)</label><input name="eventId"></div><div><label>RSVP ID (optional)</label><input name="rsvpId"></div></div><label>What happened? Give a clear factual account.</label><textarea name="summary" rows="7" minlength="40" required></textarea><label>Witnesses</label><textarea name="witnesses"></textarea><label>Evidence / documentation</label><textarea name="evidenceDescription"></textarea><label>Immediate actions taken</label><textarea name="immediateActions"></textarea><label>Safety concern</label><textarea name="safetyConcern"></textarea><label>Related IA case (optional, separate)</label><input name="relatedIaCase"><label>Outcome being requested</label><input name="requestedOutcome"><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Submit report & hold linked admission</button></form>');
  watchForm($('#banForm',dlg),async vals=>{if(!vals.memberRecordId&&(!vals.eventId||!vals.rsvpId))throw new Error('Link a verified member record or an exact event and RSVP.');await post('ban-reports','submit',vals);dlg.close();flash('Ban Report submitted; linked admission is on hold.');banReportsPage()});
 };
 $$('[data-open-ban]').forEach(b=>b.onclick=()=>{const r=rows.find(x=>x.id===b.dataset.openBan);if(!r)return;
  const dlg=modal('Ban Report '+r.reportNumber,'<p>'+tag(r.status)+' · '+esc(r.createdBy)+' · '+esc(date(r.createdAt))+'</p><h3>Person involved</h3><p>'+esc(r.person)+'</p><h3>Incident account</h3><p class="hq-prose">'+esc(r.summary)+'</p><h3>Evidence and witnesses</h3><p class="hq-prose">'+esc(r.evidenceDescription||'')+'</p><p class="hq-prose">'+esc(r.witnesses||'')+'</p><h3>Admission status</h3><p>'+number(r.ticketsRevoked)+' ticket(s) held · '+esc(r.memberRecordId||r.rsvpId||'No link')+'</p>'+(r.decision?'<div class="hq-card"><strong>Decision</strong><p>'+esc(r.decisionReason)+'</p><small>'+esc(r.decidedBy)+'</small></div>':'')+(d.canDecide&&r.status==='Pending'?'<form id="banDecision" class="hq-form"><label>Decision</label><select name="decision"><option value="decline">Decline / lift hold</option><option value="approve">Approve ban</option></select><label>Ban duration (if approved)</label><select name="kind"><option value="permanent">Permanent</option><option value="temporary">Temporary</option></select><label>End date (temporary)</label><input type="datetime-local" name="expiresAt"><label>Decision rationale (30 characters minimum)</label><textarea name="decisionReason" minlength="30" required></textarea><p data-status class="hq-form-status"></p><button type="submit" class="hq-button primary">Record decision</button></form>':''));
  watchForm($('#banDecision',dlg),async vals=>{if(vals.decision==='approve'&&vals.kind==='temporary'&&!vals.expiresAt)throw new Error('Choose an expiration for a temporary ban.');if(!confirmDecision('Confirm this formal access decision? Every outcome is recorded and visible in Owner Administration.'))return;await post('ban-reports','decide',{id:r.id,...vals,expiresAt:vals.expiresAt?new Date(vals.expiresAt).toISOString():''});dlg.close();flash('Decision recorded.');banReportsPage()});
 });
}
async function accountPage(){setContent(pageHeader('YOUR ACCOUNT','Your SELC space','Your Portal membership is the identity behind this account.')+card('<div class="hq-row"><div class="grow"><strong>'+esc(context.me.displayName)+'</strong><p>'+esc(RANK[role()]||role())+'</p></div>'+tag('Active session')+'</div><p>Your personal Portal remains available whenever you need events, courses, personal tickets, and account settings.</p><div class="hq-actions"><a class="hq-button" href="'+PORTAL+'/member.html" rel="noopener noreferrer">Open Member Portal ↗</a><a class="hq-button" href="'+PORTAL+'/staff.html" rel="noopener noreferrer">Open Staff Portal ↗</a>'+btn('Sign out of SELC','data-signout','danger')+'</div>'));$('[data-signout]').onclick=signOut}
addEventListener('DOMContentLoaded',startPublic);
})();
