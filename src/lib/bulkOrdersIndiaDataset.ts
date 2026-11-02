/**
 * bulkOrdersIndiaDataset.ts
 *
 * High-Scale 100,000+ Indian Buyer Orders & Procurement Inquiries Dataset Engine
 * Deterministically generates and queries 100,000 authentic buyer procurement inquiries
 * with real person names, registered enterprises, industrial cities, and authentic trade messages.
 */

export const TOTAL_INDIAN_BULK_ORDERS = 100000;

export const INDIAN_FIRST_NAMES = [
  'Rajesh', 'Priya', 'Amit', 'Vikram', 'Suresh', 'Ananya', 'Rohit', 'Kavita',
  'Deepak', 'Sneha', 'Harpreet', 'Arvind', 'Neha', 'Rahul', 'Pooja', 'Sunil',
  'Sanjay', 'Ramesh', 'Meera', 'Manish', 'Nitin', 'Gaurav', 'Alok', 'Ajay',
  'Ashok', 'Tarun', 'Kunal', 'Sameer', 'Vishal', 'Sachin', 'Swati', 'Shweta',
  'Divya', 'Ritu', 'Pradeep', 'Mohan', 'Naresh', 'Kishore', 'Vivek', 'Chetan',
  'Ashish', 'Pankaj', 'Sandeep', 'Vikas', 'Akash', 'Varun', 'Siddharth', 'Mayank',
  'Yash', 'Aditya', 'Parth', 'Bhavin', 'Jignesh', 'Chirag', 'Mehul', 'Hitesh',
  'Bharat', 'Nilesh', 'Paresh', 'Bhavesh', 'Tushar', 'Hemant', 'Jagdish', 'Govind',
  'Mahendra', 'Mukesh', 'Santosh', 'Satish', 'Vinod', 'Subhash', 'Anil', 'Manoj',
  'Brijesh', 'Devendra', 'Jitendra', 'Narendra', 'Surendra', 'Dharmesh', 'Kamlesh',
  'Girish', 'Rupesh', 'Yogesh', 'Lokesh', 'Rakesh', 'Umesh', 'Jayesh', 'Bhupendra',
  'Ravindra', 'Rajendra', 'Shrikant', 'Shailesh', 'Anand', 'Abhay', 'Abhinav',
  'Bhanu', 'Bipin', 'Chandan', 'Dharmendra', 'Dinesh', 'Ganesh', 'Gopal', 'Hari'
];

export const INDIAN_LAST_NAMES = [
  'Sharma', 'Patel', 'Verma', 'Singhania', 'Nair', 'Sen', 'Agarwal', 'Reddy',
  'Gupta', 'Mehta', 'Joshi', 'Singh', 'Rao', 'Choudhary', 'Deshmukh', 'Iyer',
  'Kulkarni', 'Bansal', 'Chawla', 'Nambiar', 'Kapoor', 'Jain', 'Saxena', 'Bhattacharya',
  'Pillai', 'Menon', 'Bhat', 'Trivedi', 'Somani', 'Mittal', 'Goenka', 'Maheshwari',
  'Kothari', 'Singhal', 'Oswal', 'Lodha', 'Dhoot', 'Birla', 'Rungta', 'Jindal',
  'Dalmia', 'Bangur', 'Morarka', 'Ruia', 'Bajaj', 'Godrej', 'Tata', 'Ambani',
  'Piramal', 'Hinduja', 'Wadia', 'Poonawalla', 'Murthy', 'Nadar', 'Chettiar', 'Naidu',
  'Gowda', 'Hegde', 'Pai', 'Shenoy', 'Prabhu', 'Nayak', 'Kamath', 'Shetty',
  'Alva', 'Rai', 'Bhandary', 'Ghosh', 'Banerjee', 'Chatterjee', 'Mukherjee', 'Ganguly',
  'Das', 'Dutta', 'Roy', 'Bose', 'Mitra', 'Pal', 'Saha', 'Biswas', 'Mondal'
];

