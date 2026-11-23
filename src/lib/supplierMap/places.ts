/**
 * Where the buyer is, for distances: a city they pick, or this device's location if they allow it. Only used for the
 * search; never saved. City centres (approximate, from public gazetteer coordinates) for India's main industrial and
 * trading cities.
 */
export interface Place {
  name: string;
  state: string;
  lat: number;
  lng: number;
}

export const INDIA_CENTER = { lat: 22.5, lng: 79.0 };
/** South-west and north-east corners that frame mainland India. */
export const INDIA_BOUNDS: [[number, number], [number, number]] = [[6.5, 68.0], [35.7, 97.4]];

export const CITIES: Place[] = [
  { name: 'Agra', state: 'Uttar Pradesh', lat: 27.1767, lng: 78.0081 },
  { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
  { name: 'Aurangabad', state: 'Maharashtra', lat: 19.8762, lng: 75.3433 },
  { name: 'Baddi', state: 'Himachal Pradesh', lat: 30.9578, lng: 76.7914 },
  { name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  { name: 'Bhiwandi', state: 'Maharashtra', lat: 19.2813, lng: 73.0483 },
  { name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lng: 77.4126 },
  { name: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lng: 85.8245 },
  { name: 'Chandigarh', state: 'Chandigarh', lat: 30.7333, lng: 76.7794 },
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  { name: 'Coimbatore', state: 'Tamil Nadu', lat: 11.0168, lng: 76.9558 },
  { name: 'Dehradun', state: 'Uttarakhand', lat: 30.3165, lng: 78.0322 },
  { name: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.209 },
  { name: 'Erode', state: 'Tamil Nadu', lat: 11.341, lng: 77.7172 },
  { name: 'Faridabad', state: 'Haryana', lat: 28.4089, lng: 77.3178 },
  { name: 'Guwahati', state: 'Assam', lat: 26.1445, lng: 91.7362 },
  { name: 'Gurugram', state: 'Haryana', lat: 28.4595, lng: 77.0266 },
  { name: 'Hosur', state: 'Tamil Nadu', lat: 12.7409, lng: 77.8253 },
  { name: 'Hyderabad', state: 'Telangana', lat: 17.385, lng: 78.4867 },
  { name: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8577 },
  { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
  { name: 'Jalandhar', state: 'Punjab', lat: 31.326, lng: 75.5762 },
  { name: 'Jamnagar', state: 'Gujarat', lat: 22.4707, lng: 70.0577 },
  { name: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4499, lng: 80.3319 },
  { name: 'Karur', state: 'Tamil Nadu', lat: 10.9601, lng: 78.0766 },
  { name: 'Kochi', state: 'Kerala', lat: 9.9312, lng: 76.2673 },
  { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
  { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
  { name: 'Ludhiana', state: 'Punjab', lat: 30.901, lng: 75.8573 },
  { name: 'Madurai', state: 'Tamil Nadu', lat: 9.9252, lng: 78.1198 },
  { name: 'Mangaluru', state: 'Karnataka', lat: 12.9141, lng: 74.856 },
  { name: 'Moradabad', state: 'Uttar Pradesh', lat: 28.8386, lng: 78.7733 },
  { name: 'Morbi', state: 'Gujarat', lat: 22.8173, lng: 70.8377 },
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.076, lng: 72.8777 },
  { name: 'Mysuru', state: 'Karnataka', lat: 12.2958, lng: 76.6394 },
  { name: 'Nagpur', state: 'Maharashtra', lat: 21.1458, lng: 79.0882 },
  { name: 'Nashik', state: 'Maharashtra', lat: 19.9975, lng: 73.7898 },
  { name: 'Noida', state: 'Uttar Pradesh', lat: 28.5355, lng: 77.391 },
  { name: 'Panipat', state: 'Haryana', lat: 29.3909, lng: 76.9635 },
  { name: 'Patna', state: 'Bihar', lat: 25.5941, lng: 85.1376 },
  { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
  { name: 'Raipur', state: 'Chhattisgarh', lat: 21.2514, lng: 81.6296 },
  { name: 'Rajkot', state: 'Gujarat', lat: 22.3039, lng: 70.8022 },
  { name: 'Ranchi', state: 'Jharkhand', lat: 23.3441, lng: 85.3096 },
  { name: 'Salem', state: 'Tamil Nadu', lat: 11.6643, lng: 78.146 },
  { name: 'Sivakasi', state: 'Tamil Nadu', lat: 9.4533, lng: 77.8024 },
  { name: 'Surat', state: 'Gujarat', lat: 21.1702, lng: 72.8311 },
  { name: 'Thane', state: 'Maharashtra', lat: 19.2183, lng: 72.9781 },
  { name: 'Tiruppur', state: 'Tamil Nadu', lat: 11.1085, lng: 77.3411 },
  { name: 'Vadodara', state: 'Gujarat', lat: 22.3072, lng: 73.1812 },
  { name: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lng: 82.9739 },
  { name: 'Vijayawada', state: 'Andhra Pradesh', lat: 16.5062, lng: 80.648 },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lng: 83.2185 },
];

export const findCity = (name: string): Place | undefined => CITIES.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());

/** The radius choices: "Nearby" is 5 km; null means all India. */
export const RADIUS_OPTIONS: { label: string; km: number | null }[] = [
  { label: 'Nearby', km: 5 },
  { label: '10 km', km: 10 },
  { label: '25 km', km: 25 },
  { label: '50 km', km: 50 },
  { label: '100 km', km: 100 },
  { label: 'All India', km: null },
];

/** Great-circle distance in km (the same formula as public.km_between in the database). */
export function kmBetween(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}
