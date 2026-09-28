export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.SCHEDULER_ENABLED === 'false') {
      console.info('[scheduler] Deshabilitado por SCHEDULER_ENABLED=false');
      return;
    }
    const { startScheduler } = await import('./lib/server/scheduler');
    startScheduler();
  }
}
