export const VERIFY_HOST = 'verify.gkpgotlatent.in';
export function isVerifyHost(host = '') {
  return host.split(':')[0].toLowerCase() === VERIFY_HOST;
}
export function verifyRouteAction(path) {
  if (path === '/') return 'rewrite';
  if (path === '/verifyticket' || path.startsWith('/_next/') || ['/logo.png', '/ggl-logo.png', '/favicon.ico'].includes(path)) return 'allow';
  if (path.startsWith('/api/tickets/')) return 'allow';
  if (['/api/malik/auth/send-otp', '/api/malik/auth/verify-otp', '/api/malik/login', '/api/malik/logout'].includes(path)) return 'allow';
  if (path.startsWith('/api/')) return 'deny';
  return 'redirect';
}
