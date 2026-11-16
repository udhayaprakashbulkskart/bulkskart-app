/**
 * Indian states, union territories and the industrial towns manufacturers most often name, so a sentence like
 * "we make HDPE pipes in Vadodara, Gujarat" can be turned into a city and a state.
 *
 * Reference data only: nothing here describes any company.
 */

interface StateEntry {
  name: string;
  /** GST state codes (the first two digits of a GSTIN); older codes are kept because old registrations still carry them */
  gst: string[];
  aliases?: string[];
}

export const INDIAN_STATES: readonly StateEntry[] = [
  { name: 'Andhra Pradesh', gst: ['37', '28'] },
  { name: 'Arunachal Pradesh', gst: ['12'] },
  { name: 'Assam', gst: ['18'] },
  { name: 'Bihar', gst: ['10'] },
  { name: 'Chhattisgarh', gst: ['22'], aliases: ['chattisgarh'] },
  { name: 'Goa', gst: ['30'] },
  { name: 'Gujarat', gst: ['24'] },
  { name: 'Haryana', gst: ['06'] },
  { name: 'Himachal Pradesh', gst: ['02'], aliases: ['himachal'] },
  { name: 'Jharkhand', gst: ['20'] },
  { name: 'Karnataka', gst: ['29'] },
  { name: 'Kerala', gst: ['32'] },
  { name: 'Madhya Pradesh', gst: ['23'] },
  { name: 'Maharashtra', gst: ['27'] },
  { name: 'Manipur', gst: ['14'] },
  { name: 'Meghalaya', gst: ['17'] },
  { name: 'Mizoram', gst: ['15'] },
  { name: 'Nagaland', gst: ['13'] },
  { name: 'Odisha', gst: ['21'], aliases: ['orissa'] },
  { name: 'Punjab', gst: ['03'] },
  { name: 'Rajasthan', gst: ['08'] },
  { name: 'Sikkim', gst: ['11'] },
  { name: 'Tamil Nadu', gst: ['33'], aliases: ['tamilnadu'] },
  { name: 'Telangana', gst: ['36'] },
  { name: 'Tripura', gst: ['16'] },
  { name: 'Uttar Pradesh', gst: ['09'] },
  { name: 'Uttarakhand', gst: ['05'], aliases: ['uttaranchal'] },
  { name: 'West Bengal', gst: ['19'], aliases: ['bengal'] },
  { name: 'Andaman & Nicobar Islands', gst: ['35'], aliases: ['andaman and nicobar islands', 'andaman and nicobar', 'andaman'] },
  { name: 'Chandigarh', gst: ['04'] },
  {
    name: 'Dadra & Nagar Haveli and Daman & Diu',
    gst: ['26', '25'],
    aliases: ['dadra and nagar haveli and daman and diu', 'dadra and nagar haveli', 'daman and diu'],
  },
  { name: 'Delhi', gst: ['07'], aliases: ['nct of delhi'] },
  { name: 'Jammu & Kashmir', gst: ['01'], aliases: ['jammu and kashmir', 'j and k'] },
  { name: 'Ladakh', gst: ['38'] },
  { name: 'Lakshadweep', gst: ['31'] },
  { name: 'Puducherry', gst: ['34'], aliases: ['pondicherry'] },
];

const STATE_BY_GST_CODE: Record<string, string> = {};
for (const state of INDIAN_STATES) for (const code of state.gst) STATE_BY_GST_CODE[code] = state.name;

/** The state or union territory a GST state code stands for, or null (97 "Other Territory" and 99 are not places). */
export function stateFromGstCode(code: string): string | null {
  return STATE_BY_GST_CODE[code] ?? null;
}

/** A city is listed as its usual name followed by other spellings people use. */
type CityRow = string | readonly [string, ...string[]];

