import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Package, Send, Sparkles, ShieldCheck, Clock, CheckCircle2,
  Globe2, ArrowRight, Building2, HelpCircle
} from 'lucide-react';
import { toast } from 'sonner';
import SectionHeader from '@/components/home/SectionHeader';
import '@/components/formkit/formkit.css';

const POPULAR_CATEGORIES = [
  'Machinery & Equipment',
  'Industrial Fasteners & Hardware',
  'Textiles & Apparel Fabrics',
  'Polymers, Resins & Chemicals',
  'Packaging & Corrugated Boxes',
  'Semiconductors & Electronics',
  'Steel, Aluminum & Metals',
  'Agricultural Commodities',
];

export default function PostRequirementsHomeSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Industrial Fasteners & Hardware');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('Pieces');
  const [destination, setDestination] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter the product or material you need');
      return;
    }

    // Redirect to post-requirement page with prefilled query state
    const params = new URLSearchParams();
    params.set('title', title.trim());
    params.set('category', category);
    if (quantity) params.set('quantity', quantity);
    if (unit) params.set('unit', unit);
    if (destination) params.set('destination', destination);
    if (notes) params.set('notes', notes);

    // Enforce buyer authentication
    if (!user) {
      toast.info('Please sign in to post your buying requirements', {
        description: 'Only verified logged-in buyers can submit requirements and receive manufacturer quotes.'
      });
      navigate(`/auth?redirect=${encodeURIComponent(`/post-requirement?${params.toString()}`)}&mode=buyer`);
      return;
    }

    toast.success('Requirement drafted! Review and confirm your post.');
    navigate(`/post-requirement?${params.toString()}`);
  };

  return (
    <section className="relative z-20 pt-10 pb-4 md:pt-14 md:pb-6 bg-[#0B0F19] border-t border-border/80">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-5 md:px-6">
        
        {/* Section Header */}
        <div className="mb-8">
          <SectionHeader
            eyebrow="Direct Factory Sourcing"
            icon={<Sparkles className="h-3.5 w-3.5" />}
            title="Post Buying Requirement"
            subtitle="Tell verified global manufacturers what you need. Receive genuine wholesale quotations with CIF/FOB pricing within hours."
            action={
              /* Sourcing guarantee badges */
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                  <span>Zero Buyer Commission</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4 shrink-0 text-primary" />
                  <span>Quotes in ~4 Hours</span>
                </div>
              </div>
            }
          />
        </div>

        {/* Interactive Post Requirement Card */}
        <div className="bg-card border border-border rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

          <form onSubmit={handleSubmit} className="fk-skin space-y-5 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              {/* Product / Requirement Title */}
              <div className="md:col-span-5 space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-primary" /> Product / Item Required <span className="text-destructive">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Stainless Steel Hex Bolts DIN 933 M12"
                  required
                  className="bg-background border-border text-foreground text-sm h-11"
                />
              </div>

              {/* Category Dropdown */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-primary" /> Industry Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-background border border-border rounded-md px-3 text-sm h-11 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {POPULAR_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity & Unit */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Target Quantity & Unit
                </label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 5000"
                    className="bg-background border-border text-foreground text-sm h-11 flex-1"
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="bg-background border border-border rounded-md px-2.5 text-xs text-foreground h-11 focus:outline-none"
                  >
                    <option value="Pieces">Pcs</option>
                    <option value="Metric Tons">MT</option>
                    <option value="Kilograms">Kg</option>
                    <option value="Meters">Mtr</option>
                    <option value="Sets">Sets</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Row 2: Destination Port & Specifications */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Globe2 className="w-3.5 h-3.5 text-primary" /> Destination Country / Port
                </label>
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Nhava Sheva (India), Rotterdam (EU), Houston (US)"
                  className="bg-background border-border text-foreground text-sm h-11"
                />
              </div>

              <div className="md:col-span-8 space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Specifications & Trade Terms (Optional)
                </label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Include material grades, custom OEM branding, target unit rate, or packing instructions..."
                  className="bg-background border-border text-foreground text-sm h-11"
                />
              </div>
            </div>

            {/* Row 3: Submit Action & Quick Pre-fills */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-border/60">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Popular RFQs:</span>
                <button
                  type="button"
                  onClick={() => {
                    setTitle('Corrugated 5-Ply Shipping Boxes 40x30x30 cm');
                    setCategory('Packaging & Corrugated Boxes');
                    setQuantity('10000');
                    setUnit('Pieces');
                  }}
                  className="px-2.5 py-1 rounded-md bg-muted/70 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
                >
                  5-Ply Shipping Boxes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle('Grade 304 Stainless Steel Flanges ANSI B16.5');
                    setCategory('Steel, Aluminum & Metals');
                    setQuantity('500');
                    setUnit('Pieces');
                  }}
                  className="px-2.5 py-1 rounded-md bg-muted/70 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
                >
                  SS 304 Flanges
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTitle('100% Combed Cotton Ring-Spun Yarn 30s');
                    setCategory('Textiles & Apparel Fabrics');
                    setQuantity('20');
                    setUnit('Metric Tons');
                  }}
                  className="px-2.5 py-1 rounded-md bg-muted/70 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
                >
                  Cotton Yarn 30s
                </button>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full sm:w-auto h-11 px-8 bg-primary text-primary-foreground font-bold hover:bg-primary/90 gap-2 shadow-lg"
              >
                <span>Post Requirement Now</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </div>

      </div>
    </section>
  );
}
