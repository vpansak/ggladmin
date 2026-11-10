export function otpChallenge(result) {
  const cooldown = Number(result.cooldownSeconds);
  const pending = !result.success && Number.isFinite(cooldown) && cooldown > 0 && cooldown <= 60;
  if (!result.success && !pending) return null;
  return {
    pending,
    cooldown: Number.isFinite(cooldown) && cooldown >= 0 ? Math.min(cooldown, 60) : 60,
    expires: pending ? 240 + cooldown : Number(result.expiresInSeconds) || 300,
  };
}
