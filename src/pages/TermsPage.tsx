import { Shield, Mail } from 'lucide-react';
import Header from '@/components/layouts/Header';
import Footer from '@/components/layouts/Footer';
import PageMeta from '@/components/common/PageMeta';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    content: `By accessing or using the BulkSkart platform (bulkskart.com) operated by Tech Pod AI Database Private Limited ("Company", "we", "us"), you agree to be bound by these Terms & Conditions. If you do not agree, please do not use our services.`,
  },
  {
    title: '2. Platform Description',
    content: `BulkSkart is a B2B marketplace that connects verified manufacturers, suppliers, and buyers for bulk trade transactions. We facilitate the discovery, communication, and transaction process but are not a party to any trade agreement between buyers and suppliers.`,
  },
  {
    title: '3. User Registration & Eligibility',
    content: `You must be at least 18 years old and represent a legally registered business entity to create an account. You agree to provide accurate, complete, and current information during registration and to update such information as needed. Each business may maintain one account per role (buyer or supplier).`,
  },
  {
    title: '4. Supplier Verification',
    content: `Suppliers undergo a verification process that includes GST registration confirmation, business registration document review, and address validation. Verification status does not constitute an endorsement of product quality or business reliability. Buyers are encouraged to conduct independent due diligence.`,
  },
  {
    title: '5. Buyer Obligations',
    content: `Buyers agree to: post genuine requirements with accurate quantity and specification details; respond to quotations in a timely manner; make payments as agreed for confirmed orders; and not misuse supplier contact information obtained through the platform.`,
  },
  {
    title: '6. Supplier Obligations',
    content: `Suppliers agree to: provide accurate product specifications, pricing, and availability; fulfil confirmed orders as per agreed terms; maintain the quality standards represented in their profile; and not engage in deceptive pricing or fraudulent trade practices.`,
  },
  {
    title: '7. Fees & Payments',
    content: `BulkSkart charges subscription fees to suppliers for access to premium features including RFQ responses and buyer contact details. Buyers can use the platform for free. Payment terms are outlined in the pricing page. All fees are non-refundable unless stated otherwise. Razorpay processes payments as the payment gateway partner.`,
  },
  {
    title: '8. Prohibited Activities',
    content: `You must not: post false or misleading information; engage in price manipulation or bid rigging; send unsolicited communications; attempt to circumvent the platform for transactions after initial introductions; upload malicious code; or violate any applicable laws including the IT Act 2000 and Consumer Protection Act 2019.`,
  },
  {
    title: '9. Intellectual Property',
    content: `All content, trademarks, logos, and platform features are owned by Tech Pod AI Database Private Limited. Users retain ownership of content they submit but grant BulkSkart a non-exclusive licence to use, display, and distribute such content for platform operations and marketing.`,
  },
  {
    title: '10. Limitation of Liability',
    content: `To the maximum extent permitted by law, BulkSkart shall not be liable for any indirect, incidental, or consequential damages arising from platform use, trade disputes, or third-party actions. Our total liability in any matter shall not exceed the fees paid by you in the preceding 3 months.`,
  },
  {
    title: '11. Dispute Resolution',
    content: `Disputes between buyers and suppliers should first be raised through BulkSkart's Dispute Centre. Unresolved disputes shall be subject to arbitration under the Arbitration & Conciliation Act 1996, with venue in Bangalore, Karnataka. These terms are governed by Indian law.`,
  },
  {
    title: '12. Modifications',
    content: `We reserve the right to update these Terms at any time. Material changes will be communicated via email and platform notification. Continued use after changes constitutes acceptance of the updated Terms.`,
  },
  {
    title: '13. Contact',
    content: `For questions about these Terms, contact us at info@bulkskart.com or write to: BulkSkart, India.`,
  },
];

export default function TermsPage() {
  return (
    <>
      <PageMeta
        title="Terms & Conditions — BulkSkart"
        description="Read BulkSkart's Terms & Conditions governing the use of our B2B bulk trade marketplace operated by Tech Pod AI Database Private Limited."
        keywords="BulkSkart terms, B2B marketplace terms of service, Tech Pod AI terms"
        canonical="/terms"
        ogType="website"
        breadcrumbs={[
          { name: 'Home', item: '/' },
          { name: 'Terms & Conditions', item: '/terms' },
        ]}
      />
      <Header />

      <section className="bg-[#C94400] text-white py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1 mb-5">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-bold text-white/80 uppercase tracking-widest">Legal</span>
          </div>
          <h1 className="text-[26px] md:text-[36px] font-black leading-tight mb-3">Terms & Conditions</h1>
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
              <div className="text-sm font-semibold text-foreground mb-1">Questions about these Terms?</div>
              <p className="text-sm text-muted-foreground">Email us at <a href="mailto:info@bulkskart.com" className="text-primary hover:underline">info@bulkskart.com</a> and we'll respond within 2 business days.</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
