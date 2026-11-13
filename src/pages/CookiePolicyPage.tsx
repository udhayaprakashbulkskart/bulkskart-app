import { Cookie, Mail } from 'lucide-react';
import Header from '@/components/layouts/Header';
import Footer from '@/components/layouts/Footer';
import PageMeta from '@/components/common/PageMeta';

const COOKIE_TYPES = [
  {
    name: 'Strictly Necessary',
    canDisable: false,
    examples: 'Session token, authentication state, CSRF protection',
    purpose: 'Required for the platform to function. These cannot be disabled. They enable login, secure navigation, and platform-critical operations.',
  },
  {
    name: 'Functional',
    canDisable: true,
    examples: 'Language preference, currency selection, theme (dark/light)',
    purpose: 'Remember your preferences so you don\'t have to re-select them on every visit. Disabling these means your preferences won\'t be saved between sessions.',
  },
  {
    name: 'Analytics',
    canDisable: true,
    examples: 'Google Analytics (GA4), page view tracking, feature usage events',
    purpose: 'Help us understand how users interact with the platform so we can improve it. All analytics data is aggregated and anonymised.',
  },
  {
    name: 'Marketing',
    canDisable: true,
    examples: 'Remarketing pixels, conversion tracking',
    purpose: 'Used to show relevant BulkSkart advertisements on third-party platforms. We do not share your personal data with ad networks.',
  },
];

export default function CookiePolicyPage() {
  return (
    <>
      <PageMeta
        title="Cookie Policy — BulkSkart"
        description="Learn how BulkSkart uses cookies on our B2B trade platform — what types we use, why, and how to manage your preferences."
        keywords="BulkSkart cookie policy, cookies B2B platform, website cookies India"
        canonical="/cookie-policy"
        ogType="website"
        breadcrumbs={[
          { name: 'Home', item: '/' },
          { name: 'Cookie Policy', item: '/cookie-policy' },
        ]}
      />
      <Header />

      <section className="bg-[#C94400] text-white py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-5">
            <Cookie className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest">Legal</span>
          </div>
          <h1 className="text-[26px] md:text-[36px] font-black leading-tight mb-3">Cookie Policy</h1>
          <p className="text-white/60 text-sm">Last updated: 1 September 2026 · Operated by Tech Pod AI Database Private Limited</p>
        </div>
      </section>

      <section className="py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <h2 className="text-[15px] font-bold text-foreground mb-2">What Are Cookies?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Cookies are small text files placed on your device when you visit a website. They are widely used to make websites work efficiently, remember your preferences, and provide analytical information to site owners. BulkSkart uses cookies to deliver a personalised, secure, and efficient experience.
            </p>
          </div>

          <div>
            <h2 className="text-[15px] font-bold text-foreground mb-4">Cookies We Use</h2>
            <div className="space-y-4">
              {COOKIE_TYPES.map(({ name, canDisable, examples, purpose }) => (
                <div key={name} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-[14px] font-bold text-foreground">{name}</span>
                    <span className={`text-[10px] font-semibold border rounded-full px-2 py-0.5 ${canDisable ? 'bg-[#FF5A00]/10 text-[#FF7A2E] dark:text-[#FF7A2E] border-[#FF5A00]/40 dark:border-[#FF5A00]/40' : 'bg-[#FF5A00]/10 text-[#FF7A2E] dark:text-[#FF7A2E] border-[#FF5A00]/40 dark:border-[#FF5A00]/40'}`}>
                      {canDisable ? 'Optional' : 'Required'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2 leading-relaxed">{purpose}</p>
                  <p className="text-[11px] text-muted-foreground/70"><span className="font-medium">Examples:</span> {examples}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-[15px] font-bold text-foreground mb-2">Managing Cookies</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              You can manage or delete cookies at any time through your browser settings. Note that disabling cookies may affect the functionality of BulkSkart. Most browsers allow you to refuse cookies, delete existing cookies, and be notified when new cookies are set.
            </p>
          </div>

          <div>
            <h2 className="text-[15px] font-bold text-foreground mb-2">Third-Party Cookies</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Some features of BulkSkart embed third-party content (such as Google Analytics). These third parties may set their own cookies subject to their own privacy policies. We do not control these cookies.
            </p>
          </div>

          <div>
            <h2 className="text-[15px] font-bold text-foreground mb-2">Changes to This Policy</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We may update this Cookie Policy from time to time. The date at the top of this page shows when it was last revised. Continued use of the platform after changes constitutes acceptance.
            </p>
          </div>

          <div className="bg-muted rounded-xl p-5 flex items-start gap-3">
            <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-foreground mb-1">Questions about cookies?</div>
              <p className="text-sm text-muted-foreground">Email <a href="mailto:info@bulkskart.com" className="text-primary hover:underline">info@bulkskart.com</a></p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
