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
async function catalog(){
 const root=$('liveEducationCatalog');if(!root)return;
 try{
  const result=await endpoint({mode:'catalog'});
  root.replaceChildren();
  if(!result.courses?.length){line(root,'p','The first classes are being prepared. Enrollment is not open yet.');return}
  for(const course of result.courses){
   const card=element('article',null,'card');
   line(card,'div',(course.level||'Workshop')+' · '+(course.duration||'Instructor-led'),'meta');
   line(card,'h3',course.title);
   line(card,'p',course.summary||'Explore this SE Education class.');
   if(course.published)line(card,'small','Enrollment and class access are managed through the Portal.');
   else line(card,'small','Draft · Available to authorized educators only');
   card.append(element('a','View Portal classes','btn')).lastElementChild.href=portal+'/events.html';
   root.append(card);
  }
 }catch(err){line(root,'p','Course catalog unavailable. '+err.message)}
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
      const feedback=element('ul');res.feedback.forEach(x=>line(feedback,'li','Question '+x.id+': '+x.result));resultText.append(feedback);
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
async function start(){
 try{await exchange()}catch(err){setStatus(err.message)}
 const connected=session()?.token&&Date.parse(session()?.expiresAt||'')>Date.now();
 const acct=$('educationAccountLink');if(acct){acct.textContent=connected?'Connected to Portal':'Connect Portal account';acct.href=portal+'/ecosystem-connect.html?app=education&returnUrl='+encodeURIComponent(location.href)}
 await Promise.all([catalog(),learner()]);
}
start();
})();