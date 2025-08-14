import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { put, list } from '@vercel/blob';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const LOCAL_DB = path.join(ROOT, 'users.json');

const FILE_NAME = 'users.json';
const isVercel = !!process.env.VERCEL;
// Usa el token si tu proyecto lo requiere (suele estar seteado al habilitar Blob)
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

// ---- CORS ----
function setCORS(res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
}

// ---- Local FS (dev) ----
async function readLocal(){
  if(!fs.existsSync(LOCAL_DB)) fs.writeFileSync(LOCAL_DB, '[]', 'utf8');
  const raw = await fs.promises.readFile(LOCAL_DB, 'utf8');
  try { return JSON.parse(raw) || []; } catch { return []; }
}
async function writeLocal(arr){
  await fs.promises.writeFile(LOCAL_DB, JSON.stringify(arr, null, 2), 'utf8');
}

// ---- Blob (Vercel) ----
async function getBlobInfo(){
  const { blobs } = await list({ prefix: FILE_NAME, token: TOKEN });
  return blobs.find(b => b.pathname === FILE_NAME) || null;
}
async function ensureBlob(){
  const info = await getBlobInfo();
  if (info) return info;
  const { url, pathname } = await put(
    FILE_NAME,
    JSON.stringify([], null, 2),
    { access: 'public', addRandomSuffix: false, contentType: 'application/json', token: TOKEN }
  );
  return { url, pathname };
}
async function readBlob(){
  const info = await ensureBlob();
  const r = await fetch(info.url, { cache: 'no-store' });
  if(!r.ok) return [];
  const json = await r.json();
  return Array.isArray(json) ? json : [];
}
async function writeBlob(arr){
  await put(
    FILE_NAME,
    JSON.stringify(arr, null, 2),
    { access: 'public', addRandomSuffix: false, contentType: 'application/json', token: TOKEN }
  );
}

// ---- Handler ----
export default async function handler(req, res){
  setCORS(res);
  if (req.method === 'OPTIONS'){ res.status(200).end(); return; }

  try {
    if (req.method === 'GET'){
      const data = isVercel ? await readBlob() : await readLocal();
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.setHeader('Cache-Control','no-store');
      res.status(200).send(JSON.stringify(data));
      return;
    }

    if (req.method === 'POST'){
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      let { usuario, password, sede } = body;
      if (!usuario || !password || !sede)
        return res.status(400).json({ error:'Campos requeridos: usuario, password, sede' });

      sede = String(sede).toLowerCase();
      if (!['olavarria','cordoba'].includes(sede))
        return res.status(400).json({ error:'Sede inválida' });

      const data = isVercel ? await readBlob() : await readLocal();

      const nuevo = {
        id: Date.now().toString(),   // como string para comparar siempre igual
        usuario: String(usuario),
        password: String(password),
        sede,
        createdAt: new Date().toISOString()
      };

      data.push(nuevo);
      if (isVercel) await writeBlob(data); else await writeLocal(data);

      res.status(201).json({ ok:true, id:nuevo.id });
      return;
    }

    if (req.method === 'DELETE'){
      // Construcción de URL robusta (Vercel puede no exponer host tal cual)
      const origin =
        (req.headers['x-forwarded-proto'] ? req.headers['x-forwarded-proto'] + '://' : 'http://') +
        (req.headers['x-forwarded-host'] || req.headers.host || 'localhost');
      const url = new URL(req.url, origin);

      const id = url.searchParams.get('id');
      if (!id) return res.status(400).json({ error:'Parámetro id requerido' });

      const data = isVercel ? await readBlob() : await readLocal();
      const before = data.length;
      const filtered = data.filter(u => String(u.id) !== String(id));

      if (filtered.length === before)
        return res.status(404).json({ error:'Usuario no encontrado' });

      if (isVercel) await writeBlob(filtered); else await writeLocal(filtered);
      res.status(200).json({ ok:true, deleted:id });
      return;
    }

    res.setHeader('Allow','GET, POST, DELETE, OPTIONS');
    res.status(405).json({ error:'Método no permitido' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:'Error interno' });
  }
}
