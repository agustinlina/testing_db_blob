export default function handler(req, res) {
  const expired = [
    'auth=',
    'Path=/',
    'SameSite=Lax',
    'HttpOnly',
    'Secure',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ].join('; ');
  res.setHeader('Set-Cookie', expired);
  res.status(200).json({ ok: true });
}
