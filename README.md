# SIMRS Rawat Jalan

Sistem Informasi Manajemen Rumah Sakit (SIMRS) untuk pelayanan rawat jalan dari pendaftaran dan antrean hingga penagihan dan pembayaran. Studi kasus ini meliputi master data, pemeriksaan dan rekam medis, tindakan, resep dan farmasi, laboratorium, hak akses pengguna, serta dashboard dan laporan.

Dokumen acuan proyek tersedia di root repositori. [REAL CASE TEST – Senior Programmer](REAL%20CASE%20TEST%20-%20Senior%20Programmer.pdf)

## Struktur repositori

| Lokasi | Peran |
| --- | --- |
| `frontend/` | Antarmuka React dengan Vite |
| `backend/` | API Yii2 dan logika bisnis utama SIMRS |
| `services/` | API Node.js untuk laboratorium dan dashboard |
| `database/` | Skema PostgreSQL, migrasi, dan data awal |
| `docs/` | Arsitektur, ERD, dokumentasi API, keputusan teknis, dan tangkapan layar |
| `postman/` | Koleksi pengujian API SIMRS |

## Menjalankan lingkungan pengembangan

Docker Compose menjalankan Yii2 dengan PHP 8.4, React dengan Vite, layanan Express dengan Node.js 22, dan PostgreSQL 17. Dependensi aplikasi mengikuti lockfile Composer dan npm.

Pada instalasi pertama, salin `.env.example` ke `.env` dan sesuaikan kredensial serta port untuk lingkungan lokal.

### Menjalankan stack dengan Docker

Jalankan dari root repositori.

```sh
docker compose up -d --build --wait
docker compose ps
```

| Komponen | Alamat lokal bawaan |
| --- | --- |
| React dan Vite | `http://127.0.0.1:5173/` |
| API Yii2 | `http://127.0.0.1:8080/health` |
| API Node.js | `http://127.0.0.1:3000/health` |
| PostgreSQL | `127.0.0.1:5432` |

Setelah masuk, React menampilkan hak akses akun dan status kedua API. Status Yii2 mencakup koneksi ke PostgreSQL. [Dokumentasi API](docs/api.md)

### Menerapkan perubahan kode di Docker

Dockerfile menyalin kode React, Yii2, dan Node.js ke image saat build. Saat stack sudah berjalan, bangun ulang layanan yang kodenya berubah dari root repositori.

| Kode yang berubah | Perintah |
| --- | --- |
| React | `docker compose up -d --build --no-deps --wait frontend` |
| Yii2 | `docker compose up -d --build --no-deps --wait backend` |
| Node.js | `docker compose up -d --build --no-deps --wait node-api` |

Refresh browser dan `docker compose restart` memakai versi kode yang sudah ada di container.

### Hot reload React

Untuk mengerjakan React dengan hot reload, jalankan Vite langsung di host dengan Node.js 22.12 atau lebih baru. Contoh ini memakai port bawaan API Yii2 dan Node.js. Mulai dari root repositori.

```sh
docker compose up -d --wait db backend node-api
cd frontend
npm ci
npm run dev -- --port 5174
```

Jalankan `npm ci` saat instalasi pertama atau ketika `package-lock.json` berubah. Biarkan Vite berjalan agar perubahan kode React muncul otomatis saat file disimpan. [Buka Vite di port 5174](http://localhost:5174/)

### Log dan penghentian

Gunakan `docker compose logs -f backend node-api` untuk melihat log API dan `docker compose down` untuk menghentikan stack. Jika Vite berjalan di host, hentikan dengan `Ctrl+C` di terminal Vite.

Detail error Yii2 dicatat di `runtime/logs/app.log` dalam container `backend`.

### PostgreSQL dan CLI Yii2

PostgreSQL membaca `POSTGRES_DB`, `POSTGRES_USER`, dan `POSTGRES_PASSWORD` saat pertama kali menginisialisasi volume `postgres-data`. Volume menyimpan data di antara sesi pengembangan. [Dokumentasi image PostgreSQL](https://hub.docker.com/_/postgres)

Jalankan migrasi Yii2 dari root repositori setelah stack siap. Migrasi dibaca dari `database/migrations/` dan hanya versi yang belum tercatat yang akan dijalankan.

```sh
docker compose exec -T backend php yii migrate --interactive=0
```

Isi database development dengan data demo setelah migrasi selesai.

```sh
docker compose exec -T db sh -ec \
  'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/seeds/demo.sql
```

Seed memuat lima kunjungan fiktif pada **23 November 2026**, termasuk antrean, resep, pemeriksaan lab, serta tagihan lunas, dibayar sebagian, dan belum dibayar. Seed dapat dijalankan ulang. Tagihan `DEMO-INV-001` menandai bahwa data demo sudah tersedia.

`schema.sql` adalah snapshot DDL yang dihasilkan dari migrasi. Diagram dan sumbernya tersedia di dokumentasi. [Skema PostgreSQL](database/schema.sql) · [ERD](docs/erd.png) · [Sumber Graphviz](docs/erd.dot) · [Keputusan teknis](docs/technical-decisions.md)

### Masuk dengan akun demo

Setelah menjalankan migrasi dan seed, buka frontend dan masuk menggunakan salah satu akun berikut. Semua akun demo memakai kata sandi `SimrsDemo2026!`. [Buka SIMRS](http://127.0.0.1:5173/)

| Peran | Nama pengguna |
| --- | --- |
| Administrator | `demo.admin` |
| Petugas Pendaftaran | `demo.pendaftaran` |
| Dokter | `demo.dokter.umum` atau `demo.dokter.dalam` |
| Petugas Farmasi | `demo.farmasi` |
| Petugas Laboratorium | `demo.lab` |
| Kasir | `demo.kasir` |

Folder Autentikasi dan Akses pada koleksi Postman menguji login, profil, izin kedua API, dan logout dengan akun dokter demo. [Koleksi Postman](postman/SIMRS.postman_collection.json)

### Master data

Masuk sebagai `demo.admin` lalu buka menu **Master data** untuk mengelola pasien, tenaga medis, dokter, poli, jadwal praktik, tindakan medis, obat, dan pemeriksaan lab. Akun `demo.pendaftaran` mendapat menu pasien.

Gunakan pencarian dan filter status untuk menemukan data. Untuk mengaktifkan kembali data, pilih status **Nonaktif**, buka **Ubah**, lalu centang **Aktif**. [Dokumentasi API master data](docs/api.md#master-data)

### Pendaftaran, jadwal, dan antrean

Masuk sebagai `demo.pendaftaran` dan buka **Pendaftaran & antrean**. Pilih tanggal layanan, cari pasien dengan nomor rekam medis, nomor identitas, atau nama, lalu pilih poli dan sesi dokter. Nomor antrean tampil setelah kunjungan tersimpan. Riwayat tampil saat pasien dipilih.

Tab **Jadwal** menampilkan sesi aktif pada tanggal yang dipilih. Di tab **Antrean**, petugas dapat menyaring poli dan status, memuat ulang daftar, serta membatalkan kunjungan berstatus **Menunggu**. Akun dokter dapat melihat jadwal dan antreannya sendiri melalui **Jadwal & antrean**.

Tanggal bawaan mengikuti `Asia/Jakarta`. Data demo tersedia pada **23 November 2026**. Untuk mencoba pendaftaran, cari `DEMO-RM-005` dan pilih **Poli Penyakit Dalam Demo** pada tanggal tersebut. [Buka pendaftaran demo](http://127.0.0.1:5173/#/registration?date=2026-11-23) · [Dokumentasi API](docs/api.md#pendaftaran-jadwal-dan-antrean)
