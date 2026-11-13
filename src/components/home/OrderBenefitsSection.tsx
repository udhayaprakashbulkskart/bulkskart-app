import { Suspense, useEffect, useRef, useState } from 'react';
import { lazyRetry } from '@/lib/lazyRetry';
import FreeDeliveryCard from '@/components/home/FreeDeliveryCard';

const LoanCalculator = lazyRetry(() => import('@/components/home/LoanCalculator'));

function CalculatorSkeleton() {
  return (
    <div className="h-full min-h-[520px] rounded-3xl border border-[#2A2A2A]/80 bg-[#0A0A0A]/70 p-6" aria-hidden>
      <div className="h-6 w-40 rounded-full bg-[#0A0A0A]" />
      <div className="mt-4 h-8 w-56 rounded-lg bg-[#0A0A0A]" />
      <div className="mt-6 h-2 w-full rounded-full bg-[#0A0A0A]" />
      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="h-10 rounded-md bg-[#0A0A0A]" />
        <div className="h-10 rounded-md bg-[#0A0A0A]" />
        <div className="h-10 rounded-md bg-[#0A0A0A]" />
      </div>
      <div className="mt-6 h-36 rounded-2xl bg-[#0A0A0A]/80" />
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
      className="relative scroll-mt-24 border-y border-white/10 bg-[#0B0F17] py-8 sm:py-12"
    >
      <div className="pointer-events-none absolute -left-10 top-0 h-56 w-56 rounded-full bg-[#FF5A00]/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 bottom-0 h-56 w-56 rounded-full bg-[#FF5A00]/10 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 sm:px-5 md:px-6">
        <div className="mb-5 sm:mb-6 max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#FF5A00]">Why buyers order here</p>
          <h2 className="mt-1 text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white">
            Free delivery, and a loan calculator for the order
          </h2>
          <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">
            Delivery is free on every order. Check the monthly cost, then submit how much loan you need and your contact details.
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 lg:gap-5">
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
