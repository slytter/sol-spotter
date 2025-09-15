// MetalShadowCalculator.swift
// Native iOS module for GPU-accelerated shadow calculations using Metal

import Foundation
import Metal
import MetalPerformanceShaders
import React

@objc(MetalShadowCalculator)
class MetalShadowCalculator: NSObject {
  
  private var device: MTLDevice!
  private var commandQueue: MTLCommandQueue!
  private var computePipeline: MTLComputePipelineState!
  private var library: MTLLibrary!
  
  override init() {
    super.init()
    setupMetal()
  }
  
  private func setupMetal() {
    guard let device = MTLCreateSystemDefaultDevice() else {
      print("Metal is not supported on this device")
      return
    }
    
    self.device = device
    self.commandQueue = device.makeCommandQueue()
    
    // Create compute shader library
    let shaderSource = """
    #include <metal_stdlib>
    using namespace metal;
    
    struct Point {
        float2 coordinates; // lng, lat
    };
    
    struct Building {
        float height;
        int vertexCount;
        float2 vertices[50]; // Max 50 vertices per building
    };
    
    struct SunData {
        float altitude;
        float bearing;
    };
    
    kernel void shadowKernel(
        device const Point* points [[buffer(0)]],
        device const Building* buildings [[buffer(1)]],
        device const SunData& sunData [[buffer(2)]],
        device int& pointCount [[buffer(3)]],
        device int& buildingCount [[buffer(4)]],
        device int* results [[buffer(5)]],
        uint2 gid [[thread_position_in_grid]]
    ) {
        if (gid.x >= pointCount) return;
        
        Point point = points[gid.x];
        
        // Skip if sun is below horizon
        if (sunData.altitude <= 0.0) {
            results[gid.x] = 1; // Shaded
            return;
        }
        
        // Cast ray toward sun
        float rayLength = 500.0; // Max ray length in meters
        float2 rayEnd = point.coordinates + float2(
            rayLength * fast::sin(sunData.bearing) / 111320.0,
            rayLength * fast::cos(sunData.bearing) / 111132.0
        );
        
        // Check intersections with buildings
        bool shaded = false;
        float nearestDist = 1000.0;
        
        for (int b = 0; b < buildingCount; b++) {
            Building building = buildings[b];
            
            // Skip if point is inside building (simplified check)
            if (isPointInsideBuilding(point.coordinates, building)) {
                continue;
            }
            
            // Simplified line-polygon intersection
            float dist = calculateIntersectionDistance(point.coordinates, rayEnd, building);
            
            if (dist < nearestDist) {
                float requiredHeight = dist * fast::tan(sunData.altitude);
                if (building.height >= requiredHeight) {
                    shaded = true;
                    break;
                }
            }
        }
        
        results[gid.x] = shaded ? 1 : 0;
    }
    
    bool isPointInsideBuilding(float2 point, Building building) {
        // Simplified point-in-polygon check
        bool inside = false;
        for (int i = 0, j = building.vertexCount - 1; i < building.vertexCount; j = i++) {
            float2 vi = building.vertices[i];
            float2 vj = building.vertices[j];
            
            if (((vi.y > point.y) != (vj.y > point.y)) && 
                (point.x < (vj.x - vi.x) * (point.y - vi.y) / (vj.y - vi.y) + vi.x)) {
                inside = !inside;
            }
        }
        return inside;
    }
    
    float calculateIntersectionDistance(float2 start, float2 end, Building building) {
        // Simplified intersection calculation
        // In a real implementation, this would be more complex
        float minDist = 1000.0;
        
        for (int i = 0; i < building.vertexCount; i++) {
            float2 v1 = building.vertices[i];
            float2 v2 = building.vertices[(i + 1) % building.vertexCount];
            
            // Line-line intersection calculation
            float dist = lineIntersectionDistance(start, end, v1, v2);
            if (dist < minDist) {
                minDist = dist;
            }
        }
        
        return minDist;
    }
    
    float lineIntersectionDistance(float2 p1, float2 p2, float2 p3, float2 p4) {
        // Line intersection distance calculation
        float denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
        if (fast::abs(denom) < 0.0001) return 1000.0; // Parallel lines
        
        float t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
        float u = -((p1.x - p2.x) * (p1.y - p3.y) - (p1.y - p2.y) * (p1.x - p3.x)) / denom;
        
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            float2 intersection = float2(
                p1.x + t * (p2.x - p1.x),
                p1.y + t * (p2.y - p1.y)
            );
            float2 diff = p1 - intersection;
            return fast::sqrt(diff.x * diff.x + diff.y * diff.y) * 111320.0; // Convert to meters
        }
        
        return 1000.0;
    }
    """
    
    do {
      self.library = try device.makeLibrary(source: shaderSource, options: nil)
      let function = library.makeFunction(name: "shadowKernel")!
      self.computePipeline = try device.makeComputePipelineState(function: function)
    } catch {
      print("Failed to create Metal compute pipeline: \(error)")
    }
  }
  
