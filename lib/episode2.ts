export const EPISODE_2 = {
  name: "Gorakhpur's Got Latent Episode 2",
  startDate: '2026-11-03T13:00:00+05:30',
  date: '3 November 2026', weekday: 'Tuesday', time: '1:00 PM IST',
  venue: 'Mars Orbit Entertainment', city: 'Gorakhpur, Uttar Pradesh, India',
  url: 'https://www.gkpgotlatent.in/ep2',
  summary: 'Tuesday, 3 November 2026 · Recording starts at 1:00 PM IST · Mars Orbit Entertainment, Gorakhpur.',
} as const;

export function getRecordingCountdown(target: string, now: number) {
  const seconds = Math.max(0, Math.floor((Date.parse(target) - now) / 1000));
  return { days: Math.floor(seconds / 86400), hours: Math.floor((seconds % 86400) / 3600), minutes: Math.floor((seconds % 3600) / 60), seconds: seconds % 60, started: now >= Date.parse(target) };
}
