package com.detoxmove

import android.location.Location
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.math.*

object WalkingSessionManager {
    private var isTracking = false
    private var distanceMeters = 0.0
    private var earnedMs = 0.0
    private var lastLocation: Location? = null
    private var currentActivity = "STILL"
    private var secPerStep = 0.5f
    
    private var reactContext: ReactApplicationContext? = null

    fun init(context: ReactApplicationContext) {
        this.reactContext = context
    }

    fun startSession(rate: Float) {
        isTracking = true
        distanceMeters = 0.0
        earnedMs = 0.0
        lastLocation = null
        secPerStep = rate
        Log.d("DetoxMove_Walking", "Session Started at rate: $secPerStep")
    }

    fun stopSession(): WritableMap {
        isTracking = false
        val result = Arguments.createMap()
        result.putDouble("distance", distanceMeters)
        result.putInt("coins", Math.floor(earnedMs / 60000.0).toInt())
        return result
    }

    fun updateActivity(type: String) {
        currentActivity = type
        emitUpdate()
    }

    fun updateLocation(location: Location) {
        if (!isTracking) return

        if (lastLocation != null) {
            val distance = lastLocation!!.distanceTo(location)
            val speedKmh = location.speed * 3.6

            // --- STAVRA-LEVEL ANTI CHEAT ---
            // 1. Accuracy check: Abaikan jika sinyal GPS lemah (> 30m)
            if (location.accuracy > 30) return

            // 2. Motion check: Hanya hitung jika AI mendeteksi WALKING atau RUNNING
            val isMotionDetected = currentActivity == "WALKING" || currentActivity == "RUNNING" || currentActivity == "ON_FOOT"

            // 3. Speed check: Abaikan jika kecepatan > 20 km/h (Mencegah naik kendaraan)
            if (isMotionDetected && distance > 1.5 && speedKmh < 25) { 
                distanceMeters += distance
                
                // Estimasi: 1 meter = 1.33 langkah
                val estimatedSteps = distance * 1.33
                val msEarned = estimatedSteps * (secPerStep * 1000.0)
                earnedMs += msEarned
                
                Log.d("DetoxMove_Walking", "Distance: $distanceMeters m, Earned: ${earnedMs/60000} min (Speed: $speedKmh km/h)")
            } else {
                if (!isMotionDetected) {
                    Log.d("DetoxMove_Walking", "Skip: Motion not detected (Activity: $currentActivity)")
                } else if (distance <= 1.5) {
                    Log.d("DetoxMove_Walking", "Skip: Jitter/Too slow (Dist: $distance m)")
                } else if (speedKmh >= 25) {
                    Log.d("DetoxMove_Walking", "Skip: Too fast (Speed: $speedKmh km/h)")
                }
            }
        }
        
        lastLocation = location
        emitUpdate()
    }

    private fun emitUpdate() {
        val params = Arguments.createMap()
        params.putDouble("distance", distanceMeters)
        params.putInt("coins", Math.floor(earnedMs / 60000.0).toInt())
        params.putString("activity", currentActivity)
        params.putDouble("lat", lastLocation?.latitude ?: 0.0)
        params.putDouble("lng", lastLocation?.longitude ?: 0.0)

        reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("onWalkingStatsUpdate", params)
    }

    fun getIsTracking(): Boolean = isTracking

    fun getStats(): WritableMap {
        val params = Arguments.createMap()
        params.putDouble("distance", distanceMeters)
        params.putInt("coins", Math.floor(earnedMs / 60000.0).toInt())
        params.putString("activity", currentActivity)
        return params
    }
}
