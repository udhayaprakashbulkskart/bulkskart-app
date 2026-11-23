/**
 * "Download the BulkSkart App" popup notification.
 *
 * Phones and small tablets: a card that slides down from the top of the screen (the bottom is used by the buyer
 * alert and the chat button). Laptops and desktops: a card at the bottom left.
 * Download opens the app store page when one is set, otherwise the browser's own install dialog, otherwise short
 * steps for adding BulkSkart to the home screen (Safari on iPhone and iPad, and browsers without an install dialog).
 * It waits a few seconds after the page opens, stays away for a few days once closed, never shows inside the
 * installed app, and skips sign-in, sign-up, dashboard and payment pages.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, EllipsisVertical, MonitorDown, PlusSquare, Share, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  appPlatform,
  canPromptInstall,
  isAppInstalled,
  onInstallChange,
  promptInstall,
  storeUrlFor,
  type AppPlatform,
} from '@/lib/appInstall';

const DISMISSED_KEY = 'bs-app-popup-dismissed-at';
/** After the popup is closed it stays away this long. */
export const DISMISS_DAYS = 3;
/** Wait after the page opens before the popup slides in. */
const SHOW_AFTER_MS = 3000;
/** Pages where the popup would get in the way. */
// the supplier map is a full-screen map with its own "list your business" prompt
export const NO_POPUP_PATHS = /^\/(auth|login|register|signup|forgot-password|reset-password|dashboard|admin|checkout|payment|pay|supplier-map)(\/|$)/;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    return at > 0 && Date.now() - at < DISMISS_DAYS * 864e5;
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {
    // storage can be blocked; the popup then shows again on a later visit
  }
}

const STEPS: Record<AppPlatform, { icon: typeof Share; text: string }[]> = {
  ios: [
    { icon: Share, text: 'Tap the Share button in Safari’s toolbar' },
    { icon: PlusSquare, text: 'Choose “Add to Home Screen”' },
    { icon: Download, text: 'Tap “Add”. BulkSkart opens from your home screen' },
  ],
  android: [
    { icon: EllipsisVertical, text: 'Tap the ⋮ menu at the top right of your browser' },
    { icon: PlusSquare, text: 'Choose “Install app” or “Add to Home screen”' },
    { icon: Download, text: 'Tap “Install”. BulkSkart opens from your home screen' },
  ],
  desktop: [
    { icon: MonitorDown, text: 'Click the install icon at the right end of the address bar, or open the browser menu' },
    { icon: PlusSquare, text: 'Choose “Install BulkSkart”' },
    { icon: Download, text: 'Click “Install”. BulkSkart opens in its own window' },
  ],
};

export default function DownloadAppPopup() {
  const { pathname } = useLocation();
  const [platform] = useState<AppPlatform>(() => appPlatform());
  const [due, setDue] = useState(false);
  const [open, setOpen] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [, setInstallTick] = useState(0);
  const blockedPage = NO_POPUP_PATHS.test(pathname);

  // wait a moment after the first page opens; nothing at all inside the installed app or after a recent close
  useEffect(() => {
    if (isAppInstalled() || dismissedRecently()) return;
    const timer = window.setTimeout(() => setDue(true), SHOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (due && !blockedPage && !isAppInstalled()) setOpen(true);
    if (blockedPage) setOpen(false);
  }, [due, blockedPage]);

  // the browser may offer its install dialog later; once installed, the popup goes away
  useEffect(
    () =>
      onInstallChange(() => {
        setInstallTick((n) => n + 1);
        if (isAppInstalled()) setOpen(false);
      }),
    [],
  );

  const close = useCallback(() => {
    rememberDismissed();
    setOpen(false);
    setDue(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const download = async () => {
    const store = storeUrlFor(platform);
    if (store) {
      rememberDismissed();
      setOpen(false);
      window.location.assign(store);
      return;
    }
    if (canPromptInstall()) {
      const result = await promptInstall();
      if (result === 'accepted') {
        setOpen(false);
        toast.success('BulkSkart app installed. Open it from your home screen or app list.');
        return;
      }
      if (result === 'dismissed') return;
    }
    setShowSteps(true);
  };

  if (!open) return null;

  const steps = STEPS[platform];

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="download-app-title"
      aria-describedby="download-app-text"
      className="fixed inset-x-2 top-[max(8px,env(safe-area-inset-top))] z-[90] mx-auto max-w-[460px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-4 motion-safe:duration-300 md:inset-x-auto md:bottom-5 md:left-5 md:top-auto md:mx-0 md:w-[400px] md:max-w-none md:motion-safe:slide-in-from-bottom-4"
    >
      <div className="relative overflow-hidden rounded-2xl border border-[#FF5A00]/55 bg-[#0b0b0b]/95 p-3 text-white shadow-[0_18px_44px_-14px_rgba(255,90,0,0.55)] backdrop-blur-xl sm:p-4">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[#FF5A00]/20 blur-3xl" />
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="relative flex items-start gap-3 pr-7">
          <img
            src="/android-chrome-192x192.png"
            alt=""
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-xl bg-white p-1 shadow-[0_6px_16px_-6px_rgba(255,90,0,0.8)]"
          />
          <div className="min-w-0">
            <p id="download-app-title" className="text-[15px] font-black leading-tight sm:text-[16px]">
              Download the <span className="text-[#FF6A00]">BulkSkart</span> App
            </p>
            <p id="download-app-text" className="mt-1 text-[12px] leading-snug text-white/75 sm:text-[13px]">
              {showSteps
                ? 'Add BulkSkart to your home screen in three quick steps:'
                : 'Free app. Open bulk products, RFQs and your orders in one tap from your home screen.'}
            </p>
          </div>
        </div>

        {showSteps ? (
          <>
            <ol className="relative mt-3 space-y-1.5">
              {steps.map(({ icon: Icon, text }, i) => (
                <li key={text} className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-[12px] leading-snug sm:text-[13px]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#FF5A00] text-[11px] font-black">{i + 1}</span>
                  <Icon className="h-4 w-4 shrink-0 text-[#FF8A3D]" aria-hidden="true" />
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              onClick={close}
              className="relative mt-3 flex h-10 w-full items-center justify-center rounded-xl border border-white/20 text-[13px] font-bold transition-colors hover:border-[#FF6A00] hover:text-[#FF8A3D]"
            >
              Got it
            </button>
          </>
        ) : (
          <div className="relative mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={download}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF7A1A] to-[#F05A00] text-[15px] font-extrabold text-white shadow-[0_10px_24px_-10px_rgba(255,90,0,0.95)] transition-transform hover:brightness-110 active:scale-[0.98]"
            >
              <Download className="h-5 w-5" aria-hidden="true" />
              Download
            </button>
            <button
              type="button"
              onClick={close}
              className="h-11 shrink-0 rounded-xl border border-white/15 px-4 text-[13px] font-semibold text-white/80 transition-colors hover:border-white/35 hover:text-white"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
