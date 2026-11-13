import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Building2, Loader2, Mail, MapPin, MessageSquare, Package, Phone, ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import MainLayout from '@/components/layouts/MainLayout';
import PageMeta from '@/components/common/PageMeta';
import Breadcrumbs from '@/components/common/Breadcrumbs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';
import { telLink, waLink } from '@/lib/supplierPublicProfile';

interface BuyerPublic {
  user_id: string;
  public_slug: string;
  company_name: string;
  brand_name: string | null;
  business_type: string | null;
  gst_number: string | null;
  annual_volume: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  verified: boolean;
  verification_status: string | null;
  logo_url: string | null;
  banner_url: string | null;
  whatsapp_number: string | null;
  website: string | null;
  year_established: number | null;
  description: string | null;
  product_categories: string[] | null;
  target_products: string[] | null;
  trade_type: string | null;
  countries_served: string[] | null;
  created_at: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  email: string | null;
  profile_whatsapp: string | null;
}

interface BuyingNeed {
  id: string;
  title: string;
  quantity: number;
  quantity_unit: string;
  destination_city: string | null;
  destination_country: string | null;
  currency: string;
  budget_min: number | null;
  budget_max: number | null;
  images: string[] | null;
  status: string;
}

const FALLBACK_BANNER = 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=70';

