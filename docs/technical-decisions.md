# Keputusan Teknis

Yii2 disiapkan sebagai API JSON. React mengelola aset antarmuka melalui npm sehingga konfigurasi Composer backend menggunakan `replace` untuk paket Bower. [Panduan instalasi Yii2](https://www.yiiframework.com/doc/guide/2.0/en/start-installation#installing-assets)

## Skenario studi kasus

Keputusan desain akan dicatat di sini saat masing-masing skenario studi kasus dikerjakan.

- Duplikasi pendaftaran dan nomor antrean.
- Konkurensi penyerahan obat dan konsistensi stok.
- Pencatatan pembayaran bertahap dan pencegahan pembayaran ganda.
- Perubahan pemeriksaan setelah tagihan dibuat dan riwayat perubahannya.
- Penanganan gangguan komunikasi antarlayanan.
- Performa kueri basis data dan respons API.
