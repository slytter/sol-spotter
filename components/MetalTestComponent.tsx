import React, { useEffect, useState } from 'react';
import { Alert, NativeModules, StyleSheet, Text, View } from 'react-native';
import MetalShadowCalculator, { Building, Point } from '../types/metal-shadows';

export default function MetalTestComponent() {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    // Check if the native module is available
    const checkModule = () => {
      console.log('Available modules:', Object.keys(NativeModules));
      console.log('MetalShadowCalculator:', NativeModules.MetalShadowCalculator);
      
      if (NativeModules.MetalShadowCalculator) {
        setIsAvailable(true);
        setTestResult('Metal module is available!');
        runTest();
      } else {
        setIsAvailable(false);
        setTestResult('Metal module not found. Make sure you\'re running a custom build.');
      }
    };

    checkModule();
  }, []);

  const runTest = async () => {
    try {
      // Test data
      const testPoints: Point[] = [
        { lng: -122.4194, lat: 37.7749 }, // San Francisco
        { lng: -122.4195, lat: 37.7750 },
        { lng: -122.4196, lat: 37.7751 },
      ];

      const testBuildings: Building[] = [
        {
          height: 50, // 50 meters tall
          vertices: [
            [-122.4192, 37.7748],
            [-122.4192, 37.7752],
            [-122.4198, 37.7752],
            [-122.4198, 37.7748],
          ]
        }
      ];

      const sunAltitude = 0.5; // radians (about 28.6 degrees)
      const sunBearing = 1.57; // radians (about 90 degrees, east)

      console.log('Running Metal shadow calculation test...');
      const result = await MetalShadowCalculator.calculateShadows(
        testPoints,
        testBuildings,
        sunAltitude,
        sunBearing
      );

      console.log('Test result:', result);
      setTestResult(`Test completed! Processed ${result.pointCount} points and ${result.buildingCount} buildings in ${result.processingTime.toFixed(2)}ms. Found ${result.shadowIndices.length} shaded points.`);
      
    } catch (error) {
      console.error('Metal test failed:', error);
      setTestResult(`Test failed: ${error}`);
      Alert.alert('Metal Test Failed', `Error: ${error}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Metal Shadow Calculator Test</Text>
      <Text style={[styles.status, { color: isAvailable ? 'green' : 'red' }]}>
        Status: {isAvailable ? 'Available' : 'Not Available'}
      </Text>
      <Text style={styles.result}>{testResult}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  status: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  result: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
});
