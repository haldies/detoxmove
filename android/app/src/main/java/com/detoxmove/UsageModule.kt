package com.detoxmove

import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import com.facebook.react.bridge.*

class UsageModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "UsageModule"
    }

    @ReactMethod
    fun getUsageStats(startTime: Double, endTime: Double, promise: Promise) {
        val context = reactApplicationContext
        val usageStatsManager = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val packageManager = context.packageManager

        // 1. Get ALL usage stats for the interval
        val stats = usageStatsManager.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            startTime.toLong(),
            endTime.toLong()
        )
        val usageMap = stats?.associateBy { it.packageName } ?: emptyMap()

        // 2. Get ALL installed applications (Launcher Apps)
        val intent = android.content.Intent(android.content.Intent.ACTION_MAIN, null)
        intent.addCategory(android.content.Intent.CATEGORY_LAUNCHER)
        val resolveInfos = packageManager.queryIntentActivities(intent, 0)
        
        val resultList = Arguments.createArray()
        val processedPackages = mutableSetOf<String>()

        // Log.d("DetoxMove_Debug", "Starting App Sync... Total Launcher Apps: ${resolveInfos.size}")

        for (info in resolveInfos) {
            val appInfo = info.activityInfo.applicationInfo
            if (processedPackages.contains(appInfo.packageName)) continue
            processedPackages.add(appInfo.packageName)

            // Abaikan aplikasi sistem (pre-installed services) agar daftar tidak terlalu panjang
            val isSystemApp = (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0
            val isUpdatedSystemApp = (appInfo.flags and android.content.pm.ApplicationInfo.FLAG_UPDATED_SYSTEM_APP) != 0
            
            // Allow if it's NOT a system app, OR if it's an updated system app (like heavily used Google Core apps)
            if (isSystemApp && !isUpdatedSystemApp) {
                // Pengecualian: Bolehkan YouTube/Chrome meskipun sistem, hanya jika user minta
                if (!appInfo.packageName.contains("youtube") && !appInfo.packageName.contains("chrome")) {
                    continue
                }
            }

            val map = Arguments.createMap()
            map.putString("packageName", appInfo.packageName)
            map.putString("appName", packageManager.getApplicationLabel(appInfo).toString())
            
            // Get usage from map
            val usage = usageMap[appInfo.packageName]
            map.putDouble("totalTimeInForeground", (usage?.totalTimeInForeground ?: 0L).toDouble())
            map.putDouble("lastTimeUsed", (usage?.lastTimeUsed ?: 0L).toDouble())

            // Add Categories (Android 8.0+)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                val cat = when(appInfo.category) {
                    android.content.pm.ApplicationInfo.CATEGORY_SOCIAL -> "Social"
                    android.content.pm.ApplicationInfo.CATEGORY_GAME -> "Games"
                    android.content.pm.ApplicationInfo.CATEGORY_VIDEO -> "Video"
                    android.content.pm.ApplicationInfo.CATEGORY_AUDIO -> "Audio"
                    android.content.pm.ApplicationInfo.CATEGORY_PRODUCTIVITY -> "Productivity"
                    android.content.pm.ApplicationInfo.CATEGORY_MAPS -> "Maps"
                    android.content.pm.ApplicationInfo.CATEGORY_NEWS -> "News"
                    else -> "Others"
                }
                map.putString("category", cat)
            } else {
                map.putString("category", "Others")
            }
            
            resultList.pushMap(map)
        }
        
        promise.resolve(resultList)
    }
}
