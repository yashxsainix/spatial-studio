const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizeEnvelope,statusLabel}=require('../src/kiri');

test('KIRI documented success envelope is accepted',()=>{const x=normalizeEnvelope(200,{code:0,msg:'success',data:{serialize:'abc12345',calculateType:3},ok:true},'');assert.equal(x.data.serialize,'abc12345')});

test('KIRI live gateway success envelope using provider code 200 is accepted',()=>{const x=normalizeEnvelope(200,{code:200,msg:'success',data:{balance:9},ok:true},'');assert.equal(x.data.balance,9)});
test('KIRI live gateway string code 200 is accepted',()=>{const x=normalizeEnvelope(200,{code:'200',message:'success',data:{balance:9}},'');assert.equal(x.data.balance,9)});
test('explicit provider failure wins even when provider code is 200',()=>{assert.throws(()=>normalizeEnvelope(200,{code:200,msg:'success',ok:false},''),e=>{assert.match(e.message,/rejected|failed/i);assert.equal(e.details.code,200);return true})});
test('HTTP failure wins even when body looks like live code 200 success',()=>{assert.throws(()=>normalizeEnvelope(403,{code:200,msg:'success',ok:true},'{"code":200,"msg":"success"}'),e=>{assert.match(e.message,/credits|HTTP 403/i);assert.equal(e.details.httpStatus,403);return true})});
test('KIRI HTTP failure never surfaces misleading bare success',()=>{assert.throws(()=>normalizeEnvelope(403,{code:403,msg:'success',ok:false},'{"msg":"success"}'),e=>{assert.match(e.message,/HTTP 403|rejected/i);assert.notEqual(e.message,'success');return true})});
test('KIRI business envelope failure is descriptive',()=>{assert.throws(()=>normalizeEnvelope(200,{code:1201,msg:'bad media',ok:false},''),/bad media/)});
test('KIRI status mapping matches docs',()=>{assert.equal(statusLabel(-1),'uploading');assert.equal(statusLabel(0),'processing');assert.equal(statusLabel(1),'failed');assert.equal(statusLabel(2),'succeeded');assert.equal(statusLabel(3),'queued');assert.equal(statusLabel(4),'expired')});
test('KIRI code 2009 explains video requirements even if provider msg is success',()=>{assert.throws(()=>normalizeEnvelope(200,{code:2009,msg:'success',ok:false},''),e=>{assert.match(e.message,/video.*requirements/i);assert.notEqual(e.message,'success');assert.equal(e.details.code,2009);return true})});
test('KIRI code 2010 explains file format even if provider msg is success',()=>{assert.throws(()=>normalizeEnvelope(200,{code:2010,msg:'success',ok:false},''),e=>{assert.match(e.message,/file format/i);assert.notEqual(e.message,'success');return true})});
test('KIRI HTTP 403 explains API credit failure',()=>{assert.throws(()=>normalizeEnvelope(403,{code:403,msg:'success',ok:false},'{"msg":"success"}'),e=>{assert.match(e.message,/credits/i);assert.equal(e.details.httpStatus,403);return true})});
