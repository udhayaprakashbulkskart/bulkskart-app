/**
 * Where to draw each marker. Companies placed at the same point (several profiles in one city, shown at the city
 * centre) are fanned out in a small circle so each can be tapped; the data itself is not changed.
 */
export function spreadPositions(items: { id: string; lat: number; lng: number }[], radiusDeg = 0.012): Map<string, [number, number]> {
  const groups = new Map<string, typeof items>();
  for (const it of items) {
    const key = `${it.lat.toFixed(4)},${it.lng.toFixed(4)}`;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  const out = new Map<string, [number, number]>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.set(group[0].id, [group[0].lat, group[0].lng]);
      continue;
    }
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const r = radiusDeg * Math.min(2.5, Math.sqrt(sorted.length / 2));
    sorted.forEach((it, i) => {
      const a = (2 * Math.PI * i) / sorted.length - Math.PI / 2;
      const lngScale = Math.max(Math.cos((it.lat * Math.PI) / 180), 0.2);
      out.set(it.id, [it.lat + r * Math.sin(a), it.lng + (r * Math.cos(a)) / lngScale]);
    });
  }
  return out;
}
