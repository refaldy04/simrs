# Dokumentasi API SIMRS

## Pemeriksaan kesehatan layanan

| Metode | URL lokal bawaan | Respons saat siap |
| --- | --- | --- |
| `GET` | `http://127.0.0.1:8080/health` | `200` dengan `{"status":"ok","database":"ok"}` |
| `GET` | `http://127.0.0.1:3000/health` | `200` dengan `{"status":"ok"}` |

Yii2 menjalankan `SELECT 1` pada PostgreSQL. Jika kueri gagal, endpoint mengembalikan `503` dengan `{"status":"unavailable","database":"unavailable"}`.

Frontend menggunakan `/api/core/health` dan `/api/services/health` melalui proxy Vite. Untuk menguji API secara langsung, gunakan permintaan pemeriksaan kesehatan pada koleksi Postman. [Koleksi SIMRS](../postman/SIMRS.postman_collection.json)

## Autentikasi dan pemeriksaan izin

Endpoint Yii2 menggunakan port lokal `8080`, dan endpoint Node.js menggunakan port `3000` secara bawaan. Kirim `Authorization: Bearer <access_token>` pada permintaan setelah login.

| API | Metode dan path | Respons |
| --- | --- | --- |
| Yii2 | `POST /auth/login` | `200` dengan `access_token`, `token_type`, `expires_at`, `user`, dan `permissions`. Body JSON berisi `username` dan `password`. |
| Yii2 | `GET /auth/me` | `200` dengan profil `user` dan daftar `permissions` terbaru. |
| Yii2 | `GET /auth/access?permission=lab.results.read` | `200` dengan `permission` dan `allowed` jika diizinkan. |
| Yii2 | `POST /auth/logout` | `204` saat token pada permintaan dicabut. |
| Node.js | `GET /access/laboratory` | `200` jika akun memiliki izin `lab.results.read`. |
| Node.js | `GET /access/dashboard` | `200` jika akun memiliki izin `dashboard.read`. |

Profil memuat `id` sebagai string, `username`, `full_name`, `role_code`, dan `role_name`. `permissions` berisi kode izin pada peran tersebut.

Kredensial yang salah serta token yang hilang, kedaluwarsa, atau dicabut menghasilkan `401`. Jika akun terautentikasi tetapi perannya tidak memiliki izin, API mengembalikan `403`. Login dengan payload yang salah menghasilkan `400` atau `415`. Setelah sepuluh percobaan pada nama pengguna yang sama dalam satu menit, Yii2 mengembalikan `429` dengan header `Retry-After`. Node.js mengembalikan `503` saat pemeriksaan izin ke Yii2 gagal.

Jalankan folder Autentikasi dan Akses dengan akun dokter demo untuk memeriksa respons yang diizinkan maupun ditolak. Request login menyimpan token pada variabel koleksi, lalu pemeriksaan terakhir menghapusnya setelah menguji token yang dicabut. [Koleksi SIMRS](../postman/SIMRS.postman_collection.json)

## Master data

Kirim token Bearer Yii2. `master.manage` memberi akses ke seluruh katalog. `patients.manage` memberi akses ke pasien. Gunakan `resource` dari respons katalog saat mengakses endpoint berikut.

| Metode dan path | Respons |
| --- | --- |
| `GET /master-data` | `200` dengan `resources`, termasuk label, kolom, dan definisi field. |
| `GET /master-data/{resource}` | `200` dengan `items`, `page`, `page_size`, dan `total`. |
| `GET /master-data/{resource}/options` | `200` dengan pilihan relasi aktif per field. |
| `GET /master-data/{resource}/{id}` | `200` dengan detail data. |
| `POST /master-data/{resource}` | `201` dengan data baru dari body JSON. |
| `PATCH /master-data/{resource}/{id}` | `200` dengan data setelah perubahan field yang dikirim. |
| `DELETE /master-data/{resource}/{id}` | `204` setelah menonaktifkan data. |

Daftar menerima `q` untuk pencarian sebagian teks, `status` dengan nilai `active`, `inactive`, atau `all`, serta `page` dan `page_size`. Nilai bawaan adalah `active`, halaman `1`, dan `20` data per halaman. ID dikirim sebagai string dan tarif sebagai desimal, misalnya `"30000.00"`.

Kesalahan field menghasilkan `422` dengan objek `errors` yang dipetakan ke nama field. Duplikasi, benturan jadwal, perubahan jadwal yang sudah dipakai, dan konflik stok menghasilkan `409`. Untuk mengaktifkan kembali data, kirim `PATCH` dengan `{"is_active":true}`.

Obat menerima `stock_quantity` saat dibuat. Untuk menyesuaikan stok, kirim jumlah baru dan jumlah yang terakhir dibaca dalam permintaan yang sama. Pembaruan stok dan pencatatan mutasinya berlangsung dalam satu transaksi.

```json
{
  "stock_quantity": 30,
  "expected_stock_quantity": 26
}
```

Folder **Master Data** memeriksa katalog, pencarian dan pagination pasien, detail pasien, serta pilihan jadwal dengan akun admin demo. [Koleksi SIMRS](../postman/SIMRS.postman_collection.json)

## Pendaftaran, jadwal, dan antrean

Endpoint menggunakan token Bearer Yii2. `visits.register` memberi akses untuk mencari pasien, membaca riwayat, mendaftarkan, dan membatalkan kunjungan. `visits.queue` memberi akses baca jadwal dan antrean. Akun dokter mendapat hasil untuk sesi yang ditautkan ke akunnya.

