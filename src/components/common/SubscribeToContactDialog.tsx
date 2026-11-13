import React from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Zap, Sparkles, Send, ArrowRight, Building2, FileText, CheckCircle2, Lock } from 'lucide-react';

export type SubscriptionReason = 'not_logged_in' | 'not_registered_business' | 'no_subscription' | 'quota_exceeded' | 'ai_matching_subscription' | 'quotation_subscription';

interface Props {
  open: boolean;
  onClose: () => void;
  reason?: SubscriptionReason;
}

const PLANS = [
  {
    tier: 'Starter',
    price: '₹2,500/mo',
    leads: '5 Post Responses/mo',
    features: ['5 Quotation Responses to Buyer RFQs', 'Direct Buyer Messaging', 'Standard Directory Listing'],
    color: 'border-border bg-muted/40',
    popular: false,
  },
  {
    tier: 'Business',
    price: '₹7,500/mo',
    leads: '50 Post Responses/mo',
    features: ['50 Quotation Responses to Live RFQs', 'Full AI Accessibility Suite (94%+ Spec Match)', '1-Click AI Quotation Generator', 'Verified Manufacturer Seal'],
    color: 'border-[#FF5A00]/60 bg-[#FF5A00]/5',
    popular: true,
  },
  {
    tier: 'Growth',
    price: '₹15,000/mo',
    leads: 'Unlimited Responses',
    features: ['UNLIMITED Quotation Responses (No limit)', 'Full AI Suite + Instant Matching', 'Top Priority Search Placement', 'Global Export Showcase'],
    color: 'border-border bg-muted/40',
    popular: false,
  },
];

const REGISTRATION_STEPS = [
  { icon: Building2, label: 'Complete your company profile' },
  { icon: FileText, label: 'Upload GST / IEC / Business registration doc' },
  { icon: CheckCircle2, label: 'Get verified & subscribe to start sending quotes' },
];

