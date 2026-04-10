package com.detoxmove

import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.util.Log
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import android.view.KeyEvent

/**
 * DetoxWindowOverlay - Menampilkan popup langsung lewat WindowManager.
 * Teknik ini bekerja 100% dari background tanpa perlu foreground activity.
 * Syarat: izin SYSTEM_ALERT_WINDOW (Display Over Other Apps) sudah di-grant.
 */
class DetoxWindowOverlay(private val context: Context) {

    private val windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    private var overlayView: View? = null

    fun show(blockedPackage: String) {
        if (overlayView != null) {
            Log.d("DetoxMove_Debug", "WindowOverlay: already showing, skip.")
            return
        }

        try {
            val inflater = LayoutInflater.from(context)
            val view = inflater.inflate(R.layout.overlay_detox_window, null)

            val packageManager = context.packageManager
            val appInfo = try {
                packageManager.getApplicationInfo(blockedPackage, 0)
            } catch (e: Exception) {
                null
            }
            val appLabel = appInfo?.let { packageManager.getApplicationLabel(it).toString() } ?: "Aplikasi ini"

            view.findViewById<TextView>(R.id.overlayAppName).text = "$appLabel dibatasi"
            view.findViewById<TextView>(R.id.overlayBody).text =
                "Waktu penggunaan $appLabel hari ini sudah habis. Luangkan waktu untuk berolahraga agar bisa kembali menggunakannya."

            view.findViewById<Button>(R.id.btnOpenApp)?.setOnClickListener {
                Toast.makeText(context, "Membuka menu olahraga...", Toast.LENGTH_SHORT).show()
                dismiss() 
                val pkg = context.packageName
                val launchIntent = context.packageManager.getLaunchIntentForPackage(pkg)
                launchIntent?.putExtra("INITIAL_ROUTE", "WorkoutList")
                launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                context.startActivity(launchIntent)
            }

            view.findViewById<Button>(R.id.btnCancel)?.setOnClickListener {
                dismiss()
                val homeIntent = Intent(Intent.ACTION_MAIN)
                homeIntent.addCategory(Intent.CATEGORY_HOME)
                homeIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                context.startActivity(homeIntent)
            }

            val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }

            val params = WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                type,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                WindowManager.LayoutParams.FLAG_FULLSCREEN or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                PixelFormat.TRANSLUCENT
            )
            // Hilangkan animasi (Agar tidak ada kedipan transisi saat re-show)
            params.windowAnimations = 0
            params.gravity = Gravity.TOP or Gravity.START
            
            // Atur agar overlay SELALU di depan dan menangkap input
            params.format = PixelFormat.TRANSLUCENT
            params.x = 0
            params.y = 0

            // Handle Back Button di Overlay View
            view.isFocusableInTouchMode = true
            view.requestFocus()
            view.setOnKeyListener { v, keyCode, event ->
                if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_HOME) {
                    // Paksa ke Home (Minimalkan app terlarang) tapi biarkan overlay stay
                    val homeIntent = Intent(Intent.ACTION_MAIN)
                    homeIntent.addCategory(Intent.CATEGORY_HOME)
                    homeIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    context.startActivity(homeIntent)
                    true
                } else false
            }

            windowManager.addView(view, params)
            overlayView = view
            Log.d("DetoxMove_Debug", "WindowOverlay: SHOWN for $blockedPackage ✅")
        } catch (e: Exception) {
            Log.e("DetoxMove_Debug", "WindowOverlay: Failed to show - ${e.message}")
        }
    }

    fun dismiss() {
        try {
            overlayView?.let {
                windowManager.removeView(it)
                overlayView = null
                Log.d("DetoxMove_Debug", "WindowOverlay: DISMISSED ✅")
            }
        } catch (e: Exception) {
            Log.e("DetoxMove_Debug", "WindowOverlay: Error dismissing - ${e.message}")
        }
    }

    fun isShowing() = overlayView != null
}
