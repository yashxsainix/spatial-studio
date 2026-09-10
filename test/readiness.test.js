const test=require('node:test');
const assert=require('node:assert/strict');
const {captureReadiness}=require('../src/server');

test('capture readiness refuses unknown duration and dimensions',()=>{
  const r=captureReadiness({},[{name:'old.mov',type:'video/quicktime',role:'reconstruction-source'}],{connected:true,balance:10});
  assert.equal(r.canStart,false);
  assert.ok(r.checks.some(c=>c.id==='duration'&&!c.ok));
  assert.ok(r.checks.some(c=>c.id==='resolution'&&!c.ok));
});

test('capture readiness accepts measured source when provider and credit are valid',()=>{
  const r=captureReadiness({},[{name:'pilot.mp4',type:'video/mp4',role:'reconstruction-source',duration:30,width:1920,height:1080}],{connected:true,balance:10});
  assert.equal(r.canStart,true);
});
