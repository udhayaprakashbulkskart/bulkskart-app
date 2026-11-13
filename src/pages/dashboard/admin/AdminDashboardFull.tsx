import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import {
  Users, Building2, ShieldCheck, BarChart3, Search, CheckCircle, XCircle,
  AlertTriangle, FileText, CreditCard, RefreshCw, Eye, Flag, Clock,
  TrendingUp, Package, MessageSquare, Wallet, Shield,
} from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import AdminLoanRequests from '@/components/dashboard/AdminLoanRequests';
import { useNavigate, useLocation } from 'react-router-dom';

// ─── Types ───────────────────────────────────────────────────
type CompanyRow = {
  id: string; company_name: string; business_type: string | null; city: string | null;
  verification_status: string; gst_number: string | null; pan_number: string | null;
  gst_doc_url: string | null; pan_doc_url: string | null; reg_doc_url: string | null;
  factory_doc_url: string | null; bank_doc_url: string | null;
  bank_account_name: string | null; bank_ifsc: string | null;
  verification_expiry_at: string | null; rejection_reason: string | null;
  profiles: { full_name: string | null; email: string | null; role: string } | null;
  created_at: string;
};

type DisputeRow = {
  id: string; reason: string; description: string; status: string; created_at: string;
  evidence_urls: string[];
  orders: { order_number: string } | null;
  raiser: { full_name: string | null; email: string | null } | null;
};

