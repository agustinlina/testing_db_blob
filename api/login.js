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
      // Nota: "Secure" requiere https (ok en Vercel). Para dev local en http, podés quitar "Secure".
      const cookie = [
        'auth=ok',
        'Path=/',
        'SameSite=Lax',
        'HttpOnly',
        'Secure'
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
