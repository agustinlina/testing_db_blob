// POST { "usuario": "admin", "password": "cuadrobonito11" }
// Si es válido, setea cookie `auth=ok` y redirige/retorna ok.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const { usuario, password, redirectTo = '/' } = body;

    if (usuario === 'admin' && password === 'cuadrobonito11') {
      // Cookie de sesión (no persistente): sin Max-Age -> dura hasta cerrar navegador.
      // Si querés que dure más, agrega: ; Max-Age=86400
      const cookie = [
        'auth=ok',
        'Path=/', 
        'SameSite=Lax',
        'HttpOnly',        // evita acceso desde JS
        'Secure'           // en producción (https)
      ].join('; ');

      res.setHeader('Set-Cookie', cookie);
      return res.status(200).json({ ok: true, redirectTo });
    }

    return res.status(401).json({ error: 'Credenciales inválidas' });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: 'Body inválido' });
  }
}
