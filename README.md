# Sun at My Spot — Expo + React Native MVP

This app lets you:
- Tap a spot on a map
- Choose a date/time
- See whether that spot is in sun or shade, using nearby buildings from OpenStreetMap and the current sun position

It uses a fast ray-casting method to detect whether any building between you and the sun is tall enough to shade your spot.

## Stack

- React Native (Expo managed)
- `react-native-maps` for maps and polygons
- `expo-location` for geolocation
- `suncalc` for sun position
- `@turf/*` for geospatial math (translate, line intersections, distances)
- Overpass API to fetch OSM buildings

## Setup

```bash
npx create-expo-app sunseekr-rn
cd sunseekr-rn
expo install react-native-maps expo-location
npm i suncalc @turf/helpers @turf/transform-translate @turf/polygon-to-line @turf/line-intersect @turf/distance dayjs
```

Copy the files from this repo into your project, then:

```bash
npx expo start
```

### Android Google Maps API key (optional but recommended)

Add this to your `app.json`:

```json
{
  "expo": {
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_ANDROID_GOOGLE_MAPS_API_KEY"
        }
      }
    }
  }
}
```

### iOS

`react-native-maps` uses Apple Maps by default; no key needed.

## How it works

1. We fetch building footprints within ~300 m of the selected spot from OSM via Overpass (`way["building"]` with `out tags geom;`).
2. Heights are parsed from `height` tags or estimated from `building:levels * 3 m` (fallback 10 m).
3. The sun’s altitude and bearing are computed using `suncalc`.
4. We cast a ray from the spot opposite the sun bearing (the shadow direction). If the ray intersects a building at ground distance `d`, the spot is shaded by that building if `d <= height / tan(altitude)`.

This avoids generating heavy shadow polygons and works well for an MVP.

## Notes and next steps

- Overpass rate-limits: Consider caching and only re-fetching when the spot moves >100 m.
- Multipolygon buildings (relations) are not handled in this MVP. You can extend the Overpass parsing to include relations or use `osmtogeojson`.
- Clouds/weather: Add an API like Open-Meteo to adjust “sun” to “likely sun”.
- Trees/terrain: Integrate local DSM/LiDAR for greater accuracy.
- UI: Add a time slider, timeline of sunny windows, and notifications (“Sunny in 20 minutes”).

## Troubleshooting

- If the map doesn’t show on Android, ensure your Google Maps API key is set in `app.json` and rebuild your dev client if needed.
- If Overpass fails, try moving/zooming or reduce the radius.
