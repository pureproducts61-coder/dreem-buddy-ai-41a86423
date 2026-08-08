import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { bootOs } from "./services/os/boot";
import { registerAppServiceWorker } from "./pwa/registerSW";

// Lock orientation to portrait when supported (mobile rotation fix)
try {
  const orient = (screen as unknown as { orientation?: { lock?: (o: string) => Promise<void> } }).orientation;
  orient?.lock?.('portrait').catch(() => {});
} catch { /* unsupported */ }

// Block multi-touch pinch-zoom and double-tap zoom globally
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', (e) => {
  if ((e as TouchEvent).touches.length > 1) e.preventDefault();
}, { passive: false });
let lastTap = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTap < 300) e.preventDefault();
  lastTap = now;
}, { passive: false });

createRoot(document.getElementById("root")!).render(<App />);

// Offline shell: register the generated worker only in safe, production contexts.
registerAppServiceWorker().catch(() => {});

// Local-first OS boot: workspace, permissions, capabilities, auto-updates, diagnostics.
bootOs().catch(() => {});
