import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Package, RefreshCw, CheckCircle2, MapPin, Info } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string;
  productName: string;
  supplierCompanyId: string;
  supplierName: string;
  moqUnit?: string;
}

export default function SampleRequestDialog({
  open, onOpenChange, productId, productName, supplierCompanyId, supplierName, moqUnit = 'Pcs'
}: Props) {
  const { user, profile } = useAuth();
  const [qty, setQty] = useState('1');
  const [purpose, setPurpose] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error('Please log in to request a sample'); return; }
    if (!address.trim()) { toast.error('Shipping address is required'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('sample_requests').insert({
      product_id: productId,
      buyer_id: user.id,
      supplier_company_id: supplierCompanyId,
      quantity: parseInt(qty) || 1,
      purpose: purpose.trim() || null,
      shipping_address: address.trim(),
      status: 'pending',
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => { setDone(false); setQty('1'); setPurpose(''); setAddress(''); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" /> Request Sample
          </DialogTitle>
        </DialogHeader>

        {!user || profile?.role !== 'buyer' ? (
          <div className="text-center py-6">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">Please log in as a buyer to request samples.</p>
            <Link to="/auth">
              <Button className="bg-[#1A0C05] text-primary-foreground">Login / Register</Button>
            </Link>
          </div>
        ) : done ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-[#FF7A2E] mx-auto mb-3" />
            <p className="text-base font-bold text-foreground mb-1">Sample Request Sent!</p>
            <p className="text-sm text-muted-foreground mb-4">
              Your request has been sent to <span className="text-foreground font-medium">{supplierName}</span>.
              They will review and respond within 1–2 business days.
            </p>
            <Button onClick={handleClose} className="bg-[#1A0C05] text-primary-foreground">Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
            {/* Product info */}
            <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
              <Package className="w-8 h-8 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{productName}</p>
                <p className="text-xs text-muted-foreground">by {supplierName}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Sample Quantity ({moqUnit})</Label>
              <Input
                type="number" min="1" max="10"
                value={qty}
                onChange={e => setQty(e.target.value)}
                className="bg-input border-border"
              />
              <p className="text-[10px] text-muted-foreground">Sample orders are typically 1–10 units.</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Purpose / Intended Use</Label>
              <Textarea
                value={purpose}
                onChange={e => setPurpose(e.target.value)}
                rows={2}
                placeholder="e.g. Quality evaluation before bulk order of 500 units"
                className="bg-input border-border resize-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> Shipping Address *
              </Label>
              <Textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                rows={3}
                required
                placeholder="Full delivery address including city, state, PIN code and country"
                className="bg-input border-border resize-none text-sm"
              />
            </div>

            <div className="flex items-start gap-2 bg-[#FF5A00]/10 dark:bg-[#B33D00]/20 border border-[#FF5A00]/50 rounded-lg p-2.5 text-xs text-[#FF7A2E] dark:text-[#FF7A2E]">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p>Sample pricing and shipping costs will be communicated by the supplier. Samples may or may not be free.</p>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#1A0C05] text-primary-foreground hover:bg-primary/90"
            >
              {submitting
                ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Sending…</>
                : 'Send Sample Request'}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
