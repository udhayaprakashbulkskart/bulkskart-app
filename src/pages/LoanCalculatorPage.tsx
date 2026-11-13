import { Link } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import PageMeta from '@/components/common/PageMeta';
import FreeDeliveryCard from '@/components/home/FreeDeliveryCard';
import LoanCalculator from '@/components/home/LoanCalculator';
import { Truck, Calculator, ArrowRight } from 'lucide-react';

export default function LoanCalculatorPage() {
  return (
    <MainLayout>
      <PageMeta
        title="Free Delivery & Order Loan Calculator | BulkSkart"
        description="Every order on BulkSkart includes free delivery. Use the order loan calculator to estimate the monthly installment for a bulk purchase before you place it."
        keywords="free delivery, bulk order loan calculator, EMI calculator, wholesale order finance, BulkSkart delivery"
        canonical="/loan-calculator"
        ogType="website"
        breadcrumbs={[
          { name: 'Home', item: '/' },
          { name: 'Free Delivery & Loan Calculator', item: '/loan-calculator' },
        ]}
        faq={[
          {
            question: 'Is delivery free on BulkSkart orders?',
            answer: 'Yes. Every order placed on BulkSkart includes free delivery. No delivery fee is added at checkout, for any order value or category.',
          },
          {
            question: 'What does the order loan calculator show?',
            answer: 'It estimates a monthly installment from the order value, down payment, annual interest rate, and tenure. The result is a planning figure, not a loan approval. Delivery on the order remains free.',
          },
        ]}
      />

      <div className="mx-auto w-full max-w-[1400px] px-4 md:px-6 py-8 md:py-12">
        <div className="mb-6 max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#FF5A00]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#FF5A00]">
            <Truck className="h-3.5 w-3.5" />
            <Calculator className="h-3.5 w-3.5" />
            Buyer benefits
          </div>
          <h1 className="mt-3 text-3xl md:text-4xl font-black tracking-tight text-foreground">
            Free delivery on every order
          </h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground leading-relaxed">
            Delivery is included on all orders placed on this platform. Use the calculator to see what a bulk order costs per month, then place the order or request quotes from verified suppliers.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
          <FreeDeliveryCard />
          <LoanCalculator />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { step: '1', title: 'Set the order value', text: 'Use a preset or type the bulk order you want to place.' },
            { step: '2', title: 'Check the monthly cost', text: 'Adjust rate, down payment, and tenure. The installment updates instantly.' },
            { step: '3', title: 'Place the order', text: 'Delivery stays free. Browse products or post a requirement to get quotes.' },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#FF5A00]/15 text-sm font-black text-[#FF5A00]">
                {item.step}
              </div>
              <p className="text-sm font-bold text-foreground">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            to="/products"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#C94400] px-5 text-sm font-bold text-white"
          >
            Browse products
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/#order-benefits" className="text-sm font-semibold text-[#FF5A00] hover:underline">
            Back to the landing page
          </Link>
        </div>
      </div>
    </MainLayout>
  );
}
