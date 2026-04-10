import Foundation
import React

@objc(NativeCameraViewManager)
class NativeCameraViewManager: RCTViewManager {
    
    override func view() -> UIView! {
        return NativeCameraView()
    }
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
}
