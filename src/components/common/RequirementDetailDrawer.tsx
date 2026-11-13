/**
 * RequirementDetailDrawer
 *
 * A full-featured side drawer that shows:
 *  - Requirement detail + deal status timeline
 *  - All supplier quotations (buyer can accept/reject)
 *  - Inline chat with the selected supplier
 *
 * Completely additive — does not modify any existing page code.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import SafeImage from '@/components/common/SafeImage';
import { getRequirementVisualInfo } from '@/lib/requirementVisuals';
import { RFQ_LICENSED_IMAGES } from '@/lib/rfqLicensedImages';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Send, Loader2, MessageSquare, CheckCircle, XCircle,
  Upload, Building2, Calendar, Package, BadgeCheck, Zap,
  Clock, TrendingUp, ShieldCheck, Lock,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import {
  getQuotationsForRequirement, getMessages, sendMessage,
  getOrCreateConversation, updateQuotationStatus, updateRequirement,
  checkDirectMessageQuota, checkSupplierPaidSubscription
} from '@/lib/api';
import type { Requirement, Quotation, Message } from '@/types/types';
import { useAuth } from '@/contexts/AuthContext';
import BuyerQuotationsPanel from './BuyerQuotationsPanel';
import SubscribeToContactDialog, { type SubscriptionReason } from './SubscribeToContactDialog';
import SupplierRespondDialog from './SupplierRespondDialog';

// ── Deal status pipeline ────────────────────────────────────────────────────────
const DEAL_STEPS = [
  { key: 'active',             label: 'Active',             icon: Zap },
  { key: 'responses_received', label: 'Responses',          icon: MessageSquare },
  { key: 'negotiation',        label: 'Negotiation',        icon: TrendingUp },
  { key: 'deal_finalized',     label: 'Deal Finalized',     icon: ShieldCheck },
  { key: 'fulfilled',          label: 'Fulfilled',          icon: CheckCircle },
  { key: 'closed',             label: 'Closed',             icon: XCircle },
];

function DealStatusBar({ status, isBuyer, onAdvance }: { status: string; isBuyer: boolean; onAdvance: (s: string) => void }) {
  const idx = DEAL_STEPS.findIndex(s => s.key === status);
  return (
    <div className="bg-muted rounded-xl p-4 mb-4">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">Deal Status</p>
      <div className="flex items-center gap-1 flex-wrap">
        {DEAL_STEPS.map((step, i) => {
          const Icon = step.icon;
          const done = i < idx;
          const active = i === idx;
          return (
            <React.Fragment key={step.key}>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold transition-colors ${active ? 'bg-[#C94400] text-white' : done ? 'bg-[#FF5A00]/15 text-[#FF5A00]' : 'bg-background border border-border text-muted-foreground/50'}`}>
                <Icon className="w-3 h-3" />
                {step.label}
              </div>
              {i < DEAL_STEPS.length - 1 && <span className={`text-[10px] ${done ? 'text-[#FF5A00]' : 'text-border'}`}>›</span>}
            </React.Fragment>
          );
        })}
      </div>
      {isBuyer && idx < DEAL_STEPS.length - 1 && (
        <button
          onClick={() => onAdvance(DEAL_STEPS[idx + 1].key)}
          className="mt-3 text-[11px] font-semibold text-[#FF5A00] hover:underline"
        >
          → Advance to "{DEAL_STEPS[idx + 1].label}"
        </button>
      )}
    </div>
  );
}

// ── Quotation card ──────────────────────────────────────────────────────────────
function QuoteCard({ q, isBuyer, onAccept, onReject, onChat }: {
  q: Quotation; isBuyer: boolean;
  onAccept: (q: Quotation) => void;
  onReject: (q: Quotation) => void;
  onChat: (q: Quotation) => void;
}) {
  const statusColor = q.status === 'accepted' ? 'bg-[#FF5A00]/10 border-[#FF5A00]/30 text-[#FF7A2E]'
    : q.status === 'rejected' ? 'bg-destructive/10 border-destructive/30 text-destructive'
    : 'bg-primary/10 border-primary/30 text-primary';

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Building2 className="w-3.5 h-3.5 text-[#FF5A00] shrink-0" />
            <span className="text-[13px] font-bold text-foreground truncate">
              {q.companies?.company_name ?? 'Supplier'}
            </span>
            {q.companies?.verification_status === 'verified' && (
              <BadgeCheck className="w-3.5 h-3.5 text-[#FF5A00]" />
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {q.companies?.city ?? ''}{q.companies?.city && q.companies?.country ? ', ' : ''}{q.companies?.country ?? ''}
          </span>
        </div>
        <Badge className={`text-[10px] px-2 py-0.5 border shrink-0 ${statusColor}`}>
          {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
        </Badge>
      </div>

      {/* Price grid */}
      <div className="grid grid-cols-2 gap-2 text-[12px]">
        <div className="bg-muted rounded-lg p-2">
          <p className="text-muted-foreground text-[10px] mb-0.5">Unit Price</p>
          <p className="font-black text-foreground text-[15px]">
            {q.currency} {q.unit_price.toLocaleString()}
          </p>
        </div>
        <div className="bg-muted rounded-lg p-2">
          <p className="text-muted-foreground text-[10px] mb-0.5">MOQ</p>
          <p className="font-bold text-foreground">{q.moq.toLocaleString()} {q.moq_unit}</p>
        </div>
        {q.delivery_days && (
          <div className="bg-muted rounded-lg p-2">
            <p className="text-muted-foreground text-[10px] mb-0.5">Delivery</p>
            <p className="font-bold text-foreground">{q.delivery_days} days</p>
          </div>
        )}
        {/* @ts-expect-error shipping_cost extended col */}
        {q.shipping_cost && (
          <div className="bg-muted rounded-lg p-2">
            <p className="text-muted-foreground text-[10px] mb-0.5">Shipping</p>
            {/* @ts-expect-error shipping_cost extended col */}
            <p className="font-bold text-foreground">{q.currency} {q.shipping_cost.toLocaleString()}</p>
          </div>
        )}
      </div>

      {q.payment_terms && (
        <p className="text-[11px] text-muted-foreground">
          <span className="font-semibold text-foreground">Payment:</span> {q.payment_terms}
          {q.delivery_terms ? ` · ${q.delivery_terms}` : ''}
          {' · '}Valid {q.validity_days}d
        </p>
      )}
      {q.notes && <p className="text-[12px] text-muted-foreground bg-muted rounded-lg p-2 italic">"{q.notes}"</p>}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => onChat(q)}
          className="flex-1 bg-[#C94400] hover:bg-primary/90 text-primary-foreground text-[11px] h-8 gap-1"
        >
          <MessageSquare className="w-3 h-3" /> Chat / Negotiate
        </Button>
        {isBuyer && q.status === 'pending' && (
          <>
            <Button size="sm" onClick={() => onAccept(q)}
              className="bg-[#B33D00] hover:bg-[#B33D00] text-white text-[11px] h-8 px-3 gap-1">
              <CheckCircle className="w-3 h-3" /> Accept
            </Button>
            <Button size="sm" onClick={() => onReject(q)} variant="ghost"
              className="border border-destructive/30 text-destructive hover:bg-destructive/10 text-[11px] h-8 px-3 gap-1">
              <XCircle className="w-3 h-3" /> Reject
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Inline chat panel ───────────────────────────────────────────────────────────
function ChatPanel({ conversationId, currentUserId }: { conversationId: string; currentUserId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const data = await getMessages(conversationId);
    setMessages(data.reverse()); // oldest first
  }, [conversationId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      const chName = `chat-${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      ch = supabase
        .channel(chName)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          () => { load(); })
        .subscribe();
    } catch (e) {
      console.warn('RequirementDetailDrawer realtime subscription skipped:', e);
    }
    return () => { 
      if (ch) supabase.removeChannel(ch); 
    };
  }, [conversationId, load]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSending(true);
    const { error } = await sendMessage(conversationId, text.trim());
    setSending(false);
    if (error) { toast.error(error); return; }
    setText('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('File must be under 10 MB'); return; }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `chat/${conversationId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from('chat-files').upload(path, file);
    if (error) { toast.error('Upload failed'); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('chat-files').getPublicUrl(data.path);
    await sendMessage(conversationId, `📎 [File](${urlData.publicUrl})`);
    setUploading(false);
  };

  const timeLabel = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-[12px] text-muted-foreground mt-8">
            No messages yet. Start the conversation!
          </p>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === currentUserId;
          const isFile = msg.content.startsWith('📎 [File]');
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-[12px] ${isMe ? 'bg-[#C94400] text-white rounded-br-none' : 'bg-card border border-border text-foreground rounded-bl-none'}`}>
                {isFile ? (
                  <a href={msg.content.match(/\((.+)\)/)?.[1]} target="_blank" rel="noreferrer"
                    className={`underline ${isMe ? 'text-white' : 'text-[#FF5A00]'}`}>
                    View attachment
                  </a>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                )}
                <p className={`text-[9px] mt-1 text-right ${isMe ? 'text-white/60' : 'text-muted-foreground/60'}`}>
                  {timeLabel(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 flex items-center gap-2 bg-card">
        <label className="shrink-0 cursor-pointer text-muted-foreground hover:text-[#FF5A00] transition-colors">
          <Upload className="w-4 h-4" />
          <input type="file" className="hidden" accept="image/*,.pdf,.doc,.docx" onChange={handleFileUpload} disabled={uploading} />
        </label>
        <Input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Type a message… (Enter to send)"
          className="flex-1 border-border text-[13px] h-9"
          disabled={sending || uploading}
        />
        <Button size="sm" onClick={handleSend} disabled={sending || uploading || !text.trim()}
          className="bg-[#C94400] hover:bg-[#B33D00] text-white h-9 px-3 gap-1">
          {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

// ── Main Drawer ─────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  requirement: Requirement | null;
  onRequirementUpdated: (req: Requirement) => void;
}

export default function RequirementDetailDrawer({ open, onClose, requirement, onRequirementUpdated }: Props) {
  const { user, profile, company } = useAuth();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [subDialogReason, setSubDialogReason] = useState<SubscriptionReason>('no_subscription');
  const [respondDialogOpen, setRespondDialogOpen] = useState(false);

  const isBuyer = profile?.role === 'buyer';

  const loadQuotes = useCallback(async () => {
    if (!requirement) return;
    setLoadingQuotes(true);
    const data = await getQuotationsForRequirement(requirement.id);
    setQuotes(data);
    setLoadingQuotes(false);
  }, [requirement]);

  useEffect(() => {
    if (open && requirement) { loadQuotes(); setActiveConvId(null); setActiveTab('overview'); }
  }, [open, requirement, loadQuotes]);

  const handleAdvanceDealStatus = async (nextStatus: string) => {
    if (!requirement) return;
    const { error } = await updateRequirement(requirement.id, {
      // @ts-expect-error — new col
      deal_status: nextStatus,
      updated_at: new Date().toISOString(),
    });
    if (error) { toast.error(error); return; }
    // @ts-expect-error
    onRequirementUpdated({ ...requirement, deal_status: nextStatus });
    toast.success(`Status → ${nextStatus.replace(/_/g, ' ')}`);
  };

  const handleAcceptQuote = async (q: Quotation) => {
    const { error } = await updateQuotationStatus(q.id, 'accepted');
    if (error) { toast.error(error); return; }
    toast.success('Quote accepted! Opening negotiation…');
    setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, status: 'accepted' } : x));
    await handleAdvanceDealStatus('negotiation');
    handleOpenChat(q);
  };

  const handleRejectQuote = async (q: Quotation) => {
    const { error } = await updateQuotationStatus(q.id, 'rejected');
    if (error) { toast.error(error); return; }
    toast.success('Quote rejected');
    setQuotes(prev => prev.map(x => x.id === q.id ? { ...x, status: 'rejected' } : x));
  };

  const handleOpenChat = async (q: Quotation) => {
    if (!user) {
      setSubDialogReason('not_logged_in');
      setSubDialogOpen(true);
      return;
    }
    // Subscription paid companies only can send messages
    if (!isBuyer) {
      if (!company) {
        setSubDialogReason('not_registered_business');
        setSubDialogOpen(true);
        return;
      }
      const subCheck = await checkSupplierPaidSubscription(company.id, company);
      if (!subCheck.allowed) {
        setSubDialogReason(subCheck.reason);
        setSubDialogOpen(true);
        return;
      }
      const quota = await checkDirectMessageQuota(company.id, company);
      if (quota !== 'ok') {
        setSubDialogReason(quota);
        setSubDialogOpen(true);
        return;
      }
    }

    const buyerId = isBuyer ? user.id : q.buyer_id;
    const supplierId = isBuyer ? q.supplier_id : user.id;
    const supplierCompanyId = q.supplier_company_id;
    const { id: convId, error } = await getOrCreateConversation(buyerId, supplierId, supplierCompanyId, requirement?.id);
    if (error || !convId) { toast.error('Could not open chat'); return; }
    setActiveConvId(convId);
    setActiveTab('chat');
  };

  if (!requirement) return null;

  // @ts-expect-error
  const dealStatus: string = requirement.deal_status ?? 'active';

  const reqDate = new Date(requirement.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:w-[600px] max-w-[100vw] flex flex-col p-0 bg-background border-l border-border overflow-hidden">
        {/* Header */}
        <SheetHeader className="bg-card border-b border-border text-foreground px-5 py-4 shrink-0">
          <SheetTitle className="text-[15px] font-black text-foreground leading-snug pr-6">
            {requirement.title}
          </SheetTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {requirement.categories && (
              <span className="text-[10px] font-semibold text-[#FF5A00] bg-[#FF5A00]/15 px-2 py-0.5 rounded-full">
                {requirement.categories.name}
              </span>
            )}
            {requirement.req_number && (
              <span className="text-[10px] text-muted-foreground">{requirement.req_number}</span>
            )}
            {/* @ts-expect-error */}
            {requirement.is_urgent && (
              <span className="text-[10px] font-bold text-[#FF7A2E] flex items-center gap-1">
                <Zap className="w-3 h-3" /> URGENT
              </span>
            )}
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0 mx-4 mt-3 bg-card border border-border rounded-xl h-9 p-0.5">
            <TabsTrigger value="overview" className="flex-1 text-[12px] h-8 rounded-lg data-[state=active]:bg-[#C94400] data-[state=active]:text-white">
              Overview
            </TabsTrigger>
            <TabsTrigger value="quotes" className="flex-1 text-[12px] h-8 rounded-lg data-[state=active]:bg-[#C94400] data-[state=active]:text-white">
              Quotes {quotes.length > 0 && <span className="ml-1 bg-[#FF5A00]/15 text-[#FF5A00] rounded-full px-1.5 text-[10px]">{quotes.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex-1 text-[12px] h-8 rounded-lg data-[state=active]:bg-[#C94400] data-[state=active]:text-white">
              Chat
            </TabsTrigger>
          </TabsList>

          {/* Overview tab */}
          <TabsContent value="overview" className="h-[calc(100dvh-160px)] min-h-0 overflow-y-auto p-4 space-y-4 mt-0 pb-10">
            <DealStatusBar status={dealStatus} isBuyer={!!isBuyer} onAdvance={handleAdvanceDealStatus} />

            {/* Requirement Reference Visual */}
            <div className="rounded-xl overflow-hidden border border-border bg-muted/40 relative aspect-video max-h-48">
              <SafeImage
                src={getRequirementVisualInfo(requirement, 0).image}
                alt={requirement.title}
                type="rfq"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-background/85 backdrop-blur-sm border border-border/50 px-2 py-0.5 rounded text-[10px] font-medium text-foreground">
                Requirement Visual Reference
              </div>
            </div>

            {/* Details card */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <p className="text-muted-foreground text-[10px] mb-0.5">Quantity</p>
                  <p className="font-bold text-foreground">{requirement.quantity.toLocaleString()} {requirement.quantity_unit}</p>
                </div>
                {requirement.destination_country && (
                  <div>
                    <p className="text-muted-foreground text-[10px] mb-0.5">Delivery Location</p>
                    <p className="font-bold text-foreground">{requirement.destination_country}{requirement.destination_city ? `, ${requirement.destination_city}` : ''}</p>
                  </div>
                )}
                {requirement.deadline && (
                  <div>
                    <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1"><Calendar className="w-3 h-3" /> Deadline</p>
                    <p className="font-bold text-foreground">{new Date(requirement.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                  </div>
                )}
                {(requirement.budget_max ?? requirement.budget_min) && (
                  <div>
                    <p className="text-muted-foreground text-[10px] mb-0.5">Budget</p>
                    <p className="font-bold text-foreground">
                      {requirement.currency} {(requirement.budget_max ?? requirement.budget_min)?.toLocaleString()}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[#FF7A2E] text-[10px] mb-0.5 flex items-center gap-1 font-bold"><Zap className="w-3 h-3 fill-current" /> Priority</p>
                  <p className="font-extrabold text-[#FF7A2E] uppercase tracking-wider text-xs">Urgent RFQ</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] mb-0.5 flex items-center gap-1"><Package className="w-3 h-3" /> Quotes</p>
                  <p className="font-bold text-[#FF5A00]">{requirement.quote_count}</p>
                </div>
              </div>

              {requirement.description && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Description</p>
                  <p className="text-[12px] text-foreground leading-relaxed">{requirement.description}</p>
                </div>
              )}
              {requirement.specifications && (
                <div>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">Specifications</p>
                  <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap">{requirement.specifications}</p>
                </div>
              )}
              {requirement.attachment_url && !Object.prototype.hasOwnProperty.call(RFQ_LICENSED_IMAGES, requirement.id) && (
                <a href={requirement.attachment_url} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#FF5A00] hover:underline">
                  <Upload className="w-3.5 h-3.5" /> View Attachment
                </a>
              )}
              {requirement.is_verified_buyer && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#FF5A00]">
                  <BadgeCheck className="w-3.5 h-3.5" /> Verified Buyer
                </div>
              )}

              {/* Paid Subscription Companies Only Notice & Direct Message / Quote CTA */}
              {!isBuyer && (
                <div className="pt-2 border-t border-border flex flex-col gap-2">
                  <div className="bg-[#FF5A00]/10 border border-[#FF5A00]/20 rounded-xl p-3 flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-[#FF7A2E] shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-foreground">Paid Subscription Companies Only</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        Only verified companies with an active paid plan can send direct messages and quotations to this buyer.
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={async () => {
                      if (!user) {
                        setSubDialogReason('not_logged_in');
                        setSubDialogOpen(true);
                        return;
                      }
                      if (!company) {
                        setSubDialogReason('not_registered_business');
                        setSubDialogOpen(true);
                        return;
                      }
                      const subCheck = await checkSupplierPaidSubscription(company.id, company);
                      if (!subCheck.allowed) {
                        setSubDialogReason(subCheck.reason);
                        setSubDialogOpen(true);
                        return;
                      }
                      const quota = await checkDirectMessageQuota(company.id, company);
                      if (quota !== 'ok') {
                        setSubDialogReason(quota);
                        setSubDialogOpen(true);
                        return;
                      }
                      setRespondDialogOpen(true);
                    }}
                    className="w-full bg-[#C94400] hover:bg-[#B33D00] text-white font-bold h-10 rounded-xl shadow-md gap-2"
                  >
                    <Send className="w-4 h-4" /> Send Direct Quote / Message Buyer
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Quotes tab */}
          <TabsContent value="quotes" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
            {/* Auto-quotations panel (buyer only) — additive, above manual quotes */}
            {isBuyer && requirement && (
              <BuyerQuotationsPanel
                requirementId={requirement.id}
                requirementTitle={requirement.title}
                buyerId={user?.id ?? ''}
              />
            )}
            {/* Manual quotations divider */}
            {isBuyer && quotes.length > 0 && (
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider pt-1">
                Manual Supplier Responses
              </p>
            )}
            {loadingQuotes ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-28 bg-card border border-border rounded-xl animate-pulse" />)}
              </div>
            ) : quotes.length === 0 && !isBuyer ? (
              <div className="text-center py-16">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-[13px] font-semibold text-foreground">No responses yet</p>
                <p className="text-[12px] text-muted-foreground">Suppliers will respond to your requirement soon.</p>
              </div>
            ) : (
              quotes.map(q => (
                <QuoteCard
                  key={q.id}
                  q={q}
                  isBuyer={!!isBuyer}
                  onAccept={handleAcceptQuote}
                  onReject={handleRejectQuote}
                  onChat={handleOpenChat}
                />
              ))
            )}
          </TabsContent>

          {/* Chat tab */}
          <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 mt-0">
            {!activeConvId ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/30 mb-3" />
                <p className="text-[13px] font-semibold text-foreground mb-1">No active conversation</p>
                <p className="text-[12px] text-muted-foreground">
                  {quotes.length > 0
                    ? 'Go to the Quotes tab and click "Chat / Negotiate" on a supplier response.'
                    : 'Once suppliers respond, you can chat with them here.'}
                </p>
              </div>
            ) : (
              <ChatPanel conversationId={activeConvId} currentUserId={user?.id ?? ''} />
            )}
          </TabsContent>
        </Tabs>

        <SubscribeToContactDialog
          open={subDialogOpen}
          onClose={() => setSubDialogOpen(false)}
          reason={subDialogReason}
        />

        {respondDialogOpen && requirement && user && company && (
          <SupplierRespondDialog
            open={respondDialogOpen}
            onClose={() => setRespondDialogOpen(false)}
            requirement={requirement}
            supplierId={user.id}
            supplierCompanyId={company.id}
            onResponded={() => {
              loadQuotes();
              toast.success('Your quote has been submitted to the buyer!');
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
