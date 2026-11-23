# Arsitektur SIMRS

React menyediakan antarmuka pelayanan rawat jalan. Yii2 menangani API dan logika bisnis utama SIMRS. Node.js menyediakan API pendukung untuk integrasi laboratorium dan dashboard. PostgreSQL menjadi basis data utama.

Pada lingkungan pengembangan, proxy Vite meneruskan permintaan `/api/core/` ke Yii2 dan `/api/services/` ke Node.js. Yii2 menggunakan PDO untuk menyambung ke PostgreSQL melalui jaringan Docker Compose.

Diagram arsitektur dan pembagian tanggung jawab atas data antara Yii2 dan Node.js diisi pada tahap desain arsitektur.
