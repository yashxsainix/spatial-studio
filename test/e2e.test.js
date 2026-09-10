const test=require('node:test');
const assert=require('node:assert/strict');
const http=require('http');
const fs=require('fs');
const fsp=fs.promises;
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
let mock,app,base,projectId,mockBalance=7;
function listen(server){return new Promise(r=>server.listen(0,'127.0.0.1',()=>r(server.address().port)))}
function close(server){return new Promise(r=>server.close(r))}
function readBody(req){return new Promise((resolve,reject)=>{const a=[];req.on('data',c=>a.push(c));req.on('end',()=>resolve(Buffer.concat(a)));req.on('error',reject)})}
async function j(url,options={}){const r=await fetch(url,options);const d=await r.json();return{r,d}}

test.before(async()=>{
  await fsp.rm(path.join(ROOT,'data','projects'),{recursive:true,force:true});
  await fsp.rm(path.join(ROOT,'data','artifacts'),{recursive:true,force:true});
  await fsp.mkdir(path.join(ROOT,'data','projects'),{recursive:true});
  await fsp.mkdir(path.join(ROOT,'data','artifacts'),{recursive:true});
  await fsp.writeFile(path.join(ROOT,'data','projects.json'),'[]');
  const task='task1234567890'; let statusCalls=0;
  mock=http.createServer(async(req,res)=>{
    const u=new URL(req.url,'http://x');
    const ok=x=>{const b=JSON.stringify(x);res.writeHead(200,{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)});res.end(b)};
    if(u.pathname==='/download/model.zip'){const b=Buffer.from('PK\x03\x04FAKEZIP');res.writeHead(200,{'Content-Type':'application/zip','Content-Length':b.length});return res.end(b)}
    if(req.headers.authorization!=='Bearer test-kiri'){res.writeHead(401);return res.end(JSON.stringify({code:401,msg:'unauthorized',ok:false}))}
    if(u.pathname==='/api/v1/open/balance')return ok({code:200,msg:'success',data:{balance:mockBalance},ok:true});
    if(u.pathname==='/api/v1/open/3dgs/video'){
      const body=await readBody(req),s=body.toString('latin1');
      assert.match(req.headers['content-type'],/multipart\/form-data; boundary=/);
      assert.match(s,/name="isMesh"/); assert.match(s,/name="isMask"/); assert.match(s,/name="videoFile"/);
      if(s.includes('protocolfail.mp4'))return ok({code:200,msg:'success',data:{calculateType:3},ok:true});
      return ok({code:200,msg:'success',data:{serialize:task,calculateType:3},ok:true});
    }
    if(u.pathname==='/api/v1/open/model/getStatus'){statusCalls++;return ok({code:200,msg:'success',data:{serialize:task,status:statusCalls>1?2:3},ok:true})}
    if(u.pathname==='/api/v1/open/model/getModelZip'){return ok({code:200,msg:'success',data:{serialize:task,modelUrl:`http://127.0.0.1:${mock.address().port}/download/model.zip`},ok:true})}
    res.writeHead(404);res.end();
  });
  const mp=await listen(mock);
  process.env.KIRI_API_KEY='test-kiri'; process.env.KIRI_BASE_URL=`http://127.0.0.1:${mp}/api/v1/open`; process.env.OPENAI_API_KEY=''; process.env.HOST='127.0.0.1';
  for(const mod of ['../src/config','../src/kiri','../src/openai','../src/server']){try{delete require.cache[require.resolve(mod)]}catch{}}
  const {createServer}=require('../src/server'); app=createServer(); const ap=await listen(app); base=`http://127.0.0.1:${ap}`;
});
test.after(async()=>{await close(app);await close(mock);await fsp.rm(path.join(ROOT,'data','projects'),{recursive:true,force:true});await fsp.rm(path.join(ROOT,'data','artifacts'),{recursive:true,force:true});await fsp.mkdir(path.join(ROOT,'data','projects'),{recursive:true});await fsp.mkdir(path.join(ROOT,'data','artifacts'),{recursive:true});await fsp.writeFile(path.join(ROOT,'data','projects.json'),'[]')});

