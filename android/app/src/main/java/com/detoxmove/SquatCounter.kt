package com.detoxmove

import android.util.Log
import kotlin.math.atan2
import kotlin.math.PI
import kotlin.math.abs

class SquatCounter {
    enum class State { STANDING, SQUATTING }

    private var currentState = State.STANDING
    private var count = 0

    // === Thresholds untuk Squat (Loosened) ===
    private var thresholdDown = 140.0 // Lebih toleran
    private var thresholdUp   = 165.0
    private var lastRepTime = 0L
    private var minVerticalDiff = 0.15

    private val SMOOTH_WINDOW = 4
    private val leftAngleBuffer  = ArrayDeque<Double>(SMOOTH_WINDOW)
    private val rightAngleBuffer = ArrayDeque<Double>(SMOOTH_WINDOW)

    private val CONFIRM_FRAMES = 2
    private var downConfirmCount = 0
    private var upConfirmCount   = 0

    fun resetCount() {
        count = 0
        downConfirmCount = 0
        upConfirmCount = 0
        leftAngleBuffer.clear()
        rightAngleBuffer.clear()
    }

    fun processLandmarks(landmarks: List<PoseLandmark>) {
        if (landmarks.size < 29) return // Butuh sampai mata kaki (27, 28)

        // Landmarks Utama untuk Squat
        val leftShoulder  = landmarks[11]
        val rightShoulder = landmarks[12]
        val leftHip       = landmarks[23]
        val rightHip      = landmarks[24]
        val leftKnee      = landmarks[25]
        val rightKnee     = landmarks[26]
        val leftAnkle     = landmarks[27]
        val rightAnkle    = landmarks[28]

        // --- Best Practice: Visibility Check (Kini Terpusat ✨) ---
        val threshold = PoseConfig.Squat.visibilityThreshold
        val jointsVisible = (leftHip.visibility > threshold && rightHip.visibility > threshold) || 
                            (leftKnee.visibility > threshold && rightKnee.visibility > threshold)
        if (!jointsVisible) return 

        // 1. Hitung Torso Length (Skala Tubuh)
        val avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2f
        val avgHipY      = (leftHip.y + rightHip.y) / 2f
        val torsoLength  = abs(avgHipY - avgShoulderY)
        if (torsoLength < 0.05) return // Terlalu jauh atau data tidak valid

        val rawLeftAngle  = calculateAngle(leftHip, leftKnee, leftAnkle)
        val rawRightAngle = calculateAngle(rightHip, rightKnee, rightAnkle)
        val smoothLeft  = addToBuffer(leftAngleBuffer, rawLeftAngle)
        val smoothRight = addToBuffer(rightAngleBuffer, rawRightAngle)
        
        // Rata-rata sudut membuat deteksi transisi berdiri/jongkok JAUH lebih mulus
        val effectiveAngle = (smoothLeft + smoothRight) / 2.0

        // 3. Dynamic Hysteresis: Jarak Vertikal Hip ke Ankle (Scaled by Torso)
        val hipAnkleDiff = abs(avgHipY - (leftAnkle.y + rightAnkle.y)/2f)
        val scaledDiff = hipAnkleDiff / torsoLength // Rasio independen tinggi badan

        // 4. State Machine (Menggunakan PoseConfig Pro ✨)
        val currentThresholdDown = PoseConfig.Squat.thresholdDown
        val currentThresholdUp   = PoseConfig.Squat.thresholdUp

        if (effectiveAngle < currentThresholdDown && currentState == State.STANDING) {
            downConfirmCount++
            upConfirmCount = 0
            if (downConfirmCount >= CONFIRM_FRAMES) {
                currentState = State.SQUATTING
                downConfirmCount = 0
            }
        }
        else if (effectiveAngle > currentThresholdUp && currentState == State.SQUATTING) {
            val now = System.currentTimeMillis()
            if (now - lastRepTime < 400) return // Cooldown

            upConfirmCount++
            downConfirmCount = 0
            if (upConfirmCount >= CONFIRM_FRAMES) {
                currentState = State.STANDING
                upConfirmCount = 0
                count++
                lastRepTime = now
                Log.d("DetoxMove_Squat", "Squat: REP #$count ✓")
            }
        }
    }

    private fun addToBuffer(buffer: ArrayDeque<Double>, value: Double): Double {
        if (buffer.size >= SMOOTH_WINDOW) buffer.removeFirst()
        buffer.addLast(value)
        return buffer.average()
    }

    private fun calculateAngle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): Double {
        val radians = atan2(c.y - b.y, c.x - b.x) - atan2(a.y - b.y, a.x - b.x)
        var angle = abs(radians * 180.0 / PI)
        if (angle > 180.0) angle = 360.0 - angle
        return angle
    }

    fun isPoseCorrect(landmarks: List<PoseLandmark>): Boolean {
        if (landmarks.size < 29) return false
        val threshold = PoseConfig.Squat.visibilityThreshold
        
        // Full Body: Bahu, Pinggul, Lutut, Mata Kaki
        val shouldersVisible = landmarks[11].visibility > threshold && landmarks[12].visibility > threshold
        val hipsVisible = landmarks[23].visibility > threshold && landmarks[24].visibility > threshold
        val kneesVisible = landmarks[25].visibility > threshold && landmarks[26].visibility > threshold
        val anklesVisible = landmarks[27].visibility > threshold && landmarks[28].visibility > threshold
        
        return shouldersVisible && hipsVisible && kneesVisible && anklesVisible
    }

    fun getCount(): Int = count
}
