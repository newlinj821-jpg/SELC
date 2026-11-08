import assert from 'node:assert/strict';
const origin='https://se-selc.netlify.app';
const targets=[
 ['canonical','https://sanctumportal.org'],
 ['netlify-production','https://thesanctumerosportal.netlify.app'],
 ['fixed-preview','https://deploy-preview-30--thesanctumerosportal.netlify.app'],
];
const services=['selc-auth','ecosystem-session','selc-governance','community-leaders'];
let canonicalFailed=false;
for(const [target,base] of targets){
 for(const service of services){
  const endpoint=base+'/.netlify/functions/'+service;
  try{
   const r=await fetch(endpoint,{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'},redirect:'manual',signal:AbortSignal.timeout(12000)});
   const body=(await r.text()).slice(0,200);
   const result={target,service,status:r.status,cors:r.headers.get('access-control-allow-origin'),nfRequestId:r.headers.get('x-nf-request-id'),body};
   console.log(JSON.stringify(result));
   if(target==='canonical'&&(r.status!==204||result.cors!==origin))canonicalFailed=true;
  }catch(e){console.log(JSON.stringify({target,service,error:e?.name||'FetchError'}));if(target==='canonical')canonicalFailed=true}
 }
}
if(canonicalFailed)throw Error('Canonical Portal CORS is not repaired in the live deployment.');
console.log('Canonical Portal preflight now permits official SELC origin.');