export default function SubscribeToContactDialog({ open, onClose, reason = 'no_subscription' }: Props) {
  const isLoggedOut = reason === 'not_logged_in';
  const isNotRegistered = reason === 'not_registered_business';
  const isQuotaExceeded = reason === 'quota_exceeded';
  const isAiMatching = reason === 'ai_matching_subscription';
  const isQuotation = reason === 'quotation_subscription';

  const title = isLoggedOut
    ? 'Login to Send Quotations & Messages'
    : isNotRegistered
    ? 'Register Your Business First'
    : isQuotaExceeded
    ? 'Monthly Lead Quota Reached'
    : isAiMatching
    ? 'Unlock AI Product Matching'
    : 'Active Subscription Required';

  const description = isLoggedOut
    ? 'Only registered and subscribed manufacturers can send quotations and message buyers. Sign in to your account to continue.'
    : isNotRegistered
    ? 'Please complete your business registration and verify GST/IEC to send formal quotations to buyers.'
    : isQuotaExceeded
    ? "You've reached your monthly post response quota (5 on Starter, 50 on Business). Upgrade your plan to send more quotations."
    : isAiMatching
    ? 'The ₹7,500 Business Package or ₹7,500 AI Accessibility Add-on unlocks AI-powered catalog matching, automated quote generation, and 50 live RFQ responses per month.'
    : 'Manufacturers can send formal quotations to Live Buying Requirements only with an active paid subscription plan.';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-card border-border text-foreground p-4 sm:p-6 rounded-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3 ${
            isNotRegistered
              ? 'bg-[#FF5A00]/15 border border-[#FF5A00]/30 text-[#FF7A2E]'
              : isAiMatching
              ? 'bg-[#FF5A00]/20 border border-[#FF5A00]/40 text-[#FF5A00]'
              : 'bg-[#FF5A00]/15 border border-[#FF5A00]/30 text-[#FF5A00]'
          }`}>
            {isNotRegistered ? (
              <Building2 className="w-6 h-6" />
            ) : isAiMatching ? (
              <Sparkles className="w-6 h-6" />
            ) : (
              <Lock className="w-6 h-6" />
            )}
          </div>
          <DialogTitle className="text-center text-foreground text-base sm:text-lg font-black">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground text-xs sm:text-sm">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Highlighted AI / Quotation Package Banner */}
        {(isAiMatching || isQuotation || reason === 'no_subscription') && (
          <div className="bg-gradient-to-r from-[#C94400]/20 via-[#C94400]/10 to-transparent border border-[#FF5A00]/40 rounded-xl p-3 sm:p-3.5 space-y-2 mt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#FF5A00]" />
                <span className="text-xs font-black text-foreground">Recommended: ₹7,500 Business Package</span>
              </div>
              <Badge className="bg-[#1A0C05] text-white border-none text-[10px] font-bold">
                AI Included
              </Badge>
            </div>
            <p className="text-[11px] text-foreground/80 leading-relaxed">
              Unlocks <strong>AI Product Matching</strong>, <strong>AI Quotation Generator</strong>, 50 monthly live RFQ buyer responses, and verified manufacturer badge.
            </p>
          </div>
        )}

        {/* Registration steps */}
        {isNotRegistered && (
          <div className="space-y-2 mt-2">
            {REGISTRATION_STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5">
                <div className="w-7 h-7 rounded-full bg-[#FF5A00]/20 border border-[#FF5A00]/30 flex items-center justify-center shrink-0">
                  <step.icon className="w-3.5 h-3.5 text-[#FF7A2E]" />
                </div>
                <span className="text-xs text-foreground font-medium">{step.label}</span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground text-center pt-1">
              After registration, subscribe to a plan to start sending quotations.
            </p>
          </div>
        )}

        {/* Subscription plans list */}
        {!isLoggedOut && !isNotRegistered && (
          <div className="space-y-2 mt-2">
            {PLANS.map(p => (
              <div
                key={p.tier}
                className={`rounded-xl border p-3 sm:p-3.5 transition-all ${p.color}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {p.popular && (
                      <Badge className="bg-[#C94400] text-white text-[10px] font-bold px-1.5 py-0.5 border-none">
                        AI Enabled
                      </Badge>
                    )}
                    <span className="text-xs sm:text-sm font-bold text-foreground">{p.tier} Plan</span>
                    <span className="text-[11px] text-muted-foreground">· {p.leads}</span>
                  </div>
                  <span className="text-xs sm:text-sm font-extrabold text-[#FF5A00]">{p.price}</span>
                </div>
                {p.popular && (
                  <div className="mt-2 pt-2 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px] text-foreground/80">
                    {p.features.map((feat, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-[#FF5A00] shrink-0" />
                        <span className="truncate">{feat}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mt-3">
          {isLoggedOut ? (
            <>
              <Link to="/auth?tab=supplier" onClick={onClose} className="w-full">
                <Button className="w-full bg-[#C94400] hover:bg-[#B33D00] text-white font-bold h-11 rounded-xl text-xs gap-2 shadow-lg">
                  Login / Register as Manufacturer <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={onClose}
                className="w-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted h-10 rounded-xl text-xs"
              >
                Cancel
              </Button>
            </>
          ) : isNotRegistered ? (
            <>
              <Link to="/dashboard/supplier/profile" onClick={onClose} className="w-full">
                <Button className="w-full bg-[#B33D00] hover:bg-[#B33D00] text-white font-bold h-11 rounded-xl text-xs gap-2">
                  Complete Business Registration <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={onClose}
                className="w-full border border-border text-muted-foreground hover:text-foreground hover:bg-muted h-10 rounded-xl text-xs"
              >
                Maybe Later
              </Button>
            </>
          ) : (
            <>
              <Link to="/pricing" onClick={onClose} className="w-full">
                <Button className="w-full bg-[#C94400] hover:bg-[#B33D00] text-white font-extrabold h-11 rounded-xl text-xs gap-2 shadow-lg shadow-[#FF5A00]/25">
                  <Sparkles className="w-4 h-4" />
                  {isAiMatching
                    ? 'Unlock AI Business Plan (₹7,500/mo) →'
                    : isQuotaExceeded
                    ? 'Upgrade Plan for More Responses →'
                    : 'Subscribe to Starter (₹2,500) or Business (₹7,500) →'}
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={onClose}
                className="w-full border border-white/15 text-white/70 hover:text-white hover:bg-white/5 h-10 rounded-xl text-xs"
              >
                Dismiss
              </Button>
            </>
          )}
        </div>

        {/* Trust Badges */}
        {!isLoggedOut && !isNotRegistered && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center">
            {[
              { icon: ShieldCheck, label: 'Verified Buyers' },
              { icon: Sparkles, label: 'AI Catalog Match' },
              { icon: Zap, label: 'Instant Lead Alerts' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1">
                <Icon className="w-3.5 h-3.5 text-[#FF5A00]" />
                <span className="text-[10px] text-white/60">{label}</span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
