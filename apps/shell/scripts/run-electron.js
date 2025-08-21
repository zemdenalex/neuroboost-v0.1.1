// Node 20+. Robust launcher:
// - Prefer ELECTRON_OVERRIDE_DIST_PATH if set
// - else use path from require('electron')
// - Resolve app entry by checking known candidates, show clear error otherwise.

const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const candidates = [
  // Preferred: inside shell app
  path.resolve(process.cwd(), 'apps/shell/main.mjs'),
  path.resolve(__dirname, '..', '..', 'main.mjs'),
  path.resolve(__dirname, '..', 'main.mjs'),
  path.resolve(process.cwd(), 'main.mjs'),
];

const APP_ENTRY = candidates.find(p => existsSync(p));
if (!APP_ENTRY) {
  console.error('[shell] Could not find main.mjs. Tried:\n' + candidates.join('\n'));
  process.exit(1);
}

let bin;
const override = process.env.ELECTRON_OVERRIDE_DIST_PATH;
if (override && existsSync(override)) {
  bin = path.join(override, process.platform === 'win32' ? 'electron.exe' : 'electron');
} else {
  try {
    // electron package exports the absolute binary path
    bin = require('electron');
  } catch (e) {
    console.error('[shell] electron devDependency not found and no override set.');
    console.error('Hint: pnpm -F @nb/shell add -D electron@30.0.9');
    process.exit(1);
  }
}

console.log(`[shell] launching: ${bin}`);
console.log(`[shell] app entry: ${APP_ENTRY}`);

const cp = spawn(bin, [APP_ENTRY], { stdio: 'inherit' });
cp.on('exit', (code) => process.exit(code ?? 0));
cp.on('error', (err) => {
  console.error('[shell] failed to spawn electron:', err);
  process.exit(1);
});
