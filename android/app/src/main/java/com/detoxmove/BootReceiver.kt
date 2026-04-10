package com.detoxmove

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * BootReceiver - Auto-start DetoxForegroundService saat device boot.
 * User tidak perlu buka app dulu untuk aktifkan monitoring.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {

            Log.d("DetoxMove_Debug", "BootReceiver: Device booted, checking if monitoring was active...")

            // Cek apakah user sudah aktifkan monitoring sebelum device mati
            val sharedPref = context.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
            val wasMonitoring = sharedPref.getBoolean("IS_MONITORING_ACTIVE", false)

            if (wasMonitoring) {
                Log.d("DetoxMove_Debug", "BootReceiver: Auto-starting foreground service on boot ✅")
                val serviceIntent = Intent(context, DetoxForegroundService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            } else {
                Log.d("DetoxMove_Debug", "BootReceiver: Monitoring was OFF, skipping auto-start.")
            }
        }
    }
}
