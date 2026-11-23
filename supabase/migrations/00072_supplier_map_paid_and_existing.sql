-- Supplier map: paid manufacturers, including the profiles already on BulkSkart
--
-- Changes the rules of 00071 (run that first):
--   * Only manufacturers with an active PAID plan are on the map: a subscription with status 'active' that has not
--     passed its end date (the same rule as quotations, is_supplier_subscribed).
--   * Existing manufacturer profiles show automatically; they no longer have to apply on the new map page or have
--     products. The green "Verified" mark is shown only for companies BulkSkart has verified (verification_status
--     'verified', not expired, and no newer map application waiting for review).
--   * Still never shown: demo/template companies, blocked companies, suspended or inactive owner accounts,
--     companies an admin rejected, and map applications an admin rejected or suspended.
--   * Where a company is placed: its factory pin once an admin has verified it ('exact'); else the pin the
--     manufacturer placed, not yet checked ('pinned'); else the centre of the city in its profile ('city', from the
--     map_places table below). A company with none of these is not shown until it adds a city or a pin.
--
-- Run by hand in the Supabase SQL editor after 00071. Safe to run again. One transaction.

BEGIN;

-- ── City centres (the same list the website's location search uses, plus older names like Bombay) ──
CREATE TABLE IF NOT EXISTS public.map_places (
  name text NOT NULL,
  country text NOT NULL,
  region text,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  PRIMARY KEY (name, country)
);
ALTER TABLE public.map_places ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS map_places_read ON public.map_places;
CREATE POLICY map_places_read ON public.map_places FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.map_places FROM anon, authenticated;
GRANT SELECT ON public.map_places TO anon, authenticated;

INSERT INTO public.map_places (name, country, region, latitude, longitude) VALUES
  ('Agra', 'India', 'Uttar Pradesh', 27.1767, 78.0081),
  ('Ahmedabad', 'India', 'Gujarat', 23.0225, 72.5714),
  ('Aurangabad', 'India', 'Maharashtra', 19.8762, 75.3433),
  ('Baddi', 'India', 'Himachal Pradesh', 30.9578, 76.7914),
  ('Bengaluru', 'India', 'Karnataka', 12.9716, 77.5946),
  ('Bangalore', 'India', 'Karnataka', 12.9716, 77.5946),
  ('Bhiwandi', 'India', 'Maharashtra', 19.2813, 73.0483),
  ('Bhopal', 'India', 'Madhya Pradesh', 23.2599, 77.4126),
  ('Bhubaneswar', 'India', 'Odisha', 20.2961, 85.8245),
  ('Chandigarh', 'India', 'Chandigarh', 30.7333, 76.7794),
  ('Chennai', 'India', 'Tamil Nadu', 13.0827, 80.2707),
  ('Madras', 'India', 'Tamil Nadu', 13.0827, 80.2707),
  ('Coimbatore', 'India', 'Tamil Nadu', 11.0168, 76.9558),
  ('Dehradun', 'India', 'Uttarakhand', 30.3165, 78.0322),
  ('Delhi', 'India', 'Delhi', 28.6139, 77.209),
  ('New Delhi', 'India', 'Delhi', 28.6139, 77.209),
  ('Erode', 'India', 'Tamil Nadu', 11.341, 77.7172),
  ('Faridabad', 'India', 'Haryana', 28.4089, 77.3178),
  ('Guwahati', 'India', 'Assam', 26.1445, 91.7362),
  ('Gurugram', 'India', 'Haryana', 28.4595, 77.0266),
  ('Gurgaon', 'India', 'Haryana', 28.4595, 77.0266),
  ('Hosur', 'India', 'Tamil Nadu', 12.7409, 77.8253),
  ('Hyderabad', 'India', 'Telangana', 17.385, 78.4867),
  ('Indore', 'India', 'Madhya Pradesh', 22.7196, 75.8577),
  ('Jaipur', 'India', 'Rajasthan', 26.9124, 75.7873),
  ('Jalandhar', 'India', 'Punjab', 31.326, 75.5762),
  ('Jamnagar', 'India', 'Gujarat', 22.4707, 70.0577),
  ('Kanpur', 'India', 'Uttar Pradesh', 26.4499, 80.3319),
  ('Karur', 'India', 'Tamil Nadu', 10.9601, 78.0766),
  ('Kochi', 'India', 'Kerala', 9.9312, 76.2673),
  ('Cochin', 'India', 'Kerala', 9.9312, 76.2673),
  ('Kolkata', 'India', 'West Bengal', 22.5726, 88.3639),
  ('Calcutta', 'India', 'West Bengal', 22.5726, 88.3639),
  ('Lucknow', 'India', 'Uttar Pradesh', 26.8467, 80.9462),
  ('Ludhiana', 'India', 'Punjab', 30.901, 75.8573),
  ('Madurai', 'India', 'Tamil Nadu', 9.9252, 78.1198),
  ('Mangaluru', 'India', 'Karnataka', 12.9141, 74.856),
  ('Mangalore', 'India', 'Karnataka', 12.9141, 74.856),
  ('Moradabad', 'India', 'Uttar Pradesh', 28.8386, 78.7733),
  ('Morbi', 'India', 'Gujarat', 22.8173, 70.8377),
  ('Mumbai', 'India', 'Maharashtra', 19.076, 72.8777),
  ('Bombay', 'India', 'Maharashtra', 19.076, 72.8777),
  ('Mysuru', 'India', 'Karnataka', 12.2958, 76.6394),
  ('Mysore', 'India', 'Karnataka', 12.2958, 76.6394),
  ('Nagpur', 'India', 'Maharashtra', 21.1458, 79.0882),
  ('Nashik', 'India', 'Maharashtra', 19.9975, 73.7898),
  ('Noida', 'India', 'Uttar Pradesh', 28.5355, 77.391),
  ('Panipat', 'India', 'Haryana', 29.3909, 76.9635),
  ('Patna', 'India', 'Bihar', 25.5941, 85.1376),
  ('Pune', 'India', 'Maharashtra', 18.5204, 73.8567),
  ('Poona', 'India', 'Maharashtra', 18.5204, 73.8567),
  ('Raipur', 'India', 'Chhattisgarh', 21.2514, 81.6296),
  ('Rajkot', 'India', 'Gujarat', 22.3039, 70.8022),
  ('Ranchi', 'India', 'Jharkhand', 23.3441, 85.3096),
  ('Salem', 'India', 'Tamil Nadu', 11.6643, 78.146),
  ('Sivakasi', 'India', 'Tamil Nadu', 9.4533, 77.8024),
  ('Surat', 'India', 'Gujarat', 21.1702, 72.8311),
  ('Thane', 'India', 'Maharashtra', 19.2183, 72.9781),
  ('Tiruppur', 'India', 'Tamil Nadu', 11.1085, 77.3411),
  ('Tirupur', 'India', 'Tamil Nadu', 11.1085, 77.3411),
  ('Vadodara', 'India', 'Gujarat', 22.3072, 73.1812),
  ('Baroda', 'India', 'Gujarat', 22.3072, 73.1812),
  ('Varanasi', 'India', 'Uttar Pradesh', 25.3176, 82.9739),
  ('Vijayawada', 'India', 'Andhra Pradesh', 16.5062, 80.648),
  ('Amritsar', 'India', 'Punjab', 31.634, 74.8723),
  ('Aligarh', 'India', 'Uttar Pradesh', 27.8974, 78.088),
  ('Ankleshwar', 'India', 'Gujarat', 21.6264, 73.0152),
  ('Bareilly', 'India', 'Uttar Pradesh', 28.367, 79.4304),
  ('Belagavi', 'India', 'Karnataka', 15.8497, 74.4977),
  ('Belgaum', 'India', 'Karnataka', 15.8497, 74.4977),
  ('Bhavnagar', 'India', 'Gujarat', 21.7645, 72.1519),
  ('Bhilai', 'India', 'Chhattisgarh', 21.1938, 81.3509),
  ('Bhiwadi', 'India', 'Rajasthan', 28.2104, 76.8606),
  ('Cuddalore', 'India', 'Tamil Nadu', 11.748, 79.7714),
  ('Cuttack', 'India', 'Odisha', 20.4625, 85.883),
  ('Dindigul', 'India', 'Tamil Nadu', 10.3673, 77.9803),
  ('Durgapur', 'India', 'West Bengal', 23.5204, 87.3119),
  ('Ernakulam', 'India', 'Kerala', 9.9816, 76.2999),
  ('Firozabad', 'India', 'Uttar Pradesh', 27.1592, 78.3957),
  ('Gangtok', 'India', 'Sikkim', 27.3389, 88.6065),
  ('Ghaziabad', 'India', 'Uttar Pradesh', 28.6692, 77.4538),
  ('Gorakhpur', 'India', 'Uttar Pradesh', 26.7606, 83.3732),
  ('Guntur', 'India', 'Andhra Pradesh', 16.3067, 80.4365),
  ('Gwalior', 'India', 'Madhya Pradesh', 26.2183, 78.1828),
  ('Haridwar', 'India', 'Uttarakhand', 29.9457, 78.1642),
  ('Hubballi', 'India', 'Karnataka', 15.3647, 75.124),
  ('Hubli', 'India', 'Karnataka', 15.3647, 75.124),
  ('Imphal', 'India', 'Manipur', 24.817, 93.9368),
  ('Jabalpur', 'India', 'Madhya Pradesh', 23.1815, 79.9864),
  ('Jammu', 'India', 'Jammu and Kashmir', 32.7266, 74.857),
  ('Jamshedpur', 'India', 'Jharkhand', 22.8046, 86.2029),
  ('Jodhpur', 'India', 'Rajasthan', 26.2389, 73.0243),
  ('Kanchipuram', 'India', 'Tamil Nadu', 12.8342, 79.7036),
  ('Kolhapur', 'India', 'Maharashtra', 16.705, 74.2433),
  ('Kota', 'India', 'Rajasthan', 25.2138, 75.8648),
  ('Kozhikode', 'India', 'Kerala', 11.2588, 75.7804),
  ('Calicut', 'India', 'Kerala', 11.2588, 75.7804),
  ('Manesar', 'India', 'Haryana', 28.354, 76.9378),
  ('Meerut', 'India', 'Uttar Pradesh', 28.9845, 77.7064),
  ('Mohali', 'India', 'Punjab', 30.7046, 76.7179),
  ('Namakkal', 'India', 'Tamil Nadu', 11.2189, 78.1677),
  ('Navi Mumbai', 'India', 'Maharashtra', 19.033, 73.0297),
  ('Nellore', 'India', 'Andhra Pradesh', 14.4426, 79.9865),
  ('Panaji', 'India', 'Goa', 15.4909, 73.8278),
  ('Goa', 'India', 'Goa', 15.4909, 73.8278),
  ('Port Blair', 'India', 'Andaman and Nicobar Islands', 11.6234, 92.7265),
  ('Prayagraj', 'India', 'Uttar Pradesh', 25.4358, 81.8463),
  ('Allahabad', 'India', 'Uttar Pradesh', 25.4358, 81.8463),
  ('Puducherry', 'India', 'Puducherry', 11.9416, 79.8083),
  ('Pondicherry', 'India', 'Puducherry', 11.9416, 79.8083),
  ('Rourkela', 'India', 'Odisha', 22.2604, 84.8536),
  ('Shillong', 'India', 'Meghalaya', 25.5788, 91.8933),
  ('Shimla', 'India', 'Himachal Pradesh', 31.1048, 77.1734),
  ('Siliguri', 'India', 'West Bengal', 26.7271, 88.3953),
  ('Solapur', 'India', 'Maharashtra', 17.6599, 75.9064),
  ('Sonipat', 'India', 'Haryana', 28.9931, 77.0151),
  ('Sriperumbudur', 'India', 'Tamil Nadu', 12.9675, 79.9419),
  ('Thanjavur', 'India', 'Tamil Nadu', 10.787, 79.1378),
  ('Thiruvananthapuram', 'India', 'Kerala', 8.5241, 76.9366),
  ('Trivandrum', 'India', 'Kerala', 8.5241, 76.9366),
  ('Thoothukudi', 'India', 'Tamil Nadu', 8.7642, 78.1348),
  ('Tuticorin', 'India', 'Tamil Nadu', 8.7642, 78.1348),
  ('Thrissur', 'India', 'Kerala', 10.5276, 76.2144),
  ('Tiruchirappalli', 'India', 'Tamil Nadu', 10.7905, 78.7047),
  ('Trichy', 'India', 'Tamil Nadu', 10.7905, 78.7047),
  ('Tirunelveli', 'India', 'Tamil Nadu', 8.7139, 77.7567),
  ('Tirupati', 'India', 'Andhra Pradesh', 13.6288, 79.4192),
  ('Udaipur', 'India', 'Rajasthan', 24.5854, 73.7125),
  ('Ujjain', 'India', 'Madhya Pradesh', 23.1765, 75.7885),
  ('Vapi', 'India', 'Gujarat', 20.3893, 72.9106),
  ('Vellore', 'India', 'Tamil Nadu', 12.9165, 79.1325),
  ('Warangal', 'India', 'Telangana', 17.9689, 79.5941),
  ('Visakhapatnam', 'India', 'Andhra Pradesh', 17.6868, 83.2185),
  ('Vizag', 'India', 'Andhra Pradesh', 17.6868, 83.2185),
  ('Dhaka', 'Bangladesh', NULL, 23.8103, 90.4125),
  ('Chattogram', 'Bangladesh', NULL, 22.3569, 91.7832),
  ('Karachi', 'Pakistan', NULL, 24.8607, 67.0011),
  ('Lahore', 'Pakistan', NULL, 31.5204, 74.3587),
  ('Sialkot', 'Pakistan', NULL, 32.4945, 74.5229),
  ('Faisalabad', 'Pakistan', NULL, 31.4504, 73.135),
  ('Colombo', 'Sri Lanka', NULL, 6.9271, 79.8612),
  ('Kathmandu', 'Nepal', NULL, 27.7172, 85.324),
  ('Malé', 'Maldives', NULL, 4.1755, 73.5093),
  ('Shanghai', 'China', NULL, 31.2304, 121.4737),
  ('Beijing', 'China', NULL, 39.9042, 116.4074),
  ('Shenzhen', 'China', NULL, 22.5431, 114.0579),
  ('Guangzhou', 'China', NULL, 23.1291, 113.2644),
  ('Dongguan', 'China', NULL, 23.0207, 113.7518),
  ('Foshan', 'China', NULL, 23.0215, 113.1214),
  ('Yiwu', 'China', NULL, 29.3069, 120.0751),
  ('Ningbo', 'China', NULL, 29.8683, 121.544),
  ('Hangzhou', 'China', NULL, 30.2741, 120.1551),
  ('Qingdao', 'China', NULL, 36.0671, 120.3826),
  ('Tianjin', 'China', NULL, 39.3434, 117.3616),
  ('Xiamen', 'China', NULL, 24.4798, 118.0894),
  ('Hong Kong', 'Hong Kong', NULL, 22.3193, 114.1694),
  ('Taipei', 'Taiwan', NULL, 25.033, 121.5654),
  ('Tokyo', 'Japan', NULL, 35.6762, 139.6503),
  ('Osaka', 'Japan', NULL, 34.6937, 135.5023),
  ('Seoul', 'South Korea', NULL, 37.5665, 126.978),
  ('Busan', 'South Korea', NULL, 35.1796, 129.0756),
  ('Ho Chi Minh City', 'Vietnam', NULL, 10.8231, 106.6297),
  ('Hanoi', 'Vietnam', NULL, 21.0278, 105.8342),
  ('Bangkok', 'Thailand', NULL, 13.7563, 100.5018),
  ('Kuala Lumpur', 'Malaysia', NULL, 3.139, 101.6869),
  ('Penang', 'Malaysia', NULL, 5.4141, 100.3288),
  ('Singapore', 'Singapore', NULL, 1.3521, 103.8198),
  ('Jakarta', 'Indonesia', NULL, -6.2088, 106.8456),
  ('Surabaya', 'Indonesia', NULL, -7.2575, 112.7521),
  ('Manila', 'Philippines', NULL, 14.5995, 120.9842),
  ('Dubai', 'United Arab Emirates', NULL, 25.2048, 55.2708),
  ('Abu Dhabi', 'United Arab Emirates', NULL, 24.4539, 54.3773),
  ('Sharjah', 'United Arab Emirates', NULL, 25.3463, 55.4209),
  ('Riyadh', 'Saudi Arabia', NULL, 24.7136, 46.6753),
  ('Jeddah', 'Saudi Arabia', NULL, 21.4858, 39.1925),
  ('Dammam', 'Saudi Arabia', NULL, 26.4207, 50.0888),
  ('Doha', 'Qatar', NULL, 25.2854, 51.531),
  ('Muscat', 'Oman', NULL, 23.588, 58.3829),
  ('Kuwait City', 'Kuwait', NULL, 29.3759, 47.9774),
  ('Manama', 'Bahrain', NULL, 26.2285, 50.586),
  ('Tel Aviv', 'Israel', NULL, 32.0853, 34.7818),
  ('Amman', 'Jordan', NULL, 31.9454, 35.9284),
  ('Istanbul', 'Türkiye', NULL, 41.0082, 28.9784),
  ('Bursa', 'Türkiye', NULL, 40.1885, 29.061),
  ('Izmir', 'Türkiye', NULL, 38.4237, 27.1428),
  ('Ankara', 'Türkiye', NULL, 39.9334, 32.8597),
  ('Tehran', 'Iran', NULL, 35.6892, 51.389),
  ('Almaty', 'Kazakhstan', NULL, 43.222, 76.8512),
  ('Tashkent', 'Uzbekistan', NULL, 41.2995, 69.2401),
  ('Cairo', 'Egypt', NULL, 30.0444, 31.2357),
  ('Alexandria', 'Egypt', NULL, 31.2001, 29.9187),
  ('Casablanca', 'Morocco', NULL, 33.5731, -7.5898),
  ('Lagos', 'Nigeria', NULL, 6.5244, 3.3792),
  ('Abuja', 'Nigeria', NULL, 9.0765, 7.3986),
  ('Accra', 'Ghana', NULL, 5.6037, -0.187),
  ('Abidjan', 'Côte d''Ivoire', NULL, 5.36, -4.0083),
  ('Dakar', 'Senegal', NULL, 14.7167, -17.4677),
  ('Nairobi', 'Kenya', NULL, -1.2921, 36.8219),
  ('Mombasa', 'Kenya', NULL, -4.0435, 39.6682),
  ('Dar es Salaam', 'Tanzania', NULL, -6.7924, 39.2083),
  ('Kampala', 'Uganda', NULL, 0.3476, 32.5825),
  ('Addis Ababa', 'Ethiopia', NULL, 8.9806, 38.7578),
  ('Johannesburg', 'South Africa', NULL, -26.2041, 28.0473),
  ('Durban', 'South Africa', NULL, -29.8587, 31.0218),
  ('Cape Town', 'South Africa', NULL, -33.9249, 18.4241),
  ('Port Louis', 'Mauritius', NULL, -20.1609, 57.5012),
  ('London', 'United Kingdom', NULL, 51.5074, -0.1278),
  ('Birmingham', 'United Kingdom', NULL, 52.4862, -1.8904),
  ('Manchester', 'United Kingdom', NULL, 53.4808, -2.2426),
  ('Dublin', 'Ireland', NULL, 53.3498, -6.2603),
  ('Berlin', 'Germany', NULL, 52.52, 13.405),
  ('Hamburg', 'Germany', NULL, 53.5511, 9.9937),
  ('Frankfurt', 'Germany', NULL, 50.1109, 8.6821),
  ('Munich', 'Germany', NULL, 48.1351, 11.582),
  ('Stuttgart', 'Germany', NULL, 48.7758, 9.1829),
  ('Düsseldorf', 'Germany', NULL, 51.2277, 6.7735),
  ('Paris', 'France', NULL, 48.8566, 2.3522),
  ('Lyon', 'France', NULL, 45.764, 4.8357),
  ('Marseille', 'France', NULL, 43.2965, 5.3698),
  ('Amsterdam', 'Netherlands', NULL, 52.3676, 4.9041),
  ('Rotterdam', 'Netherlands', NULL, 51.9244, 4.4777),
  ('Antwerp', 'Belgium', NULL, 51.2194, 4.4025),
  ('Brussels', 'Belgium', NULL, 50.8503, 4.3517),
  ('Milan', 'Italy', NULL, 45.4642, 9.19),
  ('Turin', 'Italy', NULL, 45.0703, 7.6869),
  ('Rome', 'Italy', NULL, 41.9028, 12.4964),
  ('Madrid', 'Spain', NULL, 40.4168, -3.7038),
  ('Barcelona', 'Spain', NULL, 41.3874, 2.1686),
  ('Valencia', 'Spain', NULL, 39.4699, -0.3763),
  ('Lisbon', 'Portugal', NULL, 38.7223, -9.1393),
  ('Porto', 'Portugal', NULL, 41.1579, -8.6291),
  ('Zurich', 'Switzerland', NULL, 47.3769, 8.5417),
  ('Vienna', 'Austria', NULL, 48.2082, 16.3738),
  ('Warsaw', 'Poland', NULL, 52.2297, 21.0122),
  ('Prague', 'Czechia', NULL, 50.0755, 14.4378),
  ('Budapest', 'Hungary', NULL, 47.4979, 19.0402),
  ('Bucharest', 'Romania', NULL, 44.4268, 26.1025),
  ('Athens', 'Greece', NULL, 37.9838, 23.7275),
  ('Stockholm', 'Sweden', NULL, 59.3293, 18.0686),
  ('Copenhagen', 'Denmark', NULL, 55.6761, 12.5683),
  ('Oslo', 'Norway', NULL, 59.9139, 10.7522),
  ('Helsinki', 'Finland', NULL, 60.1699, 24.9384),
  ('Kyiv', 'Ukraine', NULL, 50.4501, 30.5234),
  ('Moscow', 'Russia', NULL, 55.7558, 37.6173),
  ('Saint Petersburg', 'Russia', NULL, 59.9311, 30.3609),
  ('New York', 'United States', 'New York', 40.7128, -74.006),
  ('Los Angeles', 'United States', 'California', 34.0522, -118.2437),
  ('San Francisco', 'United States', 'California', 37.7749, -122.4194),
  ('Chicago', 'United States', 'Illinois', 41.8781, -87.6298),
  ('Houston', 'United States', 'Texas', 29.7604, -95.3698),
  ('Dallas', 'United States', 'Texas', 32.7767, -96.797),
  ('Miami', 'United States', 'Florida', 25.7617, -80.1918),
  ('Atlanta', 'United States', 'Georgia', 33.749, -84.388),
  ('Seattle', 'United States', 'Washington', 47.6062, -122.3321),
  ('Detroit', 'United States', 'Michigan', 42.3314, -83.0458),
  ('Toronto', 'Canada', 'Ontario', 43.6532, -79.3832),
  ('Vancouver', 'Canada', 'British Columbia', 49.2827, -123.1207),
  ('Montreal', 'Canada', 'Quebec', 45.5017, -73.5673),
  ('Mexico City', 'Mexico', NULL, 19.4326, -99.1332),
  ('Monterrey', 'Mexico', NULL, 25.6866, -100.3161),
  ('Guadalajara', 'Mexico', NULL, 20.6597, -103.3496),
  ('São Paulo', 'Brazil', NULL, -23.5505, -46.6333),
  ('Rio de Janeiro', 'Brazil', NULL, -22.9068, -43.1729),
  ('Buenos Aires', 'Argentina', NULL, -34.6037, -58.3816),
  ('Santiago', 'Chile', NULL, -33.4489, -70.6693),
  ('Bogotá', 'Colombia', NULL, 4.711, -74.0721),
  ('Lima', 'Peru', NULL, -12.0464, -77.0428),
  ('Sydney', 'Australia', 'New South Wales', -33.8688, 151.2093),
  ('Melbourne', 'Australia', 'Victoria', -37.8136, 144.9631),
  ('Brisbane', 'Australia', 'Queensland', -27.4698, 153.0251),
  ('Perth', 'Australia', 'Western Australia', -31.9505, 115.8605),
  ('Auckland', 'New Zealand', NULL, -36.8485, 174.7633),
  ('Suva', 'Fiji', NULL, -18.1416, 178.4419)
ON CONFLICT (name, country) DO UPDATE SET region = EXCLUDED.region, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude;

-- ── An active paid plan ──
CREATE OR REPLACE FUNCTION public.company_has_paid_plan(p_company uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
     WHERE s.company_id = p_company AND s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at > now())
  );
