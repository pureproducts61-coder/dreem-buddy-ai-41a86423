/**
 * Guarded service-worker registration.
 * Never registers in dev, inside an iframe, in a Lovable preview host, or when
 * `?sw=off` is present — in those contexts any existing registration is removed
 * so a stale worker can never serve dead chunks.
 */
const SW_URL = '/sw.js';

function refused(): boolean {
  if (!import.meta.env.PROD) return true;
  try { if (window.self !== window.top) return true; } catch { return true; }
  const h = window.location.hostname;
  if (h.startsWith('id-preview--') || h.startsWith('preview--')) return true;
  if (h === 'lovableproject.com' || h.endsWith('.lovableproject.com')) return true;
  if (h === 'lovableproject-dev.com' || h.endsWith('.lovableproject-dev.com')) return true;
  if (h === 'beta.lovable.dev' || h.endsWith('.beta.lovable.dev')) return true;
  if (new URLSearchParams(window.location.search).has('sw') &&
      new URLSearchParams(window.location.search).get('sw') === 'off') return true;
  return false;
}

async function unregisterApp() {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
  await Promise.allSettled(
    regs
      .filter((r) => (r.active?.scriptURL || r.installing?.scriptURL || '').endsWith(SW_URL))
      .map((r) => r.unregister()),
  );
}

export async function registerAppServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (refused()) { await unregisterApp(); return; }
  try { await navigator.serviceWorker.register(SW_URL, { scope: '/' }); } catch { /* offline install is fine */ }
}