import SunCalc from 'suncalc';

export type SunInfo = {
  altitude: number; // radians
  azimuth: number; // radians
  bearingFromNorth: number; // degrees (0=north)
  shadowBearing: number; // degrees (direction shadow extends)
};

export function computeSun(date: Date, lat: number, lon: number): SunInfo {
  const pos = SunCalc.getPosition(date, lat, lon);
  const az = (pos.azimuth * 180) / Math.PI; // from south, cw to west
  const bearingFromNorth = (az + 180) % 360; // convert to 0=north
  const shadowBearing = (bearingFromNorth + 180) % 360;
  return { altitude: pos.altitude, azimuth: pos.azimuth, bearingFromNorth, shadowBearing };
}