| Metode dan path | Respons |
| --- | --- |
| `GET /registration/patients?q=DEMO-RM-005` | `200` dengan pasien aktif sesuai nomor rekam medis, nomor identitas, atau nama. |
| `GET /registration/patients/{id}/visits` | `200` dengan riwayat kunjungan pasien, urut tanggal terbaru. |
| `GET /registration/schedules?date=2026-11-23` | `200` dengan daftar sesi aktif dan tarif pendaftaran poli. |
| `GET /registration/visits?date=2026-11-23` | `200` dengan daftar antrean, metadata halaman, dan pilihan `clinics`. Filter opsional memakai `clinic_id` dan `status`. |
| `POST /registration/visits` | `201` dengan nomor antrean dan detail kunjungan berstatus `waiting`. |
| `POST /registration/visits/{id}/cancel` | `200` dengan detail kunjungan berstatus `cancelled`. |

Daftar pasien, riwayat, dan antrean menerima `page` dan `page_size`. `date` memakai format `YYYY-MM-DD` dan secara bawaan memakai hari ini di `Asia/Jakarta`. `status` menerima `all`, `waiting`, `in_examination`, `awaiting_billing`, `completed`, atau `cancelled`.

Pendaftaran menerima dua ID dalam body JSON. Yii2 mengambil poli, tanggal, dan tarif dari sesi yang dipilih dan menyimpan tarif pada kunjungan.

```json
{
  "patient_id": "5",
  "schedule_id": "2"
}
```

Pasien atau jadwal yang sudah nonaktif menghasilkan `422`. Pendaftaran kedua untuk pasien, poli, dan tanggal yang sama menghasilkan `409` selama kunjungan sebelumnya belum dibatalkan. Pembatalan tersedia untuk status `waiting`. Mengulangi pembatalan kunjungan yang sudah `cancelled` mengembalikan status yang sama. Nomor antrean yang dibatalkan tersimpan di riwayat.

Folder **Pendaftaran dan Antrean** memeriksa jadwal, pencarian pasien, riwayat, dan daftar antrean dari data demo. [Koleksi SIMRS](../postman/SIMRS.postman_collection.json)

## Pemeriksaan, diagnosis, dan RME

Endpoint memakai token Bearer dengan izin `examinations.manage`. `{id}` adalah ID kunjungan yang dijadwalkan untuk dokter pemilik token. Riwayat memakai pasien dari kunjungan tersebut dan menyertakan pemeriksaan terdahulu pasien, termasuk catatan dari dokter lain. Hak untuk mengubah pemeriksaan diperiksa pada kunjungan yang bersangkutan.

| Metode dan path | Respons |
| --- | --- |
| `GET /examinations/visits/{id}` | `200` dengan `visit`, `examination`, dan `requires_revision_reason`. `examination` bernilai `null` sebelum catatan dibuat. |
| `PUT /examinations/visits/{id}` | `200` dengan status kunjungan dan pemeriksaan setelah disimpan. |
| `GET /examinations/visits/{id}/history` | `200` dengan `items`, `page`, `page_size`, dan `total`. Setiap catatan memuat keluhan, anamnesis, tanda vital, hasil fisik, diagnosis, dokter pemeriksa, tanggal kunjungan, dan poli. |

`PUT` menyimpan isian pemeriksaan lengkap. Kirim `chief_complaint`, daftar `diagnoses`, dan `expected_updated_at`. Isian klinis opsional yang dikosongkan disimpan sebagai `null`. Gunakan `null` untuk `expected_updated_at` pada pemeriksaan baru, lalu gunakan nilai `examination.updated_at` dari respons terakhir saat mengubahnya.

```json
{
  "chief_complaint": "Keluhan simulasi",
  "anamnesis": "Anamnesis simulasi",
  "physical_findings": "Hasil pemeriksaan fisik simulasi",
  "pulse_rate": 76,
  "temperature_c": "36.7",
  "diagnoses": [
    { "code": "DEMO-DX-001", "description": "Diagnosis utama simulasi", "is_primary": true },
    { "code": null, "description": "Diagnosis sekunder simulasi", "is_primary": false }
  ],
  "expected_updated_at": null,
  "finish": false
}
```

Saat `finish` bernilai `false`, penyimpanan pertama mengubah `waiting` menjadi `in_examination`. Daftar `diagnoses` boleh kosong selama pemeriksaan berjalan. Jika ada diagnosis, tepat satu harus ditandai utama. Kode bersifat opsional dan setiap kode yang diisi harus unik dalam pemeriksaan.

Kirim `finish: true` dengan diagnosis utama untuk memindahkan kunjungan ke `awaiting_billing`. Revisi hasil yang sudah selesai atau punya tagihan memakai `finish: false` dan menyertakan `reason`. Perubahan menyimpan aktor, alasan, serta hasil sebelum dan sesudah di audit.

Izin yang kurang menghasilkan `403`. ID yang tidak tersedia untuk dokter tersebut menghasilkan `404`. Kunjungan dibatalkan, percobaan menyelesaikan ulang, atau `expected_updated_at` yang kedaluwarsa menghasilkan `409`. Kesalahan isian menghasilkan `422` dengan objek `errors` per field.

Folder **Pemeriksaan dan RME** menguji akses dokter, pembacaan riwayat, penyimpanan ulang, konflik versi, validasi, dan pembatasan akses peran dengan data demo. [Koleksi SIMRS](../postman/SIMRS.postman_collection.json)
