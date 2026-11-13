import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/db/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Zap, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const UNITS = ['Pcs', 'Units', 'MT', 'KG', 'Tons', 'Boxes', 'Cartons', 'Liters', 'Meters', 'Pairs', 'Sets'];
const COUNTRIES = ['India', 'UAE', 'USA', 'UK', 'Germany', 'Singapore', 'Australia', 'Canada', 'China', 'Japan', 'Other'];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  productId: string;
  productName: string;
  supplierCompanyId: string;
  supplierName: string;
  moq?: number;
  moqUnit?: string;
}

export default function InstantQuoteDialog({
  open, onOpenChange, productId, productName, supplierCompanyId, supplierName,
  moq = 1, moqUnit = 'Pcs'
}: Props) {
  const { user, profile } = useAuth();
  const [qty, setQty] = useState(String(moq));
  const [unit, setUnit] = useState(moqUnit);
  const [country, setCountry] = useState('India');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { toast.error('Please log in'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('instant_quote_requests').insert({
      product_id: productId,
      buyer_id: user.id,
      supplier_company_id: supplierCompanyId,
      quantity: parseInt(qty) || moq,
      quantity_unit: unit,
      destination_country: country,
      message: message.trim() || null,
      status: 'pending',
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setDone(true);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => { setDone(false); setMessage(''); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md bg-card border-border max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Instant Quote Request
          </DialogTitle>
        </DialogHeader>

        {!user || profile?.role !== 'buyer' ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground mb-4">Please log in as a buyer to request a quote.</p>
            <Link to="/auth"><Button className="bg-[#1A0C05] text-primary-foreground">Login / Register</Button></Link>
          </div>
        ) : done ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-12 h-12 text-[#FF7A2E] mx-auto mb-3" />
            <p className="text-base font-bold text-foreground mb-1">Quote Request Sent!</p>
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-medium text-foreground">{supplierName}</span> will respond with pricing within 24 hours.
            </p>
            <Button onClick={handleClose} className="bg-[#1A0C05] text-primary-foreground">Done</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mt-1">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-semibold text-foreground truncate">{productName}</p>
              <p className="text-xs text-muted-foreground">from {supplierName}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Quantity *</Label>
                <Input
                  type="number" min="1" required
                  value={qty} onChange={e => setQty(e.target.value)}
                  className="bg-input border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Destination Country</Label>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger className="bg-input border-border"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {COUNTRIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Additional Requirements (optional)</Label>
              <Textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                placeholder="e.g. Custom color, branding, certification requirements, delivery timeline…"
                className="bg-input border-border resize-none text-sm"
              />
            </div>

            <Button type="submit" disabled={submitting} className="w-full bg-[#1A0C05] text-primary-foreground hover:bg-primary/90 gap-2">
              {submitting
                ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                : <><Zap className="w-4 h-4" /> Send Quote Request</>}
            </Button>
            <p className="text-center text-xs text-muted-foreground">Supplier will respond within 24 hours</p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