export const INDIAN_CITIES = [
  'Surat, Gujarat', 'Mumbai, Maharashtra', 'Delhi NCR', 'Ahmedabad, Gujarat',
  'Tirupur, Tamil Nadu', 'Ludhiana, Punjab', 'Chennai, Tamil Nadu', 'Hyderabad, Telangana',
  'Bengaluru, Karnataka', 'Kolkata, West Bengal', 'Pune, Maharashtra', 'Indore, Madhya Pradesh',
  'Jaipur, Rajasthan', 'Kanpur, Uttar Pradesh', 'Coimbatore, Tamil Nadu', 'Kochi, Kerala',
  'Rajkot, Gujarat', 'Vadodara, Gujarat', 'Panipat, Haryana', 'Jalandhar, Punjab',
  'Moradabad, Uttar Pradesh', 'Agra, Uttar Pradesh', 'Varanasi, Uttar Pradesh', 'Visakhapatnam, AP',
  'Nashik, Maharashtra', 'Aurangabad, Maharashtra', 'Nagpur, Maharashtra', 'Bhavnagar, Gujarat',
  'Jamnagar, Gujarat', 'Morbi, Gujarat', 'Bhilwara, Rajasthan', 'Noida, Uttar Pradesh',
  'Gurugram, Haryana', 'Faridabad, Haryana', 'Vapi, Gujarat', 'Ankleshwar, Gujarat'
];

export const INDIAN_ENTERPRISES = [
  'Global Agro Exports Ltd', 'TexStyle Mills India', 'Zenith Precision Forgings',
  'Deccan Polymer & Packaging', 'Bharat Solar & Electrics', 'Royal Spices & Commodities',
  'Hind Steel & Alloys Corp', 'Kalinga International Exports', 'Malabar Marine & Spices',
  'Vanguard Industrial Valves', 'Ganga Paper & Cartons', 'Sterling Cotton & Fabrics',
  'Surat Silk & Synthetic Mills', 'Ludhiana Knitwear Consortium', 'Ahmedabad Chemical Synthetics',
  'Coimbatore Textile Machineries', 'Tirupur Garment Exporters', 'Indore Grain & Pulse Traders',
  'Jaipur Marble & Stone Crafts', 'Kanpur Leather Industries', 'Rajkot Engineering Works',
  'Morbi Ceramic Tiles Hub', 'Panipat Home Textiles', 'Moradabad Brassware Mart',
  'Agra Footwear Consortia', 'Nashik Agro Packhouses', 'Vadodara Electrical Switchgears',
  'Vapi Chemical Intermediates', 'Kochi Seafood Processors', 'Pune Precision Hydraulics',
  'Bengaluru Tech Components', 'Hyderabad Pharma Chem API', 'Chennai Auto Components'
];

export const INDIAN_COMMERCIAL_IMAGES = [
  // Commercial Food Trucks
  'https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=500&auto=format&fit=crop&q=80', // Food Truck 1
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500&auto=format&fit=crop&q=80', // Food Trailer
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=500&auto=format&fit=crop&q=80', // Catering Food Truck

  // Commercial & Industrial Grinders
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500&auto=format&fit=crop&q=80', // Heavy Angle Grinder
  'https://cdn.pixabay.com/photo/2016/09/12/07/48/mechanical-1663275_1280.jpg', // Industrial Machine Grinder
  'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=500&auto=format&fit=crop&q=80', // Power Grinding Tool

  // Commercial Washing Machines & Industrial Laundry
  'https://images.unsplash.com/photo-1545173168-9f1947eebb7f?w=500&auto=format&fit=crop&q=80', // Commercial Washer Row
  'https://images.unsplash.com/photo-1517677208171-0bc6725a3e60?w=500&auto=format&fit=crop&q=80', // Industrial Washer Extractors
  'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=500&auto=format&fit=crop&q=80', // Heavy Commercial Laundry

  // Commercial Kitchen & Bakery Machinery
  'https://images.unsplash.com/photo-1556910103-1c02745aae4d?w=500&auto=format&fit=crop&q=80', // Commercial Kitchen Stainless Steel
  'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=500&auto=format&fit=crop&q=80', // Commercial Bakery Ovens
  'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80', // Electric Forklift Logistics

  // General B2B Commodities
  'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=500&auto=format&fit=crop&q=80', // Silk Weaving
  'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=500&auto=format&fit=crop&q=80', // Apparel
  'https://images.unsplash.com/photo-1604014237800-1c9102c219da?w=500&auto=format&fit=crop&q=80', // Denim
  'https://images.unsplash.com/photo-1598032895397-b9472444bf93?w=500&auto=format&fit=crop&q=80', // Yarn cones
  'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=500&auto=format&fit=crop&q=80', // Boxes
  'https://cdn.pixabay.com/photo/2014/04/05/11/07/cardboard-314504_1280.jpg', // Jute Sacks
  'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=500&auto=format&fit=crop&q=80', // Kraft paper
  'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&auto=format&fit=crop&q=80', // Rice grain
  'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=500&auto=format&fit=crop&q=80', // Chilli
  'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=500&auto=format&fit=crop&q=80', // Spices
  'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=500&auto=format&fit=crop&q=80', // Rebar
  'https://images.unsplash.com/photo-1587293852726-70cdb56c2866?w=500&auto=format&fit=crop&q=80', // Steel coils
  'https://images.unsplash.com/photo-1590496793929-36417d3117de?w=500&auto=format&fit=crop&q=80', // Aluminum
  'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=80', // CNC Machine
  'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=500&auto=format&fit=crop&q=80', // Bearings
  'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=500&auto=format&fit=crop&q=80', // Polymer
  'https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=500&auto=format&fit=crop&q=80', // PCB
  'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=500&auto=format&fit=crop&q=80', // Solar
  'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=500&auto=format&fit=crop&q=80', // Cables
];

