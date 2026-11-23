# Keputusan Teknis

Yii2 disiapkan sebagai API JSON. React mengelola aset antarmuka melalui npm sehingga konfigurasi Composer backend menggunakan `replace` untuk paket Bower. [Panduan instalasi Yii2](https://www.yiiframework.com/doc/guide/2.0/en/start-installation#installing-assets)

## Model data rawat jalan

Setiap akun memiliki satu peran melalui `users.role_code`. Profil tenaga medis dapat dikaitkan dengan akun, dan profil dokter menyimpan spesialisasi serta izin praktik. Jadwal dibuat sebagai sesi bertanggal. Tanggal layanan dan jam sesi mengikuti waktu lokal fasilitas, sedangkan waktu transaksi disimpan sebagai `TIMESTAMPTZ`.

Satu kunjungan memiliki paling banyak satu pemeriksaan dan satu tagihan. Pemeriksaan dapat menyimpan satu diagnosis utama dan beberapa diagnosis sekunder. Tarif kunjungan dan harga satuan pada tindakan, resep, lab, serta tagihan disalin ke transaksi agar riwayat biaya konsisten saat tarif master diperbarui. Foreign key komposit memastikan rincian tagihan berasal dari kunjungan yang sama. [ERD SIMRS](erd.png)

## Rancangan transaksi aplikasi

| Skenario | Aturan basis data dan alur transaksi |
| --- | --- |
| Duplikasi pendaftaran | Nomor antrean unik per poli dan tanggal. Satu pasien dapat memiliki satu kunjungan yang tidak dibatalkan pada poli dan tanggal yang sama. Pendaftaran memperbarui `visit_queue_counters` secara atomik dengan `INSERT ... ON CONFLICT ... DO UPDATE RETURNING` dalam transaksi yang sama dengan kunjungan. |
| Konkurensi stok | Stok obat harus bernilai nol atau lebih. Penyerahan memakai `UPDATE` bersyarat dengan `stock_quantity >= quantity` dan mencatat mutasi dalam transaksi yang sama dengan perubahan status resep. Setiap item resep hanya dapat memiliki satu mutasi penyerahan. |
| Pembayaran bertahap | `invoice_balances` menghitung total, pembayaran tercatat, saldo, dan status dari transaksi. Pembayaran mengunci baris tagihan sebelum membaca saldo. Percobaan ulang menggunakan `idempotency_key` yang sama, dan setiap pembayaran mempunyai nomor bukti unik. |
| Perubahan pemeriksaan | Perubahan diagnosis atau tindakan dicatat di `audit_logs` dengan aktor, alasan, dan data sebelum serta sesudah perubahan. Saat perubahan memengaruhi biaya, aplikasi mengunci tagihan yang sama dengan transaksi pembayaran dan memperbarui rincian serta audit dalam satu transaksi. Jumlah yang sudah dibayar menjadi batas minimum total tagihan pada revisi biasa. |
| Gangguan integrasi | Pembuatan pesanan lab mencatat `integration_outbox` dalam transaksi yang sama. Pengiriman ulang menggunakan `event_key` yang sama dan jadwal `next_attempt_at`. |
| Kueri operasional | Indeks mengikuti pencarian riwayat pasien, kunjungan per tanggal dan poli, antrean resep dan lab, periode pembayaran, serta event integrasi yang menunggu. |

Migrasi Yii2 memakai `safeUp()` dan `safeDown()` untuk menjalankan setiap perubahan skema dalam satu transaksi. [Panduan migrasi Yii2](https://www.yiiframework.com/doc/guide/2.0/en/db-migrations#transactional-migrations) · [Constraint PostgreSQL](https://www.postgresql.org/docs/17/ddl-constraints.html)
