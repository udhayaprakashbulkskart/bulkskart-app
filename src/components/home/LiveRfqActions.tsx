import { useState, type SyntheticEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, Lock, Loader2, MessageSquare, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { checkSupplierPaidSubscription } from '@/lib/api';
import { contactUpgradeHref, telHref, whatsappHref } from '@/lib/contactAccess';
import { fetchRfqBuyerContacts } from '@/lib/profileContacts';
import SubscribeToContactDialog, { type SubscriptionReason } from '@/components/common/SubscribeToContactDialog';
import type { LiveRfqCard } from '@/components/home/LiveRfqScrollSection';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12.04 2c-5.46 0-9.91 4.43-9.91 9.9 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.9-4.44 9.9-9.9 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm0 1.8a8.1 8.1 0 0 1 8.11 8.1 8.1 8.1 0 0 1-8.11 8.11c-1.42 0-2.82-.37-4.05-1.07l-.29-.17-3.12.82.83-3.04-.19-.31a8.08 8.08 0 0 1-1.3-4.34 8.1 8.1 0 0 1 8.12-8.1zm-2.67 5.17c-.15-.32-.3-.33-.44-.33h-.38c-.13 0-.34.05-.52.26-.18.2-.68.66-.68 1.62 0 .95.7 1.88.8 2.01.1.13 1.37 2.2 3.38 2.99 1.67.66 2.01.53 2.38.5.36-.04 1.17-.48 1.34-.94.16-.46.16-.86.11-.94-.05-.08-.18-.13-.38-.23-.2-.1-1.17-.58-1.35-.64-.18-.07-.31-.1-.44.1-.13.2-.5.64-.62.77-.11.13-.23.15-.43.05-.2-.1-.84-.31-1.6-.99-.59-.52-.99-1.17-1.1-1.37-.12-.2-.01-.3.09-.4.09-.09.2-.23.3-.35.1-.11.13-.2.2-.33.07-.13.03-.25-.02-.35-.05-.1-.44-1.07-.6-1.46z"
      />
    </svg>
  );
}


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

  // Colours follow the Live RFQs mockup. Green stays in both themes; Chat is outlined.
  const actionBtn = 'inline-flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-bold sm:h-11 sm:text-[12px]';
  const callBtn = `${actionBtn} border-[#16A34A] bg-[#16A34A] text-white hover:bg-[#15803d] hover:border-[#15803d]`;
  const waBtn = `${actionBtn} border-[#16A34A] bg-[#16A34A] text-white hover:bg-[#15803d] hover:border-[#15803d]`;
  const chatBtn = `${actionBtn} border-black/40 bg-transparent text-black hover:bg-black/5 dark:border-white/80 dark:text-white dark:hover:bg-white/10`;
  const quoteBtn = `live-rfq-quote-btn ${actionBtn} border-[#FF5A00] bg-[#FF5A00] text-white hover:bg-[#e04e00] hover:border-[#e04e00]`;

  return (
    <div className="mt-2.5" onClick={stop} onPointerDown={stop}>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" tabIndex={tabIndex} className={callBtn} onClick={() => { void openContact('call'); }} disabled={busy === 'call'}>
          {busy === 'call' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : paid ? <Phone className="h-3.5 w-3.5" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
          Call
        </button>
        <button type="button" tabIndex={tabIndex} className={waBtn} onClick={() => { void openContact('whatsapp'); }} disabled={busy === 'whatsapp'}>
          {busy === 'whatsapp' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : paid ? <WhatsAppIcon className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
          WhatsApp
        </button>
        <button type="button" tabIndex={tabIndex} className={chatBtn} onClick={() => { void openTab('chat'); }}>
          {paid ? <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
          Chat
        </button>
        <button type="button" tabIndex={tabIndex} className={quoteBtn} onClick={() => { void openTab('quotes'); }}>
          {paid ? <FileText className="h-3.5 w-3.5" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
          Quote
        </button>
      </div>
      {locked && (
        <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
          Paid suppliers only.{' '}
          <Link to={user ? contactUpgradeHref(profile?.role) : '/register'} className="font-semibold text-[#FF5A00] hover:underline">Upgrade</Link>
          {' '}to call, WhatsApp, chat or quote.
        </p>
      )}
      <SubscribeToContactDialog open={dialogOpen} onClose={() => setDialogOpen(false)} reason={dialogReason} />
    </div>
  );
}

