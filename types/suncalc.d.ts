declare module 'suncalc' {
  export interface SunPosition {
    azimuth: number; // radians
    altitude: number; // radians
    [key: string]: number;
  }

  export function getPosition(date: Date, latitude: number, longitude: number): SunPosition;

  const SunCalc: {
    getPosition: typeof getPosition;
  };

  export default SunCalc;
}


