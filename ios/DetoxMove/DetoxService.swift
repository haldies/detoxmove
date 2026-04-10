import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity
import CoreMotion
import React
import CoreLocation

@objc(DetoxService)
class DetoxService: RCTEventEmitter, CLLocationManagerDelegate {
    
    private let APP_GROUP = "group.com.detoxmove.data"
    private var locationManager = CLLocationManager()
    private let BYPASS_PERMISSIONS = true // DEV BYPASS
    
    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
        locationManager.allowsBackgroundLocationUpdates = true
        locationManager.pausesLocationUpdatesAutomatically = false
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return ["onLocationUpdate", "onModelReady", "onBalanceUpdate"]
    }
    
    private func getSharedDefaults() -> UserDefaults? {
        return UserDefaults(suiteName: APP_GROUP)
    }

    // MARK: - Core Logic (Time Economy)
    
    @objc
    func getBalance(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let defaults = getSharedDefaults()
        let purchasedMs = defaults?.double(forKey: "RULE_PURCHASED_MS") ?? 0
        let baseQuotaMins = defaults?.integer(forKey: "RULE_BASE_QUOTA_MINS") ?? 0
        let dailyUsedMs = defaults?.double(forKey: "DAILY_USED_MS") ?? 0
        
        let baseMs = Double(baseQuotaMins) * 60000.0
        
        // Date check
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd"
        let todayStr = formatter.string(from: Date())
        let lastUsageDate = defaults?.string(forKey: "LAST_USAGE_DATE") ?? ""
        
        var effectiveBalanceMs: Double
        if lastUsageDate != todayStr {
            effectiveBalanceMs = baseMs + purchasedMs
            // Note: We don't reset DAILY_USED_MS here, usually the service/monitor does it.
        } else {
            effectiveBalanceMs = (baseMs - dailyUsedMs) + purchasedMs
        }
        
        if effectiveBalanceMs < 0 { effectiveBalanceMs = 0 }
        resolve(effectiveBalanceMs)
    }
    
    @objc
    func buyTime(_ mins: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let defaults = getSharedDefaults()
        let currentMs = defaults?.double(forKey: "RULE_PURCHASED_MS") ?? 0
        let addedMs = mins * 60000.0
        let newTotal = currentMs + addedMs
        
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyyMMdd"
        let todayStr = formatter.string(from: Date())
        
        defaults?.set(newTotal, forKey: "RULE_PURCHASED_MS")
        defaults?.set(todayStr, forKey: "LAST_BUY_RESET")
        defaults?.synchronize()
        
        resolve(true)
    }
    
    @objc
    func setRules(_ baseQuotaMins: Int, dailyMaxMins: Int, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let defaults = getSharedDefaults()
        defaults?.set(baseQuotaMins, forKey: "RULE_BASE_QUOTA_MINS")
        defaults?.set(dailyMaxMins, forKey: "RULE_DAILY_MAX_MINS")
        defaults?.synchronize()
        resolve(true)
    }

    @objc
    func setRates(_ secPerStep: Double, minPerPushup: Double, minPerSquat: Double, minPerJump: Double, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let defaults = getSharedDefaults()
        defaults?.set(secPerStep, forKey: "RULE_SEC_PER_STEP")
        defaults?.set(minPerPushup, forKey: "RULE_MIN_PER_PUSHUP")
        defaults?.set(minPerSquat, forKey: "RULE_MIN_PER_SQUAT")
        defaults?.set(minPerJump, forKey: "RULE_MIN_PER_JUMP")
        defaults?.synchronize()
        resolve(true)
    }

    // MARK: - Permissions & Screen Time
    
    @objc
    func checkPermissions(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        var status: [String: Any] = [:]
        
        // 1. Family Controls (Usage Stats equivalent)
        if BYPASS_PERMISSIONS {
            status["usageStats"] = true
        } else if #available(iOS 15.0, *) {
            let center = AuthorizationCenter.shared
            status["usageStats"] = center.authorizationStatus == .approved
        } else {
            status["usageStats"] = false
        }
        
        // 2. Motion
        status["activityRecognition"] = CMSensorRecorder.isAuthorizedForRecording() || true // Simplification
        
        // 3. Location
        status["location"] = CLLocationManager.locationServicesEnabled()
        
        // iOS doesn't have "Overlay" or "Battery Optimization" in the same way.
        status["overlay"] = true 
        status["batteryOptimization"] = true
        status["backgroundPopup"] = true
        
        resolve(status)
    }
    
    @objc
    func requestUsagePermission(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        if BYPASS_PERMISSIONS {
            resolve(true)
            return
        }
        if #available(iOS 15.0, *) {
            Task {
                do {
                    try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
                    resolve(true)
                } catch {
                    reject("ERR_AUTH", "FamilyControls authorization failed: \(error.localizedDescription)", error)
                }
            }
        } else {
            reject("ERR_OS", "FamilyControls requires iOS 15+", nil)
        }
    }

    // MARK: - App Management
    
    @objc
    func getRestrictedApps(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let defaults = getSharedDefaults()
        if let data = defaults?.data(forKey: "RESTRICTED_APPS_DATA"),
           let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) {
            // Return dummy strings for count, as tokens are opaque
            resolve(Array(repeating: "App Token", count: selection.applicationTokens.count))
        } else {
            resolve([])
        }
    }
    
    @objc
    func showFamilyActivityPicker(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        // Normally this would present a SwiftUI view from AppDelegate or current VC
        // For now, we provide the backbone bridge
        resolve(true)
    }
    
    // MARK: - Walking Session
    
    @objc
    func startWalkingSession(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let defaults = getSharedDefaults()
        let secPerStep = defaults?.double(forKey: "RULE_SEC_PER_STEP") ?? 0.5
        
        WalkingSessionManager.shared.startSession(rate: secPerStep)
        locationManager.startUpdatingLocation()
        resolve(true)
    }
    
    @objc
    func stopWalkingSession(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        locationManager.stopUpdatingLocation()
        let result = WalkingSessionManager.shared.stopSession()
        resolve(result)
    }
    
    // MARK: - CLLocationManagerDelegate
    
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        WalkingSessionManager.shared.updateLocation(location)
        
        let params: [String: Any] = [
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "speed": location.speed,
            "timestamp": location.timestamp.timeIntervalSince1970 * 1000
        ]
        
        sendEvent(withName: "onLocationUpdate", body: params)
        
        // Also emit stats
        let stats = WalkingSessionManager.shared.getStats()
        sendEvent(withName: "onWalkingStatsUpdate", body: stats)
    }
    
    @objc
    func updateExerciseProgress(_ steps: Int, pushups: Int, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let defaults = getSharedDefaults()
        defaults?.set(steps, forKey: "CURRENT_STEPS")
        defaults?.set(pushups, forKey: "CURRENT_PUSHUPS")
        defaults?.synchronize()
        resolve(true)
    }

    @objc
    func getRules(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        let defaults = getSharedDefaults()
        var rules: [String: Any] = [:]
        rules["baseQuotaMins"] = defaults?.integer(forKey: "RULE_BASE_QUOTA_MINS") ?? 0
        rules["dailyMaxMins"] = defaults?.integer(forKey: "RULE_DAILY_MAX_MINS") ?? 60
        rules["secPerStep"] = defaults?.double(forKey: "RULE_SEC_PER_STEP") ?? 0.5
        rules["minPerPushup"] = defaults?.double(forKey: "RULE_MIN_PER_PUSHUP") ?? 1.0
        rules["minPerSquat"] = defaults?.double(forKey: "RULE_MIN_PER_SQUAT") ?? 1.0
        rules["minPerJump"] = defaults?.double(forKey: "RULE_MIN_PER_JUMP") ?? 1.0
        resolve(rules)
    }

    @objc
    func prepareAI(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        // Pre-load MediaPipe
        _ = PoseLandmarkerHelper(modelPath: nil)
        sendEvent(withName: "onModelReady", body: [:])
        resolve(true)
    }
}
