import Foundation
import CoreLocation
import CoreMotion
import React

class WalkingSessionManager: NSObject {
    static let shared = WalkingSessionManager()
    
    private var isTracking = false
    private var distanceMeters: Double = 0.0
    private var earnedMs: Double = 0.0
    private var lastLocation: CLLocation? = null
    private var currentActivity = "STILL"
    private var secPerStep: Double = 0.5
    
    private let motionManager = CMMotionActivityManager()
    
    func startSession(rate: Double) {
        isTracking = true
        distanceMeters = 0.0
        earnedMs = 0.0
        lastLocation = nil
        secPerStep = rate
        
        startActivityUpdates()
    }
    
    func stopSession() -> [String: Any] {
        isTracking = false
        motionManager.stopActivityUpdates()
        
        return [
            "distance": distanceMeters,
            "coins": Int(floor(earnedMs / 60000.0))
        ]
    }
    
    private func startActivityUpdates() {
        if CMMotionActivityManager.isActivityAvailable() {
            motionManager.startActivityUpdates(to: .main) { [weak self] activity in
                guard let self = self, let activity = activity else { return }
                
                if activity.walking { self.currentActivity = "WALKING" }
                else if activity.running { self.currentActivity = "RUNNING" }
                else if activity.automotive { self.currentActivity = "VEHICLE" }
                else if activity.stationary { self.currentActivity = "STILL" }
                else { self.currentActivity = "UNKNOWN" }
            }
        }
    }
    
    func updateLocation(_ location: CLLocation) {
        guard isTracking else { return }
        
        if let last = lastLocation {
            let distance = location.distance(from: last)
            let speedKmh = location.speed * 3.6
            
            // --- ANTI CHEAT parity with Android ---
            if location.horizontalAccuracy > 30 { return }
            
            let isMotionDetected = currentActivity == "WALKING" || currentActivity == "RUNNING"
            
            if isMotionDetected && distance > 1.5 && speedKmh < 25 {
                distanceMeters += distance
                
                // Estimation: 1 meter = 1.33 steps (parity)
                let estimatedSteps = distance * 1.33
                let msEarned = estimatedSteps * (secPerStep * 1000.0)
                earnedMs += msEarned
            }
        }
        
        lastLocation = location
    }
    
    func getStats() -> [String: Any] {
        return [
            "distance": distanceMeters,
            "coins": Int(floor(earnedMs / 60000.0)),
            "activity": currentActivity
        ]
    }
}
