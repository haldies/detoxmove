package com.detoxmove

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.location.ActivityRecognitionResult
import com.google.android.gms.location.DetectedActivity

class ActivityRecognitionReceiver : BroadcastReceiver() {

    companion object {
        private var reactContext: ReactApplicationContext? = null

        fun setReactContext(context: ReactApplicationContext) {
            reactContext = context
        }
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (intent != null && ActivityRecognitionResult.hasResult(intent)) {
            val result = ActivityRecognitionResult.extractResult(intent)
            if (result != null) {
                val bestActivity = result.mostProbableActivity
                
                // Best Practice: Hanya tangani jika keyakinan AI di atas 50%
                if (bestActivity.confidence >= 50) {
                    handleActivity(bestActivity)
                } else {
                    Log.d("DetoxMove", "Activity ignored: ${bestActivity.type} (Confidence too low: ${bestActivity.confidence}%)")
                }
            } else {
                Log.d("DetoxMove", "ActivityRecognitionResult extraction failed (null).")
            }
        } else {
            Log.d("DetoxMove", "ActivityRecognitionReceiver: No result in intent.")
        }
    }

    private fun handleActivity(activity: DetectedActivity) {
        val type = when (activity.type) {
            DetectedActivity.WALKING -> "WALKING"
            DetectedActivity.RUNNING -> "RUNNING"
            DetectedActivity.STILL -> "STILL"
            DetectedActivity.ON_BICYCLE -> "ON_BICYCLE"
            DetectedActivity.IN_VEHICLE -> "IN_VEHICLE"
            DetectedActivity.ON_FOOT -> "ON_FOOT"
            else -> "UNKNOWN"
        }

        Log.d("DetoxMove", "Activity Detected: $type (${activity.confidence}%)")
        
        // --- Integrasi Native Walking Session ---
        WalkingSessionManager.updateActivity(type)

        val params = Arguments.createMap()
        params.putString("type", type)
        params.putInt("confidence", activity.confidence)

        reactContext?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("onActivityDetected", params)
    }
}
