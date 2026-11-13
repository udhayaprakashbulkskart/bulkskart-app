import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import {
  Volume2,
  BellRing,
  Package,
  MessageSquare,
  Flame,
  CreditCard,
  Truck,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function NotificationPreferencesModal({ open, onOpenChange }: Props) {
  const { prefs, updatePreferences } = useNotificationPreferences();

  const handleTestChime = () => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
      toast.success('Test sound played');
    } catch {
      toast.info('Audio context not available');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg p-6 bg-card border-border rounded-2xl shadow-2xl">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
            <BellRing className="w-5 h-5 text-primary" />
            Notification Preferences
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Customize how and when you receive real-time notifications on BulkSkart.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 divide-y divide-border/60">
          {/* General Delivery Channels */}
          <div className="space-y-3 pt-1">
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Alert Delivery Channels</p>

            {/* Sound Chime */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <Label htmlFor="sound-toggle" className="text-xs font-semibold text-foreground cursor-pointer">
                    Audio Chime Alert
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Play a gentle audio ping when a new notification arrives
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {prefs.soundEnabled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleTestChime}
                    className="h-7 px-2 text-[10px] font-semibold text-primary hover:bg-primary/10"
                  >
                    Test
                  </Button>
                )}
                <Switch
                  id="sound-toggle"
                  checked={prefs.soundEnabled}
                  onCheckedChange={(checked) => updatePreferences({ soundEnabled: checked })}
                />
              </div>
            </div>

            {/* Toast Banners */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#FF5A00]/10 text-[#FF5A00] flex items-center justify-center shrink-0 mt-0.5">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <Label htmlFor="toast-toggle" className="text-xs font-semibold text-foreground cursor-pointer">
                    Floating Toast Alerts
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Show interactive popup toasts at the top-right corner
                  </p>
                </div>
              </div>
              <Switch
                id="toast-toggle"
                checked={prefs.toastEnabled}
                onCheckedChange={(checked) => updatePreferences({ toastEnabled: checked })}
              />
            </div>
          </div>

          {/* Category Alerts */}
          <div className="space-y-3 pt-4">
            <p className="text-xs font-bold text-foreground uppercase tracking-wider">Alert Categories</p>

            {/* RFQ Matches */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <Flame className="w-4 h-4 text-orange-500 shrink-0" />
                <div>
                  <Label htmlFor="rfq-toggle" className="text-xs font-medium text-foreground cursor-pointer">
                    RFQ Match & Sourcing Alerts
                  </Label>
                  <p className="text-[11px] text-muted-foreground">New buyer requirements matching your catalog</p>
                </div>
              </div>
              <Switch
                id="rfq-toggle"
                checked={prefs.rfqAlerts}
                onCheckedChange={(checked) => updatePreferences({ rfqAlerts: checked })}
              />
            </div>

            {/* Chat Messages */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-[#FF7A2E] shrink-0" />
                <div>
                  <Label htmlFor="msg-toggle" className="text-xs font-medium text-foreground cursor-pointer">
                    Direct Chat & Negotiation Messages
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Live messages from buyers and verified suppliers</p>
                </div>
              </div>
              <Switch
                id="msg-toggle"
                checked={prefs.messageAlerts}
                onCheckedChange={(checked) => updatePreferences({ messageAlerts: checked })}
              />
            </div>

            {/* Quotations */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4 text-[#FF5A00] shrink-0" />
                <div>
                  <Label htmlFor="quote-toggle" className="text-xs font-medium text-foreground cursor-pointer">
                    Quotation & Price Revisions
                  </Label>
                  <p className="text-[11px] text-muted-foreground">New quotes received, accepted, or revised</p>
                </div>
              </div>
              <Switch
                id="quote-toggle"
                checked={prefs.quoteAlerts}
                onCheckedChange={(checked) => updatePreferences({ quoteAlerts: checked })}
              />
            </div>

            {/* Order Milestones */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <Truck className="w-4 h-4 text-[#FF7A2E] shrink-0" />
                <div>
                  <Label htmlFor="order-toggle" className="text-xs font-medium text-foreground cursor-pointer">
                    Order Tracking & Milestones
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Production, dispatch, shipping, and delivery updates</p>
                </div>
              </div>
              <Switch
                id="order-toggle"
                checked={prefs.orderAlerts}
                onCheckedChange={(checked) => updatePreferences({ orderAlerts: checked })}
              />
            </div>

            {/* Subscription & Account Alerts */}
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <CreditCard className="w-4 h-4 text-[#FF7A2E] shrink-0" />
                <div>
                  <Label htmlFor="sub-toggle" className="text-xs font-medium text-foreground cursor-pointer">
                    Subscription & Account Reminders
                  </Label>
                  <p className="text-[11px] text-muted-foreground">Upgrade reminders, invoice notices, and plan status</p>
                </div>
              </div>
              <Switch
                id="sub-toggle"
                checked={prefs.subscriptionAlerts}
                onCheckedChange={(checked) => updatePreferences({ subscriptionAlerts: checked })}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-border flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-[#FF7A2E]" /> Preferences saved automatically
          </span>
          <Button
            size="sm"
            onClick={() => {
              onOpenChange(false);
              toast.success('Notification preferences updated');
            }}
            className="h-8 px-4 text-xs font-bold bg-[#C94400] text-primary-foreground"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
