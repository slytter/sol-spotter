import type { BuildingFeature, LngLat } from '@/types';
import { computeSun } from '@/utils/sun';
import distance from '@turf/distance';
import { lineString, point, polygon } from '@turf/helpers';
import lineIntersect from '@turf/line-intersect';
import polygonToLine from '@turf/polygon-to-line';
import rhumbDestination from '@turf/rhumb-destination';

export type ShadeResult = {
  shaded: boolean;
  byBuildingId?: string | number;
};

function castRay(start: LngLat, bearingDeg: number, meters: number) {
  const startPt = point([start.lng, start.lat]);
  const endPt = rhumbDestination(startPt, meters / 1000, bearingDeg);
  const endCoords = endPt.geometry.coordinates as [number, number];
  return lineString([[start.lng, start.lat], endCoords]);
}

export function isPointShaded(pointLL: LngLat, buildings: BuildingFeature[], when: Date, maxRayMeters = 500): ShadeResult {
  const sun = computeSun(when, pointLL.lat, pointLL.lng);
  if (sun.altitude <= 0) return { shaded: true }; // sun below horizon => effectively shade
  const ray = castRay(pointLL, sun.bearingFromNorth, maxRayMeters);

  let nearestDist = Infinity;
  let shadedBy: string | number | undefined;

  for (const b of buildings) {
    // Convert ring to lineString collection
    const poly = polygon([b.outer]);
    const lines = polygonToLine(poly);
    const inter = lineIntersect(lines as any, ray);
    if (!inter.features.length) continue;
    // Get nearest intersection distance
    for (const f of inter.features) {
      const c = f.geometry.coordinates as [number, number];
      const d = distance(point([pointLL.lng, pointLL.lat]), point(c), { units: 'kilometers' }) * 1000;
      if (d < nearestDist) nearestDist = d;
    }
    if (nearestDist !== Infinity) {
      // Check if building tall enough to shade at this distance
      const requiredHeight = nearestDist * Math.tan(sun.altitude);
      if (b.height >= requiredHeight) {
        shadedBy = b.id;
        break;
      }
    }
  }

  return { shaded: shadedBy !== undefined, byBuildingId: shadedBy };
}


