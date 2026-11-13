import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search, ShieldCheck, ArrowRight, Package, Users, Globe, Flame,
  CheckCircle2, Sparkles, Building2, Gavel, FileText, ChevronRight, Truck, Calculator
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import IndustrialPort3D from './IndustrialPort3D';

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
    <section className="relative w-full flex flex-col overflow-hidden bg-[#070B12] text-foreground">
      {/* ── High-Resolution Industrial Port & Twilight Logistics Backdrop ── */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://live.staticflickr.com/4092/5009413427_3d13b6b445_b.jpg"
          alt="BulkSkart Global Shipping & Industrial Port"
          className="w-full h-full object-cover object-center opacity-45 select-none pointer-events-none"
        />
        {/* Dark cinematic gradient overlays to guarantee pristine contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#070B12]/95 via-[#070B12]/85 to-[#070B12]/75" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#070B12]/80 via-transparent to-[#070B12]" />
        {/* WebGL 3D Industrial Port canvas overlay for interactive atmospheric lighting */}
        <div className="absolute inset-0 opacity-40 hidden md:block pointer-events-none">
          <IndustrialPort3D />
        </div>
      </div>

      {/* ── Subtle Ambient Brand Glow ── */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-28 bg-[#FF5A00]/10 blur-[100px] pointer-events-none" />

      {/* ── Hero Main Content Container (Optimized for all PC & Laptop Screens) ── */}
      <div className="relative z-10 max-w-[1400px] mx-auto w-full px-3.5 sm:px-5 md:px-6 pt-3.5 sm:pt-5 pb-2 sm:pb-3 flex flex-col">
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 sm:gap-5 mb-3.5 sm:mb-5">
          
          {/* Left Main Headlines */}
          <div className="max-w-2xl space-y-2 sm:space-y-2.5">
            
            {/* Top Pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0A0A0A]/80 border border-[#2A2A2A]/80 backdrop-blur-md shadow-xs">
              <Globe className="w-3 h-3 text-[#FF5A00]" />
              <span className="text-[9.5px] sm:text-[11px] font-bold tracking-widest text-slate-300 uppercase">
                GLOBAL B2B MARKETPLACE
              </span>
            </div>

            {/* Two-Line Heading: "Buy in Bulk. Grow Bigger." */}
            <h1 className="text-2xl sm:text-4xl lg:text-[44px] xl:text-5xl font-black tracking-tight text-white leading-[1.08]">
              Buy in Bulk.<br />
              <span className="text-[#FF5A00]">
                Grow Bigger.
              </span>
            </h1>

            {/* Concise Subtitle */}
            <p className="text-xs sm:text-sm md:text-base text-slate-300 max-w-xl font-normal leading-relaxed text-pretty">
              Connect with verified manufacturers, suppliers and bulk buyers worldwide. Delivery is free on every order.
            </p>

            <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
              <a
                href="#order-benefits"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#FF5A00]/40 bg-[#FF5A00]/10 px-2.5 py-1 text-[11px] font-bold text-[#FF7A2E] hover:bg-[#B33D00]/20"
              >
                <Truck className="h-3 w-3" />
                Free delivery on all orders
              </a>
              <a
                href="#order-benefits"
                className="inline-flex items-center gap-1.5 rounded-full border border-[#FF5A00]/40 bg-[#FF5A00]/10 px-2.5 py-1 text-[11px] font-bold text-[#FF5A00] hover:bg-[#B33D00]/20"
              >
                <Calculator className="h-3 w-3" />
                Order loan calculator
              </a>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <Button
                asChild
                className="h-9 sm:h-10 px-4 sm:px-5 rounded-xl bg-[#C94400] hover:bg-[#B33D00] text-white font-bold text-xs sm:text-sm shadow-lg shadow-orange-950/40 transition-transform active:scale-95"
              >
                <Link to="/products" className="flex items-center gap-1.5">
                  Explore Marketplace
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>

              <Button
                asChild
                variant="ghost"
                className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-[#0A0A0A]/85 hover:bg-[#0A0A0A] text-white border border-[#2A2A2A]/80 backdrop-blur-md font-bold text-xs sm:text-sm shadow-md transition-transform active:scale-95"
              >
                <Link to="/post-requirement" className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#FF5A00]" />
                  Post Your Requirement
                </Link>
              </Button>

              {/* Explore Catalog Button */}
              <Button
                asChild
                className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-card hover:bg-muted text-foreground border border-border backdrop-blur-md font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Link to="/products">
                  <Package className="w-3.5 h-3.5 text-[#FF5A00]" />
                  <span>Explore Products</span>
                </Link>
              </Button>
            </div>
          </div>

          {/* Right Floating Trust Indicators (Shown on md+ as in Image 1) */}
          <div className="hidden lg:flex flex-col items-end gap-2 pt-1">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0A0A0A]/85 border border-[#2A2A2A]/90 backdrop-blur-md shadow-xs">
              <div className="w-5 h-5 rounded-md bg-[#FF5A00]/20 flex items-center justify-center text-[#FF5A00]">
                <Globe className="w-3 h-3" />
              </div>
              <span className="text-[11px] font-extrabold tracking-wider text-slate-200 uppercase">SOURCING GLOBALLY</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0A0A0A]/85 border border-[#2A2A2A]/90 backdrop-blur-md shadow-xs">
              <div className="w-5 h-5 rounded-md bg-[#FF5A00]/20 flex items-center justify-center text-[#FF5A00]">
                <ShieldCheck className="w-3 h-3" />
              </div>
              <span className="text-[11px] font-extrabold tracking-wider text-slate-200 uppercase">SUPPLY SECURELY</span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0A0A0A]/85 border border-[#2A2A2A]/90 backdrop-blur-md shadow-xs">
              <div className="w-5 h-5 rounded-md bg-[#FF5A00]/20 flex items-center justify-center text-[#FF5A00]">
                <Flame className="w-3 h-3" />
              </div>
              <span className="text-[11px] font-extrabold tracking-wider text-slate-200 uppercase">SCALE FASTER</span>
            </div>
          </div>

        </div>

        {/* ── Search Bar & Category Dropdown ── */}
        <div className="max-w-4xl w-full mb-3 sm:mb-4">
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center p-1 sm:p-1.5 rounded-xl sm:rounded-2xl bg-[#0A0A0A]/95 border border-[#2A2A2A]/90 backdrop-blur-xl shadow-2xl focus-within:border-[#FF5A00] transition-all"
          >
            {/* Category Selector */}
            <div className="relative border-r border-[#2A2A2A]/80 pr-2 pl-2.5 shrink-0 flex items-center">
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as any)}
                className="bg-transparent text-xs sm:text-sm font-semibold text-slate-200 outline-none cursor-pointer py-1 pr-1"
              >
                <option value="products" className="bg-[#0A0A0A] text-white">Products</option>
                <option value="manufacturers" className="bg-[#0A0A0A] text-white">Manufacturers</option>
                <option value="rfqs" className="bg-[#0A0A0A] text-white">Live RFQs</option>
              </select>
            </div>

            {/* Input Field */}
            <div className="flex-1 min-w-0 px-2.5 sm:px-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, suppliers, categories..."
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder-slate-400 outline-none"
              />
            </div>

            {/* Orange Square Search Submit Button */}
            <Button
              type="submit"
              className="h-9 w-9 sm:h-10 sm:w-11 p-0 rounded-lg sm:rounded-xl bg-[#C94400] hover:bg-[#B33D00] text-white shrink-0 shadow-md transition-transform active:scale-95 flex items-center justify-center"
              aria-label="Submit search"
            >
              <Search className="w-4 h-4" />
            </Button>
          </form>

          {/* Popular Tag Pills — Horizontally Scrollable on Mobile to prevent height bloat */}
          <div className="flex items-center gap-1.5 mt-2.5 text-xs overflow-x-auto whitespace-nowrap scrollbar-none py-0.5 px-0.5">
            <span className="text-neutral-400 font-semibold shrink-0 text-[11px]">Popular:</span>
            {POPULAR_CATEGORIES.map((cat) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => handleQuickTagClick(cat.query)}
                className="px-2.5 py-0.5 rounded-md bg-[#0A0A0A]/80 hover:bg-[#B33D00]/20 hover:text-[#FF5A00] text-slate-300 border border-[#2A2A2A] transition-colors text-[11px] font-medium shrink-0"
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Key Marketplace Metrics: 2-Column Grid on Mobile, 4-Column on Desktop ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 max-w-4xl pt-3 border-t border-[#2A2A2A]/80">
          
          <div className="flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl bg-[#0A0A0A]/60 border border-[#2A2A2A]/80 backdrop-blur-xs">
            <div className="w-8 h-8 rounded-lg bg-[#FF5A00]/15 text-[#FF5A00] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-extrabold text-white leading-tight">50,000+</div>
              <div className="text-[10px] sm:text-[11px] text-neutral-400 truncate">Verified Manufacturers</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl bg-[#0A0A0A]/60 border border-[#2A2A2A]/80 backdrop-blur-xs">
            <div className="w-8 h-8 rounded-lg bg-[#FF5A00]/15 text-[#FF5A00] flex items-center justify-center shrink-0">
              <Package className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-extrabold text-white leading-tight">1M+</div>
              <div className="text-[10px] sm:text-[11px] text-neutral-400 truncate">Bulk Products</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl bg-[#0A0A0A]/60 border border-[#2A2A2A]/80 backdrop-blur-xs">
            <div className="w-8 h-8 rounded-lg bg-[#FF5A00]/15 text-[#FF5A00] flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-extrabold text-white leading-tight">120+</div>
              <div className="text-[10px] sm:text-[11px] text-neutral-400 truncate">Trade Countries</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl bg-[#0A0A0A]/60 border border-[#2A2A2A]/80 backdrop-blur-xs">
            <div className="w-8 h-8 rounded-lg bg-[#FF5A00]/15 text-[#FF5A00] flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-extrabold text-white leading-tight">10,000+</div>
              <div className="text-[10px] sm:text-[11px] text-neutral-400 truncate">Live RFQs & Auctions</div>
            </div>
          </div>

        </div>

      </div>

      {/* Bottom Subtle Gradient Fade to Next Section */}
      <div className="relative z-10 w-full h-3 bg-gradient-to-t from-[#0B0F17] to-transparent pointer-events-none" />
    </section>
  );
}
