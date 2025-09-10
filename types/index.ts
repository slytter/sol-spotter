export type LngLat = { lng: number; lat: number };

export type BuildingFeature = {
  id: number | string;
  /** Outer ring, [lng, lat][] */
  outer: [number, number][];
  /** Height in meters (estimated if unknown) */
  height: number;
};

export type UIShadowPolygon = {
  id: string | number;
  coords: { latitude: number; longitude: number }[];
};


