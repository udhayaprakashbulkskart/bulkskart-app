/**
 * Refresh-scoped RFQ lead board.
 * One seed picks a new set of sample leads. Generation is O(n), in memory, no network.
 * Phones are synthesized per lead and never copied from a shared placeholder number.
 */
import {
  formatLeadDate,
  getUniqueLeadContact,
  hashSeed,
  uniqueLeadDeadline,
} from '@/lib/uniqueLeadContact';

export interface LeadTemplate {
  title: string;
  quantity: number;
  quantityUnit: string;
  country: string;
  city: string;
  buyerCompany: string;
  contactName: string;
  incoterm: string;
}

const LEAD_TEMPLATES: LeadTemplate[] = [
  { title: 'MS Pipe 25mm ERW IS 1239 Medium Class', quantity: 50000, quantityUnit: 'Pieces', country: 'India', city: 'Rajkot, Gujarat', buyerCompany: 'Kaveri Tube Traders', contactName: 'Mehul Patel', incoterm: 'FOR Rajkot' },
  { title: 'Cotton Fabric 100% Cotton Knitted 180 GSM', quantity: 10000, quantityUnit: 'Meters', country: 'India', city: 'Tiruppur, Tamil Nadu', buyerCompany: 'Sri Amman Knit Exports', contactName: 'Priya Subramanian', incoterm: 'FOB Tuticorin' },
  { title: 'Plastic Granules HDPE Blow Moulding Grade', quantity: 10000, quantityUnit: 'kg', country: 'India', city: 'Ahmedabad, Gujarat', buyerCompany: 'Orbit Polymer Sales', contactName: 'Nirav Shah', incoterm: 'Ex-Works Ahmedabad' },
  { title: 'TWS Bluetooth 5.3 Earbuds with ANC Charging Case', quantity: 8000, quantityUnit: 'Pieces', country: 'USA', city: 'Los Angeles, CA', buyerCompany: 'Northline Audio LLC', contactName: 'Daniel Cho', incoterm: 'FOB Shenzhen' },
  { title: 'Tier-1 Monocrystalline 550W Bifacial Solar PV Modules', quantity: 2400, quantityUnit: 'Pieces', country: 'UAE', city: 'Dubai', buyerCompany: 'Noor Desert Solar FZE', contactName: 'Hassan Al Farsi', incoterm: 'CIF Jebel Ali' },
  { title: '48V 100Ah LiFePO4 Battery Energy Storage 5.12kWh', quantity: 600, quantityUnit: 'Units', country: 'Germany', city: 'Hamburg', buyerCompany: 'Nordwatt Speicher GmbH', contactName: 'Lena Hoffmann', incoterm: 'DAP Hamburg' },
  { title: 'Custom Biodegradable Kraft Stand-Up Pouches', quantity: 200000, quantityUnit: 'Pieces', country: 'UK', city: 'Manchester', buyerCompany: 'Harbour Pantry Ltd', contactName: 'Owen Clarke', incoterm: 'CIF Felixstowe' },
  { title: 'High-Waist Seamless Gym Leggings Nylon Spandex', quantity: 15000, quantityUnit: 'Pieces', country: 'Australia', city: 'Melbourne', buyerCompany: 'Southbank Active Pty', contactName: 'Amelia Grant', incoterm: 'FOB Chennai' },
  { title: 'Heavyweight Organic Cotton Blank Hoodies 450 GSM', quantity: 6000, quantityUnit: 'Pieces', country: 'USA', city: 'New York, NY', buyerCompany: 'Hudson Apparel Group', contactName: 'Maya Ellison', incoterm: 'FOB Nhava Sheva' },
  { title: '8-Station Rotary Premade Pouch Packaging Machine', quantity: 2, quantityUnit: 'Sets', country: 'India', city: 'Pune, Maharashtra', buyerCompany: 'Deccan Pack Systems', contactName: 'Anil Kulkarni', incoterm: 'FOR Pune' },
  { title: '3000W Industrial CNC Fiber Laser Sheet Cutting Machine', quantity: 1, quantityUnit: 'Sets', country: 'UAE', city: 'Sharjah', buyerCompany: 'Gulf Metal Fab LLC', contactName: 'Tariq Nasser', incoterm: 'CIF Sharjah' },
  { title: 'Cotton Sarees Wholesale Bulk Sourcing', quantity: 5000, quantityUnit: 'Pieces', country: 'India', city: 'Surat, Gujarat', buyerCompany: 'Rangoli Textile House', contactName: 'Kavita Desai', incoterm: 'Ex-Works Surat' },
  { title: 'SS304 Seamless Pipe Sch 40 ASTM A312', quantity: 40, quantityUnit: 'Metric Tons', country: 'Singapore', city: 'Jurong', buyerCompany: 'Meridian Process Piping', contactName: 'Wei Jun Tan', incoterm: 'CIF Singapore' },
  { title: 'Virgin PP Homopolymer Raffia Grade H030SG', quantity: 24, quantityUnit: 'Metric Tons', country: 'Vietnam', city: 'Ho Chi Minh City', buyerCompany: 'Saigon Raffia Co.', contactName: 'Minh Tran', incoterm: 'FOB Ho Chi Minh' },
  { title: 'Corrugated 5-Ply RSC Cartons Custom Print', quantity: 50000, quantityUnit: 'Pieces', country: 'India', city: 'Bhiwandi, Maharashtra', buyerCompany: 'Western Carton Works', contactName: 'Sandeep More', incoterm: 'FOR Bhiwandi' },
  { title: 'Cold-Pressed Castor Oil USP Grade Drums', quantity: 80, quantityUnit: 'Drums', country: 'France', city: 'Lyon', buyerCompany: 'Atelier Botanique SAS', contactName: 'Camille Bernard', incoterm: 'CIF Le Havre' },
  { title: 'Industrial Ball Bearings 6205-2RS SKF Equivalent', quantity: 20000, quantityUnit: 'Pieces', country: 'Germany', city: 'Stuttgart', buyerCompany: 'Keller Antriebstechnik', contactName: 'Jonas Keller', incoterm: 'DAP Stuttgart' },
  { title: 'Enameled Copper Winding Wire 1.2mm Class H', quantity: 8, quantityUnit: 'Metric Tons', country: 'India', city: 'Coimbatore, Tamil Nadu', buyerCompany: 'Lakshmi Magnet Wire', contactName: 'Karthik Rajan', incoterm: 'FOR Coimbatore' },
  { title: 'Commercial LED Panel 600x600 40W 4000K', quantity: 3000, quantityUnit: 'Pieces', country: 'UAE', city: 'Abu Dhabi', buyerCompany: 'Pearl Fitout Contracting', contactName: 'Omar Al Suwaidi', incoterm: 'DDP Abu Dhabi' },
  { title: 'Basmati Rice 1121 Steam 25kg Export Bags', quantity: 200, quantityUnit: 'Metric Tons', country: 'Saudi Arabia', city: 'Jeddah', buyerCompany: 'Red Sea Grain Trading', contactName: 'Faisal Al Harbi', incoterm: 'CIF Jeddah' },
  { title: 'Hydraulic Excavator 20-Ton Crawler Class', quantity: 3, quantityUnit: 'Units', country: 'Kenya', city: 'Nairobi', buyerCompany: 'Savanna Plant Hire Ltd', contactName: 'David Otieno', incoterm: 'CIF Mombasa' },
  { title: 'PET Preform 28mm 18g Water Bottle Grade', quantity: 500000, quantityUnit: 'Pieces', country: 'India', city: 'Daman', buyerCompany: 'Coastal Beverage Pack', contactName: 'Rakesh Tandel', incoterm: 'FOR Daman' },
  { title: 'Nitrile Examination Gloves Blue Powder-Free', quantity: 400, quantityUnit: 'Cartons', country: 'UK', city: 'Birmingham', buyerCompany: 'Midlands Clinical Supply', contactName: 'Hannah Brooks', incoterm: 'DAP Birmingham' },
  { title: 'Aluminium Solar Mounting Rail 6005-T5', quantity: 12000, quantityUnit: 'Meters', country: 'Australia', city: 'Brisbane', buyerCompany: 'Reef Solar Structures', contactName: 'Noah Bennett', incoterm: 'CIF Brisbane' },
  { title: 'Ceramic Floor Tile 600x600mm Matt Finish', quantity: 8000, quantityUnit: 'Square Meters', country: 'Qatar', city: 'Doha', buyerCompany: 'Lusail Interiors WLL', contactName: 'Yousef Al Kuwari', incoterm: 'CIF Hamad' },
  { title: 'Spice Mix Export Lot Turmeric Finger Salem', quantity: 25, quantityUnit: 'Metric Tons', country: 'India', city: 'Erode, Tamil Nadu', buyerCompany: 'Malabar Harvest Exports', contactName: 'Senthil Kumar', incoterm: 'FOB Chennai' },
  { title: 'Office Mesh Chair OEM Gas Lift Black', quantity: 1200, quantityUnit: 'Pieces', country: 'USA', city: 'Dallas, TX', buyerCompany: 'Plains Contract Furniture', contactName: 'Chris Alvarez', incoterm: 'FOB Mundra' },
  { title: 'HDPE Jerry Cans 20L Food Grade Natural', quantity: 15000, quantityUnit: 'Pieces', country: 'South Africa', city: 'Durban', buyerCompany: 'Harbour Chemical Distributors', contactName: 'Thabo Ndlovu', incoterm: 'CIF Durban' },
  { title: 'MCCB 250A 3-Pole 36kA Panel Series', quantity: 400, quantityUnit: 'Pieces', country: 'India', city: 'Hyderabad, Telangana', buyerCompany: 'Deccan Switchgear', contactName: 'Farhan Qureshi', incoterm: 'FOR Hyderabad' },
  { title: 'Mulberry Silk Fabric 16mm Dyed Rolls', quantity: 4000, quantityUnit: 'Meters', country: 'Italy', city: 'Como', buyerCompany: 'Seta Lago Atelier', contactName: 'Giulia Romano', incoterm: 'CIF Genoa' },
  { title: 'Forklift 3-Ton Diesel Container Mast', quantity: 6, quantityUnit: 'Units', country: 'UAE', city: 'Jebel Ali', buyerCompany: 'Anchor Yard Equipment', contactName: 'Imran Siddiqui', incoterm: 'CIF Jebel Ali' },
  { title: 'Laboratory Glass Beaker Borosilicate Set', quantity: 2000, quantityUnit: 'Sets', country: 'Germany', city: 'Munich', buyerCompany: 'Bayerische Labortechnik', contactName: 'Sofia Krüger', incoterm: 'DAP Munich' },
  { title: 'Rubber Sheet NBR 6mm Industrial Rolls', quantity: 300, quantityUnit: 'Rolls', country: 'India', city: 'Kolkata, West Bengal', buyerCompany: 'Hooghly Rubber Mart', contactName: 'Arjun Bose', incoterm: 'FOR Kolkata' },
  { title: 'Green Coffee Arabica AA Screen 18', quantity: 60, quantityUnit: 'Metric Tons', country: 'Japan', city: 'Kobe', buyerCompany: 'Kobe Roast Importers', contactName: 'Haruto Fujii', incoterm: 'CIF Kobe' },
  { title: 'PVC Conduit Pipe 25mm ISI Medium', quantity: 100000, quantityUnit: 'Meters', country: 'India', city: 'Indore, Madhya Pradesh', buyerCompany: 'Malwa Electricals', contactName: 'Deepak Jain', incoterm: 'FOR Indore' },
  { title: 'Stainless Kitchen Sink Double Bowl 304', quantity: 800, quantityUnit: 'Pieces', country: 'Canada', city: 'Toronto', buyerCompany: 'Lakeshore Kitchen Supply', contactName: 'Emily Walsh', incoterm: 'CIF Toronto' },
];

