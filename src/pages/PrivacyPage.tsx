import { Lock, Mail } from 'lucide-react';
import Header from '@/components/layouts/Header';
import Footer from '@/components/layouts/Footer';
import PageMeta from '@/components/common/PageMeta';

const SECTIONS = [
  {
    title: '1. Introduction',
    content: `Tech Pod AI Database Private Limited ("BulkSkart", "we", "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the BulkSkart platform. It applies to all registered users and visitors.`,
  },
  {
    title: '2. Information We Collect',
    content: `We collect: (a) Account information — name, email address, phone number, company name, GST number, and business registration details provided during sign-up; (b) Profile data — product listings, pricing, certifications, and trade history you add to your profile; (c) Transaction data — RFQs posted, quotations submitted, order details, and payment records; (d) Usage data — pages visited, features used, search queries, IP address, browser type, and device information; (e) Communications — messages sent between buyers and suppliers via our platform messaging system.`,
  },
  {
    title: '3. How We Use Your Information',
    content: `We use your information to: provide and improve the BulkSkart platform; verify supplier and buyer identities; match buyers with relevant suppliers using AI-powered algorithms; process payments and manage subscriptions; send transactional emails (quotation alerts, order updates, verification status); send marketing communications (which you may opt out of at any time); detect fraud and ensure platform security; and comply with legal obligations under Indian law.`,
  },
  {
    title: '4. Information Sharing',
    content: `We share your information with: (a) Other platform users — buyers can see supplier profiles and contact details (unlocked via subscription); suppliers can see buyer requirement details; (b) Service providers — payment processors (Razorpay), cloud infrastructure (Supabase/AWS), analytics tools; (c) Legal authorities — when required by Indian law, court order, or to protect BulkSkart's legal rights. We do not sell your personal data to third parties.`,
  },
  {
    title: '5. Data Storage & Security',
    content: `Your data is stored on servers located within India or in jurisdictions with adequate data protection standards. We implement SSL encryption, access controls, and regular security audits. Despite these measures, no internet transmission is 100% secure and we cannot guarantee absolute security.`,
  },
  {
    title: '6. Cookies',
    content: `We use cookies to maintain session state, remember your preferences, and analyse platform usage. Essential cookies cannot be disabled as they are required for the platform to function. You can manage analytics cookies via your browser settings or our cookie preference centre.`,
  },
  {
    title: '7. Your Rights',
    content: `Under applicable Indian data protection law, you have the right to: access the personal data we hold about you; correct inaccurate information; request deletion of your account and associated data (subject to legal retention obligations); opt out of marketing emails via the unsubscribe link in any communication; and lodge a complaint with the relevant data protection authority. To exercise these rights, email info@bulkskart.com.`,
  },
  {
    title: '8. Data Retention',
    content: `We retain account data for the duration of your account plus 3 years for legal and audit purposes. Transaction records may be retained for 7 years as required under Indian financial regulations. Usage logs are retained for 12 months.`,
  },
  {
    title: '9. Children',
    content: `BulkSkart is a business-to-business platform intended for users aged 18 and above. We do not knowingly collect personal information from minors. If you believe a minor has provided us with information, please contact us immediately.`,
  },
  {
    title: '10. Changes to This Policy',
    content: `We may update this Privacy Policy periodically. Material changes will be communicated via email or in-platform notification at least 14 days before taking effect. Continued use after the effective date constitutes acceptance.`,
  },
  {
    title: '11. Contact',
    content: `Data Controller: BulkSkart, India. Privacy enquiries: info@bulkskart.com. We aim to respond within 5 business days.`,
  },
];

export default function PrivacyPage() {
  return (
    <>
      <PageMeta
        title="Privacy Policy — BulkSkart"
        description="Read BulkSkart's Privacy Policy to understand how we collect, use, and protect your personal and business data on our B2B trade platform."
        keywords="BulkSkart privacy policy, data protection B2B marketplace, Tech Pod AI privacy"
        canonical="/privacy"
        ogType="website"
        breadcrumbs={[
          { name: 'Home', item: '/' },
          { name: 'Privacy Policy', item: '/privacy' },
        ]}
      />
      <Header />

      <section className="bg-[#C94400] text-white py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-5">
            <Lock className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest">Legal</span>
          </div>
          <h1 className="text-[26px] md:text-[36px] font-black leading-tight mb-3">Privacy Policy</h1>
          <p className="text-white/60 text-sm">Last updated: 1 September 2026 · Operated by Tech Pod AI Database Private Limited</p>
        </div>
      </section>

      <section className="py-10 px-4">
        <div className="max-w-3xl mx-auto space-y-8">
          {SECTIONS.map(({ title, content }) => (
            <div key={title}>
              <h2 className="text-[15px] font-bold text-foreground mb-2">{title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>
            </div>
          ))}

          <div className="bg-muted rounded-xl p-5 flex items-start gap-3">
            <Mail className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold text-foreground mb-1">Privacy Enquiries</div>
              <p className="text-sm text-muted-foreground">Email <a href="mailto:info@bulkskart.com" className="text-primary hover:underline">info@bulkskart.com</a> for any data-related requests or concerns.</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
