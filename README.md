# DetoxMove

**Kurangi scrolling, tambah gerak.**

DetoxMove adalah aplikasi **digital detox berbasis AI untuk Android** yang membantu pengguna mengurangi waktu bermain media sosial dengan menukarnya menjadi aktivitas fisik.

Pengguna melakukan push-up, lalu aplikasi menghitung repetisi secara otomatis menggunakan teknologi pelacakan pose berbasis **MediaPipe dari Google**. Setiap **1 repetisi push-up memberikan 5 menit waktu akses** untuk aplikasi pilihan, seperti TikTok. Dengan begitu, pengguna bisa menikmati media sosial setelah bergerak dan berolahraga.

## Fitur Utama

- **Push-up counter berbasis AI** — menghitung repetisi secara otomatis melalui deteksi pose.
- **Tukar gerakan dengan waktu layar** — setiap 1 repetisi push-up memberi 5 menit akses.
- **Digital detox** — membantu membangun kebiasaan penggunaan media sosial yang lebih seimbang.
- **Fokus Android** — proyek ini ditujukan untuk Android, termasuk kode native Android yang diperlukan.

## Cara Kerja

1. Pilih aplikasi media sosial yang ingin dibatasi.
2. Lakukan push-up di depan kamera sesuai petunjuk aplikasi.
3. MediaPipe membantu mendeteksi pose dan menghitung repetisi.
4. Dapatkan 5 menit waktu akses untuk setiap repetisi yang terhitung.
5. Gunakan waktu akses tersebut untuk aplikasi pilihan.

## Teknologi

- [React Native](https://reactnative.dev/) — antarmuka aplikasi.
- [React Native Community CLI](https://github.com/react-native-community/cli) — tooling proyek React Native.
- [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) — teknologi deteksi pose untuk mendukung penghitungan gerakan.
- Android native — integrasi dan kapabilitas khusus Android.

## Persyaratan

Sebelum menjalankan proyek, siapkan lingkungan pengembangan Android sesuai panduan resmi [React Native: Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment), termasuk Node.js, Android Studio, Android SDK, dan perangkat Android atau emulator.

## Menjalankan Proyek

Instal dependency dari direktori root proyek:

```sh
npm install
```

Jalankan Metro:

```sh
npm start
```

Buka terminal kedua di direktori root proyek, lalu jalankan aplikasi pada perangkat atau emulator Android:

```sh
npm run android
```

> Jika PowerShell di Windows memblokir `npm.ps1`, gunakan `npm.cmd install`, `npm.cmd start`, atau `npm.cmd run android`.

## Struktur Proyek

```text
DetoxMove/
├── android/       # Proyek native Android
├── scripts/       # Skrip bantu proyek
├── App.tsx        # Entry point aplikasi (jika digunakan)
├── package.json   # Dependency dan perintah npm
└── README.md
```

Struktur aktual dapat berbeda mengikuti implementasi proyek.

## Status Pengembangan

DetoxMove dikembangkan sebagai aplikasi Android. Ketersediaan fitur, kompatibilitas perangkat, dan integrasi pembatasan aplikasi bergantung pada implementasi serta izin Android yang diperlukan.

**Catatan:** Penghitungan pose berbasis kamera dapat dipengaruhi pencahayaan, posisi kamera, dan visibilitas tubuh. Gunakan aplikasi sebagai alat bantu kebugaran, bukan sebagai pengganti saran profesional.

## Kontribusi

Kontribusi dan saran sangat diterima. Silakan buat issue untuk melaporkan bug atau mengusulkan peningkatan, atau kirim pull request.

## Lisensi

Tambahkan informasi lisensi proyek di sini jika lisensi telah ditentukan.
