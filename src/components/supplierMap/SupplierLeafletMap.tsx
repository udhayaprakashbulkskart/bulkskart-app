/**
 * The supplier map: orange factory markers with a green "verified" check, the buyer's point and search radius.
 * Leaflet is driven directly (no wrapper library); this file is only loaded with the map pages.
 */
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './supplierMap.css';
import type { MapSupplier } from '@/lib/supplierMap/types';
import { WORLD_BOUNDS } from '@/lib/supplierMap/places';
import { baseTiles, satelliteTiles } from '@/lib/supplierMap/tiles';

const FACTORY_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function factoryIcon(selected = false, label?: string): L.DivIcon {
  return L.divIcon({
    className: 'bsm-marker',
    html: `<div class="bsm-pin${selected ? ' is-selected' : ''}" ${label ? `title="${esc(label)}"` : ''}><span class="bsm-pin-head">${FACTORY_SVG}</span><span class="bsm-pin-check">${CHECK_SVG}</span></div>`,
    iconSize: selected ? [48, 58] : [38, 46],
    iconAnchor: selected ? [24, 56] : [19, 44],
  });
}

const youIcon = L.divIcon({ className: 'bsm-marker', html: '<div class="bsm-you"><span></span></div>', iconSize: [22, 22], iconAnchor: [11, 11] });

export type Bounds = { south: number; west: number; north: number; east: number };

