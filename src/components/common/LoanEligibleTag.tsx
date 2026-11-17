import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';

interface LoanEligibleTagProps {
  /**
   * Link to the order loan calculator. Leave off inside a product card that is
   * already a link (a link inside a link is not allowed).
   */
  link?: boolean;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const LABEL = 'Loan Eligible';
const TITLE = 'Every BulkSkart order can be paid with an order loan. Check the monthly cost in the loan calculator.';

const SIZES = {
  xs: { box: 'gap-1 px-1.5 py-0.5 text-[9px]', icon: 'h-2.5 w-2.5' },
  sm: { box: 'gap-1 px-2 py-0.5 text-[10.5px]', icon: 'h-3 w-3' },
  md: { box: 'gap-1.5 px-2.5 py-1 text-[12px]', icon: 'h-3.5 w-3.5' },
} as const;

/** The orange "Loan Eligible" tag shown on every product. */
export default function LoanEligibleTag({ link = false, size = 'sm', className = '' }: LoanEligibleTagProps) {
  const s = SIZES[size];
  const classes = `loan-eligible-tag inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full bg-gradient-to-r from-[#FF8A3D] via-[#FF6A14] to-[#FF5A00] font-extrabold text-[#1A0A00] shadow-[0_0_12px_-3px_rgba(255,90,0,0.85)] ${s.box} ${className}`;
  const content = (
    <>
      <Wallet className={s.icon} aria-hidden="true" />
      {LABEL}
    </>
  );

  if (link) {
    return (
      <Link to="/loan-calculator" className={`${classes} transition-transform hover:scale-[1.03]`} title={TITLE}>
        {content}
      </Link>
    );
  }
  return (
    <span className={classes} title={TITLE}>
      {content}
    </span>
  );
}
