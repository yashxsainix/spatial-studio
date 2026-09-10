const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { DATA_DIR, PROJECTS_FILE, ARTIFACTS_DIR } = require('./config');

const PIPELINE = [
  { id: 'ingest', label: 'Ingest', description: 'Collect and classify source media.' },
  { id: 'organize', label: 'Direction', description: 'Create the production brief and spatial plan.' },
  { id: 'qc', label: 'Capture check', description: 'Verify the source and provider are ready.' },
  { id: 'reconstruct', label: 'Reconstruct', description: 'Build the spatial shell with a reconstruction provider.' },
  { id: 'compose', label: 'Compose', description: 'Place portals, hotspots and guided moments.' },
  { id: 'review', label: 'Review', description: 'Human quality, privacy and storytelling approval.' },
  { id: 'export', label: 'Publish', description: 'Deliver to web and VR targets.' }
];
function defaultPipeline() { return PIPELINE.map((s, i) => ({ ...s, status: i === 0 ? 'ready' : 'locked' })); }
function normalizeProject(project) {
  const old = Array.isArray(project.pipeline) ? project.pipeline : [];
  const pipeline = PIPELINE.map((stage, i) => ({ ...stage, status: old.find(s => s.id === stage.id)?.status || (i === 0 ? 'ready' : 'locked') }));
  return {
    ...project,
    pipeline,
    experience: { walkableShell: true, memoryPortals: true, infoHotspots: false, aiGuide: true, delivery: ['web', 'vr'], ...(project.experience || {}) },
    reconstruction: {
      provider: 'kiri', status: 'not_started', sourceMedia: '', serialize: '', rawStatus: null,
      submittedAt: null, updatedAt: null, modelUrl: null, localArtifact: null, viewerUrl: '',
      attemptId: '', providerDiagnostic: null, ...(project.reconstruction || {})
    },
    scene: {
      status: 'not_prepared', preparedAt: null, sourceArtifact: '', splat: null, cameras: null,
      cameraWarning: null, error: null, ...(project.scene || {})
    }
  };
}
async function ensureData() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(ARTIFACTS_DIR, { recursive: true });
  if (!fs.existsSync(PROJECTS_FILE)) await fsp.writeFile(PROJECTS_FILE, '[]', 'utf8');
}
async function readProjects() { await ensureData(); try { const raw = JSON.parse(await fsp.readFile(PROJECTS_FILE, 'utf8')); return Array.isArray(raw) ? raw.map(normalizeProject) : []; } catch { return []; } }
async function writeProjects(projects) { await ensureData(); const tmp = `${PROJECTS_FILE}.tmp`; await fsp.writeFile(tmp, JSON.stringify(projects, null, 2), 'utf8'); await fsp.rename(tmp, PROJECTS_FILE); }
function findProject(projects, id) { return projects.find(p => p.id === id); }
function projectDir(id) { return path.join(DATA_DIR, 'projects', id); }
function mediaDir(id) { return path.join(projectDir(id), 'media'); }
function metadataPath(id) { return path.join(projectDir(id), 'media.json'); }
async function readMedia(id) { const p = metadataPath(id); if (!fs.existsSync(p)) return []; try { const x = JSON.parse(await fsp.readFile(p, 'utf8')); return Array.isArray(x) ? x : []; } catch { return []; } }
async function writeMedia(id, items) { await fsp.mkdir(projectDir(id), { recursive: true }); const p = metadataPath(id), tmp = `${p}.tmp`; await fsp.writeFile(tmp, JSON.stringify(items, null, 2), 'utf8'); await fsp.rename(tmp, p); }
function nextPipelineAfter(pipeline, stageId) {
  const base = Array.isArray(pipeline) && pipeline.length ? pipeline : defaultPipeline(); const idx = base.findIndex(s => s.id === stageId); if (idx < 0) return base;
  return base.map((s, i) => i <= idx ? { ...s, status: 'done' } : i === idx + 1 ? { ...s, status: 'ready' } : s.status === 'done' ? s : { ...s, status: 'locked' });
}
function setStageReady(pipeline, stageId) { const base = Array.isArray(pipeline) && pipeline.length ? pipeline : defaultPipeline(); return base.map(s => s.id === stageId ? { ...s, status: 'ready' } : s); }
module.exports = { PIPELINE, defaultPipeline, normalizeProject, ensureData, readProjects, writeProjects, findProject, projectDir, mediaDir, readMedia, writeMedia, nextPipelineAfter, setStageReady };
