import { Pool } from 'pg';

export const db = new Pool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'simrs',
  user: process.env.DB_USER ?? 'simrs',
  password: process.env.DB_PASSWORD,
  max: 5,
  connectionTimeoutMillis: 2000,
  statement_timeout: 4000,
});

db.on('error', (error) => {
  console.error('Koneksi PostgreSQL Node.js terputus.', error.code ?? error.name);
});
