import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, CheckCircle, ShieldAlert, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/db/supabase';

interface ReportItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: 'product' | 'company' | 'requirement' | 'auction';
  targetId: string;
  targetTitle: string;
}

const REPORT_REASONS = [
  { value: 'counterfeit', label: 'Counterfeit or Fake Product' },
  { value: 'fraud', label: 'Fraudulent Supplier / Scam Attempt' },
  { value: 'misleading_pricing', label: 'Incorrect Specifications or Misleading Price' },
  { value: 'ip_infringement', label: 'Intellectual Property / Trademark Violation' },
  { value: 'prohibited_goods', label: 'Prohibited, Hazardous or Restricted Goods' },
  { value: 'abusive_spam', label: 'Spam, Abusive or Inappropriate Content' },
  { value: 'other', label: 'Other Regulatory or Policy Violation' },
];

export default function ReportItemModal({
  open,
  onOpenChange,
  targetType,
  targetId,
  targetTitle,
}: ReportItemModalProps) {
  const { user } = useAuth();
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) {
      toast.error('Please select a violation reason.');
      return;
    }
    if (!notes.trim() || notes.trim().length < 10) {
      toast.error('Please provide at least 10 characters describing the issue.');
      return;
    }

    // Signed-in visitors: the report is saved for the BulkSkart team (Admin reports).
    // Visitors who are not signed in: their e-mail app opens with the report ready to send to us.
    if (!user) {
      const subject = `Report: ${targetType} "${targetTitle}"`;
      const body = `${targetType}: ${targetTitle}\nID: ${targetId}\nPage: ${window.location.href}\n\nReason: ${reason}\n\nDetails:\n${notes.trim()}\n\nReply to: ${contactEmail || ''}`;
      window.location.href = `mailto:info@bulkskart.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      setTicketId('');
      setSubmitted(true);
      return;
    }

    setLoading(true);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetId);
    const { data, error } = await supabase
      .from('reports')
      .insert({
        reporter_id: user.id,
        reason,
        description: `[${targetType}] ${targetTitle} (${targetId})\n\n${notes.trim()}`,
        reported_product_id: targetType === 'product' && isUuid ? targetId : null,
        reported_company_id: targetType === 'company' && isUuid ? targetId : null,
      })
      .select('id')
      .maybeSingle();
    setLoading(false);
    if (error) {
      toast.error('Your report could not be sent. Please try again, or e-mail info@bulkskart.com.');
      return;
    }
    const reference = String(data?.id ?? '').slice(0, 8).toUpperCase();
    setTicketId(reference);
    setSubmitted(true);
    toast.success(reference ? `Report sent (Ref #${reference}).` : 'Report sent.');
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setSubmitted(false);
      setReason('');
      setNotes('');
      setTicketId('');
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg bg-[#1A0C05] border-[#2A2A2A] text-white p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="mb-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF5A00]/15 border border-[#FF5A00]/30 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5 text-[#FF7A2E]" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-white">
                Report {targetType === 'company' ? 'Supplier' : 'Product'}
              </DialogTitle>
              <DialogDescription className="text-xs text-neutral-400 mt-0.5">
                BulkSkart Trust &amp; Safety Compliance Division
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {submitted ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#FF5A00]/20 border border-[#FF5A00]/40 text-[#FF7A2E] flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white mb-1">{ticketId ? 'Report sent' : 'Send the e-mail to finish'}</h3>
              <p className="text-xs text-slate-300 max-w-sm mx-auto">
                {ticketId
                  ? 'Thank you. The BulkSkart team will review your report.'
                  : 'Your e-mail app opened with the report filled in. Send it to info@bulkskart.com and we will review it. Signed-in users can report directly.'}
              </p>
              {ticketId && (
                <div className="mt-3 inline-block px-3 py-1.5 rounded-lg bg-[#0A0A0A]/80 border border-[#2A2A2A] text-xs text-slate-300 font-mono">
                  Reference: <span className="text-[#FF5A1F] font-bold">{ticketId}</span>
                </div>
              )}
            </div>
            <div className="pt-2">
              <Button
                onClick={handleClose}
                className="w-full bg-[#C94400] hover:bg-[#e04f1a] text-white font-semibold text-xs h-10 rounded-xl"
              >
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="p-3 rounded-xl bg-[#0A0A0A]/60 border border-[#2A2A2A] text-xs">
              <span className="text-neutral-400 block mb-0.5">Target Entity:</span>
              <p className="font-semibold text-white truncate">{targetTitle}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Reason for reporting <span className="text-[#FF7A2E]">*</span>
              </label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="w-full bg-[#070D1F] border-[#2A2A2A] text-slate-200 text-xs h-10 rounded-xl">
                  <SelectValue placeholder="Select a violation category..." />
                </SelectTrigger>
                <SelectContent className="bg-[#1A0C05] border-[#2A2A2A] text-slate-200 text-xs">
                  {REPORT_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value} className="hover:bg-[#0A0A0A] cursor-pointer py-2">
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Details &amp; Evidence <span className="text-[#FF7A2E]">*</span>
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Please describe why this listing violates BulkSkart policies (e.g., inaccurate specs, fake certification, price gouging)..."
                className="bg-[#070D1F] border-[#2A2A2A] text-slate-200 text-xs rounded-xl min-h-[90px] focus:ring-1 focus:ring-[#FF5A1F]"
              />
              <span className="text-[10px] text-neutral-400">Min 10 characters</span>
            </div>

            {!user && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Your Contact Email (for updates)
                </label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="yourname@company.com"
                  className="bg-[#070D1F] border-[#2A2A2A] text-slate-200 text-xs h-10 rounded-xl"
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="border-[#2A2A2A] bg-transparent text-slate-300 hover:bg-[#0A0A0A] text-xs h-10 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[#B33D00] hover:bg-[#B33D00] text-white font-semibold text-xs h-10 rounded-xl px-5"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Submitting...
                  </>
                ) : (
                  'Submit Report'
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
