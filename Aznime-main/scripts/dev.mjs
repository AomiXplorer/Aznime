import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
const args = process.argv.slice(2);

function readFlag(names, fallback) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    for (const name of names) {
      if (arg.startsWith(`${name}=`)) {
        const val = arg.slice(name.length + 1).trim();
        if (val) return val;
      } else if (arg === name && args[i + 1]) {
        return args[i + 1];
      }
    }
  }
  return fallback;
}

const port = readFlag(['--port', '-p'], process.env.DEFAULT_APP_PORT || '3000');
const host = readFlag(['--host', '-H'], '0.0.0.0');

const child = spawn(process.execPath, [nextBin, 'dev', '-p', port, '-H', host], {
  stdio: 'inherit',
  env: process.env,
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) {
      child.kill(sig);
    }
  });
}

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
