// TypeScript interface for MetalShadowCalculator native module

// Import from React Native
import { NativeModules } from 'react-native';

export interface Point {
  lng: number;
  lat: number;
}

export interface Building {
  height: number;
  vertices: number[][]; // Array of [lng, lat] coordinates
}

export interface ShadowCalculationResult {
  shadowIndices: number[];
  processingTime: number; // milliseconds
  pointCount: number;
  buildingCount: number;
}

export interface MetalShadowCalculator {
  calculateShadows(
    points: Point[],
    buildings: Building[],
    sunAltitude: number,
    sunBearing: number
  ): Promise<ShadowCalculationResult>;
}

export const MetalShadowCalculator = NativeModules.MetalShadowCalculator as MetalShadowCalculator;

export default MetalShadowCalculator;
