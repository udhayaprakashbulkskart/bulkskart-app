import React, { useState } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import PageMeta from '@/components/common/PageMeta';
import FaqAccordion from '@/components/common/FaqAccordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Mail, MapPin, Clock, Send, CheckCircle2,
  Linkedin, Twitter, Facebook, Instagram, Youtube,
  Building2, Globe, MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { SUPPORT_EMAIL, WHATSAPP_CHAT_URL, WHATSAPP_DISPLAY, WHATSAPP_MESSAGE_URL } from '@/lib/supportContact';
import '@/components/formkit/formkit.css';

const CONTACT_INFO = [
  {
    icon: Building2,
    label: 'Company',
    value: 'BulkSkart B2B Marketplace',
    sub: 'Registered in India',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'info@bulkskart.com',
    href: 'mailto:info@bulkskart.com',
  },
  {
    icon: MessageSquare,
    label: 'WhatsApp chat',
    value: WHATSAPP_DISPLAY,
    href: WHATSAPP_CHAT_URL,
    sub: 'Message BulkSkart on WhatsApp',
  },
  {
    icon: MapPin,
    label: 'Address',
    value: 'India',
    sub: 'Headquarters',
  },
  {
    icon: Clock,
    label: 'Business Hours',
    value: 'Mon – Sat, 9 AM – 6 PM IST',
    sub: 'We respond within 24 hours',
  },
  {
    icon: Globe,
    label: 'Website',
    value: 'bulkskart.com',
    href: '/',
  },
];

const SOCIAL = [
  { icon: Linkedin,  href: 'https://linkedin.com/company/bulkskart',  label: 'LinkedIn'  },
  { icon: Twitter,   href: 'https://twitter.com/bulkskart',            label: 'Twitter'   },
  { icon: Facebook,  href: 'https://facebook.com/bulkskart',           label: 'Facebook'  },
  { icon: Instagram, href: 'https://instagram.com/bulkskart',          label: 'Instagram' },
  { icon: Youtube,   href: 'https://youtube.com/@bulkskart',           label: 'YouTube'   },
];

