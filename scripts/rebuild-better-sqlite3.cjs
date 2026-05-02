/**
 * Rebuild better-sqlite3 for the Node that owns `npm` (npm_node_execpath).
 * Cursor/IDE terminals often put a bundled Node first on PATH (e.g. ABI 127) while
 * `C:\Program Files\nodejs\node.exe` is newer (e.g. ABI 141). A bare
 * `npm rebuild` from PATH can compile for the wrong ABI; Next then loads the OS Node and crashes.
 */
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const nodeExe = process.env.npm_node_execpath || process.execPath;
const npmCli = process.env.npm_execpath;

if (!npmCli || !fs.existsSync(npmCli)) {
  console.error(
    'rebuild-better-sqlite3: npm_execpath missing or invalid. Run: npm run rebuild:sqlite-node',
  );
  process.exit(1);
}

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
