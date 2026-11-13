import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getRequirements, updateRequirement } from '@/lib/api';
import type { Requirement } from '@/types/types';
import { FileText, Plus, Eye, XCircle, Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageMeta from '@/components/common/PageMeta';

export default function BuyerRequirementsPage() {
  const { user } = useAuth();
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetch = () => {
    if (!user) return;
    setLoading(true);
    getRequirements({ buyerId: user.id }).then(data => {
      const unique = Array.from(new Map((data || []).map(r => [r.id, r])).values());
      setRequirements(unique);
      setLoading(false);
    });
  };

  useEffect(() => { fetch(); }, [user]);

  const handleClose = async (id: string) => {
    await updateRequirement(id, { status: 'closed' });
    toast.success('Requirement closed.');
    fetch();
  };

  const filtered = requirements.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <DashboardLayout>
      <PageMeta
        title="My Requirements — Buyer | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-foreground">My Requirements</h1>
              <p className="text-sm text-muted-foreground">All your posted bulk requirements</p>
            </div>
            <Link to="/post-requirement" className="hidden md:block">
              <Button className="bg-[#1A0C05] text-primary-foreground hover:bg-primary/90 gap-2 text-sm">
                <Plus className="w-4 h-4" /> Post New
              </Button>
            </Link>
          </div>

          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requirements..." className="pl-9 bg-card border-border" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40 bg-card border-border">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No requirements found.</p>
                <Link to="/post-requirement">
                  <Button size="sm" className="bg-[#1A0C05] text-primary-foreground">Post a Requirement</Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Requirement</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Qty</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Destination</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Deadline</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Quotes</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(req => (
                      <tr key={req.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-foreground max-w-xs">
                          <p className="truncate">{req.title}</p>
                          {req.categories && <p className="text-xs text-muted-foreground">{req.categories.name}</p>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{req.quantity} {req.quantity_unit}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{req.destination_country ?? '—'}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {req.deadline ? new Date(req.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs capitalize ${req.status === 'active' ? 'text-[#FF7A2E] border-[#FF5A00]/30' : 'text-muted-foreground'}`}>
                            {req.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-foreground">{req.quote_count}</td>
                        <td className="px-4 py-3 flex items-center gap-1.5">
                          <Link to={`/dashboard/buyer/quotes?req=${req.id}`}>
                            <Button size="sm" variant="ghost" className="text-xs text-primary border border-primary/20 hover:bg-primary/10 h-7 gap-1">
                              <Eye className="w-3 h-3" /> Quotes
                            </Button>
                          </Link>
                          {req.status === 'active' && (
                            <Button size="sm" variant="ghost" onClick={() => handleClose(req.id)} className="text-xs text-destructive border border-destructive/20 hover:bg-destructive/10 h-7">
                              <XCircle className="w-3 h-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
