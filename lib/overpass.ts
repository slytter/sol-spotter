import type { BuildingFeature, LngLat } from '@/types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const ELEVATION_API_URL = 'https://api.opentopodata.org/v1/srtm30m';

// Add your OpenTopoData API key here (get free at https://opentopodata.org/)
const OPENTOPODATA_API_KEY = 'YOUR_API_KEY_HERE';

// Rate limiting for elevation API
let lastElevationRequest = 0;
const ELEVATION_REQUEST_DELAY = 100; // Reduced delay with API key

async function getElevation(lat: number, lng: number): Promise<number> {
  try {
    // Rate limiting to avoid 429 errors
    const now = Date.now();
    const timeSinceLastRequest = now - lastElevationRequest;
    if (timeSinceLastRequest < ELEVATION_REQUEST_DELAY) {
      await new Promise(resolve => setTimeout(resolve, ELEVATION_REQUEST_DELAY - timeSinceLastRequest));
    }
    lastElevationRequest = Date.now();
    
    const url = OPENTOPODATA_API_KEY !== 'YOUR_API_KEY_HERE' 
      ? `${ELEVATION_API_URL}?locations=${lat},${lng}&key=${OPENTOPODATA_API_KEY}`
      : `${ELEVATION_API_URL}?locations=${lat},${lng}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Elevation API error: ${response.status}`);
    
    const data = await response.json();
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      return data.results[0].elevation;
    }
    throw new Error('No elevation data found');
  } catch (error) {
    console.warn('Failed to get elevation data:', error);
    return 0; // Fallback to sea level
  }
}

async function getExactBuildingHeight(building: any, groundElevation: number): Promise<number> {
  try {
    // First try to get actual height from OSM tags
    const osmHeight = parseHeightMeters(building.tags || {});
    if (osmHeight !== null) {
      console.log(`Building ${building.id}: Using OSM height ${osmHeight}m`);
      return osmHeight;
    }
    
    // If no OSM height, use building characteristics for realistic estimation
    const coords = building.geometry;
    if (!coords || coords.length < 3) return 4;
    
    const buildingType = building.tags?.['building'] || 'residential';
    const buildingArea = calculatePolygonArea(coords);
    
    // More sophisticated height estimation based on building type and characteristics
    let estimatedHeight = 4; // Base height
    
    switch (buildingType) {
      case 'commercial':
      case 'office':
      case 'retail':
        // Commercial buildings: typically 2-4 stories
        estimatedHeight = Math.min(15, 6 + (buildingArea / 150));
        break;
      case 'industrial':
      case 'warehouse':
        // Industrial: often single story but tall
        estimatedHeight = Math.min(12, 5 + (buildingArea / 200));
        break;
      case 'residential':
      case 'house':
      case 'detached':
        // Houses: typically 1-2 stories
        estimatedHeight = Math.min(7, 3 + (buildingArea / 300));
        break;
      case 'apartments':
        // Apartments: 2-5 stories
        estimatedHeight = Math.min(18, 8 + (buildingArea / 120));
        break;
      case 'yes':
        // Generic building - estimate based on area and context
        if (buildingArea > 2000) {
          estimatedHeight = 12; // Large building
        } else if (buildingArea > 1000) {
          estimatedHeight = 8; // Medium-large building
        } else if (buildingArea > 500) {
          estimatedHeight = 6; // Medium building
        } else {
          estimatedHeight = 4; // Small building
        }
        break;
    }
    
    console.log(`Building ${building.id}: Estimated height ${estimatedHeight.toFixed(1)}m for ${buildingType} (area: ${buildingArea.toFixed(0)}m²)`);
    return Math.max(3, Math.min(50, estimatedHeight));
    
  } catch (error) {
    console.warn('Failed to get building height:', error);
    return 4; // Fallback
  }
}

