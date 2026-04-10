package com.detoxmove

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.WritableMap
import java.util.Calendar
import java.util.Date
import java.text.SimpleDateFormat
import java.util.Locale

class DetoxForegroundService : Service() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var windowOverlay: DetoxWindowOverlay
    private var isMonitoring = false
    private var lastRestrictedAppSeenTime: Long = 0
    private var lastRestrictedAppTime: Long = 0
    private var lastApp: String? = null
    private val checkInterval = 1000L
    private val DISMISS_THRESHOLD = 2
    private lateinit var sharedPref: SharedPreferences

    private val checkRunnable = object : Runnable {
        override fun run() {
            if (isMonitoring) {
                checkForegroundApp()
            }
            handler.postDelayed(this, checkInterval)
        }
    }

    override fun onCreate() {
        super.onCreate()
        sharedPref = getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
        createNotificationChannel()
        windowOverlay = DetoxWindowOverlay(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d("DetoxMove_Debug", "DetoxForegroundService: onStartCommand called.")
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("DetoxMove Active")
            .setContentText("Monitoring addictive apps to protect your focus.")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build()

        // Best Practice: Specify service type for Android 14+ (API 34)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(1, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
        } else {
            startForeground(1, notification)
        }

        isMonitoring = true
        handler.removeCallbacks(checkRunnable)
        handler.post(checkRunnable)

        return START_STICKY
    }

    private var dismissCounter = 0
    private var lastNotifiedDistance = 0.0
    private var lastNotificationUpdateTime = 0L
    private val NOTIFICATION_UPDATE_INTERVAL_MS = 10000L // 10 seconds
    private val DISTANCE_THRESHOLD_METERS = 10.0

    private fun checkForegroundApp() {
        val nowLog = System.currentTimeMillis()
        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        if (!powerManager.isInteractive) return

        val isServiceActive = sharedPref.getBoolean("IS_MONITORING_ACTIVE", false)
        if (!isServiceActive) {
            if (windowOverlay.isShowing()) windowOverlay.dismiss()
            if (nowLog % 60000 < 1000) Log.d("DetoxMove_Debug", "Monitoring inactive (IS_MONITORING_ACTIVE=false)")
            return
        }

        val restrictedApps = sharedPref.getStringSet("RESTRICTED_APPS", emptySet()) ?: emptySet()
        if (restrictedApps.isEmpty()) {
            if (windowOverlay.isShowing()) windowOverlay.dismiss()
            if (nowLog % 60000 < 1000) Log.d("DetoxMove_Debug", "Monitoring inactive (restrictedApps is empty)")
            return
        }

        // 1. SMART DETECTION: Jika deteksi sistem sedang delay (null), pakai data terakhir
        val detectedApp = getForegroundPackageName()
        val currentApp = detectedApp ?: lastApp ?: return
        
        lastApp = currentApp
        val isRestrictedApp = restrictedApps.contains(currentApp)
        
        // --- 2. GRACE PERIOD & SAFE APP LOGIC ---
        val now = System.currentTimeMillis()
        
        val isSafeApp = currentApp == packageName || 
                        currentApp == "com.android.settings" || 
                        currentApp.contains("launcher") == true ||
                        currentApp == "com.miui.securitycenter" ||
                        currentApp == "com.android.systemui"

        if (isSafeApp) {
            lastRestrictedAppSeenTime = 0
        } else if (isRestrictedApp) {
            lastRestrictedAppSeenTime = now
        }
        
        // Masa tenggang 2 detik hanya berlaku jika aplikasi baru TIDAK terpantau sebagai aplikasi aman.
        val isRestrictedAppEffective = isRestrictedApp || (now - lastRestrictedAppSeenTime < 2000)
        
        // --- 3. TOTAL BALANCE CALCULATION ---
        val purchasedMs = sharedPref.getLong("RULE_PURCHASED_MS", 0L)
        val baseQuotaMins = sharedPref.getInt("RULE_BASE_QUOTA_MINS", 0)
        val todayStr = SimpleDateFormat("yyyyMMdd", Locale.getDefault()).format(Date())
        val lastUsageDate = sharedPref.getString("LAST_USAGE_DATE", "")
        
        if (lastUsageDate != todayStr) {
            sharedPref.edit()
                .putString("LAST_USAGE_DATE", todayStr)
                .putLong("DAILY_USED_MS", 0L)
                .apply()
        }
        
        val dailyUsedMs = sharedPref.getLong("DAILY_USED_MS", 0L)
        val baseMs = baseQuotaMins * 60000L
        var currentBalanceMs = (baseMs - dailyUsedMs) + purchasedMs
        if (currentBalanceMs < 0) currentBalanceMs = 0

        // --- 4. REAL-TIME DEDUCTION LOGIC ---
        if (isRestrictedAppEffective && currentBalanceMs > 0) {
            val newUsedMs = dailyUsedMs + checkInterval
            val editor = sharedPref.edit()
            if (newUsedMs > baseMs) {
                val overflow = newUsedMs - baseMs
                val newPurchased = Math.max(0, purchasedMs - overflow)
                editor.putLong("RULE_PURCHASED_MS", newPurchased)
                editor.putLong("DAILY_USED_MS", baseMs)
            } else {
                editor.putLong("DAILY_USED_MS", newUsedMs)
            }
            editor.apply()
            currentBalanceMs -= checkInterval
        }

        // VIOLATION: Jika saldo waktu sudah benar-benar habis (0)
        val isViolation = currentBalanceMs <= 0 && isRestrictedAppEffective

        // Logging: Hanya log jika aplikasi BERUBAH atau setiap 5 detik (agar logcat rapi)
        if (currentApp != lastApp || nowLog - lastRestrictedAppTime > 5000) {
            lastRestrictedAppTime = nowLog
            lastApp = currentApp
            Log.d("DetoxMove_Debug", "Balance: ${currentBalanceMs / 60000}m ${ (currentBalanceMs % 60000) / 1000 }s | App: $currentApp | Violation: $isViolation")
        }

        // --- 5. WALKING SESSION NOTIFICATION UPDATE ---
        if (WalkingSessionManager.getIsTracking()) {
            val stats = WalkingSessionManager.getStats()
            val currentDistance = stats.getDouble("distance")
            val now = System.currentTimeMillis()

            if (now - lastNotificationUpdateTime >= NOTIFICATION_UPDATE_INTERVAL_MS || 
                Math.abs(currentDistance - lastNotifiedDistance) >= DISTANCE_THRESHOLD_METERS) {
                
                updateWalkingNotification(stats)
                lastNotifiedDistance = currentDistance
                lastNotificationUpdateTime = now
            }
        }

        // --- 6. OVERLAY CONTROL LOGIC ---
        if (isViolation) {
            dismissCounter = 0 
            if (!windowOverlay.isShowing()) {
                windowOverlay.show(currentApp)
            }
        } else {
            // Jika di aplikasi AMAN (Home/Launcher), langsung tutup (UX Responsif)
            if (isSafeApp) {
                dismissCounter = 0
                if (windowOverlay.isShowing()) windowOverlay.dismiss()
            } 
            // Jika bukan aplikasi dibatasi atau saldo tersedia, gunakan threshold (Stabilitas)
            else if (!isRestrictedAppEffective || !isViolation) {
                dismissCounter++
                if (dismissCounter >= DISMISS_THRESHOLD) {
                    if (windowOverlay.isShowing()) windowOverlay.dismiss()
                }
            }
        }
    }

    private fun updateWalkingNotification(stats: WritableMap) {
        val distText = String.format("%.2f KM", stats.getDouble("distance") / 1000.0)
        val coins = stats.getInt("coins")
        
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("DetoxMove Tracking")
            .setContentText("Jarak: $distText | +$coins Menit Bebas")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true) // Prevent sound/vibration on updates to stay smooth
            .build()

        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.notify(1, notification)
    }

    private fun getTotalUsageForApps(packageNames: Set<String>): Long {
        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val now = System.currentTimeMillis()
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        calendar.set(Calendar.MILLISECOND, 0)
        val startOfDay = calendar.timeInMillis

        val stats = usageStatsManager.queryUsageStats(UsageStatsManager.INTERVAL_DAILY, startOfDay, now)
        var totalMs = 0L
        stats?.forEach {
            if (packageNames.contains(it.packageName)) {
                totalMs += it.totalTimeInForeground
            }
        }
        return totalMs
    }

    private fun getForegroundPackageName(): String? {
        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val endTime = System.currentTimeMillis()
        
        // 1. CARA UTAMA: Pindai 60 detik terakhir (Lebih lama agar tidak sering null)
        val usageEvents = usageStatsManager.queryEvents(endTime - 60000, endTime)
        val event = android.app.usage.UsageEvents.Event()
        var lastPkg: String? = null

        while (usageEvents.hasNextEvent()) {
            usageEvents.getNextEvent(event)
            // EventType 1 = Move to Foreground, 31 = Task Stack Changed (beberapa Android)
            if (event.eventType == 1 || event.eventType == 31) {
                lastPkg = event.packageName
            }
        }
        
        // Jika scan ringan gagal (tidak ada event baru), kita biarkan return null
        // agar pemanggil fungsi menggunakan 'lastApp' yang lama. 
        // Ini jauh lebih stabil daripada menebak-nebak dengan queryUsageStats.
        return lastPkg
    }

    override fun onDestroy() {
        super.onDestroy()
        isMonitoring = false
        handler.removeCallbacks(checkRunnable)
        if (::windowOverlay.isInitialized) {
            windowOverlay.dismiss()
        }
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "DetoxMove Tracker Service",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager: NotificationManager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(serviceChannel)
        }
    }

    companion object {
        const val CHANNEL_ID = "DetoxMoveForegroundServiceChannel"
    }
}
