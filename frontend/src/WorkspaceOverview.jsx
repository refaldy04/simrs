import { Chip, Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { checkCoreHealth, checkNodeHealth } from './service/healthService.js';

const permissionLabels = {
  'master.manage': 'Kelola master data',
  'users.manage': 'Kelola pengguna',
  'dashboard.read': 'Lihat dashboard',
  'audit.read': 'Lihat riwayat perubahan',
  'patients.manage': 'Kelola data pasien',
  'visits.register': 'Daftarkan kunjungan',
  'visits.queue': 'Lihat antrean',
  'examinations.manage': 'Catat pemeriksaan dan diagnosis',
  'procedures.manage': 'Catat tindakan medis',
  'prescriptions.create': 'Tulis resep',
  'prescriptions.dispense': 'Proses penyerahan obat',
  'lab.request': 'Ajukan pemeriksaan lab',
  'lab.requests.read': 'Lihat permintaan lab',
  'lab.results.read': 'Lihat hasil lab',
  'lab.results.write': 'Catat hasil lab',
  'billing.manage': 'Kelola tagihan dan pembayaran',
};

const serviceStatuses = {
  checking: { label: 'Memeriksa…', color: 'default' },
  ready: { label: 'Siap', color: 'success' },
  unavailable: { label: 'Tidak tersedia', color: 'error' },
};

function ServiceStatus({ name, checkHealth }) {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadStatus() {
      try {
        const ready = await checkHealth(signal);
        if (!signal.aborted) setStatus(ready ? 'ready' : 'unavailable');
      } catch {
        if (!signal.aborted) setStatus('unavailable');
      }
    }

    loadStatus();
    return () => controller.abort();
  }, [checkHealth]);

  const { label, color } = serviceStatuses[status];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-3">
      <Typography component="dt">{name}</Typography>
      <dd aria-live="polite" data-status={status}>
        <Chip size="small" label={label} color={color} variant="outlined" />
      </dd>
    </div>
  );
}

export function WorkspaceOverview({ permissions }) {
  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      <Paper component="section" variant="outlined" aria-labelledby="permissions-title" className="grid gap-2 p-4 sm:p-6">
        <Typography id="permissions-title" component="h2" variant="h6">Hak akses</Typography>
        {permissions.length > 0 ? (
          <ul className="divide-y divide-slate-200">
            {permissions.map((permission) => (
              <Typography component="li" key={permission} className="py-3">
                {permissionLabels[permission] ?? permission}
              </Typography>
            ))}
          </ul>
        ) : (
          <Typography>Belum ada izin untuk peran ini.</Typography>
        )}
      </Paper>
      <Paper component="section" variant="outlined" aria-labelledby="status-title" className="grid gap-2 p-4 sm:p-6">
        <Typography id="status-title" component="h2" variant="h6">Status layanan</Typography>
        <dl className="divide-y divide-slate-200">
          <ServiceStatus name="Yii2 dan PostgreSQL" checkHealth={checkCoreHealth} />
          <ServiceStatus name="Node.js" checkHealth={checkNodeHealth} />
        </dl>
      </Paper>
    </div>
  );
}
