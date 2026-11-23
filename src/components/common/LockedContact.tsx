/**
 * Contact details hidden from people without a paid subscription: the rows show only dots (the real values are not
 * loaded), with a button to the paid plans.
 */
import { Link } from 'react-router-dom';
import { Lock, Mail, MessageSquare, Phone } from 'lucide-react';
import { CONTACT_LOCK_NOTE } from '@/lib/contactAccess';

const ROWS = [
  { icon: Phone, label: 'Phone', mask: '+91 ••••• •••••' },
  { icon: MessageSquare, label: 'WhatsApp', mask: '+91 ••••• •••••' },
  { icon: Mail, label: 'Email', mask: '••••••••@••••••.com' },
];

export default function LockedContact({ upgradeHref }: { upgradeHref: string }) {
  return (
    <div className="space-y-2">
      {ROWS.map(({ icon: Icon, label, mask }) => (
        <div key={label} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm" aria-label={`${label} hidden`}>
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1 select-none truncate font-mono tracking-wider text-muted-foreground" aria-hidden="true">{mask}</span>
          <Lock className="h-3.5 w-3.5 shrink-0 text-[#FF5A00]" aria-hidden="true" />
        </div>
      ))}
      <Link
        to={upgradeHref}
        className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#FF5A00]/40 bg-[#FF5A00]/10 px-3 text-sm font-bold text-[#E04E00] transition-colors hover:bg-[#FF5A00]/15 dark:text-[#FF7A2E]"
      >
        <Lock className="h-4 w-4" aria-hidden="true" />
        Subscribe to view contact details
      </Link>
      <p className="px-1 text-[11px] leading-snug text-muted-foreground">{CONTACT_LOCK_NOTE}</p>
    </div>
  );
}
