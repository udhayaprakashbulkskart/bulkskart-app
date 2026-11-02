import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  CheckCheck,
  CheckCircle2,
  Phone,
  MoreVertical,
  Sparkles,
  Paperclip,
  FileText,
  Send,
  ChevronDown,
  ChevronUp,
  Download,
  Check,
  Lock,
  Zap,
  ShieldCheck,
  Copy,
  ExternalLink,
  X,
  MapPin,
  Clock,
  Coins,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import type { Requirement } from '@/types/types';
import type { AIChatReply } from '@/lib/aiSalesAssistant';

export interface ChatMessageItem {
  id: string;
  sender: 'poster' | 'me';
  text: string;
  time: string;
  attachment?: { name: string; size: string };
  quoteCard?: {
    unitPrice: number;
    currency: string;
    moq: number;
    moqUnit: string;
    deliveryDays: number;
    paymentTerms: string;
    deliveryTerms: string;
    totalPrice: number;
    notes?: string;
    status: 'pending' | 'accepted' | 'countered';
  };
}

interface FullScreenMobileChatProps {
  open: boolean;
  onClose: () => void;
  requirement: Requirement | null;
  buyerProfile: {
    company_name: string;
    contact_person: string;
    designation: string;
    city: string;
    country: string;
    flag: string;
    avatar_initials: string;
    annual_procurement?: string;
    sector?: string;
  };
  rfqCode: string;
  chatMessages: ChatMessageItem[];
  onSendMessage: (text: string) => void;
  onSendQuoteCard: (quoteData: {
    unitPrice: number;
    moq: number;
    deliveryDays: number;
    paymentTerms: string;
    deliveryTerms: string;
    notes: string;
  }) => void;
  onAcceptQuote: (msgId: string) => void;
  onCounterOffer: (unitPrice: number | string, moq: number | string) => void;
  suggestedChatReplies?: AIChatReply[];
  isSupplierViewer?: boolean;
  isPaidSubscription?: boolean | null;
  onTriggerSubscription?: () => void;
}

