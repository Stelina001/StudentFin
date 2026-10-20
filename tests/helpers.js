// Test helpers: start an isolated server (temporary database, offline demo agent) and a cookie-aware HTTP client.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Starts `server/index.js` on a free port with its own temporary SQLite database.
 * ANTHROPIC_API_KEY is forced empty, so the deterministic offline agent is used and no real API is called.
 */
export async function startServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studentfin-test-'));
  const port = 4100 + Math.floor(Math.random() * 800);
  const child = spawn(process.execPath, [path.join(root, 'server', 'index.js')], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      DB_PATH: path.join(dir, 'test.db'),
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      ANTHROPIC_API_KEY: '',
      DATABASE_URL: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not start:\n' + output)), 20000);
    const onData = d => {
      output += d.toString();
      if (output.includes('running at')) { clearTimeout(timer); resolve(); }
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`Server exited (${code}):\n${output}`)); });
  });
  const stop = async () => {
    child.removeAllListeners('exit');
    child.kill();
    await new Promise(r => setTimeout(r, 200));
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may keep the file locked briefly */ }
  };
  return { base: `http://127.0.0.1:${port}`, stop };
}

/** A minimal browser-like client: keeps the session cookie and sends the CSRF client header. */
export function client(base) {
  let cookie = '';
  async function request(method, url, body, { csrf = true, headers = {} } = {}) {
    const h = { ...headers };
    if (cookie) h.cookie = cookie;
    if (csrf) h['x-studentfin-client'] = '1';
    if (body !== undefined) h['content-type'] = 'application/json';
    const res = await fetch(base + url, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    return { status: res.status, data, headers: res.headers };
  }
  return {
    get: (u, o) => request('GET', u, undefined, o),
    post: (u, b, o) => request('POST', u, b ?? {}, o),
    put: (u, b, o) => request('PUT', u, b ?? {}, o),
    patch: (u, b, o) => request('PATCH', u, b ?? {}, o),
    del: (u, o) => request('DELETE', u, undefined, o),
    get cookie() { return cookie; }
  };
}

export const ask = (c, text) => c.post('/api/agent', { messages: [{ role: 'user', content: text }] });
