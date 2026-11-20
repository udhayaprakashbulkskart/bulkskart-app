import React from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '@/components/common/BrandLogo';
import { Globe, Linkedin, Twitter, Facebook, Instagram, Youtube, Mail, MessageSquare } from 'lucide-react';
import { WHATSAPP_CHAT_URL, WHATSAPP_DISPLAY } from '@/lib/supportContact';

const footerLinks = {
  Products: [
    { label: 'Browse Products', href: '/products' },
    { label: 'Categories', href: '/categories' },
    { label: 'Manufacturers', href: '/manufacturers' },
    { label: 'Countries', href: '/manufacturers' },
  ],
  'For Suppliers': [
    { label: 'Supplier Registration', href: '/auth?tab=supplier' },
    { label: 'Subscription Plans', href: '/pricing' },
    { label: 'Supplier Resources', href: '/how-it-works' },
    { label: 'Business Stories', href: '/blog' },
  ],
  'For Buyers': [
    { label: 'Post Requirement', href: '/post-requirement' },
    { label: 'Free Delivery & Order Loan', href: '/loan-calculator' },
    { label: 'AI Import & Export Assistance', href: '/trade-assistant' },
    { label: 'Buyer Resources', href: '/how-it-works' },
    { label: 'Trade Guide', href: '/how-it-works' },
    { label: 'FAQs', href: '/how-it-works' },
  ],
  Company: [
    { label: 'About Us', href: '/about' },
    { label: 'Careers', href: '/careers' },
    { label: 'Blog', href: '/blog' },
    { label: 'Contact Us', href: '/contact' },
  ],
  Legal: [
    { label: 'Terms & Conditions', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Cookie Policy', href: '/cookie-policy' },
    { label: 'Sitemap', href: '/sitemap' },
  ],
};

const socialLinks = [
  { icon: Linkedin,  href: 'https://linkedin.com/company/bulkskart',  label: 'LinkedIn' },
  { icon: Twitter,   href: 'https://twitter.com/bulkskart',            label: 'Twitter' },
  { icon: Facebook,  href: 'https://facebook.com/bulkskart',           label: 'Facebook' },
  { icon: Instagram, href: 'https://instagram.com/bulkskart',          label: 'Instagram' },
  { icon: Youtube,   href: 'https://youtube.com/@bulkskart',           label: 'YouTube' },
];

export default function Footer() {
  return (
    <footer className="w-full max-w-full overflow-x-hidden border-t border-border bg-muted">
      <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8 grid grid-cols-1 gap-2 md:grid-cols-6 md:gap-5">
          <div className="mb-4 md:col-span-1 md:mb-0">
            <div className="mb-4">
              <BrandLogo size="md" variant="auto" linkTo="/" />
            </div>
            <p className="mb-3 text-sm leading-relaxed text-muted-foreground">
              Global B2B bulk trade platform by <span className="font-semibold text-foreground">BulkSkart</span>. Connecting verified manufacturers with buyers worldwide.
            </p>
            <div className="mb-4 space-y-2">
              <a href="mailto:info@bulkskart.com" className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary">
                <Mail className="h-4 w-4 shrink-0 text-primary" /> info@bulkskart.com
              </a>
              <a href={WHATSAPP_CHAT_URL} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary">
                <MessageSquare className="h-4 w-4 shrink-0 text-[#E55C13]" /> WhatsApp {WHATSAPP_DISPLAY}
              </a>
            </div>
            <div className="flex gap-2">
              {socialLinks.map(({ icon: Icon, href, label }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([section, links]) => (
            <details key={section} className="group border-b border-border py-1 md:border-0 md:py-0">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold uppercase tracking-wider text-foreground md:mb-4 md:min-h-0 md:cursor-default [&::-webkit-details-marker]:hidden">
                {section}
                <span className="text-muted-foreground md:hidden group-open:rotate-180" aria-hidden="true">▾</span>
              </summary>
              <ul className="space-y-1 pb-3 md:space-y-2 md:pb-0">
                {links.map(link => (
                  <li key={link.label}>
                    <Link to={link.href} className="flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground md:min-h-0">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>

        <div className="flex flex-col items-stretch justify-between gap-3 border-t border-border pt-6 md:flex-row md:items-center">
          <div className="text-sm font-semibold text-foreground">Subscribe to Updates</div>
          <form
            className="flex w-full gap-2 md:max-w-sm"
            onSubmit={e => { e.preventDefault(); const inp = (e.currentTarget.elements.namedItem('email') as HTMLInputElement); if (inp?.value) { inp.value = ''; alert('Thanks for subscribing!'); } }}
          >
            <input
              name="email"
              type="email"
              aria-label="Email address for updates"
              placeholder="Enter your email"
              className="h-11 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button type="submit" aria-label="Subscribe to newsletter updates" className="h-11 shrink-0 rounded-md bg-[#C94400] px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              Subscribe
            </button>
          </form>
        </div>

        <div className="mt-5 flex flex-col items-center justify-between gap-2 border-t border-border pt-4 text-center md:flex-row md:text-left">
          <p className="text-sm text-muted-foreground">© 2026 Tech Pod AI Database Private Limited · BulkSkart. All rights reserved.</p>
          <p className="text-sm text-muted-foreground">Global Trade · A Stronger Tomorrow</p>
        </div>
      </div>
    </footer>
  );
}