const CITIES_BY_STATE: Record<string, readonly CityRow[]> = {
  Gujarat: [
    'Ahmedabad', ['Vadodara', 'Baroda'], 'Surat', 'Rajkot', 'Morbi', 'Jamnagar', 'Bhavnagar', 'Gandhinagar', 'Vapi', 'Ankleshwar',
    'Bharuch', 'Mehsana', 'Kalol', 'Sanand', 'Halol', 'Valsad', 'Navsari', 'Anand', 'Nadiad', 'Junagadh', 'Surendranagar',
    'Gandhidham', 'Bhuj', 'Palanpur', 'Himmatnagar', 'Godhra', 'Dahej', 'Sachin', 'Kadi', 'Wankaner', 'Gondal', 'Porbandar',
    'Veraval', 'Amreli', 'Dholka', 'Vatva',
  ],
  Maharashtra: [
    ['Mumbai', 'Bombay'], 'Pune', 'Nagpur', 'Nashik', ['Aurangabad', 'Chhatrapati Sambhajinagar'], 'Thane', 'Navi Mumbai', 'Kolhapur',
    'Solapur', 'Ichalkaranji', 'Bhiwandi', ['Pimpri-Chinchwad', 'Pimpri Chinchwad', 'Pimpri'], ['Ahmednagar', 'Ahilyanagar'], 'Satara',
    'Sangli', 'Jalgaon', 'Latur', 'Amravati', 'Akola', 'Dhule', 'Chakan', 'Ranjangaon', 'Taloja', 'Palghar', 'Tarapur', 'Boisar',
    'Ulhasnagar', 'Vasai', 'Virar', 'Kalyan', 'Dombivli', 'Panvel', 'Chandrapur', 'Nanded', 'Malegaon', 'Wardha', 'Baramati',
    'Lonavala', 'Talegaon', 'Shirur',
  ],
  'Tamil Nadu': [
    ['Chennai', 'Madras'], ['Coimbatore', 'Kovai'], ['Tiruppur', 'Tirupur'], 'Madurai', 'Salem', 'Erode', ['Tiruchirappalli', 'Trichy', 'Tiruchirapalli'],
    'Tirunelveli', 'Vellore', 'Hosur', 'Karur', 'Namakkal', 'Sivakasi', ['Thoothukudi', 'Tuticorin'], 'Dindigul', 'Kanchipuram',
    'Sriperumbudur', 'Ambattur', 'Ranipet', 'Pollachi', 'Krishnagiri', 'Virudhunagar', 'Nagercoil', 'Thanjavur', 'Cuddalore',
    ['Ooty', 'Udhagamandalam'], 'Gummidipoondi', 'Avadi', 'Perundurai', 'Palladam', 'Rajapalayam', 'Kovilpatti', 'Ambur',
    'Vaniyambadi', 'Tiruvallur', 'Chengalpattu', 'Maraimalai Nagar', 'Oragadam', 'Tiruvannamalai',
  ],
  Karnataka: [
    ['Bengaluru', 'Bangalore'], ['Mysuru', 'Mysore'], ['Hubballi', 'Hubli'], ['Belagavi', 'Belgaum'], ['Mangaluru', 'Mangalore'],
    ['Tumakuru', 'Tumkur'], 'Davangere', ['Ballari', 'Bellary'], 'Dharwad', ['Kalaburagi', 'Gulbarga'], ['Shivamogga', 'Shimoga'],
    'Hassan', 'Mandya', 'Udupi', 'Bidar', 'Raichur', ['Vijayapura', 'Bijapur'], 'Peenya', 'Doddaballapur', 'Nelamangala', 'Hoskote', 'Harohalli',
  ],
  Kerala: [
    ['Kochi', 'Cochin'], ['Thiruvananthapuram', 'Trivandrum'], ['Kozhikode', 'Calicut'], ['Thrissur', 'Trichur'], ['Kollam', 'Quilon'],
    ['Palakkad', 'Palghat'], ['Kannur', 'Cannanore'], ['Alappuzha', 'Alleppey'], 'Ernakulam', 'Kottayam', 'Malappuram', 'Aluva', 'Perumbavoor',
  ],
  'Andhra Pradesh': [
    ['Visakhapatnam', 'Vizag', 'Vishakhapatnam'], 'Vijayawada', 'Guntur', 'Tirupati', 'Nellore', 'Kakinada', ['Rajahmundry', 'Rajamahendravaram'],
    'Kurnool', 'Anantapur', 'Eluru', 'Ongole', 'Chittoor', ['Kadapa', 'Cuddapah'], 'Srikakulam', 'Machilipatnam', 'Bhimavaram',
    'Tadepalligudem', 'Amaravati', 'Sri City', 'Gannavaram',
  ],
  Telangana: [
    'Hyderabad', 'Secunderabad', 'Warangal', 'Karimnagar', 'Nizamabad', 'Khammam', 'Patancheru', 'Medchal', 'Sangareddy', 'Bhongir',
    'Mahabubnagar', 'Nalgonda', 'Jeedimetla', 'Cherlapally', 'Pashamylaram', 'Shamshabad', 'Zaheerabad',
  ],
  Rajasthan: [
    'Jaipur', 'Jodhpur', 'Udaipur', 'Kota', 'Bhilwara', 'Ajmer', 'Bikaner', 'Alwar', 'Bhiwadi', 'Sikar', 'Pali', 'Jaisalmer',
    'Sri Ganganagar', 'Neemrana', 'Behror', 'Chittorgarh', 'Kishangarh', 'Beawar', 'Tonk', 'Barmer', 'Nagaur', 'Hanumangarh', 'Sitapura',
  ],
  Delhi: [
    ['Delhi', 'New Delhi'], 'Okhla', 'Narela', 'Bawana', 'Mundka', 'Wazirpur', 'Mayapuri', 'Naraina', 'Badli', 'Patparganj', 'Jhilmil',
  ],
  Haryana: [
    ['Gurugram', 'Gurgaon'], 'Faridabad', 'Panipat', 'Karnal', 'Ambala', 'Hisar', 'Rohtak', 'Yamunanagar', 'Kurukshetra', 'Sirsa', 'Rewari',
    'Bahadurgarh', ['Sonipat', 'Sonepat'], 'Manesar', 'Bhiwani', 'Jind', 'Kaithal', 'Palwal', 'Dharuhera', 'Bawal', 'Jhajjar', 'Fatehabad',
    'Narnaul', 'Panchkula', 'Ballabgarh', 'Samalkha',
  ],
  'Uttar Pradesh': [
    'Noida', 'Greater Noida', 'Ghaziabad', 'Lucknow', 'Kanpur', 'Agra', ['Varanasi', 'Banaras', 'Benares'], 'Meerut', ['Prayagraj', 'Allahabad'],
    'Moradabad', 'Aligarh', 'Bareilly', 'Firozabad', 'Saharanpur', 'Mathura', 'Gorakhpur', 'Muzaffarnagar', 'Mirzapur', 'Bhadohi', 'Jhansi',
    'Hapur', 'Bulandshahr', 'Khurja', 'Sahibabad', 'Modinagar', 'Rampur', 'Etawah', 'Unnao', 'Sitapur', 'Hathras', 'Sikandrabad', 'Shahjahanpur',
  ],
  'Madhya Pradesh': [
    'Indore', 'Bhopal', 'Gwalior', 'Jabalpur', 'Ujjain', 'Dewas', 'Pithampur', 'Ratlam', 'Sagar', 'Satna', 'Mandideep', 'Neemuch', 'Mandsaur',
    'Khandwa', 'Rewa', 'Chhindwara', 'Morena', 'Sehore',
  ],
  'West Bengal': [
    ['Kolkata', 'Calcutta'], 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Haldia', 'Kharagpur', ['Bardhaman', 'Burdwan'], 'Hooghly', 'Barasat',
    'Dankuni', 'Kalyani', 'Bishnupur', 'Malda', 'Krishnanagar',
  ],
  Bihar: ['Patna', 'Gaya', 'Muzaffarpur', 'Bhagalpur', 'Darbhanga', 'Hajipur', 'Purnia', 'Arrah', 'Begusarai', 'Bihar Sharif'],
  Odisha: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Sambalpur', 'Jharsuguda', ['Berhampur', 'Brahmapur'], 'Balasore', 'Angul', 'Paradeep', 'Jajpur', 'Puri', 'Khordha'],
  Jharkhand: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Hazaribagh', 'Deoghar', 'Adityapur'],
  Chhattisgarh: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Raigarh', 'Rajnandgaon', 'Siltara'],
  Uttarakhand: ['Dehradun', 'Haridwar', 'Roorkee', 'Rudrapur', 'Kashipur', 'Haldwani', 'Sitarganj', 'Kotdwar', 'Pantnagar', 'Selaqui', 'Rishikesh'],
  'Himachal Pradesh': ['Shimla', 'Baddi', 'Solan', 'Parwanoo', 'Paonta Sahib', 'Nalagarh', 'Kala Amb', 'Sundernagar', 'Kangra'],
  'Jammu & Kashmir': ['Srinagar', 'Jammu', 'Samba', 'Kathua', 'Anantnag', 'Baramulla'],
  Punjab: [
    'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', ['Mohali', 'SAS Nagar'], 'Bathinda', 'Batala', 'Phagwara', 'Mandi Gobindgarh', 'Moga',
    'Hoshiarpur', 'Rajpura', 'Derabassi', 'Kapurthala', 'Khanna', ['Ropar', 'Rupnagar'], 'Sangrur', 'Barnala', 'Pathankot', 'Gurdaspur',
    'Fazilka', 'Malerkotla', 'Nabha', 'Zirakpur', 'Kharar', 'Banur',
  ],
  Chandigarh: ['Chandigarh'],
  Goa: [['Panaji', 'Panjim'], 'Margao', ['Vasco', 'Vasco da Gama'], 'Mapusa', 'Ponda', 'Verna', 'Bicholim', 'Mormugao'],
  Assam: ['Guwahati', 'Dibrugarh', 'Silchar', 'Jorhat', 'Tezpur', 'Nagaon', 'Tinsukia', 'Bongaigaon'],
  Puducherry: [['Puducherry', 'Pondicherry']],
  Meghalaya: ['Shillong'],
  Tripura: ['Agartala'],
  Manipur: ['Imphal'],
  Mizoram: ['Aizawl'],
  Nagaland: ['Kohima', 'Dimapur'],
  Sikkim: ['Gangtok'],
  'Arunachal Pradesh': ['Itanagar'],
  'Andaman & Nicobar Islands': ['Port Blair'],
  Ladakh: ['Leh'],
  'Dadra & Nagar Haveli and Daman & Diu': ['Silvassa', 'Daman'],
};

