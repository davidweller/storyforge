/**
 * Rebuild better-sqlite3 for the Node runtime that Next.js actually uses.
 * Cursor/IDE terminals often put a bundled Node first on PATH (e.g. v22 / ABI 127) while
 * `C:\Program Files\nodejs\node.exe` is newer (e.g. v26 / ABI 147). A bare `npm rebuild`
 * from PATH can compile for the wrong ABI; Next then loads the OS Node and crashes.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');

function nodeModuleVersion(nodeExe) {
  const r = spawnSync(nodeExe, ['-p', 'process.versions.modules'], {
    encoding: 'utf8',
  });
  if (r.status !== 0) return -1;
  const n = Number.parseInt(String(r.stdout).trim(), 10);
  return Number.isFinite(n) ? n : -1;
}

function pickNodeExe() {
  const candidates = new Set(
    [
      process.env.npm_node_execpath,
      process.execPath,
      process.platform === 'win32'
        ? 'C:\\Program Files\\nodejs\\node.exe'
        : null,
    ].filter(Boolean),
  );

  let bestExe = process.execPath;
  let bestAbi = -1;
  for (const exe of candidates) {
    if (!fs.existsSync(exe)) continue;
    const abi = nodeModuleVersion(exe);
    if (abi > bestAbi) {
      bestAbi = abi;
      bestExe = exe;
    }
  }
  return bestExe;
}

const nodeExe = pickNodeExe();
const npmCli = process.env.npm_execpath;

if (!npmCli || !fs.existsSync(npmCli)) {
  console.error(
    'rebuild-better-sqlite3: npm_execpath missing or invalid. Run: npm run rebuild:sqlite-node',
  );
  process.exit(1);
}

const versionInfo = spawnSync(nodeExe, ['-v'], { encoding: 'utf8' });
const version = versionInfo.status === 0 ? String(versionInfo.stdout).trim() : 'unknown';
console.log(`rebuild-better-sqlite3: using ${nodeExe} (${version})`);

const r = spawnSync(nodeExe, [npmCli, 'rebuild', 'better-sqlite3'], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});

if (r.error) {
  console.error(r.error);
  process.exit(1);
}
process.exit(r.status === 0 ? 0 : r.status);
