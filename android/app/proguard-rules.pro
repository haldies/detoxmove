# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# 1. FIX: Missing Java Annotation Classes (AutoValue/JavaPoet)
-dontwarn javax.lang.model.**
-dontwarn com.google.auto.value.**
-dontwarn autovalue.shaded.**

# 2. MEDIAPIPE: Protection & AI Engine logic
# Memastikan library AI tidak dihapus atau di-rename (PENTING untuk JNI/Native).
-keep class com.google.mediapipe.** { *; }
-keep enum com.google.mediapipe.** { *; }
-keep interface com.google.mediapipe.** { *; }
-keep class com.google.android.libraries.mediapipe.** { *; }
-dontwarn com.google.mediapipe.**

# 3. PROTOCOL BUFFERS: Internal Communication
# MediaPipe menggunakan Protobuf secara internal.
-keep class com.google.protobuf.** { *; }
-dontwarn com.google.protobuf.**

# 4. GOOGLE PLAY SERVICES: Core Dependencies
# Dibutuhkan oleh MediaPipe untuk Task management & Vision.
-keep class com.google.android.gms.tasks.** { *; }
-keep class com.google.android.gms.common.** { *; }

# 5. ANDROIDX CAMERAX: Camera Logic
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# 6. GOOGLE PLAY SERVICES: Location & Activity
-keep class com.google.android.gms.location.** { *; }
-keep interface com.google.android.gms.location.** { *; }

# 7. APP NATIVE MODULES: DetoxMove classes
-keep class com.detoxmove.** { *; }
-keep class com.oblador.vectoricons.** { *; }

# 8. HAPUS SEMUA LOG DEBUG di Release Build
# R8 akan menghapus baris-baris Log.d/v dari bytecode final (zero runtime overhead)
-assumenosideeffects class android.util.Log {
    public static int d(...);
    public static int v(...);
    public static boolean isLoggable(...);
}
