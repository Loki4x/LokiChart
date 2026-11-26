# LokiChart

Aplikasi charting untuk analisa pasar — **aplikasi Android (APK)** dan versi web — dengan data candle dari **OANDA** dan **FOREX.com**, plus 76 alat gambar dan 16 indikator.

## Aplikasi Android (APK)

APK di-build otomatis oleh **GitHub Actions** (`.github/workflows/android.yml`) setiap ada push ke `main`.

**Mengunduh APK:** buka halaman **Releases** repo ini dan unduh `LokiChart-vX.Y.Z.apk`.
Build dari setiap push ke `main` juga tersedia di tab **Actions** → *Build APK Android* → **Artifacts** (zip).

**Rilis otomatis:** setiap push ke `main` otomatis membuat rilis baru di **Releases** dengan versi yang naik sendiri
(`v1.0.0` → `v1.0.1` → `v1.0.2` …), lengkap dengan daftar perubahan dan file APK.

- Untuk menaikkan versi minor/mayor (mis. ke `1.1.0` atau `2.0.0`), ubah `"version"` di `package.json`; rilis berikutnya memakai versi itu lalu lanjut naik dari sana.
- Bisa juga manual: tab **Actions** → *Build APK Android* → **Run workflow** → isi *Versi rilis*.

Nomor versi dipakai sebagai `versionName` APK, dan `versionCode` naik otomatis sehingga APK baru bisa meng-update yang lama.

**Kredensial broker** diisi di dalam aplikasi: ketuk ikon ⚙ (atau badge "DATA DEMO") → isi token OANDA dan/atau akun FOREX.com → *Simpan & uji koneksi*.
Kredensial disimpan hanya di HP dan aplikasi menghubungi OANDA/FOREX.com secara langsung — tidak perlu server.

> Kredensial broker sengaja **tidak** dimasukkan ke GitHub Secrets/APK: repo ini public, sehingga APK bisa diunduh siapa saja dan isi APK dapat dibongkar.

### Kunci tanda tangan APK (WAJIB agar update tidak perlu uninstall)

Android hanya mau meng-update aplikasi bila APK baru ditandatangani dengan kunci yang **sama**.
Cara termudah (bisa dari HP): di GitHub buka **Settings → Secrets and variables → Actions → New repository secret**:

| Nama | Isi |
|---|---|
| `SIGNING_PASSPHRASE` | kata sandi panjang buatan Anda (minimal 12 karakter, disarankan 20+). **Simpan baik-baik dan jangan diganti.** |

Workflow menurunkan kunci tanda tangan yang selalu sama dari kata sandi itu (`.github/scripts/derive_keystore.py`).
Tanpa secret ini, setiap rilis memakai kunci acak sehingga update harus uninstall dulu.

