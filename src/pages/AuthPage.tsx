import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PageMeta from '@/components/common/PageMeta';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BrandLogo from '@/components/common/BrandLogo';
import { supabase } from '@/db/supabase';
import { toast } from 'sonner';
import { Globe, Shield, Eye, EyeOff, Upload, AlertCircle, CheckCircle, ArrowRight, Package, Mail, Loader2, Send, Lock, User, Phone, Building2, MapPin, Receipt, Hash } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Actions, Done, Field, FormDialog, IconBox, KitButton, TextInput, fk } from '@/components/formkit';
import { CITY_NAMES } from '@/lib/signup/places';
import { Checkbox } from '@/components/ui/checkbox';
import { trackSignUp } from '@/lib/analytics';
import { getOpenRequirements } from '@/lib/api';
import { placeLabel, quantityLabel } from '@/lib/requirementVisuals';

function timeSince(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// ── Industry mockup images (Optimized Unsplash CDN with auto-format) ────────────
const INDUSTRY_SLIDES = [
  {
    img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=75',
    label: 'Global Shipping & Logistics',
  },
  {
    img: 'https://cdn.pixabay.com/photo/2016/09/12/07/48/mechanical-1663275_1280.jpg',
    label: 'Machinery & Industrial',
  },
  {
    img: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=75',
    label: 'Textiles & Apparel',
  },
  {
    img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=800&q=75',
    label: 'Food & Beverages',
  },
  {
    img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=75',
    label: 'Electronics & Components',
  },
  {
    img: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=75',
    label: 'Bulk Cargo & Freight',
  },
];

// Per-tab context shown on the left panel: what each kind of account can do, with no made-up counts.
const TAB_CONTEXT: Record<string, { heading: string; sub: string; stats: { label: string; value: string }[]; pills: string[] }> = {
  login: {
    heading: 'Welcome Back to\nBulkSkart',
    sub: 'Sign in to manage your requirements, track quotations and talk to suppliers and buyers.',
    stats: [
      { value: 'Requirements', label: 'Post what you need and follow each one' },
      { value: 'Quotations', label: 'Compare the quotes suppliers send you' },
      { value: 'Messages', label: 'Chat with buyers and suppliers' },
      { value: 'Auctions', label: 'Bid on, or sell, bulk lots live' },
    ],
    pills: ['Textiles', 'Machinery', 'Agriculture', 'Electronics', 'Pharma'],
  },
  buyer: {
    heading: 'Source Bulk Products\nFrom Manufacturers',
    sub: 'Post your requirement once and receive quotations from suppliers on BulkSkart.',
    stats: [
      { value: 'Post an RFQ', label: 'Product, quantity and where to deliver' },
      { value: 'Get quotes', label: 'Suppliers send their price and terms' },
      { value: 'Compare', label: 'Quotes side by side, in one place' },
      { value: 'Chat', label: 'Message suppliers directly' },
    ],
    pills: ['Free Registration', 'Post RFQs', 'Compare Quotes', 'Direct Chat'],
  },
  supplier: {
    heading: 'Reach Bulk Buyers\nOn BulkSkart',
    sub: "Get your business verified, list your products, and quote on buyers' bulk requirements.",
    stats: [
      { value: 'Buyer RFQs', label: 'Browse open requirements and quote' },
      { value: 'Products', label: 'List products with your own photos' },
      { value: 'Verification', label: 'Earn the verified badge with KYC' },
      { value: 'Auctions', label: 'Sell bulk stock in a live auction' },
    ],
    pills: ['Verification Badge', 'RFQ Leads', 'Product Listings', 'Live Auctions'],
  },
};

// ── Left panel component ───────────────────────────────────────────────────────
function AuthLeftPanel({ tab }: { tab: string }) {
  const ctx = TAB_CONTEXT[tab] ?? TAB_CONTEXT.login;
  const [slideIdx, setSlideIdx] = useState(0);
  const [activityIdx, setActivityIdx] = useState(0);
  const [latest, setLatest] = useState<{ id: string; text: string; when: string }[]>([]);
  const [fadeSlide, setFadeSlide] = useState(true);
  const [fadeActivity, setFadeActivity] = useState(true);

  // Cycle background image every 4s
  useEffect(() => {
    const t = setInterval(() => {
      setFadeSlide(false);
      setTimeout(() => {
        setSlideIdx(i => (i + 1) % INDUSTRY_SLIDES.length);
        setFadeSlide(true);
      }, 400);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // The newest open requirements, as posted (the ticker stays hidden when there are none)
  useEffect(() => {
    let alive = true;
    getOpenRequirements({ page: 1, pageSize: 6, sort: 'latest' }).then(({ rows }) => {
      if (!alive) return;
      setLatest(rows.map((r) => {
        const place = placeLabel(r);
        return { id: r.id, text: `New RFQ: ${quantityLabel(r)} ${r.title}${place ? ` — ${place}` : ''}`, when: timeSince(r.created_at) };
      }));
    });
    return () => {
      alive = false;
    };
  }, []);

  // Cycle the ticker every 3s
  useEffect(() => {
    if (latest.length < 2) return;
    const t = setInterval(() => {
      setFadeActivity(false);
      setTimeout(() => {
        setActivityIdx(i => (i + 1) % latest.length);
        setFadeActivity(true);
      }, 300);
    }, 3000);
    return () => clearInterval(t);
  }, [latest.length]);

  const slide = INDUSTRY_SLIDES[slideIdx];
  const activity = latest.length ? latest[activityIdx % latest.length] : null;

  return (
    <div className="hidden md:flex md:w-[52%] relative flex-col justify-between overflow-hidden bg-[#0d1117]">
      {/* ── Cycling background image ── */}
      <div
        className="absolute inset-0 z-0 transition-opacity duration-500"
        style={{ opacity: fadeSlide ? 1 : 0 }}
      >
        <img src={slide.img} alt="" className="w-full h-full object-cover" />
        {/* deep dark overlay — darker at top/bottom for legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d1117]/85 via-[#0d1117]/55 to-[#0d1117]/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d1117]/60 via-transparent to-transparent" />
      </div>

      {/* ── Slide label chip and dots, out of the way of the text ── */}
      <div className="absolute bottom-5 right-6 z-20 flex items-center gap-3">
        <span
          className="text-[10px] font-bold text-white/60 uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/15 bg-white/5 backdrop-blur-sm transition-opacity duration-500"
          style={{ opacity: fadeSlide ? 1 : 0 }}
        >
          {slide.label}
        </span>
        <div className="flex gap-1.5">
          {INDUSTRY_SLIDES.map((item, i) => (
            <button
              key={item.label}
              type="button"
              aria-label={`Show ${item.label}`}
              onClick={() => setSlideIdx(i)}
              className={`rounded-full transition-all duration-300 ${i === slideIdx ? 'w-4 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'}`}
            />
          ))}
        </div>
      </div>

      {/* ── Top: logo ── */}
      <div className="relative z-10 p-8">
        <BrandLogo size="lg" variant="dark" linkTo="/" />
      </div>

      {/* ── Middle: heading + pills ── */}
      <div className="relative z-10 px-8 pb-4">
        <h2 className="text-[26px] font-black text-white leading-tight mb-3 whitespace-pre-line">
          {ctx.heading.split('\n').map((line, i) => (
            <span key={i} className={i === 1 ? 'text-primary' : ''}>{line}{i === 0 ? '\n' : ''}</span>
          ))}
        </h2>
        <p className="text-[13px] text-white/60 mb-5 max-w-sm leading-relaxed">{ctx.sub}</p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {ctx.pills.map(pill => (
            <span key={pill} className="flex items-center gap-1.5 text-[11px] font-semibold text-white/80 bg-white/10 border border-white/15 rounded-full px-3 py-1 backdrop-blur-sm">
              <CheckCircle className="w-3 h-3 text-primary shrink-0" />{pill}
            </span>
          ))}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {ctx.stats.map(s => (
            <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-3 backdrop-blur-sm">
              <div className="text-[18px] font-black text-white leading-none mb-0.5">{s.value}</div>
              <div className="text-[10px] text-white/50">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Newest real requirement */}
        {activity && (
          <div
            className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 backdrop-blur-sm transition-opacity duration-300"
            style={{ opacity: fadeActivity ? 1 : 0 }}
          >
            <div className="w-7 h-7 rounded-lg bg-[#FF5A00] flex items-center justify-center shrink-0">
              <Package className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white/80 truncate">{activity.text}</p>
              <p className="text-[9px] text-white/35 mt-0.5">{activity.when} · posted on BulkSkart</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Bottom: trust badge ── */}
      <div className="relative z-10 px-8 pb-6 flex items-center gap-2">
        <Shield className="w-4 h-4 text-primary shrink-0" />
        <span className="text-[11px] text-white/40">Secure sign-in · Your contact details stay private</span>
      </div>
    </div>
  );
}

function generateSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
}

export default function AuthPage() {
  const { user, profile, signIn, signUp, refreshProfile, resolvedRole, loading: authLoading, dashboardPath } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const getResolvedTab = (): 'login' | 'buyer' | 'supplier' => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'supplier') return 'supplier';
    if (tabParam === 'buyer' || tabParam === 'register') return 'buyer';
    if (location.pathname === '/register' || location.pathname === '/signup') {
      return searchParams.get('role') === 'supplier' ? 'supplier' : 'buyer';
    }
    if (location.pathname === '/login') return 'login';
    return 'login';
  };

  const [activeTab, setActiveTab] = useState<'login' | 'buyer' | 'supplier'>(getResolvedTab);

  // Sync activeTab whenever route or searchParams change
  useEffect(() => {
    setActiveTab(getResolvedTab());
  }, [location.pathname, searchParams]);

  // Manufacturers register with the signup assistant (a minute, not a long form) unless they asked for the full form
  useEffect(() => {
    if (user || authLoading || activeTab !== 'supplier' || searchParams.get('form') === 'full') return;
    const back = searchParams.get('redirect') || searchParams.get('returnUrl');
    navigate(`/signup/manufacturer${back ? `?redirect=${encodeURIComponent(back)}` : ''}`, { replace: true });
  }, [user, authLoading, activeTab, searchParams, navigate]);

  // Already signed in → return to the requested page, otherwise the role dashboard
  useEffect(() => {
    if (!user || authLoading) return;
    // Never default to buyer while role is still unknown
    if (!resolvedRole) return;
    const customRedirect = searchParams.get('redirect') || searchParams.get('returnUrl');
    if (customRedirect && customRedirect.startsWith('/') && !customRedirect.startsWith('//')) {
      navigate(customRedirect, { replace: true });
      return;
    }
    navigate(dashboardPath, { replace: true });
  }, [user, authLoading, resolvedRole, dashboardPath, navigate, searchParams]);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // Forgot password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = forgotEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setForgotError(email ? 'Please enter a valid e-mail address.' : 'Please enter your e-mail address.');
      document.getElementById('forgot-email')?.focus();
      return;
    }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?tab=login`,
      });
      if (error) {
        toast.error(error.message || 'Failed to send password reset email');
      } else {
        setForgotSent(true);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send password reset email');
    } finally {
      setForgotLoading(false);
    }
  };

  // Buyer register state — GST removed (not needed for buyers)
  const [buyerData, setBuyerData] = useState({ fullName: '', email: '', phone: '', password: '', companyName: '', city: '', country: 'India' });
  const [buyerAgreed, setBuyerAgreed] = useState(false);

  // Supplier register state
  const [supplierData, setSupplierData] = useState({ fullName: '', email: '', phone: '', password: '', companyName: '', gst: '', iec: '', businessType: '', city: '', state: '', country: 'India' });
  const [supplierAgreed, setSupplierAgreed] = useState(false);
  const [gstDoc, setGstDoc] = useState<File | null>(null);
  const [iecDoc, setIecDoc] = useState<File | null>(null);
  const [regDoc, setRegDoc] = useState<File | null>(null);

  // Policy & Terms dialog state
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyTab, setPolicyTab] = useState<'terms' | 'privacy'>('terms');

  const getTargetRedirect = (role?: string | null) => {
    const customRedirect = searchParams.get('redirect') || searchParams.get('returnUrl');
    if (customRedirect && customRedirect.startsWith('/') && !customRedirect.startsWith('//')) {
      return customRedirect;
    }
    if (role === 'admin') return '/dashboard/admin';
    if (role === 'supplier') return '/dashboard/supplier';
    if (role === 'buyer') return '/dashboard/buyer';
    return dashboardPath !== '/auth' ? dashboardPath : '/dashboard/buyer';
  };

  const doLogin = async (email: string, pw: string) => {
    setError('');
    setLoading(true);
    try {
      const { error: err } = await signIn(email.trim().toLowerCase(), pw);
      if (err) {
        setError(err);
        toast.error(err);
        return;
      }

      toast.success('Signed in successfully!');
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        navigate('/');
        return;
      }
      await refreshProfile(currentUser.id);
      const { data: roleRow } = await supabase.from('profiles').select('role').eq('id', currentUser.id).maybeSingle();
      const metaRole = (currentUser.user_metadata?.role as string | undefined) || null;
      navigate(getTargetRedirect(roleRow?.role || metaRole));
    } catch (err: any) {
      const msg = err?.message || 'Login failed. Please check your credentials and try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = loginEmail.trim().toLowerCase();
    if (!cleanEmail) {
      const msg = 'Please enter your email address.';
      setError(msg);
      toast.error(msg);
      return;
    }
    if (!loginPw) {
      const msg = 'Please enter your password.';
      setError(msg);
      toast.error(msg);
      return;
    }

    await doLogin(cleanEmail, loginPw);
  };

  const handleBuyerRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = buyerData.fullName.trim();
    if (!cleanName) {
      const msg = 'Please enter your full name.';
      setError(msg);
      toast.error(msg);
      return;
    }

    const cleanEmail = buyerData.email.trim().toLowerCase();
    if (!cleanEmail) {
      const msg = 'Please enter your email address.';
      setError(msg);
      toast.error(msg);
      return;
    }

    if (buyerData.password.length < 8) {
      const msg = 'Password must be at least 8 characters long.';
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!buyerAgreed) {
      const msg = 'Please accept the User Agreement and Privacy Policy to create an account.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      const { error: err, user: registeredUser } = await signUp(cleanEmail, buyerData.password, cleanName, 'buyer');

      if (err) {
        if (err.toLowerCase().includes('already exists') || err.toLowerCase().includes('already registered')) {
          setLoginEmail(cleanEmail);
          setActiveTab('login');
          setError('An account with this email already exists. Please enter your password to sign in.');
          toast.info('Account already exists! Switched to Login tab.');
          return;
        }
        setError(err);
        toast.error(err);
        return;
      }

      const activeUser = registeredUser || (await supabase.auth.getUser()).data.user;
      if (activeUser) {
        try {
          await supabase.from('buyer_profiles').upsert({
            user_id: activeUser.id,
            company_name: buyerData.companyName?.trim() || cleanName || 'Buyer',
            city: buyerData.city?.trim() || null,
            country: buyerData.country,
          });
        } catch {
          // silent
        }
        await refreshProfile(activeUser.id);
      }

      toast.success('Buyer account created! Welcome to BulkSkart.');
      trackSignUp('buyer');
      navigate(getTargetRedirect('buyer'));
    } catch (err: any) {
      const msg = err?.message || 'Failed to create buyer account. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const uploadDoc = async (file: File, userId: string, label: string): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop();
      const path = `${userId}/${label}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage.from('business-docs').upload(path, file);
      if (error) return null;
      const { data: urlData } = supabase.storage.from('business-docs').getPublicUrl(data.path);
      return urlData.publicUrl;
    } catch {
      return null;
    }
  };

  const handleSupplierRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = supplierData.fullName.trim();
    if (!cleanName) {
      const msg = 'Please enter your full name.';
      setError(msg);
      toast.error(msg);
      return;
    }

    const cleanEmail = supplierData.email.trim().toLowerCase();
    if (!cleanEmail) {
      const msg = 'Please enter your business email address.';
      setError(msg);
      toast.error(msg);
      return;
    }

    if (supplierData.password.length < 8) {
      const msg = 'Password must be at least 8 characters long.';
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!supplierData.companyName.trim()) {
      const msg = 'Please enter your company or factory name.';
      setError(msg);
      toast.error(msg);
      return;
    }

    if (!supplierAgreed) {
      const msg = 'Please accept the User Agreement and Privacy Policy to register as a supplier.';
      setError(msg);
      toast.error(msg);
      return;
    }

    setLoading(true);
    try {
      const { error: err, user: registeredUser } = await signUp(cleanEmail, supplierData.password, cleanName, 'supplier');

      if (err) {
        if (err.toLowerCase().includes('already exists') || err.toLowerCase().includes('already registered')) {
          setLoginEmail(cleanEmail);
          setActiveTab('login');
          setError('An account with this email already exists. Please enter your password to sign in.');
          toast.info('Account already exists! Switched to Login tab.');
          return;
        }
        setError(err);
        toast.error(err);
        return;
      }

      // Get newly authenticated user
      const activeUser = registeredUser || (await supabase.auth.getUser()).data.user;
      if (activeUser) {
        let gstUrl: string | null = null, iecUrl: string | null = null, regUrl: string | null = null;
        if (gstDoc) gstUrl = await uploadDoc(gstDoc, activeUser.id, 'gst');
        if (iecDoc) iecUrl = await uploadDoc(iecDoc, activeUser.id, 'iec');
        if (regDoc) regUrl = await uploadDoc(regDoc, activeUser.id, 'reg');

        const newCompanyPayload = {
          owner_id: activeUser.id,
          company_name: supplierData.companyName.trim(),
          slug: generateSlug(supplierData.companyName),
          gst_number: supplierData.gst?.trim() || null,
          iec_number: supplierData.iec?.trim() || null,
          business_type: supplierData.businessType || null,
          city: supplierData.city?.trim() || null,
          state: supplierData.state?.trim() || null,
          country: supplierData.country,
          verification_status: (gstDoc || iecDoc || regDoc) ? 'pending' : 'unverified',
          gst_doc_url: gstUrl,
          iec_doc_url: iecUrl,
          reg_doc_url: regUrl,
        };

        try {
          const { data: newCo } = await supabase
            .from('companies')
            .insert(newCompanyPayload)
            .select('id')
            .maybeSingle();

          if (newCo?.id) {
            import('@/lib/api').then(({ triggerMatchNewManufacturer }) =>
              triggerMatchNewManufacturer(newCo.id)
            );
          }
        } catch (compErr) {
          console.warn('Company insert notice:', compErr);
        }

        await refreshProfile(activeUser.id);
      }

      toast.success('Supplier account created! Please complete your business profile.');
      trackSignUp('supplier');
      navigate('/business-setup');
    } catch (err: any) {
      const msg = err?.message || 'Failed to complete supplier registration. Please try again.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // on its way to the signup assistant: no flash of the long form
  if (!user && activeTab === 'supplier' && searchParams.get('form') !== 'full') {
    return (
      <div role="status" aria-label="Loading" className="grid min-h-screen place-items-center bg-background">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <PageMeta
        title="Login or Register — BulkSkart B2B Marketplace"
        description="Sign in to BulkSkart to source bulk products, post RFQs, or register as a verified supplier and connect with thousands of global buyers."
        keywords="B2B login, supplier registration, buyer signup, BulkSkart account"
        canonical="/auth"
        robots="noindex, nofollow"
      />
      <AuthLeftPanel tab={activeTab} />

      {/* Right — auth forms */}
      <div className="flex-1 min-w-0 h-screen overflow-y-auto flex items-start sm:items-center justify-center p-4 sm:p-6 md:p-8 bg-background">
        <div className="w-full max-w-md py-6 my-auto">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center mb-6 justify-center">
            <BrandLogo size="md" variant="auto" linkTo="/" />
          </div>

          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'login' | 'buyer' | 'supplier')}>
            <TabsList className="w-full bg-muted border border-border mb-6 grid grid-cols-3">
              <TabsTrigger value="login" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Login</TabsTrigger>
              <TabsTrigger value="buyer" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Buyer</TabsTrigger>
              <TabsTrigger value="supplier" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Supplier</TabsTrigger>
            </TabsList>

            {/* ===== LOGIN ===== */}
            <TabsContent value="login">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
                <p className="text-sm text-muted-foreground">Sign in to your BulkSkart account</p>
              </div>
              <form onSubmit={handleLogin} className="fk-form fk-stack">
                {error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3" role="alert">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="flex-1">
                      <p>{error}</p>
                      {error.includes('already exists') && (
                        <p className="mt-1 text-muted-foreground">
                          Enter your account password below or reset it via "Forgot password?".
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <div className="fk-field">
                  <label htmlFor="login-email" className={fk.label}>
                    Email Address
                  </label>
                  <IconBox icon={Mail}>
                    <TextInput id="login-email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} type="email" required autoComplete="email" inputMode="email" placeholder="you@company.com" iconPadding />
                  </IconBox>
                </div>
                <div className="fk-field">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="login-password" className={fk.label}>
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForgotEmail(loginEmail.trim());
                        setForgotSent(false);
                        setForgotError('');
                        setForgotOpen(true);
                      }}
                      className="text-sm font-semibold text-[#FF5A00] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <IconBox icon={Lock}>
                    <TextInput id="login-password" value={loginPw} onChange={e => setLoginPw(e.target.value)} type={showPw ? 'text' : 'password'} required autoComplete="current-password" placeholder="••••••••" iconPadding className="pr-12" />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      aria-pressed={showPw}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {showPw ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                    </button>
                  </IconBox>
                </div>

                <button type="submit" disabled={loading} className="fk-btn is-primary w-full">
                  {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>

                <p className="text-sm text-center text-muted-foreground">
                  Don't have an account?{' '}
                  <button type="button" onClick={() => setActiveTab('buyer')} className="text-primary font-semibold hover:underline">
                    Register free as Buyer
                  </button>
                  {' · '}
                  <button type="button" onClick={() => setActiveTab('supplier')} className="text-primary font-semibold hover:underline">
                    Supplier
                  </button>
                </p>
              </form>
            </TabsContent>

            {/* ===== BUYER REGISTER ===== */}
            <TabsContent value="buyer">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Register as Buyer</h1>
                <p className="text-sm text-muted-foreground">Free registration — Post requirements &amp; get quotes</p>
              </div>
              <form onSubmit={handleBuyerRegister} className="fk-form fk-stack">
                {error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3" role="alert">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="fk-grid">
                  <div className="fk-field">
                  <label htmlFor="buyer-name" className={fk.label}>
                    Full Name<span className="fk-req" aria-hidden="true">*</span>
                  </label>
                  <IconBox icon={User}>
                    <TextInput id="buyer-name" value={buyerData.fullName} onChange={e => setBuyerData(p => ({ ...p, fullName: e.target.value }))} required autoComplete="name" placeholder="John Doe" iconPadding />
                  </IconBox>
                </div>
                  <div className="fk-field">
                  <label htmlFor="buyer-phone" className={fk.label}>
                    Phone
                  </label>
                  <IconBox icon={Phone}>
                    <TextInput id="buyer-phone" value={buyerData.phone} onChange={e => setBuyerData(p => ({ ...p, phone: e.target.value }))} type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765…" iconPadding />
                  </IconBox>
                </div>
                  <div className="fk-field is-wide">
                  <label htmlFor="buyer-company" className={fk.label}>
                    Company / Organisation
                  </label>
                  <IconBox icon={Building2}>
                    <TextInput id="buyer-company" value={buyerData.companyName} onChange={e => setBuyerData(p => ({ ...p, companyName: e.target.value }))} autoComplete="organization" placeholder="Acme Corp Ltd (optional)" iconPadding />
                  </IconBox>
                </div>
                  <div className="fk-field">
                  <label htmlFor="buyer-city" className={fk.label}>
                    City
                  </label>
                  <IconBox icon={MapPin}>
                    <TextInput id="buyer-city" value={buyerData.city} onChange={e => setBuyerData(p => ({ ...p, city: e.target.value }))} list="auth-city-list" autoComplete="address-level2" placeholder="Mumbai" iconPadding />
                  </IconBox>
                </div>
                  <div className="fk-field">
                  <label htmlFor="buyer-country" className={fk.label}>
                    Country
                  </label>
                  <IconBox icon={Globe}>
                    <TextInput id="buyer-country" value={buyerData.country} onChange={e => setBuyerData(p => ({ ...p, country: e.target.value }))} autoComplete="country-name" placeholder="India" iconPadding />
                  </IconBox>
                </div>
                </div>
                <div className="fk-field">
                  <label htmlFor="buyer-email" className={fk.label}>
                    Email<span className="fk-req" aria-hidden="true">*</span>
                  </label>
                  <IconBox icon={Mail}>
                    <TextInput id="buyer-email" value={buyerData.email} onChange={e => setBuyerData(p => ({ ...p, email: e.target.value }))} type="email" required autoComplete="email" inputMode="email" placeholder="you@company.com" iconPadding />
                  </IconBox>
                </div>
                <div className="fk-field">
                  <label htmlFor="buyer-password" className={fk.label}>
                    Password<span className="fk-req" aria-hidden="true">*</span>
                  </label>
                  <IconBox icon={Lock}>
                    <TextInput id="buyer-password" value={buyerData.password} onChange={e => setBuyerData(p => ({ ...p, password: e.target.value }))} type={showPw ? 'text' : 'password'} required autoComplete="new-password" placeholder="••••••••" iconPadding className="pr-12" />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      aria-pressed={showPw}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {showPw ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                    </button>
                  </IconBox>
                  <p className={fk.hint}>At least 8 characters.</p>
                </div>

                {/* User Agreement & Privacy Policy Checkbox */}
                <div className="flex items-start gap-2.5 pt-1.5">
                  <Checkbox
                    id="buyer-terms"
                    checked={buyerAgreed}
                    onCheckedChange={(checked) => setBuyerAgreed(!!checked)}
                    className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label htmlFor="buyer-terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer select-none">
                    I agree to the BulkSkart{' '}
                    <button
                      type="button"
                      onClick={() => { setPolicyTab('terms'); setPolicyOpen(true); }}
                      className="text-primary underline hover:text-primary/90 font-medium"
                    >
                      User Agreement
                    </button>
                    {' '}and{' '}
                    <button
                      type="button"
                      onClick={() => { setPolicyTab('privacy'); setPolicyOpen(true); }}
                      className="text-primary underline hover:text-primary/90 font-medium"
                    >
                      Privacy Policy
                    </button>
                    .
                  </label>
                </div>

                <button type="submit" disabled={loading} className="fk-btn is-primary w-full">
                  {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  {loading ? 'Creating account…' : 'Create Buyer Account — Free'}
                </button>
                <p className="text-sm text-center text-muted-foreground">
                  Already have an account?{' '}
                  <button type="button" onClick={() => setActiveTab('login')} className="text-primary font-semibold hover:underline">Sign in</button>
                </p>
              </form>
            </TabsContent>

            {/* ===== SUPPLIER REGISTER ===== */}
            <TabsContent value="supplier">
              <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">Register as Supplier</h1>
                <p className="text-sm text-muted-foreground">Get verified & start receiving bulk order enquiries</p>
              </div>
              <form onSubmit={handleSupplierRegister} className="fk-form fk-stack">
                {error && (
                  <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl p-3" role="alert">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="fk-grid">
                  <div className="fk-field">
                  <label htmlFor="supplier-name" className={fk.label}>
                    Full Name<span className="fk-req" aria-hidden="true">*</span>
                  </label>
                  <IconBox icon={User}>
                    <TextInput id="supplier-name" value={supplierData.fullName} onChange={e => setSupplierData(p => ({ ...p, fullName: e.target.value }))} required autoComplete="name" placeholder="John Doe" iconPadding />
                  </IconBox>
                </div>
                  <div className="fk-field">
                  <label htmlFor="supplier-phone" className={fk.label}>
                    Phone
                  </label>
                  <IconBox icon={Phone}>
                    <TextInput id="supplier-phone" value={supplierData.phone} onChange={e => setSupplierData(p => ({ ...p, phone: e.target.value }))} type="tel" autoComplete="tel" inputMode="tel" placeholder="+91 98765…" iconPadding />
                  </IconBox>
                </div>
                  <div className="fk-field is-wide">
                  <label htmlFor="supplier-company" className={fk.label}>
                    Company Name<span className="fk-req" aria-hidden="true">*</span>
                  </label>
                  <IconBox icon={Building2}>
                    <TextInput id="supplier-company" value={supplierData.companyName} onChange={e => setSupplierData(p => ({ ...p, companyName: e.target.value }))} required autoComplete="organization" placeholder="Your Manufacturing Co." iconPadding />
                  </IconBox>
                </div>
                  <div className="fk-field">
                  <label htmlFor="supplier-gst" className={fk.label}>
                    GST Number
                  </label>
                  <IconBox icon={Receipt}>
                    <TextInput id="supplier-gst" value={supplierData.gst} onChange={e => setSupplierData(p => ({ ...p, gst: e.target.value }))} placeholder="22AAAAA…" iconPadding />
                  </IconBox>
                </div>
                  <div className="fk-field">
                  <label htmlFor="supplier-iec" className={fk.label}>
                    IEC Number
                  </label>
                  <IconBox icon={Hash}>
                    <TextInput id="supplier-iec" value={supplierData.iec} onChange={e => setSupplierData(p => ({ ...p, iec: e.target.value }))} placeholder="IEC No." iconPadding />
                  </IconBox>
                </div>
                  <div className="fk-field">
                  <label htmlFor="supplier-city" className={fk.label}>
                    City
                  </label>
                  <IconBox icon={MapPin}>
                    <TextInput id="supplier-city" value={supplierData.city} onChange={e => setSupplierData(p => ({ ...p, city: e.target.value }))} list="auth-city-list" autoComplete="address-level2" placeholder="Mumbai" iconPadding />
                  </IconBox>
                </div>
                  <div className="fk-field">
                  <label htmlFor="supplier-country" className={fk.label}>
                    Country
                  </label>
                  <IconBox icon={Globe}>
                    <TextInput id="supplier-country" value={supplierData.country} onChange={e => setSupplierData(p => ({ ...p, country: e.target.value }))} autoComplete="country-name" placeholder="India" iconPadding />
                  </IconBox>
                </div>
                </div>
                {/* Document uploads */}
                <div className="bg-muted/50 border border-border rounded-xl p-3 space-y-2">
                  <p className="text-sm font-bold text-foreground flex items-center gap-1.5"><Upload className="w-4 h-4" aria-hidden="true" /> Business Documents (for verification)</p>
                  {[
                    { label: 'GST Certificate', key: 'gst', state: gstDoc, setter: setGstDoc },
                    { label: 'IEC Certificate', key: 'iec', state: iecDoc, setter: setIecDoc },
                    { label: 'Company Registration', key: 'reg', state: regDoc, setter: setRegDoc },
                  ].map(({ label, key, state, setter }) => (
                    <div key={key} className="flex items-center gap-2">
                      <label className="flex-1 flex items-center gap-2 cursor-pointer">
                        <div className={`flex-1 border-[1.5px] border-dashed rounded-xl px-3 py-3 text-sm transition-colors ${state ? 'border-primary/40 text-primary bg-primary/5' : 'border-border text-muted-foreground hover:border-primary/30'}`}>
                          {state ? <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3" />{state.name}</span> : `Upload ${label}`}
                        </div>
                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={e => setter(e.target.files?.[0] ?? null)} />
                      </label>
                    </div>
                  ))}
                </div>
                <div className="fk-field">
                  <label htmlFor="supplier-email" className={fk.label}>
                    Business Email<span className="fk-req" aria-hidden="true">*</span>
                  </label>
                  <IconBox icon={Mail}>
                    <TextInput id="supplier-email" value={supplierData.email} onChange={e => setSupplierData(p => ({ ...p, email: e.target.value }))} type="email" required autoComplete="email" inputMode="email" placeholder="you@company.com" iconPadding />
                  </IconBox>
                </div>
                <div className="fk-field">
                  <label htmlFor="supplier-password" className={fk.label}>
                    Password<span className="fk-req" aria-hidden="true">*</span>
                  </label>
                  <IconBox icon={Lock}>
                    <TextInput id="supplier-password" value={supplierData.password} onChange={e => setSupplierData(p => ({ ...p, password: e.target.value }))} type={showPw ? 'text' : 'password'} required autoComplete="new-password" placeholder="••••••••" iconPadding className="pr-12" />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      aria-pressed={showPw}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {showPw ? <EyeOff className="w-5 h-5" aria-hidden="true" /> : <Eye className="w-5 h-5" aria-hidden="true" />}
                    </button>
                  </IconBox>
                  <p className={fk.hint}>At least 8 characters.</p>
                </div>

                {/* User Agreement & Privacy Policy Checkbox */}
                <div className="flex items-start gap-2.5 pt-1.5">
                  <Checkbox
                    id="supplier-terms"
                    checked={supplierAgreed}
                    onCheckedChange={(checked) => setSupplierAgreed(!!checked)}
                    className="mt-0.5 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                  <label htmlFor="supplier-terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer select-none">
                    I agree to the BulkSkart{' '}
                    <button
                      type="button"
                      onClick={() => { setPolicyTab('terms'); setPolicyOpen(true); }}
                      className="text-primary underline hover:text-primary/90 font-medium"
                    >
                      User Agreement
                    </button>
                    {' '}and{' '}
                    <button
                      type="button"
                      onClick={() => { setPolicyTab('privacy'); setPolicyOpen(true); }}
                      className="text-primary underline hover:text-primary/90 font-medium"
                    >
                      Privacy Policy
                    </button>
                    .
                  </label>
                </div>

                <button type="submit" disabled={loading} className="fk-btn is-primary w-full">
                  {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
                  {loading ? 'Creating account…' : 'Register as Supplier'}
                </button>
                <p className="text-sm text-center text-muted-foreground">
                  Already have an account?{' '}
                  <button type="button" onClick={() => setActiveTab('login')} className="text-primary font-semibold hover:underline">Sign in</button>
                </p>
              </form>
            </TabsContent>
          </Tabs>
          <datalist id="auth-city-list">
            {CITY_NAMES.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </div>
      </div>

      {/* User Agreement & Privacy Policy Modal */}
      <Dialog open={policyOpen} onOpenChange={setPolicyOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border text-foreground max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {policyTab === 'terms' ? 'BulkSkart User Agreement' : 'BulkSkart Privacy Policy'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 border-b border-border pb-2">
            <button
              type="button"
              onClick={() => setPolicyTab('terms')}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors ${
                policyTab === 'terms' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              User Agreement
            </button>
            <button
              type="button"
              onClick={() => setPolicyTab('privacy')}
              className={`text-xs px-3 py-1.5 rounded-md font-semibold transition-colors ${
                policyTab === 'privacy' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Privacy Policy
            </button>
          </div>
          <div className="text-xs text-muted-foreground space-y-3 py-2 leading-relaxed">
            {policyTab === 'terms' ? (
              <>
                <p className="font-semibold text-foreground">1. Acceptance of Terms</p>
                <p>
                  By accessing or registering with BulkSkart ("the Platform"), you agree to abide by all platform rules,
                  commercial dispute guidelines, and legitimate trade laws governing bulk transactions.
                </p>
                <p className="font-semibold text-foreground">2. Business Verification & Conduct</p>
                <p>
                  Suppliers and buyers represent that all provided GST, IEC, trade certificates, and product specifications
                  are truthful, accurate, and lawfully represented.
                </p>
                <p className="font-semibold text-foreground">3. RFQs and Quotations</p>
                <p>
                  All quotation submissions and procurement inquiries sent through BulkSkart constitute bona fide commercial communications.
                </p>
              </>
            ) : (
              <>
                <p className="font-semibold text-foreground">1. Data Collection & Usage</p>
                <p>
                  BulkSkart collects business contact details, company credentials, and trade communications exclusively to facilitate
                  trusted B2B matching and secure enterprise RFQ fulfillment.
                </p>
                <p className="font-semibold text-foreground">2. Confidentiality & Security</p>
                <p>
                  Your business documents, quotations, and financial transaction logs are encrypted and safeguarded with enterprise-grade access controls.
                </p>
                <p className="font-semibold text-foreground">3. Data Sharing</p>
                <p>
                  We never sell your contact information to third-party marketers. Data is only shared with verified transaction parties as authorized by you.
                </p>
              </>
            )}
          </div>
          <div className="pt-2 border-t border-border flex justify-end">
            <Button
              type="button"
              onClick={() => {
                if (activeTab === 'buyer') setBuyerAgreed(true);
                if (activeTab === 'supplier') setSupplierAgreed(true);
                setPolicyOpen(false);
              }}
              className="bg-primary text-primary-foreground font-semibold text-xs h-9 px-4"
            >
              Accept &amp; Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Forgot Password Dialog */}
      <FormDialog
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        busy={forgotLoading}
        title={
          <>
            Reset <em>Password</em>
          </>
        }
        description="Enter the e-mail you use for BulkSkart and we will send you a link to choose a new password."
        width={560}
      >
        {forgotSent ? (
          <Done
            title="Check your inbox"
            actions={
              <Actions single>
                <KitButton onClick={() => setForgotOpen(false)}>Back to Log In</KitButton>
              </Actions>
            }
          >
            <p>
              If an account uses <b>{forgotEmail.trim()}</b>, a reset link is on its way. Open it on this device to set a new password.
            </p>
          </Done>
        ) : (
          <form onSubmit={handleForgotPassword} noValidate className="fk-form fk-stack">
            <Field htmlFor="forgot-email" label="E-mail address" required error={forgotError}>
              <IconBox icon={Mail}>
                <TextInput
                  id="forgot-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={forgotEmail}
                  onChange={(e) => {
                    setForgotEmail(e.target.value);
                    if (forgotError) setForgotError('');
                  }}
                  placeholder="you@company.com"
                  invalid={Boolean(forgotError)}
                  aria-describedby={forgotError ? 'forgot-email-error' : undefined}
                  iconPadding
                />
              </IconBox>
            </Field>
            <Actions>
              <KitButton type="submit" disabled={forgotLoading}>
                {forgotLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                {forgotLoading ? 'Sending…' : 'Send Reset Link'}
              </KitButton>
              <KitButton variant="ghost" onClick={() => setForgotOpen(false)} disabled={forgotLoading}>
                Cancel
              </KitButton>
            </Actions>
          </form>
        )}
      </FormDialog>
    </div>
  );
}
