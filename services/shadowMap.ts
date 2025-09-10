import { fetchBuildingsAround } from '@/lib/overpass';
import type { BuildingFeature, LngLat } from '@/types';
import { isPointShaded } from '@/utils/shade';
import * as FileSystem from 'expo-file-system';

export type ShadowMapMeta = {
  center: LngLat;
  radiusMeters: number;
  resolutionMeters: number;
  when: string; // ISO string
};

export type ShadowMap = {
  meta: ShadowMapMeta;
  grid: number[][]; // 0= sun, 1= shade
  origin: LngLat; // bottom-left of grid
  cols: number;
  rows: number;
  cellMeters: number;
};

function makeWhen(year: number, month: number, day: number, hour: number, minute: number) {
  // month: 1-12
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  return d;
}

let currentShadowMapPath: string | null = null;

export async function batchShadowMap(lng: number, lat: number, diameterMeters: number, minute: number, hour: number, day: number, month: number, options?: { resolutionMeters?: number; year?: number }): Promise<string> {
  const resolutionMeters = options?.resolutionMeters ?? 20; // grid cell size
  const year = options?.year ?? new Date().getFullYear();
  const center: LngLat = { lng, lat };
  const when = makeWhen(year, month, day, hour, minute);
  const radius = diameterMeters / 2;

  // Fetch buildings within radius
  const buildings: BuildingFeature[] = await fetchBuildingsAround({ lng, lat }, radius + 50);

  // Define grid bounds (square covering circle)
  const cols = Math.ceil(diameterMeters / resolutionMeters);
  const rows = cols;
  const half = (cols * resolutionMeters) / 2;

  // Approximate meters per degree at center latitude
  const latMeters = 111132;
  const lonMeters = 111320 * Math.cos((lat * Math.PI) / 180);

  const origin: LngLat = { lng: lng - half / lonMeters, lat: lat - half / latMeters };

  // Build grid
  const grid: number[][] = [];
  const total = rows * cols;
  let done = 0;
  let lastPct = -1;
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    const yMeters = r * resolutionMeters + resolutionMeters / 2;
    for (let c = 0; c < cols; c++) {
      const xMeters = c * resolutionMeters + resolutionMeters / 2;
      const sample: LngLat = {
        lng: origin.lng + xMeters / lonMeters,
        lat: origin.lat + yMeters / latMeters,
      };
      // inside circle? else mark null-ish as sun
      const dx = (sample.lng - lng) * lonMeters;
      const dy = (sample.lat - lat) * latMeters;
      const inside = Math.sqrt(dx * dx + dy * dy) <= radius;
      if (!inside) { row.push(0); continue; }
      const shade = isPointShaded(sample, buildings, when, 1000);
      row.push(shade.shaded ? 1 : 0);
      done++;
      const pct = Math.floor((done / total) * 100);
      if (pct !== lastPct && pct % 5 === 0) {
        // Log every 5%
        console.log(`[Shadow] Batch progress: ${pct}% (${done}/${total})`);
        lastPct = pct;
      }
    }
    grid.push(row);
  }

  const map: ShadowMap = {
    meta: { center, radiusMeters: radius, resolutionMeters, when: when.toISOString() },
    grid,
    origin,
    cols,
    rows,
    cellMeters: resolutionMeters,
  };

  const filename = `shadow_${lat.toFixed(5)}_${lng.toFixed(5)}_${month}-${day}_${hour}-${minute}.json`;
  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, JSON.stringify(map));
  currentShadowMapPath = path;
  return path;
}

export async function isLocationSunnyFromFile(fileUri: string, lng: number, lat: number): Promise<boolean> {
  const content = await FileSystem.readAsStringAsync(fileUri);
  const map = JSON.parse(content) as ShadowMap;
  const { origin, cellMeters, cols, rows } = map;
  const latMeters = 111132;
  const lonMeters = 111320 * Math.cos((lat * Math.PI) / 180);
  const xMeters = (lng - origin.lng) * lonMeters;
  const yMeters = (lat - origin.lat) * latMeters;
  const c = Math.floor(xMeters / cellMeters);
  const r = Math.floor(yMeters / cellMeters);
  if (c < 0 || r < 0 || c >= cols || r >= rows) return true; // outside grid -> treat as sun
  return map.grid[r][c] === 0;
}

export async function isLocationSunny(lng: number, lat: number): Promise<boolean> {
  if (!currentShadowMapPath) throw new Error('No shadow map loaded. Run batchShadowMap first.');
  return isLocationSunnyFromFile(currentShadowMapPath, lng, lat);
}


