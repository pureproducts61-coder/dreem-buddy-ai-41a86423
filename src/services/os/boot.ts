/**
 * OS boot sequence. Runs once per app launch, entirely local-first.
 * Nothing here blocks the UI and every step fails soft.
 */
import { bootstrapWorkspace } from './workspace';
import { ensureSeedPermissions, pingBridge } from './desktopBridge';
import { detectCapabilities } from './capabilities';
import { startAutoUpdates } from './updates';
import { runSelfTest, lastSelfTest } from './selfTest';
import { startConfigSync } from './dbSync';

let booted = false;

export async function bootOs() {
  if (booted) return;
  booted = true;
  try { ensureSeedPermissions(); } catch { /* ignore */ }
  await bootstrapWorkspace().catch(() => {});
  pingBridge().catch(() => {});
  detectCapabilities().catch(() => {});
  startAutoUpdates();
  // AI intelligence (Constitution, Brain, Plugins) hot-reloads from the database.
  startConfigSync().catch(() => {});
  // First launch (or once a day) run diagnostics in the background.
  const last = lastSelfTest();
  const stale = !last || Date.now() - new Date(last.ranAt).getTime() > 24 * 60 * 60 * 1000;
  if (stale) setTimeout(() => { runSelfTest().catch(() => {}); }, 4000);
}
