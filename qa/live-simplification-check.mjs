import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';

// Read-only release contract. Never creates users, touches payments, or mutates production data.
const PORTAL='https://sanctumportal.org';
const HUB='https://sanctumeroshub.org';
const SELC='https://se-selc.netlify.app';

async function get(url) {
 const response=await fetch(url,{redirect:'follow',cache:'no-store',headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(12000)});
 assert.equal(response.status,200,url+' returned HTTP '+response.status);
 return {url:response.url,text:await response.text()};
}
async function verify(){
 const results=await Promise.all([
  get(PORTAL+'/membership.html'),
  get(PORTAL+'/assets/se-member.js'),
  get(PORTAL+'/assets/se-owner.js'),
  get(PORTAL+'/.netlify/functions/selc-public'),
  get(HUB+'/about/'),
  get(HUB+'/support/'),
  get(SELC+'/'),
  get(SELC+'/app.js')
 ]);
 const [membership,member,owner,roles,hubAbout,hubSupport,selcHome,selcApp]=results.map(x=>x.text);
 assert.match(membership,/Sanctum Eros membership is for adults 18\+/);
 assert.match(membership,/Dungeon Nights are 21\+/);
 const memberMenu=member.slice(member.indexOf('const NAV=['),member.indexOf('function memberCard('));
 assert.ok(memberMenu.length>100,'Member navigation not found');
 for(const id of ['events','tickets','membership','inbox','account'])assert.ok(memberMenu.includes("id:'"+id+"'"),'Missing member navigation '+id);
 assert.equal((memberMenu.match(/id:'/g)||[]).length,5,'Member Portal must show exactly five destinations');
 assert.doesNotMatch(member,/href="#commons"/,'Commons must not be promoted on the member home screen');
 assert.match(owner,/Application records \(backup\)/);
 assert.match(owner,/Member records \(backup\)/);
 assert.match(owner,/href="\/selc-connect\.html"/);
 const seats=JSON.parse(roles);
 assert.equal(seats.advisorMax,2,'Portal Advisor cap');
 assert.equal(seats.representativeSeats,4,'Portal Representative cap');
 assert.equal(seats.coordinatorMax,2,'Portal Coordinator cap');
 assert.equal(seats.totalPositions,8,'SELC appointed seats');
 assert.match(hubAbout,/two Coordinators, four Representatives, and two Advisors/);
 assert.match(hubSupport,/New supporter-plan enrollment and rewards promotion are paused/);
 assert.match(selcHome,/two Coordinators, four Representatives and two Advisors/);
 assert.match(selcApp,/Management dashboard/);
 assert.match(selcApp,/Reviews that need attention/);
 assert.match(selcApp,/api\('leadership-queue'\)/);
 console.log('DEPLOYMENT VERIFIED: Portal membership, five-link navigation, eight leadership seats, SELC action queue, and Hub archived-program messaging are live.');
}
let last;
for(let attempt=1;attempt<=8;attempt++){
 try{await verify();process.exit(0)}catch(error){
  last=error;console.error('Verification attempt '+attempt+'/8: '+String(error.message||error));
  if(attempt<8)await delay(12000);
 }
}
console.error('Production release not confirmed: '+String(last?.message||last));
process.exit(1);
