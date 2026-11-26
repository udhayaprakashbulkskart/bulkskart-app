import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqItem {
  q: string;
  a: string;
}

interface FaqAccordionProps {
  faqs: FaqItem[];
  /** "single" — only one open at a time (default). "multi" — multiple can stay open. */
  mode?: 'single' | 'multi';
  /** Layout variant: "stack" (default) or "grid" for 2-col desktop display */
  layout?: 'stack' | 'grid';
}

export default function FaqAccordion({ faqs, mode = 'single', layout = 'stack' }: FaqAccordionProps) {
  const [openIndexes, setOpenIndexes] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setOpenIndexes(prev => {
      const next = new Set(prev);
      if (next.has(i)) {
        next.delete(i);
      } else {
        if (mode === 'single') next.clear();
        next.add(i);
      }
      return next;
    });
  };

  const items = faqs.map((faq, i) => {
    const open = openIndexes.has(i);
    return (
      <div
        key={faq.q}
        className={`bg-card border rounded-xl overflow-hidden transition-colors ${
          open ? 'border-primary/40' : 'border-border hover:border-primary/20'
        }`}
      >
        <button
          type="button"
          onClick={() => toggle(i)}
          aria-expanded={open}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 md:px-5 text-left"
        >
          <span className="text-sm font-semibold text-foreground leading-snug">{faq.q}</span>
          <ChevronDown
            className={`w-4 h-4 text-primary shrink-0 transition-transform duration-200 ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
        <div
          className={`grid transition-all duration-200 ${
            open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          }`}
        >
          <div className="overflow-hidden">
            <p className="text-xs text-muted-foreground leading-relaxed text-pretty px-4 pb-4 md:px-5">
              {faq.a}
            </p>
          </div>
        </div>
      </div>
    );
  });

  if (layout === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 items-start gap-3">
        {items}
      </div>
    );
  }

  return <div className="space-y-3">{items}</div>;
}
