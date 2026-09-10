const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const { SCENES_DIR } = require('./config');

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const MAX_DIRECTORY_BYTES = 64 * 1024 * 1024;
const MAX_SCENE_FILE_BYTES = 3_000_000_000;

function safeOutputName(name) {
  const base = path.basename(String(name || '')).replace(/[^a-zA-Z0-9._-]+/g, '_');
  return base || 'scene.bin';
}

async function readZipDirectory(zipPath) {
  const fh = await fsp.open(zipPath, 'r');
  try {
    const stat = await fh.stat();
    const tailSize = Math.min(stat.size, 65557);
    const tail = Buffer.alloc(tailSize);
    await fh.read(tail, 0, tailSize, stat.size - tailSize);
    let eocd = -1;
    for (let i = tail.length - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === EOCD_SIG) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('ZIP end-of-directory record was not found.');
    const entriesTotal = tail.readUInt16LE(eocd + 10);
    const directorySize = tail.readUInt32LE(eocd + 12);
    const directoryOffset = tail.readUInt32LE(eocd + 16);
    if (entriesTotal === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
      throw new Error('ZIP64 scene bundles are not supported by this pilot build.');
    }
    if (directorySize > MAX_DIRECTORY_BYTES || directoryOffset + directorySize > stat.size) throw new Error('ZIP directory is invalid or too large.');
    const dir = Buffer.alloc(directorySize);
    await fh.read(dir, 0, directorySize, directoryOffset);
    const entries = [];
    let off = 0;
    while (off + 46 <= dir.length && entries.length < entriesTotal) {
      if (dir.readUInt32LE(off) !== CENTRAL_SIG) throw new Error('ZIP central directory is malformed.');
      const flags = dir.readUInt16LE(off + 8);
      const method = dir.readUInt16LE(off + 10);
      const compressedSize = dir.readUInt32LE(off + 20);
      const uncompressedSize = dir.readUInt32LE(off + 24);
      const nameLen = dir.readUInt16LE(off + 28);
      const extraLen = dir.readUInt16LE(off + 30);
      const commentLen = dir.readUInt16LE(off + 32);
      const localOffset = dir.readUInt32LE(off + 42);
      const end = off + 46 + nameLen + extraLen + commentLen;
      if (end > dir.length) throw new Error('ZIP entry metadata is truncated.');
      const name = dir.subarray(off + 46, off + 46 + nameLen).toString('utf8');
      entries.push({ name, flags, method, compressedSize, uncompressedSize, localOffset });
      off = end;
    }
    return entries;
  } finally { await fh.close(); }
}

async function extractEntry(zipPath, entry, outPath) {
  if (entry.flags & 1) throw new Error(`Encrypted ZIP entry is not supported: ${entry.name}`);
  if (![0, 8].includes(entry.method)) throw new Error(`Unsupported ZIP compression method ${entry.method} for ${entry.name}.`);
  if (entry.uncompressedSize > MAX_SCENE_FILE_BYTES) throw new Error(`${entry.name} exceeds the local scene safety limit.`);
  const fh = await fsp.open(zipPath, 'r');
  let dataStart;
  try {
    const header = Buffer.alloc(30);
    await fh.read(header, 0, 30, entry.localOffset);
    if (header.readUInt32LE(0) !== LOCAL_SIG) throw new Error(`Local ZIP header is invalid for ${entry.name}.`);
    dataStart = entry.localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
  } finally { await fh.close(); }
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  const input = fs.createReadStream(zipPath, { start: dataStart, end: dataStart + entry.compressedSize - 1 });
  const output = fs.createWriteStream(`${outPath}.tmp`);
  try {
    if (entry.method === 8) await pipeline(input, zlib.createInflateRaw(), output);
    else await pipeline(input, output);
    const stat = await fsp.stat(`${outPath}.tmp`);
    if (entry.uncompressedSize && stat.size !== entry.uncompressedSize) throw new Error(`Extracted size mismatch for ${entry.name}.`);
    await fsp.rename(`${outPath}.tmp`, outPath);
    return stat.size;
  } catch (e) {
    try { await fsp.unlink(`${outPath}.tmp`); } catch {}
    throw e;
  }
}