interface Props {
  suppliers: MapSupplier[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  buyer: { lat: number; lng: number } | null;
  radiusKm: number | null;
  theme: 'dark' | 'light';
  satellite?: boolean;
  /** change it to frame the results again (a new search); panning by the user does not change it */
  fitKey: number;
  /** called after the person moves or zooms the map themselves */
  onUserMove?: (b: Bounds) => void;
  /** the centre of the map after every move, wherever it came from */
  onView?: (centre: { lat: number; lng: number }) => void;
  /** room taken by panels over the map (px), so the selected marker is kept clear of them */
  padding?: { top: number; bottom: number; left?: number; right?: number };
  className?: string;
}

export default function SupplierLeafletMap({ suppliers, selectedId, onSelect, buyer, radiusKm, theme, satellite = false, fitKey, onUserMove, onView, padding, className }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tiles = useRef<L.TileLayer | null>(null);
  const markers = useRef<Map<string, L.Marker>>(new Map());
  const layer = useRef<L.LayerGroup | null>(null);
  const you = useRef<L.Marker | null>(null);
  const ring = useRef<L.Circle | null>(null);
  // moves the person made (drag, wheel, pinch, zoom buttons, keys), as opposed to the page framing results
  const lastInput = useRef(0);
  const cb = useRef({ onSelect, onUserMove, onView });
  cb.current = { onSelect, onUserMove, onView };
  const pad = useRef(padding);
  pad.current = padding;

  // create once
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: false, attributionControl: true, worldCopyJump: true, minZoom: 2, preferCanvas: false });
    m.fitBounds(WORLD_BOUNDS);
    L.control.zoom({ position: 'bottomright' }).addTo(m);
    m.attributionControl.setPrefix(false);
    layer.current = L.layerGroup().addTo(m);
    const node = el.current;
    // tapping a marker pans the map to it; that is not the person exploring a new area
    const mark = (e: Event) => {
      if (!(e.target instanceof Element && e.target.closest('.leaflet-marker-icon'))) lastInput.current = Date.now();
    };
    const EVENTS = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const;
    for (const ev of EVENTS) node.addEventListener(ev, mark, { passive: true });
    m.on('moveend', () => {
      const c = m.getCenter().wrap();
      cb.current.onView?.({ lat: c.lat, lng: c.lng });
      if (Date.now() - lastInput.current > 2500) return;
      const b = m.getBounds();
      cb.current.onUserMove?.({ south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() });
    });
    map.current = m;
    // the container can change size with the layout (panels, phone rotation)
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(node);
    return () => {
      ro.disconnect();
      for (const ev of EVENTS) node.removeEventListener(ev, mark);
      m.remove();
      map.current = null;
      markers.current.clear();
    };
  }, []);

  // background tiles follow the site theme
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const cfg = (satellite && satelliteTiles()) || baseTiles(theme);
    tiles.current?.remove();
    tiles.current = L.tileLayer(cfg.url, { attribution: cfg.attribution, subdomains: cfg.subdomains ?? 'abc', maxZoom: cfg.maxZoom, detectRetina: cfg.detectRetina, className: cfg.className }).addTo(m);
  }, [theme, satellite]);

  // markers
  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    const keep = new Set(suppliers.map((s) => s.company_id));
    for (const [id, mk] of markers.current) {
      if (!keep.has(id)) {
        g.removeLayer(mk);
        markers.current.delete(id);
      }
    }
    for (const s of suppliers) {
      const pos = L.latLng(s.latitude, s.longitude);
      const existing = markers.current.get(s.company_id);
      if (existing) {
        existing.setLatLng(pos);
        continue;
      }
      const mk = L.marker(pos, { icon: factoryIcon(s.company_id === selectedId, s.company_name), keyboard: true, title: s.company_name, riseOnHover: true, alt: `${s.company_name}, verified manufacturer` });
      mk.on('click', () => cb.current.onSelect(s.company_id));
      mk.addTo(g);
      markers.current.set(s.company_id, mk);
    }
    // selectedId is applied by the next effect
  }, [suppliers]);

  // selection: bigger marker, kept in view
  useEffect(() => {
    for (const [id, mk] of markers.current) {
      const s = suppliers.find((x) => x.company_id === id);
      mk.setIcon(factoryIcon(id === selectedId, s?.company_name));
      mk.setZIndexOffset(id === selectedId ? 1000 : 0);
    }
    const m = map.current;
    const mk = selectedId ? markers.current.get(selectedId) : null;
    if (m && mk) {
      const p = pad.current ?? { top: 80, bottom: 40 };
      const point = m.latLngToContainerPoint(mk.getLatLng());
      const size = m.getSize();
      const inside = point.x > (p.left ?? 40) && point.x < size.x - (p.right ?? 40) && point.y > p.top && point.y < size.y - p.bottom;
      if (!inside) m.panInside(mk.getLatLng(), { paddingTopLeft: [p.left ?? 40, p.top], paddingBottomRight: [p.right ?? 40, p.bottom] });
    }
  }, [selectedId, suppliers]);

  // buyer point and radius
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    you.current?.remove();
    ring.current?.remove();
    you.current = null;
    ring.current = null;
    if (!buyer) return;
    you.current = L.marker([buyer.lat, buyer.lng], { icon: youIcon, interactive: false, keyboard: false, zIndexOffset: 500 }).addTo(m);
    if (radiusKm) {
      ring.current = L.circle([buyer.lat, buyer.lng], { radius: radiusKm * 1000, color: '#FF5A00', weight: 1.5, dashArray: '6 6', fillColor: '#FF5A00', fillOpacity: 0.06, interactive: false }).addTo(m);
    }
  }, [buyer, radiusKm]);

  // frame the results when a new search runs
  useEffect(() => {
    const m = map.current;
    if (!m || fitKey === 0) return;
    const p = pad.current ?? { top: 80, bottom: 40 };
    const opts: L.FitBoundsOptions = { paddingTopLeft: [p.left ?? 30, p.top], paddingBottomRight: [p.right ?? 30, p.bottom], maxZoom: 13 };
    if (buyer && radiusKm) m.fitBounds(L.latLng(buyer.lat, buyer.lng).toBounds(radiusKm * 2000), opts);
    else if (suppliers.length > 0) {
      const b = L.latLngBounds(suppliers.map((s) => [s.latitude, s.longitude] as [number, number]));
      if (buyer) b.extend([buyer.lat, buyer.lng]);
      m.fitBounds(b, { ...opts, maxZoom: 11 });
    } else if (buyer) m.setView([buyer.lat, buyer.lng], 9);
    else m.fitBounds(WORLD_BOUNDS, opts);
  }, [fitKey]);

  return <div ref={el} className={className} role="application" aria-label="Map of verified manufacturers" />;
}
