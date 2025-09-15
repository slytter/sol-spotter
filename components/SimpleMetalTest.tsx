import React, { useEffect, useState } from 'react';
import { Alert, NativeModules, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SimpleMetalTest() {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    // Check if the native module is available
    console.log('Available modules:', Object.keys(NativeModules));
    console.log('MetalShadowCalculator:', NativeModules.MetalShadowCalculator);
    
    if (NativeModules.MetalShadowCalculator) {
      setIsAvailable(true);
      setTestResult('✅ Metal module is available!');
    } else {
      setIsAvailable(false);
      setTestResult('❌ Metal module not found');
    }
  }, []);

  const runSimpleTest = async () => {
    try {
      if (!NativeModules.MetalShadowCalculator) {
        Alert.alert('Error', 'Metal module not available');
        return;
      }

      // Simple test data
      const testPoints = [
        { lng: -122.4194, lat: 37.7749 },
        { lng: -122.4195, lat: 37.7750 }
      ];

      const testBuildings = [
        {
          height: 50,
          vertices: [
            [-122.4192, 37.7748],
            [-122.4192, 37.7752],
            [-122.4198, 37.7752],
            [-122.4198, 37.7748]
          ]
        }
      ];

      console.log('Running Metal test...');
      const result = await NativeModules.MetalShadowCalculator.calculateShadows(
        testPoints,
        testBuildings,
        0.5, // sun altitude
        1.57  // sun bearing
      );

      console.log('Test result:', result);
      setTestResult(`✅ Test completed! Processed ${result.pointCount} points in ${result.processingTime.toFixed(2)}ms`);
      
    } catch (error) {
      console.error('Metal test failed:', error);
      setTestResult(`❌ Test failed: ${error}`);
      Alert.alert('Metal Test Failed', `Error: ${error}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Simple Metal Test</Text>
      <Text style={[styles.status, { color: isAvailable ? 'green' : 'red' }]}>
        Status: {isAvailable ? 'Available' : 'Not Available'}
      </Text>
      <Text style={styles.result}>{testResult}</Text>
      
      <TouchableOpacity style={styles.button} onPress={runSimpleTest}>
        <Text style={styles.buttonText}>Run Test</Text>
      </TouchableOpacity>
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
  },
  status: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  result: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
