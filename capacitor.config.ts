import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android packaging configuration for TIVO AI OS.
 *
 * The APK ships the built web bundle from `dist/` so the app opens and works
 * offline (local-first workspace, cached Brain/registry state, IndexedDB).
 * No `server.url` is configured on purpose: pointing the shell at a remote URL
 * would make the "offline capable" claim false.
 *
 * The .apk itself is produced by Gradle + the Android SDK — see the `apk` job in
 * .github/workflows/tivo-build-factory.yml. It cannot be compiled inside the
 * Lovable web sandbox.
 */
const config: CapacitorConfig = {
  appId: 'app.lovable.a734267e65234877a0c2db6d7be03628',
  appName: 'tivo-ai-os',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
};

export default config;