test('health verifies KIRI authentication and balance',async()=>{const {r,d}=await j(`${base}/api/health?refresh=1`);assert.equal(r.status,200);assert.equal(d.kiri.connected,true);assert.equal(d.kiri.balance,7)});
test('project, media, direction, capture check and real reconstruction contract work end to end',async()=>{
  let x=await j(`${base}/api/projects`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'E2E Pilot',type:'event',location:'Test'})});assert.equal(x.r.status,201);projectId=x.d.id;
  x=await j(`${base}/api/projects/${projectId}/media?filename=pilot.mp4`,{method:'PUT',headers:{'Content-Type':'video/mp4','X-Video-Duration':'30','X-Video-Width':'1920','X-Video-Height':'1080'},body:Buffer.from('fake-mp4-bytes')});assert.equal(x.r.status,201);
  x=await j(`${base}/api/projects/${projectId}/media?filename=pilot.mp4`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'reconstruction-source'})});assert.equal(x.r.status,200);
  x=await j(`${base}/api/projects/${projectId}/analyze`,{method:'POST'});assert.equal(x.r.status,200);assert.equal(x.d.mode,'demo');
  x=await j(`${base}/api/projects/${projectId}/capture-check`,{method:'POST'});assert.equal(x.r.status,200);assert.equal(x.d.canStart,true);
  x=await j(`${base}/api/projects/${projectId}/reconstruction/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:'pilot.mp4'})});assert.equal(x.r.status,200);assert.equal(x.d.serialize,'task1234567890');
  x=await j(`${base}/api/projects/${projectId}/reconstruction/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:'pilot.mp4'})});assert.equal(x.r.status,409);assert.match(x.d.error,/already has an active KIRI job/i);
  x=await j(`${base}/api/projects/${projectId}/reconstruction/status`);assert.equal(x.r.status,200);assert.equal(x.d.status,'queued');
  x=await j(`${base}/api/projects/${projectId}/reconstruction/status`);assert.equal(x.r.status,200);assert.equal(x.d.status,'succeeded');assert.match(x.d.localArtifact,/^\/artifact\//);
  const a=await fetch(`${base}${x.d.localArtifact}`);assert.equal(a.status,200);assert.match(a.headers.get('content-type'),/application\/zip/);
});
test('provider protocol anomaly returns a real error, never a fake success',async()=>{
  let x=await j(`${base}/api/projects`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Bad response pilot',type:'event'})});const id=x.d.id;
  await j(`${base}/api/projects/${id}/media?filename=protocolfail.mp4`,{method:'PUT',headers:{'Content-Type':'video/mp4','X-Video-Duration':'20','X-Video-Width':'1280','X-Video-Height':'720'},body:Buffer.from('x')});
  await j(`${base}/api/projects/${id}/media?filename=protocolfail.mp4`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'reconstruction-source'})});
  await j(`${base}/api/projects/${id}/analyze`,{method:'POST'});await j(`${base}/api/projects/${id}/capture-check`,{method:'POST'});
  x=await j(`${base}/api/projects/${id}/reconstruction/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:'protocolfail.mp4'})});assert.equal(x.r.status,502);assert.match(x.d.error,/task ID/i);assert.notEqual(x.d.error,'success');assert.equal(x.d.submissionUncertain,true);
  x=await j(`${base}/api/projects/${id}`);assert.equal(x.d.reconstruction.status,'submission_uncertain');
  x=await j(`${base}/api/projects/${id}/reconstruction/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({filename:'protocolfail.mp4'})});assert.equal(x.r.status,409);assert.match(x.d.error,/uncertain outcome/i);
  x=await j(`${base}/api/projects/${id}/reconstruction/reset`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:'no'})});assert.equal(x.r.status,400);
  x=await j(`${base}/api/projects/${id}/reconstruction/reset`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirm:'verified-no-task'})});assert.equal(x.r.status,200);assert.equal(x.d.status,'not_started');
});

test('zero KIRI credit blocks reconstruction before upload',async()=>{
  mockBalance=0;
  let x=await j(`${base}/api/projects`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'No credit pilot',type:'event'})});const id=x.d.id;
  await j(`${base}/api/projects/${id}/media?filename=nocredit.mp4`,{method:'PUT',headers:{'Content-Type':'video/mp4','X-Video-Duration':'20','X-Video-Width':'1280','X-Video-Height':'720'},body:Buffer.from('x')});
  await j(`${base}/api/projects/${id}/media?filename=nocredit.mp4`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'reconstruction-source'})});
  await j(`${base}/api/projects/${id}/analyze`,{method:'POST'});
  x=await j(`${base}/api/projects/${id}/capture-check`,{method:'POST'});assert.equal(x.r.status,400);assert.equal(x.d.readiness.canStart,false);assert.ok(x.d.readiness.checks.some(c=>c.id==='credit'&&!c.ok));
  mockBalance=7;
});

test('existing KIRI task can be attached and tracked',async()=>{
  let x=await j(`${base}/api/projects`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Recovery pilot',type:'event'})});const id=x.d.id;
  x=await j(`${base}/api/projects/${id}/reconstruction/attach`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({serialize:'task1234567890'})});assert.equal(x.r.status,200);assert.equal(x.d.serialize,'task1234567890');assert.ok(['queued','succeeded'].includes(x.d.status));
  x=await j(`${base}/api/projects/${id}/reconstruction/status`);assert.equal(x.r.status,200);assert.equal(x.d.serialize,'task1234567890');
});
