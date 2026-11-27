/**
 * PostRequirementDialog
 *
 * Modal that lets a buyer post a new RFQ requirement directly from the
 * RequirementsPage. Completely self-contained; does NOT touch any existing
 * RequirementsPage state — it only calls createRequirement() and on success
 * invokes onPosted() so the parent can prepend the new row.
 */
import React, { useId, useState } from 'react';
import { Calendar, FileText, Globe2, IndianRupee, Layers, Loader2, MapPin, MessagesSquare, Plus, Tag, Users, Zap } from 'lucide-react';
import { toast } from 'sonner';
import {
  Actions,
  CountedTextArea,
  Field,
  FormDialog,
  IconBox,
  KitButton,
  NativeSelect,
  SectionTitle,
  Stepper,
  TextArea,
  TextInput,
  type FormPoint,
} from '@/components/formkit';
import { createRequirement } from '@/lib/api';
import { RfqPriorityPicker } from '@/components/common/RfqPriorityBadge';
import { isUrgentFromTag, type RfqPriorityTag } from '@/lib/rfqPriority';
import { supabase } from '@/db/supabase';
import { invokeAutoQuotation } from '@/lib/autoQuotationApi';
import { CITY_NAMES } from '@/lib/signup/places';
import type { Category, Requirement } from '@/types/types';
import SingleImageUploader from '@/components/common/SingleImageUploader';

const UNITS = ['Pcs', 'KG', 'Tons', 'MT', 'Litre', 'Box', 'Carton', 'Dozen', 'Set', 'Pair', 'Metre', 'Yard'];

const COUNTRIES = [
  'India', 'UAE', 'USA', 'UK', 'Germany', 'Singapore', 'Australia',
  'Canada', 'France', 'Japan', 'Brazil', 'China', 'Kenya', 'Italy',
  'Spain', 'Netherlands', 'South Korea', 'Mexico', 'Indonesia', 'Thailand',
];

interface Props {
  open: boolean;
  onClose: () => void;
  categories: Category[];
  buyerId: string;
  onPosted: (req: Requirement) => void;
}

const POINTS: FormPoint[] = [
  { icon: FileText, title: 'Say what you need', detail: 'Product, quantity and delivery' },
  { icon: Users, title: 'Matching suppliers see it', detail: 'Those who make this product' },
  { icon: MessagesSquare, title: 'Quotes in your dashboard', detail: 'Compare them side by side' },
  { icon: Zap, title: 'Mark it urgent', detail: 'When you need it fast' },
];

