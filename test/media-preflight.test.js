const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const fsp=fs.promises;
const path=require('path');
const {spawnSync}=require('child_process');
const {needsNormalization,prepareKiriVideo,capabilities}=require('../src/media-preflight');
const ROOT=path.resolve(__dirname,'..');

test('MP4 at provider-safe dimensions can pass through',()=>{
  assert.equal(needsNormalization({name:'clip.mp4',type:'video/mp4',width:1920,height:1080}),false);
});

test('MOV requires normalization',()=>{
  assert.equal(needsNormalization({name:'clip.mov',type:'video/quicktime',width:1920,height:1080}),true);
});

test('MOV is normalized to MP4 when a local converter exists', async (t)=>{
  const caps=capabilities();
  if(!caps.ffmpeg){t.skip('ffmpeg not available in CI container');return;}
  const tmp=path.join(ROOT,'data','test-source.mov');
  await fsp.mkdir(path.dirname(tmp),{recursive:true});
  const r=spawnSync('ffmpeg',['-y','-f','lavfi','-i','color=c=black:s=640x360:d=1','-c:v','libx264','-pix_fmt','yuv420p',tmp],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const st=await fsp.stat(tmp);
  const prepared=await prepareKiriVideo('preflight-test',{name:'test-source.mov',type:'video/quicktime',width:640,height:360,duration:1,size:st.size,uploadedAt:'test'},tmp);
  assert.equal(prepared.normalized,true);
  assert.match(prepared.filename,/\.mp4$/);
  assert.equal(fs.existsSync(prepared.path),true);
  await fsp.rm(tmp,{force:true});
  await fsp.rm(path.join(ROOT,'data','projects','preflight-test'),{recursive:true,force:true});
});
