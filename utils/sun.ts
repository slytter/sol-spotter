import SunCalc from 'suncalc';

export type SunInfo = {
  altitude: number; // radians
  azimuth: number; // radians
  bearingFromNorth: number; // degrees (0=north)
  shadowBearing: number; // degrees (direction shadow extends)
};

export function computeSun(date: Date, lat: number, lon: number): SunInfo {
  const pos = SunCalc.getPosition(date, lat, lon);
  // SunCalc azimuth is from south (0° = south, 90° = west, 180° = north, 270° = east)
  const azimuthFromSouth = (pos.azimuth * 180) / Math.PI; // convert to degrees
  // Convert to bearing from north (standard compass bearing)
  const bearingFromNorth = (azimuthFromSouth + 180) % 360;
  // Shadows point in the opposite direction of the sun
  const shadowBearing = (bearingFromNorth + 180) % 360;
  return { altitude: pos.altitude, azimuth: pos.azimuth, bearingFromNorth, shadowBearing };
}


