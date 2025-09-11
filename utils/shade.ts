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

function isPointInsidePolygon(pointLL: LngLat, polygon: [number, number][]): boolean {
  // Ray casting algorithm to check if point is inside polygon
  const x = pointLL.lng;
  const y = pointLL.lat;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}

export function isPointShaded(pointLL: LngLat, buildings: BuildingFeature[], when: Date, maxRayMeters = 500): ShadeResult {
  const sun = computeSun(when, pointLL.lat, pointLL.lng);
  if (sun.altitude <= 0) return { shaded: true }; // sun below horizon => effectively shade
  
  // Cast ray TOWARD the sun to see if anything blocks it
  const ray = castRay(pointLL, sun.bearingFromNorth, maxRayMeters);

  let nearestDist = Infinity;
  let shadedBy: string | number | undefined;

  for (const b of buildings) {
    // Skip if point is inside this building (no self-shadowing)
    if (isPointInsidePolygon(pointLL, b.outer)) {
      continue;
    }
    
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
      // Check if building is tall enough to block the sun at this distance
      // For a building to block the sun, its height must be >= distance * tan(altitude)
      const requiredHeight = nearestDist * Math.tan(sun.altitude);
      
      if (b.height >= requiredHeight) {
        shadedBy = b.id;
        break;
      }
    }
  }

  return { shaded: shadedBy !== undefined, byBuildingId: shadedBy };
}