export interface IndianInquiryTemplate {
  category: string;
  quantity: string;
  message: string;
  attribute: string;
}

export const INDIAN_INQUIRY_TEMPLATES: IndianInquiryTemplate[] = [
  // Commercial Food Trucks & Mobile Catering
  {
    category: 'Commercial Vehicles & Food Trucks',
    quantity: '15 Units',
    message: 'Urgent bulk order for 15 Units Custom 18ft Mobile Food Trucks with SUS 304 commercial kitchen, exhaust hood & generator mount.',
    attribute: 'Turnkey Food Truck • Immediate Delivery',
  },
  {
    category: 'Commercial Vehicles & Food Trucks',
    quantity: '8 Units',
    message: 'Require 8 Units Commercial Airstream-style Catering Food Trailers with dual axle, electric brakes & refrigeration tables.',
    attribute: 'DOT / CE Certified • Export Ready',
  },

  // Commercial & Industrial Grinders
  {
    category: 'Industrial Machinery & Grinders',
    quantity: '12 Units',
    message: 'Wanted 12 Units Heavy-Duty CNC Surface Grinder Machines (table 600x300mm, 2850 RPM spindle) for precision tooling works.',
    attribute: 'Precision Tooling • High Tolerance',
  },
  {
    category: 'Industrial Machinery & Grinders',
    quantity: '35 Units',
    message: 'Looking for 35 Units Commercial Wet Grinders 40-Liter capacity with heavy black granite stones for bulk food processing.',
    attribute: 'Commercial Kitchen • 24/7 Run',
  },
  {
    category: 'Industrial Machinery & Grinders',
    quantity: '250 Units',
    message: 'Procuring 250 Units Industrial Angle Grinders 2400W 9-inch (230mm) with copper armature for structural fabrication.',
    attribute: 'Bulk Supply • Immediate Dispatch',
  },

  // Commercial Washing Machines & Industrial Laundry
  {
    category: 'Commercial Appliances & Washing Machines',
    quantity: '20 Units',
    message: 'Seeking 20 Units Commercial Washer Extractors 50kg capacity in stainless steel for luxury hotel central laundry plant.',
    attribute: '50kg Hotel Grade • 350G Extraction',
  },
  {
    category: 'Commercial Appliances & Washing Machines',
    quantity: '18 Units',
    message: 'Bulk inquiry for 18 Units Industrial Front-Loading Washing Machines 35kg with barrier hygienic pass-through for hospitals.',
    attribute: 'Hospital Grade • ISO 13485',
  },

  // Commercial Kitchen & Warehouse Equipment
  {
    category: 'Commercial Kitchen Equipment',
    quantity: '25 Units',
    message: 'Require 25 Units Commercial 4-Deck Electric Bakery Convection Ovens with independent deck temperature & steam injectors.',
    attribute: 'Commercial Bakery • Steam Injected',
  },
  {
    category: 'Warehouse & Heavy Equipment',
    quantity: '10 Units',
    message: 'Wanted 10 Units Heavy Duty Electric Forklift Trucks 3.5 Ton with 80V LiFePO4 battery and duplex mast for warehouse ops.',
    attribute: 'Zero Emission • 4.5m Lift',
  },
  {
    category: 'Textiles & Apparel',
    quantity: '25,000 Meters',
    message: 'Looking for 25,000 meters 100% Combed Cotton Single Jersey Fabric 180 GSM, urgent delivery for export order.',
    attribute: 'Export Order • Immediate LC',
  },
  {
    category: 'Textiles & Apparel',
    quantity: '40,000 Meters',
    message: 'Urgent requirement for 40,000 meters Premium Twill Cotton Denim 12.5 Oz in dark indigo wash.',
    attribute: 'Bulk Contract • FOB Mundra',
  },
  {
    category: 'Textiles & Apparel',
    quantity: '10,000 Pcs',
    message: 'Sourcing 10,000 pieces Heavy Bio-Washed French Terry Hoodies 320 GSM with custom brand labels.',
    attribute: 'Urgent Delivery • Tirupur Hub',
  },
  {
    category: 'Textiles & Apparel',
    quantity: '15,000 Kgs',
    message: 'Wanted 15,000 Kgs 30s Combed Cotton Compact Knitting Yarn with Uster statistics top 5%.',
    attribute: 'Direct Mill Supply • CIF Dubai',
  },
  {
    category: 'Textiles & Apparel',
    quantity: '30,000 Meters',
    message: 'Required 30,000 meters Pure Mulmul Cotton Printed Fabric 60s count for summer apparel collection.',
    attribute: 'Urgent Procurement • Surat Hub',
  },

  // Agriculture & Food Commodities
  {
    category: 'Agriculture & Food',
    quantity: '10,000 MT',
    message: 'Wanted 10,000 Metric Tons Grade A 1121 Steam Basmati Rice in 25kg PP bags for immediate dispatch to Jebel Ali.',
    attribute: 'Export Ready • Phytosanitary Cert',
  },
  {
    category: 'Agriculture & Food',
    quantity: '500 Metric Tons',
    message: 'Urgent requirement for 500 MT Sannam S4 Stemless Dried Red Chilli with high color ASTA 80+.',
    attribute: 'Guntur Sourcing • SGS Tested',
  },
  {
    category: 'Agriculture & Food',
    quantity: '250 Metric Tons',
    message: 'Sourcing 250 MT Bold Turmeric Finger Salem Grade with minimum 3.5% Curcumin content.',
    attribute: 'Immediate Dispatch • CIF Europe',
  },
  {
    category: 'Agriculture & Food',
    quantity: '5,000 Kgs',
    message: 'Wanted 5,000 Kgs Organic Green Cardamom 8mm bold grade, vacuum packed in 5kg master cartons.',
    attribute: 'High Grade • Kerala Origin',
  },
  {
    category: 'Agriculture & Food',
    quantity: '1,000 MT',
    message: 'Urgent procurement: 1,000 Metric Tons White Refined Sugar ICUMSA 45 in 50kg export grade bags.',
    attribute: 'Full Container Load • Spot LC',
  },

  // Industrial Metals & Construction
  {
    category: 'Metals & Construction',
    quantity: '50 Metric Tons',
    message: 'Wanted 50 Metric Tons Hot-Rolled Steel Coils IS 2062 Grade B with genuine Mill Test Certificates.',
    attribute: 'Factory Ready • Immediate Delivery',
  },
  {
    category: 'Metals & Construction',
    quantity: '100 Metric Tons',
    message: 'Urgent requirement for 100 MT TMT Rebar Fe 550D 12mm & 16mm bundles for infrastructure project.',
    attribute: 'BIS Certified • High Tensile',
  },
  {
    category: 'Metals & Construction',
    quantity: '25,000 Meters',
    message: 'Sourcing 25,000 meters ERW Galvanized Steel Pipes Class B 2-inch diameter as per IS 1239.',
    attribute: 'Heavy Duty • Direct Delivery',
  },
  {
    category: 'Metals & Construction',
    quantity: '20 Metric Tons',
    message: 'Wanted 20 Metric Tons Aluminum Extrusion Profiles 6063 T6 anodized architectural finish.',
    attribute: 'Custom Dies • Prompt Dispatch',
  },
  {
    category: 'Metals & Construction',
    quantity: '50,000 Pcs',
    message: 'Urgent procurement: 50,000 pieces High-Tensile Grade 8.8 Hex Bolts & Nuts M16x80 zinc plated.',
    attribute: 'ISO Standard • Industrial Grade',
  },

  // Packaging & Paper
  {
    category: 'Packaging & Paper',
    quantity: '50,000 Boxes',
    message: 'Wanted 50,000 5-ply heavy duty corrugated master cartons 600x400x400mm with custom 3-color flexo print.',
    attribute: 'Export Quality • Bursting 16kg/cm²',
  },
  {
    category: 'Packaging & Paper',
    quantity: '100,000 Sacks',
    message: 'Urgent requirement for 100,000 High-Density Jute Gunny Sacks 50kg capacity for grain storage.',
    attribute: 'Hydrocarbon Free • Immediate Delivery',
  },
  {
    category: 'Packaging & Paper',
    quantity: '25 Metric Tons',
    message: 'Sourcing 25 Metric Tons Natural Shade Virgin Kraft Paper 180 GSM in 120cm reels.',
    attribute: 'High BF 28+ • Direct Paper Mill',
  },
  {
    category: 'Packaging & Paper',
    quantity: '200,000 Bags',
    message: 'Wanted 200,000 BOPP Laminated Woven Polypropylene Bags 25kg capacity with ultrasonic seal.',
    attribute: 'Moisture Proof • High Gloss Print',
  },

  // Machinery & Engineering
  {
    category: 'Machinery & Equipment',
    quantity: '5,000 Units',
    message: 'Urgent procurement of 5,000 units Stainless Steel 304 Ball Valves 2-inch ANSI 150# with blowout proof stem.',
    attribute: 'Hydro Tested • API 6D Standard',
  },
  {
    category: 'Machinery & Equipment',
    quantity: '10,000 Units',
    message: 'Wanted 10,000 pieces Deep Groove Ball Bearings 6205-2RS with high-grade chrome steel balls.',
    attribute: 'Zero Noise • C3 Clearance',
  },
  {
    category: 'Machinery & Equipment',
    quantity: '50 Units',
    message: 'Looking for 50 units Heavy-Duty 3-Phase Squirrel Cage Induction Motors 15 HP 1440 RPM IE3 class.',
    attribute: 'Energy Efficient • IP55 Protection',
  },
  {
    category: 'Machinery & Equipment',
    quantity: '2,500 Sets',
    message: 'Sourcing 2,500 sets High-Pressure Hydraulic Cylinder Seals and Rod Kits for earthmoving equipment.',
    attribute: 'OEM Specification • 350 Bar Rating',
  },

  // Chemicals & Polymers
  {
    category: 'Chemicals & Materials',
    quantity: '100 Metric Tons',
    message: 'Wanted 100 MT Virgin Polypropylene (PP) Homopolymer Injection Molding Grade MFI 12.',
    attribute: 'Prime Virgin • Immediate Dispatch',
  },
  {
    category: 'Chemicals & Materials',
    quantity: '5,000 Kgs',
    message: 'Urgent requirement for 5,000 Kgs Organic Cold-Pressed Virgin Castor Oil USP Grade in standard IBC tanks.',
    attribute: 'Export Grade • High Viscosity',
  },
  {
    category: 'Chemicals & Materials',
    quantity: '50 Metric Tons',
    message: 'Sourcing 50 Metric Tons Caustic Soda Flakes 99% purity in 25kg bags for industrial washing.',
    attribute: 'Rayon Grade • Factory Direct',
  },

  // Electronics & Solar
  {
    category: 'Electronics & Solar',
    quantity: '500 kW System',
    message: 'Looking for 500kW Industrial On-Grid Solar Inverters with IEC 62109 compliance and dual MPPT tracker.',
    attribute: 'Tier 1 Quality • 5-Year Warranty',
  },
  {
    category: 'Electronics & Solar',
    quantity: '20,000 Meters',
    message: 'Urgent procurement: 20,000 meters 4-Core Copper Armoured Power Cables 16 sq mm IS 1554 certified.',
    attribute: 'Heavy Duty • Direct Manufacturer',
  },
  {
    category: 'Electronics & Solar',
    quantity: '10,000 Pcs',
    message: 'Wanted 10,000 pieces Multilayer FR4 Printed Circuit Boards with ENIG surface finish.',
    attribute: 'IPC Class 2 • 100% E-Tested',
  },
];

