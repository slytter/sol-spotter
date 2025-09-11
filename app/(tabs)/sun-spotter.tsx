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
  const [shadowPoints, setShadowPoints] = useState<LngLat[]>([]);
  const [loading, setLoading] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState(12); // 0-23 hours
  const [dayOfYear, setDayOfYear] = useState(180); // 1-365 days
  const [useElevationModel, setUseElevationModel] = useState(true); // Toggle for height models
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

  const isPointInsideAnyBuilding = (point: LngLat, buildings: BuildingFeature[]): boolean => {
    for (const building of buildings) {
      if (isPointInsidePolygon(point, building.outer)) {
        return true;
      }
    }
    return false;
  };

  const isPointInsidePolygon = (point: LngLat, polygon: [number, number][]): boolean => {
    // Ray casting algorithm to check if point is inside polygon
    const x = point.lng;
    const y = point.lat;
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  };

  const calculateShadows = useCallback(async () => {
    if (!location) return;

    setLoading(true);

    try {
      // Convert day of year to month/day
      const year = new Date().getFullYear();
      // Correctly calculate date from day of year
      const testDate = new Date(year, 0, 1, timeOfDay, 0, 0); // Start with Jan 1
      testDate.setDate(dayOfYear); // Add dayOfYear days
      
      // Fetch buildings (always fetch to respect toggle changes)
      const fetchedBuildings = await fetchBuildingsAround(
        { lng: location.longitude, lat: location.latitude }, 
        radiusMeters + 50,
        useElevationModel
      );

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
          const shadeResult = isPointShaded(point, fetchedBuildings, testDate, 200);
          if (shadeResult.shaded) {
            shadowPoints.push(point);
          }
        }
      }
      
      setShadowPoints(shadowPoints);
    } catch (error) {
      Alert.alert('Error', 'Failed to calculate shadows');
      console.error('Shadow calculation error:', error);
    } finally {
      setLoading(false);
    }
  }, [location, timeOfDay, dayOfYear, useElevationModel, radiusMeters]);

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
    const testDate = new Date(year, 0, 1, timeOfDay, 0, 0);
    testDate.setDate(dayOfYear);
    
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

  const getSun3DVisualization = () => {
    if (!location) return null;
    
    const year = new Date().getFullYear();
    const testDate = new Date(year, 0, 1, timeOfDay, 0, 0);
    testDate.setDate(dayOfYear);
    
    const sunInfo = computeSun(testDate, location.latitude, location.longitude);
    
    // Create enhanced 3D visualization
    const baseDistance = 0.05; // 50m base distance for visualization
    
    // Calculate sun's apparent position accounting for altitude
    // The sun appears closer to the horizon when altitude is low
    const altitudeFactor = Math.sin(sunInfo.altitude); // 0 = horizon, 1 = overhead
    const sunDistance = baseDistance / Math.max(0.1, altitudeFactor); // Closer when low altitude
    
    // Sun direction (where sun appears to be)
    const sunLat = location.latitude + (sunDistance / 111.32) * Math.cos(sunInfo.bearingFromNorth * Math.PI / 180);
    const sunLng = location.longitude + (sunDistance / (111.32 * Math.cos(location.latitude * Math.PI / 180))) * Math.sin(sunInfo.bearingFromNorth * Math.PI / 180);
    
    // Shadow direction (opposite to sun)
    const shadowBearing = (sunInfo.bearingFromNorth + 180) % 360;
    const shadowLat = location.latitude + (baseDistance / 111.32) * Math.cos(shadowBearing * Math.PI / 180);
    const shadowLng = location.longitude + (baseDistance / (111.32 * Math.cos(location.latitude * Math.PI / 180))) * Math.sin(shadowBearing * Math.PI / 180);
    
    // Calculate shadow length for different building heights
    const buildingHeights = [5, 10, 20]; // meters
    const shadowTips = buildingHeights.map(height => {
      const shadowLength = height / Math.tan(sunInfo.altitude);
      const shadowLengthKm = shadowLength / 1000;
      return {
        height,
        length: shadowLength,
        latitude: location.latitude + (shadowLengthKm / 111.32) * Math.cos(shadowBearing * Math.PI / 180),
        longitude: location.longitude + (shadowLengthKm / (111.32 * Math.cos(location.latitude * Math.PI / 180))) * Math.sin(shadowBearing * Math.PI / 180)
      };
    });
    
    return {
      sun: {
        latitude: sunLat,
        longitude: sunLng,
        altitude: sunInfo.altitude,
        bearing: sunInfo.bearingFromNorth,
        distance: sunDistance,
        altitudeFactor
      },
      shadow: {
        direction: {
          latitude: shadowLat,
          longitude: shadowLng
        },
        tips: shadowTips,
        bearing: shadowBearing
      }
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
        {getSun3DVisualization() && location && (
          <>
            {/* Sun Direction Marker (positioned based on altitude) */}
            <Marker
              coordinate={{
                latitude: getSun3DVisualization()!.sun.latitude,
                longitude: getSun3DVisualization()!.sun.longitude
              }}
              title="Sun Position (3D Projected)"
              description={`Alt: ${(getSun3DVisualization()!.sun.altitude * 180 / Math.PI).toFixed(1)}° | Dist: ${(getSun3DVisualization()!.sun.distance * 1000).toFixed(0)}m | Factor: ${getSun3DVisualization()!.sun.altitudeFactor.toFixed(2)}`}
              pinColor="yellow"
            />
            
            {/* Shadow Direction Line */}
            <Polyline
              coordinates={[
                { latitude: location.latitude, longitude: location.longitude },
                { latitude: getSun3DVisualization()!.shadow.direction.latitude, longitude: getSun3DVisualization()!.shadow.direction.longitude }
              ]}
              strokeColor="#FF6B6B"
              strokeWidth={3}
            />
            
            {/* Multiple Shadow Length Visualizations */}
            {getSun3DVisualization()!.shadow.tips.map((tip, index) => {
              const colors = ['#8B0000', '#A52A2A', '#DC143C'];
              const strokeWidths = [2, 3, 4];
              return (
                <React.Fragment key={tip.height}>
                  <Polyline
                    coordinates={[
                      { latitude: location.latitude, longitude: location.longitude },
                      { latitude: tip.latitude, longitude: tip.longitude }
                    ]}
                    strokeColor={colors[index]}
                    strokeWidth={strokeWidths[index]}
                  />
                  <Marker
                    coordinate={{
                      latitude: tip.latitude,
                      longitude: tip.longitude
                    }}
                    title={`${tip.height}m Building Shadow`}
                    description={`Length: ${tip.length.toFixed(1)}m`}
                    pinColor="red"
                  />
                </React.Fragment>
              );
            })}
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

          <View style={styles.controlRow}>
            <ThemedText style={styles.controlLabel}>
              Height Model: {useElevationModel ? 'Building Heights' : 'Simple'}
            </ThemedText>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: useElevationModel ? '#007AFF' : '#CCCCCC' }]} 
              onPress={() => setUseElevationModel(!useElevationModel)}
            >
              <ThemedText style={styles.buttonText}>
                {useElevationModel ? 'ON' : 'OFF'}
              </ThemedText>
            </TouchableOpacity>
          </View>
          
          {/* Debug Info */}
          {getSun3DVisualization() && (
            <View style={styles.debugInfo}>
              <ThemedText style={styles.debugText}>
                Sun Altitude: {(getSun3DVisualization()!.sun.altitude * 180 / Math.PI).toFixed(1)}°
              </ThemedText>
              <ThemedText style={styles.debugText}>
                Sun Distance: {(getSun3DVisualization()!.sun.distance * 1000).toFixed(0)}m
              </ThemedText>
              <ThemedText style={styles.debugText}>
                Altitude Factor: {getSun3DVisualization()!.sun.altitudeFactor.toFixed(2)}
              </ThemedText>
              {/* {getSun3DVisualization()!.shadow.tips.map((tip, index) => (
                <ThemedText key={tip.height} style={styles.debugText}>
                  {tip.height}m Building Shadow: {tip.length.toFixed(1)}m
                </ThemedText>
              ))}
              <ThemedText style={styles.debugText}>
                Sun Bearing: {getSun3DVisualization()!.sun.bearing.toFixed(1)}°
              </ThemedText> */}
            </View>
          )}

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
  debugInfo: {
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 6,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
});
