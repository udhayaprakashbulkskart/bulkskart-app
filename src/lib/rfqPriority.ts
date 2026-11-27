export const RFQ_PRIORITY_TAGS = ['emergency', 'urgent', 'hot'] as const;
export type RfqPriorityTag = (typeof RFQ_PRIORITY_TAGS)[number];

/** A choice on the post form, including Regular (stored as a null priority_tag). */
export type RfqPriorityChoice = RfqPriorityTag | 'regular';

export const RFQ_PRIORITY_CHOICES: RfqPriorityChoice[] = ['urgent', 'emergency', 'hot', 'regular'];

export const RFQ_PRIORITY_LABEL: Record<RfqPriorityChoice, string> = {
  emergency: 'Emergency',
  urgent: 'Urgent Requirement',
  hot: 'Hot',
  regular: 'Regular',
};

export const PRIORITY_TAG_REQUIRED_MESSAGE = 'Choose a priority tag';

/** Visual style: Emergency is red, Urgent is BulkSkart orange, Hot is amber/flame, Regular is muted. */
export const RFQ_PRIORITY_CLASS: Record<RfqPriorityChoice, string> = {
  emergency: 'border-red-500/40 bg-red-600 text-white',
  urgent: 'border-[#FF5A00]/40 bg-[#FF5A00] text-white',
  hot: 'border-amber-400/50 bg-amber-500 text-black',
  regular: 'border-border bg-muted text-foreground',
};

export const RFQ_PRIORITY_OUTLINE_CLASS: Record<RfqPriorityChoice, string> = {
  emergency: 'border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400',
  urgent: 'border-[#FF5A00]/50 bg-[#FF5A00]/10 text-[#E04E00] dark:text-[#FF7A2E]',
  hot: 'border-amber-400/50 bg-amber-500/15 text-amber-700 dark:text-amber-300',
  regular: 'border-border bg-background text-foreground',
};

export function normalizePriorityTag(value: unknown): RfqPriorityTag | null {
  const tag = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return (RFQ_PRIORITY_TAGS as readonly string[]).includes(tag) ? (tag as RfqPriorityTag) : null;
}

export function normalizePriorityChoice(value: unknown): RfqPriorityChoice | null {
  const tag = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (tag === 'regular') return 'regular';
  return normalizePriorityTag(tag);
}

/** Store Regular as null so the existing CHECK constraint is unchanged. */
export function priorityTagForStorage(choice: RfqPriorityChoice | null): RfqPriorityTag | null {
  if (!choice || choice === 'regular') return null;
  return choice;
}

/** Keep the older is_urgent flag in step with Urgent and Emergency tags on new/edited posts. */
export function isUrgentFromTag(tag: RfqPriorityTag | RfqPriorityChoice | null): boolean {
  return tag === 'urgent' || tag === 'emergency';
}

/** Badge to show: the buyer's chosen tag, or Urgent when only the older is_urgent flag is set. Display only — does not write data. Regular / null stays untagged. */
export function displayPriorityTag(req: { priority_tag?: unknown; is_urgent?: boolean | null }): RfqPriorityTag | null {
  return normalizePriorityTag(req.priority_tag) ?? (req.is_urgent ? 'urgent' : null);
}
