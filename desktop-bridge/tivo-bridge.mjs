#!/usr/bin/env node
/**
 * TIVO Desktop Bridge daemon (zero dependencies, Node >= 20).
 *
 * Answers the endpoints the web app already calls on http://127.0.0.1:8791:
 *   GET  /health            bridge status + capabilities
 *   GET  /llm/health        200 only when llama-server (llama.cpp) is installed
 *   POST /llm/load          multipart GGUF upload → starts llama-server with it
 *   POST /llm/unload        stops the model process
 *   POST /llm/chat          streams a real reply from the loaded model (SSE)
 *   POST /action/:name      small allow-listed OS actions
 *
 * Security: listens on 127.0.0.1 only; every request except OPTIONS must carry
 * `Authorization: Bearer $TIVO_BRIDGE_TOKEN` (paste the same token into TIVO's
 * pairing screen). Browser origins are restricted with TIVO_ALLOWED_ORIGINS.
 *
 * Usage:  TIVO_BRIDGE_TOKEN=<long random string> node tivo-bridge.mjs
 * Needs `llama-server` on PATH (or LLAMA_SERVER=/path/to/llama-server) for inference.
 */
import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';

const VERSION = '1.0.0';
const PORT = Number(process.env.TIVO_BRIDGE_PORT || 8791);
const LLAMA_PORT = Number(process.env.TIVO_LLAMA_PORT || 8792);
const TOKEN = process.env.TIVO_BRIDGE_TOKEN || '';
const LLAMA = process.env.LLAMA_SERVER || 'llama-server';
const MODEL_DIR = path.join(os.homedir(), '.tivo', 'models');
const ALLOWED = (process.env.TIVO_ALLOWED_ORIGINS ||
  'https://tivo-ai-os.lovable.app,http://localhost:8080,capacitor://localhost,http://localhost')
  .split(',').map((s) => s.trim()).filter(Boolean);

if (TOKEN.length < 16) {
  console.error('Set TIVO_BRIDGE_TOKEN to a random string of at least 16 characters.');
  process.exit(1);
}
fs.mkdirSync(MODEL_DIR, { recursive: true });

let llama = null; // { proc, modelId, name, file }

const llamaInstalled = () => {
  try { return spawnSync(LLAMA, ['--version'], { timeout: 5000 }).status === 0; } catch { return false; }
};

function cors(req, res) {
  const o = req.headers.origin;
  if (o && (ALLOWED.includes(o) || /\.lovable\.app$/.test(new URL(o).hostname))) {
    res.setHeader('Access-Control-Allow-Origin', o);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
}
const json = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const toRequest = (req) => new Request(`http://127.0.0.1${req.url}`, {
  method: req.method, headers: req.headers, body: Readable.toWeb(req), duplex: 'half',
});

async function waitForLlama(ms = 120_000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try { const r = await fetch(`http://127.0.0.1:${LLAMA_PORT}/health`); if (r.ok) return true; } catch { /* starting */ }
    if (!llama || llama.proc.exitCode !== null) return false;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function stopLlama() {
  if (llama?.proc && llama.proc.exitCode === null) llama.proc.kill();
  llama = null;
}

const ACTIONS = {
  'system-info': () => ({ platform: os.platform(), release: os.release(), cpus: os.cpus().length, freeMem: os.freemem(), totalMem: os.totalmem() }),
  'open-url': ({ url }) => {
    const u = new URL(String(url));
    if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) URLs');
    const cmd = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', u.href]] : process.platform === 'darwin' ? ['open', [u.href]] : ['xdg-open', [u.href]];
    spawn(cmd[0], cmd[1], { detached: true, stdio: 'ignore' }).unref();
    return { opened: u.href };
  },
};

const server = http.createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return json(res, 401, { error: 'unauthorized' });
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { version: VERSION, os: `${os.platform()} ${os.release()}`, capabilities: ['system-info', 'open-url', ...(llamaInstalled() ? ['llm'] : [])], model: llama ? llama.name : null });
    }
    if (req.method === 'GET' && url.pathname === '/llm/health') {
      return llamaInstalled() ? json(res, 200, { ok: true, loaded: Boolean(llama), model: llama?.name ?? null }) : json(res, 503, { error: 'llama-server not installed' });
    }
    if (req.method === 'POST' && url.pathname === '/llm/load') {
      if (!llamaInstalled()) return json(res, 503, { error: 'llama-server not installed' });
      const form = await toRequest(req).formData();
      const id = String(form.get('id') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
      const file = form.get('model');
      if (!id || !file || typeof file === 'string') return json(res, 400, { error: 'id and model file required' });
      const dest = path.join(MODEL_DIR, `${id}.gguf`);
      fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()));
      stopLlama();
      const proc = spawn(LLAMA, ['-m', dest, '--host', '127.0.0.1', '--port', String(LLAMA_PORT)], { stdio: 'ignore' });
      llama = { proc, modelId: id, name: String(form.get('name') || id), file: dest };
      if (!(await waitForLlama())) { stopLlama(); return json(res, 500, { error: 'Model process failed to start' }); }
      return json(res, 200, { ok: true, memoryBytes: fs.statSync(dest).size });
    }
    if (req.method === 'POST' && url.pathname === '/llm/unload') { stopLlama(); return json(res, 200, { ok: true }); }
    if (req.method === 'POST' && url.pathname === '/llm/chat') {
      if (!llama) return json(res, 409, { error: 'No model loaded' });
      const body = await toRequest(req).json();
      const messages = (Array.isArray(body.messages) ? body.messages : [])
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string');
      if (body.system) messages.unshift({ role: 'system', content: String(body.system) });
      const up = await fetch(`http://127.0.0.1:${LLAMA_PORT}/v1/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, stream: true }),
      });
      if (!up.ok || !up.body) return json(res, 502, { error: `Model returned ${up.status}` });
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      for await (const chunk of up.body) res.write(chunk);
      return res.end();
    }
    const m = url.pathname.match(/^\/action\/([a-z-]+)$/);
    if (req.method === 'POST' && m) {
      const fn = ACTIONS[m[1]];
      if (!fn) return json(res, 404, { error: 'Unknown action' });
      const body = await toRequest(req).json().catch(() => ({}));
      return json(res, 200, { ok: true, result: await fn(body.payload || {}) });
    }
    return json(res, 404, { error: 'not found' });
  } catch (e) {
    return json(res, 500, { error: e instanceof Error ? e.message : String(e) });
  }
});

process.on('SIGINT', () => { stopLlama(); process.exit(0); });
process.on('SIGTERM', () => { stopLlama(); process.exit(0); });
server.listen(PORT, '127.0.0.1', () => console.log(`TIVO Desktop Bridge ${VERSION} on http://127.0.0.1:${PORT}`));
