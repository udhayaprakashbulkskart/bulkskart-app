import { Link } from 'react-router-dom';
import { Briefcase, MapPin, Clock, ArrowRight, Zap, Users, Heart, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Header from '@/components/layouts/Header';
import Footer from '@/components/layouts/Footer';
import PageMeta from '@/components/common/PageMeta';

const PERKS = [
  { icon: Zap,    title: 'Fast Growth',      desc: 'Join a high-growth startup at Series A stage with direct impact on product decisions.' },
  { icon: Globe,  title: 'Remote Friendly',  desc: 'Work from anywhere in India. We have offices in Bangalore and Mumbai.' },
  { icon: Users,  title: 'Great Team',       desc: 'Ex-Flipkart, Amazon, Juspay, and IIT/IIM alumni building together.' },
  { icon: Heart,  title: 'Real Benefits',    desc: 'Health insurance, ESOP, learning budget, and flexible working hours.' },
];

const OPENINGS = [
  { title: 'Senior Full-Stack Engineer', dept: 'Engineering', location: 'Bangalore / Remote', type: 'Full-time', exp: '3–6 yrs' },
  { title: 'Product Manager — Supplier Growth', dept: 'Product', location: 'Bangalore', type: 'Full-time', exp: '2–5 yrs' },
  { title: 'Growth Marketing Manager', dept: 'Marketing', location: 'Remote', type: 'Full-time', exp: '3–5 yrs' },
  { title: 'Business Development Executive', dept: 'Sales', location: 'Mumbai / Delhi', type: 'Full-time', exp: '1–3 yrs' },
  { title: 'UI/UX Designer', dept: 'Design', location: 'Remote', type: 'Full-time', exp: '2–4 yrs' },
  { title: 'Data Analyst — Trade Insights', dept: 'Analytics', location: 'Bangalore', type: 'Full-time', exp: '1–3 yrs' },
];

const DEPT_COLORS: Record<string, string> = {
  Engineering: 'bg-orange-500/10 text-[#FF5A00] dark:text-[#FF5A00] border-[#FF5A00]/30 dark:border-[#FF5A00]/30',
  Product:     'bg-[#FF5A00]/10 text-[#FF7A2E] dark:text-[#FF7A2E] border-[#FF5A00]/40 dark:border-[#FF5A00]/40',
  Marketing:   'bg-[#FF5A00]/10 text-[#FF7A2E] dark:text-[#FF7A2E] border-[#FF5A00]/40 dark:border-[#FF5A00]/40',
  Sales:       'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-[#FF5A00]/30 dark:border-orange-800',
  Design:      'bg-[#FF5A00]/10 text-[#FF7A2E] dark:text-[#FF7A2E] border-[#FF5A00]/40 dark:border-[#FF5A00]/40',
  Analytics:   'bg-[#FF5A00]/10 text-[#FF7A2E] dark:text-[#FF7A2E] border-[#FF5A00]/40 dark:border-[#FF5A00]/40',
};

export default function CareersPage() {
  return (
    <>
      <PageMeta
        title="Careers — BulkSkart | Join Our Team"
        description="Join BulkSkart and help build India's leading B2B bulk trade platform. Open roles in Engineering, Product, Sales, Marketing, and more."
        keywords="BulkSkart careers, B2B startup jobs, tech jobs India, remote jobs India"
      />
      <Header />

      {/* Hero */}
      <section className="bg-[#C94400] text-white py-14 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-5">
            <Briefcase className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest">We're Hiring</span>
          </div>
          <h1 className="text-[28px] md:text-[40px] font-black leading-tight mb-4">
            Build the Future of <span className="text-primary">B2B Trade</span>
          </h1>
          <p className="text-white/70 text-[14px] md:text-[16px] leading-relaxed">
            BulkSkart is a fast-growing B2B marketplace on a mission to connect India's manufacturers with the world. We're looking for curious, driven people who want to build things that matter.
          </p>
        </div>
      </section>

      {/* Perks */}
      <section className="py-10 px-4 bg-muted/40 border-b border-border">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-5">
          {PERKS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-card border border-border rounded-xl p-4 text-center">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div className="text-sm font-bold text-foreground mb-1">{title}</div>
              <div className="text-[11px] text-muted-foreground leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Openings */}
      <section className="py-12 px-4 max-w-4xl mx-auto">
        <h2 className="text-[20px] md:text-[26px] font-black text-foreground mb-2">Open Positions</h2>
        <p className="text-muted-foreground text-sm mb-8">{OPENINGS.length} roles across {new Set(OPENINGS.map(o => o.dept)).size} departments</p>
        <div className="space-y-3">
          {OPENINGS.map((job) => (
            <div key={job.title} className="bg-card border border-border rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 hover:border-primary/40 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="text-[14px] font-bold text-foreground">{job.title}</h3>
                  <span className={`inline-flex items-center text-[10px] font-semibold border rounded-full px-2 py-0.5 ${DEPT_COLORS[job.dept]}`}>{job.dept}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{job.type}</span>
                  <span>{job.exp} experience</span>
                </div>
              </div>
              <a href={`mailto:info@bulkskart.com?subject=Application: ${encodeURIComponent(job.title)}`}>
                <Button size="sm" className="bg-[#1A0C05] text-primary-foreground hover:bg-primary/90 shrink-0 gap-1.5">
                  Apply <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </a>
            </div>
          ))}
        </div>

        {/* Spontaneous */}
        <div className="mt-8 bg-primary/5 border border-primary/20 rounded-xl p-6 text-center">
          <h3 className="text-[16px] font-black text-foreground mb-2">Don't see your role?</h3>
          <p className="text-sm text-muted-foreground mb-4">We're always looking for exceptional people. Send us your resume and we'll be in touch.</p>
          <a href="mailto:info@bulkskart.com">
            <Button className="bg-[#1A0C05] text-primary-foreground hover:bg-primary/90 gap-2">
              Send Open Application <ArrowRight className="w-4 h-4" />
            </Button>
          </a>
        </div>
      </section>

      <Footer />
    </>
  );
}
