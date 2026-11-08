import assert from 'node:assert/strict';
const portal='https://sanctumportal.org/.netlify/functions/selc-auth';
const origin='https://se-selc.netlify.app';
const response=await fetch(portal,{
  method:'OPTIONS',
  headers:{
    Origin:origin,
    'Access-Control-Request-Method':'POST',
    'Access-Control-Request-Headers':'content-type'
  },
  redirect:'manual',
  signal:AbortSignal.timeout(16000)
});
const result={
  endpoint:portal,
  status:response.status,
  allowedOrigin:response.headers.get('access-control-allow-origin'),
  allowedMethods:response.headers.get('access-control-allow-methods'),
  allowedHeaders:response.headers.get('access-control-allow-headers'),
  redirected:response.status>=300&&response.status<400
};
console.log(JSON.stringify(result));
assert.equal(response.status,204,'Live SELC/Portal authentication CORS preflight failed');
assert.equal(result.allowedOrigin,origin,'Portal does not allow the SELC production origin');
assert.match(result.allowedMethods||'',/POST/i);
assert.match(result.allowedHeaders||'',/content-type/i);
console.log('Portal preflight permits the canonical SELC production origin.');
