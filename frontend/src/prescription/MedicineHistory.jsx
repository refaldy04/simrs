import { Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { ListPagination } from '../components/ListPagination.jsx';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { getMedicineHistory } from '../service/prescriptionService.js';
import { PrescriptionCard } from './PrescriptionCard.jsx';

export function MedicineHistory({ visitId, token, active, reloadCount, onUnauthorized }) {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!active) return;

    const controller = new AbortController();
    const { signal } = controller;

    async function loadHistory() {
      setError('');
      try {
        const data = await getMedicineHistory(visitId, page, { token, signal });
        if (!signal.aborted) setHistory(data);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setError(failure.message);
      }
    }

    loadHistory();
    return () => controller.abort();
  }, [visitId, token, active, page, reloadCount, retry, onUnauthorized]);

  return (
    <Paper component="section" variant="outlined" aria-labelledby="medicine-history-title" className="grid min-w-0 gap-3 p-4 sm:p-6">
      <Typography id="medicine-history-title" component="h2" variant="h6">Riwayat penggunaan obat</Typography>
      <LoadStatus loading={!history} text="Memuat riwayat obat…" error={error} onRetry={() => setRetry((count) => count + 1)} />
      {history?.items.length === 0 && <Typography color="text.secondary">Belum ada obat yang diserahkan.</Typography>}
      {history?.items.map((prescription) => <PrescriptionCard key={prescription.id} prescription={prescription} />)}
      {history && <ListPagination data={history} onPage={setPage} />}
    </Paper>
  );
}
