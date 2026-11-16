import { describe, expect, it } from 'vitest';
import {
  buildCompanyRow,
  buildProfileUpdate,
  checkMobile,
  cleanGstin,
  decodeGstin,
  findGstin,
  gstinCheckCharacter,
  gstinProgress,
  makeCompanySlug,
  matchCategories,
  readBusiness,
  readPlace,
  signupCompletionScore,
  stateFromGstCode,
  suggestEmailFix,
  type SignupDraft,
} from '@/lib/signup';

const NOW = new Date('2026-11-16T10:00:00Z');

describe('GST numbers', () => {
  it('works out the check character the way the GST network does', () => {
    // 27AAPFU0939F1ZV is the usual worked example of a valid number
    expect(gstinCheckCharacter('27AAPFU0939F1Z')).toBe('V');
  });

  it('makes the weighted total of all 15 characters a multiple of 36, whatever the first 14 are', () => {
    const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let seed = 7;
    const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    for (let n = 0; n < 200; n++) {
      const first14 = Array.from({ length: 14 }, () => alphabet[next() % 36]).join('');
      const full = first14 + gstinCheckCharacter(first14);
      let total = 0;
      for (let i = 0; i < 15; i++) {
        const product = alphabet.indexOf(full[i]) * (i % 2 === 0 ? 1 : 2);
        total += Math.floor(product / 36) + (product % 36);
      }
      expect(total % 36).toBe(0);
    }
  });

  it('reads the state, the PAN and who holds it from a valid number', () => {
    expect(decodeGstin('27AAPFU0939F1ZV')).toEqual({
      gstin: '27AAPFU0939F1ZV',
      stateCode: '27',
      state: 'Maharashtra',
      pan: 'AAPFU0939F',
      holder: 'Partnership firm / LLP',
      checkOk: true,
    });
  });

  it('accepts a number pasted in lower case, with spaces or dashes', () => {
    expect(cleanGstin(' 27aapfu 0939f1-zv ')).toBe('27AAPFU0939F1ZV');
    expect(decodeGstin('27aapfu0939f1zv')?.state).toBe('Maharashtra');
  });

  it('still reads a number whose last character is wrong, and says so, so a typo is a warning and not a wall', () => {
    const info = decodeGstin('27AAPFU0939F1ZW');
    expect(info?.state).toBe('Maharashtra');
    expect(info?.checkOk).toBe(false);
  });

  it('does not read anything that is not shaped like a GST number', () => {
    expect(decodeGstin('27AAPFU0939F1XV')).toBeNull(); // the 14th character is always Z
    expect(decodeGstin('27AAPFU0939F1Z')).toBeNull();
    expect(decodeGstin('hello')).toBeNull();
    expect(decodeGstin('')).toBeNull();
  });

  it('says which letter of the PAN means a company or a proprietor', () => {
    expect(decodeGstin('24AAACC1206D1ZM')?.holder).toBe('Company');
    expect(decodeGstin('33ABCPK1234L1Z5')?.holder).toBe('Individual / proprietorship');
  });

  it('knows the state behind each code, including the old ones that are still on old registrations', () => {
    expect(stateFromGstCode('24')).toBe('Gujarat');
    expect(stateFromGstCode('33')).toBe('Tamil Nadu');
    expect(stateFromGstCode('36')).toBe('Telangana');
    expect(stateFromGstCode('37')).toBe('Andhra Pradesh');
    expect(stateFromGstCode('28')).toBe('Andhra Pradesh');
    expect(stateFromGstCode('38')).toBe('Ladakh');
    expect(stateFromGstCode('25')).toBe('Dadra & Nagar Haveli and Daman & Diu');
    expect(stateFromGstCode('97')).toBeNull();
    expect(stateFromGstCode('99')).toBeNull();
  });

  it('tells someone typing a number how far along they are', () => {
    expect(gstinProgress('')).toEqual({ status: 'empty' });
    expect(gstinProgress('27AAP')).toEqual({ status: 'typing', length: 5 });
    expect(gstinProgress('27AAPFU0939F1XV')).toEqual({ status: 'invalid' });
    const done = gstinProgress('27AAPFU0939F1ZV');
    expect(done.status).toBe('ok');
  });

  it('finds a number written anywhere in a sentence', () => {
    expect(findGstin('Our GST is 27 AAPFU0939F 1ZV and we make bolts')?.gstin).toBe('27AAPFU0939F1ZV');
    expect(findGstin('we make bolts')).toBeNull();
  });
});

