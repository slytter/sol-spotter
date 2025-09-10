import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { fetchBuildingsAround } from '@/lib/overpass';
import type { BuildingFeature, LngLat } from '@/types';
import { isPointShaded } from '@/utils/shade';
import { computeSun } from '@/utils/sun';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polygon, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type UserLocation = {
  latitude: number;
  longitude: number;
};

export default function SunSpotterScreen() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [buildings, setBuildings] = useState<BuildingFeature[]>([]);
  const [shadowPoints, setShadowPoints] = useState<LngLat[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState(12); // 0-23 hours
  const [dayOfYear, setDayOfYear] = useState(180); // 1-365 days
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();

  const radiusMeters = 30;

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to show shadows near you.');
        return;
      }

      const locationData = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: locationData.coords.latitude,
        longitude: locationData.coords.longitude,
        
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to get current location');
      console.error('Location error:', error);
    }
  };

  const calculateShadows = useCallback(async () => {
    if (!location) return;

    setLoading(true);

    try {
      // Convert day of year to month/day
      const year = new Date().getFullYear();
      const date = new Date(year, 0, dayOfYear);
      const month = date.getMonth() + 1;
      const day = date.getDate();
      const testDate = new Date(year, month - 1, day, timeOfDay, 0, 0);
      
      // Fetch buildings once
      if (buildings.length === 0) {
        const fetchedBuildings = await fetchBuildingsAround(
          { lng: location.longitude, lat: location.latitude }, 
          radiusMeters + 50
        );
        setBuildings(fetchedBuildings);
      }

      // Calculate shadow points with 1m resolution
      const gridSize = Math.floor((radiusMeters * 2) / 1); // 1m resolution = 60x60 grid
      const stepSize = 1; // 1 meter per step
      const shadowPoints: LngLat[] = [];
      
      const latMeters = 111132;
      const lonMeters = 111320 * Math.cos((location.latitude * Math.PI) / 180);
      
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const xMeters = (i * stepSize) - radiusMeters;
          const yMeters = (j * stepSize) - radiusMeters;
          
          const point: LngLat = {
            lng: location.longitude + xMeters / lonMeters,
            lat: location.latitude + yMeters / latMeters,
          };
          
          // Check if point is in shadow
          const shadeResult = isPointShaded(point, buildings, testDate, 200);
          if (shadeResult.shaded) {
            shadowPoints.push(point);
          }
        }
      }
      
      setShadowPoints(shadowPoints);
      
      console.log('Shadow calculation:', {
        buildings: buildings.length,
        shadowPoints: shadowPoints.length,
        gridSize: `${gridSize}x${gridSize}`,
        sunInfo: {
          altitude: (computeSun(testDate, location.latitude, location.longitude).altitude * 180 / Math.PI).toFixed(1) + '°',
          bearing: computeSun(testDate, location.latitude, location.longitude).bearingFromNorth.toFixed(1) + '°'
        }
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to calculate shadows');
      console.error('Shadow calculation error:', error);
    } finally {
      setLoading(false);
    }
  }, [location, timeOfDay, dayOfYear, buildings, radiusMeters]);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  useEffect(() => {
    if (location) {
      calculateShadows();
    }
  }, [location, timeOfDay, dayOfYear, calculateShadows]);

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setLocation({ latitude, longitude });
  };

  const getSunPosition = () => {
    if (!location) return null;
    
    const year = new Date().getFullYear();
    const date = new Date(year, 0, dayOfYear);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const testDate = new Date(year, month - 1, day, timeOfDay, 0, 0);
    
    const sunInfo = computeSun(testDate, location.latitude, location.longitude);
    
    // Calculate sun position on map (extend ray outward from center)
    const sunDistanceKm = 0.5; // Show sun 500m away from center
    const sunLat = location.latitude + (sunDistanceKm / 111.32) * Math.cos(sunInfo.bearingFromNorth * Math.PI / 180);
    const sunLng = location.longitude + (sunDistanceKm / (111.32 * Math.cos(location.latitude * Math.PI / 180))) * Math.sin(sunInfo.bearingFromNorth * Math.PI / 180);
    
    return {
      latitude: sunLat,
      longitude: sunLng,
      altitude: sunInfo.altitude,
      bearing: sunInfo.bearingFromNorth
    };
  };

  const renderShadowOverlay = () => {
    if (!shadowPoints.length || !location) return null;

    const shadowPolygons: any[] = [];
    const cellSize = 1; // meters - size of each shadow cell

    // Convert shadow points to small polygons
    shadowPoints.forEach((point, index) => {
      const latMeters = 111132;
      const lonMeters = 111320 * Math.cos((location.latitude * Math.PI) / 180);
      
      const halfCell = cellSize / 2;
      const latOffset = halfCell / latMeters;
      const lngOffset = halfCell / lonMeters;
      
      const coordinates = [
        { latitude: point.lat - latOffset, longitude: point.lng - lngOffset },
        { latitude: point.lat + latOffset, longitude: point.lng - lngOffset },
        { latitude: point.lat + latOffset, longitude: point.lng + lngOffset },
        { latitude: point.lat - latOffset, longitude: point.lng + lngOffset },
      ];
      
      shadowPolygons.push(
        <Polygon
          key={`shadow-${index}`}
          coordinates={coordinates}
          fillColor="rgba(0, 0, 0, 0.3)"
          strokeColor="rgba(0, 0, 0, 0.1)"
          strokeWidth={0.5}
        />
      );
    });

    return shadowPolygons;
  };

  return (
    <ThemedView style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton
      >
        {location && (
          <Marker
            coordinate={location}
            title="Shadow Analysis Center"
            description="Tap map to move analysis center"
          />
        )}
        {getSunPosition() && location && (
          <>
            <Marker
              coordinate={{
                latitude: getSunPosition()!.latitude,
                longitude: getSunPosition()!.longitude
              }}
              title="Sun Position"
              description={`Alt: ${(getSunPosition()!.altitude * 180 / Math.PI).toFixed(1)}° | Bearing: ${getSunPosition()!.bearing.toFixed(1)}°`}
              pinColor="yellow"
            />
            <Polyline
              coordinates={[
                { latitude: location.latitude, longitude: location.longitude },
                { latitude: getSunPosition()!.latitude, longitude: getSunPosition()!.longitude }
              ]}
              strokeColor="#FFD700"
              strokeWidth={3}
            />
          </>
        )}
        {renderShadowOverlay()}
      </MapView>

      {/* Controls Overlay */}
      <View style={[styles.controlsOverlay, { bottom: insets.bottom + 80 }]}>
        <ThemedView style={styles.controlsContainer}>
          <ThemedText style={styles.controlTitle}>Time Controls</ThemedText>
          
          <View style={styles.controlRow}>
            <ThemedText style={styles.controlLabel}>
              Time: {timeOfDay.toString().padStart(2, '0')}:00
            </ThemedText>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.button} 
                onPress={() => setTimeOfDay(Math.max(0, timeOfDay - 1))}
              >
                <ThemedText style={styles.buttonText}>-</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.button} 
                onPress={() => setTimeOfDay(Math.min(23, timeOfDay + 1))}
              >
                <ThemedText style={styles.buttonText}>+</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.controlRow}>
            <ThemedText style={styles.controlLabel}>
              Day: {dayOfYear} ({new Date(new Date().getFullYear(), 0, dayOfYear).toLocaleDateString()})
            </ThemedText>
            <View style={styles.buttonRow}>
              <TouchableOpacity 
                style={styles.button} 
                onPress={() => setDayOfYear(Math.max(1, dayOfYear - 1))}
              >
                <ThemedText style={styles.buttonText}>-</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.button} 
                onPress={() => setDayOfYear(Math.min(365, dayOfYear + 1))}
              >
                <ThemedText style={styles.buttonText}>+</ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {loading && (
            <View style={styles.loadingContainer}>
              <ThemedText style={styles.loadingText}>
                Calculating shadows...
              </ThemedText>
            </View>
          )}
        </ThemedView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  controlsOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    padding: 16,
  },
  controlsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  controlTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  controlLabel: {
    fontSize: 14,
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    marginTop: 8,
  },
  loadingText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
