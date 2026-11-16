import React, { useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, type LucideIcon } from 'lucide-react';
import { BULKSKART_LOGO_DARK, BULKSKART_LOGO_LIGHT } from '@/constants/branding';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { ClipboardArt, WarehouseArt } from './art';
import './formkit.css';

export interface FormPoint {
  icon: LucideIcon;
  title: string;
  detail?: string;
}

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** the title; words in <em> are drawn in orange ("Request <em>Quick Quote</em>") */
  title: React.ReactNode;
  description?: React.ReactNode;
  /**
   * Short points for the dark side panel on desktop. Without them the dialog is a single column on desktop
   * (small forms do not need a panel); on a phone the top of the sheet looks the same either way.
   */
  points?: FormPoint[];
  /** the drawing at the top of the sheet on a phone */
  sheetArt?: 'quote' | 'none';
  /** desktop width, in pixels */
  width?: number;
  /** while something is being sent the dialog cannot be closed by accident */
  busy?: boolean;
  children: React.ReactNode;
}

/**
 * The pop-up every form uses: a split card on desktop (dark panel with the title and points, form on the right),
 * a sheet that slides up from the bottom on a phone (with a handle to swipe it away).
 */
export function FormDialog({ open, onOpenChange, title, description, points, sheetArt = 'none', width, busy, children }: FormDialogProps) {
  const { theme } = useTheme();
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const content = useRef<HTMLDivElement>(null);
  const split = Boolean(points && points.length > 0);

  const close = (next: boolean) => {
    if (!next && busy) return;
    onOpenChange(next);
  };

  const onTouchStart = (event: React.TouchEvent) => {
    start.current = event.touches[0].clientY;
  };
  const onTouchMove = (event: React.TouchEvent) => {
    if (start.current === null) return;
    setDrag(Math.max(0, event.touches[0].clientY - start.current));
  };
  const onTouchEnd = () => {
    if (drag > 80) close(false);
    start.current = null;
    setDrag(0);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={close}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fk-overlay" />
        <DialogPrimitive.Content
          ref={content}
          className={cn('fk-dialog', !split && 'is-plain')}
          style={{
            ...(width ? ({ '--fk-width': `${width}px` } as React.CSSProperties) : null),
            ...(drag > 0 ? { transform: `translateY(${drag}px)`, transition: 'none' } : null),
          }}
          tabIndex={-1}
          // the dialog itself takes the focus, so a phone does not pop its keyboard up and no button lights up
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            content.current?.focus();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div className="fk-handle" aria-hidden="true" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} />
          <DialogPrimitive.Close className="fk-close" aria-label="Close" disabled={busy}>
            <X aria-hidden="true" />
          </DialogPrimitive.Close>

          <div className="fk-scroll">
            <aside className="fk-intro">
              <div className="fk-intro-top">
                <img className="fk-logo is-sheet" src={theme === 'light' ? BULKSKART_LOGO_LIGHT : BULKSKART_LOGO_DARK} alt="BulkSkart" />
                <img className="fk-logo is-panel" src={BULKSKART_LOGO_LIGHT} alt="" aria-hidden="true" />
              </div>
              <div className="fk-intro-text">
                <DialogPrimitive.Title className="fk-title">{title}</DialogPrimitive.Title>
                {description && <DialogPrimitive.Description className="fk-desc">{description}</DialogPrimitive.Description>}
              </div>
              {sheetArt === 'quote' && <ClipboardArt className="fk-art-sheet" />}
              {split && (
                <>
                  <ul className="fk-points">
                    {points!.map((point) => (
                      <li key={point.title} className="fk-point">
                        <span className="fk-point-ico">
                          <point.icon aria-hidden="true" />
                        </span>
                        <span>
                          <b>{point.title}</b>
                          {point.detail && <span>{point.detail}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <WarehouseArt className="fk-art-panel" />
                </>
              )}
            </aside>

            <div className="fk-main">
              {!split && (
                // the side panel is not there on desktop, so the title is repeated above the form (for the eye only)
                <div className="fk-plain-head" aria-hidden="true">
                  <p className="fk-title">{title}</p>
                  {description && <p className="fk-desc">{description}</p>}
                </div>
              )}
              {children}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
