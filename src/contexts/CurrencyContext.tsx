import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/db/supabase';
import {
  CountryConfig,
  COUNTRIES,
  DEFAULT_COUNTRY,
  COUNTRY_LIST,
  resolveCountry,
  calculateCountryPricing,
} from '@/lib/countryConfig';

export interface CurrencyInfo {
  currency: string;
  symbol: string;
  locale: string;
  lang: string;
  langLabel: string;
  rate: number; // rate from USD
  country: string;
}

interface CountryContextValue {
  // Country & Localization
  country: string;
  countryConfig: CountryConfig;
  setCountry: (countryCodeOrName: string) => void;
  availableCountries: CountryConfig[];
  autoDetectedSource: 'login' | 'ip' | 'manual' | 'default';

  // Currency & Formatting
  currencyInfo: CurrencyInfo;
  setCurrency: (currency: string) => void;
  formatPrice: (usdPrice: number) => string;
  formatLocalPrice: (localAmount: number) => string;
  calculatePricing: (basePrice: number) => ReturnType<typeof calculateCountryPricing>;
  loading: boolean;
  supportedCurrencies: string[];
  rates: Record<string, number>; // all rates from USD base
}

const SUPPORTED_CURRENCIES = ['INR', 'USD', 'GBP', 'EUR', 'AED', 'JPY', 'CNY', 'AUD', 'CAD', 'SGD'];

