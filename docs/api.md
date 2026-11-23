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
