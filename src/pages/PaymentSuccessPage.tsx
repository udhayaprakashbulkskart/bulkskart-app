import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import MainLayout from '@/components/layouts/MainLayout';
import { Button } from '@/components/ui/button';
import { CheckCircle, ArrowRight, LayoutDashboard } from 'lucide-react';
import PageMeta from '@/components/common/PageMeta';

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const plan = searchParams.get('plan') ?? '';

  return (
    <MainLayout>
      <PageMeta
        title="Payment Confirmed — Supplier Subscription | BulkSkart"
        description="Your BulkSkart supplier subscription is now active. Start responding to bulk RFQs, connect with buyers and grow your export business today."
        keywords="payment confirmed, supplier subscription, BulkSkart plan, activate account"
      />
      <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-120px)] px-4 py-12">
        <div className="bs-glass w-full max-w-md rounded-3xl p-8 text-center">
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-green-100 border-2 border-green-300 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Payment Successful!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {plan ? `Your ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan is now active. ` : ''}
                You can start contacting buyers immediately.
              </p>
            </div>
            <div className="w-full bg-card border border-border rounded-xl p-4 text-left space-y-2">
              {[
                'Direct message access to buyers unlocked',
                'Your subscription is active for 30 days',
                'RFQ lead quota reset — ready to use',
              ].map(item => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 w-full">
              <Link to="/requirements">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 gap-2">
                  Browse Live Requirements <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to="/dashboard/supplier">
                <Button variant="ghost" className="w-full border border-border text-muted-foreground gap-2">
                  <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
