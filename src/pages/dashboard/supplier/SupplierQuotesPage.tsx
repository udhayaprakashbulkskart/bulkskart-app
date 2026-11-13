import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getMyQuotations } from '@/lib/api';
import type { Quotation } from '@/types/types';
import { Package, MessageSquare, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageMeta from '@/components/common/PageMeta';

export default function SupplierQuotesPage() {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getMyQuotations(user.id).then(data => { setQuotations(data); setLoading(false); });
  }, [user]);

  const statusColor = (s: string) => {
    if (s === 'accepted') return 'text-green-400 border-green-400/30';
    if (s === 'rejected') return 'text-destructive border-destructive/30';
    if (s === 'revised') return 'text-[#FF5A00] border-[#FF5A00]/30/30';
    return 'text-yellow-400 border-yellow-400/30';
  };

  const pending = quotations.filter(q => q.status === 'pending').length;
  const accepted = quotations.filter(q => q.status === 'accepted').length;

  return (
    <DashboardLayout>
      <PageMeta
        title="Sent Quotations — Supplier | BulkSkart"
        description="BulkSkart dashboard — manage your account, orders and trade activity."
        robots="noindex, nofollow"
      />
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-5xl w-full mx-auto">
          <div className="bs-glass mb-6 rounded-3xl p-4">
            <h1 className="text-xl font-black text-foreground">Sent Quotations</h1>
            <p className="text-sm text-muted-foreground">Track all quotations you've sent to buyers</p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Total Sent', value: quotations.length, icon: Package, color: 'text-primary' },
              { label: 'Pending Response', value: pending, icon: TrendingUp, color: 'text-yellow-400' },
              { label: 'Accepted', value: accepted, icon: MessageSquare, color: 'text-green-400' },
            ].map(s => {              const Icon = s.icon;
              return (
                <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                  </div>
                  <p className="text-xl font-bold text-foreground">{loading ? '—' : s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              );
            })}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="p-4 space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-muted rounded animate-pulse" />)}</div>
            ) : quotations.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-3">No quotations sent yet.</p>
                <Link to="/dashboard/supplier/rfqs">
                  <Button size="sm" className="bg-primary text-primary-foreground">Browse RFQ Leads</Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full whitespace-nowrap">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Requirement</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Unit Price</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">MOQ</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Delivery</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Date</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotations.map(q => (
                      <tr key={q.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-foreground max-w-xs">
                          <p className="truncate">{q.requirements?.title ?? '—'}</p>
                          {q.requirements?.destination_country && (
                            <p className="text-xs text-muted-foreground">{q.requirements.destination_country}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">{q.currency} {q.unit_price.toLocaleString()}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{q.moq} {q.moq_unit}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{q.delivery_days ? `${q.delivery_days} days` : '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs capitalize ${statusColor(q.status)}`}>
                            {q.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {new Date(q.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="px-4 py-3">
                          {q.status === 'accepted' && (
                            <Link to="/dashboard/supplier/messages">
                              <Button size="sm" variant="ghost" className="text-xs text-primary border border-primary/20 hover:bg-primary/10 h-7 gap-1">
                                <MessageSquare className="w-3 h-3" /> Chat
                              </Button>
                            </Link>
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
