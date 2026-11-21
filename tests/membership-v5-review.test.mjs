import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
test('SE v5 question snapshots appear in the existing SELC review',()=>{
 assert.match(app,/function v5MembershipAnswers\(source\)/);
 assert.match(app,/v5MembershipAnswers\(source\)/);
 assert.match(app,/customQuestions/);
 assert.match(app,/customAnswers/);
 assert.match(app,/dungeonRulesAcknowledged/);
 assert.match(app,/signatureName/);
});
test('Legacy v3 and v4 application review remains intact',()=>{
 assert.match(app,/const MEMBER_QUESTION_ORDER=/);
 assert.match(app,/function applicationDetails\(record\)/);
 assert.match(app,/MEMBER_QUESTION_ORDER:\[\]/);
 assert.match(app,/assistSummary\(source\.reviewAssist\)/);
});
test('Confidential wellbeing is only rendered if the Portal API provides it',()=>{
 assert.match(app,/v\.wellbeing&&typeof v\.wellbeing==='object'/);
 assert.match(app,/Voluntary information/);
 assert.doesNotMatch(app,/const extra=Object\.keys\(source\)\.filter\(key=>!listed\.has\(key\)/);
});
test('SELC registry separates verified attendance from membership status',()=>{
 assert.match(app,/m\.firstAttendedAt\?'Verified attendee':'Attendance not verified'/);
});
