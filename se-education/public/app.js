(() => {
'use strict';
const portal='https://sanctumportal.org';
const api=portal+'/.netlify/functions/se-education-courses';
const sessionKey='se-education-session';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const selectedCourse=params.get('course')||'';
const selectedEvent=params.get('event')||'';
const session=()=>{try{return JSON.parse(sessionStorage.getItem(sessionKey)||'null')}catch{return null}};
const setStatus=message=>{const el=$('educationStatus');if(el)el.textContent=message};
const endpoint=async (fields={},payload=null)=>{
 const url=new URL(api);Object.entries(fields).forEach(([k,v])=>url.searchParams.set(k,v));
 const token=session()?.token||'';
 const response=await fetch(url,{method:payload?'POST':'GET',mode:'cors',cache:'no-store',headers:{'accept':'application/json',...(payload?{'content-type':'application/json'}:{}),...(token?{'authorization':'Bearer '+token}:{})},...(payload?{body:JSON.stringify(payload)}:{})});
 let body={};try{body=await response.json()}catch{}
 if(!response.ok)throw new Error(body.error||'The education service is not available.');
 return body;
};
const element=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n};
const line=(parent,tag,text,cls)=>{const n=element(tag,text,cls);parent.append(n);return n};
async function exchange(){
 const code=params.get('se_handoff');if(!code)return;
 setStatus('Connecting to the Member Portal…');
 const response=await fetch(portal+'/.netlify/functions/ecosystem-session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'exchange_handoff',target:'education',code,clientOrigin:location.origin})});
 const result=await response.json();
 const url=new URL(location.href);['se_handoff','se_portal','se_app'].forEach(k=>url.searchParams.delete(k));history.replaceState(null,'',url.pathname+url.search+url.hash);
 if(!response.ok||!result?.token)throw new Error(result?.error||'Connection failed.');
 sessionStorage.setItem(sessionKey,JSON.stringify({token:result.token,expiresAt:result.expiresAt}));
 setStatus('Connected to the Sanctum Eros Member Portal.');
}
const plannedCourses=[
 ['BDSM 101: Getting Into Kink','CORE · 101 · 90 minutes','Roles, consent, community and scene foundations.'],
 ['BDSM 201: Scene Planning & Negotiation','CORE · 201 · 120 minutes','Build a complete, revocable scene plan with contingencies.'],
 ['BDSM 301: Complex Scenes & Judgment','CORE · 301 · 120 minutes','Advanced scenario work: group agreements, capacity and incident decisions.'],
 ['Impact 101: Tools, Technique & Control','IMPACT · 101 · 120 minutes','Inspect equipment, examine anatomy and observe inert-target practice.'],
 ['Impact 201: Precision, Pacing & Scene Flow','IMPACT · 201 · 120 minutes','Improve decisions about control, pacing, risk and changes.'],
 ['D/s 101: Dominance, Submission & Power Exchange','POWER EXCHANGE · 101 · 90 minutes','Scope, agency, agreements and responsibility.'],
 ['D/s 201: Protocol, Service & Accountability','POWER EXCHANGE · 201 · 90 minutes','Develop sustainable protocols and reviewable agreements.'],
 ['Dungeon 101: Etiquette & Risk Awareness','COMMUNITY · 101 · 90 minutes','Shared-space conduct, privacy and safety escalation.'],
 ['Dungeon 201: Monitor & Event Operations','COMMUNITY · 201 · 120 minutes','Hazard inspection, intervention and staff handoffs.'],
 ['Psychological & Sensory Play','SPECIALIST · 120 minutes','Negotiation and non-contact learning for complex sensations.']
]
function catalogCard(root,title,meta,summary,published=false,planned=false){
 const card=element('article',null,'card');
 line(card,'div',meta||'Instructor-led Workshop','meta');
 line(card,'h3',title);
 line(card,'p',summary||'SE Education workshop.');
 line(card,'small',planned?'Planned class · Curriculum in preparation':published?'Enrollment and access through the Portal.':'Draft · Enrollment not open');
 const link=element('a','View events and enrollment','btn');link.href=portal+'/events.html';card.append(link);root.append(card);
}
async function catalog(){
 const root=$('liveEducationCatalog');if(!root)return;
 root.replaceChildren();
 try{
  const result=await endpoint({mode:'catalog'}),courses=(result.courses||[]).filter(x=>x.published===true);
  if(!courses.length){
   line(root,'p','Our first classes are in preparation. Enrollment has not opened.');
   for(const [title,meta,summary] of plannedCourses)catalogCard(root,title,meta,summary,false,true);
   return;
  }
  for(const course of courses)catalogCard(root,course.title,(course.level||'Workshop')+' · '+(course.duration||'Instructor-led'),course.summary,true,false);
 }catch(err){
  line(root,'p','The live enrollment feed is temporarily unavailable. These are planned classes, not open registrations.');
  for(const [title,meta,summary] of plannedCourses)catalogCard(root,title,meta,summary,false,true);
 }
}
async function learner(){
 const root=$('learnerWorkspace');if(!root)return;
 if(!selectedCourse||!selectedEvent){root.hidden=true;return}
 root.hidden=false;root.replaceChildren();
 line(root,'h2','Your class materials');
 if(!session()?.token){line(root,'p','Sign in through the Portal to access curriculum for an approved workshop enrollment.');const a=line(root,'a','Connect my account','btn');a.href=portal+'/ecosystem-connect.html?app=education&returnUrl='+encodeURIComponent(location.href);return}
 try{
  const result=await endpoint({courseId:selectedCourse,eventId:selectedEvent});
  const course=result.course;
  let completedModules=[...(result.progress?.completedModules||[])];
  const progressText=line(root,'p','Lessons completed: '+completedModules.length+' / '+(course.modules||[]).length);
  line(root,'h3',course.title);
  line(root,'p',course.summary||'');
  for(const module of course.modules||[]){
   const section=element('section',null,'card');
   line(section,'h3',module.title);
   line(section,'p',module.body||'');
   if(module.slideBullets){const points=element('section');line(points,'h4','Presentation notes');const list=element('ul');String(module.slideBullets).split(/\n+/).filter(Boolean).forEach(x=>line(list,'li',x));points.append(list);section.append(points)}
   if(module.activities)line(section,'p','Class activity: '+module.activities);
   if(module.resources)line(section,'p','Resources: '+module.resources);
   const lab=element('label',null,'quiz-option'),tick=element('input');
   tick.type='checkbox';tick.checked=completedModules.includes(module.id);
   lab.append(tick,document.createTextNode(' Mark lesson complete'));
   tick.addEventListener('change',async()=>{
    tick.disabled=true;
    const proposed=tick.checked?[...new Set([...completedModules,module.id])]:completedModules.filter(x=>x!==module.id);
    try{
     const response=await endpoint({}, {action:'progress',courseId:selectedCourse,eventId:selectedEvent,completedModules:proposed});
     completedModules=response.progress.completedModules;
     progressText.textContent='Lessons completed: '+completedModules.length+' / '+(course.modules||[]).length;
    }catch(err){tick.checked=!tick.checked;setStatus(err.message)}finally{tick.disabled=false}
   });
   section.append(lab);
   root.append(section);
  }
  const inputBox=element('section',null,'card');line(inputBox,'h3','Questions and workshop feedback');
  line(inputBox,'p','Send a question without attaching your name to the instructor response record. Questions and feedback are attached to this workshop event.');
  const question=element('textarea');question.placeholder='Question for the educator';question.rows=3;question.style.width='100%';
  const sendQuestion=element('button','Send anonymous question','btn');sendQuestion.type='button';
  const questionStatus=element('p');questionStatus.setAttribute('role','status');
  sendQuestion.addEventListener('click',async()=>{sendQuestion.disabled=true;try{await endpoint({}, {action:'question',courseId:selectedCourse,eventId:selectedEvent,text:question.value});question.value='';questionStatus.textContent='Question submitted.'}catch(err){questionStatus.textContent=err.message}finally{sendQuestion.disabled=false}});
  inputBox.append(question,sendQuestion,questionStatus);
  const ratingLabel=element('label','Rate this workshop (1–5)');const rating=element('select');
  rating.style.cssText='display:block;min-height:44px;width:100%;margin:10px 0;color:inherit;background:#211b1d;border:1px solid #5a4444;';
  [1,2,3,4,5].forEach(n=>{const option=element('option',n+' / 5');option.value=String(n);rating.append(option)});rating.value='5';ratingLabel.append(rating);
  const feedback=element('textarea');feedback.rows=3;feedback.placeholder='What worked? What should be clearer?';feedback.style.width='100%';
  const sendFeedback=element('button','Submit class feedback','btn');sendFeedback.type='button';
  const feedbackStatus=element('p');feedbackStatus.setAttribute('role','status');
  sendFeedback.addEventListener('click',async()=>{sendFeedback.disabled=true;try{await endpoint({}, {action:'feedback',courseId:selectedCourse,eventId:selectedEvent,text:feedback.value,rating:Number(rating.value)});feedback.value='';feedbackStatus.textContent='Feedback submitted.'}catch(err){feedbackStatus.textContent=err.message}finally{sendFeedback.disabled=false}});
  inputBox.append(ratingLabel,feedback,sendFeedback,feedbackStatus);root.append(inputBox);
  if(course.quiz?.length){
   const form=element('form');line(form,'h3','Knowledge check');
   const answers={};
   for(const q of course.quiz){
    const field=element('fieldset');line(field,'legend',q.prompt);
    (q.choices||[]).forEach((choice,index)=>{
     const label=element('label',null,'quiz-option');
     const input=element('input');input.type='radio';input.name=q.id;input.value=String(index);input.addEventListener('change',()=>{answers[q.id]=input.value});
     label.append(input,document.createTextNode(' '+choice));field.append(label);
    });
    form.append(field);
   }
   const submit=element('button','Submit knowledge check','btn primary');submit.type='submit';form.append(submit);
   const resultText=element('p',null,'quiz-result');form.append(resultText);
   form.addEventListener('submit',async e=>{
    e.preventDefault();submit.disabled=true;resultText.textContent='Checking answers…';
    try{const res=await endpoint({}, {action:'grade',courseId:selectedCourse,eventId:selectedEvent,answers});resultText.textContent='Score: '+res.score+' / '+res.total+'. '+(res.completed?'Class completion recorded.':res.passed?'Knowledge check passed; class completion also requires recorded attendance.':'Review the content and try again.');
      const feedback=element('ul');res.feedback.forEach(x=>line(feedback,'li','Question '+x.id+': '+x.result+(x.explanation?' — '+x.explanation:'')));resultText.append(feedback);
    }catch(err){resultText.textContent=err.message}finally{submit.disabled=false}
   });
   root.append(form);
   const check=element('button','Check my completion record','btn');check.type='button';
   const completion=element('p',null,'quiz-result');
   check.addEventListener('click',async()=>{
    check.disabled=true;completion.textContent='Checking your class record…';
    try{const status=await endpoint({}, {action:'completion',courseId:selectedCourse,eventId:selectedEvent});
     completion.textContent=status.completed?'Class completed and recorded.':status.passed?'Your assessment passed. Attendance check-in is still required.':'No completed assessment is recorded for this workshop.';
    }catch(err){completion.textContent=err.message}finally{check.disabled=false}
   });
   root.append(check,completion);
  }
 }catch(err){line(root,'p',err.message);const a=line(root,'a','Open my Portal account','btn');a.href=portal+'/member.html#education'}
}

async function ownerLibrary(){
 const root=$('ownerCourseLibrary'),content=$('ownerCourseContent');
 if(!root||!content||!session()?.token)return;
 let list;
 try{list=await endpoint({mode:'prepared'});}catch{return;}
 root.hidden=false;content.replaceChildren();
 const heading=element('p','Numbered foundations, intermediate and advanced workshops, plus supporting specialist and leadership curricula. The full prepared library can be reviewed here, including full instructor notes and answer keys. Publishing and enrollment remain separate approval steps.');content.append(heading);
 const coreOrder=['bdsm-101','bdsm-201','bdsm-301','impact-play-foundations','impact-201','power-exchange-and-ds','ds-201','dungeon-etiquette-and-privacy','dungeon-201','psychological-play-emotional-safety'];
 const ordered=[...(list.courses||[])].sort((a,b)=>(coreOrder.indexOf(a.id)<0?99:coreOrder.indexOf(a.id))-(coreOrder.indexOf(b.id)<0?99:coreOrder.indexOf(b.id)));
 for(const item of ordered){
  const card=element('article',null,'card');
  line(card,'div',(coreOrder.includes(item.id)?'FEATURED WORKSHOP · ':'SUPPORTING CURRICULUM · ')+(item.duration||''),'meta');
  line(card,'h3',item.title);line(card,'p',item.summary);
  const open=element('button','Read full course and instructor plan','btn');
  open.type='button';open.setAttribute('aria-expanded','false');
  const details=element('div');details.hidden=true;
  open.addEventListener('click',async()=>{
   if(!details.hidden){details.hidden=true;open.setAttribute('aria-expanded','false');return;}
   open.disabled=true;open.textContent='Opening course…';
   try{
    const res=await endpoint({mode:'teacher',source:'prepared',courseId:item.id});
    const course=res.course||{};
    details.replaceChildren();
    if(course.objectives){line(details,'h4','Learning objectives');line(details,'p',course.objectives);}
    if(course.prerequisites){line(details,'h4','Prerequisites');line(details,'p',course.prerequisites);}
    for(const m of course.modules||[]){
      const section=element('section');line(section,'h4',m.title);
      line(section,'p',m.body||'');
      if(m.activities)line(section,'p','Exercise: '+m.activities);
      if(m.speakerNotes)line(section,'p','Instructor notes: '+m.speakerNotes);
      if(m.prompts)line(section,'p','Teaching prompts: '+m.prompts);
      details.append(section);
    }
    if(course.teacherPlan){line(details,'h4','Complete private instructor plan');const plan=element('pre',course.teacherPlan);plan.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:inherit';details.append(plan);}
    if(course.sources){line(details,'h4','Sources and further reading');line(details,'p',course.sources);}
    if(course.quiz?.length){line(details,'h4','Instructor assessment key');for(const q of course.quiz){line(details,'p',q.prompt+' — '+(q.choices?.[Number(q.answer)]||'')+(q.explanation?' — '+q.explanation:''));}}
    details.hidden=false;open.setAttribute('aria-expanded','true');
   }catch(e){details.replaceChildren();line(details,'p',e.message);details.hidden=false;}
   finally{open.disabled=false;open.textContent='Read full course and instructor plan';}
  });
  const teach=element('a','Open instructor teaching studio','btn');teach.href='/teach.html?course='+encodeURIComponent(item.id);teach.style.marginTop='12px';card.append(teach);
  card.append(open,details);content.append(card);
 }
}

async function start(){
 try{await exchange()}catch(err){setStatus(err.message)}
 const connected=session()?.token&&Date.parse(session()?.expiresAt||'')>Date.now();
 const acct=$('educationAccountLink');if(acct){acct.textContent=connected?'Portal connected · Sign in again':'Sign in with Portal';acct.href=portal+'/ecosystem-connect.html?app=education&returnUrl='+encodeURIComponent(location.href)}
 await Promise.all([catalog(),learner(),ownerLibrary()]);
}
start();
})();