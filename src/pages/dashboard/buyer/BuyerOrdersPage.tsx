import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getOrdersForBuyer } from '@/lib/api';
import type { OrderRow } from '@/types/types';
import type { PipelineStatus } from '@/types/types';
import {
  Package, ChevronRight, ArrowRight, ShieldCheck,
} from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';
import OrderStatusTimeline from '@/components/common/OrderStatusTimeline';

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:    { label: 'Pending',    cls: 'bg-orange-500/10 text-[#FF5A00] border-[#FF5A00]/30' },
  confirmed:  { label: 'Confirmed',  cls: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  processing: { label: 'Processing', cls: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  shipped:    { label: 'Shipped',    cls: 'bg-purple-100 text-purple-700 border-purple-300' },
  delivered:  { label: 'Delivered',  cls: 'bg-green-100 text-green-700 border-green-300' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-red-100 text-red-700 border-red-300' },
};

function pipelineStatus(o: OrderRow): PipelineStatus {
  const s = (o as { order_status?: string }).order_status;
  if (s) return s as PipelineStatus;
  // fallback for legacy milestone
  const m = o.milestone;
  if (m === 'cancelled') return 'cancelled';
  if (m === 'delivered' || m === 'completed') return 'delivered';
  if (m === 'dispatched') return 'shipped';
  if (m === 'production' || m === 'ready_for_dispatch') return 'processing';
  if (m === 'order_processing') return 'confirmed';
  return 'pending';
}

export default function BuyerOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all');

  useEffect(() => {
    if (!user) return;
    getOrdersForBuyer(user.id).then(data => { setOrders(data); setLoading(false); });
  }, [user]);

  const filtered = orders.filter(o => {
    const s = pipelineStatus(o);
    if (filter === 'active')    return !['delivered', 'cancelled'].includes(s);
    if (filter === 'delivered') return s === 'delivered';
    if (filter === 'cancelled') return s === 'cancelled';
    return true;
  });

  const counts = {
    all:       orders.length,
    active:    orders.filter(o => !['delivered', 'cancelled'].includes(pipelineStatus(o))).length,
    delivered: orders.filter(o => pipelineStatus(o) === 'delivered').length,
    cancelled: orders.filter(o => pipelineStatus(o) === 'cancelled').length,
  };

  return (
    <DashboardLayout>
      <PageMeta title="My Orders — Buyer | BulkSkart" description="" robots="noindex, nofollow" />
      <div className="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <div className="bs-glass mb-6 rounded-3xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">Fulfilment</p>
            <h1 className="text-2xl font-black text-foreground">My Orders</h1>
            <p className="text-sm text-muted-foreground">Track your orders from placement to delivery</p>
          </div>

          <div className="flex gap-2 mb-5 flex-wrap">
            {(['all', 'active', 'delivered', 'cancelled'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  filter === f ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="ml-1.5 opacity-70">({counts[f]})</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-16 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="font-semibold text-foreground mb-1">No orders yet</p>
              <p className="text-sm text-muted-foreground mb-4">Accept a supplier quote to create your first order.</p>
              <Link to="/dashboard/buyer/quotes">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                  <ArrowRight className="w-4 h-4" /> Browse Received Quotes
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map(order => {
                const status = pipelineStatus(order);
                const meta = STATUS_META[status] ?? STATUS_META['pending'];
                return (
                  <Link key={order.id} to={`/dashboard/buyer/orders/${order.id}`}
                    className="block bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition-all group">
                    <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          {order.companies?.logo_url
                            ? <img
                                src={order.companies.logo_url}
                                alt=""
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(order.companies?.company_name || 'Supplier')}&background=1e293b&color=ff5a00&bold=true`;
                                }}
                                className="w-8 h-8 rounded-lg object-cover"
                              />
                            : <Package className="w-5 h-5 text-primary" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">{order.requirements?.title ?? 'Order'}</p>
                            {order.companies?.verification_status === 'verified' && <ShieldCheck className="w-3.5 h-3.5 text-green-500" />}
                          </div>
                          <p className="text-xs text-muted-foreground">{order.companies?.company_name ?? '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className={`text-xs ${meta.cls}`}>{meta.label}</Badge>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mb-4">
                      <span>Order: <strong className="text-foreground">{order.order_number}</strong></span>
                      <span>Qty: <strong className="text-foreground">{order.quantity} {order.quantity_unit ?? ''}</strong></span>
                      <span>Amount: <strong className="text-foreground">{order.currency} {Number(order.total_amount).toLocaleString()}</strong></span>
                      <span>Placed: <strong className="text-foreground">{new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></span>
                    </div>

                    {status !== 'cancelled' && (
                      <div className="overflow-x-auto">
                        <OrderStatusTimeline currentStatus={status} history={[]} variant="compact" />
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
