package com.detoxmove

import android.content.Context
import android.graphics.Color
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.DefaultLifecycleObserver
import com.facebook.react.bridge.ReactContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.Arguments
import com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarkerResult
import java.util.concurrent.Executors

class NativeCameraView(context: Context) : FrameLayout(context) {

    private val previewView: PreviewView = PreviewView(context)
    private val overlayView: SkeletonOverlayView = SkeletonOverlayView(context)
    private var isBound = false
    private var pushUpCounter = PushUpCounter()
    private var squatCounter = SquatCounter()
    private var jumpingJackCounter = JumpingJackCounter()
    private var workoutMode = "PUSHUP" 
    private var poseHelper: PoseLandmarkerHelper? = null
    
    // Background Processor (PENTING: Jangan ganggu UI Thread!)
    private var cameraExecutor = Executors.newSingleThreadExecutor()
    private var counterExecutor = Executors.newSingleThreadExecutor()

    private var lastEmittedCount = 0
    private var lastFpsUpdateTime = 0L
    private var frameCount = 0
    private var currentFps = 0
    
    @Volatile private var lastAiFrameTime = 0L
    private val AI_THROTTLE_MS = 15L // Target 60 FPS kencang
    private var lastEmittedStatus = true
    private var lastStatusEmitTime = 0L
    private val STATUS_EMIT_THROTTLE_MS = 500L // 2x per detik cukup buat warning

    private val AI_INPUT_SIZE = PoseConfig.AI_INPUT_SIZE
    private lateinit var loadingText: android.widget.TextView
    private lateinit var benchmarkText: android.widget.TextView

    init {
        val layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
        previewView.layoutParams = layoutParams
        overlayView.layoutParams = layoutParams
        
        previewView.implementationMode = PreviewView.ImplementationMode.COMPATIBLE
        previewView.scaleType = PreviewView.ScaleType.FIT_CENTER
        previewView.setBackgroundColor(Color.BLACK)
        
        addView(previewView)
        addView(overlayView)

        // Loading Overlay
        loadingText = android.widget.TextView(context).apply {
            text = "PREPARING AI..."
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.parseColor("#90000000"))
            setPadding(40, 20, 40, 20)
            gravity = android.view.Gravity.CENTER
        }
        addView(loadingText, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { gravity = android.view.Gravity.CENTER })

