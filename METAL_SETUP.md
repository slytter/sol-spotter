# Instructions to set up Metal native module in Expo

## Step 1: Install Expo Development Client

```bash
npx expo install expo-dev-client
```

## Step 2: Create Native Module Files

Create the following files in your project:

### `ios/MetalShadowCalculator.h`
```objc
#import <React/RCTBridgeModule.h>

@interface MetalShadowCalculator : NSObject <RCTBridgeModule>

@end
```

### `ios/MetalShadowCalculator.m`
```objc
#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(MetalShadowCalculator, NSObject)

RCT_EXTERN_METHOD(calculateShadows:(NSArray *)points
                  buildings:(NSArray *)buildings
                  sunAltitude:(NSNumber *)sunAltitude
                  sunBearing:(NSNumber *)sunBearing
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
```

### `ios/MetalShadowCalculator.swift`
(Use the existing file you already have)

## Step 3: Configure Expo for Native Modules

Add to your `app.json`:

```json
{
  "expo": {
    "plugins": [
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/images/splash-icon.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#ffffff"
        }
      ],
      [
        "expo-build-properties",
        {
          "ios": {
            "deploymentTarget": "11.0"
          }
        }
      ]
    ]
  }
}
```

## Step 4: Install Build Properties Plugin

```bash
npx expo install expo-build-properties
```

## Step 5: Create Development Build

```bash
npx expo run:ios
```

This will:
- Create a custom development build
- Include your native Metal module
- Install it on your device/simulator

## Step 6: Test the Module

Add this test to your React Native code:

```javascript
import { NativeModules } from 'react-native';

console.log('Available modules:', Object.keys(NativeModules));
console.log('MetalShadowCalculator:', NativeModules.MetalShadowCalculator);
```

## Troubleshooting

### If you get build errors:

1. **Check iOS deployment target** is 11.0 or higher
2. **Make sure Metal is supported** on your device (not simulator)
3. **Clean build folder**:
   ```bash
   npx expo run:ios --clear
   ```

### If the module still isn't found:

1. **Check the build logs** for compilation errors
2. **Verify files are in the right location** (`ios/` folder)
3. **Make sure you're running on a physical device** (Metal doesn't work in simulator)

## Alternative: Use EAS Build

For production builds:

```bash
npx expo install @expo/cli
npx expo build:ios
```

This will create a production build with your native modules.