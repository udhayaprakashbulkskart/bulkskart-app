import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { buyerPublicUrl, copyText, supplierPublicUrl } from '@/lib/supplierPublicProfile';

interface CopyPublicProfileButtonProps {
  compact?: boolean;
}

export default function CopyPublicProfileButton({ compact = false }: CopyPublicProfileButtonProps) {
  const { company, profile, resolvedRole, buyerProfile } = useAuth();
  const [copied, setCopied] = useState(false);
  const isSupplier = resolvedRole === 'supplier' || profile?.role === 'supplier';
  const isBuyer = !isSupplier && (resolvedRole === 'buyer' || profile?.role === 'buyer');
  if (!isSupplier && !isBuyer) return null;

  const slug = isSupplier ? company?.slug?.trim() : buyerProfile?.public_slug?.trim();
  const setupPath = isSupplier ? '/dashboard/supplier/profile' : '/dashboard/buyer/profile';
  if (!slug) {
    return (
      <Link
        to={setupPath}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[11px] font-bold text-foreground hover:border-[#FF5A00]/50"
      >
        <Link2 className="h-3.5 w-3.5 text-[#FF5A00]" />
        {compact ? null : 'Public profile'}
      </Link>
    );
  }

  const copy = async () => {
    const url = isSupplier ? supplierPublicUrl(slug) : buyerPublicUrl(slug);
    const ok = await copyText(url);
    if (!ok) {
      toast.error('Could not copy the link. Select it from your public profile.');
      return;
    }
    setCopied(true);
    toast.success('Public profile link copied');
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy your public profile link"
      aria-label="Copy public profile link"
      className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-[#FF5A00]/40 bg-[#FF5A00]/10 font-bold text-[#FF5A00] hover:bg-[#B33D00]/15 ${
        compact ? 'w-8 px-0' : 'px-2.5 text-[11px]'
      }`}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      {compact ? null : <span>{copied ? 'Copied' : 'Copy public link'}</span>}
    </button>
  );
}
