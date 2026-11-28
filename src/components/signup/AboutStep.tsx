import React, { useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { COUNTRY_NAMES } from '@/lib/supplierMap/places';
import { gstinProgress, INDIAN_STATES, PRODUCT_CATEGORIES, SUPPLIER_BUSINESS_TYPES, type SupplierBusinessType } from '@/lib/signup';
import { cn } from '@/lib/utils';
import { AssistantNote } from './SignupShell';

/** Sentences a manufacturer might write: they fill the box when tapped, so nobody has to think of how to start. */
const EXAMPLES: ReadonlyArray<{ label: string; text: string }> = [
  { label: 'Pipes · Vadodara', text: 'We manufacture HDPE pipes and fittings in Vadodara, Gujarat' },
  { label: 'Garments · Tiruppur', text: 'Cotton hosiery garments manufacturer and exporter from Tiruppur, Tamil Nadu' },
  { label: 'Rice · Karnal', text: 'We process and export basmati rice from Karnal, Haryana' },
];

export interface AboutDetails {
  businessType: SupplierBusinessType;
  categories: string[];
  products: string[];
  /** where the business is; manufacturers from any country can sign up */
  country: string;
  city: string;
  state: string;
}

interface AboutStepProps {
  text: string;
  onText: (value: string) => void;
  gstin: string;
  onGstin: (value: string) => void;
  /** what the assistant understood, with the person's own changes on top */
  details: AboutDetails;
  /** the person has changed something by hand, so their words no longer decide it */
  edited: boolean;
  onChange: (patch: Partial<AboutDetails>) => void;
  onResetEdits: () => void;
  /** why the person cannot continue yet, other than having said nothing about their products */
  blocked: string;
  onContinue: () => void;
  /** a signed-in supplier can pay before this form is finished */
  onPayNow?: () => void;
}

const chip =
  'inline-flex min-h-[34px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function GstinStatus({ value }: { value: string }) {
  const progress = gstinProgress(value);
  if (progress.status === 'empty') return null;
  if (progress.status === 'typing') {
    return (
      <p id="gstin-status" className="mt-1.5 text-xs text-muted-foreground">
        {progress.length} of 15 characters
      </p>
    );
  }
  if (progress.status === 'invalid') {
    return (
      <p id="gstin-status" role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        That does not look like a GST number. It has 15 letters and digits, like 22AAAAA0000A1Z5.
      </p>
    );
  }
  const { info } = progress;
  return (
    <div id="gstin-status" className="mt-1.5 space-y-1 text-xs">
      <p className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>
          Registered in <strong>{info.state ?? 'another jurisdiction'}</strong>
          {info.holder ? ` · ${info.holder}` : ''}
        </span>
      </p>
      {!info.checkOk && (
        <p role="alert" className="flex items-start gap-1.5 text-orange-600 dark:text-orange-400">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          The last character does not match the rest. Please check the number once more.
        </p>
      )}
    </div>
  );
}

