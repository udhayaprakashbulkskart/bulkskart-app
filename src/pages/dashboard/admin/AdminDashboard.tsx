import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { Users, Building2, ShieldCheck, BarChart3, Search, CheckCircle, XCircle, CreditCard, Bell } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageMeta from '@/components/common/PageMeta';

type CompanyRow = {
  id: string; company_name: string; business_type: string | null; city: string | null; country: string | null;
  verification_status: string; gst_number: string | null; iec_number: string | null;
  profiles: { full_name: string | null; email: string | null; role: string } | null;
  created_at: string;
};

type AdminStats = { totalUsers: number; pendingVerifications: number; activeReqs: number; totalCompanies: number };

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [tab, setTab] = useState('overview');
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [stats, setStats] = useState<AdminStats>({ totalUsers: 0, pendingVerifications: 0, activeReqs: 0, totalCompanies: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sendingAlerts, setSendingAlerts] = useState(false);

  const handleSendSubscriptionAlerts = async () => {
    setSendingAlerts(true);
    try {
      const { data, error } = await supabase.rpc('notify_unpaid_manufacturers');
      if (error) throw error;
      const count = Number(data ?? 0);
      toast.success(`Sent subscription payment notification to ${count} unpaid manufacturer${count === 1 ? '' : 's'}!`);
    } catch (err) {
      toast.error('Failed to send subscription notifications');
    } finally {
      setSendingAlerts(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const [compRes, profileRes, reqRes] = await Promise.all([
      supabase.from('companies').select('*, profiles(full_name, email, role)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('requirements').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);
    const allCompanies = compRes.data ?? [];
    setCompanies(allCompanies);
    setStats({
      totalUsers: profileRes.count ?? 0,
      pendingVerifications: allCompanies.filter(c => c.verification_status === 'pending').length,
      activeReqs: reqRes.count ?? 0,
      totalCompanies: allCompanies.length,
    });
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateVerification = async (id: string, status: 'verified' | 'rejected') => {
    const { error } = await supabase.from('companies').update({ verification_status: status }).eq('id', id);
    if (error) { toast.error('Update failed.'); return; }
    toast.success(status === 'verified' ? 'Company verified and badge granted!' : 'Company application rejected.');
    fetchData();
  };

  const filtered = companies.filter(c => {
    const matchesSearch = [c.company_name, c.profiles?.email, c.profiles?.full_name].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    const matchesFilter = filter === 'all' || c.verification_status === filter;
    return matchesSearch && matchesFilter;
  });

  const statsCards = [
    { label: 'Registered Users', value: stats.totalUsers, icon: Users, color: 'text-primary' },
    { label: 'Companies', value: stats.totalCompanies, icon: Building2, color: 'text-[#FF5A00]' },
    { label: 'Pending Verifications', value: stats.pendingVerifications, icon: ShieldCheck, color: 'text-[#FF7A2E]' },
    { label: 'Active Requirements', value: stats.activeReqs, icon: BarChart3, color: 'text-[#FF7A2E]' },
  ];

  if (profile?.role !== 'admin') {
    return (
      <DashboardLayout>
      <PageMeta
        title="Admin Dashboard | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
        <div className="flex-1 p-8 text-center text-muted-foreground">Access denied. Admin only.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-6xl w-full mx-auto">
          <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-sm text-muted-foreground">Platform overview, user management, and verification controls</p>
            </div>
            <Button
              onClick={handleSendSubscriptionAlerts}
              disabled={sendingAlerts}
              className="bg-[#B33D00] hover:bg-[#B33D00] text-white font-bold gap-2 text-xs h-9 shadow-md"
            >
              <CreditCard className="w-4 h-4" />
              {sendingAlerts ? 'Sending Alerts…' : 'Notify Unpaid Manufacturers'}
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {statsCards.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className={`w-5 h-5 ${s.color}`} />
                    </div>
                    {s.label === 'Pending Verifications' && stats.pendingVerifications > 0 && (
                      <Badge className="bg-[#FF5A00]/20 text-[#FF7A2E] border-[#FF5A00]/30 text-xs">Action needed</Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-foreground">{loading ? '—' : s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              );
            })}
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-card border border-border mb-5">
              <TabsTrigger value="overview" className="text-xs">All Companies</TabsTrigger>
              <TabsTrigger value="pending" className="text-xs">
                Pending Verification
                {stats.pendingVerifications > 0 && <span className="ml-1.5 bg-[#FF5A00]/20 text-[#FF7A2E] text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{stats.pendingVerifications}</span>}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="flex flex-col md:flex-row gap-3 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by company, name, email..." className="pl-9 bg-card border-border" />
                </div>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-full md:w-48 bg-card border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="unverified">Unverified</SelectItem>
                    <SelectItem value="pending">Pending Review</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <CompanyTable companies={filtered} loading={loading} onVerify={updateVerification} />
            </TabsContent>

            <TabsContent value="pending">
              <CompanyTable
                companies={companies.filter(c => c.verification_status === 'pending')}
                loading={loading}
                onVerify={updateVerification}
                emptyMessage="No pending verifications. All caught up!"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}

function CompanyTable({ companies, loading, onVerify, emptyMessage }: {
  companies: CompanyRow[]; loading: boolean;
  onVerify: (id: string, status: 'verified' | 'rejected') => void;
  emptyMessage?: string;
}) {
  const statusColor = (s: string) => {
    if (s === 'verified') return 'text-[#FF7A2E] border-[#FF5A00]/30';
    if (s === 'pending') return 'text-[#FF7A2E] border-[#FF5A00]/30';
    if (s === 'rejected') return 'text-destructive border-destructive/30';
    return 'text-muted-foreground';
  };

  if (loading) return <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />)}</div>;

  if (companies.length === 0) return (
    <div className="bg-card border border-border rounded-xl p-12 text-center">
      <ShieldCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">{emptyMessage ?? 'No companies found.'}</p>
    </div>
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full whitespace-nowrap">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Company</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Contact</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">GST / IEC</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Location</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Joined</th>
              <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-foreground">{c.company_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{c.business_type ?? 'Supplier'}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-xs font-medium text-foreground">{c.profiles?.full_name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{c.profiles?.email ?? '—'}</p>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  <p>{c.gst_number ? `GST: ${c.gst_number}` : '—'}</p>
                  <p>{c.iec_number ? `IEC: ${c.iec_number}` : '—'}</p>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{[c.city, c.country].filter(Boolean).join(', ') || '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className={`text-xs capitalize ${statusColor(c.verification_status)}`}>
                    {c.verification_status}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('en-GB')}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {c.verification_status === 'pending' && (
                      <>
                        <Button onClick={() => onVerify(c.id, 'verified')} size="sm" variant="ghost" className="text-[#FF7A2E] border border-[#FF5A00]/20 hover:bg-[#B33D00]/10 h-7 text-xs gap-1">
                          <CheckCircle className="w-3 h-3" /> Verify
                        </Button>
                        <Button onClick={() => onVerify(c.id, 'rejected')} size="sm" variant="ghost" className="text-destructive border border-destructive/20 hover:bg-destructive/10 h-7 text-xs">
                          <XCircle className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                    {c.verification_status === 'unverified' && (
                      <Button onClick={() => onVerify(c.id, 'verified')} size="sm" variant="ghost" className="text-primary border border-primary/20 hover:bg-primary/10 h-7 text-xs gap-1">
                        <CheckCircle className="w-3 h-3" /> Approve
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


