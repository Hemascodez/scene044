export async function register() {
  // Never send in next build, local dev, or isolated route tests. Our deployed
  // Railway start command is `npm start` -> `next start` (persistent Node).
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.argv.includes('start')) {
    const { startVenueNotificationWorker } = await import('./lib/venueNotificationWorker');
    startVenueNotificationWorker();
  }
}
