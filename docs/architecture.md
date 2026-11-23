# Arsitektur SIMRS

React menyediakan antarmuka pelayanan rawat jalan. Yii2 menangani API dan logika bisnis utama SIMRS. Node.js menyediakan API pendukung untuk integrasi laboratorium dan dashboard. PostgreSQL menjadi basis data utama.

Pada lingkungan pengembangan, proxy Vite meneruskan permintaan `/api/core/` ke Yii2 dan `/api/services/` ke Node.js. Yii2 menggunakan PDO untuk menyambung ke PostgreSQL melalui jaringan Docker Compose.

Yii2 memvalidasi login terhadap akun PostgreSQL dan menentukan izin dari peran akun. Middleware Node.js meneruskan token dan izin yang dibutuhkan ke `GET /auth/access` di Yii2 sebelum melanjutkan permintaan yang dilindungi. [Dokumentasi API](api.md)

Kunjungan menghubungkan pasien dan jadwal poli dengan pemeriksaan, tindakan, resep, pesanan lab, dan tagihan. PostgreSQL menyimpan riwayat transaksi dan menyediakan view `invoice_balances` untuk saldo dan status pembayaran. [ERD SIMRS](erd.png)

Diagram arsitektur dan pembagian tanggung jawab atas data antara Yii2 dan Node.js diisi pada tahap desain arsitektur.
