/**
 * Platform detection. Mobile-first: the app must know truthfully whether it is
 * running inside an Android/iOS native shell (Capacitor), a mobile browser/PWA,
 * or a desktop browser — because that decides which runtimes may even be probed.
 * No guessing, no capability claims: only what the runtime actually exposes.
 */
export type PlatformKind = 'native-android' | 'native-ios' | 'mobile-web' | 'desktop-web';

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function cap(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

export function isNative(): boolean {
  return Boolean(cap()?.isNativePlatform?.());
}

export function platformKind(): PlatformKind {
  const c = cap();
  if (c?.isNativePlatform?.()) {
    return c.getPlatform?.() === 'ios' ? 'native-ios' : 'native-android';
  }
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
    || (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true);
  return mobile ? 'mobile-web' : 'desktop-web';
}

export const isMobile = () => platformKind() !== 'desktop-web';

/**
 * A plain mobile browser/PWA cannot reach localhost servers, spawn processes or
 * scan the filesystem. Probing those there only burns battery and produces
 * false "unavailable" noise — so local host probes are limited to contexts that
 * can genuinely serve them (native shell or desktop browser + Bridge).
 */
export const canProbeLocalHostServers = () => isNative() || platformKind() === 'desktop-web';

/** Process/filesystem access requires a native bridge — never the browser. */
export const canRunLocalProcesses = () => isNative();
