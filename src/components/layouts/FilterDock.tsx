import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface FilterDockProps {
  children: React.ReactNode;
  activeCount?: number;
  title?: string;
}

/** Desktop shows filters inline. Phones open the same controls in a bottom sheet. */
export default function FilterDock({ children, activeCount = 0, title = 'Filters' }: FilterDockProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="hidden md:block">{children}</div>
      <div className="md:hidden">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full justify-center gap-2 rounded-xl border-primary/30 bg-card text-sm font-bold"
          onClick={() => setOpen(true)}
          aria-expanded={open}
        >
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          {title}
          {activeCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl border-primary/20 px-4 pb-8">
            <SheetHeader className="text-left">
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3">{children}</div>
            <Button type="button" className="mt-5 h-12 w-full rounded-xl font-bold" onClick={() => setOpen(false)}>
              Show results
            </Button>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
