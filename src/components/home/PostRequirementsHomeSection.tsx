import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import {
  Package, Send, ShieldCheck, Zap, Globe2, Building2, FileText, Factory, Flame, Layers,
  Boxes, Wrench, MapPin, Ship, Handshake, Scale,
} from 'lucide-react';
import { toast } from 'sonner';

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


const FEATURES = [
  { icon: ShieldCheck, label: 'Zero Buyer', sub: 'Commission' },
  { icon: Zap, label: 'Quotes in', sub: '~4 Hours' },
  { icon: Globe2, label: 'Global', sub: 'Suppliers' },
  { icon: Handshake, label: 'Verified', sub: 'Manufacturers' },
];

const inputClass =
  'h-12 w-full rounded-xl border border-white/10 bg-[#0c0c0c] px-4 text-[14px] text-white placeholder:text-neutral-400 transition-colors focus:border-[#FF5A00] focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/25';

export default function PostRequirementsHomeSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduce = useReducedMotion();
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

  const quick = [
    { label: '5-Ply Shipping Boxes', icon: Boxes, values: { t: 'Corrugated 5-Ply Shipping Boxes 40x30x30 cm', c: 'Packaging & Corrugated Boxes', q: '10000', u: 'Pieces' } },
    { label: 'SS 304 Flanges', icon: Wrench, values: { t: 'Grade 304 Stainless Steel Flanges ANSI B16.5', c: 'Steel, Aluminum & Metals', q: '500', u: 'Pieces' } },
    { label: 'Cotton Yarn 30s', icon: Layers, values: { t: '100% Combed Cotton Ring-Spun Yarn 30s', c: 'Textiles & Apparel Fabrics', q: '20', u: 'Metric Tons' } },
  ];

  return (
    <section className="relative isolate overflow-hidden border-t border-white/10 bg-[#070707] py-10 text-white md:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute -top-32 right-10 h-96 w-96 rounded-full bg-[#FF5A00]/10 blur-[120px]" />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-5 md:px-6">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c0c0c]">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0c0c0c] via-[#0c0c0c]/85 to-transparent" />

          <div className="relative p-6 md:p-10">
            <motion.span
              initial={reduce ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-[#FF5A00]/50 bg-[#FF5A00]/10 px-3.5 py-1.5 text-[12px] font-bold text-[#FF7A2E]"
            >
              <Factory className="h-4 w-4" /> Direct Factory Sourcing
            </motion.span>

            <motion.h2
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.6 }}
              className="mt-4 text-[32px] font-black leading-[1.05] tracking-tight sm:text-[42px]"
            >
              Post Buying <span className="text-[#FF5A00]">Requirement</span>
            </motion.h2>
            <motion.p
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="mt-3 max-w-xl text-[14px] leading-relaxed text-slate-300 sm:text-[15px]"
            >
              Tell verified global manufacturers what you need. Receive genuine wholesale quotations with CIF/FOB pricing within hours.
            </motion.p>

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-0 md:divide-x md:divide-white/10">
              {FEATURES.map(({ icon: Icon, label, sub }, i) => (
                <motion.div
                  key={label}
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="flex items-center gap-3 md:px-5"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF5A00]/15 text-[#FF5A00]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[12px] font-semibold leading-tight text-slate-200">{label}<span className="block text-neutral-400">{sub}</span></span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Form card */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 overflow-hidden rounded-3xl border border-[#FF5A00]/35 bg-gradient-to-b from-[#141414] to-[#0a0a0a] shadow-[0_20px_60px_-24px_rgba(255,90,0,0.5)]"
        >
          <div className="flex items-center">
            <span className="flex items-center gap-2.5 rounded-br-2xl bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] px-5 py-3.5 text-[14px] font-bold text-white">
              <FileText className="h-5 w-5" /> Create a RFQ (Request for Quotation)
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5 p-5 md:p-7">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-2 text-[13px] font-bold text-white">
                  <Package className="h-4 w-4 text-[#FF5A00]" /> Product / Item Required <span className="text-[#FF5A00]">*</span>
                </label>
                <div className="relative">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Stainless Steel Hex Bolts DIN 933 M12"
                    required
                    className={`${inputClass} pr-11`}
                  />
                  <Flame className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#FF5A00]" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[13px] font-bold text-white">
                  <Layers className="h-4 w-4 text-[#FF5A00]" /> Industry Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`${inputClass} appearance-none`}
                >
                  {POPULAR_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} className="bg-[#0c0c0c]">{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[13px] font-bold text-white">
                  <Boxes className="h-4 w-4 text-[#FF5A00]" /> Target Quantity & Unit
                </label>
                <div className="flex gap-2.5">
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="e.g. 5,000"
                    className={`${inputClass} flex-1`}
                  />
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="h-12 w-28 rounded-xl border border-white/10 bg-[#0c0c0c] px-3 text-[14px] text-white focus:border-[#FF5A00] focus:outline-none"
                  >
                    <option value="Pieces" className="bg-[#0c0c0c]">Pcs</option>
                    <option value="Metric Tons" className="bg-[#0c0c0c]">MT</option>
                    <option value="Kilograms" className="bg-[#0c0c0c]">Kg</option>
                    <option value="Meters" className="bg-[#0c0c0c]">Mtr</option>
                    <option value="Sets" className="bg-[#0c0c0c]">Sets</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-2 text-[13px] font-bold text-white">
                  <Ship className="h-4 w-4 text-[#FF5A00]" /> Destination Country / Port
                </label>
                <div className="relative">
                  <input
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. Nhava Sheva (India), Rotterdam (EU), Houston (US)"
                    className={`${inputClass} pr-11`}
                  />
                  <MapPin className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#FF5A00]" />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="flex items-center gap-2 text-[13px] font-bold text-white">
                  <FileText className="h-4 w-4 text-[#FF5A00]" /> Specifications & Trade Terms <span className="text-[12px] font-normal text-neutral-400">(Optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Include material grades, custom OEM branding, packaging, Incoterms (FOB/CIF), delivery timeline, etc."
                  className="w-full resize-none rounded-xl border border-white/10 bg-[#0c0c0c] px-4 py-3 text-[14px] text-white placeholder:text-neutral-400 transition-colors focus:border-[#FF5A00] focus:outline-none focus:ring-2 focus:ring-[#FF5A00]/25"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 border-t border-white/10 pt-5">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-white">
                <Flame className="h-4 w-4 text-[#FF5A00]" /> Popular RFQs:
              </span>
              {quick.map(({ label, icon: Icon, values }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    setTitle(values.t);
                    setCategory(values.c);
                    setQuantity(values.q);
                    setUnit(values.u);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#141414] px-3.5 py-2 text-[12px] font-semibold text-slate-200 transition-all hover:-translate-y-0.5 hover:border-[#FF5A00]/60 hover:text-white"
                >
                  <Icon className="h-4 w-4 text-[#FF5A00]" /> {label}
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="group flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#FF7A2E] to-[#E84A00] text-[16px] font-black text-white shadow-[0_14px_34px_-10px_rgba(255,90,0,0.9)] transition-transform hover:-translate-y-0.5 active:scale-[0.99]"
            >
              <Send className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
              Post Requirement Now
            </button>
            <p className="flex items-center justify-center gap-2 text-[12px] text-neutral-400">
              <Scale className="h-3.5 w-3.5" /> Your requirement goes only to verified manufacturers.
            </p>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
