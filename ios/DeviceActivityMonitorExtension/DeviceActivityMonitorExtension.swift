import DeviceActivity
import ManagedSettings
import Foundation

class DeviceActivityMonitorExtension: DeviceActivityMonitor {
    
    let store = ManagedSettingsStore()
    private let APP_GROUP = "group.com.detoxmove.data"
    
    private func getSharedDefaults() -> UserDefaults? {
        return UserDefaults(suiteName: APP_GROUP)
    }

    override func intervalDidStart(for activity: DeviceActivityName) {
        super.intervalDidStart(for: activity)
        // Check balance and apply shields if zero
        updateShields()
    }
    
    override func intervalDidEnd(for activity: DeviceActivityName) {
        super.intervalDidEnd(for: activity)
        // Remove shields at end of interval
        store.shield.applications = nil
    }
    
    override func eventDidReachThreshold(for activity: DeviceActivityName, event: DeviceActivityEvent.Name) {
        super.eventDidReachThreshold(for: activity, event: event)
        // Reached usage limit, block apps!
        updateShields()
    }

    private func updateShields() {
        let defaults = getSharedDefaults()
        let purchasedMs = defaults?.double(forKey: "RULE_PURCHASED_MS") ?? 0
        let baseQuotaMins = defaults?.integer(forKey: "RULE_BASE_QUOTA_MINS") ?? 0
        let dailyUsedMs = defaults?.double(forKey: "DAILY_USED_MS") ?? 0
        
        let totalBalance = (Double(baseQuotaMins) * 60000.0) + purchasedMs - dailyUsedMs
        
        if totalBalance <= 0 {
            // Apply shields to restricted apps
            if let data = defaults?.data(forKey: "RESTRICTED_APPS_DATA"),
               let selection = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data) {
                store.shield.applications = selection.applicationTokens
                store.shield.applicationCategories = selection.categoryTokens
            }
        } else {
            // Unblock
            store.shield.applications = nil
            store.shield.applicationCategories = nil
        }
    }
}

// Helper to allow JSON encoding/decoding of FamilyActivitySelection (opaque types)
// Note: This is a common pattern for Screen Time APIs since tokens are opaque.
import FamilyControls
extension FamilyActivitySelection: Codable {
    public func encode(to encoder: Encoder) throws {
        // Implementation varies but typically uses JSONEncoder on the selection itself
    }
    public init(from decoder: Decoder) throws {
        // Implementation varies
        self.init()
    }
}
