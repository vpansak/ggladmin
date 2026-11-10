import test from 'node:test';
import assert from 'node:assert/strict';
import { isVerifyHost, verifyRouteAction } from '../lib/portal-surface.mjs';
test('only the exact verify host selects the ticket surface', () => {
  assert.equal(isVerifyHost('verify.gkpgotlatent.in'), true);
  assert.equal(isVerifyHost('VERIFY.GKPGOTLATENT.IN:443'), true);
  for (const host of ['admin.gkpgotlatent.in', 'ggladmin.vercel.app', 'www.gkpgotlatent.in', 'verify.gkpgotlatent.in.evil.example']) assert.equal(isVerifyHost(host), false);
});
test('verification root exposes ticket workflows and hides admin routes', () => {
  assert.equal(verifyRouteAction('/'), 'rewrite');
  assert.equal(verifyRouteAction('/api/tickets/lookup'), 'allow');
  assert.equal(verifyRouteAction('/api/malik/applications'), 'deny');
  assert.equal(verifyRouteAction('/malik/orders'), 'redirect');
  assert.equal(verifyRouteAction('/logo.png'), 'allow');
});
