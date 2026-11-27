import { useState, type SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Loader2, MessageCircle, MessageSquare, Phone, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { checkSupplierPaidSubscription } from '@/lib/api';
import { contactUpgradeHref, telHref, whatsappHref } from '@/lib/contactAccess';
import { fetchRfqBuyerContacts } from '@/lib/profileContacts';
import SubscribeToContactDialog, { type SubscriptionReason } from '@/components/common/SubscribeToContactDialog';
import type { LiveRfqCard } from '@/components/home/LiveRfqScrollSection';

/**
 * Call, WhatsApp, Quote and Chat on a home Live RFQ card.
 * Same paid-supplier (or admin) rule as the RFQ detail page (PR #54).
 * Buyer phone numbers are fetched through rfq_buyer_contacts only after a paid click — never preloaded.
 */
export default function LiveRfqActions({ card, tabIndex }: { card: LiveRfqCard; tabIndex?: number }) {
  const { user, profile, company, isPaidSubscriber } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogReason, setDialogReason] = useState<SubscriptionReason>('no_subscription');
  const [busy, setBusy] = useState<'call' | 'whatsapp' | null>(null);
  const paid = Boolean(isPaidSubscriber);
  const locked = !paid;

  const ask = (reason: SubscriptionReason): false => {
    setDialogReason(reason);
    setDialogOpen(true);
    return false;
  };

  const gate = async (): Promise<boolean> => {
    if (paid) return true;
    if (!user) return ask('not_logged_in');
    if (!company) return ask('not_registered_business');
    const subCheck = await checkSupplierPaidSubscription(company.id, company);
    if (!subCheck.allowed) return ask(subCheck.reason);
    return true;
  };

  const openContact = async (kind: 'call' | 'whatsapp') => {
    if (busy) return;
    if (!(await gate())) return;
    setBusy(kind);
    try {
      const contacts = await fetchRfqBuyerContacts(card.id);
      const phone = contacts?.phone || contacts?.whatsapp_number;
      const href = kind === 'call'
        ? telHref(contacts?.phone)
        : whatsappHref(phone, { title: card.title, id: card.id });
      if (!href) {
        toast.error('The buyer has not shared a phone number');
        return;
      }
      if (kind === 'whatsapp') window.open(href, '_blank', 'noopener,noreferrer');
      else window.location.href = href;
    } finally {
      setBusy(null);
    }
  };

  const openTab = async (tab: 'quotes' | 'chat') => {
    if (!(await gate())) return;
    navigate(`/requirements/${card.id}?tab=${tab}`);
  };

  const stop = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const btn = `inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-lg border px-1.5 text-[10px] font-bold sm:h-8 sm:text-[11px] ${
    paid
      ? 'border-[#FF5A00]/50 text-[#E04E00] hover:bg-[#FF5A00]/10 dark:text-[#FF7A2E]'
      : 'border-border text-muted-foreground hover:bg-muted/60'
  }`;
  const quoteBtn = paid
    ? 'inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-lg bg-[#FF5A00] px-1.5 text-[10px] font-bold text-white hover:bg-[#e04e00] sm:text-[11px]'
    : btn;

  return (
    <div className="mt-2.5" onClick={stop} onPointerDown={stop}>
      <div className="grid grid-cols-2 gap-1">
        <button type="button" tabIndex={tabIndex} className={btn} onClick={() => { void openContact('call'); }} disabled={busy === 'call'}>
          {busy === 'call' ? <Loader2 className="h-3 w-3 animate-spin" /> : paid ? <Phone className="h-3 w-3" aria-hidden="true" /> : <Lock className="h-3 w-3" aria-hidden="true" />}
          Call
        </button>
        <button type="button" tabIndex={tabIndex} className={btn} onClick={() => { void openContact('whatsapp'); }} disabled={busy === 'whatsapp'}>
          {busy === 'whatsapp' ? <Loader2 className="h-3 w-3 animate-spin" /> : paid ? <MessageCircle className="h-3 w-3" aria-hidden="true" /> : <Lock className="h-3 w-3" aria-hidden="true" />}
          WhatsApp
        </button>
        <button type="button" tabIndex={tabIndex} className={btn} onClick={() => { void openTab('chat'); }}>
          {paid ? <MessageSquare className="h-3 w-3" aria-hidden="true" /> : <Lock className="h-3 w-3" aria-hidden="true" />}
          Chat
        </button>
        <button type="button" tabIndex={tabIndex} className={quoteBtn} onClick={() => { void openTab('quotes'); }}>
          {paid ? <Send className="h-3 w-3" aria-hidden="true" /> : <Lock className="h-3 w-3" aria-hidden="true" />}
          Quote
        </button>
      </div>
      {locked && (
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
          {user ? (
            <>Paid suppliers only. <Link to={contactUpgradeHref(profile?.role)} className="font-semibold text-[#FF5A00] hover:underline">Upgrade</Link> to call, WhatsApp, chat or quote.</>
          ) : (
            <>Paid suppliers only. <Link to="/register" className="font-semibold text-[#FF5A00] hover:underline">Sign up</Link> to get access.</>
          )}
        </p>
      )}
      <SubscribeToContactDialog open={dialogOpen} onClose={() => setDialogOpen(false)} reason={dialogReason} />
    </div>
  );
}

