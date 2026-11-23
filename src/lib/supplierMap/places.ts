/**
 * Places for the supplier map, worldwide.
 * Where the buyer is (for distances): a city they pick, this device's location if they allow it, or the centre of the
 * map. Only used for the search; never saved. City centres are approximate (public gazetteer coordinates) for the
 * main industrial and trading cities; anywhere else, people use their location or the map centre.
 */
export interface Place {
  name: string;
  /** state or province, when it helps tell places apart */
  region?: string;
  country: string;
  lat: number;
  lng: number;
}

/** South-west and north-east corners that frame the inhabited world. */
export const WORLD_BOUNDS: [[number, number], [number, number]] = [[-50, -150], [70, 170]];
/** Mainland India, for the manufacturer pin picker when the factory is in India. */
export const INDIA_BOUNDS: [[number, number], [number, number]] = [[6.5, 68.0], [35.7, 97.4]];

const P = (name: string, country: string, lat: number, lng: number, region?: string): Place => ({ name, country, lat, lng, region });

export const PLACES: Place[] = [
  // India
  P('Agra', 'India', 27.1767, 78.0081, 'Uttar Pradesh'),
  P('Ahmedabad', 'India', 23.0225, 72.5714, 'Gujarat'),
  P('Aurangabad', 'India', 19.8762, 75.3433, 'Maharashtra'),
  P('Baddi', 'India', 30.9578, 76.7914, 'Himachal Pradesh'),
  P('Bengaluru', 'India', 12.9716, 77.5946, 'Karnataka'),
  P('Bhiwandi', 'India', 19.2813, 73.0483, 'Maharashtra'),
  P('Bhopal', 'India', 23.2599, 77.4126, 'Madhya Pradesh'),
  P('Bhubaneswar', 'India', 20.2961, 85.8245, 'Odisha'),
  P('Chandigarh', 'India', 30.7333, 76.7794, 'Chandigarh'),
  P('Chennai', 'India', 13.0827, 80.2707, 'Tamil Nadu'),
  P('Coimbatore', 'India', 11.0168, 76.9558, 'Tamil Nadu'),
  P('Dehradun', 'India', 30.3165, 78.0322, 'Uttarakhand'),
  P('Delhi', 'India', 28.6139, 77.209, 'Delhi'),
  P('Erode', 'India', 11.341, 77.7172, 'Tamil Nadu'),
  P('Faridabad', 'India', 28.4089, 77.3178, 'Haryana'),
  P('Guwahati', 'India', 26.1445, 91.7362, 'Assam'),
  P('Gurugram', 'India', 28.4595, 77.0266, 'Haryana'),
  P('Hosur', 'India', 12.7409, 77.8253, 'Tamil Nadu'),
  P('Hyderabad', 'India', 17.385, 78.4867, 'Telangana'),
  P('Indore', 'India', 22.7196, 75.8577, 'Madhya Pradesh'),
  P('Jaipur', 'India', 26.9124, 75.7873, 'Rajasthan'),
  P('Jalandhar', 'India', 31.326, 75.5762, 'Punjab'),
  P('Jamnagar', 'India', 22.4707, 70.0577, 'Gujarat'),
  P('Kanpur', 'India', 26.4499, 80.3319, 'Uttar Pradesh'),
  P('Karur', 'India', 10.9601, 78.0766, 'Tamil Nadu'),
  P('Kochi', 'India', 9.9312, 76.2673, 'Kerala'),
  P('Kolkata', 'India', 22.5726, 88.3639, 'West Bengal'),
  P('Lucknow', 'India', 26.8467, 80.9462, 'Uttar Pradesh'),
  P('Ludhiana', 'India', 30.901, 75.8573, 'Punjab'),
  P('Madurai', 'India', 9.9252, 78.1198, 'Tamil Nadu'),
  P('Mangaluru', 'India', 12.9141, 74.856, 'Karnataka'),
  P('Moradabad', 'India', 28.8386, 78.7733, 'Uttar Pradesh'),
  P('Morbi', 'India', 22.8173, 70.8377, 'Gujarat'),
  P('Mumbai', 'India', 19.076, 72.8777, 'Maharashtra'),
  P('Mysuru', 'India', 12.2958, 76.6394, 'Karnataka'),
  P('Nagpur', 'India', 21.1458, 79.0882, 'Maharashtra'),
  P('Nashik', 'India', 19.9975, 73.7898, 'Maharashtra'),
  P('Noida', 'India', 28.5355, 77.391, 'Uttar Pradesh'),
  P('Panipat', 'India', 29.3909, 76.9635, 'Haryana'),
  P('Patna', 'India', 25.5941, 85.1376, 'Bihar'),
  P('Pune', 'India', 18.5204, 73.8567, 'Maharashtra'),
  P('Raipur', 'India', 21.2514, 81.6296, 'Chhattisgarh'),
  P('Rajkot', 'India', 22.3039, 70.8022, 'Gujarat'),
  P('Ranchi', 'India', 23.3441, 85.3096, 'Jharkhand'),
  P('Salem', 'India', 11.6643, 78.146, 'Tamil Nadu'),
  P('Sivakasi', 'India', 9.4533, 77.8024, 'Tamil Nadu'),
  P('Surat', 'India', 21.1702, 72.8311, 'Gujarat'),
  P('Thane', 'India', 19.2183, 72.9781, 'Maharashtra'),
  P('Tiruppur', 'India', 11.1085, 77.3411, 'Tamil Nadu'),
  P('Vadodara', 'India', 22.3072, 73.1812, 'Gujarat'),
  P('Varanasi', 'India', 25.3176, 82.9739, 'Uttar Pradesh'),
  P('Vijayawada', 'India', 16.5062, 80.648, 'Andhra Pradesh'),
  P('Visakhapatnam', 'India', 17.6868, 83.2185, 'Andhra Pradesh'),
  // South Asia
  P('Dhaka', 'Bangladesh', 23.8103, 90.4125),
  P('Chattogram', 'Bangladesh', 22.3569, 91.7832),
  P('Karachi', 'Pakistan', 24.8607, 67.0011),
  P('Lahore', 'Pakistan', 31.5204, 74.3587),
  P('Sialkot', 'Pakistan', 32.4945, 74.5229),
  P('Faisalabad', 'Pakistan', 31.4504, 73.135),
  P('Colombo', 'Sri Lanka', 6.9271, 79.8612),
  P('Kathmandu', 'Nepal', 27.7172, 85.324),
  P('Malé', 'Maldives', 4.1755, 73.5093),
  // East and South-East Asia
  P('Shanghai', 'China', 31.2304, 121.4737),
  P('Beijing', 'China', 39.9042, 116.4074),
  P('Shenzhen', 'China', 22.5431, 114.0579),
  P('Guangzhou', 'China', 23.1291, 113.2644),
  P('Dongguan', 'China', 23.0207, 113.7518),
  P('Foshan', 'China', 23.0215, 113.1214),
  P('Yiwu', 'China', 29.3069, 120.0751),
  P('Ningbo', 'China', 29.8683, 121.544),
  P('Hangzhou', 'China', 30.2741, 120.1551),
  P('Qingdao', 'China', 36.0671, 120.3826),
  P('Tianjin', 'China', 39.3434, 117.3616),
  P('Xiamen', 'China', 24.4798, 118.0894),
  P('Hong Kong', 'Hong Kong', 22.3193, 114.1694),
  P('Taipei', 'Taiwan', 25.033, 121.5654),
  P('Tokyo', 'Japan', 35.6762, 139.6503),
  P('Osaka', 'Japan', 34.6937, 135.5023),
  P('Seoul', 'South Korea', 37.5665, 126.978),
  P('Busan', 'South Korea', 35.1796, 129.0756),
  P('Ho Chi Minh City', 'Vietnam', 10.8231, 106.6297),
  P('Hanoi', 'Vietnam', 21.0278, 105.8342),
  P('Bangkok', 'Thailand', 13.7563, 100.5018),
  P('Kuala Lumpur', 'Malaysia', 3.139, 101.6869),
  P('Penang', 'Malaysia', 5.4141, 100.3288),
  P('Singapore', 'Singapore', 1.3521, 103.8198),
  P('Jakarta', 'Indonesia', -6.2088, 106.8456),
  P('Surabaya', 'Indonesia', -7.2575, 112.7521),
  P('Manila', 'Philippines', 14.5995, 120.9842),
  // Middle East and Central Asia
  P('Dubai', 'United Arab Emirates', 25.2048, 55.2708),
  P('Abu Dhabi', 'United Arab Emirates', 24.4539, 54.3773),
  P('Sharjah', 'United Arab Emirates', 25.3463, 55.4209),
  P('Riyadh', 'Saudi Arabia', 24.7136, 46.6753),
  P('Jeddah', 'Saudi Arabia', 21.4858, 39.1925),
  P('Dammam', 'Saudi Arabia', 26.4207, 50.0888),
  P('Doha', 'Qatar', 25.2854, 51.531),
  P('Muscat', 'Oman', 23.588, 58.3829),
  P('Kuwait City', 'Kuwait', 29.3759, 47.9774),
  P('Manama', 'Bahrain', 26.2285, 50.586),
  P('Tel Aviv', 'Israel', 32.0853, 34.7818),
  P('Amman', 'Jordan', 31.9454, 35.9284),
  P('Istanbul', 'Türkiye', 41.0082, 28.9784),
  P('Bursa', 'Türkiye', 40.1885, 29.061),
  P('Izmir', 'Türkiye', 38.4237, 27.1428),
  P('Ankara', 'Türkiye', 39.9334, 32.8597),
  P('Tehran', 'Iran', 35.6892, 51.389),
  P('Almaty', 'Kazakhstan', 43.222, 76.8512),
  P('Tashkent', 'Uzbekistan', 41.2995, 69.2401),
  // Africa
  P('Cairo', 'Egypt', 30.0444, 31.2357),
  P('Alexandria', 'Egypt', 31.2001, 29.9187),
  P('Casablanca', 'Morocco', 33.5731, -7.5898),
  P('Lagos', 'Nigeria', 6.5244, 3.3792),
  P('Abuja', 'Nigeria', 9.0765, 7.3986),
  P('Accra', 'Ghana', 5.6037, -0.187),
  P('Abidjan', "Côte d'Ivoire", 5.36, -4.0083),
  P('Dakar', 'Senegal', 14.7167, -17.4677),
  P('Nairobi', 'Kenya', -1.2921, 36.8219),
  P('Mombasa', 'Kenya', -4.0435, 39.6682),
  P('Dar es Salaam', 'Tanzania', -6.7924, 39.2083),
  P('Kampala', 'Uganda', 0.3476, 32.5825),
  P('Addis Ababa', 'Ethiopia', 8.9806, 38.7578),
  P('Johannesburg', 'South Africa', -26.2041, 28.0473),
  P('Durban', 'South Africa', -29.8587, 31.0218),
  P('Cape Town', 'South Africa', -33.9249, 18.4241),
  P('Port Louis', 'Mauritius', -20.1609, 57.5012),
  // Europe
  P('London', 'United Kingdom', 51.5074, -0.1278),
  P('Birmingham', 'United Kingdom', 52.4862, -1.8904),
  P('Manchester', 'United Kingdom', 53.4808, -2.2426),
  P('Dublin', 'Ireland', 53.3498, -6.2603),
  P('Berlin', 'Germany', 52.52, 13.405),
  P('Hamburg', 'Germany', 53.5511, 9.9937),
  P('Frankfurt', 'Germany', 50.1109, 8.6821),
  P('Munich', 'Germany', 48.1351, 11.582),
  P('Stuttgart', 'Germany', 48.7758, 9.1829),
  P('Düsseldorf', 'Germany', 51.2277, 6.7735),
  P('Paris', 'France', 48.8566, 2.3522),
  P('Lyon', 'France', 45.764, 4.8357),
  P('Marseille', 'France', 43.2965, 5.3698),
  P('Amsterdam', 'Netherlands', 52.3676, 4.9041),
  P('Rotterdam', 'Netherlands', 51.9244, 4.4777),
  P('Antwerp', 'Belgium', 51.2194, 4.4025),
  P('Brussels', 'Belgium', 50.8503, 4.3517),
  P('Milan', 'Italy', 45.4642, 9.19),
  P('Turin', 'Italy', 45.0703, 7.6869),
  P('Rome', 'Italy', 41.9028, 12.4964),
  P('Madrid', 'Spain', 40.4168, -3.7038),
  P('Barcelona', 'Spain', 41.3874, 2.1686),
  P('Valencia', 'Spain', 39.4699, -0.3763),
  P('Lisbon', 'Portugal', 38.7223, -9.1393),
  P('Porto', 'Portugal', 41.1579, -8.6291),
  P('Zurich', 'Switzerland', 47.3769, 8.5417),
  P('Vienna', 'Austria', 48.2082, 16.3738),
  P('Warsaw', 'Poland', 52.2297, 21.0122),
  P('Prague', 'Czechia', 50.0755, 14.4378),
  P('Budapest', 'Hungary', 47.4979, 19.0402),
  P('Bucharest', 'Romania', 44.4268, 26.1025),
  P('Athens', 'Greece', 37.9838, 23.7275),
  P('Stockholm', 'Sweden', 59.3293, 18.0686),
  P('Copenhagen', 'Denmark', 55.6761, 12.5683),
  P('Oslo', 'Norway', 59.9139, 10.7522),
  P('Helsinki', 'Finland', 60.1699, 24.9384),
  P('Kyiv', 'Ukraine', 50.4501, 30.5234),
  P('Moscow', 'Russia', 55.7558, 37.6173),
  P('Saint Petersburg', 'Russia', 59.9311, 30.3609),
  // Americas
  P('New York', 'United States', 40.7128, -74.006, 'New York'),
  P('Los Angeles', 'United States', 34.0522, -118.2437, 'California'),
  P('San Francisco', 'United States', 37.7749, -122.4194, 'California'),
  P('Chicago', 'United States', 41.8781, -87.6298, 'Illinois'),
  P('Houston', 'United States', 29.7604, -95.3698, 'Texas'),
  P('Dallas', 'United States', 32.7767, -96.797, 'Texas'),
  P('Miami', 'United States', 25.7617, -80.1918, 'Florida'),
  P('Atlanta', 'United States', 33.749, -84.388, 'Georgia'),
  P('Seattle', 'United States', 47.6062, -122.3321, 'Washington'),
  P('Detroit', 'United States', 42.3314, -83.0458, 'Michigan'),
  P('Toronto', 'Canada', 43.6532, -79.3832, 'Ontario'),
  P('Vancouver', 'Canada', 49.2827, -123.1207, 'British Columbia'),
  P('Montreal', 'Canada', 45.5017, -73.5673, 'Quebec'),
  P('Mexico City', 'Mexico', 19.4326, -99.1332),
  P('Monterrey', 'Mexico', 25.6866, -100.3161),
  P('Guadalajara', 'Mexico', 20.6597, -103.3496),
  P('São Paulo', 'Brazil', -23.5505, -46.6333),
  P('Rio de Janeiro', 'Brazil', -22.9068, -43.1729),
  P('Buenos Aires', 'Argentina', -34.6037, -58.3816),
  P('Santiago', 'Chile', -33.4489, -70.6693),
  P('Bogotá', 'Colombia', 4.711, -74.0721),
  P('Lima', 'Peru', -12.0464, -77.0428),
  // Oceania
  P('Sydney', 'Australia', -33.8688, 151.2093, 'New South Wales'),
  P('Melbourne', 'Australia', -37.8136, 144.9631, 'Victoria'),
  P('Brisbane', 'Australia', -27.4698, 153.0251, 'Queensland'),
  P('Perth', 'Australia', -31.9505, 115.8605, 'Western Australia'),
  P('Auckland', 'New Zealand', -36.8485, 174.7633),
  P('Suva', 'Fiji', -18.1416, 178.4419),
];

