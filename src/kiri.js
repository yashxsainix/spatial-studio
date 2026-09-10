const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { KIRI_BASE_URL, KIRI_API_KEY, ARTIFACTS_DIR } = require('./config');

class ProviderError extends Error {
  constructor(message, details={}) { super(message); this.name='ProviderError'; this.details=details; }
}
function statusLabel(status){ return ({'-1':'uploading','0':'processing','1':'failed','2':'succeeded','3':'queued','4':'expired'})[String(status)] || 'unknown'; }
function codeMessage(code, httpStatus) {
  const n=Number(code);
  const known={
    2000:'The model is still processing.',
    2001:'The model failed to generate, so KIRI cannot create a download link.',
    2002:'The KIRI model has expired.',
    2003:'KIRI could not retrieve this model status.',
    2004:'The uploaded source set is empty.',
    2005:'The uploaded photo set exceeds KIRI’s maximum.',
    2006:'KIRI cannot find this model/task ID.',
    2007:'KIRI needs at least 20 images for this image-based scan.',
    2008:'The model is currently queued.',
    2009:'KIRI rejected the video because it does not meet the video requirements.',
    2010:'KIRI rejected the file format.'
  };
  if (known[n]) return known[n];
  if (httpStatus===401) return 'KIRI authentication failed. Check that this is a valid Developer API key.';
  if (httpStatus===403) return 'KIRI rejected the request because the API account does not have enough credits.';
  if (httpStatus===400) return 'KIRI rejected the request as malformed or incomplete.';
  if (httpStatus>=500) return `KIRI returned a server error (HTTP ${httpStatus}).`;
  return null;
}
function successCode(code) {
  if (code === undefined || code === null || code === '') return true;
  const n = Number(code);
  // KIRI's published docs use body code 0 for success. The live gateway can also
  // mirror HTTP success as body code 200. Treat both as success contracts.
  return Number.isFinite(n) && (n === 0 || n === 200);
}
function normalizeEnvelope(httpStatus, data, rawText='') {
  const providerMessage = data && typeof data==='object' ? (data.msg ?? data.message) : undefined;
  const meta = {
    httpStatus,
    code: data && typeof data==='object' ? data.code : undefined,
    providerOk: data && typeof data==='object' ? data.ok : undefined,
    providerMessage,
    successContract: data && typeof data==='object'
      ? (Number(data.code)===200 ? 'live-code-200' : Number(data.code)===0 ? 'documented-code-0' : 'other')
      : 'invalid'
  };
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ProviderError('KIRI returned an invalid response body.', { ...meta, raw:rawText.slice(0,700), retrySafe:true });
  }

  const httpFailure = httpStatus < 200 || httpStatus >= 300;
  const explicitFailure = data.ok === false;
  const codeFailure = !successCode(data.code);

  // HTTP transport truth wins over any misleading body text/code.
  if (httpFailure || explicitFailure || codeFailure) {
    const text = providerMessage == null ? '' : String(providerMessage).trim();
    const providerText = text && !/^(success|ok|successful)$/i.test(text) ? text : '';
    const mapped = codeMessage(data.code,httpStatus);
    const fallback = httpFailure
      ? `KIRI returned HTTP ${httpStatus}.`
      : `KIRI rejected the request (provider code ${data.code ?? 'unknown'}).`;
    const message = mapped
      ? (providerText && providerText!==mapped ? `${mapped} ${providerText}` : mapped)
      : (providerText || fallback);
    throw new ProviderError(message, {
      ...meta,
      raw:httpFailure ? rawText.slice(0,700) : undefined,
      retrySafe:httpFailure ? (httpStatus>=400&&httpStatus<500) : true
    });
  }
  return data;
}
async function kiriRequest(endpoint, options={}) {
  if (!KIRI_API_KEY) throw new ProviderError('KIRI_API_KEY is not configured.', { kind:'configuration' });
  let response;
  try { response = await fetch(`${KIRI_BASE_URL}${endpoint}`, { ...options, headers:{ Authorization:`Bearer ${KIRI_API_KEY}`, ...(options.headers||{}) }, signal:options.signal || AbortSignal.timeout(240_000) }); }
  catch (err) { throw new ProviderError(`Could not reach KIRI: ${err.message}`, { kind:'network', retrySafe:false }); }
  const rawText = await response.text(); let data;
  try { data = rawText ? JSON.parse(rawText) : {}; } catch { throw new ProviderError(`KIRI returned non-JSON data (HTTP ${response.status}).`, { httpStatus:response.status, raw:rawText.slice(0,700), retrySafe:response.status>=400&&response.status<500 }); }
  return normalizeEnvelope(response.status, data, rawText);
}
async function getBalance(){ const data=await kiriRequest('/balance'); const balance=Number(data?.data?.balance); if(!Number.isFinite(balance)||balance<0) throw new ProviderError('KIRI authenticated but returned an invalid balance response.',{kind:'protocol',providerMessage:data?.msg??data?.message,code:data?.code,dataKeys:Object.keys(data?.data||{}),retrySafe:true}); return { connected:true, balance, response:{code:data.code,msg:data.msg??data.message,ok:data.ok,successContract:Number(data.code)===200?'live-code-200':Number(data.code)===0?'documented-code-0':'implicit'} }; }
async function submit3dgsVideo(filePath, filename, mimeType='video/mp4') {
  const blob = await fs.openAsBlob(filePath, { type:mimeType || 'video/mp4' });
  const form = new FormData(); form.append('isMesh','0'); form.append('isMask','0'); form.append('videoFile', blob, filename);
  const data = await kiriRequest('/3dgs/video', { method:'POST', body:form, signal:AbortSignal.timeout(10*60_000) });
  const serialize = String(data?.data?.serialize || '').trim();
  if (!serialize) throw new ProviderError('KIRI accepted the HTTP request but did not return the required task ID. The submission outcome is uncertain; verify the KIRI dashboard before retrying.', { kind:'protocol', code:data.code, providerOk:data.ok, providerMessage:data.msg, dataKeys:Object.keys(data.data||{}), retrySafe:false });
  return { serialize, calculateType:Number(data?.data?.calculateType ?? 3), providerResponse:{code:data.code,msg:data.msg,ok:data.ok} };
}
async function getStatus(serialize){ const data=await kiriRequest(`/model/getStatus?serialize=${encodeURIComponent(serialize)}`); const raw=Number(data?.data?.status); const status=statusLabel(raw); if(status==='unknown') throw new ProviderError('KIRI returned an undocumented model status.',{kind:'protocol',rawStatus:data?.data?.status,serialize,retrySafe:true}); return { serialize:String(data?.data?.serialize||serialize), rawStatus:raw, status }; }
async function getModelZip(serialize){ const data=await kiriRequest(`/model/getModelZip?serialize=${encodeURIComponent(serialize)}`); const modelUrl=String(data?.data?.modelUrl||''); if(!modelUrl) throw new ProviderError('KIRI reported success but did not provide a model download URL.', {kind:'protocol'}); return {serialize:String(data?.data?.serialize||serialize), modelUrl}; }
async function cacheModelZip(projectId, serialize, modelUrl){ await fsp.mkdir(path.join(ARTIFACTS_DIR,projectId),{recursive:true}); const dest=path.join(ARTIFACTS_DIR,projectId,`${serialize}.zip`); const response=await fetch(modelUrl,{signal:AbortSignal.timeout(10*60_000)}); if(!response.ok) throw new ProviderError(`Model download failed (HTTP ${response.status}).`,{httpStatus:response.status,retrySafe:true}); const tmp=`${dest}.tmp`; const out=fs.createWriteStream(tmp); let bytes=0; await new Promise(async(resolve,reject)=>{ try{for await(const chunk of response.body){const b=Buffer.from(chunk);bytes+=b.length;if(bytes>5_000_000_000)throw new Error('Model ZIP exceeds the 5 GB local safety limit.');if(!out.write(b))await new Promise(r=>out.once('drain',r));}out.end();out.once('finish',resolve);out.once('error',reject);}catch(e){out.destroy();reject(e);} }); try{const fh=await fsp.open(tmp,'r');const sig=Buffer.alloc(4);await fh.read(sig,0,4,0);await fh.close();if(sig[0]!==0x50||sig[1]!==0x4b)throw new Error('Downloaded model artifact is not a valid ZIP container.');await fsp.rename(tmp,dest);return dest}catch(e){try{await fsp.unlink(tmp)}catch{}throw new ProviderError(`Could not cache KIRI model: ${e.message}`,{kind:'artifact',retrySafe:true})} }
module.exports={ProviderError,statusLabel,successCode,normalizeEnvelope,kiriRequest,getBalance,submit3dgsVideo,getStatus,getModelZip,cacheModelZip};
