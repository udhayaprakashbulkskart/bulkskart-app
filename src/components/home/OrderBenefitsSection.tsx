import { Suspense, useEffect, useRef, useState } from 'react';
import { lazyRetry } from '@/lib/lazyRetry';
import FreeDeliveryCard from '@/components/home/FreeDeliveryCard';
import SectionHeader from '@/components/home/SectionHeader';

const LoanCalculator = lazyRetry(() => import('@/components/home/LoanCalculator'));

function CalculatorSkeleton() {
  return (
    <div className="h-full min-h-[520px] rounded-3xl border border-neutral-700/80 bg-neutral-950/70 p-6" aria-hidden>
      <div className="h-6 w-40 rounded-full bg-neutral-800" />
      <div className="mt-4 h-8 w-56 rounded-lg bg-neutral-800" />
      <div className="mt-6 h-2 w-full rounded-full bg-neutral-800" />
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="h-10 rounded-md bg-neutral-800" />
        <div className="h-10 rounded-md bg-neutral-800" />
        <div className="h-10 rounded-md bg-neutral-800" />
      </div>
      <div className="mt-6 h-36 rounded-2xl bg-neutral-800/80" />
    </div>
  );
}

export default function OrderBenefitsSection() {
  const slotRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = slotRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setReady(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setReady(true);
          observer.disconnect();
        }
      },
      { rootMargin: '640px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      id="order-benefits"
      className="relative scroll-mt-24 border-y border-white/10 bg-[#111111] py-8 sm:py-12"
    >
      <div className="pointer-events-none absolute -left-10 top-0 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-56 w-56 rounded-full bg-[#FF5A00]/10 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 sm:px-5 md:px-6">
        <div className="mb-6 sm:mb-8">
          <SectionHeader
            tone="dark"
            eyebrow="Why buyers order here"
            title="Free delivery, and a loan calculator for the order"
            subtitle="Delivery is free on every order. Check the monthly cost, then submit how much loan you need and your contact details."
          />
        </div>

        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2 lg:gap-5">
          <FreeDeliveryCard tone="landing" />
          <div ref={slotRef} className="min-h-[520px]">
            {ready ? (
              <Suspense fallback={<CalculatorSkeleton />}>
                <LoanCalculator tone="landing" />
              </Suspense>
            ) : (
              <CalculatorSkeleton />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
