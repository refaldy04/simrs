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