export default function FullScreenMobileChat({
  open,
  onClose,
  requirement,
  buyerProfile,
  rfqCode,
  chatMessages,
  onSendMessage,
  onSendQuoteCard,
  onAcceptQuote,
  onCounterOffer,
  suggestedChatReplies = [],
  isSupplierViewer = true,
  isPaidSubscription = true,
  onTriggerSubscription,
}: FullScreenMobileChatProps) {
  const [chatInput, setChatInput] = useState('');
  const [isRfqSummaryExpanded, setIsRfqSummaryExpanded] = useState(false);
  const [showAiReplies, setShowAiReplies] = useState(false);
  const [showInChatQuoteBuilder, setShowInChatQuoteBuilder] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // In-chat quote builder form states
  const [inChatPrice, setInChatPrice] = useState<number | string>('');
  const [inChatMoq, setInChatMoq] = useState<number | string>(requirement?.quantity || 1000);
  const [inChatLeadDays, setInChatLeadDays] = useState<number | string>(15);
  const [inChatDeliveryTerms, setInChatDeliveryTerms] = useState('FOB Origin Port / Door Delivery');
  const [inChatPaymentTerms, setInChatPaymentTerms] = useState('30% Advance, 70% against BL/Dispatch');
  const [inChatNotes, setInChatNotes] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom whenever messages change or drawer toggles
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    if (open) {
      // Prevent background scrolling while chat is active
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      // Immediate scroll to bottom on open
      const timer = setTimeout(() => {
        scrollToBottom('auto');
      }, 50);

      return () => {
        document.body.style.overflow = originalOverflow;
        clearTimeout(timer);
      };
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      scrollToBottom('smooth');
    }
  }, [chatMessages.length, showAiReplies, showInChatQuoteBuilder, isRfqSummaryExpanded]);

  if (!open) return null;

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setChatInput('');
    setShowAiReplies(false);
  };

  const handleSendQuoteForm = (e: React.FormEvent) => {
    e.preventDefault();
    const numPrice = Number(inChatPrice);
    if (!inChatPrice || isNaN(numPrice) || numPrice <= 0) {
      toast.error('Please enter a valid unit price');
      return;
    }

    onSendQuoteCard({
      unitPrice: numPrice,
      moq: Number(inChatMoq) || requirement?.quantity || 1000,
      deliveryDays: Number(inChatLeadDays) || 15,
      paymentTerms: inChatPaymentTerms,
      deliveryTerms: inChatDeliveryTerms,
      notes: inChatNotes || 'Includes export-grade packaging and quality inspection.',
    });

    setShowInChatQuoteBuilder(false);
    toast.success('Commercial Quotation attached and transmitted to buyer!');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.success(`Attached document: ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);
      onSendMessage(`[Attached Document: ${file.name}]`);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCallBuyer = () => {
    toast.info(`Connecting to verified buyer line for ${buyerProfile.company_name} (Masked B2B Escrow Line)`);
  };

  const reqQtyFormatted = (requirement?.quantity || 5000).toLocaleString();
  const reqUnit = requirement?.quantity_unit || 'Pieces';
  const targetBudget = requirement?.budget_max
    ? `₹${requirement.budget_min ? `${requirement.budget_min} - ` : ''}₹${requirement.budget_max} / ${reqUnit}`
    : 'Open for Quotation';
  const destination = requirement?.destination_city
    ? `${requirement.destination_city}, ${requirement.destination_country || 'India'}`
    : `${buyerProfile.city}, ${buyerProfile.country} ${buyerProfile.flag}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Direct Chat with Requirement Poster"
      className="fixed inset-0 z-[100] bg-background text-foreground flex flex-col h-[100dvh] w-full overflow-hidden select-text"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* ── 1. FIXED TOP CHAT HEADER (WhatsApp / Telegram style) ── */}
      <header className="shrink-0 bg-card/95 backdrop-blur-md border-b border-border px-2 sm:px-3 py-2 sm:py-2.5 flex items-center justify-between gap-1.5 z-20 shadow-sm">
        {/* Left: Back Arrow + Buyer Avatar + Buyer Details */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          {/* Back Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 -ml-1 text-foreground/80 hover:text-foreground hover:bg-muted rounded-full transition-colors active:scale-95"
            aria-label="Return to requirement details"
          >
            <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 text-foreground" />
          </button>

          {/* Avatar with live online pulse indicator */}
          <div className="relative shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-xs sm:text-sm text-primary shadow-sm">
              {buyerProfile.avatar_initials}
            </div>
            <span
              className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse"
              title="Online now"
            />
          </div>

          {/* Buyer Details */}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-1 sm:gap-1.5 truncate">
              <h3 className="font-bold text-xs sm:text-sm text-white truncate">
                {buyerProfile.company_name}
              </h3>
              <span className="text-xs shrink-0">{buyerProfile.flag}</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium truncate mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{buyerProfile.contact_person}</span>
              <span className="text-white/40 hidden xs:inline">·</span>
              <span className="text-white/60 text-[10px] hidden xs:inline">Verified Buyer</span>
            </div>
          </div>
        </div>

        {/* Right Action Icons: Phone Call + More Vertical */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCallBuyer}
            className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-full text-white/80 hover:text-[#FF5A00] hover:bg-white/10"
            title="Call Buyer Desk"
            aria-label="Call Buyer Desk"
          >
            <Phone className="w-4 h-4 text-[#FF5A00]" />
          </Button>

          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowMoreMenu(prev => !prev)}
              className="h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-full text-white/80 hover:text-white hover:bg-white/10"
              title="More options"
              aria-label="More options"
            >
              <MoreVertical className="w-4 h-4 text-white/80" />
            </Button>

            {/* Dropdown menu */}
            {showMoreMenu && (
              <div
                className="absolute right-0 top-full mt-1 w-52 bg-[#161A28] border border-white/15 rounded-xl shadow-2xl py-1.5 z-50 text-xs space-y-0.5"
                onClick={() => setShowMoreMenu(false)}
              >
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(rfqCode);
                    toast.success(`Copied RFQ ${rfqCode} to clipboard`);
                  }}
                  className="w-full text-left px-3 py-2 text-white/90 hover:bg-white/10 flex items-center gap-2"
                >
                  <Copy className="w-3.5 h-3.5 text-[#FF5A00]" />
                  <span>Copy RFQ Code</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRfqSummaryExpanded(prev => !prev)}
                  className="w-full text-left px-3 py-2 text-white/90 hover:bg-white/10 flex items-center gap-2"
                >
                  <FileText className="w-3.5 h-3.5 text-[#FF5A00]" />
                  <span>{isRfqSummaryExpanded ? 'Collapse RFQ Pill' : 'Expand RFQ Specs'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toast.info('Downloading formal B2B RFQ specification sheet...');
                  }}
                  className="w-full text-left px-3 py-2 text-white/90 hover:bg-white/10 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Download RFQ Spec PDF</span>
                </button>
                <div className="h-px bg-white/10 my-1" />
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full text-left px-3 py-2 text-amber-400 hover:bg-white/10 flex items-center gap-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Exit to Requirement Page</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── 2. PINNED RFQ / PRODUCT SUMMARY CARD ── */}
      <section
        aria-label="RFQ Summary"
        className="shrink-0 bg-[#121522] border-b border-white/10 px-3 py-2 transition-all shadow-inner"
      >
        <div className="flex items-center justify-between gap-2">
          {/* Left Thumbnail + RFQ info */}
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden bg-black/50 border border-white/10 shrink-0">
              <img
                src={requirement?.attachment_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=300&q=75'}
                alt="Product thumbnail"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono font-bold text-[#FF5A00] bg-[#FF5A00]/10 px-1.5 py-0.2 rounded border border-[#FF5A00]/25">
                  #{rfqCode}
                </span>
                <span className="text-[10px] font-medium text-white/60 truncate">
                  {reqQtyFormatted} {reqUnit}
                </span>
              </div>
              <p className="text-xs font-bold text-white truncate mt-0.5">
                {requirement?.title || 'Cotton Sarees - 5,000 Pieces'}
              </p>
            </div>
          </div>

          {/* Right Price & Toggle Button */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="text-right text-[11px] hidden xs:block">
              <div className="text-white/40 text-[9px]">Target Budget</div>
              <div className="font-bold text-emerald-400">{targetBudget}</div>
            </div>
            <button
              type="button"
              onClick={() => setIsRfqSummaryExpanded(prev => !prev)}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              aria-label={isRfqSummaryExpanded ? 'Collapse RFQ details' : 'Expand RFQ details'}
            >
              {isRfqSummaryExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible expanded detail tray */}
        {isRfqSummaryExpanded && (
          <div className="mt-2.5 pt-2 border-t border-white/10 text-xs grid grid-cols-2 gap-2 animate-in fade-in duration-150">
            <div className="p-2 rounded-lg bg-white/5 space-y-0.5">
              <div className="text-[10px] text-white/50 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[#FF5A00]" />
                <span>Destination Port</span>
              </div>
              <div className="font-bold text-white text-[11px] truncate">{destination}</div>
            </div>

            <div className="p-2 rounded-lg bg-white/5 space-y-0.5">
              <div className="text-[10px] text-white/50 flex items-center gap-1">
                <Clock className="w-3 h-3 text-emerald-400" />
                <span>Deadline / Timeline</span>
              </div>
              <div className="font-bold text-white text-[11px] truncate">
                {requirement?.deadline ? new Date(requirement.deadline).toLocaleDateString() : '15-20 Days Delivery'}
              </div>
            </div>

            <div className="p-2 rounded-lg bg-white/5 col-span-2 space-y-1">
              <div className="text-[10px] text-white/50">Specifications & Requirements</div>
              <p className="text-[11px] text-white/80 line-clamp-2 leading-relaxed">
                {requirement?.specifications || requirement?.description || 'Export grade finish required with complete packaging options.'}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── 3. CHAT MESSAGES STREAM (Full Screen Remaining Height) ── */}
      <main
        aria-label="Messages Stream"
        className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 bg-background"
        style={{
          overscrollBehavior: 'contain',
        }}
      >
        {/* Date / Security Notice Pill */}
        <div className="flex justify-center my-1">
          <span className="text-[10px] bg-muted border border-border text-muted-foreground px-3 py-1 rounded-full font-mono flex items-center gap-1.5 shadow-sm">
            <ShieldCheck className="w-3 h-3 text-[#FF5A00]" />
            <span>Direct 1-on-1 End-to-End Encrypted B2B Negotiation Desk</span>
          </span>
        </div>

        {/* Messages List */}
        {chatMessages.map(msg => {
          const isMe = msg.sender === 'me' || (msg as any).sender === 'supplier';

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in duration-100`}
            >
              <span className="text-[10px] text-white/40 mb-1 px-1">
                {isMe ? 'You (Verified Manufacturer)' : `${buyerProfile.company_name} (Buyer Desk)`}
              </span>

              {/* Message Bubble */}
              <div
                className={`max-w-[88%] sm:max-w-[78%] p-3 sm:p-3.5 rounded-2xl text-xs sm:text-sm shadow-md break-words ${
                  isMe
                    ? 'bg-[#FF5A00] text-white rounded-tr-none'
                    : 'bg-[#181B28] text-white/95 border border-white/10 rounded-tl-none'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                {/* IN-CHAT FORMAL QUOTATION CARD ATTACHMENT */}
                {msg.quoteCard && (
                  <div className="mt-3 p-3 rounded-xl bg-black/45 border border-white/15 text-white space-y-2 shadow-inner">
                    <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-400" />
                        <span className="font-black text-[11px] uppercase tracking-wider text-amber-300">
                          Commercial Quotation Card
                        </span>
                      </div>
                      <Badge
                        className={`text-[9px] uppercase font-mono ${
                          msg.quoteCard.status === 'accepted'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {msg.quoteCard.status === 'accepted' ? 'Deal Finalized' : 'Pending Review'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      <div className="bg-white/5 p-1.5 rounded-lg">
                        <div className="text-[9px] text-white/50">Unit Price</div>
                        <div className="font-black text-xs sm:text-sm text-white">
                          {msg.quoteCard.currency} {msg.quoteCard.unitPrice.toLocaleString()} / {msg.quoteCard.moqUnit}
                        </div>
                      </div>
                      <div className="bg-white/5 p-1.5 rounded-lg">
                        <div className="text-[9px] text-white/50">Total Est. Value</div>
                        <div className="font-black text-xs sm:text-sm text-emerald-400">
                          {msg.quoteCard.currency} {msg.quoteCard.totalPrice.toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-white/5 p-1.5 rounded-lg">
                        <div className="text-[9px] text-white/50">MOQ</div>
                        <div className="font-bold text-white text-[11px]">
                          {msg.quoteCard.moq.toLocaleString()} {msg.quoteCard.moqUnit}
                        </div>
                      </div>
                      <div className="bg-white/5 p-1.5 rounded-lg">
                        <div className="text-[9px] text-white/50">Production Lead Time</div>
                        <div className="font-bold text-white text-[11px]">
                          {msg.quoteCard.deliveryDays} Days
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] bg-white/5 p-2 rounded-lg text-white/80 space-y-0.5">
                      <div><strong className="text-white/60">Payment:</strong> {msg.quoteCard.paymentTerms}</div>
                      <div><strong className="text-white/60">Delivery:</strong> {msg.quoteCard.deliveryTerms}</div>
                      {msg.quoteCard.notes && (
                        <div><strong className="text-white/60">Notes:</strong> {msg.quoteCard.notes}</div>
                      )}
                    </div>

                    {/* Action buttons on quote card */}
                    <div className="pt-1 flex items-center gap-1.5 flex-wrap">
                      {msg.quoteCard.status === 'accepted' ? (
                        <div className="w-full p-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-bold flex items-center justify-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Deal Finalized & Transmitted
                        </div>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            onClick={() => onAcceptQuote(msg.id)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] h-7 px-2.5 rounded-lg gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Accept Quote
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onCounterOffer(msg.quoteCard?.unitPrice || 250, msg.quoteCard?.moq || 1000)}
                            className="bg-white/10 hover:bg-white/20 text-white text-[11px] h-7 px-2.5 rounded-lg"
                          >
                            Counter-Offer
                          </Button>
                        </>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toast.success(`Downloading formal quote sheet PDF (${rfqCode})...`)}
                        className="text-white/70 hover:text-white hover:bg-white/10 text-[10px] h-7 px-2 ml-auto"
                      >
                        <Download className="w-3 h-3 mr-1" /> PDF
                      </Button>
                    </div>
                  </div>
                )}

                {/* File Attachment */}
                {msg.attachment && (
                  <div className="mt-2 p-2 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-red-600/30 text-red-400 flex items-center justify-center font-bold text-[9px] shrink-0">
                        PDF
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-white truncate max-w-[130px] sm:max-w-[200px] text-xs">
                          {msg.attachment.name}
                        </div>
                        <div className="text-[9px] text-white/60">{msg.attachment.size}</div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toast.success(`Downloading ${msg.attachment?.name}...`)}
                      className="h-7 w-7 p-0 text-white/80 hover:text-white hover:bg-white/10 shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}

                {/* Timestamp & double checkmarks */}
                <div className={`text-[10px] mt-1.5 flex items-center justify-end gap-1 ${
                  isMe ? 'text-white/80' : 'text-white/40'
                }`}>
                  <span>{msg.time}</span>
                  {isMe && <CheckCheck className="w-3.5 h-3.5 text-white/90" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </main>

      {/* ── 4. IN-CHAT QUOTATION BUILDER DRAWER ── */}
      {showInChatQuoteBuilder && (
        <section
          aria-label="Quotation Builder Drawer"
          className="shrink-0 bg-card border-t border-border p-3 sm:p-4 space-y-2.5 animate-in slide-in-from-bottom duration-200 shadow-xl max-h-[45vh] overflow-y-auto"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#FF5A00]" />
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Attach Commercial Quotation Card
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setShowInChatQuoteBuilder(false)}
              className="text-muted-foreground hover:text-foreground p-1 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSendQuoteForm} className="space-y-2.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Unit Price (INR / ₹) *</label>
                <Input
                  type="number"
                  required
                  min="1"
                  step="any"
                  value={inChatPrice}
                  onChange={e => setInChatPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 280"
                  className="bg-background border-border text-foreground h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">MOQ ({reqUnit}) *</label>
                <Input
                  type="number"
                  required
                  min="1"
                  value={inChatMoq}
                  onChange={e => setInChatMoq(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="500"
                  className="bg-background border-border text-foreground h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Lead Time (Days)</label>
                <Input
                  type="number"
                  min="1"
                  value={inChatLeadDays}
                  onChange={e => setInChatLeadDays(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="15"
                  className="bg-background border-border text-foreground h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Incoterms</label>
                <Input
                  value={inChatDeliveryTerms}
                  onChange={e => setInChatDeliveryTerms(e.target.value)}
                  placeholder="FOB"
                  className="bg-background border-border text-foreground h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Payment Terms</label>
                <Input
                  value={inChatPaymentTerms}
                  onChange={e => setInChatPaymentTerms(e.target.value)}
                  placeholder="30% Advance, 70% against BL"
                  className="bg-background border-border text-foreground h-8 text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] text-muted-foreground block mb-1">Factory Notes / Scope</label>
                <Input
                  value={inChatNotes}
                  onChange={e => setInChatNotes(e.target.value)}
                  placeholder="Includes export packaging & quality report"
                  className="bg-background border-border text-foreground h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setShowInChatQuoteBuilder(false)}
                className="text-muted-foreground hover:text-foreground text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#FF5A00] hover:bg-[#e04f00] text-white font-bold text-xs h-8 px-4 rounded-xl gap-1.5 shadow"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Attach & Send Quotation Card</span>
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* ── 5. AI SUGGESTED REPLIES DRAWER ── */}
      {showAiReplies && suggestedChatReplies.length > 0 && (
        <section
          aria-label="AI Suggested Replies"
          className="shrink-0 bg-muted/60 border-t border-border p-2.5 sm:p-3 space-y-2 max-h-40 overflow-y-auto animate-in slide-in-from-bottom duration-150"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-bold text-foreground">
              <Sparkles className="w-3.5 h-3.5 text-[#FF5A00]" />
              <span>AI Suggested Replies:</span>
            </span>
            <button
              type="button"
              onClick={() => setShowAiReplies(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Hide
            </button>
          </div>

          <div className="space-y-1.5">
            {suggestedChatReplies.map(reply => (
              <div
                key={reply.id}
                className="p-2 rounded-xl bg-card border border-border hover:border-[#FF5A00]/40 transition-colors text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-[9px] uppercase font-mono font-bold text-[#FF5A00] bg-[#FF5A00]/10 px-1.5 py-0.5 rounded">
                    {reply.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setChatInput(reply.text);
                        inputRef.current?.focus();
                        toast.success('AI reply loaded into message input');
                      }}
                      className="text-[10px] font-bold text-foreground/80 hover:text-foreground bg-muted hover:bg-muted/80 px-2 py-0.5 rounded transition-colors"
                    >
                      Use Reply
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setChatInput(reply.text);
                        inputRef.current?.focus();
                      }}
                      className="text-[10px] font-bold text-amber-600 dark:text-yellow-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSendMessage(reply.text);
                        setShowAiReplies(false);
                      }}
                      className="text-[10px] font-bold text-white bg-[#FF5A00] hover:bg-[#e04f00] px-2.5 py-0.5 rounded transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </div>
                <p className="text-foreground/80 text-[11px] line-clamp-2 leading-tight">
                  "{reply.text}"
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 6. FIXED BOTTOM MESSAGE COMPOSER ── */}
      <footer
        className="shrink-0 bg-card/95 backdrop-blur-md border-t border-border p-2 sm:p-2.5 shadow-xl z-20"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
        }}
      >
        {/* Hidden File Picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Subscription Locked Gate check */}
        {isSupplierViewer && !isPaidSubscription ? (
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-[11px] text-foreground/80 truncate">
                Paid membership required to message verified buyers.
              </p>
            </div>
            <Button
              size="sm"
              onClick={onTriggerSubscription}
              className="bg-[#FF5A00] hover:bg-[#e04f00] text-white text-[11px] font-bold h-7 px-3 rounded-lg shrink-0 gap-1"
            >
              <Zap className="w-3 h-3" />
              Upgrade
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center gap-1.5 sm:gap-2">
            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 sm:p-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground/70 hover:text-foreground transition-colors active:scale-95 shrink-0"
              title="Attach File / Document / Catalog"
              aria-label="Attach File"
            >
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5 text-foreground/80" />
            </button>

            {/* Quick Quote Trigger Button */}
            <button
              type="button"
              onClick={() => setShowInChatQuoteBuilder(prev => !prev)}
              className={`p-2 sm:p-2.5 rounded-xl border transition-colors flex items-center gap-1 text-xs font-bold active:scale-95 shrink-0 ${
                showInChatQuoteBuilder
                  ? 'bg-[#FF5A00] text-white border-[#FF5A00]'
                  : 'bg-muted hover:bg-muted/80 text-[#FF5A00] border-[#FF5A00]/30'
              }`}
              title="Attach Formal Quotation Card"
              aria-label="Attach Formal Quotation Card"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Attach Quote</span>
            </button>

            {/* AI Replies Toggle Button */}
            {suggestedChatReplies.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAiReplies(prev => !prev)}
                className={`p-2 sm:p-2.5 rounded-xl border transition-colors flex items-center gap-1 text-xs font-bold active:scale-95 shrink-0 ${
                  showAiReplies
                    ? 'bg-[#FF5A00]/20 text-[#FF5A00] border-[#FF5A00]'
                    : 'bg-muted hover:bg-muted/80 text-amber-500 border-amber-500/30'
                }`}
                title="AI Suggested Replies"
                aria-label="AI Suggested Replies"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}

            {/* Text Message Input */}
            <Input
              ref={inputRef}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder={`Message ${buyerProfile.contact_person}...`}
              className="flex-1 min-w-0 bg-background border-border text-foreground placeholder:text-muted-foreground h-10 rounded-xl text-xs sm:text-sm focus-visible:ring-1 focus-visible:ring-[#FF5A00]"
            />

            {/* Brand Orange Send Button */}
            <Button
              type="submit"
              disabled={!chatInput.trim()}
              className="bg-[#FF5A00] hover:bg-[#e04f00] disabled:opacity-40 disabled:hover:bg-[#FF5A00] text-white font-bold h-10 w-10 sm:w-auto sm:px-4 rounded-xl shrink-0 p-0 sm:p-2.5 flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
              aria-label="Send message"
            >
              <Send className="w-4 h-4 text-white" />
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
        )}
      </footer>
    </div>
  );
}
