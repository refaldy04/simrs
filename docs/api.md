# Dokumentasi API SIMRS

## Pemeriksaan kesehatan layanan

| Metode | URL lokal bawaan | Respons saat siap |
| --- | --- | --- |
| `GET` | `http://127.0.0.1:8080/health` | `200` dengan `{"status":"ok","database":"ok"}` |
| `GET` | `http://127.0.0.1:3000/health` | `200` dengan `{"status":"ok","database":"ok"}` |

Yii2 dan Node.js menjalankan `SELECT 1` pada PostgreSQL. Jika kueri gagal, endpoint mengembalikan `503` dengan `{"status":"unavailable","database":"unavailable"}`.

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

## Tindakan dan komponen tagihan

Kirim token Bearer dengan izin `procedures.manage`. `{id}` adalah ID kunjungan yang ditugaskan kepada dokter, dan `{itemId}` adalah ID tindakan pada kunjungan tersebut. Setelah pemeriksaan disimpan, dokter dapat menambah atau merevisi tindakan.

| Metode dan path | Respons |
| --- | --- |
| `GET /procedures/visits/{id}` | `200` dengan tindakan, pilihan master aktif, dan komponen tagihan. |
| `POST /procedures/visits/{id}/items` | `201` dengan tindakan dan komponen biaya setelah penambahan. |
| `PATCH /procedures/visits/{id}/items/{itemId}` | `200` dengan jumlah dan tagihan terbaru. |
| `POST /procedures/visits/{id}/items/{itemId}/cancel` | `200` dengan tindakan berstatus dibatalkan dan komponen biaya terbaru. |

Respons memuat `visit_status`, `can_write`, `requires_revision_reason`, `items`, `options`, dan `billing`. `billing.items` memuat jenis, deskripsi, jumlah, tarif satuan, dan subtotal. Harga dan total dikirim sebagai string desimal. Sebelum tagihan terbit, `billing.invoice` bernilai `null` dan panel menampilkan estimasi pendaftaran, tindakan aktif, lab yang selesai, serta obat yang sudah diserahkan. Setelah terbit, API membaca `invoice_items` dan `invoice_balances` untuk menampilkan rincian dan saldo tagihan.

Penambahan menerima `procedure_id` dari pilihan master dan `quantity` dengan nilai bawaan `1`. `expected_unit_price` opsional dan memakai string tarif dari `options`. API menyalin tarif master pada saat menyimpan tindakan. Tindakan yang sudah aktif dihitung melalui jumlah pada baris tersebut.

```json
{
  "procedure_id": "2",
  "quantity": 2,
  "expected_unit_price": "75000.00"
}
```

Untuk mengubah jumlah, kirim `quantity` baru dan `expected_quantity` dari baris terakhir yang dibaca. Pembatalan hanya membutuhkan `expected_quantity` dan alasan bila diwajibkan. Setiap perubahan setelah pemeriksaan selesai atau setelah tagihan terbit memerlukan `reason`. Tindakan dibatalkan secara lunak dan tersimpan di riwayat.

Izin yang kurang menghasilkan `403`. Kunjungan di luar penugasan dokter atau tindakan dari kunjungan lain menghasilkan `404`. Isian yang tidak valid menghasilkan `422` dengan `errors` per field. Konflik tarif, jumlah lama, tindakan aktif yang sama, atau total baru di bawah jumlah terbayar menghasilkan `409`.

Folder **Tindakan dan Tagihan** memeriksa katalog, komponen biaya, pembacaan tagihan yang dibayar sebagian, dan konflik perubahan dengan seed demo. [Koleksi SIMRS](../postman/SIMRS.postman_collection.json)

## Resep dan penyerahan obat

`prescriptions.create` memberi dokter akses ke kunjungan yang dijadwalkan untuk akunnya. `prescriptions.dispense` memberi petugas farmasi akses ke antrean resep dan konfirmasi penyerahan. Harga diambil dari master obat saat resep dibuat dan disimpan sebagai string desimal pada item resep.