export default function BuyerPublicProfilePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [buyer, setBuyer] = useState<BuyerPublic | null>(null);
  const [needs, setNeeds] = useState<BuyingNeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingChat, setOpeningChat] = useState(false);
  const chatStarted = useRef(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    supabase.rpc('buyer_public_profile', { p_slug: slug }).then(async ({ data }) => {
      const row = (Array.isArray(data) ? data[0] : data) as BuyerPublic | undefined;
      if (cancelled) return;
      if (!row) {
        setBuyer(null);
        setNeeds([]);
        setLoading(false);
        return;
      }
      const { data: reqs } = await supabase
        .from('requirements')
        .select('id, title, quantity, quantity_unit, destination_city, destination_country, currency, budget_min, budget_max, images, status')
        .eq('buyer_id', row.user_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(24);
      if (cancelled) return;
      setBuyer(row);
      setNeeds((reqs as BuyingNeed[]) || []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const openChat = useCallback(async () => {
    if (!buyer || openingChat) return;
    const returnTo = `/buyers/${buyer.public_slug}?chat=1`;
    if (!user) {
      navigate(`/auth?tab=supplier&redirect=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (user.id === buyer.user_id) {
      navigate('/dashboard/buyer/messages');
      return;
    }

    setOpeningChat(true);
    try {
      const { data, error } = await supabase.rpc('start_buyer_profile_chat', { p_buyer_id: buyer.user_id });
      if (error) {
        const message = (error.message || '').toLowerCase();
        if (message.includes('not_authenticated')) {
          navigate(`/auth?tab=supplier&redirect=${encodeURIComponent(returnTo)}`);
          return;
        }
        if (message.includes('cannot_chat_with_self')) {
          navigate('/dashboard/buyer/messages');
          return;
        }
        if (message.includes('supplier_not_subscribed')) {
          toast.message('An active manufacturer plan is required to chat with this buyer.');
          navigate('/dashboard/supplier/subscription');
          return;
        }
        if (message.includes('supplier_company_required')) {
          toast.message('A manufacturer account is required to chat with this buyer.');
          navigate('/business-setup');
          return;
        }
        toast.error('Could not open this chat. Please try again.');
        return;
      }
      const conversationId = typeof data === 'string' ? data : null;
      if (!conversationId) {
        toast.error('Could not open this chat. Please try again.');
        return;
      }
      navigate(`/dashboard/supplier/negotiation/${conversationId}`);
    } finally {
      setOpeningChat(false);
    }
  }, [buyer, openingChat, user, navigate]);

  useEffect(() => {
    if (chatStarted.current || loading || authLoading || !buyer || !user) return;
    if (new URLSearchParams(window.location.search).get('chat') !== '1') return;
    chatStarted.current = true;
    void openChat();
  }, [loading, authLoading, buyer, user, openChat]);

  if (loading) {
    return (
      <MainLayout>
        <div className="mx-auto max-w-5xl px-4 py-16 text-sm text-muted-foreground">Loading buyer profile…</div>
      </MainLayout>
    );
  }

  if (!buyer) {
    return (
      <MainLayout>
        <PageMeta title="Buyer Not Found | BulkSkart" description="This buyer profile is not available." robots="noindex, nofollow" />
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-[#FF5A00]" />
          <h1 className="text-xl font-bold text-foreground">Buyer profile not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This link does not match a public buyer profile.</p>
          <Link to="/requirements" className="mt-5 inline-flex h-10 items-center rounded-xl bg-[#C94400] px-4 text-sm font-bold text-white">
            Browse buying requests
          </Link>
        </div>
      </MainLayout>
    );
  }

  const phone = buyer.phone?.trim() || '';
  const whatsapp = buyer.whatsapp_number?.trim() || buyer.profile_whatsapp?.trim() || phone;
  const email = buyer.email?.trim() || '';
  const portrait = buyer.logo_url || buyer.avatar_url;
  const displayName = buyer.company_name || buyer.full_name || 'Buyer';
  const place = [buyer.city, buyer.state, buyer.country].filter(Boolean).join(', ');
  const interests = [...(buyer.product_categories || []), ...(buyer.target_products || [])].filter(Boolean);
  const verified = buyer.verified || buyer.verification_status === 'verified';
  const memberSince = buyer.created_at ? new Date(buyer.created_at).getFullYear() : null;

  return (
    <MainLayout>
      <PageMeta
        title={`${displayName} — Wholesale Buyer | BulkSkart`}
        description={`${displayName} is a wholesale buyer${place ? ` in ${place}` : ''} on BulkSkart. View contact details and open buying requests.`}
        canonical={`/buyers/${buyer.public_slug}`}
        ogType="profile"
        ogImage={portrait || FALLBACK_BANNER}
      />
      <div className="mx-auto max-w-[1100px] px-4 pb-24 pt-6 md:px-6 md:pb-8">
        <Breadcrumbs items={[{ name: 'Buying Requests', href: '/requirements' }, { name: displayName }]} className="mb-4" />

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="h-28 bg-cover bg-center sm:h-40" style={{ backgroundImage: `url(${buyer.banner_url || FALLBACK_BANNER})` }} />
          <div className="flex flex-col gap-4 px-4 pb-4 sm:flex-row sm:items-end sm:px-5">
            <div className="-mt-10 h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-card bg-muted sm:h-24 sm:w-24">
              {portrait ? (
                <img src={portrait} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-[#1A0C05] text-2xl font-bold text-white">
                  {displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-foreground sm:text-2xl">{displayName}</h1>
                {verified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#FF5A00]/15 px-2 py-0.5 text-[11px] font-bold text-[#FF7A2E] dark:text-[#FF7A2E]">
                    <ShieldCheck className="h-3.5 w-3.5" /> Verified buyer
                  </span>
                )}
              </div>
              {buyer.full_name && buyer.full_name !== displayName && (
                <p className="text-sm text-muted-foreground">{buyer.full_name}</p>
              )}
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {place && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{place}</span>}
                {buyer.business_type && <span>{buyer.business_type}</span>}
                {buyer.trade_type && <span>{buyer.trade_type}</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { void openChat(); }}
              disabled={openingChat}
              className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#C94400] px-4 text-sm font-bold text-white disabled:opacity-60 sm:w-auto"
            >
              {openingChat ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Chat
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="order-2 space-y-4 lg:order-1">
            {buyer.description && (
              <section className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-bold text-foreground">About</h2>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{buyer.description}</p>
              </section>
            )}

            <section className="rounded-xl border border-border bg-card p-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                <Package className="h-4 w-4 text-[#FF5A00]" /> Open buying requests
              </h2>
              {needs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open buying requests yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {needs.map(need => {
                    const image = need.images?.find(Boolean);
                    return (
                      <Link key={need.id} to={`/requirements/${need.id}`} className="overflow-hidden rounded-xl border border-border bg-background">
                        <div className="aspect-square bg-muted">
                          {image ? <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" /> : (
                            <div className="flex h-full items-center justify-center text-muted-foreground"><Package className="h-6 w-6" /></div>
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="line-clamp-2 text-sm font-semibold text-foreground">{need.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {need.quantity.toLocaleString()} {need.quantity_unit}
                          </p>
                          {(need.destination_city || need.destination_country) && (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {[need.destination_city, need.destination_country].filter(Boolean).join(', ')}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="order-1 space-y-4 lg:order-2">
            <section className="rounded-xl border border-border bg-card p-4 text-sm">
              <h2 className="mb-2 text-sm font-bold text-foreground">Business</h2>
              <dl className="space-y-1.5 text-xs">
                {buyer.business_type && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Business type</dt><dd className="text-right text-foreground">{buyer.business_type}</dd></div>}
                {buyer.trade_type && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Trade</dt><dd className="text-right text-foreground">{buyer.trade_type}</dd></div>}
                {buyer.gst_number && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">GST</dt><dd className="font-mono text-foreground">{buyer.gst_number}</dd></div>}
                {buyer.annual_volume && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Buying volume</dt><dd className="text-right text-foreground">{buyer.annual_volume}</dd></div>}
                {buyer.year_established && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Established</dt><dd className="text-foreground">{buyer.year_established}</dd></div>}
                {memberSince && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">On BulkSkart</dt><dd className="text-foreground">{memberSince}</dd></div>}
                {buyer.brand_name && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Brand</dt><dd className="text-right text-foreground">{buyer.brand_name}</dd></div>}
              </dl>
              {interests.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {interests.slice(0, 12).map(item => (
                    <span key={item} className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{item}</span>
                  ))}
                </div>
              )}
              {buyer.countries_served && buyer.countries_served.length > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">Sourcing for {buyer.countries_served.join(', ')}</p>
              )}
            </section>
          </aside>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-2 border-t border-border bg-card/95 px-4 py-2.5 backdrop-blur md:hidden">
        <p className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">{displayName}</p>
        <button
          type="button"
          onClick={() => { void openChat(); }}
          disabled={openingChat}
          className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#C94400] px-3 text-xs font-bold text-white disabled:opacity-60"
        >
          {openingChat ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
          Chat
        </button>
        {phone && <a href={telLink(phone)} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-bold">Call</a>}
        {whatsapp && <a href={waLink(whatsapp)} className="inline-flex h-9 items-center rounded-lg border border-[#FF5A00]/40 px-3 text-xs font-bold text-[#FF7A2E] dark:text-[#FF7A2E]">WhatsApp</a>}
        {email && !phone && !whatsapp && <a href={`mailto:${email}`} className="inline-flex h-9 items-center rounded-lg border border-border px-3 text-xs font-bold">Email</a>}
      </div>
    </MainLayout>
  );
}
