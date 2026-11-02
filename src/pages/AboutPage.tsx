import { Link } from 'react-router-dom';
import { Globe, Users, ShieldCheck, TrendingUp, BadgeCheck, Factory, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Header from '@/components/layouts/Header';
import Footer from '@/components/layouts/Footer';
import PageMeta from '@/components/common/PageMeta';

const STATS = [
  { value: '50,000+', label: 'Verified Buyers' },
  { value: '12,000+', label: 'Suppliers & Manufacturers' },
  { value: '180+', label: 'Countries Served' },
  { value: '₹500Cr+', label: 'Trade Volume Facilitated' },
];

const VALUES = [
  { icon: ShieldCheck, title: 'Trust First', desc: 'Every supplier on BulkSkart is verified through a multi-step process — GST, business registration, and physical address validation.' },
  { icon: Globe, title: 'Global Reach', desc: 'We connect Indian manufacturers with buyers across 180+ countries, opening new markets for SMEs that were previously inaccessible.' },
  { icon: TrendingUp, title: 'Transparent Trade', desc: 'Real-time RFQs, live quotations, and dispute resolution tools ensure every transaction is fair and traceable.' },
  { icon: Users, title: 'Community Driven', desc: 'BulkSkart grows with its members. Buyer feedback and supplier ratings drive continuous improvement across the platform.' },
];

const TEAM = [
  { name: 'Rajesh Kumar', role: 'CEO & Co-founder', initials: 'RK' },
  { name: 'Priya Sharma', role: 'CTO & Co-founder', initials: 'PS' },
  { name: 'Amit Verma', role: 'Head of Operations', initials: 'AV' },
  { name: 'Neha Gupta', role: 'Head of Supplier Relations', initials: 'NG' },
];

export default function AboutPage() {
  return (
    <>
      <PageMeta
        title="About Us — BulkSkart | Global B2B Bulk Trade Platform"
        description="BulkSkart is India's leading B2B bulk trade platform by Tech Pod AI Database Private Limited. Learn about our mission, values, and team connecting verified manufacturers with global buyers."
        keywords="about BulkSkart, B2B trade platform India, Tech Pod AI, bulk wholesale marketplace"
        canonical="/about"
        ogType="website"
        breadcrumbs={[
          { name: 'Home', item: '/' },
          { name: 'About Us', item: '/about' },
        ]}
      />
      <Header />

      {/* Hero */}
      <section className="bg-[#1a1a2e] text-white py-14 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-5">
            <Globe className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest">Our Story</span>
          </div>
          <h1 className="text-[28px] md:text-[44px] font-black leading-tight mb-4">
            Connecting the World's <span className="text-primary">Manufacturers</span> with Global Buyers
          </h1>
          <p className="text-white/70 text-[14px] md:text-[16px] leading-relaxed max-w-2xl mx-auto">
            BulkSkart is operated by <strong className="text-white">Tech Pod AI Database Private Limited</strong> — a technology company on a mission to make bulk B2B trade transparent, efficient, and accessible for businesses of every size.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-primary/5 border-b border-border py-8 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {STATS.map(({ value, label }) => (
            <div key={label}>
              <div className="text-[22px] md:text-[30px] font-black text-primary leading-none mb-1">{value}</div>
              <div className="text-xs text-muted-foreground font-medium">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission */}
      <section className="py-12 px-4 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-[22px] md:text-[28px] font-black text-foreground mb-4">Our Mission</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-4">
              India has over 63 million SMEs — many producing world-class goods but lacking access to global buyers. BulkSkart bridges that gap. We build the infrastructure for verified, large-volume trade to happen simply, safely, and at scale.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed mb-6">
              From real-time RFQ matching and AI-powered quotations to secure escrow payments and end-to-end order tracking, every feature we ship exists to reduce friction and build trust between buyers and suppliers.
            </p>
            <Link to="/how-it-works">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                How It Works <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border border-border rounded-xl p-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-[13px] font-bold text-foreground mb-1">{title}</h3>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="bg-muted/40 border-t border-border py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-[20px] md:text-[26px] font-black text-foreground mb-2 text-center">Leadership Team</h2>
          <p className="text-muted-foreground text-sm text-center mb-8">Building the future of B2B trade</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {TEAM.map(({ name, role, initials }) => (
              <div key={name} className="bg-card border border-border rounded-xl p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-black text-lg mx-auto mb-3">
                  {initials}
                </div>
                <div className="text-sm font-bold text-foreground">{name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <BadgeCheck className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-[20px] md:text-[26px] font-black text-foreground mb-3">Ready to Trade Smarter?</h2>
          <p className="text-muted-foreground text-sm mb-6">Join thousands of manufacturers and buyers already on BulkSkart.</p>
          <div className="flex flex-col md:flex-row gap-3 justify-center">
            <Link to="/auth?tab=register"><Button className="bg-[#FF5A00] hover:bg-[#e04e00] text-white font-bold h-11 px-8 gap-2 rounded-xl shadow-[0_2px_0_#922f00]"><Factory className="w-4 h-4" /> Join as Supplier</Button></Link>
            <Link to="/post-requirement"><Button className="bg-[#FF5A00] hover:bg-[#e04e00] text-white h-11 px-8 gap-2 font-bold rounded-xl shadow-[0_2px_0_#922f00]"><Users className="w-4 h-4" /> Post a Requirement</Button></Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
