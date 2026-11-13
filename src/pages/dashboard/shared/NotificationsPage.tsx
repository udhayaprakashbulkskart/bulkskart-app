import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { Bell, CheckCheck, Trash2, RefreshCw, Zap, Flame, Target, ArrowRight, Settings, Building2, AlertCircle, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import PageMeta from '@/components/common/PageMeta';
import NotificationPreferencesModal from '@/components/common/NotificationPreferencesModal';
import { extractNotificationDetails } from '@/components/common/NotificationBell';

type NotifType = {
  id: string; title: string; message: string; type: string; is_read: boolean;
  link: string | null; created_at: string; reference_id: string | null;
  reference_type: string | null; urgency_label: string | null;
};

const TYPE_COLORS: Record<string, string> = {
  rfq_matched: 'bg-[#FF5A00]/10 text-orange-700 border-[#FF5A00]/30',
  rfq_match:   'bg-[#FF5A00]/10 text-orange-700 border-[#FF5A00]/30',
  quote_received: 'bg-orange-500/10 text-[#FF5A00] border-[#FF5A00]/30',
  quote_accepted: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  quote_rejected: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  order_status: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  verification: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  subscription: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  product_update: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  dispute: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  deal_status: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  quotation: 'bg-orange-500/10 text-[#FF5A00] border-[#FF5A00]/30',
  info: 'bg-muted text-muted-foreground border-border',
};

function UrgencyBadge({ label }: { label: string | null }) {
  if (!label) return null;
  if (label === 'urgent') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FF5A00]/10 text-[#FF7A2E] border border-[#FF5A00]/40 shrink-0">
      <Flame className="w-2.5 h-2.5" /> URGENT
    </span>
  );
  if (label === 'new') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FF5A00]/10 text-[#FF7A2E] border border-[#FF5A00]/40 shrink-0">
      <Zap className="w-2.5 h-2.5" /> NEW
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
      <Target className="w-2.5 h-2.5" /> MATCHED
    </span>
  );
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<NotifType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrefs, setShowPrefs] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'rfq' | 'message' | 'order' | 'subscription'>('all');
  const unreadCount = notifs.filter(n => !n.is_read).length;

  const fetchNotifs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    const rawList = Array.isArray(data) ? data as NotifType[] : [];
    // Deduplicate notifications by id and by identical title+message
    const deduped = rawList.filter((n, idx, arr) =>
      arr.findIndex(x => x.id === n.id || (x.title === n.title && x.message === n.message)) === idx
    );
    setNotifs(deduped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotifs();
    if (!user) return;
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      supabase.getChannels().forEach((c) => {
        if (c.topic.includes(`notifs-page-${user.id}`)) {
          supabase.removeChannel(c);
        }
      });
      const chName = `notifs-page-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      ch = supabase
        .channel(chName)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => fetchNotifs()
        )
        .subscribe();
    } catch (e) {
      console.warn('Realtime notifications on NotificationsPage skipped:', e);
    }
    return () => { 
      if (ch) supabase.removeChannel(ch); 
    };
  }, [user?.id, fetchNotifs]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const deleteNotif = async (id: string) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifs(prev => prev.filter(n => n.id !== id));
  };

  const handleApplyFast = (n: NotifType) => {
    if (!n.is_read) markRead(n.id);
    const dest = n.link ?? (n.reference_id && n.reference_type === 'requirement' ? `/requirements/${n.reference_id}` : null);
    if (dest) navigate(dest);
  };

  const isRfqMatch = (type: string) => type === 'rfq_matched' || type === 'rfq_match';

  if (loading) return (
    <DashboardLayout>
      <PageMeta title="Notifications | BulkSkart" description="BulkSkart dashboard notifications." robots="noindex, nofollow" />
      <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <PageMeta title="Notifications | BulkSkart" description="BulkSkart dashboard notifications." robots="noindex, nofollow" />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <Badge className="bg-[#1A0C05] text-primary-foreground">{unreadCount} new</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead} className="gap-1 h-8 text-xs">
                <CheckCheck className="w-3.5 h-3.5" /> Mark all read
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPrefs(true)}
              className="gap-1.5 h-8 text-xs border-border"
            >
              <Settings className="w-3.5 h-3.5" /> Preferences
            </Button>
          </div>
        </div>

        {/* RFQ match summary banner */}
        {notifs.filter(n => isRfqMatch(n.type) && !n.is_read).length > 0 && (
          <div className="flex items-start gap-3 bg-[#FF5A00]/10 border border-[#FF5A00]/30 rounded-xl px-4 py-3">
            <Flame className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orange-800">
                {notifs.filter(n => isRfqMatch(n.type) && !n.is_read).length} new buyer requirement{notifs.filter(n => isRfqMatch(n.type) && !n.is_read).length > 1 ? 's' : ''} match your business
              </p>
              <p className="text-xs text-orange-700 mt-0.5">Review and apply fast — buyers are waiting for quotes.</p>
            </div>
          </div>
        )}

        {/* AI Sales Assistant Banner */}
        <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-[#C94400]/15 via-orange-500/10 to-[#FF5A00]/5 border-2 border-[#FF5A00]/30 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FF5A00]/20 text-[#FF5A00] flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                <span>AI Sales Assistant Matching Engine</span>
                <span className="text-[10px] font-mono font-bold bg-[#FF5A00]/20 text-[#FF5A00] px-2 py-0.2 rounded-full">
                  Automated
                </span>
              </h4>
              <p className="text-[11px] text-muted-foreground truncate">
                Real-time RFQ matching, AI Match Scores, and 1-click quotation drafts
              </p>
            </div>
          </div>
          <Link to="/dashboard/supplier/ai-assistant" className="shrink-0 ml-2">
            <Button size="sm" className="bg-[#C94400] hover:bg-[#B33D00] text-white font-bold text-xs h-8 px-3 rounded-xl gap-1">
              <span>View Matches</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar scroll-smooth">
          {[
            { id: 'all', label: 'All', count: notifs.length },
            { id: 'rfq', label: 'RFQs & Quotes', count: notifs.filter(n => isRfqMatch(n.type) || n.type === 'quote_received' || n.type === 'quotation').length },
            { id: 'message', label: 'Messages', count: notifs.filter(n => n.type === 'message').length },
            { id: 'order', label: 'Orders', count: notifs.filter(n => n.type === 'order_status' || n.type === 'deal_status').length },
            { id: 'subscription', label: 'Subscription', count: notifs.filter(n => n.type === 'subscription').length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as typeof filterTab)}
              className={`px-3 py-1.5 rounded-full font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                filterTab === tab.id
                  ? 'bg-[#C94400] text-primary-foreground shadow-sm'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  filterTab === tab.id ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-background text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {notifs.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>No notifications yet</p>
            </CardContent>
          </Card>
        ) : notifs.filter(n => {
            if (filterTab === 'all') return true;
            if (filterTab === 'rfq') return isRfqMatch(n.type) || n.type === 'quote_received' || n.type === 'quotation';
            if (filterTab === 'message') return n.type === 'message';
            if (filterTab === 'order') return n.type === 'order_status' || n.type === 'deal_status';
            if (filterTab === 'subscription') return n.type === 'subscription';
            return true;
          }).length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 text-muted-foreground">
              <p className="text-sm font-medium">No notifications in this category</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifs
              .filter(n => {
                if (filterTab === 'all') return true;
                if (filterTab === 'rfq') return isRfqMatch(n.type) || n.type === 'quote_received' || n.type === 'quotation';
                if (filterTab === 'message') return n.type === 'message';
                if (filterTab === 'order') return n.type === 'order_status' || n.type === 'deal_status';
                if (filterTab === 'subscription') return n.type === 'subscription';
                return true;
              })
              .map(n => {
                const { companyName, isUrgent } = extractNotificationDetails(n);
                return (
                  <div
                    key={n.id}
                    className={`rounded-xl border flex items-start gap-3 transition-colors hover:bg-muted/40 ${
                      !n.is_read ? 'bg-primary/5 border-primary/20' : 'bg-card border-border'
                    } ${isUrgent ? 'border-l-4 border-l-[#FF5A00]/40 bg-[#FF5A00]/[0.02]' : ''}`}
                  >
                    <div
                      className="flex-1 min-w-0 p-3.5 cursor-pointer"
                      onClick={() => { if (!n.is_read) markRead(n.id); }}
                    >
                      {/* Top Bar: Company Name & Type & Urgency */}
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex text-[10px] font-bold px-2 py-0.5 rounded border ${TYPE_COLORS[n.type] ?? TYPE_COLORS.info}`}>
                            {n.type === 'rfq_matched' || n.type === 'rfq_match' ? 'RFQ MATCH' : n.type.replace(/_/g, ' ').toUpperCase().slice(0, 12)}
                          </span>
                          {companyName && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded-md border border-border/50">
                              <Building2 className="w-3.5 h-3.5 text-primary" />
                              {companyName}
                            </span>
                          )}
                          {isUrgent && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-[#B33D00] text-white shadow-xs animate-pulse">
                              🚨 URGENT
                            </span>
                          )}
                          {isRfqMatch(n.type) && !isUrgent && <UrgencyBadge label={n.urgency_label} />}
                          {n.type === 'subscription' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#FF5A00]/10 text-[#FF7A2E] border border-[#FF5A00]/40">
                              ⚡ ACTION REQUIRED
                            </span>
                          )}
                        </div>
                        {!n.is_read && <span className="w-2.5 h-2.5 rounded-full bg-[#C94400] shrink-0" />}
                      </div>

                      {/* Title */}
                      <p className={`text-sm font-bold leading-snug mb-1.5 ${!n.is_read ? 'text-foreground' : 'text-foreground/80'}`}>
                        {n.title}
                      </p>

                      {/* Message — clearly highlighted and formatted */}
                      <div className="bg-muted/40 rounded-lg p-2.5 border border-border/50 mb-2">
                        <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed font-normal">
                          {n.message}
                        </p>
                      </div>

                      <p className="text-[11px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>

                  {/* CTAs */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {isRfqMatch(n.type) && (n.link || n.reference_id) && (
                      <Button
                        size="sm"
                        className="h-7 text-xs px-3 bg-[#C94400] hover:bg-primary/90 text-primary-foreground gap-1 font-bold"
                        onClick={e => { e.stopPropagation(); handleApplyFast(n); }}
                      >
                        Apply Fast <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                    {n.type === 'subscription' && (
                      <Link
                        to="/pricing"
                        onClick={e => { e.stopPropagation(); if (!n.is_read) markRead(n.id); }}
                      >
                        <Button size="sm" className="h-7 text-xs px-3 bg-gradient-to-r from-[#C94400] to-orange-500 hover:from-[#C94400] hover:to-orange-600 text-white font-bold gap-1 shadow-sm">
                          Upgrade Now <ArrowRight className="w-3 h-3" />
                        </Button>
                      </Link>
                    )}
                    {n.link && !isRfqMatch(n.type) && n.type !== 'subscription' && (
                      <Link
                        to={n.link}
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold"
                        onClick={e => { e.stopPropagation(); if (!n.is_read) markRead(n.id); }}
                      >
                        View Details <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                </div>

                {/* Delete */}
                <button
                  onClick={e => { e.stopPropagation(); deleteNotif(n.id); }}
                  className="shrink-0 p-3 text-muted-foreground hover:text-[#FF7A2E] transition-colors"
                  aria-label="Delete notification"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          </div>
        )}
      </div>
      <NotificationPreferencesModal open={showPrefs} onOpenChange={setShowPrefs} />
    </DashboardLayout>
  );
}
