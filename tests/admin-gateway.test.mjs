import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedRoute, sessionCookies, localSessionCookie, isSameOriginMutation } from '../lib/admin-gateway.mjs';

test('only the copied admin workflows can reach the upstream service', () => {
  assert.equal(allowedRoute('malik/applications', 'GET'), true);
  assert.equal(allowedRoute('malik/auth/verify-otp', 'POST'), true);
  assert.equal(allowedRoute('malik/documents/a.pdf', 'GET'), true);
  for (const path of ['../malik/applications', 'malik/../login', '//other.example', 'malik/documents/../private', 'register', 'admin-gateway']) assert.equal(allowedRoute(path, 'GET'), false);
  assert.equal(allowedRoute('malik/applications', 'POST'), false);
  assert.equal(allowedRoute('ggl-talent-trip', 'POST'), false);
  assert.equal(allowedRoute('malik/documents/a.pdf', 'DELETE'), false);
});

test('only existing GGL session cookies are forwarded, never unrelated browser credentials', () => {
  assert.equal(sessionCookies('other=secret; ggl_session=one; __vercel_token=private; ggl_verify_session=two; ggladmin_session=old'), 'ggl_session=one; ggl_verify_session=two');
  assert.equal(sessionCookies('ggl_session_fake=forged; foo=bar'), '');
});

test('upstream sessions remain host-only on the admin app', () => {
  assert.equal(localSessionCookie('ggl_session=token; Domain=www.gkpgotlatent.in; Path=/; HttpOnly; Secure; SameSite=Lax'), 'ggl_session=token; Path=/; HttpOnly; Secure; SameSite=Lax');
  assert.equal(localSessionCookie('tracking=unexpected; Path=/'), null);
});

test('cross-site mutations are rejected before contacting the upstream', () => {
  const request = (origin, site = 'same-origin') => new Request('https://admin.gkpgotlatent.in/api/malik/mark-read', { method: 'POST', headers: { origin, 'sec-fetch-site': site } });
  assert.equal(isSameOriginMutation(request('https://admin.gkpgotlatent.in')), true);
  assert.equal(isSameOriginMutation(request('https://evil.example')), false);
  assert.equal(isSameOriginMutation(request('https://admin.gkpgotlatent.in', 'cross-site')), false);
});
