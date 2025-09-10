import type { BuildingFeature, LngLat } from '@/types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

function parseHeightMeters(tags: Record<string, string | undefined>): number {
  const raw = tags.height || tags['building:height'];
  if (raw) {
    const m = /([0-9]+\.?[0-9]*)\s*(m|meter|meters)?/i.exec(raw);
    if (m) return parseFloat(m[1]);
  }
  const levels = tags['building:levels'];
  if (levels && !isNaN(Number(levels))) return Number(levels) * 3; // rough guess
  return 10; // fallback
}

export async function fetchBuildingsAround(center: LngLat, radiusMeters = 300): Promise<BuildingFeature[]> {
  const { lat, lng } = center;
  const query = `[
    out:json
  ];
  (
    way["building"](around:${radiusMeters},${lat},${lng});
  );
  out tags geom;`;

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }).toString(),
  });
  
  if (!res.ok) throw new Error(`Overpass error ${res.status}`);
  const json = await res.json();
  const elements = (json.elements ?? []) as any[];
  const features: BuildingFeature[] = [];
  for (const e of elements) {
    if (!e.geometry || !Array.isArray(e.geometry)) continue;
    // geometry is array of nodes (for closed way first==last). We ensure closure.
    const ring: [number, number][] = e.geometry.map((g: any) => [g.lon, g.lat]);
    if (ring.length < 3) continue;
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push(ring[0]);
    }
    const height = parseHeightMeters(e.tags || {});
    features.push({ id: e.id, outer: ring, height });
  }
  return features;
}


