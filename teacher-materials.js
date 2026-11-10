(()=>{'use strict';
const $=id=>document.getElementById(id),param=new URLSearchParams(location.search),selc=document.body.dataset.workspace==='selc',apiBase='https://sanctumportal.org/.netlify/functions/se-education-courses';
let rows=[],course=null,activeTab='overview',slide=0;
const element=(tag,text='',className='')=>{const x=document.createElement(tag);x.textContent=text;if(className)x.className=className;return x};
const add=(root,tag,text,cls)=>{const x=element(tag,text,cls);root.append(x);return x};
function rich(root,text){
 const lines=String(text||'').replace(/\r\n/g,'\n').split('\n');let list=null;
 for(const raw of lines){const s=raw.trim();if(!s){list=null;continue}
  const match=s.match(/^(#{1,4})\s+(.*)$/);
  if(match){list=null;add(root,match[1].length<=2?'h2':'h3',match[2]);continue}
  if(/^([-*]\s+|\d+\.\s+)/.test(s)){if(!list){list=element('ul');root.append(list)}add(list,'li',s.replace(/^([-*]\s+|\d+\.\s+)/,''));continue}
  list=null;add(root,'p',s.replace(/\*\*/g,''));
 }
}
const status=s=>{$('status').textContent=s};
function token(){return sessionStorage.getItem('selc.session.v1')||''}
async function request(q){
 const url=new URL(selc?apiBase:'/.netlify/functions/se-education-courses',location.href);
 Object.entries(q).forEach(([k,v])=>url.searchParams.set(k,v));
 const r=await fetch(url,{method:'GET',mode:selc?'cors':'same-origin',cache:'no-store',credentials:selc?'omit':'same-origin',headers:{accept:'application/json',...(selc&&token()?{authorization:'Bearer '+token()}:{})}});
 let j={};try{j=await r.json()}catch{}
 if(!r.ok)throw Error(j.error||'Unable to load course: HTTP '+r.status);
 return j;
}
function badge(root,txt){add(root,'span',txt)}
function menu(){
 const root=$('courses'),search=$('search').value.toLowerCase();root.replaceChildren();
 for(const x of rows.filter(x=>(x.title+' '+x.id).toLowerCase().includes(search))){
  const b=element('button');b.type='button';b.setAttribute('aria-current',String(course?.id===x.id));
  b.append(element('span',x.title),element('small',(x.status||'Draft')+' · '+(x.duration||'')));
  b.onclick=()=>openCourse(x.id);root.append(b);
 }
 if(!root.childElementCount)add(root,'p','No matching courses','empty');
}
function closeMenu(){$('sidebar').classList.remove('open');document.body.classList.remove('no-scroll')}
function openMenu(){$('sidebar').classList.add('open');document.body.classList.add('no-scroll')}
function header(){
 $('courseTitle').textContent=course.title||'Untitled course';$('summary').textContent=course.summary||'';
 $('breadcrumb').textContent='SE EDUCATION / '+(course.title||course.id).toUpperCase();
 const m=$('metadata');m.replaceChildren();[course.status||'Development',course.level||'All levels',course.duration||'',course.source==='prepared'?'Prepared preview · not imported':course.version?'Version '+course.version:''].filter(Boolean).forEach(x=>badge(m,x));
 $('tabs').hidden=false;
 document.title=(course.title||'Teacher Materials')+' · SE Education';
}
function section(root,title,value){if(!value)return;const part=add(root,'section','','sheet');add(part,'h3',title);const t=add(part,'div','','rich');rich(t,value)}
function renderOverview(root){
 add(root,'h2','Class overview');const card=add(root,'div','','sheet');
 add(card,'h3','Learning outcomes');rich(add(card,'div','','rich'),course.objectives||'No objectives entered.');
 if(course.prerequisites){add(card,'h3','Prerequisites');rich(add(card,'div','','rich'),course.prerequisites)}
 add(card,'h3','At a glance');add(card,'p',String((course.modules||[]).length)+' learning modules · '+String((course.quiz||[]).length)+' knowledge-check questions');
 add(card,'p','Private instructor materials remain restricted. Previewing does not publish classes or enable enrollment.','format-note');
}
function renderGuide(root){
 add(root,'h2','Instructor guide');add(root,'p','Full teaching script, run-of-show, preparation and contingency guidance.','format-note');
 const wrap=add(root,'article','','sheet rich');rich(wrap,course.teacherPlan||'No instructor guide has been written.');
}
function renderLessons(root){
 add(root,'h2','Lesson-by-lesson plan');for(const [i,m]of(course.modules||[]).entries()){
  const card=add(root,'article','','module');add(card,'span','LESSON '+(i+1)+' · '+(m.minutes||'?')+' MIN','eyebrow');add(card,'h3',m.title);
  for(const [label,value]of [['Student material',m.body],['Class exercise',m.activities],['Slide bullet points',m.slideBullets],['Instructor speaking notes',m.speakerNotes],['Discussion prompts',m.prompts],['References',m.resources]]){
   if(!value)continue;const child=add(card,'section');add(child,'h3',label);rich(add(child,'div','','rich'),value)
  }
 }
}
function renderSlide(root){
 const m=(course.modules||[])[slide],box=$('slideBox');if(!m)return;box.replaceChildren();
 add(box,'span','LESSON '+(slide+1)+' OF '+course.modules.length,'eyebrow');add(box,'h2',m.title);
 const bullets=add(box,'ul');String(m.slideBullets||m.body||'').split('\n').filter(Boolean).slice(0,9).forEach(t=>add(bullets,'li',t));
 $('slideCount').textContent='Slide '+(slide+1)+' of '+course.modules.length+' · '+(m.minutes||'?')+' minutes';
 $('prev').disabled=slide===0;$('next').disabled=slide===course.modules.length-1;
 const note=$('speakerNotes');note.replaceChildren();rich(note,m.speakerNotes||'No speaker notes entered.');
}
function renderPresentation(root){
 add(root,'h2','Teaching mode');add(root,'p','Use the lesson slides and optional private speaker notes.','format-note');
 const box=add(root,'section','','slide-card');box.id='slideBox';
 const controls=add(root,'div','','controls'),prev=add(controls,'button','← Previous','secondary');prev.id='prev';
 const counter=add(controls,'span','','format-note');counter.id='slideCount';
 const next=add(controls,'button','Next lesson →');next.id='next';
 prev.onclick=()=>{slide--;renderSlide(root)};next.onclick=()=>{slide++;renderSlide(root)};
 const details=add(root,'details','','speaker');add(details,'summary','Instructor speaking notes');const n=add(details,'div','','sheet rich');n.id='speakerNotes';
 renderSlide(root);
}
function renderQuiz(root){
 add(root,'h2','Quiz & answer key');add(root,'p','Private teaching review only. Never distribute this answer key to learners.','format-note');
 for(const [i,q]of(course.quiz||[]).entries()){
  const box=add(root,'article','','question');add(box,'span','QUESTION '+(i+1),'eyebrow');add(box,'h3',q.prompt);
  const ul=add(box,'ol');ul.type='A';(q.choices||[]).forEach((x,j)=>{const li=add(ul,'li',x+(j===Number(q.answer)?' · Correct answer':''));if(j===Number(q.answer))li.className='answer'});
  if(q.explanation){add(box,'h3','Teaching rationale');rich(add(box,'div','','rich'),q.explanation)}
 }
}
function renderResources(root){
 add(root,'h2','Research & references');
 const b=add(root,'article','','sheet rich');rich(b,course.sources||'No research sources entered.');
 const p=add(root,'p','Review medical, accessibility, and organizational safety claims before teaching. External content must not be reproduced without permission.','format-note');
}
function render(){
 if(!course)return;
 const root=$('content');root.replaceChildren();
 ({overview:renderOverview,guide:renderGuide,lessons:renderLessons,presentation:renderPresentation,quiz:renderQuiz,resources:renderResources}[activeTab]||renderOverview)(root);
 document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===activeTab)));
}
async function openCourse(id){
 status('Loading secure teacher materials…');
 try{const r=await request({mode:'teacher',courseId:id});course=r.course;
  header();menu();render();status(course.source==='prepared'?'Prepared draft · not imported or published.':'Restricted teacher view · read-only');
  const u=new URL(location.href);u.searchParams.set('course',id);history.replaceState(null,'',u.pathname+u.search);closeMenu();
  if(window.innerWidth<800)$('reading').scrollIntoView({block:'start'});
 }catch(e){status(e.message)}
}
async function init(){
 try{
  const cat=await request({mode:'catalog'}),prepared=await request({mode:'prepared'}).catch(()=>({courses:[]}));
  const list=new Map();for(const x of prepared.courses||[])list.set(x.id,x);for(const x of cat.courses||[])list.set(x.id,x);
  rows=[...list.values()].sort((a,b)=>a.title.localeCompare(b.title));menu();
  if(!rows.length){status('No accessible courses. Sign in as the Founder or an approved educator.');return}
  const wanted=param.get('course')||param.get('courseId')||'';
  await openCourse(rows.some(x=>x.id===wanted)?wanted:rows[0].id);
 }catch(e){status('Access could not be verified: '+e.message+'. Sign in to your '+(selc?'SELC Headquarters':'Portal')+' account first.')}
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;render()});
$('search').oninput=menu;$('print').onclick=()=>{const prior=activeTab;activeTab='guide';render();window.print();activeTab=prior;render()};
$('openMenu').onclick=openMenu;$('closeMenu').onclick=closeMenu;
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu()});
init();
})();