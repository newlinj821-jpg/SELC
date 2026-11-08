/* Same-origin SELC -> Portal gateway. It is a transport fallback, not an
 * authorization bypass: the Portal still validates credentials, sessions,
 * membership, roles, and permissions for every request.
 */
const PRIMARY='https://sanctumportal.org';
const SECONDARY='https://thesanctumerosportal.netlify.app';
const ORIGIN='https://se-selc.netlify.app';
const ALLOWED=new Set(['selc-auth','selc-governance','selc-public','ecosystem-session','staff-portal','rsvps','community-requests','community-leaders','education-programs','ban-reports','shifts','leadership-library','leadership-queue','safety-appeal-review','applications','leadership-briefing','selc-system-health']);
export default async function handler(request){
 const cors={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'};
 if(request.method==='OPTIONS')return new Response('',{status:204,headers:cors});
 const origin=request.headers.get('origin')||'';
 const referer=request.headers.get('referer')||'';
 // A browser cannot read this function cross-origin, and the same-origin
 // referer check prevents third-party sites from using it as an open relay.
 if(origin&&origin!==ORIGIN)return new Response('Forbidden',{status:403,headers:cors});
 if(referer&&!referer.startsWith(ORIGIN+'/'))return new Response('Forbidden',{status:403,headers:cors});
 const url=new URL(request.url),service=url.searchParams.get('service')||'';
 if(!ALLOWED.has(service)||!['GET','POST'].includes(request.method))return new Response(JSON.stringify({error:'Unsupported service or method.'}),{status:405,headers:cors});
 const query=new URLSearchParams(url.searchParams);query.delete('service');
 const body=request.method==='POST'?await request.text():undefined;
 if(body&&body.length>120000)return new Response(JSON.stringify({error:'Request too large.'}),{status:413,headers:cors});
 const headers={'origin':ORIGIN,'accept':'application/json'};
 if(body)headers['content-type']='application/json';
 const authorization=request.headers.get('authorization');
 if(authorization&&/^Bearer [A-Za-z0-9._~-]{24,}$/i.test(authorization))headers.authorization=authorization;
 const statuses=[];
 for(const base of [PRIMARY,SECONDARY]){
  try{
   const control=new AbortController(),t=setTimeout(()=>control.abort(),8500);
   let response;
   try{response=await fetch(base+'/.netlify/functions/'+service+(query.size?'?'+query:''),{method:request.method,body,headers,redirect:'manual',signal:control.signal,cache:'no-store'})}finally{clearTimeout(t)}
   const status=response.status;
   // Credential failures, access denials, and valid application errors are
   // authoritative. NEVER retry them against a potentially different store.
   if(status!==404&&status!==502&&status!==503&&status!==504){
    const result=await response.text();
    return new Response(result.slice(0,300000),{status:status>=200&&status<=599?status:502,headers:cors});
   }
   statuses.push(status);
  }catch(error){statuses.push('network')}
 }
 return new Response(JSON.stringify({error:'Neither configured Portal endpoint responded. Check the Portal Netlify production deploy and functions.',upstreamUnavailable:true}),{status:503,headers:cors});
}
