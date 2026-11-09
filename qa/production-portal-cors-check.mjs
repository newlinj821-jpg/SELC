import assert from 'node:assert/strict';
const origin='https://se-selc.netlify.app';
const base='https://sanctumportal.org';
const services=['selc-auth','ecosystem-session','selc-governance','community-leaders'];
async function reliableFetch(url,options={}){
 let last;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const response=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});
   if([502,503,504].includes(response.status)&&attempt<2){last=new Error('Gateway temporarily returned '+response.status);await new Promise(r=>setTimeout(r,700*(attempt+1)));continue}
   return response;
  }catch(error){last=error;if(attempt===2)break;await new Promise(r=>setTimeout(r,700*(attempt+1)))}
 }
 throw last;
}
for(const service of services){
 const endpoint=base+'/.netlify/functions/'+service;
 const r=await reliableFetch(endpoint,{method:'OPTIONS',headers:{
  Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type,authorization'
 },redirect:'manual',signal:AbortSignal.timeout(15000)});
 const cors=r.headers.get('access-control-allow-origin')||'';
 const methods=r.headers.get('access-control-allow-methods')||'';
 const headers=r.headers.get('access-control-allow-headers')||'';
 console.log(JSON.stringify({service,method:'OPTIONS',status:r.status,cors,methods,headers,nfRequestId:r.headers.get('x-nf-request-id')}));
 assert.equal(r.status,204,service+' preflight must succeed without a body');
 assert.ok(cors===origin||cors==='*',service+' preflight must authorize official SELC');
 assert.match(methods,/POST/i);
 assert.match(headers,/content-type/i);
 assert.match(headers,/authorization/i);
}
const auth=await reliableFetch(base+'/.netlify/functions/selc-auth',{method:'POST',headers:{
 Origin:origin,'content-type':'application/json'
},body:JSON.stringify({action:'login',username:'__invalid_qa_user__',password:'__invalid_qa_password__'}),signal:AbortSignal.timeout(16000)});
const payload=await auth.json();
const cors=auth.headers.get('access-control-allow-origin');
console.log(JSON.stringify({service:'selc-auth',method:'POST',status:auth.status,cors,code:payload.code,requestId:payload.requestId}));
assert.equal(cors,origin,'Real login response must expose exact SELC origin');
assert.equal(auth.status,401,'Unknown account must fail cleanly, not crash to 503');
assert.equal(payload.code,'invalid_credentials','Wrong credentials must be distinguishable from a network error');
assert.ok(payload.requestId,'Authentication failures require request ID');
const anonymous=await reliableFetch(base+'/.netlify/functions/selc-auth',{headers:{Origin:origin},signal:AbortSignal.timeout(15000)});
console.log(JSON.stringify({service:'selc-auth',method:'GET',status:anonymous.status,cors:anonymous.headers.get('access-control-allow-origin')}));
assert.equal(anonymous.status,401,'Anonymous request should require login');
assert.equal(anonymous.headers.get('access-control-allow-origin'),origin);
console.log('PASS: live SELC/Portal preflight, real sign-in denial, and session verification all use healthy CORS.');
