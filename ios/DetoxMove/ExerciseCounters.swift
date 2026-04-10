import Foundation
import MediaPipeTasksVision

enum ExerciseState {
    case up, down
}

class PushUpCounter {
    private var currentState: ExerciseState = .up
    var count = 0
    private var minAngleReached = 180.0
    
    private let confirmFrames = 3
    private var downConfirmCount = 0
    private var upConfirmCount = 0
    private var lastRepTime: TimeInterval = 0
    private let repCooldown: TimeInterval = 0.4
    
    private let smoothWindow = 4
    private var leftBuffer: [Double] = []
    private var rightBuffer: [Double] = []
    
    private let presenceThreshold: Float = 0.5
    
    func reset() {
        count = 0
        currentState = .up
        leftBuffer.removeAll()
        rightBuffer.removeAll()
        minAngleReached = 180.0
    }
    
    func process(landmarks: [NormalizedLandmark]) {
        guard landmarks.count > 25 else { return }
        
        // Landmark mapping (same as Android)
        let lShoulder = landmarks[11]
        let rShoulder = landmarks[12]
        let lElbow = landmarks[13]
        let rElbow = landmarks[14]
        let lWrist = landmarks[15]
        let rWrist = landmarks[16]
        let lHip = landmarks[23]
        let rHip = landmarks[24]
        
        let leftPresent = lShoulder.visibility > presenceThreshold && lElbow.visibility > presenceThreshold && lWrist.visibility > presenceThreshold
        let rightPresent = rShoulder.visibility > presenceThreshold && rElbow.visibility > presenceThreshold && rWrist.visibility > presenceThreshold
        
        if !leftPresent && !rightPresent { return }
        
        // Anti-Standing check
        let yDiff = abs((lShoulder.y + rShoulder.y) / 2.0 - (lHip.y + rHip.y) / 2.0)
        let shoulderWidth = sqrt(pow(Double(lShoulder.x - rShoulder.x), 2) + pow(Double(lShoulder.y - rShoulder.y), 2))
        
        let torsoRatio = shoulderWidth > 0.05 ? yDiff / shoulderWidth : 2.0
        if torsoRatio > 1.4 { return } // Likely standing
        
        let rawLeft = leftPresent ? calculateAngle(lShoulder, lElbow, lWrist) : nil
        let rawRight = rightPresent ? calculateAngle(rShoulder, rElbow, rWrist) : nil
        
        let smoothLeft = smooth(buffer: &leftBuffer, value: rawLeft)
        let smoothRight = smooth(buffer: &rightBuffer, value: rawRight)
        
        var effectiveAngle: Double = 0
        if let l = smoothLeft, let r = smoothRight {
            effectiveAngle = (l + r) / 2.0
        } else if let l = smoothLeft {
            effectiveAngle = l
        } else if let r = smoothRight {
            effectiveAngle = r
        } else {
            return
        }
        
        let downThreshold = 115.0
        let upThreshold = 145.0
        
        switch currentState {
        case .up:
            if effectiveAngle < downThreshold {
                downConfirmCount += 1
                upConfirmCount = 0
                if downConfirmCount >= confirmFrames {
                    currentState = .down
                    downConfirmCount = 0
                }
            } else {
                downConfirmCount = 0
            }
        case .down:
            minAngleReached = min(minAngleReached, effectiveAngle)
            if effectiveAngle > upThreshold {
                let now = Date().timeIntervalSince1970
                if now - lastRepTime < repCooldown { return }
                
                upConfirmCount += 1
                downConfirmCount = 0
                if upConfirmCount >= confirmFrames {
                    currentState = .up
                    upConfirmCount = 0
                    if minAngleReached < 120.0 {
                        count += 1
                    }
                    minAngleReached = 180.0
                    lastRepTime = now
                }
            } else {
                upConfirmCount = 0
            }
        }
    }
    
    private func calculateAngle(_ a: NormalizedLandmark, _ b: NormalizedLandmark, _ c: NormalizedLandmark) -> Double {
        let radians = atan2(Double(c.y - b.y), Double(c.x - b.x)) - atan2(Double(a.y - b.y), Double(a.x - b.x))
        var angle = abs(radians * 180.0 / .pi)
        if angle > 180.0 { angle = 360.0 - angle }
        return angle
    }
    
    private func smooth(buffer: inout [Double], value: Double?) -> Double? {
        guard let v = value else { return nil }
        if buffer.count >= smoothWindow { buffer.removeFirst() }
        buffer.append(v)
        return buffer.reduce(0, +) / Double(buffer.count)
    }
    
