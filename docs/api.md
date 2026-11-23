# Dokumentasi API SIMRS

## Pemeriksaan kesehatan layanan

| Metode | URL lokal bawaan | Respons saat siap |
| --- | --- | --- |
| `GET` | `http://127.0.0.1:8080/health` | `200` dengan `{"status":"ok","database":"ok"}` |
| `GET` | `http://127.0.0.1:3000/health` | `200` dengan `{"status":"ok"}` |

Yii2 menjalankan `SELECT 1` pada PostgreSQL. Jika kueri gagal, endpoint mengembalikan `503` dengan `{"status":"unavailable","database":"unavailable"}`.

Frontend menggunakan `/api/core/health` dan `/api/services/health` melalui proxy Vite. Untuk menguji API secara langsung, gunakan permintaan pemeriksaan kesehatan pada koleksi Postman. [Koleksi SIMRS](../postman/SIMRS.postman_collection.json)

Detail autentikasi, validasi, dan endpoint modul dicatat pada tahap implementasi masing-masing modul.
