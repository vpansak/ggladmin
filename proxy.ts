import { NextRequest, NextResponse } from 'next/server';
import { isVerifyHost, verifyRouteAction } from './lib/portal-surface.mjs';

export function proxy(request: NextRequest) {
  const verification = isVerifyHost(request.headers.get('host') || '');
  const headers = new Headers(request.headers);
  // Overwrite client-supplied values. This selects the UI, never authorization.
  headers.set('x-ggl-surface', verification ? 'ticket-verification' : 'admin');
  if (verification) {
    const action = verifyRouteAction(request.nextUrl.pathname);
    if (action === 'rewrite') return NextResponse.rewrite(new URL('/verifyticket' + request.nextUrl.search, request.url), { request: { headers } });
    if (action === 'deny') return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (action === 'redirect') return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next({ request: { headers } });
}
export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
