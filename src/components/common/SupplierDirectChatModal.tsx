import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { sendDirectSupplierInquiry } from '@/lib/api';
import type { Company, Product } from '@/types/types';
import {
  MessageSquare, Send, ShieldCheck, Building2, Package, CheckCircle2,
  Clock, AlertCircle, Phone, Mail, User, Sparkles, Loader2, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: Company;
  selectedProduct?: Product | null;
  onSuccess?: () => void;
}

interface MessageItem {
  id: string;
  sender: 'buyer' | 'supplier';
  sender_name: string;
  text: string;
  time: string;
}

export default function SupplierDirectChatModal({
  open,
  onOpenChange,
  company,
  selectedProduct,
  onSuccess,
}: Props) {
  const { user, profile } = useAuth();

  // Buyer input state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('Units');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Active chat session state (after first message or during conversation)
  const [conversationStarted, setConversationStarted] = useState(false);
  const [thread, setThread] = useState<MessageItem[]>([]);
  const [followUpText, setFollowUpText] = useState('');
  const [followUpSending, setFollowUpSending] = useState(false);

  // Auto-fill if user is logged in
  useEffect(() => {
    if (user && profile) {
      setName(profile.full_name || user.email?.split('@')[0] || 'Buyer');
      setEmail(user.email || '');
      setPhone(profile.phone || '');
    }
  }, [user, profile]);

  // Reset or preset message when opened
  useEffect(() => {
    if (open) {
      if (selectedProduct) {
        setMessage(`Hello ${company.company_name},\n\nI am interested in procuring "${selectedProduct.name}". Please share current wholesale pricing, MOQ, lead time, and export packing specifications.`);
        setQuantity(String(selectedProduct.moq || 100));
        setQuantityUnit(selectedProduct.moq_unit || 'Units');
      } else if (!message) {
        setMessage(`Hello ${company.company_name},\n\nI would like to connect regarding your manufacturing capabilities and request a product catalog with trade terms.`);
      }
    }
  }, [open, selectedProduct, company.company_name]);

  const QUICK_PROMPTS = [
    'Request formal quotation & CIF pricing',
    'Ask about sample availability & lead time',
    'Inquire about custom OEM batch production',
    'Request factory audit & ISO certificates',
  ];

  const handleQuickPrompt = (prompt: string) => {
    setMessage(prev => {
      if (!prev.trim()) return prompt;
      return `${prev}\n\n• ${prompt}`;
    });
  };

  const handleInitialSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      toast.error('Please enter a valid business email address');
      return;
    }
    if (!message.trim()) {
      toast.error('Please write your message or requirement');
      return;
    }

    setSubmitting(true);
    try {
      const parsedQty = quantity ? parseInt(quantity, 10) : undefined;
      const res = await sendDirectSupplierInquiry({
        supplier_company_id: company.id,
        supplier_id: company.owner_id || null,
        product_id: selectedProduct?.id || null,
        product_name: selectedProduct?.name || null,
        product_slug: selectedProduct?.slug || null,
        buyer_id: user?.id || null,
        sender_name: name.trim(),
        sender_email: email.trim(),
        sender_phone: phone.trim() || undefined,
        sender_company: companyName.trim() || undefined,
        subject: selectedProduct ? `Inquiry for ${selectedProduct.name}` : `Direct Business Inquiry for ${company.company_name}`,
        message: message.trim(),
        target_quantity: !isNaN(parsedQty as number) ? parsedQty : undefined,
        quantity_unit: quantityUnit || 'Units',
      });

      if (res.error) {
        toast.error(`Could not deliver message: ${res.error}`);
        setSubmitting(false);
        return;
      }

      toast.success(`Message sent directly to ${company.company_name}'s dashboard!`, {
        description: 'The supplier has received an instant notification and will respond shortly.',
      });

      const initialItem: MessageItem = {
        id: `msg-${Date.now()}`,
        sender: 'buyer',
        sender_name: name.trim(),
        text: message.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setThread([initialItem]);
      setConversationStarted(true);
      onSuccess?.();
    } catch (err: any) {
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFollowUpSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpText.trim() || followUpSending) return;

    setFollowUpSending(true);
    try {
      await sendDirectSupplierInquiry({
        supplier_company_id: company.id,
        supplier_id: company.owner_id || null,
        product_id: selectedProduct?.id || null,
        product_name: selectedProduct?.name || null,
        product_slug: selectedProduct?.slug || null,
        buyer_id: user?.id || null,
        sender_name: name.trim() || 'Buyer',
        sender_email: email.trim(),
        sender_phone: phone.trim() || undefined,
        subject: `Follow-up Message to ${company.company_name}`,
        message: followUpText.trim(),
      });

      const newItem: MessageItem = {
        id: `msg-${Date.now()}`,
        sender: 'buyer',
        sender_name: name.trim() || 'You',
        text: followUpText.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setThread(prev => [...prev, newItem]);
      setFollowUpText('');
      toast.success('Follow-up message delivered to supplier!');
    } catch {
      toast.error('Failed to send follow-up message');
    } finally {
      setFollowUpSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl max-h-[90dvh] overflow-y-auto p-0 bg-card border-border">
        {/* Header */}
        <div className="p-5 border-b border-border/80 bg-muted/30">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                {company.logo_url ? (
                  <img src={company.logo_url} alt={company.company_name} className="w-full h-full object-contain p-1" />
                ) : (
                  <Building2 className="w-6 h-6 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-base md:text-lg font-bold text-foreground flex items-center gap-1.5 truncate">
                  {company.company_name}
                  {company.is_verified && (
                    <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                  <span>{company.city || company.country || 'Verified Factory'}</span>
                  <span>•</span>
                  <span className="text-[#FF7A2E] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Typically replies in ~2h
                  </span>
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/10 shrink-0">
              Direct Chat
            </Badge>
          </div>

          {/* Product context banner if chat is initiated from product */}
          {selectedProduct && (
            <div className="mt-3.5 p-2.5 rounded-lg bg-background/80 border border-border/80 flex items-center gap-3">
              {selectedProduct.images?.[0] ? (
                <img
                  src={selectedProduct.images[0]}
                  alt={selectedProduct.name}
                  className="w-10 h-10 rounded object-cover border border-border shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{selectedProduct.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  MOQ: {selectedProduct.moq} {selectedProduct.moq_unit || 'Units'} • {selectedProduct.price_currency || 'USD'} {selectedProduct.price_min || 'RFQ'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Body: Live Conversation View or Initial Inquiry Form */}
        {conversationStarted ? (
          <div className="p-5 space-y-4">
            <div className="p-3 bg-[#FF5A00]/10 border border-[#FF5A00]/20 rounded-lg flex items-center gap-2.5 text-xs text-[#FF7A2E]">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <div>
                <p className="font-semibold">Message delivered to supplier dashboard inbox</p>
                <p className="text-[#FF7A2E]/80 text-[11px]">The sales desk of {company.company_name} has received your inquiry at {email}.</p>
              </div>
            </div>

            {/* Chat Thread */}
            <div className="bg-background/50 border border-border rounded-xl p-3 min-h-[160px] max-h-[260px] overflow-y-auto space-y-3">
              {thread.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'buyer' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{msg.sender_name}</span>
                    <span>{msg.time}</span>
                  </div>
                  <div
                    className={`p-3 rounded-2xl max-w-[85%] text-xs whitespace-pre-wrap leading-relaxed shadow-sm ${
                      msg.sender === 'buyer'
                        ? 'bg-[#1A0C05] text-primary-foreground rounded-tr-none'
                        : 'bg-muted text-foreground border border-border rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Follow-up input form */}
            <form onSubmit={handleFollowUpSend} className="space-y-2">
              <div className="relative">
                <Input
                  value={followUpText}
                  onChange={(e) => setFollowUpText(e.target.value)}
                  placeholder="Type a follow-up message..."
                  className="pr-20 text-xs h-10 bg-background"
                  disabled={followUpSending}
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!followUpText.trim() || followUpSending}
                  className="absolute right-1 top-1 bottom-1 h-8 px-3 bg-[#C94400] text-primary-foreground font-semibold gap-1 text-xs"
                >
                  {followUpSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Send
                </Button>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border/60">
                <Link
                  to="/dashboard/supplier/messages"
                  onClick={() => onOpenChange(false)}
                  className="w-full sm:w-auto text-xs font-semibold text-primary hover:underline flex items-center justify-center gap-1.5 py-1"
                >
                  Inspect in Supplier Messages Inbox <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="w-full sm:w-auto h-8 text-xs border-border"
                >
                  Close
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <form onSubmit={handleInitialSend} className="p-5 space-y-4">
            {/* Sender Identity Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-primary" /> Your Contact Information
                </label>
                {user ? (
                  <span className="text-[11px] text-primary flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Logged In
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Anyone can send an inquiry directly
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                <div>
                  <Input
                    placeholder="Your Full Name *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-9 text-xs bg-background"
                  />
                </div>
                <div>
                  <Input
                    type="email"
                    placeholder="Work / Business Email *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-9 text-xs bg-background"
                  />
                </div>
                <div>
                  <Input
                    placeholder="WhatsApp / Phone Number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-9 text-xs bg-background"
                  />
                </div>
                <div>
                  <Input
                    placeholder="Company / Business Name"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-9 text-xs bg-background"
                  />
                </div>
              </div>
            </div>

            {/* Requirement / Quantity */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Target Quantity (Optional)</label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="h-9 text-xs bg-background"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-1">Unit</label>
                <Input
                  placeholder="Pieces / Metric Tons / Sets"
                  value={quantityUnit}
                  onChange={(e) => setQuantityUnit(e.target.value)}
                  className="h-9 text-xs bg-background"
                />
              </div>
            </div>

            {/* Quick Prompts */}
            <div>
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1.5">
                <Sparkles className="w-3 h-3 text-primary" /> Quick Suggestion Prompts:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => handleQuickPrompt(prompt)}
                    className="text-[11px] px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground border border-border/80 transition-colors"
                  >
                    + {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Message / Specifications <span className="text-[#FF7A2E]">*</span>
              </label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your requirement, customized branding requests, target destination port, or questions for the manufacturer..."
                rows={4}
                required
                className="text-xs bg-background resize-none leading-relaxed"
              />
            </div>

            {/* Trust footer & Submit */}
            <div className="pt-2 flex flex-col md:flex-row items-center justify-between gap-3 border-t border-border/60">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                <span>BulkSkart Direct Factory Routing • Encrypted transmission</span>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 md:flex-none h-9 text-xs border-border"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="flex-1 md:flex-none h-9 px-5 bg-[#C94400] text-primary-foreground hover:bg-primary/90 font-bold gap-1.5 text-xs shadow-md"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Delivering...
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" /> Send Message to Supplier
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
