/**
 * Installing BulkSkart as an app.
 *
 * The site has a web app manifest (public/site.webmanifest, display "standalone"), so browsers can install it as an
 * app with its own icon and window. Chrome, Edge and Samsung Internet offer that through the `beforeinstallprompt`
 * event, which is kept here so the Download button can open the browser's own install dialog. Safari on iPhone and
 * iPad has no such event; there the app is added with Share → Add to Home Screen.
 *
 * When BulkSkart is published in an app store, set VITE_ANDROID_APP_URL (Google Play) and/or VITE_IOS_APP_URL
 * (App Store) and the Download button opens the store page on that kind of phone instead.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
}

export type AppPlatform = 'ios' | 'android' | 'desktop';
export type InstallResult = 'accepted' | 'dismissed' | 'unavailable';

const INSTALLED_KEY = 'bs-app-installed';

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // keep the browser's own small banner away; the Download App popup offers the install instead
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    try {
      localStorage.setItem(INSTALLED_KEY, String(Date.now()));
    } catch {
      // storage can be blocked; the popup then simply shows again later
    }
    notify();
  });
}

/** Calls `listener` when the browser offers or completes an install. Returns the unsubscribe function. */
export function onInstallChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when the browser has offered its install dialog for this site. */
export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

/** Opens the browser's install dialog when it has offered one. */
export async function promptInstall(): Promise<InstallResult> {
  const event = deferredPrompt;
  if (!event) return 'unavailable';
  deferredPrompt = null;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    notify();
    return choice.outcome;
  } catch {
    notify();
    return 'unavailable';
  }
}

/** True when the page is running as the installed app, or the app was installed from this browser. */
export function isAppInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return true;
  try {
    return Boolean(localStorage.getItem(INSTALLED_KEY));
  } catch {
    return false;
  }
}

/** The kind of device, from the browser's description of itself. */
export function appPlatform(userAgent: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): AppPlatform {
  const ua = userAgent.toLowerCase();
  const isIpadOs = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1 && /macintosh/.test(ua);
  if (/iphone|ipad|ipod/.test(ua) || isIpadOs) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

/** Store page for this kind of phone, when the app has been published there. */
export function storeUrlFor(platform: AppPlatform): string {
  const env = import.meta.env as Record<string, string | undefined>;
  if (platform === 'android') return (env.VITE_ANDROID_APP_URL ?? '').trim();
  if (platform === 'ios') return (env.VITE_IOS_APP_URL ?? '').trim();
  return '';
}
