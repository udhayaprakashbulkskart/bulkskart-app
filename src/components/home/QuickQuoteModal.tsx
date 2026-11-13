/**
 * QuickQuoteModal
 *
 * Inline quick quotation / RFQ modal for Featured Products.
 * Allows buyers to request a quote directly and open direct chat with the supplier immediately.
 */
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, CheckCircle2, MessageSquare, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createRequirement, getOrCreateConversation, sendMessage } from '@/lib/api';
import { supabase } from '@/db/supabase';
import { useNavigate } from 'react-router-dom';
import type { DisplayProduct } from '@/components/home/FeaturedProductsSection';

const UNITS = ['Pieces', 'Pcs', 'Ton', 'KG', 'Meters', 'Sets', 'Boxes', 'Cartons', 'Units'];

interface Props {
  product: DisplayProduct | null;
  open: boolean;
  onClose: () => void;
}

export default function QuickQuoteModal({ product, open, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('Pieces');
  const [targetPrice, setTargetPrice] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [message, setMessage] = useState('');
  const [autoOpenChat, setAutoOpenChat] = useState(true);
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submittedReqId, setSubmittedReqId] = useState<string | null>(null);

  // Extract default quantity from MOQ string e.g. "MOQ: 100 Pieces"
  useEffect(() => {
    if (product?.moq) {
      const match = product.moq.match(/(\d+)\s*(\w+)/);
      if (match) {
        setQuantity(match[1]);
        const u = UNITS.find(un => un.toLowerCase() === match[2].toLowerCase());
        if (u) setUnit(u);
      }
    }
    setSuccess(false);
    setSubmittedReqId(null);
  }, [product]);

  if (!product) return null;

  // Resolve supplier company & owner ID
  const resolveSupplier = async () => {
    let supplierOwnerId = product.supplierOwnerId;
    let companyId = product.companyId;

    if (!supplierOwnerId || !companyId) {
      // Lookup company from DB by company_name or fallback to verified company
      const { data } = await supabase
        .from('companies')
        .select('id, owner_id')
        .ilike('company_name', `%${product.supplierName.split(' ')[0]}%`)
        .maybeSingle();

      if (data) {
        companyId = data.id;
        supplierOwnerId = data.owner_id;
      } else {
        // Fallback to demo verified company
        companyId = 'c45f0f07-6477-4f45-9030-05c9b37ccdfb';
        supplierOwnerId = '16b82a8d-7c89-42b4-b63a-53283b36fa43';
      }
    }
    return { supplierOwnerId, companyId };
  };

  // Open direct chat with the supplier
  const handleOpenDirectChat = async (requirementId?: string | null) => {
    if (!user) {
      navigate('/auth?tab=register&redirect=/messages');
      return;
    }

    setChatLoading(true);
    try {
      const { supplierOwnerId, companyId } = await resolveSupplier();

      if (!supplierOwnerId || !companyId) {
        toast.error('Supplier contact information is currently unavailable.');
        return;
      }

      // Check self-chat
      if (user.id === supplierOwnerId) {
        toast.info('This product is listed by your own account.');
        return;
      }

      // Get or create conversation
      const reqId = requirementId || submittedReqId || undefined;
      const conv = await getOrCreateConversation(user.id, supplierOwnerId, companyId, reqId);

      if (conv?.id) {
        // Post quotation initial message
        const initialText = `Hello ${product.supplierName},\n\nI have submitted a quotation inquiry for "${product.name}".\n• Quantity: ${quantity || '100'} ${unit}\n${targetPrice ? `• Target Price: ₹${targetPrice} per unit\n` : ''}${destinationCity ? `• Destination: ${destinationCity}\n` : ''}${message ? `• Requirements: ${message}\n` : ''}\nPlease let me know your best pricing and lead time.`;

        await sendMessage(conv.id, initialText).catch(() => null);

        toast.success(`Direct chat with ${product.supplierName} opened!`);
        onClose();
        navigate(`/messages?conversation=${conv.id}`);
      } else {
        toast.error('Could not initiate chat. Redirecting to messages inbox.');
        onClose();
        navigate('/messages');
      }
    } catch (err) {
      console.error('Failed to open direct chat:', err);
      toast.error('Failed to initiate conversation. Please try from messages.');
      navigate('/messages');
    } finally {
      setChatLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.info('Please log in or register to submit a quote request.');
      navigate('/auth?tab=register');
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      toast.error('Please enter a valid quantity.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        buyer_id: user.id,
        title: `RFQ for ${product.name}`,
        description: message || `Looking for quotation for ${product.name} with quantity ${quantity} ${unit}. Please provide your best bulk price and delivery lead time.`,
        specifications: `Target Product: ${product.name}\nQuantity: ${quantity} ${unit}\nDestination: ${destinationCity || 'Global'}\nTarget Price: ${targetPrice || 'Negotiable'}`,
        quantity: Number(quantity),
        quantity_unit: unit,
        destination_country: 'India',
        destination_city: destinationCity || null,
        target_price: targetPrice ? Number(targetPrice) : null,
        status: 'active' as const,
        currency: 'INR',
      };

      const res = await createRequirement(payload);
      if (res.error) {
        toast.error(`Failed to submit quote request: ${res.error}`);
      } else {
        const newReqId = res.id ?? null;
        setSubmittedReqId(newReqId);

        if (autoOpenChat) {
          toast.success(`Quote submitted! Connecting to ${product.supplierName}...`);
          await handleOpenDirectChat(newReqId);
        } else {
          setSuccess(true);
          toast.success(`Quote request for ${product.name} submitted successfully!`);
        }
      }
    } catch (err) {
      console.error('QuickQuote submit error:', err);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={val => { if (!val) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border border-border text-foreground p-4 sm:p-5 rounded-2xl shadow-2xl max-h-[92dvh] overflow-y-auto">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#C94400] animate-pulse" />
            <DialogTitle className="text-lg md:text-xl font-bold text-foreground">
              Request Quick Quote
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Submit your inquiry for <strong className="text-foreground">{product.name}</strong> and chat directly with verified supplier <strong className="text-foreground">{product.supplierName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-[#FF7A2E] mx-auto animate-bounce" />
            <div className="space-y-1">
              <h4 className="text-base font-bold text-foreground">Quote Request Submitted!</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Your RFQ for <strong className="text-foreground">{product.name}</strong> has been recorded and broadcast to verified suppliers.
              </p>
            </div>

            {/* Direct Chat Primary Button */}
            <div className="p-3 bg-muted/50 border border-border rounded-xl space-y-2">
              <p className="text-xs text-foreground font-medium">
                Want an immediate response on price negotiation & specifications?
              </p>
              <Button
                onClick={() => handleOpenDirectChat(submittedReqId)}
                disabled={chatLoading}
                className="w-full bg-[#C94400] hover:bg-[#B33D00] text-white font-bold text-xs h-10 rounded-xl shadow-[0_2px_12px_rgba(255,90,0,0.45)] gap-2"
              >
                {chatLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4" />
                )}
                <span>Chat Directly with {product.supplierName}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="pt-2 flex gap-2 justify-center">
              <Button
                variant="outline"
                onClick={onClose}
                className="border-border text-xs h-9 px-4 rounded-xl hover:bg-muted"
              >
                Close
              </Button>
              <Button
                variant="outline"
                onClick={() => { onClose(); navigate('/buyer/requirements'); }}
                className="border-border text-xs h-9 px-4 rounded-xl hover:bg-muted"
              >
                View My RFQs
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-2">
            {/* Product Summary Card */}
            <div className="flex items-center gap-3 bg-muted/40 border border-border p-2.5 rounded-xl">
              <img
                src={product.img}
                alt={product.name}
                className="w-12 h-12 rounded-lg object-cover bg-muted border border-border shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground truncate">{product.name}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                  <span>{product.moq}</span>
                  <span>•</span>
                  <span className="text-[#FF7A2E] dark:text-[#FF7A2E] font-semibold flex items-center gap-0.5">
                    <ShieldCheck className="w-3 h-3 inline" /> {product.supplierName}
                  </span>
                </div>
              </div>
            </div>

            {/* Quantity and Unit */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1 min-w-0">
                <Label className="text-xs text-foreground font-medium">Required Quantity *</Label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  placeholder="e.g. 500"
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground h-9 text-xs rounded-xl focus:border-[#FF5A00] w-full"
                />
              </div>
              <div className="space-y-1 min-w-0">
                <Label className="text-xs text-foreground font-medium">Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="bg-card border-border text-foreground h-9 text-xs rounded-xl focus:border-[#FF5A00] w-full">
                    <SelectValue placeholder="Select Unit" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border text-foreground">
                    {UNITS.map(u => (
                      <SelectItem key={u} value={u} className="text-xs text-foreground hover:bg-muted">
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Target Price and Destination City */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1 min-w-0">
                <Label className="text-xs text-foreground font-medium">Target Price (Per Unit)</Label>
                <Input
                  type="number"
                  value={targetPrice}
                  onChange={e => setTargetPrice(e.target.value)}
                  placeholder="Optional (₹)"
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground h-9 text-xs rounded-xl focus:border-[#FF5A00] w-full"
                />
              </div>
              <div className="space-y-1 min-w-0">
                <Label className="text-xs text-foreground font-medium">Delivery City</Label>
                <Input
                  type="text"
                  value={destinationCity}
                  onChange={e => setDestinationCity(e.target.value)}
                  placeholder="e.g. Mumbai, Delhi"
                  className="bg-card border-border text-foreground placeholder:text-muted-foreground h-9 text-xs rounded-xl focus:border-[#FF5A00] w-full"
                />
              </div>
            </div>

            {/* Detailed Instructions / Requirements */}
            <div className="space-y-1 min-w-0">
              <Label className="text-xs text-foreground font-medium">Requirement Details / Remarks</Label>
              <Textarea
                rows={2}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Specify customizations, packaging preferences, certification needs, or delivery timelines..."
                className="bg-card border-border text-foreground placeholder:text-muted-foreground text-xs rounded-xl resize-none focus:border-[#FF5A00] w-full"
              />
            </div>

            {/* Auto Open Direct Chat Checkbox */}
            <div className="flex items-center gap-2 p-2.5 bg-muted/40 border border-border rounded-xl cursor-pointer" onClick={() => setAutoOpenChat(!autoOpenChat)}>
              <input
                type="checkbox"
                id="autoChat"
                checked={autoOpenChat}
                onChange={e => setAutoOpenChat(e.target.checked)}
                className="accent-[#FF5A00] w-4 h-4 rounded cursor-pointer shrink-0"
              />
              <label htmlFor="autoChat" className="text-xs text-foreground flex-1 cursor-pointer select-none flex items-center gap-1.5 min-w-0">
                <MessageSquare className="w-3.5 h-3.5 text-[#FF5A00] shrink-0" />
                <span className="truncate sm:whitespace-normal">Open direct chat with supplier immediately after submit</span>
              </label>
            </div>

            {/* Buttons */}
            <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading || chatLoading}
                className="border-border hover:bg-muted text-xs h-9 rounded-xl px-4 w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || chatLoading}
                className="bg-[#C94400] hover:bg-[#B33D00] text-white font-bold text-xs h-9 rounded-xl px-5 shadow-[0_2px_12px_rgba(255,90,0,0.4)] gap-1.5 w-full sm:w-auto"
              >
                {loading || chatLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{autoOpenChat ? 'Submit & Chat Now' : 'Submit Quote Request'}</span>
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