const CurrencyContext = createContext<CountryContextValue>({
  country: DEFAULT_COUNTRY.code,
  countryConfig: DEFAULT_COUNTRY,
  setCountry: () => {},
  availableCountries: COUNTRY_LIST,
  autoDetectedSource: 'default',
  currencyInfo: {
    currency: DEFAULT_COUNTRY.currency,
    symbol: DEFAULT_COUNTRY.symbol,
    locale: DEFAULT_COUNTRY.locale,
    lang: DEFAULT_COUNTRY.primaryLang,
    langLabel: 'EN',
    rate: 83.5,
    country: DEFAULT_COUNTRY.code,
  },
  setCurrency: () => {},
  formatPrice: (p) => `₹${p}`,
  formatLocalPrice: (p) => `₹${p}`,
  calculatePricing: (p) => calculateCountryPricing(p, DEFAULT_COUNTRY),
  loading: true,
  supportedCurrencies: SUPPORTED_CURRENCIES,
  rates: {},
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [countryConfig, setCountryConfig] = useState<CountryConfig>(() => {
    const saved = localStorage.getItem('bs-country');
    return resolveCountry(saved || 'IN');
  });
  const [autoDetectedSource, setAutoDetectedSource] = useState<'login' | 'ip' | 'manual' | 'default'>('default');
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Fetch exchange rates from USD base with a 3s timeout guard
  const fetchRates = useCallback(async () => {
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
      const invokePromise = supabase.functions.invoke('exchange-rate', {
        body: { base_currency: 'USD' },
      });
      const res = await Promise.race([invokePromise, timeoutPromise]);
      if (res && 'data' in res && res.data?.conversion_rates) {
        setRates(res.data.conversion_rates);
      } else {
        setRates({ INR: 83.5, USD: 1, GBP: 0.79, EUR: 0.92, AED: 3.67, JPY: 149, CNY: 7.2, AUD: 1.53, CAD: 1.36, SGD: 1.34 });
      }
    } catch {
      setRates({ INR: 83.5, USD: 1, GBP: 0.79, EUR: 0.92, AED: 3.67, JPY: 149, CNY: 7.2, AUD: 1.53, CAD: 1.36, SGD: 1.34 });
    }
  }, []);

  // 1. Initial IP / Timezone Detection if no manual selection yet
  useEffect(() => {
    let isMounted = true;
    const fallbackSafetyTimer = setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 2000);

    const detectLocaleFallback = async () => {
      const hasManualChoice = localStorage.getItem('bs-country-manual') === 'true';
      if (hasManualChoice) return;

      // First check local timezone synchronously (no network required, instant & 100% reliable)
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (tz.includes('Calcutta') || tz.includes('Kolkata') || tz.includes('Asia/Colombo')) {
          setCountryConfig(COUNTRIES.IN);
        } else if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago') || tz.includes('Denver') || tz.includes('America/')) {
          setCountryConfig(COUNTRIES.US);
        } else if (tz.includes('Dubai') || tz.includes('Muscat')) {
          setCountryConfig(COUNTRIES.AE);
        } else if (tz.includes('London') || tz.includes('Europe/Belfast')) {
          setCountryConfig(COUNTRIES.GB);
        } else if (tz.includes('Berlin') || tz.includes('Paris') || tz.includes('Rome') || tz.includes('Madrid') || tz.includes('Amsterdam') || tz.includes('Brussels')) {
          setCountryConfig(COUNTRIES.DE);
        } else if (tz.includes('Sydney') || tz.includes('Melbourne') || tz.includes('Brisbane') || tz.includes('Perth')) {
          setCountryConfig(COUNTRIES.AU);
        } else if (tz.includes('Singapore')) {
          setCountryConfig(COUNTRIES.SG);
        }
      } catch {
        // Keep default IN
      }

      // IP-based lookup (ipapi.co) removed: browsers on this origin are blocked by its CORS policy,
      // so it never succeeded and only logged errors. Timezone detection above is the fallback.
    };

    detectLocaleFallback();
    // Defer the rate request until the browser is idle so it does not compete with first paint.
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    const runFetch = () => {
      fetchRates().catch(() => {}).finally(() => {
        if (isMounted) {
          clearTimeout(fallbackSafetyTimer);
          setLoading(false);
        }
      });
    };
    if (ric) ric(runFetch, { timeout: 2000 }); else setTimeout(runFetch, 1000);

    return () => {
      isMounted = false;
      clearTimeout(fallbackSafetyTimer);
    };
  }, [fetchRates]);

  // 2. Login-Based Country Auto-Detection:
  // When user logs in, query their company country or buyerProfile country and automatically adapt!
  useEffect(() => {
    const syncUserCountryOnAuth = async (userId: string) => {
      try {
        const { data: comp } = await supabase
          .from('companies')
          .select('country')
          .eq('owner_id', userId)
          .maybeSingle();

        if (comp?.country) {
          const resolved = resolveCountry(comp.country);
          setCountryConfig(resolved);
          setAutoDetectedSource('login');
          localStorage.setItem('bs-country', resolved.code);
          localStorage.setItem('bs-currency', resolved.currency);
          if (resolved.primaryLang && resolved.primaryLang !== 'en') {
            localStorage.setItem('bs_lang', resolved.primaryLang);
          }
          return;
        }

        const { data: bp } = await supabase
          .from('buyer_profiles')
          .select('country')
          .eq('user_id', userId)
          .maybeSingle();

        if (bp?.country) {
          const resolved = resolveCountry(bp.country);
          setCountryConfig(resolved);
          setAutoDetectedSource('login');
          localStorage.setItem('bs-country', resolved.code);
          localStorage.setItem('bs-currency', resolved.currency);
          if (resolved.primaryLang && resolved.primaryLang !== 'en') {
            localStorage.setItem('bs_lang', resolved.primaryLang);
          }
        }
      } catch (err) {
        console.warn('Could not sync user country on auth:', err);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        syncUserCountryOnAuth(session.user.id);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const setCountry = (countryInput: string) => {
    const resolved = resolveCountry(countryInput);
    setCountryConfig(resolved);
    setAutoDetectedSource('manual');
    localStorage.setItem('bs-country', resolved.code);
    localStorage.setItem('bs-country-manual', 'true');
    localStorage.setItem('bs-currency', resolved.currency);
    if (resolved.primaryLang) {
      localStorage.setItem('bs_lang', resolved.primaryLang);
    }
  };

  const setCurrency = (cur: string) => {
    const matchedCountry = COUNTRY_LIST.find(c => c.currency === cur);
    if (matchedCountry) {
      setCountry(matchedCountry.code);
    }
  };

  const currencyInfo: CurrencyInfo = {
    currency: countryConfig.currency,
    symbol: countryConfig.symbol,
    locale: countryConfig.locale,
    lang: countryConfig.primaryLang,
    langLabel: countryConfig.code,
    rate: rates[countryConfig.currency] ?? (countryConfig.currency === 'INR' ? 83.5 : 1),
    country: countryConfig.code,
  };

  const formatPrice = (usdPrice: number): string => {
    const rate = rates[countryConfig.currency] ?? (countryConfig.currency === 'INR' ? 83.5 : 1);
    const converted = usdPrice * rate;
    try {
      return new Intl.NumberFormat(countryConfig.locale, {
        style: 'currency',
        currency: countryConfig.currency,
        maximumFractionDigits: countryConfig.currency === 'JPY' ? 0 : 2,
        minimumFractionDigits: 0,
      }).format(converted);
    } catch {
      return `${countryConfig.symbol}${converted.toFixed(2)}`;
    }
  };

  const formatLocalPrice = (localAmount: number): string => {
    try {
      return new Intl.NumberFormat(countryConfig.locale, {
        style: 'currency',
        currency: countryConfig.currency,
        maximumFractionDigits: countryConfig.currency === 'JPY' ? 0 : 2,
        minimumFractionDigits: 0,
      }).format(localAmount);
    } catch {
      return `${countryConfig.symbol}${localAmount.toFixed(2)}`;
    }
  };

  const calculatePricing = (basePrice: number) => {
    return calculateCountryPricing(basePrice, countryConfig);
  };

  return (
    <CurrencyContext.Provider
      value={{
        country: countryConfig.code,
        countryConfig,
        setCountry,
        availableCountries: COUNTRY_LIST,
        autoDetectedSource,
        currencyInfo,
        setCurrency,
        formatPrice,
        formatLocalPrice,
        calculatePricing,
        loading,
        supportedCurrencies: SUPPORTED_CURRENCIES,
        rates,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}

export function useCountry() {
  return useContext(CurrencyContext);
}
