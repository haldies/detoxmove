package com.detoxmove

import android.content.Intent
import android.content.ComponentName
import android.net.Uri
import com.facebook.react.bridge.*

class DetoxIntentModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "DetoxIntent"
    }

    @ReactMethod
    fun openSettings(action: String, packageName: String?, promise: Promise) {
        try {
            val intent = Intent(action)
            if (packageName != null) {
                intent.data = Uri.parse("package:$packageName")
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun openComponent(packageName: String, className: String, promise: Promise) {
         try {
            val intent = Intent()
            intent.component = ComponentName(packageName, className)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun openMiuiPermissions(appPackageName: String, promise: Promise) {
        try {
            // Coba buka MIUI Permission Editor langsung untuk app ini
            val intent = Intent("miui.intent.action.APP_PERM_EDITOR")
            intent.setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity")
            intent.putExtra("extra_pkgname", appPackageName)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            // Fallback: buka halaman App Info biasa
            try {
                val fallback = Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
                fallback.data = android.net.Uri.parse("package:$appPackageName")
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(fallback)
                promise.resolve(true)
            } catch (e2: Exception) {
                promise.reject("ERROR", e2.message)
            }
        }
    }
}
