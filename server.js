/*
 * Tracking de Iniciativas S&OP · Megalabs
 * Backend sin dependencias externas: solo requiere Node.js (v18 o superior).
 *
 * - API REST:            /api/iniciativas  (GET, POST, PUT, DELETE)
 * - Sincronización viva: /api/events       (Server-Sent Events)
 * - Base de datos:       data/iniciativas.json (se crea sola con la semilla de 17 iniciativas)
 *
 * Arranque:  node server.js   →  http://localhost:3000
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'iniciativas.json');
const SEED_FILE = path.join(ROOT, 'seed', 'iniciativas-iniciales.json');

// ---------------------------------------------------------------- Base de datos (archivo JSON con escritura atómica)
let initiatives = [];

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    initiatives = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    persist();
    console.log(`Base de datos creada con ${initiatives.length} iniciativas iniciales.`);
    return;
  }
  initiatives = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  console.log(`Base de datos cargada: ${initiatives.length} iniciativas.`);
}

function persist() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(initiatives, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

// ---------------------------------------------------------------- Sincronización en vivo (SSE)
const sseClients = new Set();

function broadcast(event) {
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) res.write(payload);
}

// ---------------------------------------------------------------- Helpers
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 5e6) { reject(new Error('Cuerpo demasiado grande')); req.destroy(); } });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function nextId() {
  return initiatives.reduce((m, i) => Math.max(m, +i.id || 0), 0) + 1;
}

function sanitize(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!String(raw.titulo || '').trim() || !String(raw.estado || '').trim()) return null;
  const it = { ...raw };
  it.avance = Math.max(0, Math.min(100, +it.avance || 0));
  it.tags = Array.isArray(it.tags) ? it.tags.map(String) : [];
  it.openDecision = !!it.openDecision;
  return it;
}

// ---------------------------------------------------------------- Rutas de la API
async function handleApi(req, res, url) {
  const clientId = req.headers['x-client-id'] || null;
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'iniciativas', '3']

  // Flujo de eventos en vivo
  if (url.pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      'Connection': 'keep-alive'
    });
    res.write(`data: ${JSON.stringify({ type: 'hello' })}\n\n`);
    sseClients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 25000);
    req.on('close', () => { clearInterval(ping); sseClients.delete(res); });
    return;
  }

  if (parts[1] === 'iniciativas') {
    const id = parts[2] ? +parts[2] : null;

    if (req.method === 'GET') return sendJson(res, 200, initiatives);

    if (req.method === 'POST' && !id) {
      const it = sanitize(await readBody(req));
      if (!it) return sendJson(res, 400, { error: 'La iniciativa necesita al menos título y estado.' });
      it.id = nextId();
      it.actualizado = new Date().toISOString();
      initiatives.push(it);
      persist();
      broadcast({ type: 'change', action: 'create', id: it.id, clientId });
      return sendJson(res, 201, it);
    }

    if (req.method === 'PUT' && id) {
      const idx = initiatives.findIndex(i => +i.id === id);
      if (idx === -1) return sendJson(res, 404, { error: 'Iniciativa no encontrada (quizás otro usuario la eliminó).' });
      const it = sanitize(await readBody(req));
      if (!it) return sendJson(res, 400, { error: 'La iniciativa necesita al menos título y estado.' });
      it.id = id;
      it.actualizado = new Date().toISOString();
      initiatives[idx] = it;
      persist();
      broadcast({ type: 'change', action: 'update', id, clientId });
      return sendJson(res, 200, it);
    }

    if (req.method === 'DELETE' && id) {
      const before = initiatives.length;
      initiatives = initiatives.filter(i => +i.id !== id);
      if (initiatives.length === before) return sendJson(res, 404, { error: 'Iniciativa no encontrada.' });
      persist();
      broadcast({ type: 'change', action: 'delete', id, clientId });
      return sendJson(res, 200, { ok: true });
    }
  }

  // Importación masiva: {mode: 'replace' | 'append', initiatives: [...]}
  if (url.pathname === '/api/import' && req.method === 'POST') {
    const body = await readBody(req);
    const arr = (Array.isArray(body.initiatives) ? body.initiatives : []).map(sanitize);
    if (!arr.length || arr.some(x => !x)) {
      return sendJson(res, 400, { error: 'El archivo debe contener iniciativas con al menos título y estado.' });
    }
    if (body.mode === 'replace') {
      let n = 1;
      initiatives = arr.map(x => ({ ...x, id: n++ }));
    } else {
      let n = nextId();
      initiatives.push(...arr.map(x => ({ ...x, id: n++ })));
    }
    persist();
    broadcast({ type: 'change', action: 'import', clientId });
    return sendJson(res, 200, { ok: true, total: initiatives.length });
  }

  // Restaurar la semilla de 17 iniciativas
  if (url.pathname === '/api/restore' && req.method === 'POST') {
    initiatives = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
    persist();
    broadcast({ type: 'change', action: 'restore', clientId });
    return sendJson(res, 200, { ok: true, total: initiatives.length });
  }

  sendJson(res, 404, { error: 'Ruta no encontrada.' });
}

// ---------------------------------------------------------------- Archivos estáticos
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function serveStatic(req, res, url) {
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(PUBLIC_DIR, file);
  if (!full.startsWith(PUBLIC_DIR) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('No encontrado');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(full).pipe(res);
}

// ---------------------------------------------------------------- Servidor
loadDb();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('──────────────────────────────────────────────────');
  console.log('  Tracking de Iniciativas S&OP · Megalabs');
  console.log(`  Abrilo en:  http://localhost:${PORT}`);
  console.log('  Para compartir en tu red, pasá tu IP local con el puerto ' + PORT);
  console.log('──────────────────────────────────────────────────');
});
