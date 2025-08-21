const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const candidates = [
  path.resolve(process.cwd(), 'apps/shell/main.mjs'),
  path.resolve(__dirname, '..', '..', 'main.mjs'),
  path.resolve(__dirname, '..', 'main.mjs'),
  path.resolve(process.cwd(), 'main.mjs'),
];

const APP_ENTRY = candidates.find(p => existsSync(p));
if (!APP_ENTRY) {
  console.error('[shell] Could not find main.mjs; tried:\n' + candidates.join('\n'));
  process.exit(1);
}

let bin;
const override = process.env.ELECTRON_OVERRIDE_DIST_PATH;
if (override && existsSync(override)) {
  bin = path.join(override, process.platform === 'win32' ? 'electron.exe' : 'electron');
} else {
  try { bin = require('electron'); }
  catch {
    console.error('[shell] electron not installed and no override set.');
    console.error('Fix: pnpm -F @nb/shell add -D electron@30.0.9  (optional if override works)');
    process.exit(1);
  }
}

console.log(`[shell] launching: ${bin}`);
console.log(`[shell] entry: ${APP_ENTRY}`);
const cp = spawn(bin, [APP_ENTRY], { stdio: 'inherit' });
cp.on('exit', code => process.exit(code ?? 0));
cp.on('error', err => { console.error('[shell] spawn error:', err); process.exit(1); });
