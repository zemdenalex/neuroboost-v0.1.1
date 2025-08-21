// Node 20+. Prefer local Windows override; else fall back to devDependency 'electron'
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const APP_ENTRY = path.resolve(__dirname, '..', '..', 'main.mjs');
const VER = process.env.NB_ELECTRON_VERSION || '30.0.9';

const winLocal = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || '', 'electron', `dist-${VER}`, `electron-v${VER}-win32-x64`)
  : null;

const override = process.env.ELECTRON_OVERRIDE_DIST_PATH || (winLocal && existsSync(winLocal) ? winLocal : null);
const bin = override
  ? path.join(override, process.platform === 'win32' ? 'electron.exe' : 'electron')
  : 'electron';

console.log(`[shell] launching with ${override ? 'OVERRIDE' : 'node_modules'}: ${bin}`);
const cp = spawn(bin, [APP_ENTRY], { stdio: 'inherit' });
cp.on('exit', (code) => process.exit(code ?? 0));
cp.on('error', (err) => {
  console.error('[shell] failed to spawn electron:', err);
  process.exit(1);
});
