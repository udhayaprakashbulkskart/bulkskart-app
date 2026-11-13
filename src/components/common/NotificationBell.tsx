import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Bell,
  MessageSquare,
  Package,
  CreditCard,
  CheckCheck,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Inbox,
  Flame,
  Settings,
  Building2,
  ArrowRight,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import NotificationPreferencesModal from '@/components/common/NotificationPreferencesModal';
import { generateAIMatchNotifications, type AIMatchNotification } from '@/lib/aiSalesAssistant';
import { getRequirements } from '@/lib/api';
import { Link } from 'react-router-dom';

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
  reference_id?: string | null;
  reference_type?: string | null;
  urgency_label?: string | null;
  company_name?: string | null;
  is_urgent?: boolean | null;
}

/**
 * Extracts and clarifies Company Name and Urgency from a notification
 */
export function extractNotificationDetails(item: {
  title?: string;
  message?: string;
  type?: string;
  urgency_label?: string | null;
  company_name?: string | null;
  is_urgent?: boolean | null;
}) {
  let companyName = (item.company_name || '').trim();
  const title = (item.title || '').trim();
  const message = (item.message || '').trim();

  // 1. Detect Urgency
  let isUrgent = item.is_urgent === true || item.urgency_label === 'urgent' || item.urgency_label === 'high';
  const combinedText = `${title} ${message}`.toLowerCase();
  if (!isUrgent && /\b(urgent|asap|emergency|immediate|rush|priority)\b/i.test(combinedText)) {
    isUrgent = true;
  }

  // 2. Detect Company Name if not directly present in record
  if (!companyName) {
    const fromMatch = title.match(/(?:from|by)\s+([A-Za-z0-9\s&.,'-]+?)(?:\s*(?:[-–—:|]|$))/i);
    if (fromMatch && fromMatch[1] && fromMatch[1].trim().length > 1) {
      const candidate = fromMatch[1].trim();
      if (!['a buyer', 'a supplier', 'system', 'admin', 'the buyer', 'the supplier'].includes(candidate.toLowerCase())) {
        companyName = candidate;
      }
    }
  }
  if (!companyName) {
    const bracketMatch = title.match(/\[([A-Za-z0-9\s&.,'-]+)\]/);
    if (bracketMatch && bracketMatch[1]) {
      companyName = bracketMatch[1].trim();
    }
  }
  if (!companyName) {
    const msgPrefixMatch = message.match(/^([A-Za-z0-9\s&.,'-]{2,40}):\s+/);
    if (msgPrefixMatch && msgPrefixMatch[1]) {
      companyName = msgPrefixMatch[1].trim();
    }
  }

  return { companyName, isUrgent };
}

interface NotificationBellProps {
  className?: string;
}

export default function NotificationBell({ className }: NotificationBellProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const [showPrefs, setShowPrefs] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { prefs, isTypeAllowed } = useNotificationPreferences();
  const [aiMatchNotifs, setAiMatchNotifs] = useState<AIMatchNotification[]>([]);

  const isSupplier = profile?.role === 'supplier' || (profile?.role as any) === 'manufacturer';
  const notifUrl = isSupplier ? '/dashboard/supplier/notifications' : '/dashboard/buyer/notifications';

  // Load AI matching requirement notifications for suppliers
  useEffect(() => {
    if (user && isSupplier) {
      supabase
        .from('products')
        .select('*')
        .eq('seller_id', user.id)
        .then(async ({ data: products }) => {
          if (products && products.length > 0) {
            const reqs = await getRequirements({ status: 'active' });
            const notifs = generateAIMatchNotifications(products as any, reqs);
            setAiMatchNotifs(notifs);
          } else {
            setAiMatchNotifs([]);
          }
        });
    }
  }, [user, isSupplier]);

  // ── Load unread count & recent notifications ──────────────────────────────
  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8);

      if (!error && data) {
        const raw = data as NotificationItem[];
        const deduped = raw.filter((n, idx, arr) =>
          arr.findIndex(x => x.id === n.id || (x.title === n.title && x.message === n.message)) === idx
        );
        setNotifications(deduped);
        const unread = deduped.filter((n) => !n.is_read).length;
        // Also fetch total unread if there are more
        const { count: totalUnread } = await supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_read', false);
        setUnreadCount(totalUnread ?? unread);
      }
    } catch (err) {
      console.warn('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── Check unpaid supplier status & notify on session start ───────────────
  useEffect(() => {
    if (user && isSupplier) {
      // Trigger automated check for unpaid manufacturer notification
      supabase
        .rpc('notify_unpaid_manufacturers')
        .then(({ data }) => {
          if (data && typeof data === 'number' && data > 0) {
            loadNotifications();
          }
        }, () => {});
    }
  }, [user, isSupplier, loadNotifications]);

  // ── Realtime subscription for incoming live notifications ─────────────────
  useEffect(() => {
    if (!user) return;

    loadNotifications();

    let channel: ReturnType<typeof supabase.channel> | null = null;

    try {
      // Remove any existing channels for this user to prevent subscription collisions
      supabase.getChannels().forEach((ch) => {
        if (ch.topic.includes(`user-notifs-${user.id}`)) {
          supabase.removeChannel(ch);
        }
      });

      const channelName = `user-notifs-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotif = payload.new as NotificationItem;

            // Check if category is enabled in user preferences
            if (!isTypeAllowed(newNotif.type)) {
              // Still update count and list silently without audio/toast
              setUnreadCount((c) => c + 1);
              setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id).slice(0, 7)]);
              return;
            }

            // Sound effect chime (if enabled in preferences)
            if (prefs.soundEnabled) {
              try {
                const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
                gain.gain.setValueAtTime(0.08, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.35);
              } catch {
                // AudioContext not permitted or unsupported
              }
            }

            // Live interactive notification toast alert (if enabled in preferences)
            if (prefs.toastEnabled) {
              const { companyName, isUrgent } = extractNotificationDetails(newNotif);

              toast.custom((t) => (
                <div
                  className={`w-full max-w-[380px] sm:max-w-md p-4 rounded-xl shadow-2xl border transition-all ${
                    isUrgent
                      ? 'bg-card border-[#FF5A00]/80 ring-2 ring-[#FF5A00]/40 shadow-[#FF5A00]/10'
                      : 'bg-card border-border shadow-xl'
                  }`}
                >
                  {/* Top Bar: Company Name & URGENT Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border/70">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isUrgent ? 'bg-[#FF5A00]/20 text-[#FF7A2E]' : 'bg-primary/10 text-primary'
                      }`}>
                        {isUrgent ? (
                          <AlertCircle className="w-4 h-4 text-[#FF7A2E] animate-pulse" />
                        ) : (
                          <Building2 className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          Company / Partner
                        </span>
                        <span className="text-xs font-bold text-foreground truncate block">
                          {companyName || 'Verified BulkSkart Partner'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isUrgent && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#B33D00] text-white shadow-sm animate-pulse">
                          🚨 URGENT
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">Just now</span>
                    </div>
                  </div>

                  {/* Title & Message clearly displayed */}
                  <div className="space-y-1.5">
                    <h4 className="text-xs sm:text-sm font-bold text-foreground leading-snug">
                      {newNotif.title}
                    </h4>
                    <div className="bg-muted/40 rounded-lg p-2.5 border border-border/50">
                      <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed font-normal">
                        {newNotif.message}
                      </p>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 mt-3 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2.5 text-muted-foreground hover:text-foreground"
                      onClick={() => toast.dismiss(t)}
                    >
                      Dismiss
                    </Button>
                    {newNotif.link && (
                      <Button
                        size="sm"
                        className={`h-7 text-xs px-3 font-bold gap-1 shadow-sm ${
                          isUrgent
                            ? 'bg-[#B33D00] hover:bg-[#B33D00] text-white'
                            : 'bg-[#C94400] hover:bg-primary/90 text-primary-foreground'
                        }`}
                        onClick={() => {
                          toast.dismiss(t);
                          markAsRead(newNotif.id);
                          navigate(newNotif.link!);
                        }}
                      >
                        View Details <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ), { duration: isUrgent ? 14000 : 9000 });
            }

            // Increment count & prepend
            setUnreadCount((c) => c + 1);
            setNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id).slice(0, 7)]);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const updated = payload.new as NotificationItem;
            setNotifications((prev) =>
              prev.map((n) => (n.id === updated.id ? updated : n))
            );
            if (updated.is_read) {
              setUnreadCount((c) => Math.max(0, c - 1));
            }
          }
        )
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            if (channel) {
              supabase.removeChannel(channel);
            }
          }
        });
    } catch (err) {
      console.warn('Realtime notifications subscription skipped, using polling fallback:', err);
    }

    // Fallback polling every 60 seconds to ensure count stays fresh even if WebSocket is disconnected
    const pollingInterval = setInterval(() => {
      loadNotifications();
    }, 60000);

    return () => {
      clearInterval(pollingInterval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [user?.id, navigate]);

  // ── Mark single notification as read ─────────────────────────────────────
  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (e) {
      console.warn('Failed to mark notification read:', e);
    }
  };

  // ── Mark all as read ─────────────────────────────────────────────────────
  const markAllAsRead = async () => {
    if (!user) return;
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleClickItem = (item: NotificationItem) => {
    if (!item.is_read) {
      markAsRead(item.id);
    }
    setOpen(false);
    if (item.link) {
      navigate(item.link);
    } else {
      navigate(notifUrl);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-4 h-4 text-[#FF7A2E]" />;
      case 'quote_received':
      case 'quotation':
        return <Package className="w-4 h-4 text-[#FF5A00]" />;
      case 'subscription':
        return <CreditCard className="w-4 h-4 text-[#FF7A2E]" />;
      case 'rfq_matched':
      case 'rfq_match':
        return <Flame className="w-4 h-4 text-orange-400" />;
      default:
        return <Bell className="w-4 h-4 text-primary" />;
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`h-9 w-9 text-muted-foreground hover:text-foreground relative ${className || ''}`}
          aria-label={`Notifications (${unreadCount} unread)`}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#C94400] text-white text-[10px] font-black flex items-center justify-center shadow-md animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[340px] sm:w-[380px] p-0 bg-popover/98 border border-border shadow-2xl rounded-2xl overflow-hidden backdrop-blur-xl z-50"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-foreground">Notifications</span>
            {unreadCount > 0 ? (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#C94400] text-primary-foreground">
                {unreadCount} new
              </span>
            ) : (
              <span className="text-[11px] font-medium text-muted-foreground">Up to date</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllAsRead}
                className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setOpen(false);
                setShowPrefs(true);
              }}
              className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
              title="Notification Preferences"
              aria-label="Notification Preferences"
            >
              <Settings className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="max-h-[420px] overflow-y-auto divide-y divide-border/50">
          {/* AI Sales Assistant Banner for Suppliers/Manufacturers */}
          {isSupplier && (
            <div className="p-2.5 bg-gradient-to-r from-[#C94400]/15 via-orange-500/10 to-[#FF5A00]/5 border-b border-[#FF5A00]/25 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-[#FF5A00]/20 text-[#FF5A00]">
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                <span className="text-xs font-bold text-foreground">AI Sales Assistant</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  navigate('/dashboard/supplier/ai-assistant');
                }}
                className="text-[11px] font-bold text-[#FF5A00] hover:underline flex items-center gap-1"
              >
                <span>Open Dashboard</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* AI MATCH NOTIFICATIONS (Prompt Requirement) */}
          {isSupplier && aiMatchNotifs.map((n) => (
            <div
              key={n.id}
              className="p-3.5 bg-[#FF5A00]/[0.04] border-l-4 border-l-[#FF5A00] hover:bg-[#B33D00]/[0.08] transition-colors cursor-pointer space-y-2"
              onClick={() => {
                setOpen(false);
                navigate(n.ctaLink);
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-sm">🔔</span>
                  <span className="text-xs font-bold text-foreground truncate">
                    {n.title}
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase shrink-0 ${
                  n.priority === 'high' ? 'bg-[#FF5A00]/20 text-[#FF7A2E]' : 'bg-[#FF5A00]/20 text-[#FF7A2E]'
                }`}>
                  {n.priority} Priority
                </span>
              </div>

              {/* Specs Grid: Product, Location, Qty, Price, Timeline, Match % */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px] bg-card/60 p-2 rounded-lg border border-border/50">
                <div className="truncate">
                  <span className="text-muted-foreground">Product:</span>{' '}
                  <strong className="text-foreground">{n.productName}</strong>
                </div>
                <div className="truncate">
                  <span className="text-muted-foreground">Location:</span>{' '}
                  <strong className="text-foreground">{n.buyerLocation}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Qty:</span>{' '}
                  <strong className="text-foreground">{n.quantity}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Exp. Price:</span>{' '}
                  <strong className="text-[#FF5A00]">{n.expectedPrice}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Timeline:</span>{' '}
                  <strong className="text-foreground">{n.deliveryTimeline}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Match:</span>{' '}
                  <strong className="text-[#FF7A2E] font-mono font-bold">{n.matchPercentage}%</strong>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-[10px] text-muted-foreground">{n.createdAt}</span>
                <span className="text-[11px] font-bold text-[#FF5A00] flex items-center gap-1">
                  <span>View Requirement</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}

          {loading && notifications.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">Loading notifications…</div>
          ) : notifications.length === 0 ? (
            <div className="py-10 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-muted mx-auto flex items-center justify-center mb-2.5 text-muted-foreground">
                <Inbox className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold text-foreground">No notifications yet</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Real-time alerts for RFQs, quotations, and chat messages will appear here.
              </p>
            </div>
          ) : (
            notifications.map((item) => {
              const { companyName, isUrgent } = extractNotificationDetails(item);
              return (
                <div
                  key={item.id}
                  onClick={() => handleClickItem(item)}
                  className={`p-3.5 cursor-pointer transition-colors hover:bg-muted/60 ${
                    !item.is_read ? 'bg-primary/[0.04]' : ''
                  } ${isUrgent ? 'border-l-4 border-l-[#FF5A00]/40 bg-[#FF5A00]/[0.03]' : ''}`}
                >
                  {/* Header: Company Name & Urgent badge */}
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${
                        isUrgent ? 'bg-[#FF5A00]/15 text-[#FF7A2E]' : 'bg-muted border border-border'
                      }`}>
                        {getNotifIcon(item.type)}
                      </div>
                      <span className="text-[11px] font-bold text-foreground truncate flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                        {companyName || (item.type === 'message' || item.type === 'chat' ? 'Direct Message' : 'BulkSkart Partner')}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isUrgent && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-[#B33D00] text-white shadow-xs animate-pulse">
                          🚨 URGENT
                        </span>
                      )}
                      {!item.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#C94400] shrink-0" />
                      )}
                    </div>
                  </div>

                  {/* Title */}
                  <p className={`text-xs ${!item.is_read ? 'font-bold text-foreground' : 'font-medium text-foreground/80'} mb-1`}>
                    {item.title}
                  </p>

                  {/* Message clearly displayed */}
                  <div className="bg-muted/40 rounded-md p-2 border border-border/40 mb-1.5">
                    <p className="text-[11px] text-foreground/90 whitespace-pre-line leading-relaxed font-normal">
                      {item.message}
                    </p>
                  </div>

                  {/* Footer info: time & action */}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    {item.link && (
                      <span className="text-primary hover:underline font-medium inline-flex items-center gap-0.5">
                        Open <ChevronRight className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-muted/30 border-t border-border flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              navigate(notifUrl);
            }}
            className="w-full h-8 text-xs font-semibold text-primary hover:text-primary/90 justify-center gap-1.5"
          >
            <span>View All Notifications</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </DropdownMenuContent>
      <NotificationPreferencesModal open={showPrefs} onOpenChange={setShowPrefs} />
    </DropdownMenu>
  );
}
