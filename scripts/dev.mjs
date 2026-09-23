import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

function postgresUp() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: 5432 }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
  });
}

if (!(await postgresUp())) {
  console.warn(
    'Postgres is not running on 127.0.0.1:5432. Start it with:\n  docker compose up -d postgres\n  corepack pnpm migrate\n',
  );
}

function runDev(pkgDir) {
  const child = spawn('npm', ['run', 'dev'], {
    cwd: path.join(root, pkgDir),
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exit(code);
    }
  });

  return child;
}

const children = [runDev('apps/api'), runDev('apps/web')];

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    for (const child of children) {
      child.kill(signal);
    }
  });
}
