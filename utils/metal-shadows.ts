// MetalShadowCalculator.ts
// TypeScript interface for Metal GPU shadow calculations

import { NativeModules } from 'react-native';

export interface MetalPoint {
  lng: number;
  lat: number;
}

export interface MetalBuilding {
  height: number;
  vertices: number[][]; // [[lng, lat], [lng, lat], ...]
}

export interface MetalShadowResult {
  shadowIndices: number[];
  processingTime: number;
  pointCount: number;
  buildingCount: number;
}

const { MetalShadowCalculator } = NativeModules;

export const calculateShadowsGPU = (
  points: MetalPoint[],
  buildings: MetalBuilding[],
  sunAltitude: number,
  sunBearing: number
): Promise<MetalShadowResult> => {
  if (!MetalShadowCalculator) {
    throw new Error('MetalShadowCalculator native module not found. Please follow METAL_SETUP.md instructions.');
  }
  
  return MetalShadowCalculator.calculateShadows(
    points,
    buildings,
    sunAltitude,
    sunBearing
  );
};

export default MetalShadowCalculator;