type FraudRow = {
  id: string; alert_type: string; description: string; severity: string;
  is_resolved: boolean; created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

type WithdrawalRow = {
  id: string; amount: number; status: string; notes: string | null; created_at: string;
  companies: { company_name: string } | null;
};

type AdminStats = {
  totalUsers: number; totalCompanies: number; pendingVerifications: number;
  activeReqs: number; totalOrders: number; openDisputes: number;
  pendingWithdrawals: number; totalRevenue: number;
};

const SEVERITY_COLORS: Record<string, string> = {
  high: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  medium: 'bg-[#FF5A00]/10 text-[#FF7A2E] border-[#FF5A00]/40',
  low: 'bg-orange-500/10 text-[#FF5A00] border-[#FF5A00]/30',
};

const STATUS_COLORS: Record<string, string> = {
  verified: 'bg-[#FF5A00]/10 text-[#FF7A2E]',
  pending: 'bg-[#FF5A00]/10 text-[#FF7A2E]',
  unverified: 'bg-muted text-muted-foreground',
  rejected: 'bg-[#FF5A00]/10 text-[#FF7A2E]',
  open: 'bg-[#FF5A00]/10 text-[#FF7A2E]',
  under_review: 'bg-orange-500/10 text-[#FF5A00]',
  resolved: 'bg-[#FF5A00]/10 text-[#FF7A2E]',
  closed: 'bg-muted text-muted-foreground',
};

export default function AdminDashboardFull() {
  const { profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const tabFromHash = location.hash.replace('#', '') || 'overview';
  const [tab, setTab] = useState(tabFromHash);

  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0, totalCompanies: 0, pendingVerifications: 0,
    activeReqs: 0, totalOrders: 0, openDisputes: 0,
    pendingWithdrawals: 0, totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [verFilter, setVerFilter] = useState('all');
  const [saving, setSaving] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [compRes, profileRes, reqRes, ordRes, dispRes, fraudRes, wdRes] = await Promise.all([
      supabase.from('companies').select('id,company_name,business_type,city,verification_status,gst_number,pan_number,gst_doc_url,pan_doc_url,reg_doc_url,factory_doc_url,bank_doc_url,bank_account_name,bank_ifsc,verification_expiry_at,rejection_reason,created_at,profiles(full_name,email,role)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('requirements').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
      supabase.from('disputes').select('id,reason,description,status,created_at,evidence_urls,orders(order_number),raiser:raised_by(full_name,email)').order('created_at', { ascending: false }).limit(50),
      supabase.from('fraud_alerts').select('id,alert_type,description,severity,is_resolved,created_at,profiles(full_name,email)').order('created_at', { ascending: false }).limit(50),
      supabase.from('withdrawal_requests').select('id,amount,status,notes,created_at,companies(company_name)').order('created_at', { ascending: false }).limit(50),
    ]);

    const allComp = (compRes.data ?? []) as unknown as CompanyRow[];
    setCompanies(allComp);
    setDisputes((dispRes.data ?? []) as unknown as DisputeRow[]);
    setFraudAlerts((fraudRes.data ?? []) as unknown as FraudRow[]);
    setWithdrawals((wdRes.data ?? []) as unknown as WithdrawalRow[]);

    const pending = allComp.filter(c => c.verification_status === 'pending').length;
    const openD = (dispRes.data ?? []).filter((d: { status: string }) => d.status === 'open').length;
    const pendingW = (wdRes.data ?? []).filter((w: { status: string }) => w.status === 'pending').length;

    setStats({
      totalUsers: profileRes.count ?? 0,
      totalCompanies: allComp.length,
      pendingVerifications: pending,
      activeReqs: reqRes.count ?? 0,
      totalOrders: ordRes.count ?? 0,
      openDisputes: openD,
      pendingWithdrawals: pendingW,
      totalRevenue: 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Guard: admin only
  if (profile && profile.role !== 'admin') {
    return (
      <DashboardLayout>
      <PageMeta
        title="Admin Dashboard | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
        <div className="flex items-center justify-center h-64 text-muted-foreground">Access denied.</div>
      </DashboardLayout>
    );
  }

  const setExpiry = (months = 12): string => {
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toISOString();
  };

  const approveVerification = async (id: string) => {
    setSaving(id);
    const { error } = await supabase.from('companies').update({
      verification_status: 'verified',
      is_verified: true,
      verified_at: new Date().toISOString(),
      verification_expiry_at: setExpiry(12),
      rejection_reason: null,
    }).eq('id', id);
    if (error) { toast.error('Failed to approve'); } else { toast.success('Company verified ✓'); fetchAll(); }
    setSaving(null);
  };

  const rejectVerification = async (id: string, reason: string) => {
    setSaving(id);
    const { error } = await supabase.from('companies').update({
      verification_status: 'rejected',
      is_verified: false,
      rejection_reason: reason,
    }).eq('id', id);
    if (error) { toast.error('Failed to reject'); } else { toast.success('Application rejected'); fetchAll(); }
    setSaving(null);
    setRejectId(null);
    setRejectReason('');
  };

  const resolveDispute = async (id: string, resolution: string) => {
    await supabase.from('disputes').update({ status: 'resolved', resolution, resolved_at: new Date().toISOString() }).eq('id', id);
    toast.success('Dispute resolved');
    fetchAll();
  };

  const approveFraud = async (id: string) => {
    await supabase.from('fraud_alerts').update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq('id', id);
    toast.success('Fraud alert resolved');
    fetchAll();
  };

  const approveWithdrawal = async (id: string) => {
    await supabase.from('withdrawal_requests').update({ status: 'approved', processed_at: new Date().toISOString() }).eq('id', id);
    toast.success('Withdrawal approved');
    fetchAll();
  };
  const rejectWithdrawal = async (id: string) => {
    await supabase.from('withdrawal_requests').update({ status: 'rejected', processed_at: new Date().toISOString() }).eq('id', id);
    toast.success('Withdrawal rejected');
    fetchAll();
  };

  const filteredCompanies = companies.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || [c.company_name, c.profiles?.email, c.profiles?.full_name].some(v => v?.toLowerCase().includes(q));
    const matchFilter = verFilter === 'all' || c.verification_status === verFilter;
    return matchSearch && matchFilter;
  });

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users, color: 'text-primary' },
    { label: 'Companies', value: stats.totalCompanies, icon: Building2, color: 'text-[#FF5A00]' },
    { label: 'Pending Verifications', value: stats.pendingVerifications, icon: Shield, color: 'text-[#FF7A2E]' },
    { label: 'Active RFQs', value: stats.activeReqs, icon: FileText, color: 'text-[#FF7A2E]' },
    { label: 'Total Orders', value: stats.totalOrders, icon: Package, color: 'text-[#FF7A2E]' },
    { label: 'Open Disputes', value: stats.openDisputes, icon: AlertTriangle, color: 'text-[#FF7A2E]' },
    { label: 'Pending Withdrawals', value: stats.pendingWithdrawals, icon: Wallet, color: 'text-[#FF7A2E]' },
  ];

  return (
    <DashboardLayout>
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Admin Control Panel</h1>
              <p className="text-sm text-muted-foreground">Platform management — verifications, disputes, analytics</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAll} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {statCards.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{loading ? '—' : s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              );
            })}
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <div className="overflow-x-auto">
              <TabsList className="whitespace-nowrap mb-5 w-max">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="verifications">
                  Verifications
                  {stats.pendingVerifications > 0 && (
                    <span className="ml-1.5 bg-[#C94400] text-white text-[10px] rounded-full px-1.5 py-0.5">{stats.pendingVerifications}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="disputes">
                  Disputes
                  {stats.openDisputes > 0 && (
                    <span className="ml-1.5 bg-[#C94400] text-white text-[10px] rounded-full px-1.5 py-0.5">{stats.openDisputes}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="fraud">Fraud &amp; Abuse</TabsTrigger>
                <TabsTrigger value="withdrawals">
                  Withdrawals
                  {stats.pendingWithdrawals > 0 && (
                    <span className="ml-1.5 bg-[#C94400] text-white text-[10px] rounded-full px-1.5 py-0.5">{stats.pendingWithdrawals}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="companies">All Companies</TabsTrigger>
                <TabsTrigger value="loans">Loan Requests</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="loans">
              {tab === 'loans' ? <AdminLoanRequests /> : null}
            </TabsContent>

            {/* ── Overview ─────────────────────────────── */}
            <TabsContent value="overview">
              <div className="grid md:grid-cols-2 gap-5">
                {/* Pending verifications quick list */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#FF7A2E]" /> Pending Verifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {companies.filter(c => c.verification_status === 'pending').slice(0, 5).map(c => (
                      <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{c.company_name}</p>
                          <p className="text-xs text-muted-foreground">{c.profiles?.email}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" className="h-7 text-xs bg-[#B33D00] hover:bg-[#B33D00] text-white" onClick={() => approveVerification(c.id)} disabled={saving === c.id}>
                            <CheckCircle className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-xs border-[#FF5A00]/40 text-[#FF7A2E]" onClick={() => setRejectId(c.id)}>
                            <XCircle className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {companies.filter(c => c.verification_status === 'pending').length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No pending verifications</p>
                    )}
                    <Button variant="ghost" size="sm" className="w-full mt-2 text-primary text-xs" onClick={() => setTab('verifications')}>
                      View All →
                    </Button>
                  </CardContent>
                </Card>

                {/* Open disputes quick list */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#FF7A2E]" /> Open Disputes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {disputes.filter(d => d.status === 'open').slice(0, 5).map(d => (
                      <div key={d.id} className="flex items-start justify-between py-2 border-b border-border last:border-0 gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">Order #{d.orders?.order_number}</p>
                          <p className="text-xs text-muted-foreground">{d.reason.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-muted-foreground">{d.raiser?.email}</p>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => setTab('disputes')}>
                          Review
                        </Button>
                      </div>
                    ))}
                    {disputes.filter(d => d.status === 'open').length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No open disputes</p>
                    )}
                    <Button variant="ghost" size="sm" className="w-full mt-2 text-primary text-xs" onClick={() => setTab('disputes')}>
                      View All →
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ── Verifications ─────────────────────────── */}
            <TabsContent value="verifications">
              <div className="flex gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search company or email…" className="pl-8" />
                </div>
                <Select value={verFilter} onValueChange={setVerFilter}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="unverified">Unverified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reject modal */}
              {rejectId && (
                <div className="mb-4 p-4 border border-destructive/30 bg-destructive/10 rounded-xl space-y-3">
                  <p className="text-sm font-medium text-destructive">Rejection reason for {companies.find(c => c.id === rejectId)?.company_name}</p>
                  <Input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Enter rejection reason…" className="bg-background" />
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-[#B33D00] hover:bg-[#1A0C05] text-white" onClick={() => rejectVerification(rejectId, rejectReason)} disabled={!rejectReason.trim() || saving === rejectId}>
                      Confirm Reject
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setRejectId(null); setRejectReason(''); }}>Cancel</Button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Company</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Contact</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">GST</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Documents</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Status</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground"><RefreshCw className="w-4 h-4 animate-spin mx-auto" /></td></tr>
                    ) : filteredCompanies.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No companies found</td></tr>
                    ) : filteredCompanies.map(c => (
                      <tr key={c.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-3">
                          <p className="font-medium">{c.company_name}</p>
                          <p className="text-xs text-muted-foreground">{c.business_type}</p>
                          {c.verification_expiry_at && (
                            <p className="text-xs text-muted-foreground">Expires: {new Date(c.verification_expiry_at).toLocaleDateString()}</p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p>{c.profiles?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{c.profiles?.email}</p>
                        </td>
                        <td className="px-3 py-3 text-xs">{c.gst_number || '—'}</td>
                        <td className="px-3 py-3">
                          <div className="flex gap-1 flex-wrap">
                            {c.gst_doc_url && <a href={c.gst_doc_url} target="_blank" rel="noreferrer" className="text-[10px] px-1.5 py-0.5 bg-[#FF5A00]/10 text-[#FF7A2E] rounded">GST</a>}
                            {c.pan_doc_url && <a href={c.pan_doc_url} target="_blank" rel="noreferrer" className="text-[10px] px-1.5 py-0.5 bg-orange-500/10 text-[#FF5A00] rounded">PAN</a>}
                            {c.reg_doc_url && <a href={c.reg_doc_url} target="_blank" rel="noreferrer" className="text-[10px] px-1.5 py-0.5 bg-[#FF5A00]/10 text-[#FF7A2E] rounded">REG</a>}
                            {c.factory_doc_url && <a href={c.factory_doc_url} target="_blank" rel="noreferrer" className="text-[10px] px-1.5 py-0.5 bg-[#FF5A00]/10 text-orange-700 rounded">Factory</a>}
                            {c.bank_doc_url && <a href={c.bank_doc_url} target="_blank" rel="noreferrer" className="text-[10px] px-1.5 py-0.5 bg-[#FF5A00]/10 text-[#FF7A2E] rounded">Bank</a>}
                            {!c.gst_doc_url && !c.pan_doc_url && <span className="text-xs text-muted-foreground">None uploaded</span>}
                          </div>
                          {c.bank_account_name && <p className="text-xs text-muted-foreground mt-0.5">{c.bank_account_name} · {c.bank_ifsc}</p>}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[c.verification_status] || 'bg-muted text-muted-foreground'}`}>
                            {c.verification_status}
                          </span>
                          {c.rejection_reason && <p className="text-xs text-[#FF7A2E] mt-0.5 max-w-[120px] truncate">{c.rejection_reason}</p>}
                        </td>
                        <td className="px-3 py-3">
                          {c.verification_status === 'pending' && (
                            <div className="flex gap-1">
                              <Button size="sm" className="h-7 text-xs bg-[#B33D00] hover:bg-[#B33D00] text-white px-2"
                                onClick={() => approveVerification(c.id)} disabled={saving === c.id}>
                                {saving === c.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs border-[#FF5A00]/40 text-[#FF7A2E] px-2"
                                onClick={() => setRejectId(c.id)}>
                                <XCircle className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          {c.verification_status === 'verified' && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRejectId(c.id)}>Revoke</Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── Disputes ──────────────────────────────── */}
            <TabsContent value="disputes">
              <div className="space-y-3">
                {loading && <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-primary" /></div>}
                {!loading && disputes.length === 0 && (
                  <Card><CardContent className="text-center py-10 text-muted-foreground">No disputes</CardContent></Card>
                )}
                {disputes.map(d => (
                  <Card key={d.id}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">Order #{d.orders?.order_number}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[d.status] || 'bg-muted text-muted-foreground'}`}>
                              {d.status.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-muted-foreground">{d.reason.replace(/_/g, ' ')}</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">By: {d.raiser?.full_name} ({d.raiser?.email})</p>
                          {d.evidence_urls?.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {d.evidence_urls.map((url, i) => (
                                <a key={i} href={url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">Evidence {i + 1}</a>
                              ))}
                            </div>
                          )}
                        </div>
                        {d.status === 'open' && (
                          <div className="flex gap-2 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                              supabase.from('disputes').update({ status: 'under_review' }).eq('id', d.id).then(() => fetchAll());
                              toast.success('Dispute marked as under review');
                            }}>
                              Start Review
                            </Button>
                            <Button size="sm" className="h-7 text-xs bg-[#B33D00] hover:bg-[#B33D00] text-white" onClick={() => resolveDispute(d.id, 'Resolved by admin')}>
                              Resolve
                            </Button>
                          </div>
                        )}
                        {d.status === 'under_review' && (
                          <Button size="sm" className="h-7 text-xs bg-[#B33D00] hover:bg-[#B33D00] text-white shrink-0" onClick={() => resolveDispute(d.id, 'Resolved by admin')}>
                            Mark Resolved
                          </Button>
                        )}
                        <p className="text-xs text-muted-foreground shrink-0">{new Date(d.created_at).toLocaleDateString()}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* ── Fraud & Abuse ────────────────────────── */}
            <TabsContent value="fraud">
              <div className="space-y-3">
                {loading && <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-primary" /></div>}
                {!loading && fraudAlerts.length === 0 && (
                  <Card><CardContent className="text-center py-10 text-muted-foreground">No fraud alerts</CardContent></Card>
                )}
                {fraudAlerts.map(f => (
                  <Card key={f.id}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm">{f.alert_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SEVERITY_COLORS[f.severity]}`}>
                              {f.severity.toUpperCase()}
                            </span>
                            {f.is_resolved && <span className="text-xs text-[#FF7A2E]">✓ Resolved</span>}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">{f.description}</p>
                          <p className="text-xs text-muted-foreground mt-1">{f.profiles?.full_name} · {f.profiles?.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</p>
                          {!f.is_resolved && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => approveFraud(f.id)}>
                              Resolve
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* ── Withdrawals ──────────────────────────── */}
            <TabsContent value="withdrawals">
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Company</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Amount</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Status</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Date</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={5} className="text-center py-8"><RefreshCw className="w-4 h-4 animate-spin mx-auto text-primary" /></td></tr>
                    ) : withdrawals.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">No withdrawal requests</td></tr>
                    ) : withdrawals.map(w => (
                      <tr key={w.id} className="border-b border-border hover:bg-muted/30">
                        <td className="px-3 py-3">{w.companies?.company_name}</td>
                        <td className="px-3 py-3 font-semibold">₹{Number(w.amount).toLocaleString()}</td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[w.status] || 'bg-muted text-muted-foreground'}`}>
                            {w.status}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">{new Date(w.created_at).toLocaleDateString()}</td>
                        <td className="px-3 py-3">
                          {w.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button size="sm" className="h-7 text-xs bg-[#B33D00] hover:bg-[#B33D00] text-white" onClick={() => approveWithdrawal(w.id)}>
                                <CheckCircle className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs border-[#FF5A00]/40 text-[#FF7A2E]" onClick={() => rejectWithdrawal(w.id)}>
                                <XCircle className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── All Companies ─────────────────────────── */}
            <TabsContent value="companies">
              <div className="flex gap-3 mb-4 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="pl-8" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Company</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Owner</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Type</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">City</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Verification</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-3 py-2">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.slice(0, 100).map(c => (
                      <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                        <td className="px-3 py-2 font-medium">{c.company_name}</td>
                        <td className="px-3 py-2">
                          <p>{c.profiles?.full_name}</p>
                          <p className="text-xs text-muted-foreground">{c.profiles?.email}</p>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{c.business_type || '—'}</td>
                        <td className="px-3 py-2 text-xs">{c.city || '—'}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[c.verification_status] || 'bg-muted text-muted-foreground'}`}>
                            {c.verification_status}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
