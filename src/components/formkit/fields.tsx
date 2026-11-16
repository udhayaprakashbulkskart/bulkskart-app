import React, { forwardRef, useId, useState } from 'react';
import { AlertCircle, CheckCircle2, Minus, Plus, Star, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fk } from './classes';
import './formkit.css';

/* ── the frame of one field: label, the control, a hint or an error ─────────────────────────────────────────── */

interface FieldProps {
  /** the id of the control, so the label points at it */
  htmlFor?: string;
  label: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: string;
  /** takes both columns of a two-column grid */
  wide?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Field({ htmlFor, label, required, optional, hint, error, wide, className, children }: FieldProps) {
  return (
    <div className={cn('fk-field', wide && 'is-wide', className)}>
      <label htmlFor={htmlFor} className={fk.label}>
        {label}
        {required && (
          <span className="fk-req" aria-hidden="true">
            *
          </span>
        )}
        {optional && <span className="fk-opt">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p className="fk-error" role="alert" id={htmlFor ? `${htmlFor}-error` : undefined}>
          <AlertCircle aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && (
          <p className={fk.hint} id={htmlFor ? `${htmlFor}-hint` : undefined}>
            {hint}
          </p>
        )
      )}
    </div>
  );
}

/* ── controls ─────────────────────────────────────────────────────────────────────────────────────────────────── */

/** An icon in front of a control, and optionally one behind it (a chevron on a box that offers choices). */
export function IconBox({
  icon: Icon,
  accent,
  trailing: Trailing,
  area,
  children,
}: {
  icon: LucideIcon;
  /** the icon in the brand orange (a rupee sign, a map pin) */
  accent?: boolean;
  trailing?: LucideIcon;
  /** the control is a text area: the icon sits at the top */
  area?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('fk-ctl has-ico', accent && 'is-accent', area && 'is-area')}>
      <Icon className="fk-ico" aria-hidden="true" />
      {children}
      {Trailing && <Trailing className="fk-trail" aria-hidden="true" />}
    </div>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; iconPadding?: boolean };

export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput({ className, invalid, iconPadding, type, ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(fk.input, type === 'number' && 'fk-num', iconPadding && fk.withIcon, className)}
      {...props}
    />
  );
});

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean; iconPadding?: boolean };

export const NativeSelect = forwardRef<HTMLSelectElement, SelectProps>(function NativeSelect({ className, invalid, iconPadding, ...props }, ref) {
  return <select ref={ref} aria-invalid={invalid || undefined} className={cn(fk.select, iconPadding && fk.withIcon, className)} {...props} />;
});

type AreaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean; iconPadding?: boolean };

export const TextArea = forwardRef<HTMLTextAreaElement, AreaProps>(function TextArea({ className, invalid, iconPadding, ...props }, ref) {
  return <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(fk.textarea, iconPadding && fk.withIcon, className)} {...props} />;
});

/** A text area that shows how much room is left ("0 / 500"). */
export const CountedTextArea = forwardRef<HTMLTextAreaElement, AreaProps & { maxLength: number; icon?: LucideIcon }>(function CountedTextArea(
  { value, maxLength, icon, className, ...props },
  ref,
) {
  const used = typeof value === 'string' ? value.length : 0;
  const area = <TextArea ref={ref} value={value} maxLength={maxLength} iconPadding={Boolean(icon)} className={cn('resize-none pb-8', className)} {...props} />;
  return (
    <div className={cn('fk-ctl', icon && 'has-ico is-area')}>
      {icon && React.createElement(icon, { className: 'fk-ico', 'aria-hidden': true })}
      {area}
      <span className="fk-count" aria-hidden="true">
        {used} / {maxLength}
      </span>
    </div>
  );
});

interface StepperProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  /** what the number counts, for the buttons' names ("Fewer pieces") */
  unitName?: string;
  invalid?: boolean;
  required?: boolean;
  describedBy?: string;
}

/** A number with a minus and a plus, like the quantity box in the designs. Typing a number works too. */
export function Stepper({ id, value, onChange, min = 1, max, step = 1, unitName = 'quantity', invalid, required, describedBy }: StepperProps) {
  const current = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(current);
  const clamp = (next: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, next));
  const nudge = (direction: 1 | -1) => onChange(String(clamp((valid ? current : min) + direction * step)));
  return (
    <div className="fk-stepper">
      <button type="button" onClick={() => nudge(-1)} disabled={valid && current <= min} aria-label={`Less ${unitName}`}>
        <Minus aria-hidden="true" />
      </button>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        className="fk-num"
        min={min}
        max={max}
        step={step}
        required={required}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (valid) onChange(String(clamp(Math.round(current))));
        }}
      />
      <button type="button" onClick={() => nudge(1)} disabled={max !== undefined && valid && current >= max} aria-label={`More ${unitName}`}>
        <Plus aria-hidden="true" />
      </button>
    </div>
  );
}