function chooseSplat(entries) {
  const files = entries.filter(e => e.name && !e.name.endsWith('/') && /\.(ply|splat|sog|spz)$/i.test(e.name));
  return files.find(e => path.basename(e.name).toLowerCase() === '3dgs.ply') || files.find(e => /\.ply$/i.test(e.name)) || files[0] || null;
}
function chooseCameras(entries) {
  const json = entries.filter(e => e.name && !e.name.endsWith('/') && /\.json$/i.test(e.name));
  return json.find(e => path.basename(e.name).toLowerCase() === 'cameras.json') || json.find(e => /camera/i.test(path.basename(e.name))) || null;
}
function validateCameras(value) {
  return Array.isArray(value) && value.length > 0 && value.some(c => Array.isArray(c?.position) && c.position.length === 3 && Array.isArray(c?.rotation));
}

async function prepareSceneBundle(projectId, zipPath) {
  const entries = await readZipDirectory(zipPath);
  const splatEntry = chooseSplat(entries);
  if (!splatEntry) throw new Error('The KIRI ZIP does not contain a supported Gaussian Splat file (.ply/.splat/.sog/.spz).');
  const cameraEntry = chooseCameras(entries);
  const sceneDir = path.join(SCENES_DIR, projectId);
  const tempDir = `${sceneDir}.tmp-${Date.now()}`;
  await fsp.rm(tempDir, { recursive: true, force: true });
  await fsp.mkdir(tempDir, { recursive: true });
  try {
    const splatName = safeOutputName(splatEntry.name);
    const splatPath = path.join(tempDir, splatName);
    const splatBytes = await extractEntry(zipPath, splatEntry, splatPath);
    let cameras = null;
    let cameraWarning = null;
    if (cameraEntry) {
      const cameraName = safeOutputName(cameraEntry.name);
      const cameraPath = path.join(tempDir, cameraName);
      const cameraBytes = await extractEntry(zipPath, cameraEntry, cameraPath);
      try {
        const parsed = JSON.parse(await fsp.readFile(cameraPath, 'utf8'));
        if (!validateCameras(parsed)) throw new Error('camera file did not contain usable poses');
        cameras = { filename: cameraName, bytes: cameraBytes, count: parsed.length, url: `/scene-asset/${projectId}/${encodeURIComponent(cameraName)}` };
      } catch (e) {
        cameraWarning = `Camera poses were found but could not be used: ${e.message}`;
        try { await fsp.unlink(cameraPath); } catch {}
      }
    }
    const manifest = {
      schema: 'spatial-ai-studio/scene-bundle/v1',
      status: 'ready',
      projectId,
      preparedAt: new Date().toISOString(),
      sourceArtifact: path.basename(zipPath),
      splat: { filename: splatName, bytes: splatBytes, format: path.extname(splatName).slice(1).toLowerCase(), url: `/scene-asset/${projectId}/${encodeURIComponent(splatName)}` },
      cameras,
      cameraWarning,
      sourceEntryCount: entries.length
    };
    await fsp.writeFile(path.join(tempDir, 'scene.json'), JSON.stringify(manifest, null, 2), 'utf8');
    await fsp.rm(sceneDir, { recursive: true, force: true });
    await fsp.mkdir(path.dirname(sceneDir), { recursive: true });
    await fsp.rename(tempDir, sceneDir);
    return manifest;
  } catch (e) {
    await fsp.rm(tempDir, { recursive: true, force: true });
    throw e;
  }
}

async function readSceneBundle(projectId) {
  try { return JSON.parse(await fsp.readFile(path.join(SCENES_DIR, projectId, 'scene.json'), 'utf8')); }
  catch { return null; }
}

module.exports = { readZipDirectory, prepareSceneBundle, readSceneBundle, validateCameras };
