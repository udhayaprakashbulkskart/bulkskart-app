/**
 * The field look of the form kit as Tailwind class strings.
 *
 * They are passed through `cn()` (tailwind-merge), so on the site's own components (`Input`, `Textarea`,
 * `SelectTrigger`) they replace the base height, border, padding and focus ring instead of fighting them.
 */

const box =
  'w-full min-w-0 rounded-xl border-[1.5px] border-foreground/20 bg-card text-base md:text-base font-medium text-foreground shadow-none outline-none ' +
  'transition-[border-color,box-shadow] placeholder:font-normal placeholder:text-muted-foreground/80 hover:border-foreground/35 ' +
  'focus-visible:border-[#FF5A00] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#FF5A00]/20 focus-visible:ring-offset-0 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive';

export const fk = {
  /** one-line text, number, e-mail, phone */
  input: `flex h-12 px-3.5 ${box}`,
  /** several lines */
  textarea: `flex min-h-[104px] px-3.5 py-3 leading-relaxed resize-y ${box}`,
  /** a native <select> */
  select: `fk-select flex h-12 appearance-none pl-3.5 pr-11 cursor-pointer ${box}`,
  /** the trigger of the site's Radix select */
  selectTrigger:
    `flex h-12 items-center justify-between gap-2 px-3.5 text-left ${box} ` +
    'focus:border-[#FF5A00] focus:ring-[3px] focus:ring-[#FF5A00]/20 focus:ring-offset-0 data-[state=open]:border-[#FF5A00] [&>svg]:h-5 [&>svg]:w-5 [&>svg]:opacity-80',
  /** room for an icon in front of the text */
  withIcon: 'pl-12',
  label: 'text-[0.93rem] font-bold leading-tight text-foreground',
  hint: 'text-[0.8rem] leading-snug text-muted-foreground',
} as const;
