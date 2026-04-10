import UIKit
import AVFoundation
import MediaPipeTasksVision
import React

@objc(NativeCameraView)
class NativeCameraView: UIView, AVCaptureVideoDataOutputSampleBufferDelegate, PoseLandmarkerHelperDelegate {
    
    private var captureSession: AVCaptureSession?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private let pushUpCounter = PushUpCounter()
    private let squatCounter = SquatCounter()
    private let jumpingJackCounter = JumpingJackCounter()
    private var lastEmittedCount = 0
    
    @objc var exerciseType: String = "pushup" // "pushup", "squat", "jump"
    
    // We'll use the main bridge to emit global events
    private var bridge: RCTBridge? {
        return (RCTBridge.current() as? RCTBridge)
    }
    
    @objc var onExerciseUpdate: RCTDirectEventBlock?
    
    override init(frame: CGRect) {
        super.init(frame: frame)
        setupCamera()
        setupMediaPipe()
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    private func setupCamera() {
        captureSession = AVCaptureSession()
        captureSession?.sessionPreset = .vga640x480
        
        guard let backCamera = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front),
              let input = try? AVCaptureDeviceInput(device: backCamera),
              let session = captureSession else { return }
        
        session.addInput(input)
        
        let output = AVCaptureVideoDataOutput()
        output.setSampleBufferDelegate(self, queue: DispatchQueue(label: "videoQueue"))
        session.addOutput(output)
        
        let pLayer = AVCaptureVideoPreviewLayer(session: session)
        pLayer.videoGravity = .resizeAspectFill
        layer.addSublayer(pLayer)
        self.previewLayer = pLayer
        
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            self?.captureSession?.startRunning()
        }
    }
    
    private func setupMediaPipe() {
        poseLandmarkerHelper = PoseLandmarkerHelper(modelPath: nil)
        poseLandmarkerHelper?.delegate = self
    }
    
    override func layoutSubviews() {
        super.layoutSubviews()
        previewLayer?.frame = bounds
    }
    
    // MARK: - AVCaptureVideoDataOutputSampleBufferDelegate
    func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        let timestamp = Int(Date().timeIntervalSince1970 * 1000)
        poseLandmarkerHelper?.detectAsync(sampleBuffer: sampleBuffer, timestampInMilliseconds: timestamp)
    }
    
    // MARK: - PoseLandmarkerHelperDelegate
    func poseLandmarkerHelper(_ helper: PoseLandmarkerHelper, didFinishDetection result: PoseLandmarkerResult?, error: Error?) {
        guard let landmarks = result?.landmarks.first else { return }
        
        var currentCount = 0
        var isPoseCorrect = false
        
        if exerciseType == "squat" {
            squatCounter.process(landmarks: landmarks)
            currentCount = squatCounter.count
            isPoseCorrect = squatCounter.isPoseCorrect(landmarks: landmarks)
        } else if exerciseType == "jump" {
            jumpingJackCounter.process(landmarks: landmarks)
            currentCount = jumpingJackCounter.count
            isPoseCorrect = jumpingJackCounter.isPoseCorrect(landmarks: landmarks)
        } else {
            pushUpCounter.process(landmarks: landmarks)
            currentCount = pushUpCounter.count
            isPoseCorrect = pushUpCounter.isPoseCorrect(landmarks: landmarks)
        }
        
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            if currentCount != self.lastEmittedCount {
                self.lastEmittedCount = currentCount
                self.bridge?.enqueueJSCall("RCTDeviceEventEmitter", method: "emit", args: ["onCountUpdate", ["count": currentCount]], completion: nil)
            }

            self.bridge?.enqueueJSCall("RCTDeviceEventEmitter", method: "emit", args: ["onPoseStatus", ["isPoseCorrect": isPoseCorrect]], completion: nil)
            
            if let onExerciseUpdate = self.onExerciseUpdate {
                onExerciseUpdate([
                    "count": currentCount,
                    "isPoseCorrect": isPoseCorrect,
                    "type": self.exerciseType
                ])
            }
        }
    }
}
