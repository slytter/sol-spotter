import type { LngLat } from '@/types';

export type XY = { x: number; y: number };

export function metersPerDegree(lat: number) {
  const latMeters = 111132; // approx
  const lonMeters = 111320 * Math.cos((lat * Math.PI) / 180);
  return { latMeters, lonMeters };
}

export function projectToLocalMeters(anchor: LngLat, p: LngLat): XY {
  const { latMeters, lonMeters } = metersPerDegree(anchor.lat);
  return {
    x: (p.lng - anchor.lng) * lonMeters,
    y: (p.lat - anchor.lat) * latMeters,
  };
}

export function unprojectToLngLat(anchor: LngLat, xy: XY): LngLat {
  const { latMeters, lonMeters } = metersPerDegree(anchor.lat);
  return {
    lng: anchor.lng + xy.x / lonMeters,
    lat: anchor.lat + xy.y / latMeters,
  };
}

export function centroidOfRing(ring: [number, number][]): LngLat {
  // simple average (ok for small polygons)
  let lng = 0;
  let lat = 0;
  for (const [x, y] of ring) {
    lng += x;
    lat += y;
  }
  const n = ring.length;
  return { lng: lng / n, lat: lat / n };
}


