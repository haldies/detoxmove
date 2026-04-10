package com.detoxmove

import android.app.ActivityManager
import android.content.Context
import android.util.Log
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import android.graphics.Bitmap
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat

/** Struktur data universal untuk koordinat tubuh */
data class PoseLandmark(val x: Float, val y: Float, val z: Float = 0f, val visibility: Float = 1.0f)

object PoseLandmarkerManager {
    private var helper: PoseLandmarkerHelper? = null
    private var isInitializing = false
    private val TAG = "DetoxMove_Debug"
    private var cameraProvider: ProcessCameraProvider? = null
    private var currentModelPath: String = "pose_landmarker_lite.task"

    // --- HYBRID AUTO-SELECT MODEL (Teknik Pushscroll) ---
    // Cek RAM device, pilih model yang pas agar tidak OOM & FPS tetap tinggi
    fun autoSelectModel(context: Context): String {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val memInfo = ActivityManager.MemoryInfo()
        am.getMemoryInfo(memInfo)
        val totalRamGb = memInfo.totalMem / (1024.0 * 1024.0 * 1024.0)

        // Cek apakah model Full tersedia di assets
        val fullModelAvailable = try {
            context.assets.open("pose_landmarker_full.task").close()
            true
        } catch (e: Exception) { false }

        val selected = when {
            // RAM ≥ 4GB DAN model Full ada → pakai Full untuk akurasi terbaik
            totalRamGb >= 4.0 && fullModelAvailable -> "pose_landmarker_full.task"
            // Selain itu → pakai Lite agar FPS tetap 60+ (termasuk Xiaomi/Oppo RAM 3GB)
            else -> "pose_landmarker_lite.task"
        }

        Log.i(TAG, "🤖 HybridModel: RAM=${String.format("%.1f", totalRamGb)}GB → $selected")
        return selected
    }

    fun setModel(modelName: String) {
        currentModelPath = modelName
        release()
    }

    // Panggil ini di splash/app start untuk set model secara otomatis
    fun initModel(context: Context) {
        currentModelPath = autoSelectModel(context)
    }

    fun getMode(): String = "MEDIAPIPE"
    fun getCurrentModelPath(): String = currentModelPath

    // Pre-warm kamera secepat mungkin ✨
    fun prewarm(context: Context) {
        if (cameraProvider == null) {
            val future = ProcessCameraProvider.getInstance(context)
            future.addListener({
                try { cameraProvider = future.get() } catch (e: Exception) {}
            }, ContextCompat.getMainExecutor(context))
        }
    }

    fun getCameraProvider(): ProcessCameraProvider? = cameraProvider

    fun getHelper(
        context: Context,
        listener: (PoseLandmarkerResult) -> Unit,
        onReady: () -> Unit
    ): PoseLandmarkerHelper {
        if (helper == null) {
            isInitializing = true
            Log.d(TAG, "PoseLandmarkerManager: Initializing NEW instance → $currentModelPath")

            // --- GPU with AUTO CPU FALLBACK ---
            // Coba GPU dulu. Jika GPU gagal (driver error), onReady tidak akan dipanggil
            // sehingga kita coba ulang dengan CPU. Ini mencegah layar stuck selamanya.
            var gpuFailed = false
            helper = PoseLandmarkerHelper(
                context = context.applicationContext,
                modelAssetPath = currentModelPath,
                useGpu = true, // selalu coba GPU dulu
                resultListener = listener,
                onReady = {
                    isInitializing = false
                    Log.i(TAG, "✅ PoseLandmarker READY (GPU) → $currentModelPath")
                    onReady()
                },
                onError = { errorMsg ->
                    Log.w(TAG, "⚠️ GPU failed: $errorMsg → Fallback ke CPU...")
                    gpuFailed = true
                    helper = null
                    // Fallback: buat ulang dengan CPU
                    helper = PoseLandmarkerHelper(
                        context = context.applicationContext,
                        modelAssetPath = currentModelPath,
                        useGpu = false, // CPU fallback
                        resultListener = listener,
                        onReady = {
                            isInitializing = false
                            Log.i(TAG, "✅ PoseLandmarker READY (CPU Fallback) → $currentModelPath")
                            onReady()
                        },
                        onError = { cpuError ->
                            isInitializing = false
                            Log.e(TAG, "❌ CPU Fallback juga gagal: $cpuError")
                            // Tetap panggil onReady agar UI tidak stuck selamanya
                            onReady()
                        }
                    )
                }
            )
        } else {
            Log.d(TAG, "PoseLandmarkerManager: Using CACHED instance → $currentModelPath")
            helper?.let {
                it.resultListener = listener
                onReady()
            }
        }
        return helper!!
    }

    fun release() {
        Log.d(TAG, "PoseLandmarkerManager: Releasing cache...")
        helper?.isClose()
        helper = null
    }
}