describe('mobile numbers', () => {
  it('accepts an Indian mobile however it is written and saves it one way', () => {
    for (const typed of ['9876543210', '98765 43210', '+91 98765 43210', '+91-98765-43210', '09876543210', '919876543210', '+919876543210', '0091 9876543210']) {
      expect(checkMobile(typed)).toEqual({ ok: true, e164: '+919876543210', display: '+91 98765 43210' });
    }
  });

  it('refuses numbers that cannot be an Indian mobile', () => {
    for (const typed of ['', '12345', '5876543210', '98765 4321', '98765432101', '+91 12345', 'abcdefghij']) {
      expect(checkMobile(typed).ok).toBe(false);
    }
  });

  it('accepts a number with another country code that has a sensible length', () => {
    expect(checkMobile('+971 50 123 4567')).toEqual({ ok: true, e164: '+971501234567', display: '+971501234567' });
    expect(checkMobile('+1 2')).toMatchObject({ ok: false });
  });
});

describe('e-mail typos', () => {
  it('corrects a well-known mail domain written one or two letters wrong', () => {
    expect(suggestEmailFix('ravi@gmial.com')).toBe('ravi@gmail.com');
    expect(suggestEmailFix('ravi@gmai.com')).toBe('ravi@gmail.com');
    expect(suggestEmailFix('ravi@gmail.con')).toBe('ravi@gmail.com');
    expect(suggestEmailFix('ravi@yaho.com')).toBe('ravi@yahoo.com');
    expect(suggestEmailFix('ravi@hotmial.com')).toBe('ravi@hotmail.com');
  });

  it('leaves a right address, another real service and a company domain alone', () => {
    for (const email of ['ravi@gmail.com', 'ravi@mail.com', 'ravi@yahoo.in', 'ravi@yahoo.co.uk', 'ravi@sunrisepolymers.in', 'ravi@acme.com', 'not an email', '']) {
      expect(suggestEmailFix(email)).toBeNull();
    }
  });
});

describe('places', () => {
  const cases: Array<[string, { city: string | null; state: string | null }]> = [
    ['We make pipes in Vadodara, Gujarat', { city: 'Vadodara', state: 'Gujarat' }],
    ['based in Gujarat', { city: null, state: 'Gujarat' }],
    ['Tiruppur', { city: 'Tiruppur', state: 'Tamil Nadu' }],
    ['Aurangabad, Bihar', { city: 'Aurangabad', state: 'Bihar' }],
    ['a factory in Aurangabad', { city: 'Aurangabad', state: 'Maharashtra' }],
    ['Jammu & Kashmir', { city: null, state: 'Jammu & Kashmir' }],
    ['Jammu', { city: 'Jammu', state: 'Jammu & Kashmir' }],
    ['plant in Kheda, Gujarat', { city: 'Kheda', state: 'Gujarat' }],
    ['I am Anand and I make pipes', { city: null, state: null }],
    ['our plant is in Anand, Gujarat', { city: 'Anand', state: 'Gujarat' }],
    ['Bangalore', { city: 'Bengaluru', state: 'Karnataka' }],
    ['from Calcutta', { city: 'Kolkata', state: 'West Bengal' }],
    ['Navi Mumbai', { city: 'Navi Mumbai', state: 'Maharashtra' }],
    ['New Delhi', { city: 'Delhi', state: 'Delhi' }],
    ['Greater Noida', { city: 'Greater Noida', state: 'Uttar Pradesh' }],
    ['Orissa', { city: null, state: 'Odisha' }],
    ['Tamilnadu', { city: null, state: 'Tamil Nadu' }],
    ['Mandi Gobindgarh', { city: 'Mandi Gobindgarh', state: 'Punjab' }],
    ['cotton yarn', { city: null, state: null }],
    ['', { city: null, state: null }],
  ];
  it.each(cases)('reads %j', (text, expected) => {
    expect(readPlace(text)).toEqual(expected);
  });

  it('takes the first place named when a sentence names several', () => {
    expect(readPlace('We make bolts in Pune and sell across Gujarat and Karnataka')).toEqual({ city: 'Pune', state: 'Maharashtra' });
  });
});