export function AboutStep({ text, onText, gstin, onGstin, details, edited, onChange, onResetEdits, blocked, onContinue, onPayNow }: AboutStepProps) {
  const [adding, setAdding] = useState(false);
  const [productInput, setProductInput] = useState('');
  const [manual, setManual] = useState(false);

  const unselected = PRODUCT_CATEGORIES.filter((category) => !details.categories.includes(category));
  const ready = details.categories.length > 0 || details.products.length > 0;
  // the details are not shown until the person has started: a first screen full of fields is what this is meant to avoid
  const showDetails = manual || edited || text.trim().length >= 3 || gstin.trim().length > 0;

  const addProduct = () => {
    const value = productInput.trim().replace(/\s+/g, ' ').slice(0, 50);
    setProductInput('');
    if (!value || details.products.some((known) => known.toLowerCase() === value.toLowerCase())) return;
    onChange({ products: [...details.products, value].slice(0, 12) });
  };

  const toggleCategory = (category: string) =>
    onChange({
      categories: details.categories.includes(category) ? details.categories.filter((known) => known !== category) : [...details.categories, category],
    });

  return (
    <section aria-labelledby="about-title" className="space-y-5">
      <div>
        <h1 id="about-title" tabIndex={-1} className="text-2xl font-extrabold leading-tight tracking-tight outline-none sm:text-3xl">
          Set up your manufacturer account in about a minute
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">No long forms. Say what you make, and the assistant fills in the rest.</p>
      </div>

      <AssistantNote>
        Hi! Tell me what your company makes and where it is, in your own words. I will fill in your profile from that. You can change anything I get wrong.
      </AssistantNote>

      <div className="space-y-2">
        <Label htmlFor="about-text" className="text-sm font-semibold">
          About your business
        </Label>
        <Textarea
          id="about-text"
          value={text}
          onChange={(event) => onText(event.target.value)}
          rows={3}
          maxLength={600}
          placeholder="e.g. We manufacture HDPE pipes and fittings in Vadodara, Gujarat"
          className="min-h-[88px] resize-none rounded-xl bg-card text-base"
          aria-describedby="about-help"
        />
        <div id="about-help" className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>Not sure what to write? Tap an example:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              onClick={() => onText(example.text)}
              className={cn(chip, 'border-border bg-card text-foreground hover:border-primary/60')}
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      {details.country === 'India' && (
      <div className="space-y-1">
        <Label htmlFor="about-gstin" className="text-sm font-semibold">
          GST number <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="about-gstin"
          value={gstin}
          onChange={(event) => onGstin(event.target.value.toUpperCase().slice(0, 20))}
          placeholder="22AAAAA0000A1Z5"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="h-11 rounded-xl bg-card font-mono text-base tracking-wide"
          aria-describedby="gstin-help gstin-status"
        />
        <p id="gstin-help" className="text-xs text-muted-foreground">
          Add it and I will read your state from it. You can also add it later.
        </p>
        <GstinStatus value={gstin} />
      </div>
      )}

      {/* what the assistant understood, to be corrected by hand */}
      {showDetails ? (
        <div aria-live="polite" className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold">Here is what I understood</h2>
              <p className="text-xs text-muted-foreground">Tap anything to change it.</p>
            </div>
            {edited && (
              <button type="button" onClick={onResetEdits} className="shrink-0 text-xs font-semibold text-primary underline-offset-2 hover:underline">
                Read my words again
              </button>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <div role="group" aria-labelledby="type-label">
              <p id="type-label" className="mb-1.5 text-xs font-semibold text-muted-foreground">
                You are a
              </p>
              <div className="flex flex-wrap gap-2">
                {SUPPLIER_BUSINESS_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={details.businessType === type}
                    onClick={() => onChange({ businessType: type })}
                    className={cn(chip, details.businessType === type ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/60')}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div role="group" aria-labelledby="products-label">
              <p id="products-label" className="mb-1.5 text-xs font-semibold text-muted-foreground">
                What you make
              </p>
              <ul className="flex flex-wrap gap-2">
                {details.products.map((product) => (
                  <li key={product}>
                    <span className={cn(chip, 'border-border bg-background pr-1.5')}>
                      {product}
                      <button
                        type="button"
                        aria-label={`Remove ${product}`}
                        onClick={() => onChange({ products: details.products.filter((known) => known !== product) })}
                        className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <Input
                  value={productInput}
                  onChange={(event) => setProductInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addProduct();
                    }
                  }}
                  aria-label="Add a product"
                  placeholder="Add a product, e.g. PVC pipes"
                  className="h-10 flex-1 rounded-lg bg-background text-sm"
                />
                <Button type="button" variant="outline" size="sm" onClick={addProduct} disabled={!productInput.trim()} className="h-10 rounded-lg px-4">
                  Add
                </Button>
              </div>
            </div>

            <div role="group" aria-labelledby="categories-label">
              <p id="categories-label" className="mb-1.5 text-xs font-semibold text-muted-foreground">
                Categories buyers will find you under
              </p>
              <ul className="flex flex-wrap gap-2">
                {details.categories.map((category) => (
                  <li key={category}>
                    <span className={cn(chip, 'border-primary/50 bg-primary/10 pr-1.5 text-foreground')}>
                      {category}
                      <button
                        type="button"
                        aria-label={`Remove ${category}`}
                        onClick={() => toggleCategory(category)}
                        className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    aria-expanded={adding}
                    onClick={() => setAdding((open) => !open)}
                    className={cn(chip, 'border-dashed border-border bg-background hover:border-primary/60')}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {adding ? 'Done' : 'Add category'}
                  </button>
                </li>
              </ul>
              {adding && (
                <ul className="mt-2 flex flex-wrap gap-2 rounded-xl border border-border bg-background p-3">
                  {unselected.map((category) => (
                    <li key={category}>
                      <button type="button" onClick={() => toggleCategory(category)} className={cn(chip, 'border-border bg-card hover:border-primary/60')}>
                        <Plus className="h-3 w-3" />
                        {category}
                      </button>
                    </li>
                  ))}
                  {unselected.length === 0 && <li className="text-xs text-muted-foreground">All categories are added.</li>}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="about-country" className="text-xs font-semibold text-muted-foreground">
                  Country
                </Label>
                <select
                  id="about-country"
                  value={details.country}
                  onChange={(event) => onChange({ country: event.target.value, state: '' })}
                  autoComplete="country-name"
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                >
                  {COUNTRY_NAMES.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="about-city" className="text-xs font-semibold text-muted-foreground">
                  City
                </Label>
                <Input
                  id="about-city"
                  value={details.city}
                  onChange={(event) => onChange({ city: event.target.value })}
                  autoComplete="address-level2"
                  placeholder="e.g. Vadodara"
                  className="h-11 rounded-lg bg-background text-base"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="about-state" className="text-xs font-semibold text-muted-foreground">
                  {details.country === 'India' ? 'State' : 'State / region'}
                </Label>
                {details.country !== 'India' ? (
                  <Input
                    id="about-state"
                    value={details.state}
                    onChange={(event) => onChange({ state: event.target.value })}
                    autoComplete="address-level1"
                    className="h-11 rounded-lg bg-background text-base"
                  />
                ) : (
                <select
                  id="about-state"
                  value={details.state}
                  onChange={(event) => onChange({ state: event.target.value })}
                  autoComplete="address-level1"
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
                >
                  <option value="">Select a state</option>
                  {INDIAN_STATES.map((state) => (
                    <option key={state.name} value={state.name}>
                      {state.name}
                    </option>
                  ))}
                </select>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center">
          <button type="button" onClick={() => setManual(true)} className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
            I would rather pick the details myself
          </button>
        </div>
      )}

      <div className="space-y-2">
        <Button type="button" onClick={onContinue} disabled={!ready || Boolean(blocked)} className="h-12 w-full rounded-xl text-base font-bold shadow-[0_10px_26px_-12px_rgba(255,90,0,0.85)]">
          Looks right, continue <ArrowRight className="h-4 w-4" />
        </Button>
        {onPayNow && (
          <button type="button" onClick={onPayNow} className="w-full text-center text-sm font-semibold text-primary hover:underline">
            Pay for a plan now
          </button>
        )}
        {blocked ? (
          <p aria-live="polite" className="text-center text-xs text-destructive">
            {blocked}
          </p>
        ) : (
          !ready && (
            <p className="text-center text-xs text-muted-foreground">
              {showDetails ? 'Add at least one product or category so buyers can find you.' : 'Tell me what you make above and I will do the rest.'}
            </p>
          )
        )}
      </div>
    </section>
  );
}