Alternatif bagi yang sudah punya keystore sendiri: isi `ANDROID_KEYSTORE_BASE64` (isi `base64 -w0 file.keystore`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

Sebelum uninstall, gunakan **Menu → Cadangkan data** lalu **Pulihkan data** setelah install ulang agar gambar, indikator, alarm, dan daftar pantau tidak hilang.

### Build APK di komputer sendiri (opsional)

Butuh Node 22+, JDK 21, dan Android SDK.

```bash
npm install
npx cap add android
npm run android:build
```

## Versi web (dengan server)

Butuh Node.js 22+.

```bash
cp .env.example .env    # isi kredensial broker
npm start               # buka http://localhost:3000
```

Pada versi web, kredensial diatur di `.env` server (browser tidak bisa memanggil API broker langsung karena CORS).

Jika kredensial belum diisi, aplikasi memakai **data demo sintetis** (badge oranye "DATA DEMO") agar tetap bisa dicoba. Data demo **bukan** harga pasar asli. Setelah kredensial diisi, badge berubah menjadi "● LIVE".

## Sumber data

| Broker | API | Yang perlu diisi (web: `.env`) |
|---|---|---|
| OANDA | v20 REST (`/v3/instruments/{inst}/candles`) | `OANDA_API_KEY`, `OANDA_ENV` (`practice`/`live`) — di Android: layar Pengaturan |
| FOREX.com | GAIN Capital Trading API (`/session`, `/market/search`, `/market/{id}/barhistory`) | `FOREXCOM_USERNAME`, `FOREXCOM_PASSWORD`, `FOREXCOM_APPKEY`, opsional `FOREXCOM_BASE_URL`, `FOREXCOM_MARKET_IDS` |

- Token OANDA dibuat di portal akun OANDA (Manage API Access).
- Akses API FOREX.com (AppKey) harus diminta ke FOREX.com. Jika pencarian market otomatis tidak menemukan instrumen, isi `FOREXCOM_MARKET_IDS`, mis. `{"XAUUSD":401153869}`.
- Timeframe: 1m, 3m, 5m, 15m, 30m, 1j, 2j, 4j, 1H, 1M. (3m diagregasi dari 1m.)
- Daftar simbol ada di `public/js/data/symbols.js`; tambahkan simbol baru di sana.

## Fitur

- **Navigasi seperti aplikasi charting mobile:** Daftar Pantau · Chart · Jelajahi · Menu
- **Daftar Pantau:** harga & perubahan, ikhtisar simbol (grafik 1H–Seluruh, perubahan hari ini & sepanjang data, poin data penting, rentang 52 minggu, **musiman**, meter **Teknikal** Jual kuat–Beli kuat), tombol *Buka chart*
- **Chart:** candle / candle kosong / Heikin Ashi / bar / garis / area; toolbar bawah (simbol, interval, Gambar, Indikator, Layout, Peringatan, Jenis chart, Replay, Pohon objek, Pusat analisis, Undo/Redo, Layar penuh, Bagikan)
- **Pengaturan chart/simbol:** warna badan/batas/sumbu naik-turun, warnai berdasarkan penutupan sebelumnya, latar, grid, garis harga, hitung mundur, legenda OHLC (ketuk nama simbol di chart)
- **Layout:** 1, 2, 3, 4, 6, 8 chart (beberapa susunan) dengan **sinkronisasi** simbol, interval, crosshair, dan waktu
- **Indikator, metrik dan strategi:** Favorit, Template indikator, kategori Tren/Osilator/Volume/Volatilitas — 16 indikator yang bisa diatur:
  Volume, SMA, EMA, WMA, Bollinger Bands, VWAP, Ichimoku, Supertrend, Pivot Points, **Struktur Pasar & Order Block** (HH/HL/LH/LL, BOS, CHoCH), RSI, MACD, Stochastic, ATR, CCI, OBV, ADX/DMI
- **Peringatan:** panel Daftar & Log; harga (melintasi / ke atas / ke bawah / di atas / di bawah) **dan peringatan pada garis gambar** (garis tren, sinar, garis horizontal, dll.); sekali atau berulang; notifikasi + bunyi + getar. Diperiksa selama aplikasi terbuka.
- **Replay bar:** saat memilih titik awal, bar setelahnya tampak pudar; putar/jeda, maju per bar, kecepatan 1x–25x
- **Pusat analisis:** setup/simpan/buka layout, buat baru, pengaturan chart, detail simbol, teknikal
- **Jelajahi:** kenaikan & penurunan terbesar, paling volatil, peta panas (per broker & kategori)
- **Menu:** akun broker, tema, layar tetap menyala, **cadangkan & pulihkan data**, bilah alat gambar di kiri (opsional), notifikasi, hapus data, versi aplikasi
- **Gambar terpilih** menampilkan toolbar mengambang (bisa digeser): template, warna garis + opasitas, warna & ukuran teks, ketebalan, gaya garis, **pengaturan**, tambah peringatan, kunci, sembunyikan, hapus, lainnya (klon, urutan depan/belakang)
- **Dialog pengaturan gambar:** tab **Corak** (warna/gaya/tebal garis, ujung panah kiri/kanan, perpanjang, titik tengah, label harga, statistik + posisi + selalu tampilkan, latar belakang, level Fibonacci), **Teks** (isi, warna, ukuran, tebal/miring, posisi), **Koordinat** (harga & waktu tiap titik), **Visibilitas** (per timeframe), **Template** (simpan, jadikan default, reset)

### Alat gambar (panel "Gambar")

- **Peralatan:** Pengukuran, Penghapus, **Penggaris sudut** (garis menempel ke kelipatan 15°: 0°, 15°, 30°, 45°, 90°…, juga ada di toolbar gambar terpilih), Tetap menggambar, Sembunyikan (gambar/indikator/semua), Kunci seluruh gambar, Magnet (mati/lemah/kuat), Hapus (gambar/indikator/semua), Perbesar (seret area), Perkecil
- **Peralatan Tren:** Garis Tren, Sinar, Garis Info, Garis Perpanjangan, Sudut Tren, Garis Horizontal, Sinar Horizontal, Garis Vertikal, Garis Persilangan, Kanal Paralel, Tren Regresi, Puncak/Dasar Datar, Kanal Disjoin, Pitchfork, Schiff Pitchfork, Pitchfork Schiff Termodifikasi, Pitchfork Dalam
- **Gann dan Fibonacci:** Fib Retracement, Fib Ekstensi Berbasis Tren, Fib Kanal, Fib Zona Waktu, Fib Kipas Resisten Kecepatan, Fib Waktu Berbasis Tren, Fib Lingkaran, Fib Spiral, Fib Busur Resisten Kecepatan, Fib Baji, Pitchfan, Kotak Gann, Kotak Gann Paten, Persegi Gann, Kipas Gann
- **Motif:** XABCD, Cypher, Head dan Shoulder, ABCD, Segitiga, Three Drives, Gelombang Elliott (Impulse, Koreksi, Segitiga, Kombo Dobel, Kombo Tripel), Garis Siklus, Siklus Waktu, Garis Sinus
- **Proyeksi dan Pengukuran:** Posisi Long/Short (dengan R:R), Rentang Harga, Rentang Tanggal, Rentang Tanggal dan Harga
- **Berbasis Volume:** VWAP Berjangkar, Profil Volume Rentang Tetap (POC + value area 70%)
- **Kuas:** Kuas, Stabilo
- **Teks dan Catatan:** Teks, Catatan, Label Harga, Catatan Harga, Bendera, Penanda, Komentar, Penanda Panah Naik/Turun
- **Bentuk:** Persegi Panjang, Persegi Diputar, Lingkaran, Elips, Segitiga, Busur, Kurva, Kurva Ganda, Jalur, Polyline, Panah
- Favorit (★), pencarian alat, bar gaya untuk gambar terpilih (warna, ketebalan, gaya garis, perpanjang, kunci, duplikat, hapus)

### Cara menggambar

Pilih alat, lalu ketuk titik-titiknya di chart (jumlah titik muncul di notifikasi). Alat 2 titik juga bisa dibuat dengan menyeret. Kuas/Stabilo: seret jari. Jalur/Polyline: ketuk titik-titik, lalu ketuk titik terakhir sekali lagi untuk selesai. Ketuk gambar untuk memilih; seret titik biru untuk mengubah, seret badan gambar untuk memindahkan.

Pintasan: `Alt+T` garis tren, `Alt+H` garis horizontal, `Alt+F` Fib retracement, `Alt+A` alarm baru, `→` maju 1 bar saat replay, `Delete` hapus gambar terpilih, `Esc` batal, `Ctrl+Z`/`Ctrl+Y` undo/redo, ketik huruf apa saja untuk mencari simbol.

## Struktur

```
server/server.js         HTTP server + API untuk versi web
public/js/data/          koneksi broker (oanda.js, forexcom.js, demo.js) & daftar simbol — dipakai server dan aplikasi Android
public/js/datasource.js  pilih sumber data: server (web) atau langsung (Android)
capacitor.config.json    konfigurasi aplikasi Android (Capacitor)
.github/workflows/       build APK otomatis
public/js/chart.js       mesin chart (canvas)
public/js/tools.js       definisi semua alat gambar
public/js/geo.js         primitif gambar (render + hit-test)
public/js/app.js         antarmuka
public/js/indicators.js  indikator teknikal
public/js/overview.js    panel ikhtisar simbol
public/js/native.js      notifikasi, bunyi, bagikan (Android/web)
```