describe('categories', () => {
  const cases: Array<[string, string[]]> = [
    ['HDPE pipes and fittings', ['Plastics & Rubber']],
    ['cement and TMT bars', ['Construction & Building Materials']],
    ['LED lights and cables', ['Electronics & Electricals']],
    ['organic turmeric powder', ['Agriculture & Food Products']],
    ['Kundan jewellery', ['Gems & Jewellery']],
    ['tablets, capsules and syrups', ['Pharmaceuticals & Healthcare']],
    ['CNC machined parts, pumps and valves', ['Machinery & Industrial Equipment']],
    ['corrugated boxes and printed pouches', ['Packaging & Printing']],
    ['cotton yarn and knitted fabric', ['Textiles & Apparel']],
    ['brake pads, clutch plates and pistons for two wheelers', ['Auto Parts & Vehicles']],
    ['brass idols and terracotta gifts', ['Handicrafts & Gifts']],
    ['office furniture and sofas', ['Furniture & Home Decor']],
    ['pigments, resins and solvents', ['Chemicals & Raw Materials']],
    ['nothing useful in this sentence', []],
    ['', []],
  ];
  it.each(cases)('puts %j under %j', (text, expected) => {
    expect(matchCategories(text)).toEqual(expected);
  });

  it('suggests more than one when the products really span them, never more than three', () => {
    const found = matchCategories('cotton garments, jute carpets, cement, bricks, led lights, solar inverters, rice and sugar');
    expect(found.length).toBeGreaterThan(1);
    expect(found.length).toBeLessThanOrEqual(3);
  });

  it('does not suggest Plastics for rice sold in plastic bags', () => {
    expect(matchCategories('Basmati rice in 25kg bags')).toEqual(['Agriculture & Food Products']);
  });
});

