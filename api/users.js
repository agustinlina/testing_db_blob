import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { put } from '@vercel/blob';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const LOCAL_DB = path.join(ROOT, 'users.json');

// ✅ URL de tu store con el archivo users.json
const BLOB_URL = 'https://yuvdb04fmqfuhxsy.public.blob.vercel-storage.com/users.json';

const isVercel = !!process.env.VERCEL;

// ----------- LOCAL MODE -----------
async function readLocal() {
  if (!fs.existsSync(LOCAL_DB)) fs.writeFileSync(LOCAL_DB, '[]', 'utf8');
  const raw = await fs.promises.readFile(LOCAL_DB, 'utf8');
  try { return JSON.parse(raw) || []; } catch { return []; }
}

async function writeLocal(arr) {
  await fs.promises.writeFile(LOCAL_DB, JSON.stringify(arr, null, 2), 'utf8');
}

// ----------- BLOB MODE -----------
async function readBlob() {
  try {
    const res = await fetch(BLOB_URL, { cache: 'no-store' });
    if (res.status === 404) {
      // Si no existe, lo creo vacío
      await writeBlob([]);
      return [];
    }
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch (err) {
    console.error('Error leyendo blob:', err);
    return [];
  }
}

async function writeBlob(arr) {
  await put(
    'users.json',                              // nombre dentro del store
    JSON.stringify(arr, null, 2),              // contenido
    {
      access: 'public',
      addRandomSuffix: false,
      contentType: 'application/json'
    }
  );
}

// ----------- API HANDLER -----------
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const data = isVercel ? await readBlob() : await readLocal();
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

      let { usuario, password, sede } = body;
      if (!usuario || !password || !sede)
        return res.status(400).json({ error: 'Campos requeridos: usuario, password, sede' });

      sede = String(sede).toLowerCase();
      if (!['olavarria', 'cordoba'].includes(sede))
        return res.status(400).json({ error: 'Sede inválida' });

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
    return res.status(405).json({ error: 'Método no permitido' });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Error interno' });
  }
}
