import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calculator,
  Globe,
  Receipt,
  ShieldCheck,
  CheckCircle2,
  Info,
} from 'lucide-react';
import {
  GLOBAL_COUNTRIES,
  calculateCountryChargesAndTaxes,
  formatCountryAmount,
  type CountryTaxBreakdown,
} from '@/lib/countryTaxUtils';

interface CountryChargesFeesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  baseAmount: number;
  initialCountryCode?: string;
  itemTitle?: string;
}

export default function CountryChargesFeesModal({
  open,
  onOpenChange,
  baseAmount,
  initialCountryCode = 'IN',
  itemTitle = 'B2B Trade Transaction',
}: CountryChargesFeesModalProps) {
  const [selectedCountry, setSelectedCountry] = useState(initialCountryCode);
  const [isIntraState, setIsIntraState] = useState(false);

  const breakdown: CountryTaxBreakdown = calculateCountryChargesAndTaxes(
    baseAmount,
    selectedCountry,
    isIntraState
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-xl bg-[#070D1F] border-[#2A2A2A] text-white p-5 sm:p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#FF5A1F]/15 border border-[#FF5A1F]/30 flex items-center justify-center shrink-0">
              <Calculator className="w-5 h-5 text-[#FF5A1F]" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Country-Wise Charges, Fees &amp; GST/VAT
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-400">
                Transparent statutory taxation and marketplace fee breakdown
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ── Country Selector ── */}
        <div className="bg-[#0B1528] border border-[#2A2A2A] rounded-xl p-3.5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Globe className="w-4 h-4 text-[#00D2FF]" />
              <span>Select Destination / Jurisdiction:</span>
            </div>
            <div className="w-full sm:w-60">
              <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                <SelectTrigger className="w-full bg-[#060B18] border-[#2A2A2A] text-white text-xs h-9 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#070D1F] border-[#2A2A2A] text-slate-200 text-xs">
                  {GLOBAL_COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="hover:bg-[#0A0A0A] cursor-pointer py-1.5">
                      <span className="mr-2">{c.flag}</span>
                      <span>{c.name} ({c.currency})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCountry === 'IN' && (
            <div className="flex items-center justify-between pt-1 border-t border-[#2A2A2A]/80 text-xs text-neutral-400">
              <span>GST Transaction Type:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsIntraState(false)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                    !isIntraState
                      ? 'bg-[#FF5A1F]/20 border-[#FF5A1F] text-white font-bold'
                      : 'border-[#2A2A2A] text-neutral-400 hover:text-white'
                  }`}
                >
                  Inter-State (18% IGST)
                </button>
                <button
                  type="button"
                  onClick={() => setIsIntraState(true)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                    isIntraState
                      ? 'bg-[#FF5A1F]/20 border-[#FF5A1F] text-white font-bold'
                      : 'border-[#2A2A2A] text-neutral-400 hover:text-white'
                  }`}
                >
                  Intra-State (9% CGST + 9% SGST)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Itemized Line-Item Charges Breakdown ── */}
        <div className="space-y-2 py-1">
          <div className="text-xs font-semibold text-neutral-400 px-1">
            Itemized Statutory Breakdown for: <span className="text-white">{itemTitle}</span>
          </div>

          <div className="rounded-xl bg-[#0B1528]/80 border border-[#2A2A2A] divide-y divide-[#2A2A2A]/60 text-xs">
            {/* Base Amount */}
            <div className="flex items-center justify-between p-3">
              <span className="text-slate-300">Base Net Value</span>
              <span className="font-bold text-white text-sm">
                {formatCountryAmount(breakdown.baseAmount, breakdown.currencySymbol)}
              </span>
            </div>

            {/* Platform & Escrow Fee */}
            <div className="flex items-center justify-between p-3">
              <div>
                <span className="text-slate-300 block">Marketplace Escrow &amp; Platform Fee</span>
                <span className="text-[10px] text-neutral-400">
                  {breakdown.platformFeePercent}% standard tier handling
                </span>
              </div>
              <span className="font-semibold text-slate-200">
                {formatCountryAmount(breakdown.totalPlatformFees, breakdown.currencySymbol)}
              </span>
            </div>

            {/* Taxes (GST or VAT or Sales Tax) */}
            <div className="p-3 bg-[#0A0A0A]/40">
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-[#00D2FF] font-semibold block">{breakdown.taxName}</span>
                  <span className="text-[10px] text-neutral-400">
                    Statutory Rate: {breakdown.taxRatePercent}%
                  </span>
                </div>
                <span className="font-bold text-[#00D2FF]">
                  {formatCountryAmount(breakdown.taxAmount, breakdown.currencySymbol)}
                </span>
              </div>

              {/* GST Split if India */}
              {breakdown.gstSplit && (
                <div className="pl-3 border-l-2 border-[#FF5A00] space-y-1 mt-2 text-[11px] text-neutral-400">
                  {breakdown.gstSplit.igstAmount !== undefined && breakdown.gstSplit.igstPercent ? (
                    <div className="flex justify-between">
                      <span>Integrated GST (IGST {breakdown.gstSplit.igstPercent}%):</span>
                      <span className="text-slate-300">
                        {formatCountryAmount(breakdown.gstSplit.igstAmount, breakdown.currencySymbol)}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span>Central GST (CGST {breakdown.gstSplit.cgstPercent}%):</span>
                        <span className="text-slate-300">
                          {formatCountryAmount(breakdown.gstSplit.cgstAmount, breakdown.currencySymbol)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>State GST (SGST {breakdown.gstSplit.sgstPercent}%):</span>
                        <span className="text-slate-300">
                          {formatCountryAmount(breakdown.gstSplit.sgstAmount, breakdown.currencySymbol)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Cross-border Customs / Port Handling if applicable */}
            {(breakdown.customsDutyAmount > 0 || breakdown.portClearanceFee > 0) && (
              <div className="flex items-center justify-between p-3">
                <div>
                  <span className="text-slate-300 block">Customs &amp; Port Entry Handling</span>
                  <span className="text-[10px] text-neutral-400">Border inspection &amp; bill of entry</span>
                </div>
                <span className="font-semibold text-slate-200">
                  {formatCountryAmount(
                    breakdown.customsDutyAmount + breakdown.portClearanceFee,
                    breakdown.currencySymbol
                  )}
                </span>
              </div>
            )}

            {/* Total Landed Cost */}
            <div className="flex items-center justify-between p-3.5 bg-gradient-to-r from-[#FF5A1F]/15 to-transparent border-t border-[#2A2A2A]">
              <div>
                <span className="text-sm font-black text-white block">Total Landed Amount</span>
                <span className="text-[10px] text-[#FF5A1F] font-semibold">Includes all taxes, fees &amp; statutory levies</span>
              </div>
              <span className="text-lg font-black text-[#FF5A1F]">
                {formatCountryAmount(breakdown.totalPayable, breakdown.currencySymbol)}
              </span>
            </div>
          </div>
        </div>

        {/* Statutory Note */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-[#0A0A0A]/60 border border-[#2A2A2A] text-[11px] text-neutral-400">
          <Info className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="text-slate-300">{breakdown.countryName} Compliance: </strong>
            {breakdown.statutoryNote} Tax invoice with downloadable GSTIN/VAT receipt issued upon payment.
          </p>
        </div>

        <div className="pt-2">
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full bg-[#C94400] hover:bg-[#e04f1a] text-white font-semibold text-xs h-10 rounded-xl"
          >
            Close Calculator
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
