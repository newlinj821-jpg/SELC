(()=>{'use strict';
const PORTAL='https://sanctumportal.org',ROOT=PORTAL+'/.netlify/functions/',TOKEN_KEY='selc.session.v1';
const $=(q,root=document)=>root.querySelector(q),$$=(q,root=document)=>[...root.querySelectorAll(q)];
let token=sessionStorage.getItem(TOKEN_KEY)||'',current=null;
const message=(form,text,good=false)=>{const target=$('.status',form);if(target){target.textContent=text;target.classList.toggle('success',good)}};
const formData=form=>Object.fromEntries(new FormData(form));
async function api(service,{method='GET',body,auth=token}={}){
 const response=await fetch(ROOT+service,{method,mode:'cors',cache:'no-store',headers:{...(auth?{Authorization:'Bearer '+auth}:{}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||data.message||'The Portal could not process this request.');return data;
}
async function showApplication(){
 const profile=await api('selc-governance?scope=home');
 current=profile;
 $('#accountPanel > .tabs').hidden=true;
 $$('[data-panel]').forEach(panel=>panel.hidden=true);
 const area=$('#application');area.hidden=false;
 const apps=profile.myApplications||[],active=apps.find(a=>['Pending','Under Review','Recommended','Not Recommended','Certification Pending'].includes(a.status));
 const approved=apps.some(a=>a.status==='Approved')||['advisor','representative','coordinator'].includes(profile.me?.role);
 $('#appWelcome').textContent=profile.me?.displayName?'Welcome, '+profile.me.displayName:'Your Advisor application';
 $('#priorApps').replaceChildren();
 if(apps.length){const container=document.createElement('div');container.className='steps';
  for(const a of apps){const box=document.createElement('div');box.className='step';const title=document.createElement('b');title.textContent=(a.type==='advisor'?'Advisor':a.type==='representative'?'Representative':'Coordinator')+' · '+a.status;box.append(title);container.append(box)}
  $('#priorApps').append(container)}
 const form=$('#applyForm');
 form.hidden=!!active||approved;
 if(active)$('#appDescription').textContent=active.status==='Certification Pending'?'Your Advisor application has been accepted. Open SELC Headquarters and complete your certification to activate the role.':'Your application is under review. Any clarification questions appear in SELC and your Portal application history.';
 else if(approved)$('#appDescription').textContent='Your SELC leadership position is active. Open Headquarters to participate in committee work.';
 else $('#appDescription').textContent='Your application is reviewed by SELC leadership and accepted by the Founder. No SE membership is required for Advisor participation.';
}
function tab(name){$$('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===name)));$$('[data-panel]').forEach(f=>f.hidden=f.dataset.panel!==name)}
$$('[data-tab]').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
$('#registerForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=$('[type=submit]',form);button.disabled=true;try{
 const d=formData(form),email=d.email;const response=await api('selc-advisor-registration',{method:'POST',auth:'',body:{action:'register',...d,confirm18:d.confirm18==='on',acceptRoleLimit:d.acceptRoleLimit==='on'}});
 $('#verifyForm [name=email]').value=email;
 tab('verify');message($('#verifyForm'),response.message||'Check your email for a verification code.',true)
 }catch(error){message(form,error.message)}finally{button.disabled=false}};
$('#verifyForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=$('[type=submit]',form);button.disabled=true;try{
 const response=await api('selc-advisor-registration',{method:'POST',auth:'',body:{action:'verify',...formData(form)}});
 tab('signin');$('#signInForm [name=username]').value=form.elements.email.value;
 message($('#signInForm'),response.message||'Email verified. Sign in to continue.',true)
 }catch(error){message(form,error.message)}finally{button.disabled=false}};
$('#resendCode').onclick=async()=>{const form=$('#verifyForm'),button=$('#resendCode');button.disabled=true;try{const response=await api('selc-advisor-registration',{method:'POST',auth:'',body:{action:'resend',email:form.elements.email.value}});message(form,response.message||'If your account exists, a verification email was requested.',true)}catch(error){message(form,error.message)}finally{button.disabled=false}};
$('#signInForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=$('[type=submit]',form);button.disabled=true;try{
 const response=await api('selc-auth',{method:'POST',auth:'',body:{action:'login',...formData(form)}});
 if(!response.token)throw Error('Your SELC session was not established.');
 token=response.token;sessionStorage.setItem(TOKEN_KEY,token);await showApplication()
 }catch(error){message(form,error.message)}finally{button.disabled=false}};
$('#applyForm').onsubmit=async e=>{e.preventDefault();const form=e.currentTarget,button=$('[type=submit]',form);button.disabled=true;try{
 const data=formData(form);if(data.truthful!=='on')throw Error('Confirm the accuracy of your answers.');
 delete data.truthful;
 const result=await api('selc-governance',{method:'POST',body:{action:'apply_advisor',answers:data}});
 message(form,'Advisor application submitted. You can monitor your status in SELC Headquarters.',true);
 await showApplication()
 }catch(error){message(form,error.message)}finally{button.disabled=false}};
if(token){showApplication().catch(error=>{
 // Preserve the session during temporary Portal/network failures. A 401/403
 // should require a fresh sign-in, but an outage must not log applicants out.
 const denied=/(session|expired|sign in|unauthori[sz]ed|permission|access denied)/i.test(String(error?.message||''));
 if(denied){token='';sessionStorage.removeItem(TOKEN_KEY)}
 tab('signin');message($('#signInForm'),denied?'Your session needs to be renewed. Sign in to continue.':'Could not load your application right now. Your session has been preserved; refresh to retry.');
})}
else if(location.hash==='#signin')tab('signin');
})();