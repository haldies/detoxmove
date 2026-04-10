package com.detoxmove

/**
 * Otak Pusat Konfigurasi Deteksi Gerakan (Fitness AI Configuration).
 * Di sini kita tentukan titik-titik mana saja yang "Body Only"
 * dan angka threshold untuk masing-masing olahraga. ✨
 */
object PoseConfig {

    // --- PEMETAAN TITIK BADAN LENGKAP (16 Body Points) --- 🦴
    // Kita hilangkan wajah, tapi tambahkan KAKI LENGKAP (Tumit & Jari)
    val BODY_INDICES = listOf(
        11, 12, 13, 14, 15, 16, // Bahu, Sikut, Pergelangan
        23, 24, 25, 26, 27, 28, // Panggul, Lutut, Mata Kaki
        29, 30, 31, 32          // Tumit & Jari Kaki (Penting buat Squat!) ✨
    )

    // --- CONFIG PUSH-UP --- 🤸‍♂️
    object PushUp {
        var thresholdDown = 90.0  // Sedikit lebih ketat (Pushscroll: 85.0)
        var thresholdUp = 165.0   // Tangan benar-benar lurus (Pushscroll standard) ✨
        var maxVerticalDiff = 0.60
        const val visibilityThreshold = 0.5f // JAUH lebih stabil, tidak gampang guncang
    }

    // --- CONFIG SQUAT --- 🦵
    object Squat {
        var thresholdDown = 80.0  // Kedalaman optimal (Pushscroll: 35.0 tapi itu ekstrem)
        var thresholdUp = 160.0   // Berdiri lurus
        const val visibilityThreshold = 0.5f
    }

    // --- CONFIG JUMPING JACK --- 🦟
    object JumpingJack {
        var openWristRatio = 1.2f
        var openAnkleRatio = 1.5f
        var closedAnkleRatio = 1.1f
        const val visibilityThreshold = 0.25f
    }

    // --- PERFORMA (FPS) --- ⚡
    const val AI_INPUT_SIZE = 128      // "RTMPose Speed" - Super kencang 60-70 FPS! 🏎️💨
    const val SMOOTHING_FACTOR = 0.25f // Lebih responsif & detail
}
