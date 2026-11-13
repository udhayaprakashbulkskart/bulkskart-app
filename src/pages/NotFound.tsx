import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import PageMeta from '@/components/common/PageMeta';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Home, Building2, Package, FileText, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';

export default function NotFound() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/products?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <MainLayout>
      <PageMeta
        title="404 — Page Not Found | Bulkskart"
        description="The page you requested could not be found. Explore verified manufacturers, wholesale suppliers, bulk products, and active RFQs on Bulkskart."
        canonical="https://www.bulkskart.com/404"
        robots="noindex, follow"
      />

      <div className="min-h-[65vh] flex items-center justify-center py-12 px-4 sm:px-6">
        <div className="bs-glass max-w-xl w-full rounded-3xl p-8 text-center">
          {/* Status Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 text-destructive border border-destructive/20 text-xs font-bold mb-4">
            <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            HTTP 404 — Page Not Found
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-foreground tracking-tight mb-3">
            Looking for Bulk Products or Suppliers?
          </h1>

          <p className="text-sm md:text-base text-muted-foreground leading-relaxed mb-6">
            The link you followed may be outdated, moved, or misspelled. Use the search bar below or explore our verified B2B marketplace hubs.
          </p>

          {/* Quick Search */}
          <form onSubmit={handleSearch} className="flex gap-2 max-w-md mx-auto mb-8">
            <Input
              type="text"
              placeholder="Search products, suppliers, categories…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 bg-card border-border text-foreground"
            />
            <Button type="submit" className="bg-[#FF5A00] hover:bg-[#e04e00] text-white font-bold h-11 px-5 rounded-xl shrink-0">
              <Search className="w-4 h-4 mr-1.5" /> Search
            </Button>
          </form>

          {/* Helpful Navigation Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left mb-8">
            <Link
              to="/b2b-marketplace"
              className="p-3.5 rounded-xl border border-border bg-card/60 hover:border-[#FF5A00] transition-colors group flex flex-col justify-between"
            >
              <div>
                <Building2 className="w-5 h-5 text-[#FF5A00] mb-2" />
                <p className="text-xs font-bold text-foreground group-hover:text-[#FF5A00]">Marketplace</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Explore 30+ sectors</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[#FF5A00] mt-3" />
            </Link>

            <Link
              to="/manufacturers"
              className="p-3.5 rounded-xl border border-border bg-card/60 hover:border-[#FF5A00] transition-colors group flex flex-col justify-between"
            >
              <div>
                <ShieldCheck className="w-5 h-5 text-[#FF5A00] mb-2" />
                <p className="text-xs font-bold text-foreground group-hover:text-[#FF5A00]">Manufacturers</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">5,000+ verified plants</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[#FF5A00] mt-3" />
            </Link>

            <Link
              to="/bulk-products"
              className="p-3.5 rounded-xl border border-border bg-card/60 hover:border-[#FF5A00] transition-colors group flex flex-col justify-between"
            >
              <div>
                <Package className="w-5 h-5 text-[#FF5A00] mb-2" />
                <p className="text-xs font-bold text-foreground group-hover:text-[#FF5A00]">Bulk Products</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Direct wholesale prices</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[#FF5A00] mt-3" />
            </Link>

            <Link
              to="/post-requirement"
              className="p-3.5 rounded-xl border border-border bg-card/60 hover:border-[#FF5A00] transition-colors group flex flex-col justify-between"
            >
              <div>
                <FileText className="w-5 h-5 text-[#FF5A00] mb-2" />
                <p className="text-xs font-bold text-foreground group-hover:text-[#FF5A00]">Post RFQ</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Get 10+ factory quotes</p>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-[#FF5A00] mt-3" />
            </Link>
          </div>

          <Link to="/">
            <Button variant="ghost" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
              <Home className="w-3.5 h-3.5" /> Return to Homepage
            </Button>
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
