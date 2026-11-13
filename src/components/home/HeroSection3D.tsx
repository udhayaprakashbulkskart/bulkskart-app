import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Search, ArrowRight, Package, Users, Globe, Flame, Factory, Sparkles, Truck, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeroSection3DProps {
  onSearch?: (query: string, category: string) => void;
}

const POPULAR_CATEGORIES = [
  { name: 'Textile', query: 'cotton fabric yarn' },
  { name: 'Steel', query: 'steel pipe rebar sheet' },
  { name: 'Chemical', query: 'polymers dyes industrial' },
  { name: 'Plastic', query: 'granules polymer hdpe' },
  { name: 'Machinery', query: 'generator motor equipment' },
  { name: 'Agriculture', query: 'spices grains coffee' },
  { name: 'Packaging', query: 'corrugated boxes cartons' },
  { name: 'Electrical', query: 'cables transformers switchgear' },
];

const METRICS = [
  { icon: Users, value: '50,000+', label: 'Verified manufacturers' },
  { icon: Package, value: '1M+', label: 'Bulk products' },
  { icon: Globe, value: '120+', label: 'Trade countries' },
  { icon: Flame, value: '10,000+', label: 'Live RFQs & auctions' },
];

const LANES = [
  { title: 'Machinery', detail: 'Factory direct', className: 'left-[6%] top-[12%] bs-float' },
  { title: 'Textiles', detail: 'MOQ ready', className: 'right-[4%] top-[18%] bs-float bs-float-delay' },
  { title: 'Agri bulk', detail: 'Export lane', className: 'left-[14%] bottom-[22%] bs-float bs-float-delay-2' },
  { title: 'Electronics', detail: 'Verified', className: 'right-[12%] bottom-[18%] bs-float' },
];

function TradeEcosystem() {
  return (
    <div className="relative h-[260px] sm:h-[320px] lg:h-[380px]" aria-hidden="true">
      <div className="bs-hero-grid absolute inset-0 opacity-80" />
      <div className="bs-orbit absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30 sm:h-72 sm:w-72" />
      <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-primary/40" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 480 380" fill="none">
        <path className="bs-dashline" d="M70 80 C 160 40, 240 160, 240 190" stroke="#FF5A00" strokeWidth="1.4" />
        <path className="bs-dashline" d="M410 90 C 320 50, 270 150, 240 190" stroke="#FF5A00" strokeWidth="1.4" />
        <path className="bs-dashline" d="M90 290 C 150 250, 190 230, 240 190" stroke="#FF5A00" strokeWidth="1.4" />
        <path className="bs-dashline" d="M390 280 C 330 250, 290 230, 240 190" stroke="#FF5A00" strokeWidth="1.4" />
        <circle cx="240" cy="190" r="5" fill="#FF5A00" />
        <circle cx="70" cy="80" r="3.5" fill="#FF5A00" opacity="0.8" />
        <circle cx="410" cy="90" r="3.5" fill="#FF5A00" opacity="0.8" />
        <circle cx="90" cy="290" r="3.5" fill="#FF5A00" opacity="0.8" />
        <circle cx="390" cy="280" r="3.5" fill="#FF5A00" opacity="0.8" />
      </svg>
      <div className="bs-scan pointer-events-none absolute inset-x-[18%] top-0 h-16 bg-gradient-to-b from-transparent via-primary/25 to-transparent" />
      <div className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-primary/40 bg-primary text-white shadow-[0_12px_40px_-12px_hsl(21_100%_50%/0.8)]">
        <Sparkles className="h-6 w-6" />
      </div>
      {LANES.map((lane) => (
        <div
          key={lane.title}
          className={`bs-glass absolute z-10 hidden w-[132px] rounded-2xl px-3 py-2 sm:block ${lane.className}`}
        >
          <p className="text-[11px] font-bold uppercase tracking-wide text-primary">{lane.title}</p>
          <p className="text-xs text-muted-foreground">{lane.detail}</p>
        </div>
      ))}
    </div>
  );
}

export default function HeroSection3D({ onSearch }: HeroSection3DProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'products' | 'manufacturers' | 'rfqs'>('products');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      if (selectedType === 'manufacturers') navigate('/manufacturers');
      else if (selectedType === 'rfqs') navigate('/auctions/reverse');
      else navigate('/products');
      return;
    }

    if (onSearch) {
      onSearch(searchQuery, selectedType);
    }

    if (selectedType === 'manufacturers') {
      navigate(`/manufacturers?q=${encodeURIComponent(searchQuery.trim())}`);
    } else if (selectedType === 'rfqs') {
      navigate(`/auctions/reverse?search=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const handleQuickTagClick = (tagQuery: string) => {
    navigate(`/products?q=${encodeURIComponent(tagQuery)}`);
  };

  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[70%] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      <div className="relative z-10 mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-8 px-4 py-8 sm:px-6 md:py-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-10 lg:py-16">
        <div className="space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Global B2B marketplace
          </span>

          <h1 className="max-w-xl text-[1.85rem] font-black leading-[1.02] tracking-tight text-foreground min-[390px]:text-4xl sm:text-5xl lg:text-[3.35rem]">
            THE FUTURE OF GLOBAL BULK TRADE.
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            One Platform. Millions of Opportunities. Connect directly with manufacturers and source smarter with AI-powered B2B trading.
          </p>

          <div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:flex-wrap">
            <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base font-bold shadow-lg shadow-primary/25">
              <Link to="/products">
                Explore Products
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-xl px-6 text-base font-bold">
              <Link to="/auth?tab=supplier">
                <Factory className="mr-1.5 h-4 w-4" />
                Join as Manufacturer
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href="#order-benefits"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300"
            >
              <Truck className="h-3.5 w-3.5" />
              Free delivery on all orders
            </a>
            <a
              href="#order-benefits"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
            >
              <Calculator className="h-3.5 w-3.5" />
              Order loan calculator
            </a>
          </div>
        </div>

        <div className="relative">
          <TradeEcosystem />
          <div className="bs-glass relative z-20 -mt-6 rounded-3xl p-4 sm:-mt-8 sm:p-6">
            <h2 className="text-base font-bold text-foreground">Find products and suppliers</h2>
            <p className="mt-1 text-sm text-muted-foreground">Search verified catalogues, manufacturers and live RFQs.</p>

            <form
              onSubmit={handleSearchSubmit}
              className="mt-4 flex items-center gap-1 rounded-xl border border-input bg-background p-1 pl-2 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30"
            >
              <label htmlFor="hero-search-type" className="sr-only">Search type</label>
              <select
                id="hero-search-type"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as 'products' | 'manufacturers' | 'rfqs')}
                className="shrink-0 cursor-pointer border-r border-border bg-transparent pr-2 text-sm font-semibold text-foreground outline-none"
              >
                <option value="products">Products</option>
                <option value="manufacturers">Manufacturers</option>
                <option value="rfqs">Live RFQs</option>
              </select>
              <label htmlFor="hero-search" className="sr-only">Search the marketplace</label>
              <input
                id="hero-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, suppliers, categories…"
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <Button type="submit" size="icon" className="h-11 w-11 rounded-lg" aria-label="Submit search">
                <Search className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Popular:</span>
              {POPULAR_CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => handleQuickTagClick(cat.query)}
                  className="min-h-8 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 border-t border-border pt-4 sm:gap-3">
              {METRICS.map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-2.5 rounded-xl border border-border bg-background/80 p-2.5 sm:gap-3 sm:p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black leading-tight text-foreground sm:text-base">{value}</div>
                    <div className="truncate text-[11px] text-muted-foreground sm:text-xs">{label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