        // Stats (FPS)
        benchmarkText = android.widget.TextView(context).apply {
            setTextColor(Color.parseColor("#34d399")) // Emerald Green
            setBackgroundColor(Color.parseColor("#aa000000"))
            setPadding(20, 10, 20, 10)
            textSize = 9f
            visibility = GONE
        }
        addView(benchmarkText, LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT).apply { 
            gravity = android.view.Gravity.TOP or android.view.Gravity.START
            setMargins(30, 40, 0, 0)
        })
        
        PoseLandmarkerManager.prewarm(context)
    }

    class SkeletonOverlayView(context: Context) : View(context) {
        private var smoothedPoints: List<PointF> = emptyList()
        private var scale = 1f
        private var offsetX = 0f
        private var offsetY = 0f
        private var statusColor = Color.parseColor("#34d399") // Default: Emerald Green ✨

        data class PointF(val x: Float, val y: Float, val score: Float = 1.0f)

        private val pointPaint = android.graphics.Paint().apply {
            color = Color.WHITE
            style = android.graphics.Paint.Style.FILL
            isAntiAlias = true
        }

        private val linePaint = android.graphics.Paint().apply {
            color = Color.parseColor("#34d399")
            style = android.graphics.Paint.Style.STROKE
            strokeWidth = 8f 
            isAntiAlias = true
            strokeCap = android.graphics.Paint.Cap.ROUND
        }

        // Definisi Koneksi Sendi (Skeleton) ala MediaPipe Pro 🦴
        private val POSE_CONNECTIONS = listOf(
            Pair(11, 12), Pair(11, 13), Pair(13, 15), // Bahu Kiri ke Pergelangan
            Pair(12, 14), Pair(14, 16),               // Bahu Kanan ke Pergelangan
            Pair(11, 23), Pair(12, 24), Pair(23, 24), // Badan (Torso Box)
            Pair(23, 25), Pair(25, 27), Pair(27, 29), Pair(27, 31), // Kaki Kiri
            Pair(24, 26), Pair(26, 28), Pair(28, 30), Pair(28, 32)  // Kaki Kanan
        )

        fun setResults(newPoints: List<PointF>, isError: Boolean = false) {
            smoothedPoints = newPoints
            statusColor = if (isError) Color.parseColor("#ef4444") else Color.parseColor("#34d399") // Red vs Green
            linePaint.color = statusColor
            invalidate()
        }

        override fun onSizeChanged(w: Int, h: Int, oldw: Int, oldh: Int) {
            super.onSizeChanged(w, h, oldw, oldh)
            scale = w.toFloat()
            offsetY = (h.toFloat() - w.toFloat()) / 2f
        }

        override fun onDraw(canvas: android.graphics.Canvas) {
            super.onDraw(canvas)
            if (smoothedPoints.size < 33) return

            // 1. Gambar Garis Penghubung (Skeleton Lines) dengan Glow Effect 🦴
            for (conn in POSE_CONNECTIONS) {
                val p1 = smoothedPoints[conn.first]
                val p2 = smoothedPoints[conn.second]
                if (p1.score > 0.45f && p2.score > 0.45f) {
                    canvas.drawLine(
                        p1.x * scale, p1.y * scale + offsetY,
                        p2.x * scale, p2.y * scale + offsetY,
                        linePaint
                    )
                }
            }

            // 2. Gambar Titik Sendi (Joint Dots) ⚪
            for (i in 11 until smoothedPoints.size) {
                val mark = smoothedPoints[i]
                if (mark.score > 0.35f) {
                    pointPaint.color = Color.WHITE
                    canvas.drawCircle(mark.x * scale, mark.y * scale + offsetY, 7f, pointPaint)
                }
            }
        }
    }

    fun startCamera() {
        if (isBound) return
        val currentActivity = (context as? ReactContext)?.currentActivity
        val lifecycleOwner = currentActivity as? LifecycleOwner ?: return

        val cameraProvider = PoseLandmarkerManager.getCameraProvider() ?: return

        try {
            val preview = Preview.Builder().build().also {
                it.setSurfaceProvider(previewView.surfaceProvider)
            }
            
            // OPTIMASI: Turunkan resolusi kamera ke minimum (AI cuma butuh 128px)
            val analysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                .setTargetResolution(android.util.Size(240, 320)) // << SUPER LIGHT
                .build()
            
            poseHelper = PoseLandmarkerManager.getHelper(context, { result: PoseLandmarkerResult ->
                frameCount++
                val points = ArrayList<SkeletonOverlayView.PointF>(33)
                val landmarks = result.landmarks()
                if (landmarks != null && landmarks.isNotEmpty()) {
                    for (lm in landmarks[0]) {
                        points.add(SkeletonOverlayView.PointF(lm.x(), lm.y(), lm.presence().orElse(0.5f)))
                    }
                }

                // PINDAHKAN LOGIKA HITUNG KE BACKGROUND EXECUTOR ✨
                counterExecutor.execute {
                    if (points.isNotEmpty()) {
                        val (count, isCorrect) = updateCounters(points)
                        
                        // Hanya gambar ke UI jika data valid
                        post {
                            overlayView.setResults(points, !isCorrect) // !isCorrect = trigger RED color
                            if (loadingText.visibility == VISIBLE) {
                                loadingText.visibility = GONE
                                benchmarkText.visibility = VISIBLE
                            }
                            updateBenchmarkUI()
                            
                            // Emit Pose Status (Warning Full Body) ✨
                            val now = System.currentTimeMillis()
                            if (now - lastStatusEmitTime > STATUS_EMIT_THROTTLE_MS || isCorrect != lastEmittedStatus) {
                                lastStatusEmitTime = now
                                lastEmittedStatus = isCorrect
                                sendPoseStatus(isCorrect)
                            }
                        }
                    }
                }
            }, {
                Log.d("DetoxMove", "Engine Ready")
            })

            analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                try {
                    val now = System.currentTimeMillis()
                    if (now - lastAiFrameTime < AI_THROTTLE_MS) return@setAnalyzer
                    lastAiFrameTime = now

                    // Konversi super cepat (Object pooled)
                    val bitmap = imageProxy.toSquareBitmap(AI_INPUT_SIZE)
                    poseHelper?.detectLiveStream(bitmap, imageProxy.imageInfo.timestamp / 1_000_000, 0)
                } finally {
                    imageProxy.close()
                }
            }

            cameraProvider.unbindAll()
            cameraProvider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_FRONT_CAMERA, preview, analysis)
            isBound = true
        } catch (e: Exception) {
            Log.e("DetoxMove", "Start Fail: ${e.message}")
        }
    }

    private fun updateCounters(points: List<SkeletonOverlayView.PointF>): Pair<Int, Boolean> {
        if (points.size < 25) return Pair(lastEmittedCount, false)
        val pLms = points.map { PoseLandmark(it.x, it.y, 0f, it.score) }
        
        val isCorrect = when (workoutMode) {
            "PUSHUP" -> pushUpCounter.isPoseCorrect(pLms)
            "SQUAT" -> squatCounter.isPoseCorrect(pLms)
            "JUMPINGJACK" -> jumpingJackCounter.isPoseCorrect(pLms)
            else -> true
        }

        val count = when (workoutMode) {
            "PUSHUP" -> { pushUpCounter.processLandmarks(pLms); pushUpCounter.getCount() }
            "SQUAT" -> { squatCounter.processLandmarks(pLms); squatCounter.getCount() }
            "JUMPINGJACK" -> { jumpingJackCounter.processLandmarks(pLms); jumpingJackCounter.getCount() }
            else -> 0
        }

        if (count != lastEmittedCount) {
            lastEmittedCount = count
            val reactContext = context as? ReactContext ?: return Pair(count, isCorrect)
            val params = Arguments.createMap()
            params.putInt("count", count)
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit("onCountUpdate", params)
        }
        return Pair(count, isCorrect)
    }

    private fun updateBenchmarkUI() {
        val nowMs = System.currentTimeMillis()
        if (nowMs - lastFpsUpdateTime > 1000) {
            currentFps = frameCount
            frameCount = 0
            lastFpsUpdateTime = nowMs
            benchmarkText.text = "PRO ENGINE | $currentFps FPS | GPU ACCELERATED"
        }
    }

    private val rawBitmapPool = ThreadLocal<android.graphics.Bitmap>()
    private val outBitmapPool = ThreadLocal<android.graphics.Bitmap>()
    private val canvasPool = ThreadLocal<android.graphics.Canvas>()
    private val matrixPool = ThreadLocal<android.graphics.Matrix>()

    private fun ImageProxy.toSquareBitmap(targetSize: Int): android.graphics.Bitmap {
        val plane = planes[0]
        val rawWidth = plane.rowStride / plane.pixelStride
        var rBmp = rawBitmapPool.get()
        if (rBmp == null || rBmp.width != rawWidth || rBmp.height != height) {
            rBmp = android.graphics.Bitmap.createBitmap(rawWidth, height, android.graphics.Bitmap.Config.ARGB_8888)
            rawBitmapPool.set(rBmp)
        }
        rBmp.copyPixelsFromBuffer(plane.buffer); plane.buffer.rewind()

        var oBmp = outBitmapPool.get()
        var cvs = canvasPool.get()
        if (oBmp == null || oBmp.width != targetSize) {
            oBmp = android.graphics.Bitmap.createBitmap(targetSize, targetSize, android.graphics.Bitmap.Config.ARGB_8888)
            cvs = android.graphics.Canvas(oBmp)
            outBitmapPool.set(oBmp); canvasPool.set(cvs)
        }

        val mtx = matrixPool.get() ?: android.graphics.Matrix().also { matrixPool.set(it) }
        mtx.reset()
        val crop = Math.min(width, height).toFloat()
        mtx.postTranslate(-rawWidth / 2f, -height / 2f)
        mtx.postRotate(imageInfo.rotationDegrees.toFloat())
        mtx.postScale(-1f, 1f) // Mirror
        val s = targetSize / crop
        mtx.postScale(s, s)
        mtx.postTranslate(targetSize / 2f, targetSize / 2f)
        
        cvs!!.drawColor(Color.BLACK)
        cvs.drawBitmap(rBmp, mtx, null)
        return oBmp!!
    }

    fun setWorkoutMode(mode: String) { workoutMode = mode; resetCounter() }
    fun resetCounter() { pushUpCounter.resetCount(); squatCounter.resetCount(); jumpingJackCounter.resetCount(); lastEmittedCount = 0; sendCountUpdate(0) }
    
    // --- Compatibility Setters for React Native ---
    fun setThresholdDown(v: Double) { pushUpCounter.setThresholdDown(v) }
    fun setThresholdUp(v: Double) { pushUpCounter.setThresholdUp(v) }
    fun setMaxVerticalDiff(v: Double) { pushUpCounter.setMaxVerticalDiff(v) }

    private fun sendCountUpdate(c: Int) {
        (context as? ReactContext)?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)?.emit("onCountUpdate", Arguments.createMap().apply { putInt("count", c) })
    }

    private fun sendPoseStatus(isCorrect: Boolean) {
        val params = Arguments.createMap()
        params.putBoolean("isPoseCorrect", isCorrect)
        (context as? ReactContext)?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)?.emit("onPoseStatus", params)
    }

    private fun releaseResources() {
        if (!isBound) return
        try {
            ProcessCameraProvider.getInstance(context).get().unbindAll()
            cameraExecutor.shutdownNow(); counterExecutor.shutdownNow()
            cameraExecutor = Executors.newSingleThreadExecutor()
            counterExecutor = Executors.newSingleThreadExecutor()
            isBound = false
        } catch (e: Exception) {}
    }

    override fun requestLayout() { super.requestLayout(); post { measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY)); layout(left, top, right, bottom) } }
    override fun onAttachedToWindow() { super.onAttachedToWindow(); postDelayed({ startCamera() }, 50) }
    override fun onDetachedFromWindow() { super.onDetachedFromWindow(); releaseResources() }
}
