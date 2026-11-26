# LokiChart

Aplikasi charting untuk analisa pasar (web, ramah tablet/HP) dengan data candle dari **OANDA** dan **FOREX.com**, plus lebih dari 55 alat gambar.

## Menjalankan

Butuh Node.js 18+. Tanpa dependensi tambahan.

```bash
cp .env.example .env    # isi kredensial broker
npm start               # buka http://localhost:3000
```

Jika kredensial belum diisi, server memakai **data demo sintetis** (badge oranye "DATA DEMO" di kanan atas) agar aplikasi tetap bisa dicoba. Data demo **bukan** harga pasar asli. Setelah kredensial diisi, badge berubah menjadi "● LIVE".

## Sumber data

| Broker | API | Yang perlu diisi di `.env` |
|---|---|---|
| OANDA | v20 REST (`/v3/instruments/{inst}/candles`) | `OANDA_API_KEY`, `OANDA_ENV` (`practice`/`live`) |
| FOREX.com | GAIN Capital Trading API (`/session`, `/market/search`, `/market/{id}/barhistory`) | `FOREXCOM_USERNAME`, `FOREXCOM_PASSWORD`, `FOREXCOM_APPKEY`, opsional `FOREXCOM_BASE_URL`, `FOREXCOM_MARKET_IDS` |

- Kredensial hanya disimpan di server; browser tidak pernah melihatnya.
- Token OANDA dibuat di portal akun OANDA (Manage API Access).
- Akses API FOREX.com (AppKey) harus diminta ke FOREX.com. Jika pencarian market otomatis tidak menemukan instrumen, isi `FOREXCOM_MARKET_IDS`, mis. `{"XAUUSD":401153869}`.
- Timeframe: 1m, 3m, 5m, 15m, 30m, 1j, 2j, 4j, 1H, 1M. (3m diagregasi dari 1m.)
- Daftar simbol ada di `server/symbols.js`; tambahkan simbol baru di sana.

## Fitur

- Chart candle / candle kosong / Heikin Ashi / bar / garis / area, volume, SMA 20, EMA 50, EMA 200, Bollinger Bands
- Geser, zoom (scroll, pinch, seret sumbu harga/waktu), klik ganda sumbu untuk reset, crosshair, legenda OHLC, hitung mundur penutupan bar
- Update harga otomatis setiap 2 detik
- Daftar pantau + ringkasan (penutupan sebelumnya, buka, rentang hari), pencarian simbol per broker/kategori
- Undo/redo, tema terang/gelap, simpan gambar PNG, layar penuh
- Gambar disimpan otomatis per simbol (localStorage)

### Alat gambar (panel "Gambar")

- **Peralatan:** Pengukuran, Penghapus, Tetap menggambar, Sembunyikan gambar, Kunci seluruh gambar, Magnet (mati/lemah/kuat), Hapus gambar, Perbesar (seret area), Perkecil
- **Peralatan Tren:** Garis Tren, Sinar, Garis Info, Garis Perpanjangan, Sudut Tren, Garis Horizontal, Sinar Horizontal, Garis Vertikal, Garis Persilangan, Kanal Paralel, Tren Regresi, Puncak/Dasar Datar, Kanal Disjoin, Pitchfork, Schiff Pitchfork, Pitchfork Schiff Termodifikasi, Pitchfork Dalam
- **Gann dan Fibonacci:** Fib Retracement, Fib Ekstensi Berbasis Tren, Fib Kanal, Fib Zona Waktu, Fib Kipas Resisten Kecepatan, Fib Waktu Berbasis Tren, Fib Lingkaran, Fib Spiral, Fib Busur Resisten Kecepatan, Fib Baji, Pitchfan, Kotak Gann, Kotak Gann Paten, Persegi Gann, Kipas Gann
- **Motif:** XABCD, Cypher, Head dan Shoulder, ABCD, Segitiga, Three Drives, Gelombang Elliott (Impulse, Koreksi, Segitiga, Kombo Dobel, Kombo Tripel), Garis Siklus, Siklus Waktu, Garis Sinus
- **Proyeksi dan Pengukuran:** Posisi Long/Short (dengan R:R), Rentang Harga, Rentang Tanggal, Rentang Tanggal dan Harga
- **Bentuk dan Teks:** Persegi Panjang, Elips, Panah, Teks, Catatan
- Favorit (★), pencarian alat, bar gaya untuk gambar terpilih (warna, ketebalan, gaya garis, perpanjang, kunci, duplikat, hapus)

### Cara menggambar

Pilih alat, lalu ketuk titik-titiknya di chart (jumlah titik muncul di notifikasi). Alat 2 titik juga bisa dibuat dengan menyeret. Ketuk gambar untuk memilih; seret titik biru untuk mengubah, seret badan gambar untuk memindahkan.

Pintasan: `Alt+T` garis tren, `Alt+H` garis horizontal, `Alt+F` Fib retracement, `Delete` hapus gambar terpilih, `Esc` batal, `Ctrl+Z`/`Ctrl+Y` undo/redo, ketik huruf apa saja untuk mencari simbol.

## Struktur

```
server/server.js         HTTP server + API (/api/candles, /api/symbols, /api/status)
server/providers/        oanda.js, forexcom.js, demo.js
server/symbols.js        daftar simbol & pemetaan ke kode broker
public/js/chart.js       mesin chart (canvas)
public/js/tools.js       definisi semua alat gambar
public/js/geo.js         primitif gambar (render + hit-test)
public/js/app.js         antarmuka
```
