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
    { label: 'Business Stories', href: '/how-it-works' },
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
    <footer className="relative mt-auto w-full max-w-[100vw] overflow-x-hidden border-t border-border bg-card/80 backdrop-blur-xl mb-[4.75rem] lg:mb-0">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-6 sm:py-8 md:py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6 md:gap-5 mb-6 md:mb-10">
          {/* Brand column */}
          <div className="col-span-2 sm:col-span-3 md:col-span-1">
            <div className="mb-4">
              <BrandLogo size="md" variant="auto" linkTo="/" />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Global B2B bulk trade platform by <span className="font-semibold text-foreground">BulkSkart</span>. Connecting verified manufacturers with buyers worldwide.
            </p>
            <div className="space-y-1.5 mb-4">
              <a href="mailto:info@bulkskart.com" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                <Mail className="w-3 h-3 text-primary shrink-0" /> info@bulkskart.com
              </a>
              <a href={WHATSAPP_CHAT_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                <MessageSquare className="w-3 h-3 text-[#25D366] shrink-0" /> WhatsApp {WHATSAPP_DISPLAY}
              </a>
            </div>
            <div className="flex gap-3">
              {socialLinks.map(({ icon: Icon, href, label }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label} className="w-8 h-8 rounded-md bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4">{section}</h4>
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link.label}>
                    <Link to={link.href} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Subscribe */}
        <div className="border-t border-border pt-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
          <div>
            <div className="text-xs font-semibold text-foreground mb-0.5">Subscribe to Updates</div>
            <p className="text-xs text-muted-foreground">Get the latest bulk trade opportunities</p>
          </div>
          <form
            className="flex gap-2 w-full md:max-w-xs"
            onSubmit={e => { e.preventDefault(); const inp = (e.currentTarget.elements.namedItem('email') as HTMLInputElement); if (inp?.value) { inp.value = ''; alert('Thanks for subscribing!'); } }}
          >
            <input
              name="email"
              type="email"
              aria-label="Email address for updates"
              placeholder="Enter your email"
              className="flex-1 min-w-0 px-3 py-2 text-sm rounded-md bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button type="submit" aria-label="Subscribe to newsletter updates" className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0">
              Subscribe
            </button>
          </form>
        </div>

        <div className="border-t border-border mt-5 pt-4 flex flex-col md:flex-row items-center justify-between gap-2 text-center md:text-left">
          <p className="text-xs text-muted-foreground">© 2026 Tech Pod AI Database Private Limited · BulkSkart. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}


