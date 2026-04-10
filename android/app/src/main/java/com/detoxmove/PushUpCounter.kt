package com.detoxmove

import android.util.Log
import kotlin.math.*

class PushUpCounter {
    enum class State { UP, DOWN }

    private var currentState = State.UP
    private var count = 0
    private var minAngleReached = 180.0

    private val CONFIRM_FRAMES = 3
    private var downConfirmCount = 0
    private var upConfirmCount   = 0
    private var lastRepTime = 0L
    private val REP_COOLDOWN_MS = 400L

    private val SMOOTH_WINDOW = 4
    private val leftBuffer  = ArrayDeque<Double>(SMOOTH_WINDOW)
    private val rightBuffer = ArrayDeque<Double>(SMOOTH_WINDOW)

    private val PRESENCE_THRESHOLD = 0.5f  
    private val VISIBILITY_THRESHOLD = 0.4f

    data class DebugInfo(
        val leftAngle: Double,
        val rightAngle: Double,
        val effectiveAngle: Double,
        val state: State
    )

    private var lastDebugInfo: DebugInfo? = null

    fun setThresholdDown(v: Double) {}
    fun setThresholdUp(v: Double) {}
    fun setMaxVerticalDiff(v: Double) {}

    fun resetCount() {
        count = 0
        downConfirmCount = 0
        upConfirmCount = 0
        currentState = State.UP
        leftBuffer.clear()
        rightBuffer.clear()
        minAngleReached = 180.0
    }

    fun getCount(): Int = count

    fun processLandmarks(landmarks: List<PoseLandmark>) {
        if (landmarks.size < 25) return

        val lShoulder = landmarks[11]
        val rShoulder = landmarks[12]
        val lElbow    = landmarks[13]
        val rElbow    = landmarks[14]
        val lWrist    = landmarks[15]
        val rWrist    = landmarks[16]
        val lHip      = landmarks[23]
        val rHip      = landmarks[24]

        val leftPresent  =
            lShoulder.visibility > PRESENCE_THRESHOLD &&
            lElbow.visibility > PRESENCE_THRESHOLD &&
            lWrist.visibility > PRESENCE_THRESHOLD

        val rightPresent =
            rShoulder.visibility > PRESENCE_THRESHOLD &&
            rElbow.visibility > PRESENCE_THRESHOLD &&
            rWrist.visibility > PRESENCE_THRESHOLD

        if (!leftPresent && !rightPresent) {
            downConfirmCount = 0
            upConfirmCount = 0
            return
        }

        val yDiff = abs((lShoulder.y + rShoulder.y) / 2f - (lHip.y + rHip.y) / 2f)
        val shoulderWidth = sqrt(
            (lShoulder.x - rShoulder.x).pow(2) +
            (lShoulder.y - rShoulder.y).pow(2)
        )
        val zDiff = abs((lShoulder.z + rShoulder.z) / 2f - (lHip.z + rHip.z) / 2f)

        val torsoRatio =
            if (shoulderWidth > 0.05)
                yDiff / shoulderWidth
            else 2.0f
        
        val isStanding =
            torsoRatio > 1.4f ||
            (zDiff < 0.08f && torsoRatio > 1.0f)
        
        if (isStanding) {
            downConfirmCount = 0
            upConfirmCount = 0
            return
        }

        val rawLeft =
            if (leftPresent) calcAngle(lShoulder, lElbow, lWrist)
            else Double.NaN

        val rawRight =
            if (rightPresent) calcAngle(rShoulder, rElbow, rWrist)
            else Double.NaN

        val smoothLeft =
            if (!rawLeft.isNaN()) smooth(leftBuffer, rawLeft)
            else Double.NaN

        val smoothRight =
            if (!rawRight.isNaN()) smooth(rightBuffer, rawRight)
            else Double.NaN

        val effectiveAngle = when {
            !smoothLeft.isNaN() && !smoothRight.isNaN() ->
                (smoothLeft + smoothRight) / 2.0
            !smoothLeft.isNaN() -> smoothLeft
            !smoothRight.isNaN() -> smoothRight
            else -> return
        }

        lastDebugInfo = DebugInfo(
            smoothLeft.takeIf { !it.isNaN() } ?: 0.0,
            smoothRight.takeIf { !it.isNaN() } ?: 0.0,
            effectiveAngle,
            currentState
        )

        val DOWN_THRESHOLD = 115.0
        val UP_THRESHOLD   = 145.0

        when (currentState) {
            State.UP -> {
                if (effectiveAngle < DOWN_THRESHOLD) {
                    downConfirmCount++
                    upConfirmCount = 0
                    if (downConfirmCount >= CONFIRM_FRAMES) {
                        currentState = State.DOWN
                        downConfirmCount = 0
                        Log.d("DetoxMove_PU", "DOWN")
                    }
                } else {
                    downConfirmCount = 0
                }
            }

            State.DOWN -> {
                minAngleReached = min(minAngleReached, effectiveAngle)
                if (effectiveAngle > UP_THRESHOLD) {
                    val now = System.currentTimeMillis()
                    if (now - lastRepTime < REP_COOLDOWN_MS) return

                    upConfirmCount++
                    downConfirmCount = 0
                    if (upConfirmCount >= CONFIRM_FRAMES) {
                        currentState = State.UP
                        upConfirmCount = 0
                        if (minAngleReached < 120.0) {
                            count++
                            Log.d("DetoxMove_PU", "REP #$count")
                        }
                        minAngleReached = 180.0
                        lastRepTime = now
                    }
                } else {
                    upConfirmCount = 0
                }
            }
        }
    }

    fun isPoseCorrect(landmarks: List<PoseLandmark>): Boolean {
        if (landmarks.size < 25) return false

        val threshold = VISIBILITY_THRESHOLD

        val shoulderOk =
            landmarks[11].visibility > threshold &&
            landmarks[12].visibility > threshold

        val handOk =
            landmarks[15].visibility > threshold &&
            landmarks[16].visibility > threshold

        val hipOk =
            landmarks[23].visibility > threshold &&
            landmarks[24].visibility > threshold

        return shoulderOk && handOk && hipOk
    }

    private fun smooth(buf: ArrayDeque<Double>, v: Double): Double {
        if (buf.size >= SMOOTH_WINDOW) buf.removeFirst()
        buf.addLast(v)
        return buf.average()
    }

    private fun calcAngle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): Double {
        val radians =
            atan2((c.y - b.y).toDouble(), (c.x - b.x).toDouble()) -
            atan2((a.y - b.y).toDouble(), (a.x - b.x).toDouble())

        var angle = abs(radians * 180.0 / PI)
        if (angle > 180.0) angle = 360.0 - angle
        return angle
    }
}