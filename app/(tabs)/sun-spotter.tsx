import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useBottomTabOverflow } from '@/components/ui/TabBarBackground';
import { useColorScheme } from '@/hooks/useColorScheme';
// import { point } from '@turf/helpers';
// import rhumbDestinationFn from '@turf/rhumb-destination';
import dayjs from 'dayjs';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Circle, LatLng, MapPressEvent, Marker, Region } from 'react-native-maps';
// import SunCalc from 'suncalc';
import { batchShadowMap, isLocationSunnyFromFile } from '@/services/shadowMap';

type UserLocation = {
  latitude: number;
  longitude: number;
};

export default function SunSpotterScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<LatLng | null>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const tabBarOverflow = useBottomTabOverflow();
  const scheme = useColorScheme();
  
  const [, setBatchPath] = useState<string | null>(null);
  const [samples, setSamples] = useState<{ latitude: number; longitude: number; sunny: boolean }[]>([]);
  const [batching, setBatching] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // Remove old building polygon pipeline. Batch is run on demand.
  const isDark = scheme === 'dark';
  const timeBg = isDark ? 'rgba(28,28,30,0.92)' : 'rgba(255,255,255,0.9)';
  const batchBg = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)';
  const batchText = isDark ? '#000' : '#fff';

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!isMounted) return;
      setHasPermission(status === 'granted');
      if (status !== 'granted') return;

      const current = await Location.getCurrentPositionAsync({});
      if (!isMounted) return;
      const coords = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setUserLocation(coords);
      // Default selection to user location so a shadow is visible immediately.
      setSelectedPoint(coords);
      setInitialRegion({
        latitude: coords.latitude,
        longitude: coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleMapPress = (e: MapPressEvent) => {
    setSelectedPoint(e.nativeEvent.coordinate);
  };

  // Use platform default map provider to avoid API key requirements.
  const mapProvider = undefined;

  // old spot-based shadow kept for reference, replaced by building-based shadows

  if (hasPermission === null || (hasPermission && !initialRegion)) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
        <ThemedText>Loading map…</ThemedText>
      </ThemedView>
    );
  }

  if (hasPermission === false) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText>Location permission denied. You can still explore the map.</ThemedText>
        <View style={{ height: 12 }} />
        <View style={styles.fallbackMapContainer}>
          <MapView style={StyleSheet.absoluteFill} onPress={handleMapPress} />
        </View>
      </ThemedView>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        provider={mapProvider as any}
        style={StyleSheet.absoluteFill}
        showsUserLocation
        showsMyLocationButton
        initialRegion={initialRegion ?? undefined}
        onPress={handleMapPress}
      >
        {userLocation && (
          <Marker coordinate={userLocation} title="You" />
        )}
        {selectedPoint && (
          <Marker coordinate={selectedPoint} title="Selected" />
        )}
        {samples.map((s, i) => (
          <Circle
            key={`s-${i}`}
            center={{ latitude: s.latitude, longitude: s.longitude }}
            radius={20}
            strokeColor={s.sunny ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.9)'}
            fillColor={s.sunny ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.9)'}
            strokeWidth={1}
          />
        ))}
      </MapView>

      {/* Batch button (bottom-right) */}
      <View style={[styles.batchContainer, { bottom: 120 + (tabBarOverflow || 0) }]} pointerEvents="box-none">
        <Pressable
          style={[styles.batchBtn, { backgroundColor: batchBg }, batching && { opacity: 0.7 }]}
          hitSlop={8}
          onPress={async () => {
            if (!userLocation) return;
            try {
              console.log('[Shadow] Batch start');
              setBatchError(null);
              setBatching(true);
              const path = await batchShadowMap(
                userLocation.longitude,
                userLocation.latitude,
                5,
                0,
                15,
                3,
                8
              );
              console.log('[Shadow] Batch done at', path);
              setBatchPath(path);
              // sample grid of dots
              const dots: { latitude: number; longitude: number; sunny: boolean }[] = [];
              const latMeters = 111132;
              const lonMeters = 111320 * Math.cos((userLocation.latitude * Math.PI) / 180);
              for (let y = -1000; y <= 1000; y += 5) {
                for (let x = -1000; x <= 1000; x += 5) {
                  const lat = userLocation.latitude + y / latMeters;
                  const lng = userLocation.longitude + x / lonMeters;
                  const sunny = await isLocationSunnyFromFile(path, lng, lat);
                  dots.push({ latitude: lat, longitude: lng, sunny });
                }
              }
              console.log('[Shadow] Dots ready:', dots.length);
              setSamples(dots);
            } catch (e: any) {
              console.warn('[Shadow] Batch error', e);
              setBatchError(String(e?.message ?? e));
            } finally {
              setBatching(false);
            }
          }}
        >
          <ThemedText style={{ color: batchText, fontWeight: '600' }}>{batching ? 'Batching…' : 'Batch 2km @ 12:00 Aug 3'}</ThemedText>
        </Pressable>
        {batchError && (
          <ThemedText style={styles.batchError}>{batchError}</ThemedText>
        )}
      </View>

      {/* Time control overlay with slider */}
      <TimeSlider
        bottom={12 + (tabBarOverflow || 0)}
        value={now}
        onChange={setNow}
        backgroundColor={timeBg}
      />

      
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fallbackMapContainer: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
  },
  timeControlContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
  },
  timeControl: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  timeText: {
    textAlign: 'center',
    marginBottom: 8,
  },
  sliderTrack: {
    height: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  sliderThumb: {
    position: 'absolute',
    top: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  sliderRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btnSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.06)'
  },
  hintText: {
    marginLeft: 8,
    opacity: 0.7,
  },
  batchContainer: {
    position: 'absolute',
    right: 16,
    zIndex: 50,
  },
  batchBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  batchError: {
    marginTop: 8,
    color: '#f55'
  },
});