/** "Coimbatore, India": unique, and what goes in the address bar. */
export const placeLabel = (p: Place): string => `${p.name}, ${p.country}`;

/** A place by its label ("Dubai, United Arab Emirates") or, for older links, its name alone ("Coimbatore"). */
export function findPlace(value: string): Place | undefined {
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  return PLACES.find((p) => placeLabel(p).toLowerCase() === v) ?? PLACES.find((p) => p.name.toLowerCase() === v);
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Places whose name, region or country starts with (or contains) the typed text; name matches first. */
export function searchPlaces(query: string, limit = 8): Place[] {
  const q = fold(query.trim());
  if (!q) return [];
  const scored = PLACES.map((p) => {
    const name = fold(p.name);
    const country = fold(p.country);
    const region = fold(p.region ?? '');
    const score = name.startsWith(q) ? 0 : country.startsWith(q) ? 1 : region.startsWith(q) ? 2 : name.includes(q) ? 3 : country.includes(q) ? 4 : -1;
    return { p, score };
  }).filter((x) => x.score >= 0);
  scored.sort((a, b) => a.score - b.score || a.p.name.localeCompare(b.p.name));
  return scored.slice(0, limit).map((x) => x.p);
}

/** The radius choices: "Nearby" is 5 km; null means anywhere in the world. */
export const RADIUS_OPTIONS: { label: string; km: number | null }[] = [
  { label: 'Nearby', km: 5 },
  { label: '10 km', km: 10 },
  { label: '25 km', km: 25 },
  { label: '50 km', km: 50 },
  { label: '100 km', km: 100 },
  { label: 'Worldwide', km: null },
];

/** Great-circle distance in km (the same formula as public.km_between in the database). */
export function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/**
 * A map viewport as the database search expects it: latitudes clamped, longitudes in -180..180 (west > east when the
 * view crosses the 180th meridian), and no longitude limit at all when the view spans the whole world.
 */
export function normaliseBounds(b: { south: number; west: number; north: number; east: number }): { south: number; west: number; north: number; east: number } {
  const wrap = (x: number) => ((((x + 180) % 360) + 360) % 360) - 180;
  const south = Math.max(-90, Math.min(90, b.south));
  const north = Math.max(-90, Math.min(90, b.north));
  if (b.east - b.west >= 360) return { south, north, west: -180, east: 180 };
  return { south, north, west: wrap(b.west), east: wrap(b.east) };
}

/** Countries a factory or a registration can be in (fixed English names, so the stored value is the same everywhere). */
export const COUNTRY_NAMES: string[] = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria',
  'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia',
  'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cambodia',
  'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo',
  'Congo (Democratic Republic)', 'Costa Rica', "Côte d'Ivoire", 'Croatia', 'Cuba', 'Cyprus', 'Czechia', 'Denmark', 'Djibouti',
  'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini',
  'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala',
  'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq',
  'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan',
  'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg', 'Macao', 'Madagascar',
  'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova',
  'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand',
  'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama',
  'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Puerto Rico', 'Qatar', 'Romania', 'Russia', 'Rwanda',
  'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'São Tomé and Príncipe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia',
  'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan',
  'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Türkiye', 'Turkmenistan',
  'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu',
  'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe',
];

/** "City, State" in India, "City, Country" elsewhere. */
export function placeLine(city?: string | null, state?: string | null, country?: string | null): string {
  if (!country || country === 'India') return [city, state].filter(Boolean).join(', ') || 'India';
  return [city, country].filter(Boolean).join(', ');
}
