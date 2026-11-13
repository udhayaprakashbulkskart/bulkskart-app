import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { getRequirements, updateRequirement, getQuotationsForRequirement } from '@/lib/api';
import type { Requirement, Quotation } from '@/types/types';
import { toast } from 'sonner';
import {
  FileText, Plus, Search, Eye, XCircle, RefreshCw,
  Clock, MessageSquare, Package, CheckCircle, ShieldCheck,
  TrendingUp, ChevronRight, Zap, BarChart3,
} from 'lucide-react';
import InstantQuoteDialog from '@/components/common/InstantQuoteDialog';
import RFQMatchResultsPanel from '@/components/common/RFQMatchResultsPanel';

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'text-green-400 border-green-400/30 bg-green-400/10',
    closed: 'text-muted-foreground border-border bg-muted',
    expired: 'text-destructive border-destructive/30 bg-destructive/10',
  };
  return (
    <Badge variant="outline" className={`text-xs capitalize ${styles[status] ?? ''}`}>
      {status}
    </Badge>
  );
}

export default function BuyerRequirementsOverviewPage() {
  const { user } = useAuth();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedReq, setSelectedReq] = useState<Requirement | null>(null);
  const [reqQuotes, setReqQuotes] = useState<Quotation[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [instantQuoteProduct, setInstantQuoteProduct] = useState<{ id: string; name: string; supplierCompanyId: string; supplierName: string } | null>(null);

  const fetchAll = () => {
    if (!user) {
      setRequirements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = new Promise<Requirement[]>((resolve) => setTimeout(() => resolve([]), 12000));
    Promise.race([
      getRequirements({ buyerId: user.id, status: 'all' }),
      timeout,
    ])
      .then((data) => {
        setRequirements(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.warn('Failed to load requirements:', err);
        setRequirements([]);
        toast.error('Could not load requirements. Please refresh.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchAll(); }, [user]);

  const handleClose = async (id: string) => {
    await updateRequirement(id, { status: 'closed' });
    toast.success('Requirement closed.');
    fetchAll();
  };

  const handleRepost = async (req: Requirement) => {
    const { createRequirement } = await import('@/lib/api');
    const { error } = await createRequirement({
      buyer_id: user!.id,
      title: `${req.title} (Repost)`,
      description: req.description,
      category_id: req.category_id,
      quantity: req.quantity,
      quantity_unit: req.quantity_unit,
      destination_country: req.destination_country,
      destination_city: req.destination_city,
      specifications: req.specifications,
      status: 'active',
    });
    if (error) toast.error(error);
    else { toast.success('Requirement reposted!'); fetchAll(); }
  };

  const openDetail = async (req: Requirement) => {
    setSelectedReq(req);
    setQuotesLoading(true);
    const quotes = await getQuotationsForRequirement(req.id);
    setReqQuotes(quotes);
    setQuotesLoading(false);
  };

  const handleAcceptQuote = async (quoteId: string) => {
    const { updateQuotationStatus } = await import('@/lib/api');
    await updateQuotationStatus(quoteId, 'accepted');
    toast.success('Quote accepted!');
    if (selectedReq) {
      const updated = await getQuotationsForRequirement(selectedReq.id);
      setReqQuotes(updated);
    }
  };

  const handleRejectQuote = async (quoteId: string) => {
    const { updateQuotationStatus } = await import('@/lib/api');
    await updateQuotationStatus(quoteId, 'rejected');
    toast.success('Quote rejected.');
    if (selectedReq) {
      const updated = await getQuotationsForRequirement(selectedReq.id);
      setReqQuotes(updated);
    }
  };

  const stats = useMemo(() => {
    const active = requirements.filter(r => r.status === 'active');
    const closed = requirements.filter(r => r.status === 'closed' || r.status === 'expired');
    const totalQuotes = requirements.reduce((a, r) => a + (r.quote_count ?? 0), 0);
    return { total: requirements.length, active: active.length, closed: closed.length, totalQuotes };
  }, [requirements]);

  const filtered = useMemo(() => {
    let list = requirements.filter(r => {
      const ms = r.title.toLowerCase().includes(search.toLowerCase());
      const mf = statusFilter === 'all' || r.status === statusFilter;
      return ms && mf;
    });
    if (sortBy === 'most_quotes') list = [...list].sort((a, b) => (b.quote_count ?? 0) - (a.quote_count ?? 0));
    else if (sortBy === 'deadline') list = [...list].sort((a, b) => {
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    });
    return list;
  }, [requirements, search, statusFilter, sortBy]);

  return (
    <DashboardLayout>
      <PageMeta
        title="Requirements Overview — Buyer | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto space-y-6">

          {/* Header */}
          <div className="bs-glass flex items-start justify-between flex-wrap gap-3 rounded-3xl p-4">
            <div>
              <h1 className="text-xl font-black text-foreground">Requirements Overview</h1>
              <p className="text-sm text-muted-foreground">Manage all your posted bulk requirements</p>
            </div>
            <Link to="/post-requirement">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 text-sm shrink-0">
                <Plus className="w-4 h-4" /> Post New
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Posted', value: stats.total, icon: FileText, color: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Active', value: stats.active, icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-400/10' },
              { label: 'Total Quotes Received', value: stats.totalQuotes, icon: Package, color: 'text-[#FF5A00]', bg: 'bg-orange-500/10' },
              { label: 'Closed / Expired', value: stats.closed, icon: XCircle, color: 'text-muted-foreground', bg: 'bg-muted' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                  <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${s.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-foreground">{loading ? '—' : s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              );
            })}
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search requirements..." className="pl-9 bg-card border-border" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40 bg-card border-border">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full md:w-44 bg-card border-border">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="most_quotes">Most Quotes</SelectItem>
                <SelectItem value="deadline">Deadline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Requirements List */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No requirements found.</p>
              <Link to="/post-requirement">
                <Button size="sm" className="bg-primary text-primary-foreground">Post a Requirement</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(req => {
                const days = daysUntil(req.deadline);
                return (
                  <div key={req.id}
                    className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors cursor-pointer"
                    onClick={() => openDetail(req)}>
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="text-sm font-semibold text-foreground truncate">{req.title}</p>
                          <StatusBadge status={req.status} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          {req.categories && <span className="flex items-center gap-1"><Package className="w-3 h-3" />{req.categories.name}</span>}
                          <span>{req.quantity.toLocaleString()} {req.quantity_unit}</span>
                          {req.destination_country && <span>{req.destination_country}</span>}
                          {req.deadline && (
                            <span className={`flex items-center gap-1 ${days !== null && days <= 3 && req.status === 'active' ? 'text-destructive' : ''}`}>
                              <Clock className="w-3 h-3" />
                              {days !== null && req.status === 'active'
                                ? days <= 0 ? 'Deadline passed' : `${days} day${days !== 1 ? 's' : ''} left`
                                : new Date(req.deadline).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Package className="w-4 h-4 text-primary" />
                          <span className="font-bold text-foreground">{req.quote_count ?? 0}</span>
                          <span className="text-xs text-muted-foreground">quotes</span>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => openDetail(req)}
                          className="text-xs text-primary border border-primary/20 hover:bg-primary/10 h-7 gap-1">
                          <Eye className="w-3 h-3" /> View
                        </Button>
                        <Link to={`/dashboard/buyer/rfq/${req.id}`} onClick={e => e.stopPropagation()}>
                          <Button size="sm" variant="ghost"
                            className="text-xs text-amber-600 border border-amber-500/30 hover:bg-amber-500/10 h-7 gap-1">
                            <Zap className="w-3 h-3" /> Matches
                          </Button>
                        </Link>
                        {req.status === 'active' && (
                          <Button size="sm" variant="ghost" onClick={() => handleClose(req.id)}
                            className="text-xs text-muted-foreground border border-border hover:bg-muted h-7" title="Close requirement">
                            <XCircle className="w-3 h-3" />
                          </Button>
                        )}
                        {req.status !== 'active' && (
                          <Button size="sm" variant="ghost" onClick={() => handleRepost(req)}
                            className="text-xs text-muted-foreground border border-border hover:bg-muted h-7 gap-1" title="Repost">
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer */}
      <Sheet open={!!selectedReq} onOpenChange={o => { if (!o) setSelectedReq(null); }}>
        <SheetContent side="right" className="w-full max-w-lg overflow-y-auto bg-card border-border p-0">
          {selectedReq && (
            <>
              <SheetHeader className="px-5 pt-5 pb-4 border-b border-border">
                <SheetTitle className="text-foreground text-left pr-6">{selectedReq.title}</SheetTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={selectedReq.status} />
                  {selectedReq.categories && (
                    <Badge variant="outline" className="text-xs border-border text-muted-foreground">{selectedReq.categories.name}</Badge>
                  )}
                </div>
              </SheetHeader>

              <div className="px-5 py-4 space-y-5 overflow-y-auto">
                {/* Requirement details */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: 'Quantity', value: `${selectedReq.quantity.toLocaleString()} ${selectedReq.quantity_unit}` },
                    { label: 'Destination', value: selectedReq.destination_country ?? '—' },
                    { label: 'Deadline', value: selectedReq.deadline ? new Date(selectedReq.deadline).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—' },
                    { label: 'Quotes Received', value: String(selectedReq.quote_count ?? 0) },
                  ].map(d => (
                    <div key={d.label} className="bg-muted rounded-lg p-3">
                      <p className="text-muted-foreground mb-1">{d.label}</p>
                      <p className="font-semibold text-foreground">{d.value}</p>
                    </div>
                  ))}
                </div>

                {selectedReq.description && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Description</p>
                    <p className="text-sm text-foreground text-pretty">{selectedReq.description}</p>
                  </div>
                )}
                {selectedReq.specifications && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Specifications</p>
                    <p className="text-sm text-foreground text-pretty">{selectedReq.specifications}</p>
                  </div>
                )}

                {/* Quotations */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                    Received Quotations ({reqQuotes.length})
                  </p>
                  {quotesLoading ? (
                    <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
                  ) : reqQuotes.length === 0 ? (
                    <div className="text-center py-6 bg-muted/30 rounded-lg">
                      <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No quotes received yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reqQuotes.map(q => (
                        <div key={q.id} className="bg-muted/30 border border-border rounded-xl p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Link to={`/companies/${q.companies?.slug}`}
                                  className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate">
                                  {q.companies?.company_name ?? 'Supplier'}
                                </Link>
                                {(q.companies?.is_verified || q.companies?.verification_status === 'verified') && (
                                  <ShieldCheck className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{q.companies?.city}, {q.companies?.country}</p>
                            </div>
                            <Badge variant="outline" className={`text-xs capitalize shrink-0 ${
                              q.status === 'accepted' ? 'text-green-400 border-green-400/30'
                              : q.status === 'rejected' ? 'text-destructive border-destructive/30'
                              : 'text-muted-foreground border-border'
                            }`}>
                              {q.status}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-3 gap-2 text-xs mb-3">                            <div>
                              <p className="text-muted-foreground">Price</p>
                              <p className="font-semibold text-foreground">{q.currency} {q.unit_price.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">MOQ</p>
                              <p className="font-semibold text-foreground">{q.moq.toLocaleString()} {q.moq_unit}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Delivery</p>
                              <p className="font-semibold text-foreground">{q.delivery_days ? `${q.delivery_days}d` : '—'}</p>
                            </div>
                          </div>

                          {q.payment_terms && <p className="text-xs text-muted-foreground mb-3">Payment: {q.payment_terms}</p>}
                          {q.notes && <p className="text-xs text-muted-foreground italic mb-3">"{q.notes}"</p>}

                          {q.status === 'pending' && (
                            <div className="flex gap-2 flex-wrap">
                              <Button size="sm" onClick={() => handleAcceptQuote(q.id)}
                                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs h-7 gap-1">
                                <CheckCircle className="w-3 h-3" /> Accept
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleRejectQuote(q.id)}
                                className="flex-1 border border-destructive/30 text-destructive hover:bg-destructive/10 text-xs h-7">
                                Reject
                              </Button>
                              {q.companies?.id && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setInstantQuoteProduct({
                                    id: q.requirement_id ?? '',
                                    name: selectedReq?.title ?? 'Requirement',
                                    supplierCompanyId: q.companies?.id ?? '',
                                    supplierName: q.companies?.company_name ?? 'Supplier',
                                  })}
                                  className="border border-primary/30 text-primary hover:bg-primary/10 text-xs h-7 gap-1"
                                >
                                  <Zap className="w-3 h-3" /> Quick Ask
                                </Button>
                              )}
                              <Link to="/dashboard/buyer/messages">
                                <Button size="sm" variant="ghost"
                                  className="border border-border text-muted-foreground hover:bg-muted text-xs h-7">
                                  <MessageSquare className="w-3 h-3" />
                                </Button>
                              </Link>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions footer */}
                <div className="flex gap-2 pt-2 border-t border-border">
                  {selectedReq.status === 'active' && (
                    <Button size="sm" variant="ghost" onClick={() => handleClose(selectedReq.id)}
                      className="flex-1 border border-border text-muted-foreground hover:bg-muted text-xs h-8">
                      Close Requirement
                    </Button>
                  )}
                  {selectedReq.status !== 'active' && (
                    <Button size="sm" variant="ghost" onClick={() => handleRepost(selectedReq)}
                      className="flex-1 border border-primary/30 text-primary hover:bg-primary/10 text-xs h-8 gap-1">
                      <RefreshCw className="w-3 h-3" /> Repost
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Instant Quote Dialog triggered from quote cards */}
      {instantQuoteProduct && (
        <InstantQuoteDialog
          open={!!instantQuoteProduct}
          onOpenChange={o => { if (!o) setInstantQuoteProduct(null); }}
          productId={instantQuoteProduct.id}
          productName={instantQuoteProduct.name}
          supplierCompanyId={instantQuoteProduct.supplierCompanyId}
          supplierName={instantQuoteProduct.supplierName}
        />
      )}
    </DashboardLayout>
  );
}
