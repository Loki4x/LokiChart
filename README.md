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

### Secrets GitHub (opsional, untuk tanda tangan APK)

Tanpa secrets, workflow membuat APK *debug*. Agar APK bertanda tangan tetap (update tanpa uninstall), buat keystore sekali di komputer:

```bash
keytool -genkeypair -v -keystore lokichart.keystore -alias lokichart -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 lokichart.keystore > keystore.txt
```

Lalu di GitHub: **Settings → Secrets and variables → Actions → New repository secret**:

| Nama | Isi |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | isi file `keystore.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | password keystore |
| `ANDROID_KEY_ALIAS` | `lokichart` |
| `ANDROID_KEY_PASSWORD` | password key (boleh sama dengan password keystore) |

Simpan file keystore baik-baik dan jangan di-commit — tanpa file itu, APK baru tidak bisa meng-update yang lama.

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

- **Chart:** candle / candle kosong / Heikin Ashi / bar / garis / area; geser, zoom (scroll, pinch, seret sumbu), crosshair, legenda OHLC, hitung mundur penutupan bar, update harga tiap 2 detik
- **Layout multi-chart:** 1, 2 (berdampingan/bertumpuk), 3, atau 4 chart — tiap chart punya simbol, timeframe, dan indikator sendiri
- **Indikator** (bisa diatur parameternya, ketuk nama indikator di chart untuk mengatur):
  - Di chart utama: Volume, SMA, EMA, WMA, Bollinger Bands, VWAP (reset harian/mingguan/bulanan), Ichimoku Cloud, Supertrend, Pivot Points (Klasik/Fibonacci/Camarilla), **Struktur Pasar & Order Block** (swing HH/HL/LH/LL, BOS, CHoCH, order block dengan kekuatan volume)
  - Pane terpisah: RSI, MACD, Stochastic, ATR, CCI, OBV, ADX/DMI
- **Alarm harga:** melintasi / melintasi ke atas / ke bawah / di atas / di bawah; garis alarm di chart bisa diseret; notifikasi + bunyi + getar (Android: notifikasi sistem). Alarm diperiksa selama aplikasi terbuka.
- **Replay bar:** pilih titik awal, putar/jeda, maju per bar, kecepatan 1x–25x
- **Pohon objek:** daftar indikator, gambar, dan alarm — tampil/sembunyi, kunci, hapus
- **Ikhtisar simbol:** harga, perubahan hari ini & sepanjang data, grafik 1H/5H/1B/3B/YTD/1T/5T/Seluruh, poin data penting (penutupan sebelumnya, buka, rentang hari, rentang 52 minggu), **musiman** (perbandingan 3 tahun terakhir)
- Daftar pantau, pencarian simbol per broker/kategori (65 simbol: forex, logam, energi, pertanian, indeks, kripto), simbol terakhir di toolbar bawah
- Undo/redo, tema terang/gelap, mode fokus/layar penuh, **bagikan gambar chart** (Android: menu bagikan)
- Gambar, indikator, dan alarm tersimpan otomatis di perangkat

### Alat gambar (panel "Gambar")

- **Peralatan:** Pengukuran, Penghapus, Tetap menggambar, Sembunyikan (gambar/indikator/semua), Kunci seluruh gambar, Magnet (mati/lemah/kuat), Hapus (gambar/indikator/semua), Perbesar (seret area), Perkecil
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
