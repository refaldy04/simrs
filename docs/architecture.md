# Arsitektur SIMRS

React menyediakan antarmuka pelayanan rawat jalan. Yii2 menangani API dan logika bisnis utama SIMRS. Node.js menyediakan API pendukung untuk integrasi laboratorium dan dashboard. PostgreSQL menjadi basis data utama.

Pada lingkungan pengembangan, proxy Vite meneruskan permintaan `/api/core/` ke Yii2 dan `/api/services/` ke Node.js. Kedua layanan terhubung ke PostgreSQL melalui jaringan Docker Compose. Yii2 menggunakan PDO dan Node.js menggunakan pool koneksi `pg`. [Dokumentasi pool pg](https://node-postgres.com/apis/pool)

Yii2 memvalidasi login terhadap akun PostgreSQL dan menentukan izin dari peran akun. Middleware Node.js meneruskan token dan izin yang dibutuhkan ke `GET /auth/access` di Yii2 sebelum melanjutkan permintaan yang dilindungi. [Dokumentasi API](api.md)

Kunjungan menghubungkan pasien dan jadwal poli dengan pemeriksaan, tindakan, resep, pesanan lab, dan tagihan. PostgreSQL menyimpan riwayat transaksi dan menyediakan view `invoice_balances` untuk saldo dan status pembayaran. [ERD SIMRS](erd.png)

## Laboratorium

Yii2 memvalidasi penugasan dokter dan data master lalu mencatat permintaan, snapshot tarif, audit, dan event `lab.order.requested` dalam satu transaksi. Node.js memproses event yang jatuh tempo dari `integration_outbox` dan membaca antrean dari tabel lab yang sama. Worker menandai event terbit sehingga permintaan tampil di antrean. Jika proses berhenti, event yang belum terbit diproses setelah Node.js berjalan kembali.

Petugas mengambil antrean, membuka rincian, dan mengirim hasil melalui REST API Node.js. Middleware Node.js memeriksa izin terhadap Yii2. Node.js meneruskan permintaan detail dan penyimpanan hasil ke Yii2 dengan token petugas. Yii2 menyimpan hasil sekaligus memperbarui rincian invoice dan status pembayaran dalam satu transaksi. React membaca riwayat dokter dari Yii2. [Endpoint laboratorium](api.md#laboratorium)

## Dashboard

React mengirim periode ke REST API dashboard Node.js. Node.js memeriksa izin `dashboard.read` melalui Yii2 dan membaca agregasi serta rincian invoice dari PostgreSQL. Yii2 tetap menangani pencatatan transaksi. Dashboard membaca saldo melalui view `invoice_balances` yang digunakan modul kasir. [Endpoint dashboard](api.md#dashboard-statistik)