export default function PostRequirementDialog({ open, onClose, categories, buyerId, onPosted }: Props) {
  const ids = useId();
  const [loading, setLoading] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    title: '',
    category_id: '',
    description: '',
    quantity: '',
    quantity_unit: 'Pcs',
    budget_max: '',
    destination_country: 'India',
    destination_city: '',
    deadline: '',
    specifications: '',
    is_urgent: false,
    priority_tag: null as RfqPriorityTag | null,
  });

  const set = (k: string, v: string | boolean | RfqPriorityTag | null) => setForm(f => ({ ...f, [k]: v }));

  const validateDialogForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.title.trim()) {
      errors.title = 'Requirement title/product name is required';
    }
    if (!form.category_id) {
      errors.category_id = 'Please select a requirement category';
    }
    if (!form.description.trim() || form.description.trim().length < 15) {
      errors.description = 'Requirement description is required (min 15 characters)';
    }
    if (!form.quantity || isNaN(Number(form.quantity)) || Number(form.quantity) <= 0) {
      errors.quantity = 'Valid order quantity is required';
    }
    if (!form.destination_country && !form.destination_city.trim()) {
      errors.destination = 'Delivery destination country or city is required';
    }
    if (!attachmentUrl) {
      errors.image = 'Requirement reference image is required. Upload an image representing the requested item.';
    }

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      toast.error(firstError);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Strict No Empty Post validation
    if (!validateDialogForm()) {
      return;
    }

    setLoading(true);
    const payload: Partial<Requirement> = {
      buyer_id: buyerId,
      title: form.title.trim(),
      category_id: form.category_id,
      description: form.description.trim(),
      quantity: parseInt(form.quantity),
      quantity_unit: form.quantity_unit,
      budget_max: form.budget_max ? parseFloat(form.budget_max) : null,
      destination_country: form.destination_country || null,
      destination_city: form.destination_city.trim() || null,
      deadline: form.deadline || null,
      specifications: form.specifications.trim() || null,
      attachment_url: attachmentUrl,
      status: 'active',
      priority_tag: form.priority_tag,
      // @ts-expect-error — columns not yet in the official Requirement type
      is_urgent: isUrgentFromTag(form.priority_tag) || form.is_urgent,
      deal_status: 'active',
    };
    const { error, id } = await createRequirement(payload);
    setLoading(false);
    if (error || !id) { toast.error(error ?? 'Failed to post requirement'); return; }
    // Fetch full row with joins for live prepend
    const { data: newReq } = await supabase
      .from('requirements')
      .select('*, profiles!buyer_id(id,full_name), categories!category_id(id,name,slug)')
      .eq('id', id)
      .maybeSingle();
    if (newReq) onPosted(newReq as Requirement);
    toast.success('Requirement posted. Matching suppliers can now send you quotes.');
    // Trigger auto-quotation matching in background (non-blocking)
    invokeAutoQuotation(id).catch(() => {/* silent — non-critical */});
    // Reset form
    setForm({ title: '', category_id: '', description: '', quantity: '', quantity_unit: 'Pcs', budget_max: '', destination_country: 'India', destination_city: '', deadline: '', specifications: '', is_urgent: false, priority_tag: null });
    setAttachmentUrl(null);
    setFieldErrors({});
    onClose();
  };

  const clear = (key: string) => setFieldErrors((prev) => ({ ...prev, [key]: '' }));

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      busy={loading}
      title={
        <>
          Post a <em>Requirement</em>
        </>
      }
      description="Describe what you need and suppliers can send you quotes."
      points={POINTS}
      sheetArt="quote"
    >
      <form onSubmit={handleSubmit} noValidate className="fk-form fk-stack">
        <SectionTitle>What you need</SectionTitle>

        <Field htmlFor={`${ids}-title`} label="Requirement / Product Name" required error={fieldErrors.title}>
          <IconBox icon={Tag}>
            <TextInput
              id={`${ids}-title`}
              value={form.title}
              onChange={(e) => {
                set('title', e.target.value);
                clear('title');
              }}
              placeholder="e.g. Basmati Rice 1121 Grade Export Quality"
              invalid={Boolean(fieldErrors.title)}
              iconPadding
            />
          </IconBox>
        </Field>

        <Field label="Reference Image" required error={fieldErrors.image} hint="A photo or drawing of the exact product (JPG, PNG or WEBP). Large phone photos are compressed automatically.">
          <SingleImageUploader
            value={attachmentUrl}
            shape="rectangle"
            bucket="rfq-images"
            folder={`rfqs/${buyerId}`}
            onChange={(url) => {
              setAttachmentUrl(url ?? null);
              if (url) clear('image');
            }}
          />
        </Field>

        <div className="fk-grid">
          <Field htmlFor={`${ids}-category`} label="Category" required error={fieldErrors.category_id}>
            <IconBox icon={Layers}>
              <NativeSelect
                id={`${ids}-category`}
                value={form.category_id}
                onChange={(e) => {
                  set('category_id', e.target.value);
                  clear('category_id');
                }}
                invalid={Boolean(fieldErrors.category_id)}
                iconPadding
              >
                <option value="">Select category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </IconBox>
          </Field>
          <Field htmlFor={`${ids}-qty`} label="Quantity" required error={fieldErrors.quantity}>
            <Stepper
              id={`${ids}-qty`}
              value={form.quantity}
              onChange={(value) => {
                set('quantity', value);
                clear('quantity');
              }}
              min={1}
              unitName={form.quantity_unit}
              invalid={Boolean(fieldErrors.quantity)}
            />
          </Field>
          <Field htmlFor={`${ids}-unit`} label="Unit" required>
            <NativeSelect id={`${ids}-unit`} value={form.quantity_unit} onChange={(e) => set('quantity_unit', e.target.value)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field htmlFor={`${ids}-budget`} label="Budget / Expected Price" optional>
            <IconBox icon={IndianRupee} accent>
              <TextInput
                id={`${ids}-budget`}
                type="number"
                inputMode="decimal"
                min={0}
                value={form.budget_max}
                onChange={(e) => set('budget_max', e.target.value)}
                placeholder="e.g. 50,000"
                iconPadding
              />
            </IconBox>
          </Field>
        </div>

        <SectionTitle>Delivery</SectionTitle>

        <div className="fk-grid">
          <Field htmlFor={`${ids}-country`} label="Country" required error={fieldErrors.destination}>
            <IconBox icon={Globe2}>
              <NativeSelect
                id={`${ids}-country`}
                value={form.destination_country}
                onChange={(e) => {
                  set('destination_country', e.target.value);
                  clear('destination');
                }}
                invalid={Boolean(fieldErrors.destination)}
                iconPadding
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </IconBox>
          </Field>
          <Field htmlFor={`${ids}-city`} label="City / State">
            <IconBox icon={MapPin} accent>
              <TextInput
                id={`${ids}-city`}
                list={`${ids}-cities`}
                value={form.destination_city}
                onChange={(e) => {
                  set('destination_city', e.target.value);
                  clear('destination');
                }}
                placeholder="e.g. Mumbai"
                autoComplete="address-level2"
                iconPadding
              />
            </IconBox>
            <datalist id={`${ids}-cities`}>
              {CITY_NAMES.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </Field>
          <Field htmlFor={`${ids}-deadline`} label="Required Delivery Date" optional wide>
            <IconBox icon={Calendar}>
              <TextInput
                id={`${ids}-deadline`}
                type="date"
                value={form.deadline}
                onChange={(e) => set('deadline', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                iconPadding
              />
            </IconBox>
          </Field>
        </div>

        <SectionTitle>Details</SectionTitle>

        <Field htmlFor={`${ids}-description`} label="Description" required error={fieldErrors.description} hint="At least 15 characters: material grade, intended use, testing standards.">
          <CountedTextArea
            id={`${ids}-description`}
            icon={FileText}
            rows={3}
            maxLength={1000}
            value={form.description}
            onChange={(e) => {
              set('description', e.target.value);
              clear('description');
            }}
            placeholder="Describe your requirement in detail (material grade, intended use, testing standards)..."
            invalid={Boolean(fieldErrors.description)}
          />
        </Field>

        <Field htmlFor={`${ids}-specs`} label="Product Specifications" optional>
          <TextArea
            id={`${ids}-specs`}
            rows={2}
            value={form.specifications}
            onChange={(e) => set('specifications', e.target.value)}
            placeholder="Grade, size, certifications, packaging, etc."
          />
        </Field>

        <RfqPriorityPicker
          id={`${ids}-priority`}
          value={form.priority_tag}
          onChange={(tag) => setForm((f) => ({ ...f, priority_tag: tag, is_urgent: isUrgentFromTag(tag) }))}
          disabled={loading}
        />

        <Actions>
          <KitButton type="submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {loading ? 'Posting…' : 'Post Requirement'}
          </KitButton>
          <KitButton variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </KitButton>
        </Actions>
      </form>
    </FormDialog>
  );
}
