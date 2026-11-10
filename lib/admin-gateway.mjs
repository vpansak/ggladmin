export const MAIN_ORIGIN = 'https://www.gkpgotlatent.in';
const SESSION_NAMES = new Set(['ggl_session', 'ggl_verify_session', 'ggl_computerji_session']);
const ROUTES = new Map([
  ['malik/auth/send-otp', ['POST']], ['malik/auth/verify-otp', ['POST']],
  ['malik/login', ['POST']], ['malik/logout', ['GET', 'POST']],
  ['malik/applications', ['GET', 'PATCH', 'DELETE']],
  ['malik/applications/refund', ['POST']], ['malik/applications/resend-email', ['POST']],
  ['malik/performer-payment', ['POST']], ['malik/performer-payment/manual', ['POST', 'PATCH']],
  ['malik/performer-payment/reconcile', ['POST']], ['malik/performer-details', ['POST']],
  ['malik/mark-read', ['POST']], ['malik/invite-ticket', ['POST']],
  ['malik/episode-backup', ['GET']], ['malik/sheets', ['GET']],
  ['malik/stats', ['GET']], ['malik/orders', ['GET']], ['malik/events', ['GET', 'POST']],
  ['computerji/scores', ['GET', 'POST', 'DELETE']], ['leads', ['GET', 'DELETE']],
  ['tickets/search', ['GET']], ['tickets/checkin', ['POST']], ['tickets/delete', ['DELETE']],
  ['tickets/lookup', ['GET', 'POST']], ['tickets/staff-login', ['POST']],
  ['tickets/staff-session', ['GET']], ['tickets/staff-logout', ['POST']],
  ['tickets/email', ['POST']], ['tickets/image', ['GET']], ['tickets/pdf', ['GET']],
  ['ggl-talent-trip', ['GET', 'PATCH', 'DELETE']],
  ['ggl-talent-trip/create-payment-link', ['POST']], ['ggl-talent-trip/documents', ['GET']],
  ['live/audio/status', ['GET']], ['live/audio/upload', ['POST']],
  ['live/operator', ['POST']], ['live/state', ['GET']],
]);

export function allowedRoute(path, method) {
  if (!/^[a-zA-Z0-9_./-]+$/.test(path) || path.split('/').some(x => x === '.' || x === '..')) return false;
  if (/^malik\/documents\/[a-zA-Z0-9_.-]+$/.test(path)) return method === 'GET';
  return ROUTES.get(path)?.includes(method) ?? false;
}

export function sessionCookies(value = '') {
  return value.split(';').map(x => x.trim()).filter(x => SESSION_NAMES.has(x.split('=', 1)[0])).join('; ');
}

export function localSessionCookie(value) {
  if (!SESSION_NAMES.has(value.split('=', 1)[0])) return null;
  return value.replace(/;\s*domain=[^;]*/gi, '');
}

export function isSameOriginMutation(request) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return true;
  const origin = request.headers.get('origin');
  return (!origin || origin === new URL(request.url).origin) && request.headers.get('sec-fetch-site') !== 'cross-site';
}
