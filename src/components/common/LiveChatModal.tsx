/**
 * LiveChatModal
 *
 * Full subscription-gated live chat dialog.
 * - Verifies both parties' subscriptions via Edge Function (server-side)
 * - Creates/reuses conversation (no duplicates)
 * - Real-time messages via Supabase Realtime
 * - Product context header
 * - Unread count reset on open
 * - Subscription expiry states
 * - Reconnect on realtime failure
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import {
  initLiveChat,
  sendSecureMessage,
  getMessages,
  markConversationRead,
} from '@/lib/api';
import type { Message } from '@/types/types';
import {
  Send, MessageSquare, Loader2, WifiOff, RefreshCw,
  ExternalLink, ShieldCheck, ArrowRight, Package, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiveChatProduct {
  id: string;
  name: string;
  slug: string;
  price_min: number | null;
  price_max: number | null;
  price_currency: string;
  moq: number;
  moq_unit: string;
  company_id: string;
}

export interface LiveChatSupplier {
  id: string;          // profiles.id of the supplier user
  company_id: string;  // companies.id
  company_name: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  product: LiveChatProduct;
  supplier: LiveChatSupplier;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatPrice(product: LiveChatProduct) {
  const sym = product.price_currency === 'INR' ? '₹' : product.price_currency;
  if (!product.price_min) return null;
  const max = product.price_max ? ` – ${sym}${product.price_max.toLocaleString()}` : '+';
  return `${sym}${product.price_min.toLocaleString()}${max}`;
}

// ── ChatState: auth / loading / ready / error ──────────────────────────────

type ChatState =
  | 'idle'
  | 'checking'
  | 'ready'
  | 'not_logged_in'
  | 'supplier_not_subscribed'
  | 'my_sub_expired'
  | 'their_sub_expired'
  | 'error';

// ── Component ────────────────────────────────────────────────────────────────

export default function LiveChatModal({ open, onClose, product, supplier }: Props) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [chatState, setChatState] = useState<ChatState>('idle');
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const isBuyer = profile?.role === 'buyer' || (!profile?.role && !!user);

  // ── Auth & subscription gate ──────────────────────────────────────────────
  const runChatAuth = useCallback(async () => {
    if (!user) { setChatState('not_logged_in'); return; }
    setChatState('checking');

    const result = await initLiveChat({
      supplier_id: supplier.id,
      supplier_company_id: supplier.company_id,
      product_id: product.id,
    });

    if (result.error === 'not_authenticated') {
      setChatState('not_logged_in');
    } else if (result.error === 'supplier_not_subscribed') {
      setChatState('supplier_not_subscribed');
    } else if (result.conversation_id) {
      setConvId(result.conversation_id);
      setChatState('ready');
    } else {
      setChatState('error');
    }
  }, [user, supplier, product]);

  // ── Open: run auth gate ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    // Reset
    setChatState('idle');
    setConvId(null);
    setMessages([]);
    setInput('');
    setRealtimeOk(true);
    runChatAuth();
  }, [open, runChatAuth]);

  // ── Load messages + subscribe realtime ───────────────────────────────────
  useEffect(() => {
    if (!convId || chatState !== 'ready') return;

    setLoadingMsgs(true);
    getMessages(convId).then(data => {
      setMessages(data);
      setLoadingMsgs(false);
    });

    // Mark read
    if (user) {
      markConversationRead(convId, user.id, isBuyer ? 'buyer' : 'supplier');
    }

    // Realtime
    try {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      const chName = `live-chat-${convId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const ch = supabase
        .channel(chName)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
          (payload) => {
            const newMsg = payload.new as Message;
            setMessages(prev => {
              if (prev.find(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
            // Auto-clear unread when chat is open
            if (user) markConversationRead(convId, user.id, isBuyer ? 'buyer' : 'supplier');
          }
        )
        .subscribe((status) => {
          setRealtimeOk(status === 'SUBSCRIBED');
        });

      channelRef.current = ch;
    } catch (e) {
      console.warn('LiveChatModal realtime subscription skipped:', e);
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [convId, chatState, user, isBuyer]);

  // ── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convId || !input.trim() || sending) return;
    setSending(true);
    const { error } = await sendSecureMessage(convId, input.trim());
    setSending(false);
    if (error === 'subscription_expired' || error === 'not_authenticated') {
      setChatState('my_sub_expired');
      return;
    }
    if (error === 'recipient_subscription_expired') {
      setChatState('their_sub_expired');
      return;
    }
    if (error) {
      toast.error('Failed to send message. Please try again.');
      return;
    }
    setInput('');
  };

  const priceDisplay = formatPrice(product);
  const subscriptionPath = profile?.role === 'supplier'
    ? '/dashboard/supplier/subscription'
    : '/pricing';

  // ── Render states ─────────────────────────────────────────────────────────

  const renderBody = () => {
    // Loading / checking
    if (chatState === 'idle' || chatState === 'checking') {
      return (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Verifying subscription access…</p>
        </div>
      );
    }

    // Not logged in
    if (chatState === 'not_logged_in') {
      return (
        <div className="flex flex-col items-center text-center gap-4 py-8 px-2">
          <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <MessageSquare className="w-7 h-7 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Login to start chatting</p>
            <p className="text-sm text-muted-foreground">Create an account or sign in to access live chat with suppliers.</p>
          </div>
          <Button className="w-full bg-[#1A0C05] text-primary-foreground hover:bg-primary/90 gap-2"
            onClick={() => { onClose(); navigate('/auth'); }}>
            Login / Register <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      );
    }

    // Supplier not subscribed
    if (chatState === 'supplier_not_subscribed') {
      return (
        <div className="flex flex-col items-center text-center gap-4 py-8 px-2">
          <div className="w-14 h-14 rounded-full bg-muted border border-border flex items-center justify-center">
            <MessageSquare className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Supplier unavailable for chat</p>
            <p className="text-sm text-muted-foreground">
              This supplier does not currently have an active subscription and cannot receive messages.
            </p>
          </div>
          <Button onClick={onClose} className="w-full bg-[#1A0C05] text-primary-foreground hover:bg-primary/90">Got it</Button>
        </div>
      );
    }

    // My subscription expired mid-chat
    if (chatState === 'my_sub_expired') {
      return (
        <div className="flex flex-col items-center text-center gap-4 py-8 px-2">
          <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <ShieldCheck className="w-7 h-7 text-destructive" />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Your subscription has expired</p>
            <p className="text-sm text-muted-foreground">Renew your supplier subscription to continue sending messages. Your chat history remains saved.</p>
          </div>
          <Link to={subscriptionPath} onClick={onClose} className="w-full">
            <Button className="w-full bg-[#1A0C05] text-primary-foreground hover:bg-primary/90 gap-2">
              Renew Subscription <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      );
    }

    // Their subscription expired
    if (chatState === 'their_sub_expired') {
      return (
        <div className="flex flex-col items-center text-center gap-4 py-8 px-2">
          <div className="w-14 h-14 rounded-full bg-muted border border-border flex items-center justify-center">
            <WifiOff className="w-7 h-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Supplier subscription expired</p>
            <p className="text-sm text-muted-foreground">Messaging is paused because the supplier's subscription has expired. Please try again later.</p>
          </div>
          <Button onClick={onClose} className="w-full bg-[#1A0C05] text-primary-foreground hover:bg-primary/90">Close</Button>
        </div>
      );
    }

    // Generic error
    if (chatState === 'error') {
      return (
        <div className="flex flex-col items-center text-center gap-4 py-8 px-2">
          <div className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center">
            <WifiOff className="w-7 h-7 text-destructive" />
          </div>
          <p className="text-sm text-muted-foreground">Something went wrong. Please try again.</p>
          <Button onClick={runChatAuth} variant="outline" className="gap-2 border-border">
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      );
    }

    // ── READY: full chat UI ───────────────────────────────────────────────
    return (
      <>
        {/* Realtime error banner */}
        {!realtimeOk && (
          <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20 text-destructive text-xs shrink-0">
            <WifiOff className="w-3.5 h-3.5 shrink-0" />
            <span className="flex-1">Connection lost. Messages may be delayed.</span>
            <button onClick={() => window.location.reload()} className="underline font-medium">Reconnect</button>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
          {loadingMsgs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center gap-2">
              <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No messages yet. Say hello!</p>
            </div>
          ) : (
            messages.map(msg => {
              const isMine = msg.sender_id === user?.id;
              const isUrgent = /(?:^|\b)(?:urgent|asap|emergency|rush|immediate|priority)(?:\b|$)/i.test(msg.content);
              return (
                <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  {!isMine && (
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[11px] font-bold text-foreground/80 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-primary" />
                        {supplier.company_name}
                      </span>
                      {isUrgent && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full bg-[#B33D00] text-white animate-pulse">
                          🚨 URGENT
                        </span>
                      )}
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm shadow-xs',
                    isMine
                      ? 'bg-[#C94400] text-primary-foreground rounded-br-sm'
                      : isUrgent
                      ? 'bg-card border-2 border-[#FF5A00]/80 text-foreground rounded-bl-sm ring-2 ring-[#FF5A00]/20'
                      : 'bg-card border border-border text-foreground rounded-bl-sm'
                  )}>
                    <p className="text-pretty break-words leading-relaxed">{msg.content}</p>
                    <p className={cn('text-[10px] mt-1 text-right', isMine ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="flex gap-2 px-4 py-3 border-t border-border shrink-0 bg-background">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type a message…"
            className="flex-1 bg-card border-border"
            disabled={sending}
            maxLength={4000}
          />
          <Button
            type="submit"
            disabled={sending || !input.trim()}
            className="bg-[#1A0C05] text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border p-0 flex flex-col overflow-hidden max-h-[90dvh]">
        {/* Header */}
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-sm font-bold text-foreground truncate leading-tight">
                Chat with {supplier.company_name}
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground">Live chat · Subscription required</p>
            </div>
            {chatState === 'ready' && (
              <span className="flex items-center gap-1 text-[10px] font-semibold text-[#FF7A2E] bg-[#FF5A00]/10 border border-[#FF5A00]/40 rounded-full px-2 py-0.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C94400] inline-block" /> Live
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Product context bar — always visible when ready */}
        {(chatState === 'ready' || chatState === 'my_sub_expired' || chatState === 'their_sub_expired') && (
          <div className="mx-4 mt-3 mb-1 bg-primary/5 border border-primary/15 rounded-xl p-3 shrink-0">
            <div className="flex items-start gap-2">
              <Package className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-primary uppercase tracking-wide mb-0.5">Product</p>
                <p className="text-sm font-bold text-foreground truncate">{product.name}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {priceDisplay && (
                    <span className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{priceDisplay}</span>
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">MOQ: {product.moq} {product.moq_unit}</span>
                </div>
              </div>
              <Link
                to={`/products/${product.slug}`}
                onClick={onClose}
                className="shrink-0 text-[10px] font-medium text-primary hover:underline flex items-center gap-0.5"
              >
                View <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex flex-col flex-1 min-h-0">
          {renderBody()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