const QTY_FACTORS = [1, 0.5, 1.5, 2, 0.8, 3] as const;

export interface RefreshLead {
  id: string;
  title: string;
  quantity: number;
  quantityUnit: string;
  country: string;
  city: string;
  flag: string;
  dialCode: string;
  buyerCompany: string;
  contactName: string;
  incoterm: string;
  phone: string;
  maskedPhone: string;
  deadlineLabel: string;
  postedLabel: string;
  verified: boolean;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function postedLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function createLeadSeed(): string {
  const entropy = new Uint32Array(2);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(entropy);
  } else {
    entropy[0] = Date.now() >>> 0;
    entropy[1] = (Date.now() % 997) >>> 0;
  }
  return `${Date.now().toString(36)}-${entropy[0].toString(36)}-${entropy[1].toString(36)}`;
}

/** New board for this seed. Same seed is stable; a new seed (each refresh) is a new board. */
export function buildRefreshLeadBoard(seed: string, count = 12): RefreshLead[] {
  const rng = mulberry32(hashSeed(seed || 'bulkskart-leads'));
  const order = LEAD_TEMPLATES.map((_, index) => index);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = order[i];
    order[i] = order[j];
    order[j] = swap;
  }

  const take = Math.min(count, order.length);
  const usedPhones = new Set<string>();
  const leads: RefreshLead[] = [];

  for (let slot = 0; slot < take; slot++) {
    const template = LEAD_TEMPLATES[order[slot]];
    const factor = QTY_FACTORS[Math.floor(rng() * QTY_FACTORS.length)];
    const quantity = Math.max(1, Math.round(template.quantity * factor));
    const minutesAgo = 4 + Math.floor(rng() * 60 * 36);
    let contact = getUniqueLeadContact({
      seed: `${seed}:${template.title}:${slot}`,
      country: template.country,
    });
    let salt = 0;
    while (usedPhones.has(contact.phone) && salt < 6) {
      salt += 1;
      contact = getUniqueLeadContact({
        seed: `${seed}:${template.title}:${slot}:retry${salt}`,
        country: template.country,
      });
    }
    usedPhones.add(contact.phone);
    const deadline = uniqueLeadDeadline(`${seed}:due:${slot}`);

    leads.push({
      id: `refresh-lead-${hashSeed(`${seed}:${slot}:${template.title}`).toString(36)}`,
      title: template.title,
      quantity,
      quantityUnit: template.quantityUnit,
      country: contact.country,
      city: template.city,
      flag: contact.flag,
      dialCode: contact.dialCode,
      buyerCompany: template.buyerCompany,
      contactName: template.contactName,
      incoterm: template.incoterm,
      phone: contact.phone,
      maskedPhone: contact.maskedPhone,
      deadlineLabel: formatLeadDate(deadline),
      postedLabel: postedLabel(minutesAgo),
      verified: rng() > 0.28,
    });
  }

  return leads;
}