| Metode dan path | Respons |
| --- | --- |
| `GET /prescriptions/visits/{id}` | `200` dengan `can_create`, `medicines` yang aktif, dan `prescriptions` kunjungan. |
| `POST /prescriptions/visits/{id}` | `201` dengan `prescription` dan `replayed: false`. Pengiriman ulang resep yang sama mengembalikan `200` dan `replayed: true`. |
| `POST /prescriptions/visits/{id}/{prescriptionId}/cancel` | `200` dengan resep berstatus `cancelled` jika masih menunggu atau sudah dibatalkan. |
| `GET /prescriptions/visits/{id}/history` | `200` dengan resep pasien yang sudah diserahkan. |
| `GET /pharmacy/prescriptions` | `200` dengan daftar resep, informasi pasien, item, dan stok saat ini. |
| `POST /pharmacy/prescriptions/{id}/dispense` | `200` dengan resep berstatus `dispensed`. Pengiriman ulang mengembalikan penyerahan yang sudah tersimpan. |

`{id}` adalah ID kunjungan di rute dokter dan ID resep di rute penyerahan. Riwayat dokter serta antrean farmasi memakai `page` dan `page_size`. Daftar farmasi menerima `q` untuk nama atau nomor rekam medis serta `status` dengan nilai `pending`, `dispensed`, `cancelled`, atau `all`. Nilai bawaan adalah `pending`, diurutkan dari resep tertua.

Pembuatan resep membutuhkan pemeriksaan yang sudah disimpan, UUID `idempotency_key`, dan setidaknya satu obat. `expected_unit_price` opsional dan memakai harga dari pilihan obat. Kunci berlaku per kunjungan dan dapat dikirim kembali dengan isian klinis yang sama.

```json
{
  "idempotency_key": "8c83fb09-1a7a-4975-99d6-a1f681e08bad",
  "items": [
    { "medicine_id": "2", "dose": "Dosis simulasi", "frequency": "Frekuensi simulasi", "quantity": 2, "expected_unit_price": "5000.00" }
  ]
}
```

Jumlah obat yang sama diperiksa secara agregat saat resep dibuat. Stok berkurang pada konfirmasi farmasi. Obat yang berhasil diserahkan menjadi komponen biaya kunjungan dan masuk ke tagihan yang sudah terbit bila ada. Pembatalan dan penyerahan memakai `POST` tanpa body.

Peran yang tidak berwenang menghasilkan `403`. Kunjungan di luar penugasan atau resep di luar kunjungan menghasilkan `404`. Isian resep yang salah menghasilkan `422` dengan `errors` per field. Konflik stok, harga, status resep, atau penggunaan ulang kunci dengan isian berbeda menghasilkan `409`.

Folder **Resep dan Farmasi** menguji akses dokter, riwayat obat, antrean, dan pengiriman ulang penyerahan. [Koleksi SIMRS](../postman/SIMRS.postman_collection.json)

## Billing dan pembayaran

Gunakan token Bearer dengan izin `billing.manage`. Antrean menampilkan kunjungan siap tagih dan kunjungan dengan invoice yang sudah terbit.

| Metode dan path | Respons |
| --- | --- |
| `GET /billing/visits` | `200` dengan daftar kunjungan, status tagihan, total, dan saldo invoice bila tersedia. |
| `GET /billing/visits/{visitId}` | `200` dengan `visit`, `can_issue`, dan `billing`, termasuk rincian biaya serta saldo. |
| `POST /billing/visits/{visitId}/invoice` | `201` dengan `detail` dan `replayed: false`. Jika invoice sudah terbit, mengembalikan `200` dan invoice tersebut. |
| `POST /billing/invoices/{invoiceId}/payments` | `201` dengan `payment`, `detail`, dan `replayed: false`. Jika permintaan yang sama sudah tersimpan, mengembalikan `200` dan `replayed: true`. |
| `GET /billing/visits/{visitId}/history` | `200` dengan riwayat pembayaran pasien, termasuk nomor bukti, nominal, invoice, metode, kasir, dan waktu bayar. |

Antrean menerima `q`, `status`, `page`, dan `page_size`. Cari nama, nomor rekam medis, atau nomor invoice. `status` menerima `all`, `unissued`, `unpaid`, `partial`, atau `paid`. Riwayat menerima `page` dan `page_size` serta diurutkan dari pembayaran terbaru.

Penerbitan invoice memakai `POST` tanpa body. Invoice baru tersedia saat kunjungan berstatus `awaiting_billing`. Rincian berasal dari pendaftaran, tindakan aktif, lab yang sudah selesai, dan obat yang sudah diserahkan. Jumlah serta subtotal diambil dari data transaksi yang sudah tersimpan.

Pembayaran menerima nominal positif sebagai string desimal dengan maksimal dua angka di belakang titik. Gunakan `cash` untuk tunai atau `non_cash` untuk simulasi non-tunai. Field `external_reference` bersifat opsional.

