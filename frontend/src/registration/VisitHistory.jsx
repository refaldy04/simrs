import { Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { ListPagination } from '../components/ListPagination.jsx';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { listPatientVisits } from '../service/registrationService.js';
import { VisitTable } from './VisitTable.jsx';

export function VisitHistory({ patientId, page, reloadCount, token, onPage, onReload, onUnauthorized }) {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setHistory(null);
    setError('');

    async function loadHistory() {
      try {
        const data = await listPatientVisits(patientId, page, { token, signal });
        if (!signal.aborted) setHistory(data);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setError(failure.message);
      }
    }

    loadHistory();
    return () => controller.abort();
  }, [patientId, page, reloadCount, token, onUnauthorized]);

  return (
    <Paper component="section" variant="outlined" aria-labelledby="visit-history-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
      <Typography id="visit-history-title" component="h2" variant="h6">Riwayat kunjungan</Typography>
      <LoadStatus loading={history === null} text="Memuat riwayat…" error={error} onRetry={onReload} />
      {history && (
        <>
          {history.items.length > 0 ? (
            <VisitTable items={history.items} history />
          ) : (
            <Typography color="text.secondary">Belum ada riwayat kunjungan pasien ini.</Typography>
          )}
          <ListPagination data={history} onPage={onPage} />
        </>
      )}
    </Paper>
  );
}
