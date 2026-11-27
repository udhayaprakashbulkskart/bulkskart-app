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
import { Link } from 'react-router-dom';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Send, Loader2, MessageSquare, CheckCircle, XCircle, Phone,
  Upload, Building2, Calendar, Package, BadgeCheck, Zap,
  Clock, TrendingUp, ShieldCheck, Lock, Crown, IndianRupee, MapPin,
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
import { isOwnUrl, withoutOutsideLinks } from '@/lib/rfqSources';
import { canViewContacts, contactUpgradeHref, maskContactsInText, telHref, whatsappHref } from '@/lib/contactAccess';
import RfqPriorityBadge, { RfqPriorityPicker } from '@/components/common/RfqPriorityBadge';
import { isUrgentFromTag, normalizePriorityTag } from '@/lib/rfqPriority';
import { fetchVisibleContacts } from '@/lib/profileContacts';
import { placeLabel, quantityLabel } from '@/lib/requirementVisuals';
import { rfqBudget } from '@/lib/rfqAlerts';

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
    <div className="rounded-2xl border border-border bg-card p-3.5">
      <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Deal status</p>
      <div className="flex flex-wrap items-center gap-1">
        {DEAL_STEPS.map((step, i) => {
          const Icon = step.icon;
          const done = i < idx;
          const active = i === idx;
          return (
            <React.Fragment key={step.key}>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold transition-colors ${active ? 'bg-[#FF5A00] text-white' : done ? 'bg-[#FF5A00]/15 text-[#FF5A00]' : 'bg-background border border-border text-muted-foreground/50'}`}>
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
  const statusColor = q.status === 'accepted' ? 'bg-orange-500/10 border-orange-500/30 text-orange-500'
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
          className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] h-8 gap-1"
        >
          <MessageSquare className="w-3 h-3" /> Chat / Negotiate
        </Button>
        {isBuyer && q.status === 'pending' && (
          <>
            <Button size="sm" onClick={() => onAccept(q)}
              className="bg-orange-600 hover:bg-orange-700 text-white text-[11px] h-8 px-3 gap-1">
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
              <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-[12px] ${isMe ? 'bg-[#FF5A00] text-white rounded-br-none' : 'bg-card border border-border text-foreground rounded-bl-none'}`}>
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
          className="bg-[#FF5A00] hover:bg-[#e04e00] text-white h-9 px-3 gap-1">
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

/** "36d 20h", "5h 12m", or "Closed" once the deadline (end of that day) or expiry has passed. */
function timeLeft(req: Requirement): string | null {
  const end = req.deadline ? new Date(`${req.deadline.slice(0, 10)}T23:59:59`).getTime() : req.expires_at ? new Date(req.expires_at).getTime() : NaN;
  if (Number.isNaN(end)) return null;
  const ms = end - Date.now();
  if (ms <= 0) return 'Closed';
  const h = Math.floor(ms / 3600e3);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3600e3) / 60e3)}m`;
}

const dateLabel = (iso?: string | null) =>
  iso ? new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : null;


function OwnerPriorityEditor({
  requirement,
  onRequirementUpdated,
}: {
  requirement: Requirement;
  onRequirementUpdated: (req: Requirement) => void;
}) {
  const [saving, setSaving] = useState(false);
  const current = normalizePriorityTag(requirement.priority_tag);
  const save = async (tag: ReturnType<typeof normalizePriorityTag>) => {
    if (saving) return;
    setSaving(true);
    const patch = { priority_tag: tag, is_urgent: isUrgentFromTag(tag) } as Partial<Requirement>;
    const { error } = await updateRequirement(requirement.id, patch);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    onRequirementUpdated({ ...requirement, ...patch });
    toast.success(tag ? 'Priority tag updated' : 'Priority tag removed');
  };
  return (
    <div className="pt-1">
      <RfqPriorityPicker value={current} onChange={(tag) => { void save(tag); }} disabled={saving} id={`rfq-priority-${requirement.id}`} />
    </div>
  );
}

export interface RequirementDetailViewProps {
  requirement: Requirement;
  onRequirementUpdated: (req: Requirement) => void;
  /** 'drawer': inside the side panel; 'page': the RFQ's own full page (/requirements/:id) */
  layout?: 'drawer' | 'page';
  /** the side panel is open (each opening starts on Overview); always true on the page */
  active?: boolean;
  /** page only: under the title (e.g. the loan tag) */
  headerExtra?: React.ReactNode;
  /** page only: inside the buyer card (e.g. the protected contact) */
  buyerExtra?: React.ReactNode;
  /** page only: under the right-hand column of Overview (e.g. similar requirements) */
  aside?: React.ReactNode;
  /** page only: under the left-hand column of Overview (e.g. the supplier's matching products) */
  below?: React.ReactNode;
}

/** Overview, quotations and chat for one RFQ: the side panel's content, also the full RFQ page. */
export function RequirementDetailView({
  requirement,
  onRequirementUpdated,
  layout = 'drawer',
  active = true,
  headerExtra,
  buyerExtra,
  aside,
  below,
}: RequirementDetailViewProps) {
  const page = layout === 'page';
  const { user, profile, company, isPaidSubscriber } = useAuth();
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [subDialogReason, setSubDialogReason] = useState<SubscriptionReason>('no_subscription');
  const [respondDialogOpen, setRespondDialogOpen] = useState(false);
  const [chatStarting, setChatStarting] = useState(false);
  const [buyerContacts, setBuyerContacts] = useState<{ phone: string | null; email: string | null; whatsapp_number: string | null } | null>(null);

  // The buyer who posted this RFQ manages it (accept or reject quotations, move the deal on); everyone else sees it
  // as a supplier would. Chat and quotations are for Premium suppliers: a registered company with an active paid plan
  // (admins count as paid).
  const isOwner = Boolean(user && requirement && requirement.buyer_id === user.id);
  const premium = Boolean(company && isPaidSubscriber);
  const canSeeContact = canViewContacts({ isPaidSubscriber, viewerId: user?.id, ownerId: requirement?.buyer_id });
  useEffect(() => {
    if (!requirement?.buyer_id || !canSeeContact) {
      setBuyerContacts(null);
      return;
    }
    const ext = requirement as Requirement & { buyer_phone?: string | null; buyer_email?: string | null };
    const phone = requirement.profiles?.phone || ext.buyer_phone || null;
    const email = requirement.profiles?.email || ext.buyer_email || null;
    const whatsapp = (requirement.profiles as { whatsapp_number?: string | null } | null | undefined)?.whatsapp_number || null;
    if (phone || email || whatsapp) {
      setBuyerContacts({ phone, email, whatsapp_number: whatsapp });
      return;
    }
    let cancelled = false;
    fetchVisibleContacts([requirement.buyer_id]).then((map) => {
      if (!cancelled) setBuyerContacts(map[requirement.buyer_id] ?? null);
    });
    return () => { cancelled = true; };
  }, [requirement, canSeeContact]);
  const upgradeHref = contactUpgradeHref(profile?.role);

  const requirementId = requirement.id;
  const loadQuotes = useCallback(async () => {
    setLoadingQuotes(true);
    const data = await getQuotationsForRequirement(requirementId);
    setQuotes(data);
    setLoadingQuotes(false);
  }, [requirementId]);

  useEffect(() => {
    if (active) { loadQuotes(); setActiveConvId(null); setActiveTab('overview'); }
  }, [active, loadQuotes]);

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

  /** Premium suppliers only: guests sign in, people without a company register it, unpaid companies upgrade. */
  const supplierGate = async (): Promise<boolean> => {
    const ask = (reason: SubscriptionReason) => { setSubDialogReason(reason); setSubDialogOpen(true); return false; };
    if (!user) return ask('not_logged_in');
    if (!company) return ask('not_registered_business');
    const subCheck = await checkSupplierPaidSubscription(company.id, company);
    if (!subCheck.allowed) return ask(subCheck.reason);
    const quota = await checkDirectMessageQuota(company.id, company);
    if (quota !== 'ok') return ask(quota);
    return true;
  };

  const handleOpenChat = async (q: Quotation) => {
    if (!user) { setSubDialogReason('not_logged_in'); setSubDialogOpen(true); return; }
    if (!isOwner && !(await supplierGate())) return;
    const buyerId = isOwner ? user.id : q.buyer_id;
    const supplierId = isOwner ? q.supplier_id : user.id;
    const { id: convId, error } = await getOrCreateConversation(buyerId, supplierId, q.supplier_company_id, requirement?.id);
    if (error || !convId) { toast.error('Could not open chat'); return; }
    setActiveConvId(convId);
    setActiveTab('chat');
  };

  const startChatWithBuyer = async () => {
    if (!requirement || chatStarting) return;
    setChatStarting(true);
    try {
      if (!(await supplierGate()) || !user || !company) return;
      const { id: convId, error } = await getOrCreateConversation(requirement.buyer_id, user.id, company.id, requirement.id);
      if (error || !convId) { toast.error('Could not open chat'); return; }
      setActiveConvId(convId);
      setActiveTab('chat');
    } finally {
      setChatStarting(false);
    }
  };

  const sendQuotation = async () => {
    if (await supplierGate()) setRespondDialogOpen(true);
  };


  // @ts-expect-error
  const dealStatus: string = requirement.deal_status ?? 'active';
  // @ts-expect-error extended col
  const isUrgent: boolean = Boolean(requirement.is_urgent);
  const buyer = requirement.profiles as { full_name?: string | null; company_name?: string | null; phone?: string | null } | undefined;
  const buyerName = buyer?.company_name || buyer?.full_name || 'Buyer';
  const place = placeLabel(requirement);
  const left = timeLeft(requirement);
  const budget = rfqBudget(requirement);
  const picture = (Array.isArray(requirement.images) && requirement.images.find((u) => typeof u === 'string' && u.trim())) || requirement.attachment_url;
  const shown = (text: string) => (canSeeContact ? text : maskContactsInText(text));
  const tidy = (text: string) => text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const description = requirement.description ? tidy(withoutOutsideLinks(requirement.description)) : '';
  const specs = requirement.specifications
    ? tidy(withoutOutsideLinks(requirement.specifications))
    : '';
  const contactsHidden = shown(description) !== description || shown(specs) !== specs;
  const myQuotes = isOwner ? quotes : quotes.filter(q => q.supplier_id === user?.id);
  const showActionBar = !isOwner && !(activeTab === 'chat' && activeConvId);

  const facts = [
    { icon: Package, label: 'Quantity', value: quantityLabel(requirement) },
    { icon: MapPin, label: 'Delivery', value: place ?? 'Not stated' },
    { icon: Clock, label: left === 'Closed' ? 'Status' : 'Ends in', value: left ?? 'Open', note: requirement.deadline ? `by ${dateLabel(requirement.deadline)}` : undefined },
    { icon: IndianRupee, label: 'Budget', value: budget ?? 'Open to quotes' },
    { icon: Calendar, label: 'Posted', value: dateLabel(requirement.created_at) ?? '—' },
    { icon: MessageSquare, label: 'Quotations', value: String(requirement.quote_count ?? 0) },
  ];

  const lockedPanel = (title: string, body: string) => (
    <div className="mx-auto flex max-w-sm flex-col items-center px-2 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#F5B301]/60 bg-[#F5B301]/10">
        <Crown className="h-7 w-7 fill-[#FFC928] text-[#C98A00]" aria-hidden="true" />
      </span>
      <p className="mt-3 text-[16px] font-black">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      <Link
        to={user ? upgradeHref : '/pricing'}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl border-[1.5px] border-[#F5B301] bg-[#F5B301]/10 px-5 text-[14px] font-bold text-foreground"
      >
        <Crown className="h-5 w-5 fill-[#FFC928] text-[#C98A00]" aria-hidden="true" /> Upgrade to Premium
      </Link>
      {!user && (
        <Link to="/auth" className="mt-2 text-[12px] font-semibold text-[#FF5A00] hover:underline">Already Premium? Sign in</Link>
      )}
    </div>
  );

  const header = page ? (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 pr-8">
            {requirement.categories && (
              <span className="rounded-full bg-[#FF5A00]/15 px-2 py-0.5 text-[10.5px] font-semibold text-[#FF5A00]">{requirement.categories.name}</span>
            )}
            {requirement.req_number && <span className="text-[10.5px] text-muted-foreground">{requirement.req_number}</span>}
            <RfqPriorityBadge tag={requirement.priority_tag} className="text-[10.5px]" />
            {isUrgent && !normalizePriorityTag(requirement.priority_tag) && (
              <span className="flex items-center gap-0.5 rounded-full bg-red-500/15 px-2 py-0.5 text-[10.5px] font-bold text-red-500">
                <Zap className="h-3 w-3" /> Urgent
              </span>
            )}
            {requirement.is_verified_buyer && (
              <span className="flex items-center gap-0.5 text-[10.5px] font-semibold text-[#FF5A00]"><BadgeCheck className="h-3.5 w-3.5" /> Verified buyer</span>
            )}
          </div>
      <h1 className="text-[22px] font-black leading-tight tracking-tight text-foreground sm:text-[28px] lg:text-[32px]">{requirement.title}</h1>
      {isOwner && <OwnerPriorityEditor requirement={requirement} onRequirementUpdated={onRequirementUpdated} />}
      {headerExtra}
    </header>
  ) : (
    <SheetHeader className="shrink-0 space-y-1.5 border-b border-border bg-card px-4 pb-3 pt-4 text-left">
      <div className="flex flex-wrap items-center gap-1.5 pr-8">
            {requirement.categories && (
              <span className="rounded-full bg-[#FF5A00]/15 px-2 py-0.5 text-[10.5px] font-semibold text-[#FF5A00]">{requirement.categories.name}</span>
            )}
            {requirement.req_number && <span className="text-[10.5px] text-muted-foreground">{requirement.req_number}</span>}
            <RfqPriorityBadge tag={requirement.priority_tag} className="text-[10.5px]" />
            {isUrgent && !normalizePriorityTag(requirement.priority_tag) && (
              <span className="flex items-center gap-0.5 rounded-full bg-red-500/15 px-2 py-0.5 text-[10.5px] font-bold text-red-500">
                <Zap className="h-3 w-3" /> Urgent
              </span>
            )}
            {requirement.is_verified_buyer && (
              <span className="flex items-center gap-0.5 text-[10.5px] font-semibold text-[#FF5A00]"><BadgeCheck className="h-3.5 w-3.5" /> Verified buyer</span>
            )}
          </div>
      <SheetTitle className="pr-8 text-[17px] font-black leading-snug text-foreground md:text-[19px]">{requirement.title}</SheetTitle>
      {isOwner && <OwnerPriorityEditor requirement={requirement} onRequirementUpdated={onRequirementUpdated} />}
      <SheetDescription className="sr-only">Buying requirement details, quotations and chat</SheetDescription>
    </SheetHeader>
  );

  const callHref = canSeeContact ? telHref(buyerContacts?.phone) : null;
  const waHref = canSeeContact ? whatsappHref(buyerContacts?.phone || buyerContacts?.whatsapp_number, { title: requirement.title, req_number: requirement.req_number, id: requirement.id }) : null;
  const lockActions = () => { void supplierGate(); };
  const actionBtn = 'h-11 gap-1.5 rounded-xl font-bold';
  const outlineBtn = `${actionBtn} border-[#FF5A00]/50 text-[#E04E00] hover:bg-[#FF5A00]/10 dark:text-[#FF7A2E]`;
  const solidBtn = `${actionBtn} bg-[#FF5A00] text-white shadow-md hover:bg-[#e04e00]`;
  const actions = (
    <>
      {!premium && (
              <p className="mb-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <Crown className="h-3.5 w-3.5 shrink-0 fill-[#FFC928] text-[#C98A00]" aria-hidden="true" />
                Only suppliers with an active paid plan can call, WhatsApp, chat or send a quotation.{' '}
                {user ? (
                  <Link to={contactUpgradeHref(profile?.role)} className="font-semibold text-[#FF5A00] hover:underline">Upgrade</Link>
                ) : (
                  <Link to="/register" className="font-semibold text-[#FF5A00] hover:underline">Sign up</Link>
                )}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2">
              {premium && callHref ? (
                <Button asChild variant="outline" className={outlineBtn}>
                  <a href={callHref}><Phone className="h-4 w-4" aria-hidden="true" /> Call</a>
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={lockActions} disabled={premium && !callHref} className={outlineBtn}>
                  {premium ? <Phone className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />} Call
                </Button>
              )}
              {premium && waHref ? (
                <Button asChild variant="outline" className={outlineBtn}>
                  <a href={waHref} target="_blank" rel="noopener noreferrer"><MessageSquare className="h-4 w-4" aria-hidden="true" /> WhatsApp</a>
                </Button>
              ) : (
                <Button type="button" variant="outline" onClick={lockActions} disabled={premium && !waHref} className={outlineBtn}>
                  {premium ? <MessageSquare className="h-4 w-4" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />} WhatsApp
                </Button>
              )}
              <Button type="button" variant="outline" onClick={startChatWithBuyer} disabled={chatStarting} className={outlineBtn}>
                {chatStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : premium ? <MessageSquare className="h-4 w-4" /> : <Lock className="h-4 w-4" />} Chat
              </Button>
              <Button type="button" onClick={sendQuotation} className={solidBtn}>
                {premium ? <Send className="h-4 w-4" /> : <Lock className="h-4 w-4" />} Send Quotation
              </Button>
            </div>
    </>
  );

  // on a phone the page is one column (picture, facts, actions, deal, buyer, then the text); on a computer the text is
  // on the left and the facts, actions and buyer stay in view on the right
  const pageOverview = (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start lg:gap-5">
      <div className="contents lg:flex lg:flex-col lg:gap-4">
        <div className="order-1"><div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-muted/40">
              <SafeImage src={picture} alt={requirement.title} type="rfq" className="h-full w-full object-cover" />
              <span className="absolute bottom-2 left-2 rounded-md border border-border/50 bg-background/85 px-2 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-sm">
                Reference picture
              </span>
            </div></div>
        <div className="order-6 space-y-3 empty:hidden">
          {description && (
              <section className="rounded-2xl border border-border bg-card p-3.5">
                <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Description</h3>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">{shown(description)}</p>
              </section>
            )}
          {specs && (
              <section className="rounded-2xl border border-border bg-card p-3.5">
                <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Specifications</h3>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">{shown(specs)}</p>
              </section>
            )}
          {contactsHidden && (
              <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Phone numbers and emails in the text are hidden for members without a paid plan.
              </p>
            )}
          {/* Only files stored by BulkSkart open from here; links to other websites are not shown */}
            {requirement.attachment_url && isOwnUrl(requirement.attachment_url) && (
              <a href={requirement.attachment_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-1 text-[12px] font-semibold text-[#FF5A00] hover:underline">
                <Upload className="h-3.5 w-3.5" /> View attachment
              </a>
            )}
        </div>
        {below && <div className="order-7">{below}</div>}
      </div>
      <div className="contents lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-4">
        <div className="order-2"><dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {facts.map(({ icon: Icon, label, value, note }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-3">
                  <dt className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 text-[#FF5A00]" aria-hidden="true" /> {label}
                  </dt>
                  <dd className="mt-1 break-words text-[14px] font-bold leading-snug text-foreground">{value}</dd>
                  {note && <dd className="text-[10.5px] text-muted-foreground">{note}</dd>}
                </div>
              ))}
            </dl></div>
        {isOwner ? (
          <div className="order-3 flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-3.5">
            <Button onClick={() => setActiveTab('quotes')} className="h-11 flex-1 gap-1.5 rounded-xl bg-[#FF5A00] font-bold text-white hover:bg-[#e04e00]">
              <MessageSquare className="h-4 w-4" /> See quotations{myQuotes.length ? ` (${myQuotes.length})` : ''}
            </Button>
            <Button asChild variant="outline" className="h-11 flex-1 rounded-xl font-bold">
              <Link to="/dashboard/buyer/requirements">My requirements</Link>
            </Button>
          </div>
        ) : (
          <div className="order-3 rounded-2xl border border-border bg-card p-3.5">{actions}</div>
        )}
        <div className="order-4"><DealStatusBar status={dealStatus} isBuyer={isOwner} onAdvance={handleAdvanceDealStatus} /></div>
        <div className="order-5"><section className="rounded-2xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF5A00]/15 text-[16px] font-black text-[#FF5A00]">
                  {buyerName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-foreground">{buyerName}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {requirement.is_verified_buyer ? 'Verified buyer' : 'Buyer'}{place ? ` · ${place}` : ''}
                  </p>
                </div>
                {requirement.is_verified_buyer && <BadgeCheck className="h-5 w-5 shrink-0 text-[#FF5A00]" aria-hidden="true" />}
              </div>
              {canSeeContact && (buyerContacts?.phone || buyerContacts?.email) ? (
                <div className="mt-2.5 space-y-0.5 text-[12px] text-foreground">
                  {buyerContacts.phone && <p>Phone: {buyerContacts.phone}</p>}
                  {buyerContacts.email && <p>Email: {buyerContacts.email}</p>}
                </div>
              ) : !canSeeContact ? (
                <p className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-2 text-[11.5px] text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-[#FF5A00]" aria-hidden="true" />
                  {user ? (
                    <>The buyer&apos;s phone and email are shown only to paid suppliers. <Link to={contactUpgradeHref(profile?.role)} className="font-semibold text-[#FF5A00] hover:underline">See plans</Link></>
                  ) : (
                    <>Sign in or create an account, then upgrade to a paid supplier plan to unlock the buyer&apos;s phone and email. <Link to="/register" className="font-semibold text-[#FF5A00] hover:underline">Sign up</Link></>
                  )}
                </p>
              ) : null}
              {buyerExtra}
            </section></div>
        {aside && <div className="order-8 space-y-4">{aside}</div>}
      </div>
    </div>
  );

  const body = (
    <>
      {header}
      <Tabs value={activeTab} onValueChange={setActiveTab} className={page ? 'mt-4' : 'flex min-h-0 flex-1 flex-col'}>
        <TabsList
          className={
            page
              ? 'grid h-11 w-full max-w-md grid-cols-3 rounded-xl border border-border bg-card p-1'
              : 'mx-4 mt-3 grid h-10 shrink-0 grid-cols-3 rounded-xl border border-border bg-card p-1'
          }
        >
          {[
              { id: 'overview', label: 'Overview' },
              { id: 'quotes', label: isOwner ? 'Quotations' : 'My Quote', count: myQuotes.length },
              { id: 'chat', label: 'Chat' },
            ].map(t => (
              <TabsTrigger key={t.id} value={t.id} className="h-8 rounded-lg text-[12.5px] font-semibold data-[state=active]:bg-[#FF5A00] data-[state=active]:text-white">
                {t.label}
                {t.count ? <span className="ml-1 rounded-full bg-black/15 px-1.5 text-[10px]">{t.count}</span> : null}
              </TabsTrigger>
            ))}
        </TabsList>

        {/* Overview: the whole requirement */}
        <TabsContent
          value="overview"
          className={`${page ? 'mt-4' : 'mt-0 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-6 pt-3'} data-[state=inactive]:hidden`}
        >
          {page ? (
            pageOverview
          ) : (
            <>
              <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-muted/40">
              <SafeImage src={picture} alt={requirement.title} type="rfq" className="h-full w-full object-cover" />
              <span className="absolute bottom-2 left-2 rounded-md border border-border/50 bg-background/85 px-2 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-sm">
                Reference picture
              </span>
            </div>
              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {facts.map(({ icon: Icon, label, value, note }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-3">
                  <dt className="flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground">
                    <Icon className="h-3.5 w-3.5 text-[#FF5A00]" aria-hidden="true" /> {label}
                  </dt>
                  <dd className="mt-1 break-words text-[14px] font-bold leading-snug text-foreground">{value}</dd>
                  {note && <dd className="text-[10.5px] text-muted-foreground">{note}</dd>}
                </div>
              ))}
            </dl>
              <DealStatusBar status={dealStatus} isBuyer={isOwner} onAdvance={handleAdvanceDealStatus} />
              <section className="rounded-2xl border border-border bg-card p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FF5A00]/15 text-[16px] font-black text-[#FF5A00]">
                  {buyerName.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-foreground">{buyerName}</p>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {requirement.is_verified_buyer ? 'Verified buyer' : 'Buyer'}{place ? ` · ${place}` : ''}
                  </p>
                </div>
                {requirement.is_verified_buyer && <BadgeCheck className="h-5 w-5 shrink-0 text-[#FF5A00]" aria-hidden="true" />}
              </div>
              {canSeeContact && (buyerContacts?.phone || buyerContacts?.email) ? (
                <div className="mt-2.5 space-y-0.5 text-[12px] text-foreground">
                  {buyerContacts.phone && <p>Phone: {buyerContacts.phone}</p>}
                  {buyerContacts.email && <p>Email: {buyerContacts.email}</p>}
                </div>
              ) : !canSeeContact ? (
                <p className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-2 text-[11.5px] text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 shrink-0 text-[#FF5A00]" aria-hidden="true" />
                  {user ? (
                    <>The buyer&apos;s phone and email are shown only to paid suppliers. <Link to={contactUpgradeHref(profile?.role)} className="font-semibold text-[#FF5A00] hover:underline">See plans</Link></>
                  ) : (
                    <>Sign in or create an account, then upgrade to a paid supplier plan to unlock the buyer&apos;s phone and email. <Link to="/register" className="font-semibold text-[#FF5A00] hover:underline">Sign up</Link></>
                  )}
                </p>
              ) : null}
              {buyerExtra}
            </section>
              {description && (
              <section className="rounded-2xl border border-border bg-card p-3.5">
                <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Description</h3>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">{shown(description)}</p>
              </section>
            )}
              {specs && (
              <section className="rounded-2xl border border-border bg-card p-3.5">
                <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Specifications</h3>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">{shown(specs)}</p>
              </section>
            )}
              {contactsHidden && (
              <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Phone numbers and emails in the text are hidden for members without a paid plan.
              </p>
            )}
              {/* Only files stored by BulkSkart open from here; links to other websites are not shown */}
            {requirement.attachment_url && isOwnUrl(requirement.attachment_url) && (
              <a href={requirement.attachment_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-1 text-[12px] font-semibold text-[#FF5A00] hover:underline">
                <Upload className="h-3.5 w-3.5" /> View attachment
              </a>
            )}
            </>
          )}
        </TabsContent>

        {/* Quotations: the buyer's received quotations, or the supplier's own */}
        <TabsContent
          value="quotes"
          className={`${page ? 'mx-auto mt-4 max-w-3xl space-y-3' : 'mt-0 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-6 pt-3'} data-[state=inactive]:hidden`}
        >
          {isOwner && (
              <BuyerQuotationsPanel requirementId={requirement.id} requirementTitle={requirement.title} buyerId={user?.id ?? ''} />
            )}
            {isOwner && quotes.length > 0 && (
              <p className="pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Supplier quotations</p>
            )}
            {loadingQuotes ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-card" />)}
              </div>
            ) : myQuotes.length > 0 ? (
              myQuotes.map(q => (
                <QuoteCard key={q.id} q={q} isBuyer={isOwner} onAccept={handleAcceptQuote} onReject={handleRejectQuote} onChat={handleOpenChat} />
              ))
            ) : isOwner ? (
              <div className="py-12 text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-[13px] font-semibold text-foreground">No quotations yet</p>
                <p className="text-[12px] text-muted-foreground">Quotations from suppliers appear here as they arrive.</p>
              </div>
            ) : premium ? (
              <div className="py-12 text-center">
                <Send className="mx-auto mb-3 h-10 w-10 text-[#FF5A00]/60" />
                <p className="text-[14px] font-bold text-foreground">You have not quoted on this RFQ yet</p>
                <p className="mx-auto mt-1 max-w-xs text-[12.5px] text-muted-foreground">Send your price, MOQ and delivery time. The buyer sees it at once and can chat with you.</p>
                <Button onClick={sendQuotation} className="mt-4 h-11 gap-2 rounded-xl bg-[#FF5A00] px-6 font-bold text-white hover:bg-[#e04e00]">
                  <Send className="h-4 w-4" /> Send Quotation
                </Button>
              </div>
            ) : (
              lockedPanel('Quotations are for Premium Suppliers', 'Only registered companies with an active paid plan can send quotations to buyers.')
            )}
        </TabsContent>

        {/* Chat with the buyer (Premium suppliers) or with a supplier who quoted (the buyer) */}
        <TabsContent
          value="chat"
          className={`${page ? 'mx-auto mt-4 flex h-[min(72vh,680px)] max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card' : 'mt-0 flex min-h-0 flex-1 flex-col'} data-[state=inactive]:hidden`}
        >
          {activeConvId ? (
              <ChatPanel conversationId={activeConvId} currentUserId={user?.id ?? ''} />
            ) : isOwner ? (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <MessageSquare className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="mb-1 text-[13px] font-semibold text-foreground">No chat open</p>
                <p className="text-[12px] text-muted-foreground">
                  {quotes.length > 0 ? 'Open Quotations and tap "Chat / Negotiate" on a supplier.' : 'Suppliers who quote can chat with you here.'}
                </p>
              </div>
            ) : premium ? (
              <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FF5A00]/12">
                  <MessageSquare className="h-7 w-7 text-[#FF5A00]" />
                </span>
                <p className="mt-3 text-[15px] font-bold text-foreground">Chat with {buyerName}</p>
                <p className="mx-auto mt-1 max-w-xs text-[12.5px] text-muted-foreground">Ask about specifications, quantity or delivery before you quote.</p>
                <Button onClick={startChatWithBuyer} disabled={chatStarting} className="mt-4 h-11 gap-2 rounded-xl bg-[#FF5A00] px-6 font-bold text-white hover:bg-[#e04e00]">
                  {chatStarting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />} Start chat
                </Button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-4">
                {lockedPanel('Chat is for Premium Suppliers', 'Only registered companies with an active paid plan can chat with buyers.')}
              </div>
            )}
        </TabsContent>
      </Tabs>

      {/* Actions: chat and quotation, for Premium suppliers (the page shows them inside Overview) */}
      {!page && showActionBar && (
        <div className="shrink-0 border-t border-border bg-card px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          {actions}
        </div>
      )}

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
              setActiveTab('quotes');
              toast.success('Your quotation has been sent to the buyer!');
            }}
          />
        )}
    </>
  );

  return page ? <div className="w-full">{body}</div> : body;
}

/** The RFQ in a side panel. The home feed and the RFQ list open the full page (/requirements/:id) instead. */
export default function RequirementDetailDrawer({ open, onClose, requirement, onRequirementUpdated }: Props) {
  if (!requirement) return null;
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="flex h-[100dvh] w-full max-w-[100vw] flex-col gap-0 overflow-hidden border-l border-border bg-background p-0 sm:max-w-xl md:w-[640px]">
        <RequirementDetailView requirement={requirement} onRequirementUpdated={onRequirementUpdated} layout="drawer" active={open} />
      </SheetContent>
    </Sheet>
  );
}
