/** The one-page "Register your factory" form (pages/RegisterFactoryPage.tsx): its checks and what it saves. */
import { checkMobile, looksLikeEmail, type SignupDraft } from '@/lib/signup';

export interface FactoryForm {
  companyName: string;
  fullName: string;
  phone: string;
  email: string;
  password: string;
  city: string;
  country: string;
  makes: string;
  agreed: boolean;
}

/** Field -> message for anything that would stop the account being created; empty when it is fine. */
export function validateFactoryForm(f: FactoryForm): Partial<Record<keyof FactoryForm, string>> {
  const e: Partial<Record<keyof FactoryForm, string>> = {};
  if (f.companyName.trim().length < 2) e.companyName = 'Enter your factory or business name';
  else if (f.companyName.trim().length > 80) e.companyName = 'Keep the name under 80 characters';
  if (f.fullName.trim().length < 2) e.fullName = 'Enter your name';
  if (!checkMobile(f.phone).ok) e.phone = 'Enter your mobile number (10 digits, or with the country code, like +971 50 123 4567)';
  if (!looksLikeEmail(f.email)) e.email = 'Enter your email, like you@company.com';
  if (f.password.length < 8) e.password = 'Use at least 8 characters';
  if (f.city.trim().length < 2) e.city = 'Enter the city of your factory';
  if (!f.agreed) e.agreed = 'Please accept to continue';
  return e;
}

/** What the business-saving code needs, from the short form. */
export function draftFromForm(f: FactoryForm): SignupDraft {
  const makes = f.makes.trim();
  return {
    companyName: f.companyName.trim(),
    businessType: 'Manufacturer',
    categories: [],
    products: makes ? makes.split(/\s*,\s*/).filter(Boolean).slice(0, 8) : [],
    city: f.city.trim(),
    state: '',
    country: f.country,
    gstin: '',
    description: makes ? `Manufacturer of ${makes}` : '',
    tradeType: f.country === 'India' ? 'domestic' : 'export',
    yearEstablished: null,
    yearsInBusiness: null,
    fullName: f.fullName.trim(),
    phone: checkMobile(f.phone).e164 ?? f.phone.trim(),
  };
}