/** The tinted row with a tick box ("Open direct chat with supplier immediately after submit"). */
export function CheckRow({
  id,
  checked,
  onCheckedChange,
  icon: Icon,
  children,
}: {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  const fallback = useId();
  const inputId = id ?? fallback;
  return (
    <label htmlFor={inputId} className="fk-check">
      <input id={inputId} type="checkbox" checked={checked} onChange={(event) => onCheckedChange(event.target.checked)} />
      {Icon && <Icon aria-hidden="true" />}
      <span>{children}</span>
    </label>
  );
}

const RATING_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** Five stars to pick a rating from: a radio group, so it works with a keyboard and a screen reader. */
export function RatingPicker({ id, value, onChange, labelledBy }: { id: string; value: number; onChange: (value: number) => void; labelledBy?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  const pick = (next: number) => {
    const clamped = Math.min(5, Math.max(1, next));
    onChange(clamped);
    document.getElementById(`${id}-${clamped}`)?.focus();
  };
  return (
    <div className="fk-rating" role="radiogroup" id={id} aria-labelledby={labelledBy} onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          id={`${id}-${n}`}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? 'star' : 'stars'}, ${RATING_WORDS[n]}`}
          tabIndex={value === n || (value < 1 && n === 1) ? 0 : -1}
          className={n <= shown ? 'is-on' : undefined}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
              event.preventDefault();
              pick(value + 1);
            } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
              event.preventDefault();
              pick(value - 1);
            }
          }}
        >
          <Star aria-hidden="true" />
        </button>
      ))}
      <span className="fk-rating-word" aria-hidden="true">
        {RATING_WORDS[shown] ?? ''}
      </span>
    </div>
  );
}

/* ── pieces ───────────────────────────────────────────────────────────────────────────────────────────────────── */

export function SectionTitle({ children, as: Tag = 'h3', id }: { children: React.ReactNode; as?: 'h2' | 'h3' | 'h4'; id?: string }) {
  return (
    <Tag className="fk-section" id={id}>
      {children}
    </Tag>
  );
}

export interface EntityMeta {
  icon: LucideIcon;
  /** a star is drawn filled and in amber */
  star?: boolean;
  children: React.ReactNode;
}

/** What the form is about: a product with its supplier, a requirement, a company. */
export function EntityCard({
  image,
  imageAlt = '',
  fallbackIcon: Fallback,
  name,
  byLabel = 'Supplier:',
  by,
  verified,
  meta = [],
}: {
  image?: string | null;
  imageAlt?: string;
  fallbackIcon: LucideIcon;
  name: React.ReactNode;
  byLabel?: string;
  by?: React.ReactNode;
  verified?: boolean;
  meta?: EntityMeta[];
}) {
  const [broken, setBroken] = React.useState(false);
  return (
    <div className="fk-entity">
      <div className="fk-entity-img">
        {image && !broken ? <img src={image} alt={imageAlt} loading="lazy" decoding="async" onError={() => setBroken(true)} /> : <Fallback aria-hidden="true" />}
      </div>
      <div className="fk-entity-body">
        <p className="fk-entity-name">{name}</p>
        {by && (
          <p className="fk-entity-by">
            <span>{byLabel}</span>
            <b>{by}</b>
            {verified && (
              <>
                <CheckCircle2 className="fk-badge" aria-hidden="true" />
                <span className="sr-only">(verified)</span>
              </>
            )}
          </p>
        )}
        {meta.length > 0 && (
          <ul className="fk-entity-meta">
            {meta.map((item, index) => (
              <li key={index} className={item.star ? 'is-rating' : undefined}>
                <item.icon className={item.star ? 'is-star' : undefined} aria-hidden="true" />
                <span>{item.children}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' };

export const KitButton = forwardRef<HTMLButtonElement, ButtonProps>(function KitButton({ variant = 'primary', className, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} className={cn('fk-btn', `is-${variant}`, className)} {...props} />;
});

/** The buttons at the end: the main one first and wide, "Cancel" beside it on desktop and under it on a phone. */
export function Actions({ children, single, className }: { children: React.ReactNode; single?: boolean; className?: string }) {
  return <div className={cn('fk-actions', single && 'is-single', className)}>{children}</div>;
}

export function Callout({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="fk-callout">
      <Icon aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

/** What is shown once the form has been sent. */
export function Done({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="fk-done" role="status">
      <span className="fk-done-ico">
        <CheckCircle2 aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      {children}
      {actions}
    </div>
  );
}
