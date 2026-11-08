/* Community Leaders: verified organizer signup and application.
 * No separate password database; Portal provides credentials, reset and email.
 */
(()=>{'use strict';
const $=selector=>document.querySelector(selector);
const tokenKey='selc.session.v1',base='/.netlify/functions/portal-gateway?service=';
let token=sessionStorage.getItem(tokenKey)||'',current=null;
const status=(root,message,good=false)=>{const node=root?.querySelector('[data-leader-status]')||$('#applyStatus');if(!node)return;node.textContent=message;node.style.color=good?'#b5e4c1':'#ffc0ce'};
const plain=v=>String(v??'').trim();
function switchTo(name){
 document.querySelectorAll('[data-leader-panel]').forEach(node=>node.hidden=node.dataset.leaderPanel!==name);
 document.querySelectorAll('[data-leader-tab]').forEach(btn=>{const on=btn.dataset.leaderTab===name;btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',String(on))});
}
async function call(service,method='GET',body,access=token){
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),17000);
 try{
  const headers={'accept':'application/json'};
  if(body!==undefined)headers['content-type']='application/json';
  if(access)headers.authorization='Bearer '+access;
  const response=await fetch(base+encodeURIComponent(service),{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',signal:control.signal});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok)throw new Error(data.error||'The service could not complete your request.');
  return data;
 }catch(e){if(e.name==='AbortError')throw new Error('The Portal did not respond. Try again.');throw e}finally{clearTimeout(timer)}
}
function values(form){const out=Object.fromEntries(new FormData(form).entries());for(const input of form.querySelectorAll('input[type="checkbox"]'))out[input.name]=input.checked;return out}
function handle(form,service,action,after){
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(!form.reportValidity())return;
  const button=form.querySelector('[type="submit"]');button.disabled=true;status(form,'Working…');
  try{const data=await call(service,'POST',{action,...values(form)});status(form,data.message||'Completed.',true);await after?.(data,form)}catch(err){status(form,err.message)}finally{button.disabled=false}
 });
}
function updateState(data){
 current=data;
 const el=$('#leaderAccountState'),application=$('#leaderApplication');
 if(!token){el.innerHTML='<h3>Your application</h3><p>Create or sign into a verified account before applying. Sanctum Eros membership is not required.</p>';application.hidden=true;return}
 if(data.emailVerified===false){el.innerHTML='<h3>Verify your existing SE account email</h3><p>Your existing login works. To apply for Community Leaders, connect and verify an email in your Portal account first. Then return here; no additional Community Leaders account is needed.</p><p><a class="cta" href="https://sanctumportal.org/member.html#account" rel="noopener noreferrer">Verify email in the Portal</a></p>';application.hidden=true;return}
 const own=(data.ownApplications||[]).slice().sort((a,b)=>String(b.submittedAt).localeCompare(String(a.submittedAt)))[0];
 const approved=data.approvedLeader||data.role==='founder';
 if(approved){
  el.innerHTML='<h3>Network access approved</h3><p>Your account can access the private Community Leaders area in SELC Headquarters. Messages, resources, and safety notices are permission-controlled.</p><p><a class="cta" href="/">Open SELC Headquarters</a></p>';application.hidden=true;return;
 }
 if(own&&['Submitted','Needs Verification'].includes(own.status)){
  el.innerHTML='<h3>Application '+own.status+'</h3><p>Your application for '+escapeHTML(own.organization)+' is saved in the Portal and awaiting Founder review. You can return to this page to check its status.</p>';application.hidden=true;return;
 }
 el.innerHTML='<h3>Community Leaders application</h3><p>Signed in. Introduce your organization to apply. This is separate from membership, Staff, and committee appointments.</p>';
 application.hidden=false;
 if(own&&own.status==='Declined'){$('#applyStatus').textContent='Your previous application was declined. A new application will be reviewed separately.'}
}
const escapeHTML=x=>plain(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function refresh(){
 if(!token){updateState({});return}
 try{const d=await call('community-leaders');if(!d.role){token='';sessionStorage.removeItem(tokenKey);updateState({});return}updateState(d)}
 catch(e){const el=$('#leaderAccountState');el.textContent='Could not load your application: '+e.message}
}
document.querySelectorAll('[data-leader-tab]').forEach(b=>b.addEventListener('click',()=>switchTo(b.dataset.leaderTab)));
handle($('#leaderRegister'),'community-leaders','create_account',async(_,form)=>{
 $('#clVerifyEmail').value=plain(form.elements.email.value);
 switchTo('verify');
});
handle($('#leaderVerify'),'community-leaders','verify_email',async()=>{
 switchTo('signin');status($('#leaderSignIn'),'Email verified. Sign in to complete your application.',true);
});
$('#leaderResend').addEventListener('click',async()=>{
 const form=$('#leaderVerify'),email=plain(form.elements.email.value);if(!email||!form.elements.email.checkValidity()){form.elements.email.reportValidity();return}
 try{const d=await call('community-leaders','POST',{action:'resend_verification',email});status(form,d.message,true)}catch(e){status(form,e.message)}
});
handle($('#leaderSignIn'),'selc-auth','login',async(data)=>{
 if(!data.token)throw new Error('SELC did not provide a session token.');
 token=data.token;sessionStorage.setItem(tokenKey,token);status($('#leaderSignIn'),'Signed in. Your application status is shown on the right.',true);await refresh();
});
$('#leaderRequestReset').addEventListener('click',async()=>{
 const form=$('#leaderReset'),email=plain(form.elements.username.value);if(!email){form.elements.username.reportValidity();return}
 try{const d=await call('member-auth','POST',{action:'email_reset_request',username:email},'');status(form,d.message||'Check your verified email for a reset code.',true)}catch(e){status(form,e.message)}
});
handle($('#leaderReset'),'member-auth','email_reset_complete',async()=>{token='';sessionStorage.removeItem(tokenKey);switchTo('signin');status($('#leaderSignIn'),'Password updated. Sign in using your new password.',true)},'');
const form=$('#leaderApplication');
form.addEventListener('submit',async e=>{
 e.preventDefault();if(!form.reportValidity())return;
 const submit=$('#applyButton');submit.disabled=true;$('#applyStatus').textContent='Submitting for Founder review…';
 try{
  const data=await call('community-leaders','POST',{action:'apply',...values(form)});
  $('#applyStatus').textContent=data.message||'Application submitted.';await refresh();
 }catch(err){$('#applyStatus').textContent=err.message}finally{submit.disabled=false}
});
if(new URLSearchParams(location.search).get('register')==='1')switchTo('register');
refresh();
})();
