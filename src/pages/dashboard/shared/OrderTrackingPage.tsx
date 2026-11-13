import React, { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/layouts/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { advanceOrderStatus, cancelOrder, getOrderStatusHistory } from '@/lib/api';
import type { PipelineStatus, OrderStatusHistory } from '@/types/types';
import OrderStatusTimeline, { PIPELINE_STAGES } from '@/components/common/OrderStatusTimeline';
import { toast } from 'sonner';
import {
  RefreshCw, ChevronLeft, MessageSquare, CheckCircle2,
  Truck, XCircle, Package, AlertTriangle,
} from 'lucide-react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PageMeta from '@/components/common/PageMeta';

// ---------- Status meta (badge colours) ----------
const STATUS_META: Record<PipelineStatus, { label: string; cls: string }> = {
  pending:    { label: 'Pending',    cls: 'bg-orange-500/10 text-[#FF5A00] border-[#FF5A00]/30' },
  confirmed:  { label: 'Confirmed',  cls: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
  processing: { label: 'Processing', cls: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  shipped:    { label: 'Shipped',    cls: 'bg-purple-100 text-purple-700 border-purple-300' },
  delivered:  { label: 'Delivered',  cls: 'bg-green-100 text-green-700 border-green-300' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-red-100 text-red-700 border-red-300' },
};

// ---------- Pipeline transitions ----------
// supplier can advance: pending→confirmed, confirmed→processing, processing→shipped
// buyer can advance: shipped→delivered
const SUPPLIER_ADVANCES: Partial<Record<PipelineStatus, PipelineStatus>> = {
  pending: 'confirmed', confirmed: 'processing', processing: 'shipped',
};
const BUYER_ADVANCES: Partial<Record<PipelineStatus, PipelineStatus>> = {
  shipped: 'delivered',
};
const CANCELLABLE: PipelineStatus[] = ['pending', 'confirmed'];

// ---------- Action button labels ----------
const ADVANCE_LABEL: Partial<Record<PipelineStatus, { icon: React.ElementType; label: string }>> = {
  pending:   { icon: CheckCircle2, label: 'Confirm Order' },
  confirmed: { icon: Package,      label: 'Start Processing' },
  processing:{ icon: Truck,        label: 'Mark as Shipped' },
  shipped:   { icon: CheckCircle2, label: 'Mark as Delivered' },
};

type OrderData = {
  id: string; order_number: string; order_status: PipelineStatus; milestone: string;
  total_amount: number; currency: string; quantity: number;
  notes: string | null; cancelled_reason: string | null; created_at: string;
  tracking_courier: string | null; tracking_number: string | null; tracking_eta: string | null;
  buyer_id: string; supplier_id: string | null; supplier_company_id: string;
  quotations?: { unit_price: number; payment_terms: string | null; delivery_terms: string | null; notes: string | null };
  requirements?: { title: string; quantity: number; quantity_unit: string };
  companies?: { company_name: string; slug: string };
};

export default function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { profile, company } = useAuth();
  const navigate = useNavigate();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [convId, setConvId] = useState<string | null>(null);

  // Dialog state
  const [showAdvance, setShowAdvance] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [actionNote, setActionNote] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [trackingCourier, setTrackingCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingEta, setTrackingEta] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!orderId) { setLoading(false); return; }
    const [{ data: orderData }, histData] = await Promise.all([
      supabase
        .from('orders')
        .select('*,quotations(unit_price,payment_terms,delivery_terms,notes),requirements(title,quantity,quantity_unit),companies:supplier_company_id(company_name,slug)')
        .eq('id', orderId)
        .maybeSingle(),
      getOrderStatusHistory(orderId),
    ]);

    setOrder(orderData as OrderData);
    setHistory(histData);

    if (orderData) {
      const { data: c1 } = await supabase.from('conversations').select('id').eq('order_id', orderId).maybeSingle();
      if (c1) { setConvId(c1.id); }
      else {
        const qid = (orderData as { quotation_id?: string }).quotation_id;
        if (qid) {
          const { data: c2 } = await supabase.from('conversations').select('id').eq('quotation_id', qid).maybeSingle();
          setConvId(c2?.id ?? null);
        }
      }
    }
    setLoading(false);
  }, [orderId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Realtime subscription
  useEffect(() => {
    if (!orderId) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      const chName = `order-status-${orderId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      channel = supabase
        .channel(chName)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` },
          () => { fetchAll(); })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'order_status_history', filter: `order_id=eq.${orderId}` },
          () => { fetchAll(); })
        .subscribe();
    } catch (e) {
      console.warn('Order tracking realtime subscription skipped:', e);
    }
    return () => { 
      if (channel) supabase.removeChannel(channel); 
    };
  }, [orderId, fetchAll]);

  if (loading) return (
    <DashboardLayout>
      <div className="flex items-center justify-center h-64"><RefreshCw className="w-6 h-6 animate-spin text-primary" /></div>
    </DashboardLayout>
  );
  if (!order) return (
    <DashboardLayout><div className="text-center py-20 text-muted-foreground">Order not found.</div></DashboardLayout>
  );

  const role = profile?.role as 'buyer' | 'supplier' | 'admin' | undefined;
  const curStatus: PipelineStatus = order.order_status ?? 'pending';
  const meta = STATUS_META[curStatus];

  // Determine what actions this user can take
  const isSupplier = role === 'supplier' || role === 'admin';
  const isBuyer = role === 'buyer' || role === 'admin';
  const nextForSupplier = SUPPLIER_ADVANCES[curStatus];
  const nextForBuyer = BUYER_ADVANCES[curStatus];
  const nextStatus: PipelineStatus | undefined = role === 'admin'
    ? (nextForSupplier ?? nextForBuyer)
    : isSupplier && nextForSupplier
      ? nextForSupplier
      : isBuyer && nextForBuyer
        ? nextForBuyer
        : undefined;
  const canAdvance = !!nextStatus && curStatus !== 'cancelled' && curStatus !== 'delivered';
  const canCancel = CANCELLABLE.includes(curStatus) && (isBuyer || isSupplier);
  const needsTracking = nextStatus === 'shipped';
  const advanceMeta = nextStatus ? ADVANCE_LABEL[curStatus] : undefined;

  const handleAdvance = async () => {
    if (!order || !nextStatus || !role) return;
    if (needsTracking && !trackingNumber.trim()) {
      toast.error('Tracking number is required when marking as Shipped');
      return;
    }
    setSaving(true);
    const changerRole = role === 'admin' ? 'admin' : isSupplier ? 'supplier' : 'buyer';
    const { error } = await advanceOrderStatus(
      order.id, curStatus, nextStatus, changerRole, actionNote.trim() || undefined,
      needsTracking ? { courier: trackingCourier, number: trackingNumber, eta: trackingEta } : undefined,
    );
    if (error) { toast.error(error); setSaving(false); return; }

    // Notify other party
    const notifyUserId = changerRole === 'buyer' ? order.supplier_id : order.buyer_id;
    if (notifyUserId) {
      await supabase.functions.invoke('send-notification', {
        body: {
          user_id: notifyUserId,
          title: 'Order Status Updated',
          message: `Order #${order.order_number} is now: ${STATUS_META[nextStatus].label}.${actionNote ? ' Note: ' + actionNote : ''}`,
          type: 'order_status',
          link: `/dashboard/${changerRole === 'buyer' ? 'supplier' : 'buyer'}/orders/${order.id}`,
          reference_id: order.id,
          reference_type: 'order',
        },
      });
    }
    toast.success(`Order marked as ${STATUS_META[nextStatus].label}`);
    setSaving(false);
    setShowAdvance(false);
    setActionNote(''); setTrackingCourier(''); setTrackingNumber(''); setTrackingEta('');
    fetchAll();
  };

  const handleCancel = async () => {
    if (!order || !role) return;
    if (!cancelReason.trim()) { toast.error('Please provide a cancellation reason'); return; }
    setSaving(true);
    const changerRole = role === 'admin' ? 'admin' : isSupplier ? 'supplier' : 'buyer';
    const { error } = await cancelOrder(order.id, curStatus, changerRole, cancelReason.trim());
    if (error) { toast.error(error); setSaving(false); return; }

    const notifyUserId = changerRole === 'buyer' ? order.supplier_id : order.buyer_id;
    if (notifyUserId) {
      await supabase.functions.invoke('send-notification', {
        body: {
          user_id: notifyUserId,
          title: 'Order Cancelled',
          message: `Order #${order.order_number} has been cancelled. Reason: ${cancelReason}`,
          type: 'order_status',
          link: `/dashboard/${changerRole === 'buyer' ? 'supplier' : 'buyer'}/orders/${order.id}`,
          reference_id: order.id,
          reference_type: 'order',
        },
      });
    }
    toast.success('Order cancelled');
    setSaving(false);
    setShowCancel(false);
    setCancelReason('');
    fetchAll();
  };

  const dashBase = role === 'buyer' ? '/dashboard/buyer' : role === 'supplier' ? '/dashboard/supplier' : '/dashboard/admin';

  return (
    <DashboardLayout>
      <PageMeta title={`Order #${order.order_number} | BulkSkart`} description="" robots="noindex, nofollow" />
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">

          {/* Back + header */}
          <div className="bs-glass flex items-center gap-3 rounded-3xl p-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="shrink-0">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-foreground truncate">
                Order <span className="text-primary">#{order.order_number}</span>
              </h1>
              <p className="text-xs text-muted-foreground truncate">{order.requirements?.title}</p>
            </div>
            <Badge variant="outline" className={`text-xs shrink-0 ${meta.cls}`}>{meta.label}</Badge>
          </div>

          {/* Summary card */}
          <Card>
            <CardContent className="pt-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Supplier</p><p className="font-medium">{order.companies?.company_name ?? '—'}</p></div>
              <div><p className="text-xs text-muted-foreground">Quantity</p><p className="font-medium">{order.requirements?.quantity} {order.requirements?.quantity_unit}</p></div>
              <div><p className="text-xs text-muted-foreground">Total Value</p><p className="font-medium">{order.currency} {Number(order.total_amount).toLocaleString()}</p></div>
              <div><p className="text-xs text-muted-foreground">Order Date</p><p className="font-medium">{new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>
              {order.quotations?.payment_terms && <div><p className="text-xs text-muted-foreground">Payment Terms</p><p className="font-medium">{order.quotations.payment_terms}</p></div>}
              {order.quotations?.delivery_terms && <div><p className="text-xs text-muted-foreground">Delivery Terms</p><p className="font-medium">{order.quotations.delivery_terms}</p></div>}
            </CardContent>
          </Card>

          {/* Tracking details (if shipped) */}
          {(curStatus === 'shipped' || curStatus === 'delivered') && (order.tracking_number || order.tracking_courier) && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Truck className="w-4 h-4 text-primary" />Shipment Tracking</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                {order.tracking_courier && <div><p className="text-xs text-muted-foreground">Courier</p><p className="font-medium">{order.tracking_courier}</p></div>}
                {order.tracking_number && <div><p className="text-xs text-muted-foreground">Tracking Number</p><p className="font-medium font-mono">{order.tracking_number}</p></div>}
                {order.tracking_eta && <div><p className="text-xs text-muted-foreground">Est. Delivery</p><p className="font-medium">{new Date(order.tracking_eta).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p></div>}
              </CardContent>
            </Card>
          )}

          {/* Status Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Status Pipeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <OrderStatusTimeline currentStatus={curStatus} history={history} variant="full" />

              {/* Action buttons */}
              {curStatus !== 'cancelled' && curStatus !== 'delivered' && (
                <div className="pt-4 border-t border-border flex flex-col md:flex-row items-start md:items-center gap-2">
                  {canAdvance && advanceMeta && (
                    <Button
                      onClick={() => setShowAdvance(true)}
                      className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                    >
                      <advanceMeta.icon className="w-4 h-4" />
                      {advanceMeta.label}
                    </Button>
                  )}
                  {canCancel && (
                    <Button
                      variant="outline"
                      onClick={() => setShowCancel(true)}
                      className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/5"
                    >
                      <XCircle className="w-4 h-4" /> Cancel Order
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat */}
          {convId && (
            <Card>
              <CardContent className="pt-5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-sm">Negotiation Room</p>
                  <p className="text-xs text-muted-foreground">Chat with the other party about this order</p>
                </div>
                <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0">
                  <Link to={`${dashBase}/negotiation/${convId}`}>
                    <MessageSquare className="w-4 h-4 mr-2" /> Open Chat
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Advance dialog */}
      <Dialog open={showAdvance} onOpenChange={setShowAdvance}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle>
              {advanceMeta?.label ?? 'Update Status'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              {nextStatus && `This will mark the order as "${STATUS_META[nextStatus]?.label}".`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {needsTracking && (
              <div className="space-y-3 p-3 bg-muted/40 rounded-lg border border-border">
                <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" />Tracking Details</p>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Courier / Carrier</Label>
                  <Input value={trackingCourier} onChange={e => setTrackingCourier(e.target.value)} placeholder="e.g. DHL, FedEx, BlueDart" className="bg-input border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Tracking Number *</Label>
                  <Input value={trackingNumber} onChange={e => setTrackingNumber(e.target.value)} placeholder="e.g. DHL123456789" className="bg-input border-border" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Estimated Delivery Date</Label>
                  <Input type="date" value={trackingEta} onChange={e => setTrackingEta(e.target.value)} className="bg-input border-border" />
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Note (optional)</Label>
              <Textarea
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
                placeholder="Add a note for the other party..."
                rows={3}
                className="bg-input border-border resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAdvance(false)} className="border-border">Cancel</Button>
              <Button onClick={handleAdvance} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                Confirm
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={showCancel} onOpenChange={setShowCancel}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Cancel Order
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-sm">
              This action cannot be undone. Please provide a reason for cancellation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Cancellation Reason *</Label>
              <Textarea
                value={cancelReason}
                onChange={e => setCancelReason(e.target.value)}
                placeholder="e.g. Budget constraints, Specifications changed..."
                rows={3}
                className="bg-input border-border resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowCancel(false)} className="border-border">Go Back</Button>
              <Button
                onClick={handleCancel}
                disabled={saving || !cancelReason.trim()}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                Cancel Order
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
