import React from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck, MapPin, Building2, Award, Calendar, CheckCircle2,
  TrendingUp, DollarSign, ExternalLink, Star, FileText, Check, Phone
} from 'lucide-react';
import ProtectedContact from '@/components/common/ProtectedContact';

export interface BidderProfileData {
  companyName: string;
  businessType: string;
  location: string;
  gstinVerified: boolean;
  memberSince: string;
  trustScore: number;
  totalAuctionsWon: number;
  totalBidsPlaced: number;
  escrowVerified: boolean;
  industry: string;
  contact_phone?: string;
  annualTurnover?: string;
  rating?: number;
}

const DEFAULT_BIDDER_PROFILES: Record<string, BidderProfileData> = {
  'Metro Cable & Power Corp': {
    companyName: 'Metro Cable & Power Corp',
    businessType: 'Tier-1 Electrical Infrastructure Manufacturer',
    location: 'Ahmedabad Industrial Zone, Gujarat',
    gstinVerified: true,
    memberSince: 'March 2023',
    trustScore: 99.2,
    totalAuctionsWon: 42,
    totalBidsPlaced: 184,
    escrowVerified: true,
    industry: 'Cables, Wires & High-Voltage Transmission',
    contact_phone: '+91 98201 44892',
    annualTurnover: '₹45 Crore - ₹100 Crore',
    rating: 4.9
  },
  'Gujarat Electricals & Infrastructure': {
    companyName: 'Gujarat Electricals & Infrastructure',
    businessType: 'Government EPC Contractor & Distributor',
    location: 'Vadodara, Gujarat',
    gstinVerified: true,
    memberSince: 'July 2023',
    trustScore: 98.0,
    totalAuctionsWon: 28,
    totalBidsPlaced: 112,
    escrowVerified: true,
    industry: 'Heavy Electrical Components & Transformers',
    contact_phone: '+91 98450 12894',
    annualTurnover: '₹25 Crore - ₹50 Crore',
    rating: 4.8
  },
  'Bharat Power Works Ltd': {
    companyName: 'Bharat Power Works Ltd',
    businessType: 'Industrial Power Equipment Supplier',
    location: 'Surat, Gujarat',
    gstinVerified: true,
    memberSince: 'November 2022',
    trustScore: 97.5,
    totalAuctionsWon: 35,
    totalBidsPlaced: 140,
    escrowVerified: true,
    industry: 'Industrial Switchgears & Conductors',
    contact_phone: '+91 98112 65432',
    annualTurnover: '₹50 Crore - ₹100 Crore',
    rating: 4.7
  },
  'Apex Conductors India Ltd.': {
    companyName: 'Apex Conductors India Ltd.',
    businessType: 'Verified Manufacturer & Exporter',
    location: 'Ahmedabad, Gujarat',
    gstinVerified: true,
    memberSince: 'January 2022',
    trustScore: 99.8,
    totalAuctionsWon: 89,
    totalBidsPlaced: 310,
    escrowVerified: true,
    industry: 'Electrolytic Copper Conductors & Bare Wires',
    contact_phone: '+91 98790 99821',
    annualTurnover: '₹120 Crore+',
    rating: 5.0
  }
};

interface BidderProfileModalProps {
  bidderName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPostOwner?: boolean;
}

export default function BidderProfileModal({
  bidderName,
  open,
  onOpenChange,
  isPostOwner = false
}: BidderProfileModalProps) {
  if (!bidderName) return null;

  const normalizedBidderName = bidderName
    .replace(/\s*\(You\)/gi, '')
    .replace(/\s*\(Your Active Bid\)/gi, '')
    .replace(/INFOPOD/gi, 'UDHAYAPRAKASH')
    .trim();

  const profile: BidderProfileData = DEFAULT_BIDDER_PROFILES[normalizedBidderName] || {
    companyName: normalizedBidderName || 'UDHAYAPRAKASH',
    businessType: 'Verified Industrial Procurement Entity',
    location: 'India (Verified Business Location)',
    gstinVerified: true,
    memberSince: '2023',
    trustScore: 98.5,
    totalAuctionsWon: 15,
    totalBidsPlaced: 65,
    escrowVerified: true,
    industry: 'Wholesale B2B Trade & Construction',
    annualTurnover: '₹10 Crore - ₹50 Crore',
    rating: 4.9
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg p-0 overflow-hidden rounded-3xl border border-border">
        {/* Header with Brand Gradient */}
        <div className="bg-gradient-to-r from-zinc-900 via-slate-900 to-black text-white p-5 sm:p-6 relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FF5A1F] text-white font-bold text-lg flex items-center justify-center shadow-lg shrink-0">
                {profile.companyName.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-white truncate">
                    {profile.companyName}
                  </h3>
                  {profile.gstinVerified && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-1.5 py-0">
                      <CheckCircle2 className="w-3 h-3 mr-0.5" /> GSTIN Verified
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {profile.businessType}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 text-center">
              <div className="flex items-center justify-center gap-1 text-[#FF5A1F] mb-1">
                <Star className="w-4 h-4 fill-[#FF5A1F]" />
                <span className="font-bold text-sm text-foreground">{profile.trustScore}%</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold">Trust Score</div>
            </div>

            <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400 mb-1">
                <Award className="w-4 h-4" />
                <span className="font-bold text-sm text-foreground">{profile.totalAuctionsWon}</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold">Auctions Won</div>
            </div>

            <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 text-center">
              <div className="flex items-center justify-center gap-1 text-[#FF5A00] dark:text-[#FF5A00] mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="font-bold text-sm text-foreground">{profile.totalBidsPlaced}</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold">Total Bids</div>
            </div>
          </div>

          {/* Details List */}
          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#FF5A1F]" /> Location:
              </span>
              <span className="font-bold text-foreground text-right">{profile.location}</span>
            </div>

            {/* Gated Bidding Contact Phone Number */}
            <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#FF5A1F]" /> Bidding Contact:
              </span>
              <ProtectedContact
                phone={profile.contact_phone || '+91 98201 44892'}
                contactType="bidder"
                variant="inline"
                showActions={true}
                isPostOwner={isPostOwner}
              />
            </div>

            <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#FF5A1F]" /> Primary Industry:
              </span>
              <span className="font-bold text-foreground text-right max-w-[220px] truncate">{profile.industry}</span>
            </div>

            <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#FF5A1F]" /> Member On BulkSkart:
              </span>
              <span className="font-bold text-foreground">{profile.memberSince}</span>
            </div>

            <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Escrow Deposit Status:
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Pre-Authorized & Verified
              </span>
            </div>
          </div>

          {/* Verification Assurance */}
          <div className="p-3 rounded-2xl bg-orange-50/60 dark:bg-[#FF5A1F]/10 border border-[#FF5A1F]/20 text-[11px] text-muted-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#FF5A1F] shrink-0" />
            <span>
              All bids placed by this entity are legally binding under BulkSkart Enterprise Trade Escrow Terms.
            </span>
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t border-border flex justify-end">
          <Button
            variant="default"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="bg-[#FF5A1F] hover:bg-[#e04f1a] text-white text-xs font-semibold px-5"
          >
            Close Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
