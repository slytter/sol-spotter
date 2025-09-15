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