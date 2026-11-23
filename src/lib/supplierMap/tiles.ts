/**
 * Map background tiles. By default CARTO's dark and light basemaps (OpenStreetMap data). CARTO's free basemaps are
 * for limited, non-commercial use; for a commercial site at scale, set VITE_MAP_TILE_URL_DARK / _LIGHT (and
 * VITE_MAP_TILE_ATTRIBUTION) to a licensed provider such as MapTiler, Stadia Maps or CARTO Enterprise.
 * A satellite layer is offered only when VITE_MAP_SATELLITE_URL is set, because satellite imagery always needs a licence.
 */
const env = import.meta.env as Record<string, string | undefined>;

const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';

export interface TileLayerConfig {
  url: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
}

export function baseTiles(theme: 'dark' | 'light'): TileLayerConfig {
  const custom = theme === 'dark' ? env.VITE_MAP_TILE_URL_DARK : env.VITE_MAP_TILE_URL_LIGHT;
  if (custom) return { url: custom, attribution: env.VITE_MAP_TILE_ATTRIBUTION || OSM, maxZoom: 19 };
  return {
    url: `https://{s}.basemaps.cartocdn.com/${theme === 'dark' ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`,
    attribution: `${OSM} &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>`,
    subdomains: 'abcd',
    maxZoom: 19,
  };
}

export function satelliteTiles(): TileLayerConfig | null {
  const url = env.VITE_MAP_SATELLITE_URL;
  if (!url) return null;
  return { url, attribution: env.VITE_MAP_SATELLITE_ATTRIBUTION || 'Imagery &copy; its provider', maxZoom: 19 };
}
