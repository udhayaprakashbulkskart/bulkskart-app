import React from 'react';
import { Check, Sparkles } from 'lucide-react';
import BrandLogo from '@/components/common/BrandLogo';
import { cn } from '@/lib/utils';

export type SignupStep = 'about' | 'account' | 'plan';

const STEPS: ReadonlyArray<{ id: SignupStep; label: string }> = [
  { id: 'about', label: 'Your business' },
  { id: 'account', label: 'Your account' },
  { id: 'plan', label: 'Activate' },
];

function Progress({ step }: { step: SignupStep }) {
  const at = STEPS.findIndex((item) => item.id === step);
  return (
    <ol aria-label="Sign-up progress" className="mb-6 flex items-center gap-2 sm:gap-3">
      {STEPS.map((item, index) => {
        const done = index < at;
        const current = index === at;
        return (
          <li key={item.id} aria-current={current ? 'step' : undefined} className={cn('flex items-center gap-2 sm:gap-3', index < STEPS.length - 1 && 'flex-1')}>
            <span
              aria-hidden="true"
              className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold transition-colors',
                done && 'border-primary bg-primary text-primary-foreground',
                current && 'border-primary text-primary',
                !done && !current && 'border-border text-muted-foreground',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className={cn('text-xs font-semibold sm:text-sm', current ? 'text-foreground' : 'text-muted-foreground')}>
              {item.label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
            {index < STEPS.length - 1 && <span aria-hidden="true" className={cn('h-px flex-1', done ? 'bg-primary' : 'bg-border')} />}
          </li>
        );
      })}
    </ol>
  );
}

interface SignupShellProps {
  step: SignupStep;
  /** the link on the right of the header ("Sign in", "Dashboard") */
  headerAction: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** The frame around every step: logo, a way out, where you are, and room to breathe on a phone. */
export function SignupShell({ step, headerAction, children, footer }: SignupShellProps) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(60%_100%_at_50%_0%,hsl(var(--primary)/0.15),transparent_72%)]"
      />
      <header className="relative mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <BrandLogo size="md" variant="auto" linkTo="/" />
        <div className="text-xs text-muted-foreground sm:text-sm">{headerAction}</div>
      </header>
      <main className="relative mx-auto w-full max-w-3xl px-4 pb-28 pt-2 sm:px-6">
        <Progress step={step} />
        {children}
      </main>
      {footer && <footer className="relative mx-auto w-full max-w-3xl px-4 pb-10 text-center text-xs text-muted-foreground sm:px-6">{footer}</footer>}
    </div>
  );
}

/** What the assistant says: a small avatar and a speech card. */
export function AssistantNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span
        aria-hidden="true"
        className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-b from-[#ff7a2e] to-[#ff5a00] text-white shadow-[0_6px_18px_-6px_rgba(255,90,0,0.75)]"
      >
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Signup assistant</p>
        <div className="mt-1 rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 text-sm leading-relaxed text-foreground shadow-sm">{children}</div>
      </div>
    </div>
  );
}
