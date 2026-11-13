import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Filter, ChevronRight, Eye, RefreshCw, FileText, CheckCircle2, ArrowLeft, Package, Plus, LogIn, UserPlus } from 'lucide-react';
import SafeImage from '@/components/common/SafeImage';
import SubmitQuotationWizard from '@/components/rfq/SubmitQuotationWizard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';

interface QuotationItem {
  id: string;
  rfqId: string;
  title: string;
  unitPrice: number;
  quantity: number;
  unit: string;
  totalValue: number;
  leadDays: number;
  status: 'active' | 'closed' | 'awarded';
  endSecondsRemaining: number;
  image: string;
}

function formatTimer(sec: number) {
  if (sec <= 0) return '00:00:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function MyQuotationsPage() {
  const { user, profile, company } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'all' | 'live' | 'closed' | 'awarded'>('all');
  const [quotations, setQuotations] = useState<QuotationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timers, setTimers] = useState<Record<string, number>>({});

  // Selected quotation for revision
  const [reviseRfq, setReviseRfq] = useState<any | null>(null);

  // Fetch real quotations from database for the authenticated user
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchMyQuotes = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from('quotations')
          .select('*, requirements(title, quantity, quantity_unit, destination_country, images), companies:supplier_company_id(company_name)')
          .order('created_at', { ascending: false });

        if (company?.id) {
          query = query.or(`supplier_company_id.eq.${company.id},supplier_id.eq.${user.id},buyer_id.eq.${user.id}`);
        } else {
          query = query.or(`supplier_id.eq.${user.id},buyer_id.eq.${user.id}`);
        }

        const { data, error } = await query;
        if (error) {
          console.error('Error fetching quotations:', error);
          setQuotations([]);
        } else if (Array.isArray(data)) {
          const mapped: QuotationItem[] = data.map((q: any) => {
            const rawStatus = (q.status || 'pending').toLowerCase();
            const status: 'active' | 'closed' | 'awarded' =
              rawStatus === 'accepted' || rawStatus === 'awarded'
                ? 'awarded'
                : rawStatus === 'rejected' || rawStatus === 'closed'
                ? 'closed'
                : 'active';

            const qty = Number(q.quantity || q.requirements?.quantity) || 1;
            const unitPrice = Number(q.unit_price) || 0;
            const total = Number(q.total_price) || (unitPrice * qty);

            return {
              id: q.id,
              rfqId: q.requirement_id ? `RFQ-${q.requirement_id.slice(0, 8).toUpperCase()}` : 'BS-RFQ',
              title: q.requirements?.title || 'Quotation for Buyer Requirement',
              unitPrice,
              quantity: qty,
              unit: q.moq_unit || q.requirements?.quantity_unit || 'units',
              totalValue: total,
              leadDays: Number(q.delivery_days) || 7,
              status,
              endSecondsRemaining: 3600 * 24,
              image: q.requirements?.images?.[0] || 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=75'
            };
          });

          setQuotations(mapped);
          const initialTimers: Record<string, number> = {};
          mapped.forEach(item => { initialTimers[item.id] = item.endSecondsRemaining; });
          setTimers(initialTimers);
        }
      } catch (err) {
        console.error('Failed to load quotations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMyQuotes();
  }, [user?.id, company?.id]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimers(prev => {
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
          next[k] = Math.max(0, v - 1);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredQuotes = quotations.filter(q => {
    if (tab === 'all') return true;
    if (tab === 'live') return q.status === 'active';
    if (tab === 'closed') return q.status === 'closed';
    if (tab === 'awarded') return q.status === 'awarded';
    return true;
  });

  return (
    <MainLayout>
      <div className="bg-background min-h-screen pb-20">
        
        {/* Top Header */}
        <div className="bg-card border-b border-border sticky top-0 z-20 px-4 py-3 sm:px-6">
          <div className="max-w-[1200px] mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate(-1)}
                className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-base sm:text-lg font-bold text-foreground">
                My Quotations
              </h1>
            </div>
            {user && (
              <button className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground">
                <Filter className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {!user ? (
          <div className="max-w-md mx-auto px-4 py-16 text-center">
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-[#FF5A00]/10 flex items-center justify-center mx-auto mb-4 text-[#FF5A00]">
                <FileText className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">
                Sign in to View Quotations
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mb-6">
                Access your submitted bids, track real-time buyer negotiation updates, and manage awarded contracts securely.
              </p>

              <div className="space-y-2.5">
                <Link to="/login?redirect=/my-quotations" className="block w-full">
                  <Button
                    variant="secondary"
                    className="w-full bg-muted/80 hover:bg-muted border border-border text-foreground font-bold h-11 rounded-xl text-sm flex items-center justify-center gap-2"
                  >
                    <LogIn className="w-4 h-4 text-[#FF5A00]" />
                    <span>Sign In</span>
                  </Button>
                </Link>

                <Link to="/register?redirect=/my-quotations" className="block w-full">
                  <Button
                    className="w-full bg-[#C94400] hover:bg-[#B33D00] text-white font-bold h-11 rounded-xl text-sm shadow-[0_2px_0_#922f00] flex items-center justify-center gap-2"
                  >
                    <UserPlus className="w-4 h-4 text-white" />
                    <span>Create Free Account</span>
                  </Button>
                </Link>
              </div>

              <p className="text-[11px] text-muted-foreground mt-4 font-medium">
                No payment required to create an account
              </p>
            </div>
          </div>
        ) : loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-6 h-6 text-[#FF5A00] animate-spin" />
            <p className="text-sm text-muted-foreground">Loading your quotations...</p>
          </div>
        ) : (
          <div className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-4">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 mb-4">
              <button
                onClick={() => setTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  tab === 'all'
                    ? 'bg-[#C94400] text-white shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                All ({quotations.length})
              </button>
              <button
                onClick={() => setTab('live')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                  tab === 'live'
                    ? 'bg-[#C94400] text-white shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Live ({quotations.filter(q => q.status === 'active').length})
              </button>
              <button
                onClick={() => setTab('closed')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  tab === 'closed'
                    ? 'bg-[#C94400] text-white shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Closed ({quotations.filter(q => q.status === 'closed').length})
              </button>
              <button
                onClick={() => setTab('awarded')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                  tab === 'awarded'
                    ? 'bg-[#C94400] text-white shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Awarded ({quotations.filter(q => q.status === 'awarded').length})
              </button>
            </div>

            {filteredQuotes.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 sm:p-12 text-center my-6">
                <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                <h3 className="text-base font-bold text-foreground mb-1">No Quotations Found</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                  {tab === 'all'
                    ? "You haven't submitted or received any quotations yet. Browse active buyer requirements to start quoting and winning contracts."
                    : `No ${tab} quotations found.`}
                </p>
                <Link to="/requirements">
                  <Button className="bg-[#C94400] hover:bg-[#B33D00] text-white font-bold h-10 px-5 rounded-xl text-xs shadow-[0_2px_0_#922f00]">
                    Browse Reverse RFQs
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredQuotes.map(q => {
                  const sec = timers[q.id] ?? q.endSecondsRemaining;
                  const timerStr = formatTimer(sec);

                  return (
                    <div
                      key={q.id}
                      className="bg-card border border-border hover:border-[#FF5A1F]/50 rounded-2xl p-3.5 sm:p-4 shadow-sm transition-all"
                    >
                      <div className="flex gap-3 sm:gap-4">
                        {/* Thumbnail */}
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-muted shrink-0">
                          <SafeImage
                            src={q.image}
                            alt={q.title}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        {/* Meta info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xs sm:text-sm font-bold text-foreground line-clamp-1">
                            {q.title}
                          </h3>
                          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            RFQ ID: {q.rfqId}
                          </p>

                          {/* Status Badge + Countdown Timer */}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {q.status === 'active' ? (
                              <>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#B33D00] text-white">
                                  LIVE
                                </span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FF5A00]/10 dark:bg-[#B33D00]/40 text-[#FF7A2E] dark:text-[#FF7A2E] border border-[#FF5A00]/40 dark:border-[#FF5A00]/40">
                                  <Clock className="w-3 h-3" />
                                  {timerStr}
                                </span>
                              </>
                            ) : q.status === 'awarded' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#B33D00] text-white">
                                AWARDED
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground">
                                CLOSED
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Financial Stats Bar */}
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/60 text-center">
                        <div>
                          <span className="text-[10px] text-muted-foreground font-medium block">Your Quotation</span>
                          <span className="text-xs font-bold text-foreground">₹{q.unitPrice.toFixed(2)} / {q.unit}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground font-medium block">Total Value</span>
                          <span className="text-xs font-bold text-[#FF5A1F]">₹{q.totalValue.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground font-medium block">Lead Time</span>
                          <span className="text-xs font-bold text-foreground">{q.leadDays} days</span>
                        </div>
                      </div>

                      {/* Card Action Controls */}
                      <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-border/40">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF7A2E] dark:text-[#FF7A2E] bg-[#FF5A00]/10 dark:bg-[#B33D00]/40 px-2 py-1 rounded-lg">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {q.status === 'awarded' ? 'Contract Awarded' : q.status === 'closed' ? 'Concluded' : 'Active'}
                        </span>

                        <div className="flex items-center gap-2">
                          {q.status === 'active' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setReviseRfq({
                                  id: q.id,
                                  reqNumber: q.rfqId,
                                  title: q.title,
                                  quantity: q.quantity,
                                  quantityUnit: q.unit,
                                  targetPriceMin: q.unitPrice * 0.9,
                                  targetPriceMax: q.unitPrice * 1.1,
                                  endSecondsRemaining: sec
                                });
                              }}
                              className="h-8 px-3 rounded-xl text-xs font-bold border-[#FF5A1F] text-[#FF5A1F] hover:bg-[#B33D00]/10"
                            >
                              Revise
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate('/requirements')}
                            className="h-8 px-3 rounded-xl text-xs font-bold"
                          >
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Revise Quotation Modal */}
        {reviseRfq && (
          <SubmitQuotationWizard
            open={!!reviseRfq}
            onOpenChange={open => !open && setReviseRfq(null)}
            rfq={reviseRfq}
            onSuccess={() => {
              setReviseRfq(null);
            }}
          />
        )}

      </div>
    </MainLayout>
  );
}