  @objc
  func calculateShadows(
    _ points: [[String: Any]],
    buildings: [[String: Any]],
    sunAltitude: NSNumber,
    sunBearing: NSNumber,
    resolver: @escaping RCTPromiseResolveBlock,
    rejecter: @escaping RCTPromiseRejectBlock
  ) {
    
    guard let device = self.device else {
      rejecter("METAL_ERROR", "Metal not supported", nil)
      return
    }
    
    let startTime = CFAbsoluteTimeGetCurrent()
    
    do {
      // Prepare data
      let pointCount = points.count
      let buildingCount = buildings.count
      
      // Create buffers
      let pointBuffer = device.makeBuffer(length: MemoryLayout<Point>.size * pointCount, options: [])
      let buildingBuffer = device.makeBuffer(length: MemoryLayout<Building>.size * buildingCount, options: [])
      let sunDataBuffer = device.makeBuffer(length: MemoryLayout<SunData>.size, options: [])
      let pointCountBuffer = device.makeBuffer(length: MemoryLayout<Int>.size, options: [])
      let buildingCountBuffer = device.makeBuffer(length: MemoryLayout<Int>.size, options: [])
      let resultBuffer = device.makeBuffer(length: MemoryLayout<Int>.size * pointCount, options: [])
      
      // Fill buffers with data
      let pointData = pointBuffer!.contents().bindMemory(to: Point.self, capacity: pointCount)
      let buildingData = buildingBuffer!.contents().bindMemory(to: Building.self, capacity: buildingCount)
      let sunData = sunDataBuffer!.contents().bindMemory(to: SunData.self, capacity: 1)
      let pointCountData = pointCountBuffer!.contents().bindMemory(to: Int.self, capacity: 1)
      let buildingCountData = buildingCountBuffer!.contents().bindMemory(to: Int.self, capacity: 1)
      
      // Convert points
      for (index, point) in points.enumerated() {
        if let lng = point["lng"] as? Double, let lat = point["lat"] as? Double {
          pointData[index] = Point(coordinates: float2(Float(lng), Float(lat)))
        }
      }
      
      // Convert buildings
      for (index, building) in buildings.enumerated() {
        if let height = building["height"] as? Double,
           let vertices = building["vertices"] as? [[Double]] {
          var buildingStruct = Building()
          buildingStruct.height = Float(height)
          buildingStruct.vertexCount = min(vertices.count, 50)
          
          for (i, vertex) in vertices.enumerated() {
            if i < 50 && vertex.count >= 2 {
              buildingStruct.vertices[i] = float2(Float(vertex[0]), Float(vertex[1]))
            }
          }
          
          buildingData[index] = buildingStruct
        }
      }
      
      // Set sun data
      sunData[0] = SunData(
        altitude: Float(sunAltitude.doubleValue),
        bearing: Float(sunBearing.doubleValue)
      )
      
      pointCountData[0] = pointCount
      buildingCountData[0] = buildingCount
      
      // Create command buffer and encoder
      guard let commandBuffer = commandQueue.makeCommandBuffer(),
            let computeEncoder = commandBuffer.makeComputeCommandEncoder() else {
        rejecter("METAL_ERROR", "Failed to create command buffer", nil)
        return
      }
      
      computeEncoder.setComputePipelineState(computePipeline)
      computeEncoder.setBuffer(pointBuffer, offset: 0, index: 0)
      computeEncoder.setBuffer(buildingBuffer, offset: 0, index: 1)
      computeEncoder.setBuffer(sunDataBuffer, offset: 0, index: 2)
      computeEncoder.setBuffer(pointCountBuffer, offset: 0, index: 3)
      computeEncoder.setBuffer(buildingCountBuffer, offset: 0, index: 4)
      computeEncoder.setBuffer(resultBuffer, offset: 0, index: 5)
      
      // Calculate thread group size
      let threadGroupSize = MTLSize(width: 64, height: 1, depth: 1)
      let threadGroups = MTLSize(
        width: (pointCount + threadGroupSize.width - 1) / threadGroupSize.width,
        height: 1,
        depth: 1
      )
      
      computeEncoder.dispatchThreadgroups(threadGroups, threadsPerThreadgroup: threadGroupSize)
      computeEncoder.endEncoding()
      
      // Execute
      commandBuffer.commit()
      commandBuffer.waitUntilCompleted()
      
      // Read results
      let resultData = resultBuffer!.contents().bindMemory(to: Int.self, capacity: pointCount)
      var shadowIndices: [Int] = []
      
      for i in 0..<pointCount {
        if resultData[i] == 1 {
          shadowIndices.append(i)
        }
      }
      
      let processingTime = CFAbsoluteTimeGetCurrent() - startTime
      
      resolver([
        "shadowIndices": shadowIndices,
        "processingTime": processingTime * 1000, // Convert to milliseconds
        "pointCount": pointCount,
        "buildingCount": buildingCount
      ])
      
    } catch {
      rejecter("METAL_ERROR", "Metal computation failed: \(error)", error)
    }
  }
  
  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
