/**
 * Map background tiles.
 *
 * Default: OpenStreetMap's own raster tiles. They need no API key and may be used with the attribution shown on the
 * map. Dark mode is the same tiles with a colour filter (class "bsm-tiles-dark"). OpenStreetMap serves them from
 * donated servers for moderate use (https://operations.osmfoundation.org/policies/tiles/); when traffic grows, switch
 * to a paid provider by setting VITE_MAP_TILE_URL_DARK / VITE_MAP_TILE_URL_LIGHT (and VITE_MAP_TILE_ATTRIBUTION)
 * to its tile URL, e.g. MapTiler, Stadia Maps or CARTO with your key. No code change is needed.
 * (CARTO's basemaps without a key show "API KEY REQUIRED" on live sites, so they are not the default.)
 * A satellite layer is offered only when VITE_MAP_SATELLITE_URL is set, because satellite imagery always needs a licence.
 */
const env = import.meta.env as Record<string, string | undefined>;

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export interface TileLayerConfig {
  url: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
  /** extra class on the tile layer (the dark-mode filter) */
  className?: string;
  /** ask for double-resolution tiles on sharp screens (only providers that offer them) */
  detectRetina: boolean;
}

export function baseTiles(theme: 'dark' | 'light'): TileLayerConfig {
  const custom = theme === 'dark' ? env.VITE_MAP_TILE_URL_DARK : env.VITE_MAP_TILE_URL_LIGHT;
  if (custom) return { url: custom, attribution: env.VITE_MAP_TILE_ATTRIBUTION || OSM, maxZoom: 19, detectRetina: false };
  return {
    url: OSM_TILE_URL,
    attribution: OSM,
    maxZoom: 19,
    // OpenStreetMap has no double-resolution tiles; asking for them would only load four times as many
    detectRetina: false,
    className: theme === 'dark' ? 'bsm-tiles-dark' : undefined,
  };
}

export function satelliteTiles(): TileLayerConfig | null {
  const url = env.VITE_MAP_SATELLITE_URL;
  if (!url) return null;
  return { url, attribution: env.VITE_MAP_SATELLITE_ATTRIBUTION || 'Imagery &copy; its provider', maxZoom: 19, detectRetina: false };
}