```json
{
  "idempotency_key": "df5ec5ff-476f-49f6-9898-66d33224739c",
  "amount": "25000.50",
  "method": "non_cash",
  "external_reference": "TRANSFER-SIMULASI-001"
}
```

Untuk pengiriman ulang, pakai UUID dan isian yang sama. Respons mengembalikan bukti bayar asli dan saldo terbaru, termasuk jika invoice kini lunas. UUID yang sama dengan invoice atau isian berbeda menghasilkan `409`. Nominal di atas saldo terbaru juga menghasilkan `409`. Isian yang salah menghasilkan `422` dengan `errors` per field, dan peran yang tidak berwenang menghasilkan `403`.

Folder **Billing dan Pembayaran** menguji rincian, riwayat, dan pengiriman ulang pembayaran demo. [Koleksi SIMRS](../postman/SIMRS.postman_collection.json)

## Laboratorium

Kirim token Bearer dari Yii2. Dokter membuka konteks dari kunjungan yang ditugaskan. Riwayat mengambil hasil laboratorium yang selesai dari kunjungan pasien yang sama. Antrean Node.js meminta izin petugas laboratorium ke Yii2.

| API | Metode dan path | Izin dan respons |
| --- | --- | --- |
| Yii2 | `GET /lab/visits/{visitId}` | `lab.results.read` · `200` dengan `visit_status`, `can_order`, `tests`, dan `orders`. |
| Yii2 | `POST /lab/visits/{visitId}/orders` | `lab.request` · `201` dengan `order` dan `replayed: false`. Pengiriman ulang dengan kunci dan isian yang sama menghasilkan `200`. |
| Yii2 | `GET /lab/visits/{visitId}/history` | `lab.results.read` · `200` dengan riwayat hasil pasien dan metadata halaman. |
| Node.js | `GET /lab/orders` | `lab.requests.read` · `200` dengan daftar permintaan dan metadata halaman. |
| Node.js | `GET /lab/orders/{orderId}` | `lab.requests.read` · `200` dengan rincian permintaan, pemeriksaan, dan hasil yang tersimpan. |
| Node.js | `PUT /lab/orders/{orderId}/results` | `lab.results.write` · `200` dengan `order` berstatus `completed` dan `replayed`. |

Antrean menerima `q` untuk nama atau nomor rekam medis, `status`, `page`, dan `page_size`. Status bawaan `open` mencakup `requested` dan `in_progress`. Filter juga menerima `requested`, `in_progress`, `completed`, `cancelled`, atau `all`. Riwayat menerima `page` dan `page_size`.

Dokter dapat membuat permintaan saat kunjungan sedang diperiksa atau menunggu pembayaran. Gunakan ID pemeriksaan aktif dari `tests`. Yii2 menyimpan tarif saat permintaan dibuat.

```json
{
  "idempotency_key": "638fe419-74bb-4977-92c4-10cbd48a2304",
  "lab_test_ids": ["1", "2"],
  "clinical_notes": "Catatan klinis fiktif"
}
```

Ambil ID item dari detail permintaan Node.js. Kirim tepat satu hasil per item. `unit`, `reference_range`, dan `notes` bersifat opsional. Payload berikut menggunakan satu item dengan hasil simulasi.

```json
{
  "items": [
    {
      "lab_order_item_id": "7",
      "result_value": "Hasil pemeriksaan fiktif",
      "unit": "unit simulasi",
      "reference_range": "Rujukan fiktif",
      "notes": "Catatan fiktif"
    }
  ]
}
```

Node.js memeriksa tipe dan ukuran body JSON, lalu meneruskan detail dan penyimpanan hasil ke endpoint Yii2 dengan path yang sama. Yii2 memvalidasi isian dan menyimpan hasil, audit, dan penyesuaian tagihan dalam satu transaksi. Jika hasil yang sama sudah tersimpan, respons memuat `replayed: true`. Penggunaan ulang kunci permintaan dengan isian berbeda atau perubahan hasil final menghasilkan `409`. Isian hasil yang tidak valid atau belum lengkap menghasilkan `422` dengan `errors`. Node.js menghasilkan `503` saat layanan yang dibutuhkan tidak tersedia.

Folder **Laboratorium** menguji antrean Node.js, detail dan pengiriman ulang hasil demo, serta riwayat dokter di Yii2. [Koleksi SIMRS](../postman/SIMRS.postman_collection.json)
