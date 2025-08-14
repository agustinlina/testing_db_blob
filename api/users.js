// En local: lee/escribe users.json del repo.
// En Vercel: persiste en Vercel Blob (archivo durable users.json).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { put, list } from '@vercel/blob';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const LOCAL_DB = path.join(ROOT, 'users.json');

const isVercel = !!process.env.VERCEL;

// Helpers comunes
function ok(res, data) { res.status(200).json(data); }
function bad(res, msg, code=400){ res.status(code).json({ error: msg }); }

async function readLocal() {
  if (!fs.existsSync(LOCAL_DB)) fs.writeFileSync(LOCAL_DB, '[]', 'utf8');
  const raw = await fs.promises.readFile(LOCAL_DB, 'utf8');
  try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
}
async function writeLocal(arr) {
  await fs.promises.writeFile(LOCAL_DB, JSON.stringify(arr, null, 2), 'utf8');
}

async function getBlobInfo() {
  const { blobs } = await list({ prefix: 'users.json' });
  const found = blobs.find(b => b.pathname === 'users.json');
  return found || null;
}

async function ensureBlob() {
  const info = await getBlobInfo();
  if (info) return info;
  const { url } = await put(
    'users.json',
    new Blob([JSON.stringify([], null, 2)], { type: 'application/json' }),
    { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
  );
  return { url, pathname: 'users.json' };
}

async function readBlob() {
  const info = await ensureBlob();
  const res = await fetch(info.url, { cache: 'no-store' });
  if (!res.ok) return [];
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

async function writeBlob(arr) {
  await put(
    'users.json',
    JSON.stringify(arr, null, 2),
    { access: 'public', addRandomSuffix: false, contentType: 'application/json' }
  );
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const data = isVercel ? await readBlob() : await readLocal();
      return ok(res, data);
    }

    if (req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      let { usuario, password, sede } = body;
      if (!usuario || !password || !sede)
        return bad(res, 'Campos requeridos: usuario, password, sede');

      sede = String(sede).toLowerCase();
      if (!['olavarria', 'cordoba'].includes(sede))
        return bad(res, 'Sede inválida. Use: olavarria | cordoba');

      const data = isVercel ? await readBlob() : await readLocal();

      const nuevo = {
        id: Date.now(),
        usuario: String(usuario),
        password: String(password),
        sede,
        createdAt: new Date().toISOString()
      };

      data.push(nuevo);

      if (isVercel) await writeBlob(data);
      else await writeLocal(data);

      return res.status(201).json({ ok: true, id: nuevo.id });
    }

    res.setHeader('Allow', 'GET, POST');
    return bad(res, 'Método no permitido', 405);
  } catch (e) {
    console.error(e);
    return bad(res, 'Error interno', 500);
  }
}
