import type { BuildingFeature, UIShadowPolygon } from '@/types';
import { centroidOfRing, projectToLocalMeters, unprojectToLngLat } from '@/utils/geo';
import { computeSun } from '@/utils/sun';

function rotate(x: number, y: number, deg: number) {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: x * c - y * s, y: x * s + y * c };
}

export function buildingToShadowPolygon(b: BuildingFeature, when: Date): UIShadowPolygon | null {
  const center = centroidOfRing(b.outer);
  const sun = computeSun(when, center.lat, center.lng);
  if (sun.altitude <= 0) return null;

  const length = b.height / Math.tan(sun.altitude); // meters

  // Project ring to local XY in meters
  const ringXY = b.outer.map(([lng, lat]) => projectToLocalMeters(center, { lng, lat }));

  // Determine extremes along axis perpendicular to shadow direction
  const perp = (sun.shadowBearing + 90) % 360; // degrees
  const perpRad = (perp * Math.PI) / 180;
  const ux = Math.cos(perpRad);
  const uy = Math.sin(perpRad);

  let minProj = Infinity, maxProj = -Infinity, minPt = { x: 0, y: 0 }, maxPt = { x: 0, y: 0 };
  for (const p of ringXY) {
    const proj = p.x * ux + p.y * uy;
    if (proj < minProj) {
      minProj = proj; minPt = p;
    }
    if (proj > maxProj) {
      maxProj = proj; maxPt = p;
    }
  }

  // Build a parallelogram: two base points and their forward-translated tips
  const dir = (sun.shadowBearing * Math.PI) / 180;
  const dx = Math.cos(dir) * length;
  const dy = Math.sin(dir) * length;

  const tip1 = { x: minPt.x + dx, y: minPt.y + dy };
  const tip2 = { x: maxPt.x + dx, y: maxPt.y + dy };

  const polyXY = [minPt, maxPt, tip2, tip1, minPt];

  const coords = polyXY.map((p) => {
    const ll = unprojectToLngLat(center, p);
    return { latitude: ll.lat, longitude: ll.lng };
  });

  return { id: b.id, coords };
}

export function buildingsToShadowPolygons(buildings: BuildingFeature[], when: Date): UIShadowPolygon[] {
  const out: UIShadowPolygon[] = [];
  for (const b of buildings) {
    const poly = buildingToShadowPolygon(b, when);
    if (poly) out.push(poly);
  }
  return out;
}


