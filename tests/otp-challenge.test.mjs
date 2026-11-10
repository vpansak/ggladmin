import test from 'node:test';
import assert from 'node:assert/strict';
import { otpChallenge } from '../lib/otpChallenge.mjs';
test('an active cooldown lets the user enter the existing code without requesting another', () => {
  assert.deepEqual(otpChallenge({ success: false, cooldownSeconds: 21 }), { pending: true, cooldown: 21, expires: 261 });
});
test('permission, service and invalid cooldown failures do not advance login', () => {
  for (const result of [{ success: false }, { success: false, cooldownSeconds: 0 }, { success: false, cooldownSeconds: -1 }, { success: false, cooldownSeconds: 90 }]) assert.equal(otpChallenge(result), null);
});
test('new codes retain the server expiry and cooldown', () => {
  assert.deepEqual(otpChallenge({ success: true, cooldownSeconds: 60, expiresInSeconds: 300 }), { pending: false, cooldown: 60, expires: 300 });
});
