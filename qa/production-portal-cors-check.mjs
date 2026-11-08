import assert from 'node:assert/strict';
const origin='https://se-selc.netlify.app';
const services=['selc-auth','ecosystem-session','selc-governance','community-leaders'];
for(const service of services){
 const endpoint='https://sanctumportal.org/.netlify/functions/'+service;
 const response=await fetch(endpoint,{
   method:'OPTIONS',
   headers:{
     Origin:origin,
     'Access-Control-Request-Method':'POST',
     'Access-Control-Request-Headers':'content-type'
   },
   redirect:'manual',
   signal:AbortSignal.timeout(16000)
 });
 const body=(await response.text()).slice(0,300).replace(/[\r\n]+/g,' ');
 const result={
   service,
   status:response.status,
   allowedOrigin:response.headers.get('access-control-allow-origin'),
   allowedMethods:response.headers.get('access-control-allow-methods'),
   allowedHeaders:response.headers.get('access-control-allow-headers'),
   nfRequestId:response.headers.get('x-nf-request-id'),
   body
 };
 console.log(JSON.stringify(result));
 assert.equal(response.status,204,service+' live CORS preflight failed');
 assert.equal(result.allowedOrigin,origin,service+' did not permit official SELC origin');
 assert.match(result.allowedMethods||'',/POST/i,service+' missing POST permission');
 assert.match(result.allowedHeaders||'',/content-type/i,service+' missing content-type permission');
}
const status=await fetch('https://sanctumportal.org/.netlify/functions/selc-auth',{
 headers:{Origin:origin},
 redirect:'manual',
 signal:AbortSignal.timeout(16000)
});
console.log(JSON.stringify({service:'selc-auth anonymous session',status:status.status,cors:status.headers.get('access-control-allow-origin')}));
assert.equal(status.status,401,'Unauthenticated session must require sign-in, not return a 503');
assert.equal(status.headers.get('access-control-allow-origin'),origin,'Even 401 must preserve CORS headers');
console.log('Live Portal/SELC preflight and unauthenticated session connection verified.');
