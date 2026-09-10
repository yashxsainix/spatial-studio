const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR } = require('./config');

const MAX_PORTALS = 100;
const MAX_COLLIDERS = 250;
const MAX_COORD = 100000;
const MAX_SIZE = 100000;

function finiteVec(value, length = 3) {
  if (!Array.isArray(value) || value.length !== length) return null;
  const out = value.map(Number);
  return out.every(Number.isFinite) && out.every(v => Math.abs(v) <= MAX_COORD) ? out : null;
}
function positiveVec(value, length = 3) {
  const out = finiteVec(value, length);
  return out && out.every(v => v > 0 && v <= MAX_SIZE) ? out : null;
}
function cleanText(value, max = 180) { return String(value || '').trim().slice(0, max); }
function cleanUrl(value) {
  const raw = cleanText(value, 1200);
  if (!raw) return '';
  if (raw.startsWith('/')) return raw;
  try { const u = new URL(raw); return ['https:', 'http:'].includes(u.protocol) ? u.toString() : ''; }
  catch { return ''; }
}
function safeId(value, prefix) {
  const raw = String(value || '');
  return /^[a-zA-Z0-9_-]{6,80}$/.test(raw) ? raw : `${prefix}_${crypto.randomUUID()}`;
}
function normalizePortal(portal = {}) {
  const position = finiteVec(portal.position);
  if (!position) return null;
  const type = ['memory', 'info', 'link'].includes(portal.type) ? portal.type : 'memory';
  return {
    id: safeId(portal.id, 'portal'), type,
    title: cleanText(portal.title || 'Untitled portal', 100),
    description: cleanText(portal.description, 500), url: cleanUrl(portal.url), position,
    createdAt: portal.createdAt || new Date().toISOString()
  };
}
function normalizeCollider(collider = {}) {
  const center = finiteVec(collider.center), size = positiveVec(collider.size);
  if (!center || !size) return null;
  const yaw = Number(collider.yaw);
  return {
    id: safeId(collider.id, 'collider'), type: 'box',
    label: cleanText(collider.label || 'Collision wall', 80), center, size,
    yaw: Number.isFinite(yaw) ? Math.max(-3600, Math.min(3600, yaw)) : 0,
    enabled: collider.enabled !== false,
    createdAt: collider.createdAt || new Date().toISOString()
  };
}

function defaults(projectId) {
  return {
    schema: 'spatial-ai-studio/scene-state/v2', projectId, updatedAt: null, startPose: null,
    walk: {
      enabled: true, floorY: null, mode: 'safe-path', corridorRadius: null,
      speed: null, collisionEnabled: true, showGuides: true
    },
    colliders: [], portals: [],
    publish: { enabled: false, title: '', subtitle: '' }
  };
}
function normalizeState(projectId, input = {}) {
  const base = defaults(projectId);
  const posePosition = finiteVec(input?.startPose?.position), poseEuler = finiteVec(input?.startPose?.euler);
  const floorY = Number(input?.walk?.floorY), corridor = Number(input?.walk?.corridorRadius), speed = Number(input?.walk?.speed);
  const portals = Array.isArray(input.portals) ? input.portals.map(normalizePortal).filter(Boolean).slice(0, MAX_PORTALS) : [];
  const colliders = Array.isArray(input.colliders) ? input.colliders.map(normalizeCollider).filter(Boolean).slice(0, MAX_COLLIDERS) : [];
  return {
    ...base, updatedAt: input.updatedAt || null,
    startPose: posePosition && poseEuler ? { position: posePosition, euler: poseEuler } : null,
    walk: {
      enabled: input?.walk?.enabled !== false,
      floorY: Number.isFinite(floorY) && Math.abs(floorY) <= MAX_COORD ? floorY : (posePosition ? posePosition[1] : null),
      mode: input?.walk?.mode === 'free' ? 'free' : 'safe-path',
      corridorRadius: Number.isFinite(corridor) && corridor > 0 ? Math.min(corridor, MAX_SIZE) : null,
      speed: Number.isFinite(speed) && speed > 0 ? Math.min(speed, MAX_SIZE) : null,
      collisionEnabled: input?.walk?.collisionEnabled !== false,
      showGuides: input?.walk?.showGuides !== false
    },
    colliders, portals,
    publish: {
      enabled: input?.publish?.enabled === true,
      title: cleanText(input?.publish?.title, 100), subtitle: cleanText(input?.publish?.subtitle, 220)
    }
  };
}
function statePath(projectId) { return path.join(DATA_DIR, 'projects', projectId, 'scene-state.json'); }
async function readSceneState(projectId) {
  try { return normalizeState(projectId, JSON.parse(await fsp.readFile(statePath(projectId), 'utf8'))); }
  catch { return defaults(projectId); }
}
async function writeSceneState(projectId, input) {
  const sceneDir = path.join(DATA_DIR, 'projects', projectId); await fsp.mkdir(sceneDir, { recursive: true });
  const value = normalizeState(projectId, { ...input, updatedAt: new Date().toISOString() });
  const dest = statePath(projectId), tmp = `${dest}.tmp`; await fsp.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8'); await fsp.rename(tmp, dest); return value;
}
function mergeSceneState(current, patch = {}) {
  return normalizeState(current.projectId, {
    ...current, ...patch,
    walk: { ...current.walk, ...(patch.walk || {}) }, publish: { ...current.publish, ...(patch.publish || {}) },
    startPose: Object.prototype.hasOwnProperty.call(patch, 'startPose') ? patch.startPose : current.startPose,
    portals: Object.prototype.hasOwnProperty.call(patch, 'portals') ? patch.portals : current.portals,
    colliders: Object.prototype.hasOwnProperty.call(patch, 'colliders') ? patch.colliders : current.colliders
  });
}
module.exports = { defaults, normalizeState, normalizePortal, normalizeCollider, readSceneState, writeSceneState, mergeSceneState };
