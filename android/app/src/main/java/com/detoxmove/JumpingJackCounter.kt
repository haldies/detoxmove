package com.detoxmove

import android.util.Log
import kotlin.math.*

class JumpingJackCounter {
    enum class State { CLOSED, OPEN }

    private var currentState = State.CLOSED
    private var count = 0

    // Frame confirmation — harus konsisten N frame sebelum state berubah
    private val CONFIRM_FRAMES = 3
    private var openConfirmCount  = 0
    private var closedConfirmCount = 0
    private var lastRepTime = 0L
    private val REP_COOLDOWN_MS = 500L

    private val VIS_THRESHOLD = PoseConfig.JumpingJack.visibilityThreshold

    private val OPEN_Y_MARGIN   = 0.05f  // Tangan harus 5% di atas bahu
    private val CLOSED_Y_MARGIN = 0.02f  // Tangan harus di bawah bahu

    // Smoothing buffer untuk Y tangan (agar tidak jitter)
    private val SMOOTH_WINDOW = 3
    private val leftWristBuf  = ArrayDeque<Float>(SMOOTH_WINDOW)
    private val rightWristBuf = ArrayDeque<Float>(SMOOTH_WINDOW)
    private val ankleDistBuf  = ArrayDeque<Float>(SMOOTH_WINDOW)

    fun resetCount() {
        count = 0
        openConfirmCount = 0
        closedConfirmCount = 0
        currentState = State.CLOSED
        leftWristBuf.clear()
        rightWristBuf.clear()
        ankleDistBuf.clear()
    }

    fun getCount(): Int = count

    fun processLandmarks(landmarks: List<PoseLandmark>) {
        if (landmarks.size < 29) return

        val lShoulder = landmarks[11]
        val rShoulder = landmarks[12]
        val lWrist    = landmarks[15]
        val rWrist    = landmarks[16]
        val lAnkle    = landmarks[27]
        val rAnkle    = landmarks[28]

        // Visibility check — Tangan (Wrist) & Kaki (Ankle)
        val visLimit = VIS_THRESHOLD
        val leftHandOk  = lShoulder.visibility > visLimit && lWrist.visibility > visLimit
        val rightHandOk = rShoulder.visibility > visLimit && rWrist.visibility > visLimit
        val ankleOk     = lAnkle.visibility > visLimit && rAnkle.visibility > visLimit

        // Jika tidak ada tangan terdeteksi, abaikan frame
        if (!leftHandOk && !rightHandOk) {
            openConfirmCount = 0
            closedConfirmCount = 0
            return
        }

        // --- HANDS LOGIC ---
        val smoothLWristY = smoothF(leftWristBuf, lWrist.y)
        val smoothRWristY = smoothF(rightWristBuf, rWrist.y)

        // TERBUKA: tangan naik di atas bahu
        val leftHandOpen   = leftHandOk  && (smoothLWristY < lShoulder.y - OPEN_Y_MARGIN)
        val rightHandOpen  = rightHandOk && (smoothRWristY < rShoulder.y - OPEN_Y_MARGIN)

        // TERTUTUP: tangan di bawah bahu
        val leftHandClosed  = leftHandOk  && (smoothLWristY > lShoulder.y + CLOSED_Y_MARGIN)
        val rightHandClosed = rightHandOk && (smoothRWristY > rShoulder.y + CLOSED_Y_MARGIN)

        val handsOpen = when {
            leftHandOk && rightHandOk -> leftHandOpen && rightHandOpen
            leftHandOk  -> leftHandOpen
            rightHandOk -> rightHandOpen
            else -> false
        }

        val handsClosed = when {
            leftHandOk && rightHandOk -> leftHandClosed && rightHandClosed
            leftHandOk  -> leftHandClosed
            rightHandOk -> rightHandClosed
            else -> false
        }

        // --- LEGS LOGIC ---
        val shoulderWidth = abs(lShoulder.x - rShoulder.x).coerceAtLeast(0.1f)
        val ankleDist     = abs(lAnkle.x - rAnkle.x)
        val smoothAnkleDist = smoothF(ankleDistBuf, ankleDist)

        // Ratios from PoseConfig
        val legsOpen   = ankleOk && (smoothAnkleDist > shoulderWidth * PoseConfig.JumpingJack.openAnkleRatio)
        val legsClosed = ankleOk && (smoothAnkleDist < shoulderWidth * PoseConfig.JumpingJack.closedAnkleRatio)

        // --- FINAL CONDITION: BOTH HANDS AND LEGS MUST MATCH ---
        // Sesuai request user: "sama sama dua kondisi terpenuhi"
        val isPosOpen   = handsOpen && legsOpen
        val isPosClosed = handsClosed && legsClosed

        // --- State Machine ---
        when (currentState) {
            State.CLOSED -> {
                if (isPosOpen) {
                    openConfirmCount++
                    closedConfirmCount = 0
                    if (openConfirmCount >= CONFIRM_FRAMES) {
                        currentState = State.OPEN
                        openConfirmCount = 0
                        Log.d("DetoxMove_JJ", "🙌 OPEN (AnkleDist=${smoothAnkleDist}, Target=${shoulderWidth * PoseConfig.JumpingJack.openAnkleRatio})")
                    }
                } else {
                    openConfirmCount = 0
                }
            }
            State.OPEN -> {
                if (isPosClosed) {
                    val now = System.currentTimeMillis()
                    if (now - lastRepTime < REP_COOLDOWN_MS) return

                    closedConfirmCount++
                    openConfirmCount = 0
                    if (closedConfirmCount >= CONFIRM_FRAMES) {
                        currentState = State.CLOSED
                        closedConfirmCount = 0
                        count++
                        lastRepTime = now
                        Log.d("DetoxMove_JJ", "✅ JJ REP #$count")
                    }
                } else {
                    closedConfirmCount = 0
                }
            }
        }
    }

    /**
     * Cek apakah pose valid untuk feedback UI (skeleton hijau/merah).
     * Sesuai request: Kaki JUGA harus terdeteksi.
     */
    fun isPoseCorrect(landmarks: List<PoseLandmark>): Boolean {
        if (landmarks.size < 29) return false
        
        val visLimit = VIS_THRESHOLD
        val shoulderOk = landmarks[11].visibility > visLimit && landmarks[12].visibility > visLimit
        val ankleOk    = landmarks[27].visibility > visLimit && landmarks[28].visibility > visLimit
        
        return shoulderOk && ankleOk
    }

    private fun smoothF(buf: ArrayDeque<Float>, v: Float): Float {
        if (buf.size >= SMOOTH_WINDOW) buf.removeFirst()
        buf.addLast(v)
        return buf.average().toFloat()
    }
}