/** Names that are also ordinary names or words: they only count as a place after "in", "at", "from", a comma ... */
const NEEDS_A_CUE = new Set(['Anand', 'Sagar', 'Hassan', 'Pali', 'Rewa', 'Khanna', 'Puri', 'Mathura', 'Gaya', 'Rampur', 'Sri City']);

interface CityEntry {
  name: string;
  state: string;
  needsCue: boolean;
}

const CITY_BY_PHRASE = new Map<string, CityEntry>();
const STATE_BY_PHRASE = new Map<string, string>();

/** Lower-case words and commas only, so a phrase can be found by looking for " the phrase ". */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9,;]+/g, ' ')
    .replace(/([,;])/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
}

for (const [state, rows] of Object.entries(CITIES_BY_STATE)) {
  for (const row of rows) {
    const [name, ...others] = typeof row === 'string' ? [row] : row;
    const entry: CityEntry = { name, state, needsCue: NEEDS_A_CUE.has(name) };
    for (const spelling of [name, ...others]) CITY_BY_PHRASE.set(normalise(spelling), entry);
  }
}
for (const state of INDIAN_STATES) {
  for (const spelling of [state.name, ...(state.aliases ?? [])]) STATE_BY_PHRASE.set(normalise(spelling), state.name);
}

/** The usual names of the towns in the list, A to Z: suggestions for a city box. */
export const CITY_NAMES: readonly string[] = [...new Set([...CITY_BY_PHRASE.values()].map((city) => city.name))].sort((a, b) => a.localeCompare(b));