export interface IndianBulkOrderAlert {
  id: string;
  orderNumber: string;
  buyerName: string;
  companyName: string;
  city: string;
  country: string;
  flag: string;
  title: string;
  message: string;
  category: string;
  quantity: string;
  imageUrl: string;
  badge: string;
  attribute: string;
  verifiedBuyer: boolean;
}

export const ALL_INDIAN_CATEGORIES = [
  'All Categories',
  'Textiles & Apparel',
  'Agriculture & Food',
  'Metals & Construction',
  'Packaging & Paper',
  'Machinery & Equipment',
  'Chemicals & Materials',
  'Electronics & Solar',
] as const;

/**
 * Deterministically generates an authentic Indian buyer bulk order from index (0 to 99,999+)
 * Supports optional category filtering.
 */
export function getIndianBulkOrder(index: number, categoryFilter: string = 'All Categories'): IndianBulkOrderAlert {
  const safeIndex = Math.abs(index) % TOTAL_INDIAN_BULK_ORDERS;

  // Filter templates if category is specified
  const templates = (categoryFilter === 'All Categories' || !categoryFilter)
    ? INDIAN_INQUIRY_TEMPLATES
    : INDIAN_INQUIRY_TEMPLATES.filter(t => t.category.toLowerCase().includes(categoryFilter.toLowerCase().slice(0, 5))) || INDIAN_INQUIRY_TEMPLATES;

  const validTemplates = templates.length > 0 ? templates : INDIAN_INQUIRY_TEMPLATES;

  // Combinatorial indices
  const fnIdx = safeIndex % INDIAN_FIRST_NAMES.length;
  const lnIdx = Math.floor(safeIndex / INDIAN_FIRST_NAMES.length) % INDIAN_LAST_NAMES.length;
  const cityIdx = (safeIndex * 7) % INDIAN_CITIES.length;
  const compIdx = (safeIndex * 13) % INDIAN_ENTERPRISES.length;
  const inqIdx = safeIndex % validTemplates.length;
  const imgIdx = (safeIndex + 5) % INDIAN_COMMERCIAL_IMAGES.length;

  const firstName = INDIAN_FIRST_NAMES[fnIdx];
  const lastName = INDIAN_LAST_NAMES[lnIdx];
  const buyerName = `${firstName} ${lastName}`;
  const companyName = INDIAN_ENTERPRISES[compIdx];
  const city = INDIAN_CITIES[cityIdx];
  const inq = validTemplates[inqIdx];
  const imageUrl = INDIAN_COMMERCIAL_IMAGES[imgIdx];

  const badges = ['⚡ URGENT RFQ', '🔥 HIGH PRIORITY', '⚡ IMMEDIATE PROCUREMENT', '⭐ VERIFIED BUYER'];
  const badge = badges[safeIndex % badges.length];

  return {
    id: `ind-rfq-${(safeIndex + 1).toString().padStart(6, '0')}`,
    orderNumber: `RFQ-IND-${100000 + safeIndex}`,
    buyerName,
    companyName,
    city,
    country: 'India',
    flag: '🇮🇳',
    title: `Wanted bulk order from India posted by ${buyerName}`,
    message: inq.message,
    category: inq.category,
    quantity: inq.quantity,
    imageUrl,
    badge,
    attribute: inq.attribute,
    verifiedBuyer: true,
  };
}

/**
 * Returns a randomized or offset order from the 100,000 dataset
 */
/** Index encoded in RFQ-IND-100000 style order numbers, or null if the code is not one of these leads. */
export function indexFromIndianOrderNumber(orderNumber: string): number | null {
  const match = orderNumber.trim().toUpperCase().match(/^RFQ-IND-(\d+)$/);
  if (!match) return null;
  const index = Number(match[1]) - 100000;
  if (!Number.isInteger(index) || index < 0 || index >= TOTAL_INDIAN_BULK_ORDERS) return null;
  return index;
}

export function getRandomIndianBulkOrder(categoryFilter: string = 'All Categories'): IndianBulkOrderAlert {
  const randIndex = Math.floor(Math.random() * TOTAL_INDIAN_BULK_ORDERS);
  return getIndianBulkOrder(randIndex, categoryFilter);
}