    func isPoseCorrect(landmarks: [NormalizedLandmark]) -> Bool {
        guard landmarks.count > 25 else { return false }
        let threshold: Float = 0.4
        
        let shoulderOk = landmarks[11].visibility > threshold && landmarks[12].visibility > threshold
        let handOk = landmarks[15].visibility > threshold && landmarks[16].visibility > threshold
        let hipOk = landmarks[23].visibility > threshold && landmarks[24].visibility > threshold
        
        return shoulderOk && handOk && hipOk
    }
}

class SquatCounter {
    private enum State { case standing, squatting }
    private var currentState: State = .standing
    var count = 0
    
    private let thresholdDown = 140.0
    private let thresholdUp = 165.0
    private var lastRepTime: TimeInterval = 0
    private let repCooldown: TimeInterval = 0.4
    
    private let smoothWindow = 4
    private var leftAngleBuffer: [Double] = []
    private var rightAngleBuffer: [Double] = []
    
    private let confirmFrames = 2
    private var downConfirmCount = 0
    private var upConfirmCount = 0
    
    private let visibilityThreshold: Float = 0.5
    
    func reset() {
        count = 0
        currentState = .standing
        downConfirmCount = 0
        upConfirmCount = 0
        leftAngleBuffer.removeAll()
        rightAngleBuffer.removeAll()
    }
    
    func process(landmarks: [NormalizedLandmark]) {
        guard landmarks.count > 28 else { return }
        
        let lHip = landmarks[23]
        let rHip = landmarks[24]
        let lKnee = landmarks[25]
        let rKnee = landmarks[26]
        let lAnkle = landmarks[27]
        let rAnkle = landmarks[28]
        
        let jointsVisible = (lHip.visibility > visibilityThreshold && rHip.visibility > visibilityThreshold) ||
                           (lKnee.visibility > visibilityThreshold && rKnee.visibility > visibilityThreshold)
        if !jointsVisible { return }
        
        let rawLeft = calculateAngle(lHip, lKnee, lAnkle)
        let rawRight = calculateAngle(rHip, rKnee, rAnkle)
        
        let smoothLeft = smooth(buffer: &leftAngleBuffer, value: rawLeft)
        let smoothRight = smooth(buffer: &rightAngleBuffer, value: rawRight)
        
        let effectiveAngle = (smoothLeft + smoothRight) / 2.0
        
        switch currentState {
        case .standing:
            if effectiveAngle < thresholdDown {
                downConfirmCount += 1
                upConfirmCount = 0
                if downConfirmCount >= confirmFrames {
                    currentState = .squatting
                    downConfirmCount = 0
                }
            } else {
                downConfirmCount = 0
            }
        case .squatting:
            if effectiveAngle > thresholdUp {
                let now = Date().timeIntervalSince1970
                if now - lastRepTime < repCooldown { return }
                
                upConfirmCount += 1
                downConfirmCount = 0
                if upConfirmCount >= confirmFrames {
                    currentState = .standing
                    upConfirmCount = 0
                    count += 1
                    lastRepTime = now
                }
            } else {
                upConfirmCount = 0
            }
        }
    }
    
    private func calculateAngle(_ a: NormalizedLandmark, _ b: NormalizedLandmark, _ c: NormalizedLandmark) -> Double {
        let radians = atan2(Double(c.y - b.y), Double(c.x - b.x)) - atan2(Double(a.y - b.y), Double(a.x - b.x))
        var angle = abs(radians * 180.0 / .pi)
        if angle > 180.0 { angle = 360.0 - angle }
        return angle
    }
    
    private func smooth(buffer: inout [Double], value: Double) -> Double {
        if buffer.count >= smoothWindow { buffer.removeFirst() }
        buffer.append(value)
        return buffer.reduce(0, +) / Double(buffer.count)
    }
    
    func isPoseCorrect(landmarks: [NormalizedLandmark]) -> Bool {
        guard landmarks.count > 28 else { return false }
        let threshold: Float = 0.4
        
        let shouldersVisible = landmarks[11].visibility > threshold && landmarks[12].visibility > threshold
        let hipsVisible = landmarks[23].visibility > threshold && landmarks[24].visibility > threshold
        let kneesVisible = landmarks[25].visibility > threshold && landmarks[26].visibility > threshold
        let anklesVisible = landmarks[27].visibility > threshold && landmarks[28].visibility > threshold
        
        return shouldersVisible && hipsVisible && kneesVisible && anklesVisible
    }
}

