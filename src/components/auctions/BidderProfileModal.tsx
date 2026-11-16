import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TrendingUp, Phone, Clock, Hash, Info } from 'lucide-react';
import ProtectedContact from '@/components/common/ProtectedContact';

/** One bid this bidder placed in the auction being viewed (straight from auction_bids). */
export interface BidderBid {
  id: string;
  bid_amount: number;
  quantity: number;
  timestamp: string;
  status: 'accepted' | 'outbid' | 'winning';
  contact_phone?: string;
}

interface BidderProfileModalProps {
  bidderName: string | null;
  /** This bidder's bids in this auction, newest first. */
  bids?: BidderBid[];
  quantityUnit?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPostOwner?: boolean;
}

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/**
 * Shows what this auction actually knows about a bidder: the name they bid
 * under and the bids they placed here. Nothing else is shown, because nothing
 * else about them is recorded on the bid.
 */
export default function BidderProfileModal({
  bidderName,
  bids = [],
  quantityUnit = 'unit',
  open,
  onOpenChange,
  isPostOwner = false
}: BidderProfileModalProps) {
  if (!bidderName) return null;

  const name = bidderName
    .replace(/\s*\(You\)/gi, '')
    .replace(/\s*\(Your Active Bid\)/gi, '')
    .trim() || 'Bidder';
  const best = bids.reduce<number | null>((m, b) => (m === null || b.bid_amount > m ? b.bid_amount : m), null);
  const leading = bids.some((b) => b.status === 'winning');
  const phone = bids.find((b) => b.contact_phone)?.contact_phone;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg p-0 overflow-hidden rounded-3xl border border-border">
        <div className="bg-gradient-to-r from-zinc-900 via-slate-900 to-black text-white p-5 sm:p-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center shadow-lg shrink-0">
              {name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold text-white truncate">{name}</DialogTitle>
              <DialogDescription className="text-xs text-zinc-400 mt-0.5">
                {leading ? 'Holds the leading bid in this auction' : 'Bidder in this auction'}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 text-center">
              <div className="flex items-center justify-center gap-1 text-primary mb-1">
                <Hash className="w-4 h-4" />
                <span className="font-bold text-sm text-foreground">{bids.length}</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold">Bids here</div>
            </div>
            <div className="p-3 rounded-2xl bg-muted/40 border border-border/60 text-center">
              <div className="flex items-center justify-center gap-1 text-primary mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="font-bold text-sm text-foreground">
                  {best === null ? '—' : `${rupees(best)}/${quantityUnit}`}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground font-semibold">Best bid</div>
            </div>
          </div>

          {bids.length > 0 && (
            <div className="rounded-2xl border border-border/60 divide-y divide-border/60 text-xs max-h-48 overflow-y-auto">
              {bids.map((b) => (
                <div key={b.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="flex items-center gap-1.5 text-muted-foreground min-w-0">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{b.timestamp} · {b.quantity.toLocaleString('en-IN')} {quantityUnit}</span>
                  </span>
                  <span className="font-bold text-foreground shrink-0">{rupees(b.bid_amount)}/{quantityUnit}</span>
                </div>
              ))}
            </div>
          )}

          {phone && (
            <div className="p-3 rounded-2xl bg-muted/20 border border-border/50 flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground flex items-center gap-2 shrink-0">
                <Phone className="w-4 h-4 text-primary" /> Bidding contact
              </span>
              <ProtectedContact
                phone={phone}
                contactType="bidder"
                variant="inline"
                showActions={true}
                isPostOwner={isPostOwner}
              />
            </div>
          )}

          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-[11px] text-muted-foreground flex items-start gap-2">
            <Info className="w-4 h-4 text-primary shrink-0 mt-px" />
            <span>Only the bids placed in this auction are shown. Ask the bidder for company documents before you award an order.</span>
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/20 border-t border-border flex justify-end">
          <Button size="sm" onClick={() => onOpenChange(false)} className="text-xs font-semibold px-5">
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
