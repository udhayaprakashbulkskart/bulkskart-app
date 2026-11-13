import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, MessageSquare, Send, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { getMessages, sendSecureMessage } from '@/lib/api';
import type { Message } from '@/types/types';
import { toast } from 'sonner';

type Gate = 'checking' | 'guest' | 'self' | 'buyer_account' | 'needs_company' | 'needs_plan' | 'ready' | 'error';

const QUICK_NOTES = [
  'We can supply this requirement. Please share quantity, target price, and delivery city.',
  'Please share your buying specifications so we can send a quotation.',
  'We would like to schedule a call about your open buying requests.',
];

function gateFromError(message: string): Gate | null {
  const msg = message.toLowerCase();
  if (msg.includes('not_authenticated')) return 'guest';
  if (msg.includes('cannot_chat_with_self')) return 'self';
  if (msg.includes('supplier_company_required')) return 'needs_company';
  if (msg.includes('supplier_not_subscribed')) return 'needs_plan';
  return null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface Props {
  buyerUserId: string;
  buyerName: string;
  returnPath: string;
}

export default function BuyerProfileChat({ buyerUserId, buyerName, returnPath }: Props) {
  const { user, profile, loading: authLoading, company, isPaidSubscriber } = useAuth();
  const [gate, setGate] = useState<Gate>('checking');
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const authPath = `/auth?redirect=${encodeURIComponent(returnPath)}`;

  const ensureConversation = useCallback(async () => {
    const { data, error } = await supabase.rpc('start_buyer_profile_chat', { p_buyer_id: buyerUserId });
    if (error) {
      const mapped = gateFromError(error.message || '');
      if (mapped) {
        setGate(mapped);
        return null;
      }
      setGate('error');
      return null;
    }
    const id = typeof data === 'string' ? data : null;
    if (!id) {
      setGate('error');
      return null;
    }
    setConvId(id);
    setGate('ready');
    return id;
  }, [buyerUserId]);

  useEffect(() => {
    if (authLoading) {
      setGate('checking');
      return;
    }
    if (!user) {
      setGate('guest');
      setConvId(null);
      setMessages([]);
      return;
    }
    if (user.id === buyerUserId) {
      setGate('self');
      return;
    }
    if (!company?.id) {
      setGate(profile?.role === 'supplier' || profile?.role === 'admin' ? 'needs_company' : 'buyer_account');
      return;
    }
    if (!isPaidSubscriber) {
      setGate('needs_plan');
      return;
    }

    let cancelled = false;
    setGate('checking');
    supabase
      .from('conversations')
      .select('id')
      .eq('buyer_id', buyerUserId)
      .eq('supplier_id', user.id)
      .is('product_id', null)
      .is('requirement_id', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setGate('ready');
          return;
        }
        setConvId(data?.id ?? null);
        setGate('ready');
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, profile?.role, buyerUserId, company?.id, isPaidSubscriber]);

  useEffect(() => {
    if (!convId || gate !== 'ready') return;
    let cancelled = false;
    setLoadingMsgs(true);
    getMessages(convId).then(rows => {
      if (cancelled) return;
      setMessages(rows);
      setLoadingMsgs(false);
    });

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const channel = supabase
      .channel(`buyer-profile-chat-${convId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${convId}` },
        payload => {
          const incoming = payload.new as Message;
          setMessages(prev => (prev.some(item => item.id === incoming.id) ? prev : [...prev, incoming]));
        },
      )
      .subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [convId, gate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, gate]);

  const handleSend = async (text?: string) => {
    const content = (text ?? draft).trim();
    if (!content || sending || !user) return;
    setSending(true);
    try {
      const id = convId || await ensureConversation();
      if (!id) return;

      const secure = await sendSecureMessage(id, content);
      if (!secure.error && secure.message) {
        setMessages(prev => (prev.some(item => item.id === secure.message!.id) ? prev : [...prev, secure.message!]));
        setDraft('');
        return;
      }
      if (secure.error === 'subscription_expired' || secure.error === 'supplier_not_subscribed') {
        setGate('needs_plan');
        return;
      }
      if (secure.error === 'not_authenticated') {
        setGate('guest');
        return;
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: id, sender_id: user.id, content })
        .select('id, conversation_id, sender_id, content, created_at, is_read')
        .maybeSingle();
      if (error || !data) {
        toast.error('Message could not be sent. Try again in a moment.');
        return;
      }
      const saved = data as Message;
      setMessages(prev => (prev.some(item => item.id === saved.id) ? prev : [...prev, saved]));
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="buyer-chat" className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF5A00]/15 text-[#FF5A00]">
          <MessageSquare className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-bold text-foreground">Chat with {buyerName}</h2>
          <p className="text-[11px] text-muted-foreground">Messages go to this buyer’s BulkSkart inbox</p>
        </div>
        {gate === 'ready' && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#FF5A00]/15 px-2 py-0.5 text-[10px] font-bold text-[#FF7A2E] dark:text-[#FF7A2E]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#C94400]" /> Live
          </span>
        )}
      </div>

      {gate === 'checking' && (
        <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening chat…
        </div>
      )}

      {gate === 'guest' && (
        <div className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Sign in with a manufacturer account to message {buyerName}. Phone, WhatsApp, and email stay available in Contact.
          </p>
          <div className="flex flex-col gap-2">
            <Link to={authPath} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#C94400] px-3 text-xs font-bold text-white">
              Sign in to chat
            </Link>
            <Link to={`/auth?tab=supplier&redirect=${encodeURIComponent(returnPath)}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-3 text-xs font-bold text-foreground">
              Create a supplier account
            </Link>
          </div>
        </div>
      )}

      {gate === 'self' && (
        <div className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            This is your public profile. Replies from suppliers appear in your messages.
          </p>
          <Link to="/dashboard/buyer/messages" className="inline-flex h-10 items-center justify-center rounded-lg bg-[#C94400] px-3 text-xs font-bold text-white">
            Open messages
          </Link>
        </div>
      )}

      {gate === 'buyer_account' && (
        <div className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Chat is open to manufacturer accounts. Use the phone, WhatsApp, or email in Contact, or sign in as a supplier to message {buyerName} here.
          </p>
          <Link to={`/auth?tab=supplier&redirect=${encodeURIComponent(returnPath)}`} className="inline-flex h-10 items-center justify-center rounded-lg bg-[#C94400] px-3 text-xs font-bold text-white">
            Continue as a supplier
          </Link>
        </div>
      )}

      {gate === 'needs_company' && (
        <div className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            Finish your manufacturer profile before chatting with buyers. You can still use the contact details on this page.
          </p>
          <Link to="/dashboard/supplier" className="inline-flex h-10 items-center justify-center rounded-lg bg-[#C94400] px-3 text-xs font-bold text-white">
            Complete supplier profile
          </Link>
        </div>
      )}

      {gate === 'needs_plan' && (
        <div className="space-y-3 px-4 py-4">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A00]" />
            An active manufacturer plan is required to send messages. Call, WhatsApp, and email on this profile stay open.
          </p>
          <Link to="/dashboard/supplier/subscription" className="inline-flex h-10 items-center justify-center rounded-lg bg-[#C94400] px-3 text-xs font-bold text-white">
            View plans
          </Link>
        </div>
      )}

      {gate === 'error' && (
        <div className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted-foreground">Chat could not be opened. Use the contact details, or try again.</p>
          <button
            type="button"
            onClick={() => { void ensureConversation(); }}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-3 text-xs font-bold text-foreground"
          >
            Retry
          </button>
        </div>
      )}

      {gate === 'ready' && (
        <>
          <div className="h-64 space-y-2 overflow-y-auto bg-muted/30 px-3 py-3">
            {loadingMsgs ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <p className="px-1 pt-6 text-center text-xs text-muted-foreground">
                No messages yet. Introduce your company and the products you can supply.
              </p>
            ) : (
              messages.map(message => {
                const mine = message.sender_id === user?.id;
                return (
                  <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? 'rounded-br-sm bg-[#C94400] text-white' : 'rounded-bl-sm border border-border bg-card text-foreground'}`}>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
                      <p className={`mt-1 text-right text-[10px] ${mine ? 'text-white/75' : 'text-muted-foreground'}`}>
                        {formatTime(message.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
          <div className="flex gap-1.5 overflow-x-auto border-t border-border px-3 py-2">
            {QUICK_NOTES.map(note => (
              <button
                key={note}
                type="button"
                onClick={() => setDraft(note)}
                className="shrink-0 rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
              >
                {note.slice(0, 42)}…
              </button>
            ))}
          </div>
          <form
            onSubmit={event => {
              event.preventDefault();
              void handleSend();
            }}
            className="flex items-end gap-2 border-t border-border p-3"
          >
            <textarea
              value={draft}
              onChange={event => setDraft(event.target.value)}
              rows={2}
              maxLength={4000}
              placeholder={`Message ${buyerName}`}
              aria-label={`Message ${buyerName}`}
              className="min-h-11 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#C94400] text-white disabled:opacity-50"
              aria-label="Send message"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </form>
          <div className="px-4 pb-3">
            <Link to="/dashboard/supplier/messages" className="text-[11px] font-semibold text-[#FF5A00]">
              Open full inbox
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
