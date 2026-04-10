import Foundation
import MediaPipeTasksVision
import AVFoundation

protocol PoseLandmarkerHelperDelegate: AnyObject {
    func poseLandmarkerHelper(_ helper: PoseLandmarkerHelper, didFinishDetection result: PoseLandmarkerResult?, error: Error?)
}

class PoseLandmarkerHelper: NSObject {
    
    weak var delegate: PoseLandmarkerHelperDelegate?
    private var poseLandmarker: PoseLandmarker?
    
    init(modelPath: String?) {
        super.init()
        setupPoseLandmarker(modelPath: modelPath)
    }
    
    private func setupPoseLandmarker(modelPath: String?) {
        guard let path = modelPath ?? Bundle.main.path(forResource: "pose_landmarker_lite", ofType: "task") else {
            print("Model not found")
            return
        }
        
        let baseOptions = BaseOptions(modelAssetPath: path)
        let options = PoseLandmarkerOptions()
        options.baseOptions = baseOptions
        options.runningMode = .liveStream
        options.poseLandmarkerLiveStreamDelegate = self
        
        do {
            poseLandmarker = try PoseLandmarker(options: options)
        } catch {
            print("Failed to create PoseLandmarker: \(error)")
        }
    }
    
    func detectAsync(sampleBuffer: CMSampleBuffer, timestampInMilliseconds: Int) {
        guard let image = try? MPImage(sampleBuffer: sampleBuffer) else { return }
        try? poseLandmarker?.detectAsync(image: image, timestampInMilliseconds: timestampInMilliseconds)
    }
}

extension PoseLandmarkerHelper: PoseLandmarkerLiveStreamDelegate {
    func poseLandmarker(_ poseLandmarker: PoseLandmarker, didFinishDetection result: PoseLandmarkerResult?, timestampInMilliseconds Int: Int, error: Error?) {
        delegate?.poseLandmarkerHelper(self, didFinishDetection: result, error: error)
    }
}
