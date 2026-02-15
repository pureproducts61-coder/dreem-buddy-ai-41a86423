import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// PWA service worker is auto-registered by vite-plugin-pwa

createRoot(document.getElementById("root")!).render(<App />);