type TimeSliderProps = {
  bottom: number;
  value: Date;
  onChange: (d: Date) => void;
  backgroundColor: string;
};

function TimeSlider({ bottom, value, onChange, backgroundColor }: TimeSliderProps) {
  const windowWidth = Dimensions.get('window').width;
  const fallbackWidth = Math.max(220, Math.min(560, windowWidth - 48));
  const [width, setWidth] = React.useState(fallbackWidth);
  const startOfDay = dayjs(value).startOf('day');
  const endOfDay = dayjs(value).endOf('day');
  const totalMs = endOfDay.valueOf() - startOfDay.valueOf();
  const progress = Math.max(0, Math.min(1, (value.getTime() - startOfDay.valueOf()) / totalMs));

  const pan = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        const p = Math.max(0, Math.min(1, x / (width || 1)));
        onChange(new Date(startOfDay.valueOf() + p * totalMs));
      },
      onPanResponderMove: (e) => {
        const w = width || fallbackWidth;
        const localX = e.nativeEvent.locationX;
        const x = Math.max(0, Math.min(w, localX));
        const p = Math.max(0, Math.min(1, x / w));
        onChange(new Date(startOfDay.valueOf() + p * totalMs));
      },
    })
  ).current;

  const thumbLeft = Math.round(progress * Math.max(0, width - 20));

  return (
    <View style={[styles.timeControlContainer, { bottom }]} pointerEvents="box-none">
      <View style={[styles.timeControl, { backgroundColor }]}>
        <ThemedText style={styles.timeText}>{dayjs(value).format('MMM D • HH:mm')}</ThemedText>
        <View
          style={[styles.sliderTrack, { backgroundColor: 'rgba(0,0,0,0.1)', width }]}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width || fallbackWidth)}
          {...pan.panHandlers}
        >
          <View style={[styles.sliderThumb, { left: thumbLeft, backgroundColor: 'white' }]} />
        </View>
        <View style={styles.sliderRow}>
          <Pressable style={styles.btnSmall} onPress={() => onChange(new Date())}><ThemedText>Now</ThemedText></Pressable>
          <ThemedText style={styles.hintText}>Drag to change time</ThemedText>
        </View>
      </View>
    </View>
  );
}