class JumpingJackCounter {
    private enum State { case closed, open }
    private var currentState: State = .closed
    var count = 0
    
    private let confirmFrames = 3
    private var openConfirmCount = 0
    private var closedConfirmCount = 0
    private var lastRepTime: TimeInterval = 0
    private let repCooldown: TimeInterval = 0.5
    
    private let openYMargin: Float = 0.05
    private let closedYMargin: Float = 0.02
    
    private let openAnkleRatio: Float = 1.5
    private let closedAnkleRatio: Float = 1.1
    
    private let smoothWindow = 3
    private var leftWristBuf: [Float] = []
    private var rightWristBuf: [Float] = []
    private var ankleDistBuf: [Float] = []
    
    private let visThreshold: Float = 0.25
    
    func reset() {
        count = 0
        currentState = .closed
        openConfirmCount = 0
        closedConfirmCount = 0
        leftWristBuf.removeAll()
        rightWristBuf.removeAll()
        ankleDistBuf.removeAll()
    }
    
    func process(landmarks: [NormalizedLandmark]) {
        guard landmarks.count > 28 else { return }
        
        let lShoulder = landmarks[11]
        let rShoulder = landmarks[12]
        let lWrist = landmarks[15]
        let rWrist = landmarks[16]
        let lAnkle = landmarks[27]
        let rAnkle = landmarks[28]
        
        let leftHandOk = lShoulder.visibility > visThreshold && lWrist.visibility > visThreshold
        let rightHandOk = rShoulder.visibility > visThreshold && rWrist.visibility > visThreshold
        let ankleOk = lAnkle.visibility > visThreshold && rAnkle.visibility > visThreshold
        
        if !leftHandOk && !rightHandOk { return }
        
        // Hands logic
        let smoothL = smooth(buffer: &leftWristBuf, value: lWrist.y)
        let smoothR = smooth(buffer: &rightWristBuf, value: rWrist.y)
        
        let lOpen = leftHandOk && (smoothL < lShoulder.y - openYMargin)
        let rOpen = rightHandOk && (smoothR < rShoulder.y - openYMargin)
        let handsOpen = (leftHandOk && rightHandOk) ? (lOpen && rOpen) : (leftHandOk ? lOpen : rOpen)
        
        let lClosed = leftHandOk && (smoothL > lShoulder.y + closedYMargin)
        let rClosed = rightHandOk && (smoothR > rShoulder.y + closedYMargin)
        let handsClosed = (leftHandOk && rightHandOk) ? (lClosed && rClosed) : (leftHandOk ? lClosed : rClosed)
        
        // Legs logic
        let shoulderWidth = max(abs(lShoulder.x - rShoulder.x), 0.1)
        let ankleDist = abs(lAnkle.x - rAnkle.x)
        let smoothAnkle = smooth(buffer: &ankleDistBuf, value: ankleDist)
        
        let legsOpen = ankleOk && (smoothAnkle > shoulderWidth * openAnkleRatio)
        let legsClosed = ankleOk && (smoothAnkle < shoulderWidth * closedAnkleRatio)
        
        let isPosOpen = handsOpen && legsOpen
        let isPosClosed = handsClosed && legsClosed
        
        switch currentState {
        case .closed:
            if isPosOpen {
                openConfirmCount += 1
                closedConfirmCount = 0
                if openConfirmCount >= confirmFrames {
                    currentState = .open
                    openConfirmCount = 0
                }
            } else {
                openConfirmCount = 0
            }
        case .open:
            if isPosClosed {
                let now = Date().timeIntervalSince1970
                if now - lastRepTime < repCooldown { return }
                
                closedConfirmCount += 1
                openConfirmCount = 0
                if closedConfirmCount >= confirmFrames {
                    currentState = .closed
                    closedConfirmCount = 0
                    count += 1
                    lastRepTime = now
                }
            } else {
                closedConfirmCount = 0
            }
        }
    }
    
    func isPoseCorrect(landmarks: [NormalizedLandmark]) -> Bool {
        guard landmarks.count > 28 else { return false }
        let sOk = landmarks[11].visibility > visThreshold && landmarks[12].visibility > visThreshold
        let aOk = landmarks[27].visibility > visThreshold && landmarks[28].visibility > visThreshold
        return sOk && aOk
    }
    
    private func smooth(buffer: inout [Float], value: Float) -> Float {
        if buffer.count >= smoothWindow { buffer.removeFirst() }
        buffer.append(value)
        return buffer.reduce(0, +) / Float(buffer.count)
    }
}
