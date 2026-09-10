const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const i = trimmed.indexOf('=');
    const key = trimmed.slice(0, i).trim();
    let value = trimmed.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnv();

module.exports = {
  ROOT,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  DATA_DIR: path.join(ROOT, 'data'),
  PROJECTS_FILE: path.join(ROOT, 'data', 'projects.json'),
  ARTIFACTS_DIR: path.join(ROOT, 'data', 'artifacts'),
  SCENES_DIR: path.join(ROOT, 'data', 'scenes'),
  PORT: Number(process.env.PORT || 4173),
  HOST: process.env.HOST || '127.0.0.1',
  OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-6-astra',
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  KIRI_BASE_URL: process.env.KIRI_BASE_URL || 'https://api.kiriengine.app/api/v1/open',
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  KIRI_API_KEY: process.env.KIRI_API_KEY || ''
};
