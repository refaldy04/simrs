# Keputusan Teknis

Yii2 disiapkan sebagai API JSON. React mengelola aset antarmuka melalui npm sehingga konfigurasi Composer backend menggunakan `replace` untuk paket Bower. [Panduan instalasi Yii2](https://www.yiiframework.com/doc/guide/2.0/en/start-installation#installing-assets)

## Model data rawat jalan

Setiap akun memiliki satu peran melalui `users.role_code`. Profil tenaga medis dapat dikaitkan dengan akun, dan profil dokter menyimpan spesialisasi serta izin praktik. Jadwal dibuat sebagai sesi bertanggal. Tanggal layanan dan jam sesi mengikuti waktu lokal fasilitas, sedangkan waktu transaksi disimpan sebagai `TIMESTAMPTZ`.

Satu kunjungan memiliki paling banyak satu pemeriksaan dan satu tagihan. Pemeriksaan dapat menyimpan satu diagnosis utama dan beberapa diagnosis sekunder. Tarif kunjungan dan harga satuan pada tindakan, resep, lab, serta tagihan disalin ke transaksi agar riwayat biaya konsisten saat tarif master diperbarui. Foreign key komposit memastikan rincian tagihan berasal dari kunjungan yang sama. [ERD SIMRS](erd.png)

## Autentikasi dan izin

Yii2 menerbitkan token Bearer acak dengan masa berlaku delapan jam. PostgreSQL menyimpan hash SHA-256 token, dan logout menghapus hash sesi yang sedang dipakai. React menyimpan token di `sessionStorage` untuk sesi tab dan memuat ulang profil melalui Yii2 saat halaman di-refresh. [Autentikasi REST Yii2](https://www.yiiframework.com/doc/guide/2.0/en/rest-authentication)

| Peran | Izin modul |
| --- | --- |
| Administrator | `master.manage`, `users.manage`, `dashboard.read`, `audit.read` |
| Petugas Pendaftaran | `patients.manage`, `visits.register`, `visits.queue` |
| Dokter | `visits.queue`, `examinations.manage`, `procedures.manage`, `prescriptions.create`, `lab.request`, `lab.results.read` |
| Petugas Farmasi | `prescriptions.dispense` |
| Petugas Laboratorium | `lab.requests.read`, `lab.results.read`, `lab.results.write` |
| Kasir | `billing.manage` |

Action Yii2 memakai `Yii::$app->user->can($permission)` untuk memeriksa izin. Rute Express memakai `requirePermission(permission)` dan menerima keputusan dari Yii2. [Otorisasi Yii2](https://www.yiiframework.com/doc/guide/2.0/en/security-authorization)

## Master data

`MasterCatalog` mendefinisikan field, kolom daftar, pencarian, dan pilihan relasi untuk delapan jenis master. Controller Yii2 dan tampilan React memakai katalog tersebut. PostgreSQL menegakkan keunikan nomor rekam medis, identitas, nomor pegawai, izin praktik, kode, dan slot awal jadwal.

Penonaktifan memakai `is_active` agar referensi kunjungan dan riwayat tarif tetap utuh. Pilihan jadwal menampilkan poli aktif serta dokter dan profil tenaga medis yang aktif. Jadwal yang sudah dirujuk kunjungan mempertahankan dokter, poli, tanggal, dan jamnya.

Penulisan jadwal mengunci baris dokter untuk memeriksa benturan sesi aktif. Penyesuaian stok mengunci baris obat, membandingkan stok sebelumnya, lalu menyimpan stok dan mutasi dalam satu transaksi. [Penguncian baris PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)

## Pendaftaran dan nomor antrean

Yii2 memeriksa pasien dan sesi aktif dalam transaksi yang sama dengan penyimpanan kunjungan. Sesi menentukan dokter, poli, dan tanggal. Yii2 menyalin tarif poli ke kunjungan saat mendaftar. Penguncian baris menjaga pilihan itu konsisten selama transaksi berjalan. [Penguncian baris PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)

Counter `visit_queue_counters` menaikkan nomor per poli dan tanggal dengan `INSERT ... ON CONFLICT ... DO UPDATE RETURNING`. Indeks unik parsial di `visits` menolak pendaftaran ulang selama kunjungan sebelumnya belum dibatalkan. Transaksi mengembalikan counter ke nilai sebelumnya saat pendaftaran ditolak. Pembatalan mengubah status dan mencatat aktor di `audit_logs` dalam satu transaksi. Nomor yang dibatalkan tetap tercatat, sehingga pendaftaran berikutnya mendapat nomor baru. [INSERT PostgreSQL](https://www.postgresql.org/docs/17/sql-insert.html)

## Pemeriksaan dan riwayat rekam medis

Pemeriksaan memakai `examinations`, `diagnoses`, dan `audit_logs` yang sudah ada. Yii2 menentukan dokter dan pasien dari kunjungan yang terjadwal. Dokter membaca riwayat pasien melalui kunjungan yang ditugaskan kepadanya, sedangkan perubahan hasil diperiksa berdasarkan penugasan kunjungan yang diubah.

Penyimpanan mengunci kunjungan dan mencocokkan `expected_updated_at` dengan versi yang sedang tersimpan. Catatan, diagnosis, status kunjungan, serta audit disimpan dalam satu transaksi. Dua penyimpanan dengan versi awal yang sama menghasilkan satu hasil terbaru dan konflik untuk permintaan yang tertinggal. [Penguncian baris PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)

Revisi pemeriksaan yang sudah selesai atau memiliki tagihan memerlukan alasan. Diagnosis dicatat sebagai data klinis, sehingga revisinya tidak mengubah komponen invoice maupun pembayaran. Riwayat mengurutkan catatan berdasarkan tanggal kunjungan dan waktu pemeriksaan serta memuat diagnosis dalam kueri halaman yang sama.

## Tindakan dan komponen tagihan

Tindakan kunjungan merujuk `medical_procedures` dan menyimpan salinan tarif satuan. Jumlah mewakili pengulangan tindakan yang sama. Penambahan memeriksa tindakan aktif yang sama di bawah kunci kunjungan. Koreksi memeriksa jumlah terakhir yang dibaca. Pembatalan mengisi `cancelled_at`, sehingga catatan tindakan tetap bisa ditelusuri.

Sebelum tagihan terbit, estimasi dihitung dari biaya pendaftaran, tindakan aktif, lab yang selesai, dan obat yang sudah diserahkan. Setelah tagihan terbit, transaksi perubahan mengunci kunjungan lebih dulu lalu baris invoice, memperbarui komponen tindakan, dan menghitung saldo dari `invoice_balances`. Total di bawah pembayaran yang sudah diterima membatalkan seluruh perubahan. Jika revisi menghasilkan saldo baru, kunjungan yang sudah selesai kembali berstatus menunggu pembayaran. Kunjungan dengan tagihan yang sudah tercakup penuh berstatus selesai.

Audit menyimpan pengguna, alasan, dan snapshot tindakan serta ringkasan tagihan sebelum dan sesudah perubahan. Operasi penerbitan tagihan dan pembayaran yang juga menulis status kunjungan mengikuti urutan kunci kunjungan lalu invoice. [Penguncian baris PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)

## Resep dan stok obat

Pembuatan resep mengunci kunjungan, memeriksa jumlah yang diminta terhadap stok saat itu, lalu menyimpan harga satuan pada item resep. Stok diambil saat penyerahan. Indeks unik per kunjungan dan `idempotency_key` mencegah resep ganda ketika permintaan yang sama dikirim ulang. Resep demo yang dibuat sebelum migrasi bisa tetap dibaca dan diserahkan.

Penyerahan mengunci kunjungan dan resep, lalu invoice bila ada. Baris obat diperbarui menurut urutan ID untuk menjaga urutan kunci konsisten. Setiap `UPDATE` mensyaratkan obat aktif dengan `stock_quantity >= quantity`. Bila satu item gagal, transaksi membatalkan seluruh pengurangan stok. Status resep, `medicine_stock_movements`, audit, dan komponen obat pada tagihan disimpan dalam transaksi yang sama. Pengulangan terhadap resep berstatus `dispensed` mengembalikan penyerahan tersebut. Constraint unik pada `prescription_item_id` menjaga satu mutasi penyerahan per item. [Penguncian baris PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)

Riwayat penggunaan obat mengambil resep yang sudah diserahkan berdasarkan pasien dari kunjungan dokter. `tests/pharmacy-stock.integration.mjs` menjalankan dua penyerahan pada stok yang cukup untuk satu resep dan memeriksa rollback resep dengan beberapa obat. [Uji integrasi stok](../tests/pharmacy-stock.integration.mjs)

## Billing dan pembayaran

Estimasi dan penerbitan memakai proyeksi komponen biaya yang sama. Penerbitan mengunci kunjungan, menyimpan satu invoice dan rincian dalam satu transaksi, lalu memakai `invoice_balances` sebagai sumber saldo. Constraint unik pada `visit_id` menjaga satu nomor invoice per kunjungan.

Pembayaran mengunci kunjungan lalu invoice sebelum membaca saldo terbaru. PostgreSQL membandingkan dan menjumlahkan nominal sebagai `NUMERIC`. Penyimpanan pembayaran, perubahan status kunjungan, dan audit berada dalam satu transaksi. Ketika pembayaran mencakup total, invoice berstatus lunas dan kunjungan selesai. [Penguncian baris PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS)

Kunci UUID disimpan di `payments` dengan constraint unik global. Pengiriman ulang membandingkan invoice, nominal, metode, dan referensi sebelum mengembalikan transaksi asli. React menyimpan permintaan yang belum terkonfirmasi di `sessionStorage`, sehingga pengguna dapat memuat ulang halaman dan mengirim ulang kunci yang sama. [Uji integrasi billing](../tests/billing.integration.mjs)

## Permintaan dan hasil laboratorium

Yii2 membuat pesanan dan item lab dengan tarif satuan dari master aktif. Pesanan, audit, dan event outbox tersimpan bersama. `integration_outbox.event_key` menjadi kunci pengiriman ulang. Yii2 mengembalikan pesanan semula jika kunjungan, jenis pemeriksaan, dan catatan klinis sama.

Node.js mengambil event berdasarkan `next_attempt_at` dengan `FOR UPDATE SKIP LOCKED`. Dalam satu pernyataan SQL, worker menetapkan `published_at` dan menambah `attempt_count` pada event yang diproses. Antrean menampilkan event yang sudah diterbitkan dan data lama yang sudah tersedia. Bila basis data atau Node.js terputus, event yang belum terbit tetap tersimpan dan worker mencobanya kembali saat layanan tersedia.

Penyimpanan hasil mengunci kunjungan dan invoice yang sudah terbit, memvalidasi bahwa setiap item mendapat satu hasil, lalu menyimpan seluruh hasil sekaligus. Lab yang selesai menambah komponen invoice berdasarkan harga pada order. Pembayaran yang sudah tercatat tetap diperhitungkan. Jika biaya lab menghasilkan saldo baru, status kunjungan kembali menunggu pembayaran. Pengiriman ulang hasil yang sama mengembalikan transaksi asli. [Uji integrasi laboratorium](../tests/laboratory.integration.mjs)

## Dashboard dan periode

Kunjungan dihitung dari tanggal layanan dengan status selain dibatalkan. Tindakan aktif menggunakan `performed_at`, penggunaan obat memakai mutasi `dispense` berdasarkan `recorded_at`, dan pendapatan memakai waktu pembayaran `paid_at`. Invoice dikelompokkan berdasarkan tanggal terbit. Status dan saldo terkini berasal dari view `invoice_balances` yang sama dengan modul kasir.

PostgreSQL memakai batas awal pukul 00.00 WIB pada tanggal mulai dan batas akhir eksklusif pukul 00.00 WIB setelah tanggal akhir. Predikat membandingkan kolom timestamp dengan kedua batas itu sehingga indeks tetap bisa dipakai. Migrasi dashboard menambah indeks waktu terbit invoice dan indeks parsial waktu tindakan aktif. Kunjungan, pembayaran, dan mutasi obat memakai indeks yang tersedia sebelumnya.

Node.js menjalankan satu pernyataan agregasi untuk ringkasan agar setiap angka memakai snapshot basis data yang sama. Subkueri mengagregasi kunjungan, tindakan, obat, dan pembayaran secara terpisah. Nominal dijumlahkan sebagai `NUMERIC`. Rincian invoice difilter dan dipaginasi di PostgreSQL. [Uji integrasi dashboard](../tests/dashboard.integration.mjs)

## Rancangan transaksi aplikasi

| Skenario | Aturan basis data dan alur transaksi |
| --- | --- |
| Duplikasi pendaftaran | Nomor antrean unik per poli dan tanggal. Satu pasien dapat memiliki satu kunjungan yang tidak dibatalkan pada poli dan tanggal yang sama. Pendaftaran memperbarui `visit_queue_counters` secara atomik dengan `INSERT ... ON CONFLICT ... DO UPDATE RETURNING` dalam transaksi yang sama dengan kunjungan. |
| Konkurensi stok | Stok obat harus bernilai nol atau lebih. Penyerahan memakai `UPDATE` bersyarat dengan `stock_quantity >= quantity` dan mencatat mutasi dalam transaksi yang sama dengan perubahan status resep. Setiap item resep hanya dapat memiliki satu mutasi penyerahan. |
| Pembayaran bertahap | `invoice_balances` menghitung total, pembayaran tercatat, saldo, dan status dari transaksi. Pembayaran mengunci baris tagihan sebelum membaca saldo. Percobaan ulang menggunakan `idempotency_key` yang sama, dan setiap pembayaran mempunyai nomor bukti unik. |
| Perubahan pemeriksaan | Perubahan diagnosis atau tindakan dicatat di `audit_logs` dengan aktor, alasan, dan data sebelum serta sesudah perubahan. Saat perubahan memengaruhi biaya, aplikasi mengunci tagihan yang sama dengan transaksi pembayaran dan memperbarui rincian serta audit dalam satu transaksi. Jumlah yang sudah dibayar menjadi batas minimum total tagihan pada revisi biasa. |
| Gangguan integrasi | Pembuatan pesanan lab mencatat `integration_outbox` dalam transaksi yang sama. Worker Node.js mengambil event sesuai `next_attempt_at`. Kunci `event_key` yang sama menjaga permintaan tetap tunggal ketika dikirim ulang. |
| Kueri operasional | Indeks mengikuti pencarian riwayat pasien, kunjungan per tanggal dan poli, antrean resep dan lab, periode pembayaran, serta event integrasi yang menunggu. |

Migrasi Yii2 memakai `safeUp()` dan `safeDown()` untuk menjalankan setiap perubahan skema dalam satu transaksi. [Panduan migrasi Yii2](https://www.yiiframework.com/doc/guide/2.0/en/db-migrations#transactional-migrations) · [Constraint PostgreSQL](https://www.postgresql.org/docs/17/ddl-constraints.html)
