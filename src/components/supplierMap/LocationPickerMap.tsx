/** A small map for placing the factory pin: click or drag the pin. */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './supplierMap.css';
import { INDIA_BOUNDS, WORLD_BOUNDS } from '@/lib/supplierMap/places';
import { baseTiles } from '@/lib/supplierMap/tiles';
import { factoryIcon } from './SupplierLeafletMap';

interface Props {
  value: { lat: number; lng: number } | null;
  onChange?: (v: { lat: number; lng: number }) => void;
  /** move the view here (a city picked from the list) */
  focus?: { lat: number; lng: number; zoom: number; key: number } | null;
  theme: 'dark' | 'light';
  readOnly?: boolean;
  /** with no pin yet: show India first (most BulkSkart factories), or the whole world */
  start?: 'india' | 'world';
  className?: string;
}

export default function LocationPickerMap({ value, onChange, focus, theme, readOnly = false, start = 'india', className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true, minZoom: 2, worldCopyJump: true, scrollWheelZoom: !readOnly, dragging: true });
    m.attributionControl.setPrefix(false);
    if (value) m.setView([value.lat, value.lng], 15);
    else m.fitBounds(start === 'world' ? WORLD_BOUNDS : INDIA_BOUNDS);
    if (!readOnly) m.on('click', (e: L.LeafletMouseEvent) => { const p = e.latlng.wrap(); change.current?.({ lat: round6(p.lat), lng: round6(p.lng) }); });
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      pin.current = null;
    };
    // created once; value changes are handled below
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const cfg = baseTiles(theme);
    tiles.current?.remove();
    tiles.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, subdomains: cfg.subdomains ?? 'abc', maxZoom: cfg.maxZoom, detectRetina: true }).addTo(m);
  }, [theme]);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!value) {
      pin.current?.remove();
      pin.current = null;
      return;
    }
    if (!pin.current) {
      pin.current = L.marker([value.lat, value.lng], { icon: factoryIcon(true), draggable: !readOnly, keyboard: true, title: 'Factory location' }).addTo(m);
      pin.current.on('dragend', () => {
        const p = pin.current?.getLatLng().wrap();
        if (p) change.current?.({ lat: round6(p.lat), lng: round6(p.lng) });
      });
    } else pin.current.setLatLng([value.lat, value.lng]);
    if (!m.getBounds().contains([value.lat, value.lng])) m.setView([value.lat, value.lng], Math.max(m.getZoom(), 14));
  }, [value, readOnly]);

  useEffect(() => {
    if (focus && map.current) map.current.setView([focus.lat, focus.lng], focus.zoom);
  }, [focus]);

  return <div ref={el} className={className} role="application" aria-label="Map: click to place your factory pin" />;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
