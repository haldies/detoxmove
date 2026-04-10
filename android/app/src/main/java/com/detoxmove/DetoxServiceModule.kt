package com.detoxmove

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ApplicationInfo
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*
import com.google.android.gms.location.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.os.Looper
import android.os.Handler
import android.app.AppOpsManager
import android.provider.Settings
import android.os.PowerManager
import android.os.Process
import androidx.core.app.NotificationManagerCompat

class DetoxServiceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val activityClient = ActivityRecognition.getClient(reactContext)
    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(reactContext)
    
    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            
            // --- HUBUNGKAN KE NATIVE MANAGER (100% ACCURACY) ---
            WalkingSessionManager.updateLocation(location)

            val params = Arguments.createMap()
            params.putDouble("latitude", location.latitude)
            params.putDouble("longitude", location.longitude)
            params.putDouble("speed", location.speed.toDouble())
            params.putDouble("timestamp", location.time.toDouble())
            
            reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("onLocationUpdate", params)
        }
    }
    
    init {
        ActivityRecognitionReceiver.setReactContext(reactContext)
        WalkingSessionManager.init(reactContext)
    }

    override fun getName(): String {
        return "DetoxService"
    }

    @ReactMethod
    fun addListener(eventName: String) { }

    @ReactMethod
    fun removeListeners(count: Int) { }

    @ReactMethod
    fun startTrackingActivity(intervalMs: Int, promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, ActivityRecognitionReceiver::class.java)
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            
            val pendingIntent = PendingIntent.getBroadcast(reactApplicationContext, 0, intent, flags)
            activityClient.requestActivityUpdates(intervalMs.toLong(), pendingIntent)
                .addOnSuccessListener {
                    promise.resolve(true)
                }
                .addOnFailureListener { e ->
                    promise.reject("ERROR", e.message)
                }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopTrackingActivity(promise: Promise) {
        try {
            val intent = Intent(reactApplicationContext, ActivityRecognitionReceiver::class.java)
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pendingIntent = PendingIntent.getBroadcast(reactApplicationContext, 0, intent, flags)
            activityClient.removeActivityUpdates(pendingIntent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun isMonitoringActive(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
        promise.resolve(sharedPref.getBoolean("IS_MONITORING_ACTIVE", false))
    }

    @ReactMethod
    fun startForegroundService(promise: Promise) {
        try {
            val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
            with(sharedPref.edit()) {
                putBoolean("IS_MONITORING_ACTIVE", true)
                apply()
            }
            val intent = Intent(reactApplicationContext, DetoxForegroundService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopForegroundService(promise: Promise) {
        try {
            val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
            with(sharedPref.edit()) {
                putBoolean("IS_MONITORING_ACTIVE", false)
                apply()
            }
            val intent = Intent(reactApplicationContext, DetoxForegroundService::class.java)
            reactApplicationContext.stopService(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun updateExerciseProgress(steps: Int, pushups: Int, promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putInt("CURRENT_STEPS", steps)
            putInt("CURRENT_PUSHUPS", pushups)
            apply()
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun setModel(modelName: String, promise: Promise) {
        // Beritahu Manager untuk ganti kuncian model
        PoseLandmarkerManager.setModel(modelName)
        Log.d("DetoxMove_Debug", "AI Engine Switched to: $modelName")
        promise.resolve(true)
    }

    @ReactMethod
    fun setRules(baseQuotaMins: Int, dailyMaxMins: Int, promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putInt("RULE_BASE_QUOTA_MINS", baseQuotaMins)
            putInt("RULE_DAILY_MAX_MINS", dailyMaxMins)
            apply()
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun hasFinishedOnboarding(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
        promise.resolve(sharedPref.getBoolean("ONBOARDING_FINISHED", false))
    }

    @ReactMethod
    fun setFinishedOnboarding(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putBoolean("ONBOARDING_FINISHED", true)
            apply()
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun setInitialUsage(hours: Float, promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putFloat("INITIAL_USAGE_HOURS", hours)
            apply()
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun getInitialUsage(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
        promise.resolve(sharedPref.getFloat("INITIAL_USAGE_HOURS", 0f).toDouble())
    }

    @ReactMethod
    fun prepareAI() {
        // --- PRE-WARM SEKALIGUS (AI & KAMERA) ---
        PoseLandmarkerManager.prewarm(reactApplicationContext)

        val mode = PoseLandmarkerManager.getMode()
        if (mode == "MOVENET") {
            // Kita biarkan manager yang menangani prewarm MoveNet
            Log.d("DetoxMove_Debug", "MoveNet Engine Pre-warming initiated...")
        } else {
            // MediaPipe Pre-load
            PoseLandmarkerManager.getHelper(reactApplicationContext, listener = {}, onReady = {
                reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit("onModelReady", Arguments.createMap())
                Log.d("DetoxMove_Debug", "MediaPipe Model PRE-LOADED successfully ✓")
            })
        }
    }

    @ReactMethod
    fun setRates(secPerStep: Float, minPerPushup: Float, minPerSquat: Float, minPerJump: Float, promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putFloat("RULE_SEC_PER_STEP", secPerStep)
            putFloat("RULE_MIN_PER_PUSHUP", minPerPushup)
            putFloat("RULE_MIN_PER_SQUAT", minPerSquat)
            putFloat("RULE_MIN_PER_JUMP", minPerJump)
            apply()
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun buyTime(mins: Double, promise: Promise) {
        try {
            val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
            val currentMs = sharedPref.getLong("RULE_PURCHASED_MS", 0L)
            
            // Konversi ke Milliseconds (mins * 60000)
            val addedMs = (mins * 60000.0).toLong()
            val newTotal = currentMs + addedMs
            
            // Update TODAY'S date string so the service doesn't reset it
            val todayStr = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.getDefault()).format(java.util.Date())
            
            sharedPref.edit()
                .putLong("RULE_PURCHASED_MS", newTotal)
                .putString("LAST_BUY_RESET", todayStr)
                .apply()
            
            Log.d("DetoxMove_Debug", "buyTime: Added $mins mins ($addedMs ms). Total Balance: ${newTotal / 60000}m")
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getRules(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
        val map = Arguments.createMap()
        map.putInt("baseQuotaMins", sharedPref.getInt("RULE_BASE_QUOTA_MINS", 0))
        map.putInt("dailyMaxMins", sharedPref.getInt("RULE_DAILY_MAX_MINS", 60))
        map.putDouble("secPerStep", sharedPref.getFloat("RULE_SEC_PER_STEP", 0.5f).toDouble())
        map.putDouble("minPerPushup", sharedPref.getFloat("RULE_MIN_PER_PUSHUP", 1.0f).toDouble())
        map.putDouble("minPerSquat", sharedPref.getFloat("RULE_MIN_PER_SQUAT", 1.0f).toDouble())
        map.putDouble("minPerJump", sharedPref.getFloat("RULE_MIN_PER_JUMP", 1.0f).toDouble())
        promise.resolve(map)
    }

    @ReactMethod
    fun getPurchasedTime(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
        promise.resolve(sharedPref.getLong("RULE_PURCHASED_MS", 0L).toDouble())
    }

    @ReactMethod
    fun getBalance(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
        
        val purchasedMs = sharedPref.getLong("RULE_PURCHASED_MS", 0L)
        val baseQuotaMins = sharedPref.getInt("RULE_BASE_QUOTA_MINS", 0)
        val dailyUsedMs = sharedPref.getLong("DAILY_USED_MS", 0L)
        val baseMs = baseQuotaMins * 60000L
        
        // Cek apakah sudah ganti hari (Sama seperti di Service)
        val todayStr = java.text.SimpleDateFormat("yyyyMMdd", java.util.Locale.getDefault()).format(java.util.Date())
        val lastUsageDate = sharedPref.getString("LAST_USAGE_DATE", "")
        
        var effectiveBalanceMs: Long
        if (lastUsageDate != todayStr) {
            effectiveBalanceMs = baseMs + purchasedMs
        } else {
            effectiveBalanceMs = (baseMs - dailyUsedMs) + purchasedMs
        }
        
        if (effectiveBalanceMs < 0) effectiveBalanceMs = 0
        
        promise.resolve(effectiveBalanceMs.toDouble())
    }

    @ReactMethod
    fun checkAllPermissions(promise: Promise) {
        val context = reactApplicationContext
        val map = Arguments.createMap()
        
        // 1. Usage Stats
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
        }
        map.putBoolean("usageStats", mode == AppOpsManager.MODE_ALLOWED)
        
        // 2. Overlay
        map.putBoolean("overlay", Settings.canDrawOverlays(context))
        
        // 3. Battery Optimization
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        map.putBoolean("batteryOptimization", powerManager.isIgnoringBatteryOptimizations(context.packageName))
        
        // 4. Background Popup (Simplified for General Android)
        // Note: For MIUI special, it might still return true but be blocked, but this is a start
        map.putBoolean("backgroundPopup", true) 
        
        promise.resolve(map)
    }

    @ReactMethod
    fun getInitialRoute(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        val route = activity?.intent?.getStringExtra("INITIAL_ROUTE")
        activity?.intent?.removeExtra("INITIAL_ROUTE")
        promise.resolve(route ?: "Dashboard")
    }

    @ReactMethod
    fun triggerTestBlock(promise: Promise) {
        try {
            Handler(Looper.getMainLooper()).post {
                val overlay = DetoxWindowOverlay(reactApplicationContext)
                overlay.show("com.detoxmove.test")
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun startWalkingSession(promise: Promise) {
        try {
            val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
            val secPerStep = sharedPref.getFloat("RULE_SEC_PER_STEP", 0.5f)
            
            // 1. Start Native Tracking Engine
            WalkingSessionManager.startSession(secPerStep)

            // 2. Start Activity Recognition (CRITICAL: Often forgotten in JS)
            try {
                val activityIntent = Intent(reactApplicationContext, ActivityRecognitionReceiver::class.java)
                val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
                } else {
                    PendingIntent.FLAG_UPDATE_CURRENT
                }
                val activityPendingIntent = PendingIntent.getBroadcast(reactApplicationContext, 0, activityIntent, flags)
                activityClient.requestActivityUpdates(3000L, activityPendingIntent)
                    .addOnFailureListener { e -> Log.e("DetoxMove", "Activity Tracking failed: ${e.message}") }
                
                Log.d("DetoxMove", "Activity Tracking started automatically for session.")
            } catch (e: Exception) {
                Log.e("DetoxMove", "Could not start activity tracking: ${e.message}")
            }

            // 3. Start Location Updates
            val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5000L)
                .setMinUpdateIntervalMillis(2000L)
                .build()
            
            if (androidx.core.app.ActivityCompat.checkSelfPermission(reactApplicationContext, android.Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERM_DENIED", "GPS permission not granted")
                return
            }
            
            fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback, Looper.getMainLooper())
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopWalkingSession(promise: Promise) {
        try {
            // Stop Location
            fusedLocationClient.removeLocationUpdates(locationCallback)
            
            // Stop Activity Updates
            val activityIntent = Intent(reactApplicationContext, ActivityRecognitionReceiver::class.java)
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val activityPendingIntent = PendingIntent.getBroadcast(reactApplicationContext, 0, activityIntent, flags)
            activityClient.removeActivityUpdates(activityPendingIntent)

            // Get result
            val result = WalkingSessionManager.stopSession()
            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun setRestrictedApps(apps: ReadableArray, promise: Promise) {
        try {
            val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
            val appSet = mutableSetOf<String>()
            for (i in 0 until apps.size()) {
                apps.getString(i)?.let { appSet.add(it) }
            }
            with(sharedPref.edit()) {
                putStringSet("RESTRICTED_APPS", appSet)
                apply()
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getRestrictedApps(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("DetoxSettings", Context.MODE_PRIVATE)
        val apps = sharedPref.getStringSet("RESTRICTED_APPS", emptySet())
        val result = Arguments.createArray()
        apps?.forEach { result.pushString(it) }
        promise.resolve(result)
    }

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val packageManager = reactApplicationContext.packageManager
            val intent = android.content.Intent(android.content.Intent.ACTION_MAIN, null)
            intent.addCategory(android.content.Intent.CATEGORY_LAUNCHER)
            val resolveInfos = packageManager.queryIntentActivities(intent, 0)
            
            val resultList = Arguments.createArray()
            val processedPackages = mutableSetOf<String>()

            for (info in resolveInfos) {
                val appInfo = info.activityInfo.applicationInfo
                if (processedPackages.contains(appInfo.packageName)) continue
                processedPackages.add(appInfo.packageName)

                val isSystemApp = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0
                val isUpdatedSystemApp = (appInfo.flags and ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
                
                if (isSystemApp && !isUpdatedSystemApp) {
                    if (!appInfo.packageName.contains("youtube") && !appInfo.packageName.contains("chrome")) {
                        continue
                    }
                }

                val map = Arguments.createMap()
                map.putString("packageName", appInfo.packageName)
                map.putString("appName", packageManager.getApplicationLabel(appInfo).toString())
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val cat = when(appInfo.category) {
                        ApplicationInfo.CATEGORY_SOCIAL -> "Social"
                        ApplicationInfo.CATEGORY_GAME -> "Games"
                        ApplicationInfo.CATEGORY_VIDEO -> "Video"
                        ApplicationInfo.CATEGORY_MAPS -> "Maps"
                        else -> "Others"
                    }
                    map.putString("category", cat)
                } else {
                    map.putString("category", "Others")
                }
                resultList.pushMap(map)
            }
            promise.resolve(resultList)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun getAppIcon(packageName: String, promise: Promise) {
        try {
            val packageManager = reactApplicationContext.packageManager
            val appInfo = packageManager.getApplicationInfo(packageName, 0)
            val iconDrawable = packageManager.getApplicationIcon(appInfo)
            val iconBitmap = android.graphics.Bitmap.createBitmap(iconDrawable.intrinsicWidth, iconDrawable.intrinsicHeight, android.graphics.Bitmap.Config.ARGB_8888)
            val canvas = android.graphics.Canvas(iconBitmap)
            iconDrawable.setBounds(0, 0, canvas.width, canvas.height)
            iconDrawable.draw(canvas)
            val scaledBitmap = android.graphics.Bitmap.createScaledBitmap(iconBitmap, 70, 70, true)
            val outputStream = java.io.ByteArrayOutputStream()
            scaledBitmap.compress(android.graphics.Bitmap.CompressFormat.PNG, 80, outputStream)
            val iconBase64 = android.util.Base64.encodeToString(outputStream.toByteArray(), android.util.Base64.DEFAULT)
            promise.resolve(iconBase64)
        } catch (e: Exception) {
            promise.reject("ICON_ERROR", e.message)
        }
    }

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        val context = reactApplicationContext
        val status = Arguments.createMap()
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as android.app.AppOpsManager
        
        // 1. Usage Stats
        val mode = appOps.checkOpNoThrow("android:get_usage_stats", android.os.Process.myUid(), context.packageName)
        status.putBoolean("usageStats", mode == android.app.AppOpsManager.MODE_ALLOWED)

        // 2. Overlay
        status.putBoolean("overlay", android.provider.Settings.canDrawOverlays(context))

        // 3. Battery Optimization
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
        status.putBoolean("batteryOptimization", powerManager.isIgnoringBatteryOptimizations(context.packageName))

        // 4. Notifications (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val hasNotif = context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            status.putBoolean("notifications", hasNotif)
        } else {
            status.putBoolean("notifications", NotificationManagerCompat.from(context).areNotificationsEnabled())
        }

        // 5. Activity Recognition (Android 10+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val hasActivity = context.checkSelfPermission(android.Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
            status.putBoolean("activityRecognition", hasActivity)
        } else {
            status.putBoolean("activityRecognition", true)
        }

        // 6. Location
        val hasLocation = context.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        status.putBoolean("location", hasLocation)

        // 7. MIUI Background Popup
        var bgPopup = true
        if (Build.MANUFACTURER.equals("xiaomi", ignoreCase = true)) {
            try {
                val method = appOps.javaClass.getMethod("checkOpNoThrow", Int::class.java, Int::class.java, String::class.java)
                val res = method.invoke(appOps, 10021, android.os.Process.myUid(), context.packageName) as Int
                bgPopup = (res == android.app.AppOpsManager.MODE_ALLOWED)
            } catch (e: Exception) { }
        }
        status.putBoolean("backgroundPopup", bgPopup)

        promise.resolve(status)
    }

    @ReactMethod
    fun requestUsagePermission() {
        try {
            val intent = Intent(android.provider.Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.data = android.net.Uri.parse("package:" + reactApplicationContext.packageName)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            // Some devices don't support the URI, use fallback
            try {
                val fallbackIntent = Intent(android.provider.Settings.ACTION_USAGE_ACCESS_SETTINGS)
                fallbackIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(fallbackIntent)
            } catch (ex: Exception) {
                Log.e("DetoxMove_Debug", "Failed to open usage settings: ${ex.message}")
            }
        }
    }

    @ReactMethod
    fun requestOverlayPermission() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
                intent.data = android.net.Uri.parse("package:" + reactApplicationContext.packageName)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            }
        } catch (e: Exception) {
            Log.e("DetoxMove_Debug", "Failed to open overlay settings")
        }
    }

    @ReactMethod
    fun requestBatteryOptimizationPermission() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Gunakan ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS agar langsung muncul dialog (seamless)
                // karena permission sudah ditambahkan di manifest
                val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
                intent.data = android.net.Uri.parse("package:" + reactApplicationContext.packageName)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            }
        } catch (e: Exception) {
            // Fallback ke settings jika request dialog gagal
            try {
                val intent = Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            } catch (ex: Exception) {
                Log.e("DetoxMove_Debug", "Failed to open battery settings")
            }
        }
    }

    @ReactMethod
    fun requestNotificationPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val activity = reactApplicationContext.currentActivity
                if (activity == null) {
                    promise.reject("ERROR", "Activity is null")
                    return
                }
                androidx.core.app.ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(android.Manifest.permission.POST_NOTIFICATIONS),
                    1001
                )
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun requestBackgroundPopupPermission() {
        try {
            if (Build.MANUFACTURER.equals("xiaomi", ignoreCase = true)) {
                val intent = Intent("miui.intent.action.APP_PERM_EDITOR")
                intent.setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity")
                intent.putExtra("extra_pkgname", reactApplicationContext.packageName)
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            }
        } catch (e: Exception) {
            Log.e("DetoxMove_Debug", "Failed to open MIUI settings", e)
        }
    }

    @ReactMethod
    fun requestBackgroundLocationPermission() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val appIntent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                appIntent.data = android.net.Uri.parse("package:" + reactApplicationContext.packageName)
                appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(appIntent)
            }
        } catch (e: Exception) {
            Log.e("DetoxMove_Debug", "Failed to open background location settings", e)
        }
    }
}
