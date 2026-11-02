/**
 * LiveBuyerOrderAlert.tsx
 *
 * Real-time floating social proof & buyer activity popup:
 * "Wanted bulk order from India posted by [Name of the person]"
 *
 * Compact Dark Glassmorphism Corner Widget (Non-blocking, Non-fullscreen):
 * - Small footprint: ~380px width docked at bottom-left corner
 * - Glowing multi-color neon border (orange to violet to blue)
 * - Header with LIVE RFQ status, posted time, auto-refresh 1m counter, minimize & close buttons
 * - Segmented 5-step progress indicator and circular prev/next navigation
 * - Compact layout: Product thumbnail on left, verified buyer info on right
 * - Highlighted RFQ description in a compact quote card
 * - 6 organized micro information boxes (Qty, Type, Req By, Price, Specs, Location)
 * - Category, Bulk Order, and Subscriber Eligibility badges
 * - Bottom CTA buttons: View RFQ and Send Quote with working subscription gating
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  X, ArrowRight, CheckCircle2, Building2, MapPin,
  ChevronRight, Volume2, VolumeX, Minimize2, Share2, Link2, Mail, Check,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { checkDirectMessageQuota, checkSupplierPaidSubscription } from '@/lib/api';
import SubscribeToContactDialog, { type SubscriptionReason } from '@/components/common/SubscribeToContactDialog';
import {
  getIndianBulkOrder,
  getRandomIndianBulkOrder,
  TOTAL_INDIAN_BULK_ORDERS,
  type IndianBulkOrderAlert
} from '@/lib/bulkOrdersIndiaDataset';
import SupplierRespondDialog from '@/components/common/SupplierRespondDialog';
import type { Requirement } from '@/types/types';
import { toast } from 'sonner';

export type AlertAppearance = 'modal' | 'pill';
const ROTATE_MS = 18000;
const FALLBACK_PHOTO =
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=240&h=240&q=70&fm=webp';

// Curated high-res Indian professional buyer avatars
const INDIAN_BUYER_AVATARS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
];

// Helper to extract clean product type
function extractProductType(order: IndianBulkOrderAlert): string {
  const msg = (order.message + ' ' + order.title).toLowerCase();
  if (msg.includes('forklift')) return 'Electric Forklift';
  if (msg.includes('grinder') || msg.includes('cnc')) return 'CNC Grinder';
  if (msg.includes('truck') || msg.includes('trailer')) return 'Food Truck';
  if (msg.includes('steel') || msg.includes('rebar') || msg.includes('coil')) return 'Structural Steel';
  if (msg.includes('carton') || msg.includes('box') || msg.includes('jute')) return 'Corrugated Boxes';
  if (msg.includes('pipe') || msg.includes('valve')) return 'Valves & Pipes';
  if (msg.includes('solar') || msg.includes('panel')) return 'Solar Modules';
  if (msg.includes('fabric') || msg.includes('cotton') || msg.includes('silk')) return 'Textile Fabrics';
  if (msg.includes('spice') || msg.includes('grain') || msg.includes('rice')) return 'Agro Grains';
  if (msg.includes('chemical') || msg.includes('polymer')) return 'Polymers';

  return order.category.split('&')[0].trim() || 'Machinery';
}

export default function LiveBuyerOrderAlert() {
  const { user, profile, company } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [appearance, setAppearance] = useState<AlertAppearance>('modal');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [entered, setEntered] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Alert State
  const [currentIndex, setCurrentIndex] = useState(() => Math.floor(Math.random() * TOTAL_INDIAN_BULK_ORDERS));
  const [currentOrder, setCurrentOrder] = useState<IndianBulkOrderAlert>(() => getRandomIndianBulkOrder('All Categories'));
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('bsk_lead_popup_session') === 'true';
    } catch {
      return false;
    }
  });

  const [showCloseMenu, setShowCloseMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(60);

  // Dialog states for quoting
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [subDialogReason, setSubDialogReason] = useState<SubscriptionReason>('no_subscription');
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [activeReqForQuote, setActiveReqForQuote] = useState<Requirement | null>(null);

  // Audio Chime Synthesizer via Web Audio API
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1108.73, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {}
  }, [soundEnabled]);

  // Navigate to specific index
  const goToOrder = useCallback((newIdx: number) => {
    setIsVisible(false);
    setTimeout(() => {
      const normalizedIdx = (newIdx + TOTAL_INDIAN_BULK_ORDERS) % TOTAL_INDIAN_BULK_ORDERS;
      setCurrentIndex(normalizedIdx);
      const nextOrder = getIndianBulkOrder(normalizedIdx);
      setCurrentOrder(nextOrder);
      setPhotoFailed(false);
      setShareOpen(false);
      setCopied(false);
      setIsVisible(true);
      setRefreshCountdown(Math.round(ROTATE_MS / 1000));
      playChime();
    }, 180);
  }, [playChime]);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 2800);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isDismissed || isHovered || showCloseMenu || shareOpen || !entered) return;

    const intervalTimer = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        goToOrder(currentIndex + 1);
      }
    }, ROTATE_MS);

    const countdownTimer = setInterval(() => {
      setRefreshCountdown(prev => (prev <= 1 ? Math.round(ROTATE_MS / 1000) : prev - 1));
    }, 1000);

    return () => {
      clearInterval(intervalTimer);
      clearInterval(countdownTimer);
    };
  }, [isDismissed, isHovered, showCloseMenu, shareOpen, entered, currentIndex, goToOrder]);

  // Close for this session
  const handleCloseSession = () => {
    try {
      sessionStorage.setItem('bsk_lead_popup_session', 'true');
    } catch {}
    setIsVisible(false);
    setIsDismissed(true);
    setShowCloseMenu(false);
    toast.info('Live RFQ alert closed for this session. Restore anytime via bottom-left button.', {
      duration: 4000,
    });
  };

  // Close permanently
  const handleClosePermanent = () => {
    try {
      sessionStorage.setItem('bsk_lead_popup_session', 'true');
    } catch {}
    setIsVisible(false);
    setIsDismissed(true);
    setShowCloseMenu(false);
    toast.success('Live RFQ alerts disabled. You can restore them anytime from the bottom-left button.', {
      duration: 4000,
    });
  };

  // Minimize to corner pill
  const handleMinimize = () => {
    setAppearance('pill');
    try {
      localStorage.setItem('trade_buyer_alert_appearance', 'pill');
    } catch {}
    toast.info('Popup minimized to corner pill.', { duration: 2500 });
  };

  // Restore popups
  const handleRestore = () => {
    try {
      sessionStorage.removeItem('bsk_lead_popup_session');
    } catch {}
    setIsDismissed(false);
    setAppearance('modal');
    setIsVisible(true);
    setShowCloseMenu(false);
    goToOrder(currentIndex + 1);
  };

  // Handle Send Quote click with subscription validation
  const handleActionClick = async () => {
    if (!user || !profile) {
      setSubDialogReason('not_logged_in');
      setSubDialogOpen(true);
      return;
    }

    if (!company) {
      setSubDialogReason('not_registered_business');
      setSubDialogOpen(true);
      return;
    }

    const subCheck = await checkSupplierPaidSubscription(company.id, company);
    if (!subCheck.allowed) {
      setSubDialogReason(subCheck.reason);
      setSubDialogOpen(true);
      return;
    }

    const quota = await checkDirectMessageQuota(company.id, company);
    if (quota !== 'ok') {
      setSubDialogReason(quota);
      setSubDialogOpen(true);
      return;
    }

    const reqObj: Requirement = {
      id: currentOrder.id,
      buyer_id: 'verified-buyer-india',
      category_id: null,
      title: currentOrder.title,
      description: currentOrder.message,
      specifications: `${currentOrder.attribute} • Urgent procurement from verified buyer ${currentOrder.buyerName} (${currentOrder.companyName}, ${currentOrder.city})`,
      quantity: parseInt(currentOrder.quantity.replace(/\D/g, '') || '1000', 10),
      quantity_unit: currentOrder.quantity.replace(/[\d,]/g, '').trim() || 'Units',
      budget_min: null,
      budget_max: null,
      currency: 'INR',
      destination_city: currentOrder.city.split(',')[0].trim(),
      destination_country: 'India',
      status: 'active',
      quote_count: 0,
      view_count: 18,
      deadline: null,
      attachment_url: null,
      expires_at: null,
      is_verified_buyer: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setActiveReqForQuote(reqObj);
    setQuoteDialogOpen(true);
  };

  const avatarUrl = INDIAN_BUYER_AVATARS[currentIndex % INDIAN_BUYER_AVATARS.length];
  const productType = extractProductType(currentOrder);
  const postedLabel = currentIndex % 5 === 0 ? 'Just now' : `${(currentIndex % 12) + 1} min ago`;
  const leadPath = `/requirement/${currentOrder.orderNumber}`;
  const shareUrl = `https://www.bulkskart.com${leadPath}`;
  const shareText = `New buy lead on BulkSkart: ${currentOrder.message} (${currentOrder.quantity}, ${currentOrder.city}).`;

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Lead link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy automatically. Select the link and copy it.');
    }
  };

  const openShareTarget = (href: string) => {
    const popup = window.open(href, '_blank', 'noopener,noreferrer');
    if (!popup) window.location.assign(href);
  };

  const shareTargets = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      className: 'bg-[#25D366] text-white',
      href: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
    },
    {
      id: 'facebook',
      label: 'Facebook',
      className: 'bg-[#1877F2] text-white',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      className: 'bg-[#0A66C2] text-white',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
    },
    {
      id: 'x',
      label: 'X',
      className: 'bg-foreground text-background',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      id: 'telegram',
      label: 'Telegram',
      className: 'bg-[#229ED9] text-white',
      href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
    },
  ];

  const isExcludedPage =
    location.pathname.includes('/business-setup') ||
    location.pathname.includes('/onboarding') ||
    location.pathname.includes('/post-requirement') ||
    location.pathname.includes('/negotiation') ||
    location.pathname.includes('/auth') ||
    location.pathname.includes('/settings');

  if (isExcludedPage || !entered) {
    return null;
  }

  if (isDismissed || appearance === 'pill') {
    return (
      <div className="fixed bottom-24 sm:bottom-6 left-3 sm:left-4 z-40">
        <button
          type="button"
          onClick={handleRestore}
          className="flex items-center gap-2 rounded-full bg-card border border-border shadow-lg px-3 py-1.5 text-xs font-semibold text-foreground hover:border-[#FF5A00]/50"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          New buy leads
          <ChevronRight className="w-3.5 h-3.5 text-[#FF5A00]" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className={`fixed bottom-24 sm:bottom-6 left-3 sm:left-4 z-40 w-[min(100vw-1.5rem,380px)] transition-all duration-300 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3 pointer-events-none'
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative rounded-2xl bg-card text-card-foreground border border-border shadow-[0_16px_40px_rgba(15,23,42,0.18)] overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-[#FF5A00] via-amber-400 to-emerald-500" />
          <div className="p-3.5">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#FF5A00]">New buy lead</span>
                <span className="text-[11px] text-muted-foreground">· {postedLabel}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{refreshCountdown}s</span>
                <button
                  type="button"
                  onClick={() => setSoundEnabled(v => !v)}
                  className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                  aria-label={soundEnabled ? 'Mute' : 'Enable sound'}
                >
                  {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={handleMinimize}
                  className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                  aria-label="Minimize"
                >
                  <Minimize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleCloseSession}
                  className="w-6 h-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                  aria-label="Close for this session"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate(leadPath)}
                className="w-[84px] h-[84px] rounded-xl overflow-hidden bg-muted shrink-0 border border-border"
              >
                <img
                  src={photoFailed ? FALLBACK_PHOTO : currentOrder.imageUrl}
                  alt={currentOrder.title}
                  className="w-full h-full object-cover"
                  onError={() => setPhotoFailed(true)}
                />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground leading-tight">Buyer is looking for</p>
                <h3 className="text-sm font-bold leading-snug line-clamp-2 mt-0.5">{currentOrder.title}</h3>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <img src={avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover" />
                  <span className="text-[11px] font-semibold truncate">{currentOrder.buyerName}</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                </div>
                <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3 h-3 shrink-0" />
                  {currentOrder.companyName}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 mt-3">
              <div className="rounded-lg bg-muted/70 px-2 py-1.5">
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Quantity</div>
                <div className="text-[11px] font-bold truncate">{currentOrder.quantity}</div>
              </div>
              <div className="rounded-lg bg-muted/70 px-2 py-1.5">
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground">Product</div>
                <div className="text-[11px] font-bold truncate">{productType}</div>
              </div>
              <div className="rounded-lg bg-muted/70 px-2 py-1.5">
                <div className="text-[9px] uppercase tracking-wide text-muted-foreground flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" /> City
                </div>
                <div className="text-[11px] font-bold truncate">{currentOrder.city.split(',')[0]}</div>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2 leading-snug">
              {currentOrder.message}
            </p>

            <div className="grid grid-cols-[auto_1fr_1.15fr] gap-2 mt-3">
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="h-9 px-2.5 rounded-lg border border-[#FF5A00]/40 bg-[#FF5A00]/10 text-[#FF5A00] text-xs font-bold flex items-center justify-center gap-1 hover:bg-[#FF5A00]/15"
                aria-label="Share this lead"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share
              </button>
              <button
                type="button"
                onClick={() => navigate(leadPath)}
                className="h-9 rounded-lg border border-border bg-background text-xs font-semibold hover:bg-muted"
              >
                View lead
              </button>
              <button
                type="button"
                onClick={handleActionClick}
                className="h-9 rounded-lg bg-[#FF5A00] hover:bg-[#e04f00] text-white text-xs font-bold flex items-center justify-center gap-1"
              >
                Contact
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {shareOpen && (
            <div className="absolute inset-0 z-10 bg-card text-card-foreground flex flex-col">
              <div className="h-1 bg-gradient-to-r from-[#FF5A00] via-amber-400 to-emerald-500" />
              <div className="p-3.5 flex flex-col gap-3 min-h-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold">Share this buy lead</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">The link opens this requirement on BulkSkart.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShareOpen(false)}
                    className="w-7 h-7 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                    aria-label="Close share"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1.5">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[11px] font-medium truncate flex-1" title={shareUrl}>{shareUrl}</span>
                  <button
                    type="button"
                    onClick={copyShareUrl}
                    className="h-7 px-2 rounded-md bg-background border border-border text-[11px] font-bold shrink-0 inline-flex items-center gap-1"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : null}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {shareTargets.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => openShareTarget(target.href)}
                      className={`h-9 rounded-lg text-[11px] font-bold ${target.className}`}
                    >
                      {target.label}
                    </button>
                  ))}
                  <a
                    href={`mailto:?subject=${encodeURIComponent('BulkSkart buy lead')}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`}
                    className="h-9 rounded-lg text-[11px] font-bold bg-muted text-foreground border border-border inline-flex items-center justify-center gap-1"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </a>
                </div>

                {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.share({ title: 'BulkSkart buy lead', text: shareText, url: shareUrl }).catch(() => {});
                    }}
                    className="h-9 rounded-lg border border-border text-xs font-semibold hover:bg-muted"
                  >
                    More apps
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <SubscribeToContactDialog
        open={subDialogOpen}
        onClose={() => setSubDialogOpen(false)}
        reason={subDialogReason}
      />

      {quoteDialogOpen && activeReqForQuote && user && company && (
        <SupplierRespondDialog
          open={quoteDialogOpen}
          onClose={() => setQuoteDialogOpen(false)}
          requirement={activeReqForQuote}
          supplierId={user.id}
          supplierCompanyId={company.id}
          onResponded={() => {
            setQuoteDialogOpen(false);
            toast.success('Your quotation has been sent to the buyer.');
          }}
        />
      )}
    </>
  );
}
