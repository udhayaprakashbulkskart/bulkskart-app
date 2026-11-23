/**
 * "List your business" popup for new visitors on the supplier map: a centred card on wide screens, a sheet from the
 * bottom on phones. Esc, the close button, "Not now" and "I'm a buyer" all close it; focus stays inside while open.
 */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, Globe2, MessageSquareQuote, X } from 'lucide-react';
import type { PromptAnswer } from '@/lib/supplierMap/listBusinessPrompt';

interface Props {
  href: string;
  onAnswer: (answer: PromptAnswer) => void;
}

const POINTS = [
  { icon: BadgeCheck, title: 'Free to list and verify', text: 'No plan needed to get your factory on the map.' },
  { icon: Globe2, title: 'Found by buyers worldwide', text: 'Buyers search the map by product, distance and country.' },
  { icon: MessageSquareQuote, title: 'Quotation requests come to you', text: 'Buyers ask you for prices straight from your map card.' },
];

export default function ListBusinessPrompt({ href, onAnswer }: Props) {
  const card = useRef<HTMLDivElement>(null);
  const primary = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onAnswer('later');
        return;
      }
      if (e.key !== 'Tab' || !card.current) return;
      const items = Array.from(card.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      before?.focus?.();
    };
  }, [onAnswer]);

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-black/60 backdrop-blur-[2px] motion-safe:animate-in motion-safe:fade-in sm:items-center sm:p-4">
      <button type="button" aria-label="Close" tabIndex={-1} className="absolute inset-0 cursor-default" onClick={() => onAnswer('later')} />
      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="list-business-title"
        aria-describedby="list-business-text"
        data-state="open"
        className="relative w-full max-w-[440px] overflow-hidden rounded-t-3xl border border-white/10 bg-[#0f0f11] text-white shadow-[0_30px_80px_-20px_rgba(255,90,0,0.45)] motion-safe:animate-in motion-safe:slide-in-from-bottom-6 motion-safe:duration-300 sm:rounded-3xl"
      >
        <div className="relative h-32 overflow-hidden bg-gradient-to-br from-[#FF7A2E] via-[#FF5A00] to-[#B83E00]">
          <MapArt />
          <span className="absolute left-4 top-4 rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-black uppercase tracking-wider text-white">Free listing</span>
          <button type="button" onClick={() => onAnswer('later')} aria-label="Close"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/35 text-white hover:bg-black/60">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div>
            <h2 id="list-business-title" className="text-[20px] font-black leading-tight">Do you make or sell products in bulk?</h2>
            <p id="list-business-text" className="mt-1.5 text-[13.5px] leading-snug text-white/70">
              List your business on BulkSkart's verified supplier map. We check your registration and factory, then buyers can find you.
            </p>
          </div>

          <ul className="space-y-2.5">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FF5A00]/15"><Icon className="h-[18px] w-[18px] text-[#FF8A3D]" aria-hidden="true" /></span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-bold">{title}</span>
                  <span className="block text-[12px] text-white/60">{text}</span>
                </span>
              </li>
            ))}
          </ul>

          <Link ref={primary} to={href} onClick={() => onAnswer('listing')}
            className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-[#FF5A00] px-4 text-[15px] font-black text-white shadow-[0_12px_30px_-12px_rgba(255,90,0,0.9)] hover:bg-[#E04E00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            List your business — it's free <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onAnswer('buyer')} className="min-h-[44px] rounded-2xl border border-white/15 text-[13px] font-bold text-white/85 hover:border-white/40 hover:text-white">
              I'm a buyer
            </button>
            <button type="button" onClick={() => onAnswer('later')} className="min-h-[44px] rounded-2xl border border-white/15 text-[13px] font-bold text-white/85 hover:border-white/40 hover:text-white">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A small map with pins, drawn in the page (no image download). */
function MapArt() {
  return (
    <svg viewBox="0 0 440 128" className="absolute inset-0 h-full w-full" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <g stroke="rgba(255,255,255,0.16)" strokeWidth="1">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => <line key={`v${i}`} x1={i * 44} y1="0" x2={i * 44} y2="128" />)}
        {[0, 1, 2, 3].map((i) => <line key={`h${i}`} x1="0" y1={i * 40 + 8} x2="440" y2={i * 40 + 8} />)}
      </g>
      <path d="M-10 96 C 80 60, 150 110, 230 70 S 380 30, 460 58" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" strokeDasharray="6 7" />
      {[
        { x: 300, y: 56, s: 1.15 },
        { x: 372, y: 82, s: 0.85 },
        { x: 236, y: 88, s: 0.8 },
      ].map((p) => (
        <g key={p.x} transform={`translate(${p.x} ${p.y}) scale(${p.s})`}>
          <path d="M0 0 C -14 -14 -14 -36 0 -40 C 14 -36 14 -14 0 0 Z" fill="#fff" />
          <circle cx="0" cy="-25" r="7" fill="#FF5A00" />
          <circle cx="9" cy="-36" r="6" fill="#16A34A" stroke="#fff" strokeWidth="2" />
          <path d="M6.5 -36 l2 2 l3.5 -4" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
    </svg>
  );
}