$$;

-- ── Where a company goes on the map ──
-- " nehru place delhi ": lower-case letters only, single spaces, padded, so whole words can be matched with LIKE
CREATE OR REPLACE FUNCTION public.map_words(v text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ' ' || btrim(regexp_replace(lower(COALESCE(v, '')), '[^[:alpha:]]+', ' ', 'g')) || ' ';
$$;

CREATE OR REPLACE FUNCTION public.company_map_point(p_company uuid)
RETURNS TABLE (latitude double precision, longitude double precision, location_precision text, city text, state text, country text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT x.latitude, x.longitude, x.location_precision, x.city, x.state, x.country FROM (
    -- the factory pin: checked by an admin ('exact') or placed by the manufacturer and not yet checked ('pinned')
    SELECT fl.latitude, fl.longitude,
           CASE fl.status WHEN 'verified' THEN 'exact' ELSE 'pinned' END AS location_precision,
           COALESCE(NULLIF(btrim(fl.city), ''), NULLIF(btrim(c.city), '')) AS city,
           COALESCE(NULLIF(btrim(fl.state), ''), NULLIF(btrim(c.state), '')) AS state,
           COALESCE(NULLIF(btrim(fl.country), ''), NULLIF(btrim(c.country), ''), 'India') AS country,
           1 AS rank, true AS in_city, 0 AS len
      FROM public.factory_locations fl
      JOIN public.companies c ON c.id = fl.company_id
     WHERE fl.company_id = p_company AND fl.status IN ('verified', 'pending')
    UNION ALL
    -- else the centre of the city named in the profile: whole words, the city field before the state field (which
    -- some profiles fill with the city), the longest name first ("Navi Mumbai" before "Mumbai")
    SELECT mp.latitude, mp.longitude, 'city', mp.name, COALESCE(NULLIF(btrim(c.state), ''), mp.region), mp.country,
           2, public.map_words(c.city) LIKE '%' || public.map_words(mp.name) || '%', length(mp.name)
      FROM public.companies c
      JOIN public.map_places mp ON lower(mp.country) = lower(COALESCE(NULLIF(btrim(c.country), ''), 'India'))
     WHERE c.id = p_company
       AND (public.map_words(c.city) LIKE '%' || public.map_words(mp.name) || '%'
            OR public.map_words(c.state) LIKE '%' || public.map_words(mp.name) || '%')
  ) x
  ORDER BY x.rank, x.in_city DESC, x.len DESC
  LIMIT 1;
$$;

-- ── Who is on the map (the one place the display rules live) ──
-- (replaces 00071's version, which returned the company id only)
DROP FUNCTION IF EXISTS public.map_visible_company_ids();
CREATE FUNCTION public.map_visible_company_ids()
RETURNS TABLE (
  company_id uuid, latitude double precision, longitude double precision, location_precision text,
  city text, state text, country text, verified boolean, verified_since timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, pt.latitude, pt.longitude, pt.location_precision, pt.city, pt.state, pt.country,
         (c.verification_status = 'verified'
           AND (c.verification_expiry_at IS NULL OR c.verification_expiry_at > now())
           AND (bv.company_id IS NULL OR (bv.status = 'approved' AND (bv.recheck_due_at IS NULL OR bv.recheck_due_at > now())))) AS verified,
         COALESCE(bv.decided_at, c.verified_at)
    FROM public.companies c
    JOIN public.profiles p ON p.id = c.owner_id AND p.status = 'active' AND p.role = 'supplier'
    LEFT JOIN public.business_verifications bv ON bv.company_id = c.id
    CROSS JOIN LATERAL public.company_map_point(c.id) pt
   WHERE NOT COALESCE(c.is_blocked, false)
     AND c.verification_status <> 'rejected'
     AND (bv.company_id IS NULL OR bv.status NOT IN ('rejected', 'suspended'))
     AND c.owner_id <> '00000000-0000-0000-0000-000000000001'::uuid
     AND c.id::text NOT LIKE 'e1000001-0000-0000-0000-%'
     AND public.company_has_paid_plan(c.id);
$$;
REVOKE ALL ON FUNCTION public.map_visible_company_ids() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_map_point(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.company_has_paid_plan(uuid) FROM PUBLIC, anon, authenticated;

-- ── Search ──
DROP FUNCTION IF EXISTS public.map_search_suppliers(text, double precision, double precision, double precision, text, numeric, numeric, text, boolean, boolean, boolean, double precision, double precision, double precision, double precision, integer, integer, text);
DROP FUNCTION IF EXISTS public.map_search_suppliers(text, double precision, double precision, double precision, text, numeric, numeric, text, boolean, boolean, boolean, double precision, double precision, double precision, double precision, integer, integer, text, boolean);
CREATE FUNCTION public.map_search_suppliers(
  p_query text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_radius_km double precision DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_max_moq numeric DEFAULT NULL,
  p_min_capacity numeric DEFAULT NULL,
  p_supplier_type text DEFAULT NULL,
  p_require_gst boolean DEFAULT false,
  p_require_cin boolean DEFAULT false,
  p_require_udyam boolean DEFAULT false,
  p_south double precision DEFAULT NULL,
  p_west double precision DEFAULT NULL,
  p_north double precision DEFAULT NULL,
  p_east double precision DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0,
  p_country text DEFAULT NULL,
  p_verified_only boolean DEFAULT false
)
RETURNS TABLE (
  company_id uuid, company_name text, slug text, business_type text, city text, state text, country text,
  latitude double precision, longitude double precision, location_precision text, distance_km double precision,
  rating numeric, review_count integer, logo_url text, cover_url text,
  verified boolean, gst_verified boolean, cin_verified boolean, udyam_verified boolean, registry_verified boolean, verified_since timestamptz,
  matched_products jsonb, product_count integer, min_moq numeric, moq_unit text,
  monthly_capacity numeric, capacity_unit text, lead_time_days integer, stock_status text, supply_type text,
  availability_updated_at timestamptz, total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT NULLIF(btrim(p_query), '') AS term,
           NULLIF(btrim(p_category), '') AS cat,
           NULLIF(btrim(p_country), '') AS country,
           CASE WHEN p_radius_km IS NULL OR p_lat IS NULL THEN NULL
                ELSE p_radius_km / (111.0 * GREATEST(cos(radians(p_lat)), 0.01)) END AS dlng,
           LEAST(GREATEST(COALESCE(p_limit, 100), 1), 200) AS lim,
           GREATEST(COALESCE(p_offset, 0), 0) AS off
  ),
  base AS (
    SELECT c.id, c.company_name, c.slug, c.business_type, c.rating_avg, c.review_count, c.logo_url, c.cover_url,
           c.key_products, c.description,
           v.latitude, v.longitude, v.location_precision, v.city, v.state, v.country, v.verified, v.verified_since,
           fl.monthly_capacity, fl.capacity_unit, fl.lead_time_days, fl.stock_status, fl.supply_type, fl.availability_updated_at,
           -- registration checks count only while the company is verified
           (v.verified AND COALESCE(bv.gst_verified, false)) AS gst_verified,
           (v.verified AND COALESCE(bv.cin_verified, false)) AS cin_verified,
           (v.verified AND COALESCE(bv.udyam_verified, false)) AS udyam_verified,
           (v.verified AND COALESCE(bv.registry_verified, false)) AS registry_verified,
           CASE WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL
                ELSE public.km_between(p_lat, p_lng, v.latitude, v.longitude) END AS dist
      FROM public.map_visible_company_ids() v
      JOIN public.companies c ON c.id = v.company_id
      LEFT JOIN public.factory_locations fl ON fl.company_id = c.id
      LEFT JOIN public.business_verifications bv ON bv.company_id = c.id, q
     WHERE (p_south IS NULL OR v.latitude BETWEEN p_south AND p_north)
       AND (p_west IS NULL OR p_east IS NULL OR CASE WHEN p_west <= p_east THEN v.longitude BETWEEN p_west AND p_east
                                                     ELSE v.longitude >= p_west OR v.longitude <= p_east END)
       AND (q.country IS NULL OR lower(v.country) = lower(q.country))
       AND (p_radius_km IS NULL OR p_lat IS NULL OR p_lng IS NULL OR (
             v.latitude BETWEEN p_lat - p_radius_km / 111.0 AND p_lat + p_radius_km / 111.0
             AND (q.dlng >= 180 OR abs(v.longitude - p_lng) <= q.dlng OR abs(v.longitude - p_lng) >= 360 - q.dlng)))
       AND (NOT p_verified_only OR v.verified)
       AND (NOT p_require_gst OR (v.verified AND COALESCE(bv.gst_verified, false)))
       AND (NOT p_require_cin OR (v.verified AND COALESCE(bv.cin_verified, false)))
       AND (NOT p_require_udyam OR (v.verified AND COALESCE(bv.udyam_verified, false)))
       AND (p_supplier_type IS NULL OR c.business_type ILIKE '%' || p_supplier_type || '%' OR c.trade_type ILIKE '%' || p_supplier_type || '%')
       AND (p_min_capacity IS NULL OR fl.monthly_capacity >= p_min_capacity)
  ),
  prods AS (
    SELECT b.id AS company_id, pr.id, pr.name, pr.slug, pr.moq, pr.moq_unit, pr.price_min, pr.price_max, pr.price_currency,
           (pr.images)[1] AS image, cat.name AS category
      FROM base b
      JOIN public.products pr ON pr.company_id = b.id AND pr.is_active
      LEFT JOIN public.categories cat ON cat.id = pr.category_id, q
     WHERE (q.term IS NULL OR pr.name ILIKE '%' || q.term || '%' OR cat.name ILIKE '%' || q.term || '%'
            OR array_to_string(pr.tags, ' ') ILIKE '%' || q.term || '%')
       AND (q.cat IS NULL OR cat.slug = q.cat OR cat.name ILIKE q.cat)
       AND (p_max_moq IS NULL OR pr.moq IS NULL OR pr.moq <= p_max_moq)
  ),
  agg AS (
    SELECT company_id,
           jsonb_agg(jsonb_build_object('id', id, 'name', name, 'slug', slug, 'moq', moq, 'moq_unit', moq_unit,
                     'price_min', price_min, 'price_max', price_max, 'currency', price_currency, 'image', image, 'category', category)
                     ORDER BY moq NULLS LAST) AS items,
           count(*)::int AS n,
           min(moq)::numeric AS min_moq,
           (array_agg(moq_unit ORDER BY moq NULLS LAST))[1] AS unit
      FROM prods
     GROUP BY company_id
  ),
  matched AS (
    SELECT b.*, COALESCE(a.items, '[]'::jsonb) AS items, COALESCE(a.n, 0) AS n, a.min_moq, a.unit
      FROM base b
      LEFT JOIN agg a ON a.company_id = b.id, q
     WHERE a.company_id IS NOT NULL
        -- no product filters: every company on the map, with or without products
        OR (q.term IS NULL AND q.cat IS NULL AND p_max_moq IS NULL)
        -- a search also matches the company's name, its listed key products and its description
        OR (q.term IS NOT NULL AND q.cat IS NULL AND p_max_moq IS NULL
            AND (b.company_name ILIKE '%' || q.term || '%'
                 OR array_to_string(b.key_products, ' ') ILIKE '%' || q.term || '%'
                 OR COALESCE(b.description, '') ILIKE '%' || q.term || '%'))
  ),
  ranged AS (
    SELECT * FROM matched WHERE p_radius_km IS NULL OR dist IS NULL OR dist <= p_radius_km
  )
  SELECT r.id, r.company_name, r.slug, r.business_type, r.city, r.state, r.country, r.latitude, r.longitude, r.location_precision,
         round(r.dist::numeric, 1)::double precision,
         r.rating_avg, r.review_count, r.logo_url, r.cover_url,
         r.verified, r.gst_verified, r.cin_verified, r.udyam_verified, r.registry_verified, r.verified_since,
         (SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM (SELECT e FROM jsonb_array_elements(r.items) e LIMIT 6) s),
         r.n, r.min_moq, r.unit, r.monthly_capacity, r.capacity_unit, r.lead_time_days, r.stock_status, r.supply_type,
         r.availability_updated_at, count(*) OVER ()
    FROM ranged r, q
   ORDER BY r.dist NULLS LAST, r.verified DESC, r.rating_avg DESC NULLS LAST, r.company_name
   LIMIT (SELECT lim FROM q) OFFSET (SELECT off FROM q);
$$;
REVOKE ALL ON FUNCTION public.map_search_suppliers(text, double precision, double precision, double precision, text, numeric, numeric, text, boolean, boolean, boolean, double precision, double precision, double precision, double precision, integer, integer, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.map_search_suppliers(text, double precision, double precision, double precision, text, numeric, numeric, text, boolean, boolean, boolean, double precision, double precision, double precision, double precision, integer, integer, text, boolean) TO anon, authenticated, service_role;

-- ── One company's card ──
CREATE OR REPLACE FUNCTION public.map_supplier_detail(p_company_id uuid, p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'company_id', c.id, 'company_name', c.company_name, 'slug', c.slug, 'business_type', c.business_type,
    'description', c.description, 'year_established', c.year_established, 'logo_url', c.logo_url,
    'cover_url', c.cover_url, 'banner_url', c.banner_url, 'gallery_images', COALESCE(to_jsonb(c.gallery_images), '[]'::jsonb),
    'rating', c.rating_avg, 'review_count', c.review_count,
    'production_capacity_text', c.production_capacity,
    'city', v.city, 'state', v.state, 'country', v.country,
    -- the street address only for a pinned factory; a city-level point shows the city
    'factory_address', CASE WHEN v.location_precision IN ('exact', 'pinned') THEN fl.address END,
    'latitude', v.latitude, 'longitude', v.longitude, 'location_precision', v.location_precision,
    'distance_km', CASE WHEN p_lat IS NULL OR p_lng IS NULL THEN NULL ELSE round(public.km_between(p_lat, p_lng, v.latitude, v.longitude)::numeric, 1) END,
    'monthly_capacity', fl.monthly_capacity, 'capacity_unit', fl.capacity_unit, 'lead_time_days', fl.lead_time_days,
    'stock_status', fl.stock_status, 'supply_type', fl.supply_type, 'availability_updated_at', fl.availability_updated_at,
    'verified', v.verified,
    'gst_verified', v.verified AND COALESCE(bv.gst_verified, false), 'cin_verified', v.verified AND COALESCE(bv.cin_verified, false),
    'udyam_verified', v.verified AND COALESCE(bv.udyam_verified, false), 'registry_verified', v.verified AND COALESCE(bv.registry_verified, false),
    'registration_country', bv.registration_country,
    'entity_type', bv.entity_type, 'verified_since', v.verified_since,
    'products', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', pr.id, 'name', pr.name, 'slug', pr.slug, 'moq', pr.moq, 'moq_unit', pr.moq_unit,
               'price_min', pr.price_min, 'price_max', pr.price_max, 'currency', pr.price_currency, 'image', (pr.images)[1])
               ORDER BY pr.updated_at DESC NULLS LAST)
        FROM (SELECT * FROM public.products WHERE company_id = c.id AND is_active ORDER BY updated_at DESC NULLS LAST LIMIT 12) pr
    ), '[]'::jsonb)
  )
    FROM public.map_visible_company_ids() v
    JOIN public.companies c ON c.id = v.company_id
    LEFT JOIN public.factory_locations fl ON fl.company_id = c.id
    LEFT JOIN public.business_verifications bv ON bv.company_id = c.id
   WHERE c.id = p_company_id;
$$;

-- ── Manufacturer: what is still missing ──
CREATE OR REPLACE FUNCTION public.supplier_map_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT public.my_company_id() AS id)
  SELECT jsonb_build_object(
    'company_id', me.id,
    'company_verification', c.verification_status,
    'blocked', COALESCE(c.is_blocked, false),
    'paid', CASE WHEN me.id IS NULL THEN false ELSE public.company_has_paid_plan(me.id) END,
    'business', (SELECT to_jsonb(bv) FROM public.business_verifications bv WHERE bv.company_id = me.id),
    'location', (SELECT to_jsonb(fl) FROM public.factory_locations fl WHERE fl.company_id = me.id),
    'map_point', (SELECT to_jsonb(pt) FROM public.company_map_point(me.id) pt),
    'profile_city', c.city,
    'active_products', (SELECT count(*) FROM public.products pr WHERE pr.company_id = me.id AND pr.is_active),
    'account_active', EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.status = 'active' AND p.role = 'supplier'),
    'on_map', EXISTS (SELECT 1 FROM public.map_visible_company_ids() v WHERE v.company_id = me.id),
    'verified', COALESCE((SELECT v.verified FROM public.map_visible_company_ids() v WHERE v.company_id = me.id), false)
  )
    FROM me LEFT JOIN public.companies c ON c.id = me.id;
$$;

-- ── Live updates when a plan starts or ends, or a profile's city changes ──
DROP TRIGGER IF EXISTS trg_map_change_subscriptions ON public.subscriptions;
CREATE TRIGGER trg_map_change_subscriptions AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.signal_supplier_map_change();
DROP TRIGGER IF EXISTS trg_map_change_companies ON public.companies;
CREATE TRIGGER trg_map_change_companies
  AFTER UPDATE OF verification_status, verification_expiry_at, is_blocked, company_name, logo_url, cover_url, city, state, country, description ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.signal_supplier_map_change();

COMMIT;

NOTIFY pgrst, 'reload schema';
