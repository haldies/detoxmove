package com.detoxmove

import android.content.Context
import android.graphics.Bitmap
import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult

class PoseLandmarkerHelper(
    val context: Context,
    var runningMode: RunningMode = RunningMode.LIVE_STREAM,
    var minPoseDetectionConfidence: Float = 0.5f,
    var minPoseTrackingConfidence: Float = 0.8f, // Lock-in tracking agar smooth 🔒
    var minPosePresenceConfidence: Float = 0.5f,
    var modelAssetPath: String = "pose_landmarker_lite.task",
    var useGpu: Boolean = true,               // GPU by default, CPU jika GPU gagal
    var resultListener: ((PoseLandmarkerResult) -> Unit),
    val onReady: () -> Unit,
    val onError: ((String) -> Unit)? = null   // Callback untuk notif GPU/CPU failure
) {
    companion object {
        private const val TAG = "DetoxMove_Debug"

        private fun logD(msg: String) {
            if (BuildConfig.DEBUG) Log.d(TAG, msg)
        }
    }

    private var poseLandmarker: PoseLandmarker? = null

    init {
        setupPoseLandmarker()
    }

    fun setupPoseLandmarker() {
        try {
            context.assets.open(modelAssetPath).close()
        } catch (e: Exception) {
            Log.e(TAG, "CRITICAL: $modelAssetPath NOT FOUND in assets!")
            return
        }

        // Pilih delegate berdasarkan parameter useGpu
        val delegate = if (useGpu) Delegate.GPU else Delegate.CPU
        val baseOptionsBuilder = BaseOptions.builder()
            .setModelAssetPath(modelAssetPath)
            .setDelegate(delegate)

        try {
            val baseOptions = baseOptionsBuilder.build()
            val optionsBuilder = PoseLandmarker.PoseLandmarkerOptions.builder()
                .setBaseOptions(baseOptions)
                .setMinPoseDetectionConfidence(minPoseDetectionConfidence)
                .setMinTrackingConfidence(minPoseTrackingConfidence)
                .setMinPosePresenceConfidence(minPosePresenceConfidence)
                .setNumPoses(1) // Kunci ke 1 orang agar FPS kencang 🏎️
                .setRunningMode(runningMode)

            if (runningMode == RunningMode.LIVE_STREAM) {
                optionsBuilder.setResultListener { result: PoseLandmarkerResult, _: MPImage ->
                    resultListener(result)
                }
            }

            poseLandmarker = PoseLandmarker.createFromOptions(context, optionsBuilder.build())
            
            // Sinyal READY langsung setelah berhasil load ✨
            onReady()
            logD("PoseLandmarker setup OK ✓ | Delegate: ${if (useGpu) "GPU" else "CPU"} | Model: $modelAssetPath")

            // Pre-warm di background setelah UI terbuka
            prewarmData()
        } catch (e: Exception) {
            val msg = e.message ?: "Unknown error"
            Log.e(TAG, "PoseLandmarker setup FAILED [${if (useGpu) "GPU" else "CPU"}]: $msg")
            // Kirim sinyal error ke Manager untuk trigger fallback
            // Jika tidak ada onError handler, fallback ke panggil onReady agar UI tidak stuck
            if (onError != null) {
                onError.invoke(msg)
            } else {
                onReady()
            }
        }
    }

    /** 
     * Memanaskan GPU secepat mungkin menggunakan dummy data. 
     * Sangat krusial agar tidak ada stutter saat kamera pertama kali terbuka. ✨
     */
    private fun prewarmData() {
        if (runningMode != RunningMode.LIVE_STREAM) return
        val landmarker = poseLandmarker ?: return
        try {
            // Gunakan 1x1 Bitmap kecil (lebih aman daripada ByteBuffer kosong di beberapa driver GPU)
            val bitmap = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888)
            val mpImage = BitmapImageBuilder(bitmap).build()
            
            // Jalankan deteksi dummy (Hanya untuk memicu kompilasi kernel GPU)
            // Gunakan uptimeMillis sesuai standar MediaPipe
            val time = android.os.SystemClock.uptimeMillis()
            landmarker.detectAsync(mpImage, time)
            logD("MediaPipe Pre-warm: GPU Kernels Triggered! 🚀")
        } catch (e: Exception) {
            logD("Pre-warm skip: ${e.message}")
        }
    }

    // --- FAST PATH: Langsung dari ByteBuffer, TANPA konversi Bitmap sama sekali ---
    @Synchronized
    fun detectLiveStreamDirect(
        buffer: java.nio.ByteBuffer,
        width: Int,
        height: Int,
        frameTime: Long,
        rotation: Int = 0
    ) {
        if (runningMode != RunningMode.LIVE_STREAM) return
        val currentLandmarker = poseLandmarker ?: return
        try {
            // ByteBufferImageBuilder: MediaPipe baca langsung dari memory camera — 0 copy
            val mpImage = com.google.mediapipe.framework.image.ByteBufferImageBuilder(
                buffer, width, height, MPImage.IMAGE_FORMAT_RGBA
            ).build()
            val opts = com.google.mediapipe.tasks.vision.core.ImageProcessingOptions.builder()
                .setRotationDegrees(rotation)
                .build()
            currentLandmarker.detectAsync(mpImage, opts, frameTime)
        } catch (e: Exception) {
            Log.e(TAG, "detectAsync(ByteBuffer) error: ${e.message}")
        }
    }

    // Fallback: Bitmap path (dipertahankan untuk kompatibilitas)
    @Synchronized
    fun detectLiveStream(bitmap: Bitmap, frameTime: Long, rotation: Int = 0) {
        if (runningMode != RunningMode.LIVE_STREAM) return
        val currentLandmarker = poseLandmarker ?: return
        try {
            val mpImage = BitmapImageBuilder(bitmap).build()
            if (rotation != 0) {
                val opts = com.google.mediapipe.tasks.vision.core.ImageProcessingOptions.builder()
                    .setRotationDegrees(rotation).build()
                currentLandmarker.detectAsync(mpImage, opts, frameTime)
            } else {
                currentLandmarker.detectAsync(mpImage, frameTime)
            }
        } catch (e: Exception) {
            Log.e(TAG, "detectAsync error: ${e.message}")
        }
    }

    @Synchronized
    fun isClose() {
        val lm = poseLandmarker ?: return
        try {
            lm.close()
            logD("PoseLandmarker closed & freed ✓")
        } catch (e: Exception) {
            Log.e(TAG, "Error closing PoseLandmarker: ${e.message}")
        } finally {
            poseLandmarker = null
        }
    }
}
