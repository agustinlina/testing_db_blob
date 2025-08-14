import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.join(__dirname, '..'); // root del proyecto
const INDEX_PATH = path.join(ROOT, 'index.html');

export default async function handler(req, res) {
  // Permite ver login y APIs sin validar aquí (esta función solo atiende "/")
  // Aquí solo validamos "/" reescrito.
  const cookie = req.headers.cookie || '';
  const hasAuth = cookie.split(';').some(p => p.trim().startsWith('auth=ok'));

  if (!hasAuth) {
    res.statusCode = 302;
    res.setHeader('Location', '/login.html');
    return res.end();
  }

  try {
    const html = await fs.promises.readFile(INDEX_PATH);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.statusCode = 200;
    res.end(html);
  } catch (e) {
    console.error('No se pudo leer index.html', e);
    res.statusCode = 500;
    res.end('Error cargando la interfaz');
  }
}
