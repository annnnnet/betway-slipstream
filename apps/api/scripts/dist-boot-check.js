#!/usr/bin/env node
/**
 * Boots the *built* artefact exactly the way the container does, and fails if
 * it does not come up and serve a request.
 *
 * This exists because of a real bug: the Dockerfile and railway.json both
 * said `node dist/src/main.js`, carried over from an earlier project whose
 * tsconfig nested the output one level deeper. Here `nest build` emits
 * `dist/main.js`, so the image would have built green, pushed green, and then
 * crash-looped on Railway with MODULE_NOT_FOUND — a failure that no unit test,
 * no type check and no `docker build` can catch, because all of them stop
 * before anything is executed.
 *
 * Run after `pnpm build`:  node scripts/dist-boot-check.js
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

const API_ROOT = path.resolve(__dirname, '..');
const PORT = process.env.BOOT_CHECK_PORT || '4599';
const ENTRYPOINT = 'dist/main.js';
const TIMEOUT_MS = 30_000;

const child = spawn(process.execPath, [ENTRYPOINT], {
  cwd: API_ROOT,
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT,
    WEB_ORIGIN: 'http://localhost:3000',
    // Point at a database that certainly is not there: booting without one is
    // a guarantee this service makes, so the check should exercise it.
    DATABASE_URL: 'postgresql://nobody:nobody@127.0.0.1:1/none',
    DIRECT_URL: 'postgresql://nobody:nobody@127.0.0.1:1/none',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (d) => (output += d));
child.stderr.on('data', (d) => (output += d));

function finish(ok, message) {
  child.kill();
  console.log(ok ? `PASS  ${message}` : `FAIL  ${message}`);
  if (!ok) console.log(`\n--- server output ---\n${output}`);
  process.exit(ok ? 0 : 1);
}

child.on('exit', (code) => {
  // Only reached if the process dies before we get a response.
  finish(false, `${ENTRYPOINT} exited early with code ${code}`);
});

const deadline = Date.now() + TIMEOUT_MS;

(async function poll() {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/api/catalogue/sports`);
      if (res.ok) {
        const body = await res.json();
        if (Array.isArray(body.sports) && body.sports.length > 0) {
          return finish(true, `${ENTRYPOINT} booted and served /api/catalogue/sports`);
        }
        return finish(false, 'served a response, but not the expected payload');
      }
    } catch {
      // not listening yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  finish(false, `${ENTRYPOINT} did not serve a request within ${TIMEOUT_MS}ms`);
})();