const FAQS = [
  { q: 'How do I register as a supplier?', a: 'Click "Join as Supplier" on the top navigation or visit /auth?tab=supplier to create your account.' },
  { q: 'How long does buyer verification take?', a: 'KYC review typically takes 1–2 business days. You\'ll receive an email notification once approved.' },
  { q: 'What subscription plans are available?', a: 'We offer Starter (₹2,500 with 5 responses), Business (₹7,500 with 50 responses + AI accessibility), Growth (₹15,000 with unlimited responses), and custom Enterprise plans. Add-on services include AI Accessibility (₹7,500) and 24 Hours Sell Products (₹5,000). See /pricing for details.' },
  { q: 'How do I raise a trade dispute?', a: 'Go to your dashboard → Dispute Center → Raise Dispute. Select the order and describe the issue with evidence.' },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The message goes out from the visitor's own e-mail app, addressed to BulkSkart: the site has no mail server of
  // its own, and a form that only pretended to send would lose the message.
  const mailtoHref = () => {
    const subject = form.subject.trim() || `Message from ${form.name.trim()}`;
    const body = `${form.message.trim()}\n\n— ${form.name.trim()}\n${form.email.trim()}`;
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  const whatsappHref = () => `${WHATSAPP_CHAT_URL}?text=${encodeURIComponent(`${form.message.trim()}\n\n— ${form.name.trim()} (${form.email.trim()})`)}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!form.name.trim()) found.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) found.email = 'Please enter a valid e-mail address.';
    if (!form.message.trim()) found.message = 'Please write your message.';
    setErrors(found);
    const first = ['name', 'email', 'message'].find((key) => found[key]);
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    window.location.href = mailtoHref();
    setSent(true);
  };

  return (
    <MainLayout>
      <PageMeta
        title="Contact BulkSkart — Support, Partnerships & Global Trade Enquiries"
        description="Reach BulkSkart support by email or WhatsApp chat on +91 89702 02677. We respond within 24 hours."
        keywords="contact BulkSkart, B2B support, trade enquiry, supplier help, bulk trade contact"
        canonical="/contact"
        ogType="website"
        breadcrumbs={[
          { name: 'Home', item: '/' },
          { name: 'Contact Us', item: '/contact' },
        ]}
      />

      {/* Hero */}
      <div className="bg-[#242424] text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-4">
            <MessageSquare className="w-3.5 h-3.5 text-[#FF5A00]" />
            <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest">Get in Touch</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-3">
            Contact <span className="text-[#FF5A00]">BulkSkart</span>
          </h1>
          <p className="text-white/70 text-sm max-w-xl mx-auto">
            Operated by <strong className="text-white">Tech Pod AI Database Private Limited</strong>. We're here to help you with trade inquiries, support, and partnerships.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Contact form */}
          <div>
            <h2 className="text-xl font-bold text-foreground mb-1">Send Us a Message</h2>
            <p className="text-sm text-muted-foreground mb-5">Fill in the form and send it from your e-mail app. We respond within 24 hours.</p>

            {sent ? (
              <div className="fk-form fk-done rounded-2xl border border-border bg-card" role="status">
                <span className="fk-done-ico">
                  <Mail aria-hidden="true" />
                </span>
                <h3>Press Send in your e-mail app</h3>
                <p>
                  Your message is ready in a new e-mail to <b>{SUPPORT_EMAIL}</b>. It reaches us once you send it from there.
                </p>
                <p>If no e-mail opened, use one of these instead:</p>
                <div className="fk-actions">
                  <a href={mailtoHref()} className="fk-btn is-primary">
                    <Mail aria-hidden="true" /> Open the E-mail Again
                  </a>
                  <a href={whatsappHref()} target="_blank" rel="noreferrer" className="fk-btn is-ghost">
                    <MessageSquare aria-hidden="true" /> WhatsApp {WHATSAPP_DISPLAY}
                  </a>
                </div>
                <button
                  type="button"
                  className="text-sm font-semibold text-primary hover:underline"
                  onClick={() => {
                    setSent(false);
                    setForm({ name: '', email: '', subject: '', message: '' });
                  }}
                >
                  Write another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="fk-skin space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full Name *</Label>
                    <Input id="name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Your name" autoComplete="name" aria-invalid={Boolean(errors.name) || undefined} aria-describedby={errors.name ? 'name-error' : undefined} />
                    {errors.name && <p id="name-error" className="fk-error" role="alert">{errors.name}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input id="email" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="you@company.com" autoComplete="email" aria-invalid={Boolean(errors.email) || undefined} aria-describedby={errors.email ? 'email-error' : undefined} />
                    {errors.email && <p id="email-error" className="fk-error" role="alert">{errors.email}</p>}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="How can we help?" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="message">Message *</Label>
                  <Textarea
                    id="message"
                    value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    placeholder="Describe your inquiry, issue, or partnership proposal..."
                    rows={5}
                    aria-invalid={Boolean(errors.message) || undefined}
                    aria-describedby={errors.message ? 'message-error' : undefined}
                  />
                  {errors.message && <p id="message-error" className="fk-error" role="alert">{errors.message}</p>}
                </div>
                <button type="submit" className="fk-btn is-primary w-full">
                  <Send aria-hidden="true" /> Send Message
                </button>
                <p className="text-xs text-center text-muted-foreground">Opens your e-mail app with this message, addressed to {SUPPORT_EMAIL}.</p>
              </form>
            )}
          </div>

          {/* Contact info */}
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Contact Information</h2>
              <p className="text-sm text-muted-foreground mb-4">Reach us through any of the channels below.</p>
              <div className="space-y-3">
                {CONTACT_INFO.map(({ icon: Icon, label, value, sub, href }) => (
                  <div key={label} className="flex items-start gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                    <div className="w-9 h-9 rounded-lg bg-[#FF5A00]/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#FF5A00]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">{label}</p>
                      {href ? (
                        <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noreferrer' : undefined} className="text-sm font-semibold text-foreground hover:text-[#FF5A00] transition-colors break-words">{value}</a>
                      ) : (
                        <p className="text-sm font-semibold text-foreground break-words">{value}</p>
                      )}
                      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                    </div>
                  </div>
                ))}
                <a
                  href={WHATSAPP_MESSAGE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 h-11 rounded-lg bg-[#E55C13] hover:bg-[#cc5210] text-white text-sm font-bold transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Message BulkSkart on WhatsApp
                </a>
              </div>
            </div>

            {/* Social links */}
            <div>
              <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Follow Us</p>
              <div className="flex gap-2 flex-wrap">
                {SOCIAL.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-[#FF5A00] hover:border-[#FF5A00]/40 transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="mt-10">
          <h2 className="text-xl font-bold text-foreground mb-5">Frequently Asked Questions</h2>
          <FaqAccordion faqs={FAQS} />
        </div>
      </div>
    </MainLayout>
  );
}
