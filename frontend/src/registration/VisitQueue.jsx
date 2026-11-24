import { Alert, Button, Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { ListPagination } from '../components/ListPagination.jsx';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { SelectField } from '../components/SelectField.jsx';
import { cancelVisit, listQueue } from '../service/registrationService.js';
import { VisitTable, visitStatuses } from './VisitTable.jsx';

export function VisitQueue({ date, token, canRegister, canExamine, onUnauthorized }) {
  const [clinicId, setClinicId] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [clinics, setClinics] = useState([]);
  const [queue, setQueue] = useState(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [cancelling, setCancelling] = useState(null);
  const [message, setMessage] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setQueue(null);
    setLoadError('');

    async function loadQueue() {
      try {
        const data = await listQueue({ date, status, page, clinicId }, { token, signal });
        if (signal.aborted) return;

        setClinics(data.clinics);
        const lastPage = Math.max(1, Math.ceil(data.total / data.page_size));
        if (page > lastPage) setPage(lastPage);
        else setQueue(data);
      } catch (error) {
        if (signal.aborted) return;
        if (error.status === 401) onUnauthorized();
        else setLoadError(error.message);
      }
    }

    loadQueue();
    return () => controller.abort();
  }, [date, status, page, clinicId, reloadCount, token, onUnauthorized]);

  function reloadQueue() {
    setReloadCount((count) => count + 1);
  }

  function changeClinic(event) {
    setClinicId(event.target.value);
    setPage(1);
  }

  function changeStatus(event) {
    setStatus(event.target.value);
    setPage(1);
  }

  async function cancel(visit) {
    if (!window.confirm('Batalkan antrean nomor ' + visit.queue_number + ' untuk ' + visit.patient_name + '?')) return;

    setCancelling(visit.id);
    setMessage('');
    setActionError('');
    try {
      await cancelVisit(visit.id, { token });
      setMessage('Kunjungan dibatalkan.');
      reloadQueue();
    } catch (failure) {
      if (failure.status === 401) onUnauthorized();
      else setActionError(failure.message);
      if (failure.status === 409) reloadQueue();
    } finally {
      setCancelling(null);
    }
  }

  return (
    <Paper component="section" variant="outlined" aria-labelledby="queue-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
      <Typography id="queue-title" component="h2" variant="h6">Antrean kunjungan</Typography>
      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <SelectField id="queue-clinic" label="Poli" value={clinicId} onChange={changeClinic} className="min-w-36">
          <option value="">Semua poli</option>
          {clinics.map((clinic) => <option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}
        </SelectField>
        <SelectField id="queue-status" label="Status antrean" value={status} onChange={changeStatus} className="min-w-48">
          <option value="all">Semua status</option>
          {Object.entries(visitStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </SelectField>
        {!loadError && <Button variant="outlined" onClick={reloadQueue} disabled={queue === null}>Muat ulang</Button>}
      </div>
      {message && <Alert severity="success" role="status">{message}</Alert>}
      {actionError && <Alert severity="error">{actionError}</Alert>}
      <LoadStatus loading={queue === null} text="Memuat antrean…" error={loadError} onRetry={reloadQueue} />
      {queue && (
        <>
          {queue.items.length > 0 ? (
            <VisitTable
              items={queue.items}
              cancelling={cancelling}
              onCancel={canRegister ? cancel : undefined}
              canExamine={canExamine}
            />
          ) : (
            <Typography color="text.secondary">Belum ada antrean yang cocok.</Typography>
          )}
          <ListPagination data={queue} onPage={setPage} />
        </>
      )}
    </Paper>
  );
}
