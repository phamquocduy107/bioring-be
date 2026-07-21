/**
 * Cross-platform runner for python-services/.venv
 * Usage: node scripts/py.mjs -m uvicorn rag_engine.main:app ...
 */
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const servicesDir = join(root, 'python-services');
const winPy = join(servicesDir, '.venv', 'Scripts', 'python.exe');
const unixPy = join(servicesDir, '.venv', 'bin', 'python');

const python = existsSync(winPy) ? winPy : unixPy;
if (!existsSync(python)) {
  console.error(
    `[py] Không tìm thấy venv Python.\n` +
      `  Expected: ${winPy}\n` +
      `         or ${unixPy}\n` +
      `  Chạy: cd python-services && python -m venv .venv && pip install -r requirements.txt`,
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const child = spawn(python, args, {
  cwd: servicesDir,
  stdio: 'inherit',
  shell: false,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