describe('reading a description of a business', () => {
  it('reads a typical sentence', () => {
    const reading = readBusiness('We manufacture HDPE pipes and fittings in Vadodara, Gujarat. 15 years in business.', NOW);
    expect(reading).toMatchObject({
      businessType: 'Manufacturer',
      tradeType: 'domestic',
      categories: ['Plastics & Rubber'],
      products: ['HDPE pipes', 'Fittings'],
      city: 'Vadodara',
      state: 'Gujarat',
      yearsInBusiness: 15,
      yearEstablished: null,
      companyName: null,
      understood: true,
    });
  });

  it('reads the name, the products and the year of an introduction', () => {
    const reading = readBusiness('Sunrise Polymers Pvt Ltd - leading manufacturer of PVC pipes, CPVC fittings & water tanks. Est. 1998, Rajkot', NOW);
    expect(reading.companyName).toBe('Sunrise Polymers Pvt Ltd');
    expect(reading.businessType).toBe('Manufacturer');
    expect(reading.products).toEqual(['PVC pipes', 'CPVC fittings', 'Water tanks']);
    expect(reading.categories).toEqual(['Plastics & Rubber']);
    expect(reading.yearEstablished).toBe(1998);
    expect(reading.city).toBe('Rajkot');
    expect(reading.state).toBe('Gujarat');
  });

  it('reads products said before the role, and an exporter', () => {
    const reading = readBusiness('Cotton hosiery garments exporter from Tiruppur', NOW);
    expect(reading.businessType).toBe('Exporter');
    expect(reading.tradeType).toBe('export');
    expect(reading.products).toEqual(['Cotton hosiery garments']);
    expect(reading.categories).toEqual(['Textiles & Apparel']);
    expect(reading.city).toBe('Tiruppur');
    expect(reading.state).toBe('Tamil Nadu');
  });

  it('puts a manufacturer who also exports down as a manufacturer, and goes through "manufacturer and exporter of"', () => {
    const reading = readBusiness('Manufacturer and exporter of cotton hosiery garments from Tiruppur', NOW);
    expect(reading.businessTypes).toEqual(['Manufacturer', 'Exporter']);
    expect(reading.businessType).toBe('Manufacturer');
    expect(reading.tradeType).toBe('export');
    expect(reading.products).toEqual(['Cotton hosiery garments']);
  });

  it('reads a list with no verb', () => {
    const reading = readBusiness('Industrial valves, pumps and hydraulic cylinders - Coimbatore', NOW);
    expect(reading.products).toEqual(['Industrial valves', 'Pumps', 'Hydraulic cylinders']);
    expect(reading.categories).toEqual(['Machinery & Industrial Equipment']);
    expect(reading.city).toBe('Coimbatore');
  });

  it('reads products made by someone who says "making"', () => {
    const reading = readBusiness('We are a WHO-GMP certified pharmaceutical company making tablets, capsules and syrups in Baddi, Himachal Pradesh', NOW);
    expect(reading.businessType).toBe('Manufacturer');
    expect(reading.products).toEqual(['Tablets', 'Capsules', 'Syrups']);
    expect(reading.categories).toEqual(['Pharmaceuticals & Healthcare']);
    expect(reading.city).toBe('Baddi');
    expect(reading.state).toBe('Himachal Pradesh');
    expect(reading.companyName).toBeNull();
  });

  it('reads "we process and export" as a manufacturer who exports', () => {
    const reading = readBusiness('We process and export basmati rice from Karnal, Haryana', NOW);
    expect(reading.businessTypes).toEqual(['Manufacturer', 'Exporter']);
    expect(reading.businessType).toBe('Manufacturer');
    expect(reading.tradeType).toBe('export');
    expect(reading.products).toEqual(['Basmati rice']);
    expect(reading.categories).toEqual(['Agriculture & Food Products']);
    expect(reading.city).toBe('Karnal');
    expect(reading.state).toBe('Haryana');
  });

  it('puts products said before the role in the right place, lower case or not', () => {
    const reading = readBusiness('ladies kurtis and sarees manufacturer in Surat', NOW);
    expect(reading.products).toEqual(['Ladies kurtis', 'Sarees']);
    expect(reading.city).toBe('Surat');
    expect(reading.categories).toEqual(['Textiles & Apparel']);
  });

  it('writes the usual abbreviations in capitals, however they were typed', () => {
    expect(readBusiness('we make hdpe pipes and pvc fittings', NOW).products).toEqual(['HDPE pipes', 'PVC fittings']);
  });

  it('does not mistake where something is sold for what is made', () => {
    const reading = readBusiness('We supply to retailers in Mumbai', NOW);
    expect(reading.products).toEqual([]);
    expect(reading.city).toBe('Mumbai');
    expect(reading.state).toBe('Maharashtra');
  });

  it('reads the year a business started and how long it has been going, only when they are written', () => {
    expect(readBusiness('Since 1995 we make rubber gaskets', NOW).yearEstablished).toBe(1995);
    expect(readBusiness('20+ years of experience in steel fabrication', NOW).yearsInBusiness).toBe(20);
    expect(readBusiness('we make gaskets', NOW)).toMatchObject({ yearEstablished: null, yearsInBusiness: null });
    expect(readBusiness('established in 2090', NOW).yearEstablished).toBeNull();
    expect(readBusiness('5 years warranty on every pump', NOW).yearsInBusiness).toBeNull();
  });

  it('takes the state from a GST number when the sentence does not name one, and ignores the number as words', () => {
    const reading = readBusiness('GST 24AAACC1206D1ZM chemical trader', NOW);
    expect(reading.gstin?.state).toBe('Gujarat');
    expect(reading.state).toBe('Gujarat');
    expect(reading.city).toBeNull();
    expect(reading.businessType).toBe('Wholesaler');
    expect(reading.categories).toEqual(['Chemicals & Raw Materials']);
  });

  it('keeps the state it was told over the state in the GST number', () => {
    expect(readBusiness('24AAACC1206D1ZM steel fabrication Pune', NOW)).toMatchObject({ city: 'Pune', state: 'Maharashtra' });
  });

  it('knows an importer from "imported" machines', () => {
    expect(readBusiness('We import electronic components from China', NOW).businessType).toBe('Importer');
    expect(readBusiness('We make cables using imported copper', NOW).businessType).toBe('Manufacturer');
    expect(readBusiness('We make cables using imported copper', NOW).tradeType).toBe('domestic');
  });

  it('does not call a description of a business its name', () => {
    expect(readBusiness('We are an International Company making cables', NOW).companyName).toBeNull();
    expect(readBusiness('International Polymers Pvt Ltd makes buckets', NOW).companyName).toBe('International Polymers Pvt Ltd');
    expect(readBusiness('our company is Sai Polymers, we make buckets', NOW).companyName).toBe('Sai Polymers');
  });

  it('understands nothing from words that say nothing, and does not make things up', () => {
    for (const text of ['', 'hi', 'hello', 'asdfgh', 'I want to sell products', '12345', '???']) {
      expect(readBusiness(text, NOW)).toMatchObject({
        understood: false,
        categories: [],
        products: [],
        city: null,
        state: null,
        companyName: null,
        businessType: null,
        gstin: null,
      });
    }
  });

  // sentences as manufacturers really write them: abbreviations, lists with no verb, claims and places mixed in
  const realWorld: Array<[string, Partial<ReturnType<typeof readBusiness>>]> = [
    [
      'We are manufacturers of stainless steel kitchen sinks and utensils in Rajkot, Gujarat. 12 years experience',
      { businessType: 'Manufacturer', products: ['Stainless steel kitchen sinks', 'Utensils'], city: 'Rajkot', state: 'Gujarat', yearsInBusiness: 12 },
    ],
    ['Basmati rice exporter Karnal', { businessType: 'Exporter', tradeType: 'export', products: ['Basmati rice'], city: 'Karnal', state: 'Haryana' }],
    ['mfg of electric motors and pumps, Coimbatore', { businessType: 'Manufacturer', products: ['Electric motors', 'Pumps'], city: 'Coimbatore' }],
    [
      'Leading manufacturer and supplier of PP woven sacks, FIBC bags, HDPE fabric — Ahmedabad',
      { businessType: 'Manufacturer', products: ['PP woven sacks', 'FIBC bags', 'HDPE fabric'], city: 'Ahmedabad' },
    ],
    ['We deal in industrial fasteners. Located in Ludhiana Punjab', { businessType: 'Wholesaler', city: 'Ludhiana', state: 'Punjab' }],
    [
      // the products are said before the role: what comes after it is a place and claims, which are not products
      'Ayurvedic medicines and herbal cosmetics manufacturer in Haridwar, Uttarakhand — GMP certified, ISO 9001',
      { businessType: 'Manufacturer', products: ['Ayurvedic medicines', 'Herbal cosmetics'], categories: ['Pharmaceuticals & Healthcare'], city: 'Haridwar', state: 'Uttarakhand' },
    ],
    ['Cotton sarees, handloom, wholesale from Salem', { businessType: 'Wholesaler', products: ['Cotton sarees', 'Handloom'], city: 'Salem', state: 'Tamil Nadu' }],
    ['I own a rice mill in Thanjavur', { businessType: 'Manufacturer', products: ['Rice mill'], categories: ['Agriculture & Food Products'], city: 'Thanjavur' }],
    ['we are small scale unit making gaskets for automobile industry, Pune MIDC', { products: ['Gaskets'], categories: ['Auto Parts & Vehicles'], city: 'Pune' }],
    ['manufacturing of corrugated boxes, mono cartons and labels | Noida Sector 63', { products: ['Corrugated boxes', 'Mono cartons', 'Labels'], city: 'Noida', state: 'Uttar Pradesh' }],
    ['Plywood, flush doors, laminates, Yamunanagar Haryana', { products: ['Plywood', 'Flush doors', 'Laminates'], city: 'Yamunanagar', state: 'Haryana' }],
    ['Importer of electronic components, Mumbai', { businessType: 'Importer', tradeType: 'import', products: ['Electronic components'], city: 'Mumbai' }],
    ['we produce cold pressed groundnut oil and sesame oil, Erode', { products: ['Cold pressed groundnut oil', 'Sesame oil'], city: 'Erode' }],
    [
      // the firm's own name is not a product
      'Sri Lakshmi Engineering Works - CNC turned components, brass parts, Jamnagar',
      { companyName: 'Sri Lakshmi Engineering Works', products: ['CNC turned components', 'Brass parts'], city: 'Jamnagar', state: 'Gujarat' },
    ],
    [
      // "20 years" is a claim, not a product
      'Ladies garments manufacturer & exporter, Tiruppur, Tamil Nadu, 20 years',
      { businessType: 'Manufacturer', tradeType: 'export', products: ['Ladies garments'], city: 'Tiruppur', state: 'Tamil Nadu' },
    ],
    ['trader of cement, steel and tiles in Hyderabad', { businessType: 'Wholesaler', products: ['Cement', 'Steel', 'Tiles'], city: 'Hyderabad', state: 'Telangana' }],
    ['fabrication of mild steel structures, gates, grills and roofing sheets. Bhiwandi', { products: ['Mild steel structures', 'Gates', 'Grills', 'Roofing sheets'], city: 'Bhiwandi' }],
    ['We make LED bulbs, battens and panel lights. Delhi NCR', { products: ['LED bulbs', 'Battens', 'Panel lights'], city: 'Delhi', state: 'Delhi' }],
  ];
  it.each(realWorld)('reads "%s"', (text, expected) => {
    expect(readBusiness(text, NOW)).toMatchObject(expected);
  });

  it('keeps to a short list of products', () => {
    const many = readBusiness('We make bolts, nuts, screws, washers, rivets, pins, studs, anchors, clamps, hooks and spacers', NOW);
    expect(many.products.length).toBeLessThanOrEqual(8);
  });

  it('gives the same answer every time', () => {
    const text = 'We manufacture HDPE pipes and fittings in Vadodara, Gujarat';
    expect(readBusiness(text, NOW)).toEqual(readBusiness(text, NOW));
  });
});