const CUES = new Set(['in', 'at', 'from', 'near', 'around', 'of', 'based', 'located', 'situated', 'within', ',']);
const NOT_A_CITY = new Set([
  'the', 'our', 'a', 'an', 'india', 'indian', 'and', 'also', 'state', 'city', 'area', 'region', 'district', 'western', 'eastern', 'northern',
  'southern', 'central', 'north', 'south', 'east', 'west', 'we', 'i', 'it', 'is', 'are', 'based', 'located', 'across', 'all',
]);

interface Hit<T> {
  value: T;
  /** index of the first token of the phrase */
  at: number;
  /** the token just before the phrase */
  before: string;
  length: number;
}

/** Every place where one of the phrases appears in the token list. */
function findPhrases<T>(tokens: string[], phrases: Map<string, T>): Hit<T>[] {
  const hits: Hit<T>[] = [];
  const longest = Math.max(...[...phrases.keys()].map((phrase) => phrase.split(' ').length));
  for (let i = 0; i < tokens.length; i++) {
    // prefer the longest phrase that starts here ("navi mumbai" before "mumbai")
    for (let len = Math.min(longest, tokens.length - i); len >= 1; len--) {
      const value = phrases.get(tokens.slice(i, i + len).join(' '));
      if (value !== undefined) {
        hits.push({ value, at: i, before: tokens[i - 1] ?? '', length: len });
        i += len - 1;
        break;
      }
    }
  }
  return hits;
}