function getSurroundingPoints(coords: any[], numPoints: number): { lat: number, lng: number }[] {
  // Generate sample points around the building (not inside it)
  const points: { lat: number, lng: number }[] = [];
  
  // Calculate bounding box
  let minLat = coords[0].lat, maxLat = coords[0].lat;
  let minLng = coords[0].lon, maxLng = coords[0].lon;
  
  for (const coord of coords) {
    minLat = Math.min(minLat, coord.lat);
    maxLat = Math.max(maxLat, coord.lat);
    minLng = Math.min(minLng, coord.lon);
    maxLng = Math.max(maxLng, coord.lon);
  }
  
  // Expand bounding box by 20% to get surrounding area
  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;
  const expandedMinLat = minLat - latRange * 0.2;
  const expandedMaxLat = maxLat + latRange * 0.2;
  const expandedMinLng = minLng - lngRange * 0.2;
  const expandedMaxLng = maxLng + lngRange * 0.2;
  
  // Generate random points in the expanded area
  for (let i = 0; i < numPoints; i++) {
    const lat = expandedMinLat + Math.random() * (expandedMaxLat - expandedMinLat);
    const lng = expandedMinLng + Math.random() * (expandedMaxLng - expandedMinLng);
    
    // Check if point is outside the building (simple bounding box check)
    if (lat < minLat || lat > maxLat || lng < minLng || lng > maxLng) {
      points.push({ lat, lng });
    }
  }
  
  return points;
}

function parseHeightMeters(tags: Record<string, string | undefined>): number | null {
  const raw = tags.height || tags['building:height'];
  if (raw) {
    const m = /([0-9]+\.?[0-9]*)\s*(m|meter|meters)?/i.exec(raw);
    if (m) return parseFloat(m[1]);
  }
  const levels = tags['building:levels'];
  if (levels && !isNaN(Number(levels))) return Number(levels) * 3; // rough guess
  return null; // No height data available
}

function calculatePolygonArea(coords: any[]): number {
  // Calculate area in square meters using shoelace formula
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    area += coords[i].lat * coords[i + 1].lon;
    area -= coords[i + 1].lat * coords[i].lon;
  }
  
  // Convert from square degrees to square meters
  // Approximate conversion factor for latitude (varies by location)
  const latMeters = 111132; // meters per degree latitude
  const lonMeters = 111320 * Math.cos((coords[0].lat * Math.PI) / 180); // meters per degree longitude
  
  return Math.abs(area) * latMeters * lonMeters / 2;
}

export async function fetchBuildingsAround(center: LngLat, radiusMeters = 300, useElevationModel = true): Promise<BuildingFeature[]> {
  const overpassStartTime = Date.now();
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
  const overpassEndTime = Date.now();
  // console.log(`🌐 Overpass API Query: ${overpassEndTime - overpassStartTime}ms`);
  // console.log(`Overpass returned ${elements.length} building elements`);
  
  // Get ground elevation for the area (only if using elevation model)
  let groundElevation = 0;
  if (useElevationModel) {
    const elevationStartTime = Date.now();
    groundElevation = await getElevation(lat, lng);
    const elevationEndTime = Date.now();
    // console.log(`🏔️ Ground Elevation Lookup: ${elevationEndTime - elevationStartTime}ms`);
    // console.log(`Ground elevation at ${lat}, ${lng}: ${groundElevation}m`);
  }
  
  const processingStartTime = Date.now();
  const features: BuildingFeature[] = [];
  for (const e of elements) {
    if (!e.geometry || !Array.isArray(e.geometry)) continue;
    // geometry is array of nodes (for closed way first==last). We ensure closure.
    const ring: [number, number][] = e.geometry.map((g: any) => [g.lon, g.lat]);
    if (ring.length < 3) continue;
    if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
      ring.push(ring[0]);
    }
    
    // Calculate building height based on model choice
    let height: number;
    if (useElevationModel) {
      height = await getExactBuildingHeight(e, groundElevation);
    } else {
      // Simple model: use OSM height or fallback to 4m
      const osmHeight = parseHeightMeters(e.tags || {});
      height = osmHeight !== null ? osmHeight : 4;
    }
    
    features.push({ id: e.id, outer: ring, height });
    
    // Debug: Log first few buildings to see what's happening
    if (features.length <= 3) {
      // console.log(`Building ${e.id}: height=${height}m, tags=${JSON.stringify(e.tags || {})}`);
    }
  }
  const processingEndTime = Date.now();
  console.log(`⚙️ Building Processing: ${processingEndTime - processingStartTime}ms`);
  
  return features;
}


