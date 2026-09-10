const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./config');

const MAX_PORTALS = 100;
const MAX_COORD = 100000;

function finiteVec(value, length = 3) {
  if (!Array.isArray(value) || value.length !== length) return null;
  const out = value.map(Number);
  return out.every(Number.isFinite) && out.every(v => Math.abs(v) <= MAX_COORD) ? out : null;
}

function cleanText(value, max = 180) {
  return String(value || '').trim().slice(0, max);
}

function cleanUrl(value) {
  const raw = cleanText(value, 1200);
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  try {
    const u = new URL(raw);
    if (!['https:', 'http:'].includes(u.protocol)) return '';
    return u.toString();
  } catch { return ''; }
}

function normalizePortal(portal = {}) {
  const position = finiteVec(portal.position);
  if (!position) return null;
  const id = /^[a-zA-Z0-9_-]{6,80}$/.test(String(portal.id || '')) ? String(portal.id) : crypto.randomUUID();
  const type = ['memory', 'info', 'link'].includes(portal.type) ? portal.type : 'memory';
  return {
    id,
    type,
    title: cleanText(portal.title || 'Untitled portal', 100),
    description: cleanText(portal.description, 500),
    url: cleanUrl(portal.url),
    position,
    createdAt: portal.createdAt || new Date().toISOString()
  };
}

function defaults(projectId) {
  return {
    schema: 'spatial-ai-studio/scene-state/v1',
    projectId,
    updatedAt: null,
    startPose: null,
    walk: { enabled: true, floorY: null },
    portals: [],
    publish: { enabled: false, title: '', subtitle: '' }
  };
}

function normalizeState(projectId, input = {}) {
  const base = defaults(projectId);
  const posePosition = finiteVec(input?.startPose?.position);
  const poseEuler = finiteVec(input?.startPose?.euler);
  const floorY = Number(input?.walk?.floorY);
  const portals = Array.isArray(input.portals) ? input.portals.map(normalizePortal).filter(Boolean).slice(0, MAX_PORTALS) : [];
  return {
    ...base,
    updatedAt: input.updatedAt || null,
    startPose: posePosition && poseEuler ? { position: posePosition, euler: poseEuler } : null,
    walk: {
      enabled: input?.walk?.enabled !== false,
      floorY: Number.isFinite(floorY) && Math.abs(floorY) <= MAX_COORD ? floorY : (posePosition ? posePosition[1] : null)
    },
    portals,
    publish: {
      enabled: input?.publish?.enabled === true,
      title: cleanText(input?.publish?.title, 100),
      subtitle: cleanText(input?.publish?.subtitle, 220)
    }
  };
}

function statePath(projectId) { return path.join(DATA_DIR, 'projects', projectId, 'scene-state.json'); }

async function readSceneState(projectId) {
  try {
    const parsed = JSON.parse(await fsp.readFile(statePath(projectId), 'utf8'));
    return normalizeState(projectId, parsed);
  } catch { return defaults(projectId); }
}

async function writeSceneState(projectId, input) {
  const sceneDir = path.join(DATA_DIR, 'projects', projectId);
  await fsp.mkdir(sceneDir, { recursive: true });
  const value = normalizeState(projectId, { ...input, updatedAt: new Date().toISOString() });
  const dest = statePath(projectId), tmp = `${dest}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fsp.rename(tmp, dest);
  return value;
}

function mergeSceneState(current, patch = {}) {
  return normalizeState(current.projectId, {
    ...current,
    ...patch,
    walk: { ...current.walk, ...(patch.walk || {}) },
    publish: { ...current.publish, ...(patch.publish || {}) },
    startPose: Object.prototype.hasOwnProperty.call(patch, 'startPose') ? patch.startPose : current.startPose,
    portals: Object.prototype.hasOwnProperty.call(patch, 'portals') ? patch.portals : current.portals
  });
}

module.exports = { defaults, normalizeState, normalizePortal, readSceneState, writeSceneState, mergeSceneState };
