#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

const docsRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(docsRoot, '..');
const templatesRoot = path.join(workspaceRoot, 'templates');
const isWindows = process.platform === 'win32';
const pnpm = isWindows ? 'pnpm.cmd' : 'pnpm';
const npx = isWindows ? 'npx.cmd' : 'npx';
const docsPort = process.env.DOCS_PREVIEW_PORT || '8787';
const templatesPort = process.env.TEMPLATES_PREVIEW_PORT || '8788';

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || docsRoot,
      stdio: 'inherit',
      shell: false
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(command + ' ' + args.join(' ') + ' exited with code ' + code));
    });
  });
}

function startServer(label, cwd, port) {
  const child = spawn(npx, ['--yes', 'serve', '-l', String(port), '.'], {
    cwd,
    stdio: 'inherit',
    shell: false
  });

  child.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error('[' + label + '] exited with code ' + code);
      shutdown(1);
    }
  });

  return child;
}

let servers = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  servers.forEach((server) => {
    if (!server.killed) server.kill('SIGTERM');
  });
  setTimeout(() => process.exit(code), 150);
}

(async () => {
  console.log('[preview] syncing docs framework assets');
  await run(pnpm, ['run', 'sync:framework'], { cwd: docsRoot });

  console.log('[preview] syncing templates framework assets');
  await run(pnpm, ['run', 'sync:framework'], { cwd: templatesRoot });

  console.log('[preview] building template routes');
  await run(pnpm, ['run', 'build'], { cwd: templatesRoot });

  console.log('[preview] docs:      http://localhost:' + docsPort);
  console.log('[preview] templates: http://localhost:' + templatesPort);
  servers = [
    startServer('docs', docsRoot, docsPort),
    startServer('templates', templatesRoot, templatesPort)
  ];
})().catch((error) => {
  console.error('[preview] ' + error.message);
  shutdown(1);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
