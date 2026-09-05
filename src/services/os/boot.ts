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
import { startBridgeMonitor, getBridgeMonitorState } from './bridgeMonitor';
import { startDeviceRuntime } from './deviceRegistry';
import { startCommandHost, flushOutbox } from './deviceCommands';
import { startOllamaDiscovery } from './ollama';
import { discoverRuntimes } from './runtimeManager';
import { startSnapshotPersistence } from './workspaceSnapshot';
import { runAutomaticCleanup } from './dataLifecycle';
import { canProbeLocalHostServers } from './platform';

let booted = false;

export async function bootOs() {
  if (booted) return;
  booted = true;
  try { ensureSeedPermissions(); } catch { /* ignore */ }
  await bootstrapWorkspace().catch(() => {});
  pingBridge().catch(() => {});
  detectCapabilities().catch(() => {});
  // Bridge heartbeat + reconnect, then device identity/heartbeat.
  startBridgeMonitor();
  startDeviceRuntime().catch(() => {});
  // Discover Ollama / local model runtimes on this machine.
  startOllamaDiscovery();
  // Any command that could not reach the network is retried safely.
  flushOutbox().catch(() => {});
  if (typeof window !== 'undefined') window.addEventListener('online', () => { void flushOutbox().catch(() => {}); });
  // Only a machine that actually owns a Bridge may execute remote commands.
  setTimeout(() => {
    if (getBridgeMonitorState().state === 'connected') startCommandHost().catch(() => {});
  }, 5000);
  startAutoUpdates();
  // AI intelligence (Constitution, Brain, Plugins) hot-reloads from the database.
  startConfigSync().catch(() => {});
  // First launch (or once a day) run diagnostics in the background.
  const last = lastSelfTest();
  const stale = !last || Date.now() - new Date(last.ranAt).getTime() > 24 * 60 * 60 * 1000;
  if (stale) setTimeout(() => { runSelfTest().catch(() => {}); }, 4000);
}
