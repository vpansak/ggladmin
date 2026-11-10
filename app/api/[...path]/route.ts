import { MAIN_ORIGIN, allowedRoute, sessionCookies, localSessionCookie, isSameOriginMutation } from '@/lib/admin-gateway.mjs';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function forward(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join('/');
  if (!allowedRoute(route, request.method)) return Response.json({ error: 'Not found' }, { status: 404 });
  if (!isSameOriginMutation(request)) return Response.json({ error: 'Invalid request origin' }, { status: 403 });

  const url = new URL(`/api/${route}`, MAIN_ORIGIN);
  url.search = new URL(request.url).search;
  const headers = new Headers();
  for (const key of ['accept', 'content-type', 'range']) {
    const value = request.headers.get(key);
    if (value) headers.set(key, value);
  }
  const cookie = sessionCookies(request.headers.get('cookie') || '');
  if (cookie) headers.set('cookie', cookie);
  // Authentication and role checks stay on the original portal. No database or signing secrets leave it.
  try {
    const upstream = await fetch(url, {
      method: request.method, headers, cache: 'no-store', redirect: 'manual',
      signal: AbortSignal.timeout(55000),
      ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: await request.arrayBuffer() }),
    });
    const responseHeaders = new Headers({ 'Cache-Control': 'private, no-store, max-age=0', 'Vary': 'Cookie', 'X-Content-Type-Options': 'nosniff' });
    for (const key of ['content-type', 'content-disposition', 'content-range', 'accept-ranges']) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }
    for (const value of upstream.headers.getSetCookie()) {
      const local = localSessionCookie(value);
      if (local) responseHeaders.append('set-cookie', local);
    }
    const location = upstream.headers.get('location');
    if (location) {
      const target = new URL(location, MAIN_ORIGIN);
      responseHeaders.set('location', target.origin === MAIN_ORIGIN && target.pathname === '/malik' ? '/' : target.toString());
    }
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json({ error: 'The admin service is temporarily unavailable. Please retry.' }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE, forward as HEAD };