describe('the company record', () => {
  const draft: SignupDraft = {
    companyName: '  Sunrise Polymers Pvt Ltd ',
    businessType: 'Manufacturer',
    categories: ['Plastics & Rubber'],
    products: ['PVC pipes', 'CPVC fittings'],
    city: 'Rajkot',
    state: 'Gujarat',
    country: 'India',
    gstin: '24aaacc1206d1zm',
    description: 'We make PVC pipes in Rajkot.',
    tradeType: 'domestic',
    yearEstablished: 1998,
    yearsInBusiness: null,
    fullName: 'Priya Nair',
    phone: '+919876543210',
  };

  it('builds a row with only the columns the companies table has', () => {
    const row = buildCompanyRow(draft, 'user-1', 1_700_000_000_000);
    expect(row).toEqual({
      owner_id: 'user-1',
      company_name: 'Sunrise Polymers Pvt Ltd',
      slug: `sunrise-polymers-pvt-ltd-${(1_700_000_000_000).toString(36)}`,
      business_type: 'Manufacturer',
      gst_number: '24AAACC1206D1ZM',
      pan_number: 'AAACC1206D',
      city: 'Rajkot',
      state: 'Gujarat',
      country: 'India',
      description: 'We make PVC pipes in Rajkot.',
      product_categories: ['Plastics & Rubber'],
      key_products: ['PVC pipes', 'CPVC fittings'],
      trade_type: 'domestic',
      year_established: 1998,
      years_in_business: null,
      verification_status: 'unverified',
      onboarding_step: 2,
      onboarding_completed: false,
      profile_completion: 85,
    });
  });

  it('leaves out what was not given and never invents a GST or PAN number', () => {
    const row = buildCompanyRow({ ...draft, gstin: '', city: ' ', state: '', description: '', categories: [], products: [] }, 'user-1');
    expect(row).toMatchObject({ gst_number: null, pan_number: null, city: null, state: null, description: null, profile_completion: 20 });
  });

  it('keeps a GST number that does not decode, as typed, without a PAN', () => {
    expect(buildCompanyRow({ ...draft, gstin: 'abc123' }, 'u')).toMatchObject({ gst_number: 'ABC123', pan_number: null });
  });

  it('never starts a company as verified', () => {
    expect(buildCompanyRow(draft, 'u')).toMatchObject({ verification_status: 'unverified', onboarding_completed: false });
    expect(buildCompanyRow(draft, 'u')).not.toHaveProperty('is_verified');
  });

  it('scores the profile on the wizard scale', () => {
    expect(signupCompletionScore(draft)).toBe(85);
    expect(signupCompletionScore({ ...draft, gstin: '' })).toBe(60);
    expect(signupCompletionScore({ ...draft, phone: '' })).toBe(65);
  });

  it('makes web-address parts that are safe and different each time', () => {
    expect(makeCompanySlug('Shree  Ganesh & Sons (P) Ltd.', 1000)).toBe(`shree-ganesh-sons-p-ltd-${(1000).toString(36)}`);
    expect(makeCompanySlug('!!!', 1000)).toBe(`company-${(1000).toString(36)}`);
    expect(makeCompanySlug('a', 1)).not.toBe(makeCompanySlug('a', 2));
  });

  it('puts the person\'s phone and place on their own profile', () => {
    expect(buildProfileUpdate(draft)).toMatchObject({ full_name: 'Priya Nair', phone: '+919876543210', city: 'Rajkot', state: 'Gujarat', country: 'India' });
  });
});
