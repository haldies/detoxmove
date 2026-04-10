package com.detoxmove

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.toMutableList().apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          add(UsagePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    
    // --- INISIALISASI HYBRID AI MODEL (RAM & ASSETS CHECK) --- ✨
    PoseLandmarkerManager.initModel(this)
  }
}
