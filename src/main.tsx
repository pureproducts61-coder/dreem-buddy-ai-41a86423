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

// Accessibility: pinch-zoom and double-tap zoom are intentionally NOT blocked.
// Users who need to magnify the UI must be able to.


createRoot(document.getElementById("root")!).render(<App />);

// Offline shell: register the generated worker only in safe, production contexts.
registerAppServiceWorker().catch(() => {});

// Local-first OS boot: workspace, permissions, capabilities, auto-updates, diagnostics.
bootOs().catch(() => {});
