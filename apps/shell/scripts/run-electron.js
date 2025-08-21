const { spawn } = require('node:child_process');
const { existsSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');

function findElectronExeUnder(dir) {
  try {
    const stack = [dir];
    while (stack.length) {
      const p = stack.pop();
      const st = statSync(p);
      if (!st.isDirectory()) continue;
      const entries = readdirSync(p);
      for (const name of entries) {
        const full = path.join(p, name);
        const st2 = statSync(full);
        if (st2.isDirectory()) stack.push(full);
        else if (/^electron(\.exe)?$/i.test(name)) return full;
      }
    }
  } catch {}
  return null;
}

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

// 1) Use env override if present
let bin;
let overrideDir = process.env.ELECTRON_OVERRIDE_DIST_PATH;

// 2) If missing, try cached location under LOCALAPPDATA\electron\dist-<ver>
if (!overrideDir && process.platform === 'win32') {
  const ver = process.env.NB_ELECTRON_VERSION || '30.0.9';
  const root = path.join(process.env.LOCALAPPDATA || '', 'electron', `dist-${ver}`);
  const exe = findElectronExeUnder(root);
  if (exe) {
    bin = exe; // absolute path to electron(.exe)
  }
}

// 3) Fallback to devDep 'electron'
if (!bin) {
  if (overrideDir && existsSync(overrideDir)) {
    bin = path.join(overrideDir, process.platform === 'win32' ? 'electron.exe' : 'electron');
  } else {
    try { bin = require('electron'); } catch {
      console.error('[shell] electron not installed and no override discoverable.');
      console.error('Fix options:');
      console.error('  A) Set env now: $env:ELECTRON_OVERRIDE_DIST_PATH="<path-to-folder-with-electron.exe>"');
      console.error('  B) Install devDep: pnpm -F @nb/shell add -D electron@30.0.9');
      process.exit(1);
    }
  }
}

console.log(`[shell] launching: ${bin}`);
console.log(`[shell] entry: ${APP_ENTRY}`);
const cp = spawn(bin, [APP_ENTRY], { stdio: 'inherit' });
cp.on('exit', code => process.exit(code ?? 0));
cp.on('error', err => { console.error('[shell] spawn error:', err); process.exit(1); });