function titleCase(words: string): string {
  return words.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

export interface PlaceReading {
  city: string | null;
  state: string | null;
}

/** The city and state a sentence talks about ("in Vadodara, Gujarat", "Tiruppur based", "Kheda Gujarat"). */
export function readPlace(text: string): PlaceReading {
  const tokens = normalise(text).split(' ').filter(Boolean);
  if (tokens.length === 0) return { city: null, state: null };

  const stateHits = findPhrases(tokens, STATE_BY_PHRASE);
  const cityHits = findPhrases(tokens, CITY_BY_PHRASE)
    .filter((hit) => !hit.value.needsCue || CUES.has(hit.before))
    // "Jammu & Kashmir" names a state, not the city of Jammu
    .filter((hit) => !stateHits.some((state) => hit.at >= state.at && hit.at < state.at + state.length && state.length > hit.length));
  const city = cityHits[0];

  if (city) {
    // "Aurangabad, Bihar": a state named right after the city wins over the city's usual state
    const named = stateHits.find((hit) => hit.at >= city.at + city.length && hit.at <= city.at + city.length + 2);
    return { city: city.value.name, state: named ? named.value : city.value.state };
  }

  if (stateHits.length === 0) return { city: null, state: null };
  const state = stateHits.find((hit) => CUES.has(hit.before)) ?? stateHits[0];

  // "in Kheda, Gujarat": a place that is not in the list, written just before the state
  const lead = tokens.slice(Math.max(0, state.at - 5), state.at);
  if (lead[lead.length - 1] === ',') lead.pop();
  const cueAt = lead.map((token) => CUES.has(token)).lastIndexOf(true);
  const words = lead
    .slice(cueAt + 1)
    .filter((word) => word !== ',')
    .slice(-3);
  const candidate = words.filter((word) => !NOT_A_CITY.has(word) && /^[a-z]{3,}$/.test(word));
  if (cueAt >= 0 && candidate.length === words.length && words.length > 0) {
    return { city: titleCase(words.join(' ')), state: state.value };
  }
  return { city: null, state: state.value };
}
