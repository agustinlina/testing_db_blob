// Protege / y /index.html (y cualquier ruta que quieras agregar)
// Deja pasar /login.html, /api/* y assets.
import { NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/',           // home
    '/index.html', // tu interfaz
    // agrega aquí otras rutas protegidas si las hubiera, p.ej: '/panel', '/privado/:path*'
  ],
};

export default function middleware(req) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  // Permitir login y APIs sin cookie
  if (pathname.startsWith('/api/') || pathname === '/login.html') {
    return res;
  }

  // Verificar cookie
  const auth = req.cookies.get('auth')?.value;
  const valid = auth === 'ok';

  if (!valid) {
    const url = req.nextUrl.clone();
    url.pathname = '/login.html';
    return NextResponse.redirect(url);
  }

  return res;
}
