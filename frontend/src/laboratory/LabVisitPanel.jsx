import { Alert, Button, Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { ListPagination } from '../components/ListPagination.jsx';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { createLabOrder, getLabHistory, getVisitLab } from '../service/labService.js';
import { LabOrderCard } from './LabOrderCard.jsx';
import { LabOrderForm } from './LabOrderForm.jsx';

function LabHistory({ visitId, token, refresh, onUnauthorized }) {
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadHistory() {
      setError('');
      setHistory(null);
      try {
        const data = await getLabHistory(visitId, page, { token, signal });
        if (!signal.aborted) setHistory(data);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setError(failure.message);
      }
    }

    loadHistory();
    return () => controller.abort();
  }, [visitId, token, page, refresh, retry, onUnauthorized]);

  return (
    <Paper component="section" variant="outlined" aria-labelledby="lab-history-title" className="grid min-w-0 gap-3 p-4 sm:p-6">
      <Typography id="lab-history-title" component="h2" variant="h6">Riwayat hasil lab pasien</Typography>
      <LoadStatus loading={!history} text="Memuat riwayat hasil lab…" error={error} onRetry={() => setRetry((count) => count + 1)} />
      {history?.items.length === 0 && <Typography color="text.secondary">Belum ada hasil laboratorium.</Typography>}
      {history?.items.map((order) => <LabOrderCard key={order.id} order={order} />)}
      {history && <ListPagination data={history} onPage={setPage} />}
    </Paper>
  );
}

export function LabVisitPanel({ visitId, token, canRequest, onStatusChange, onUnauthorized }) {
  const [context, setContext] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadVisit() {
      setLoadError('');
      try {
        const data = await getVisitLab(visitId, { token, signal });
        if (signal.aborted) return;
        setContext(data);
        onStatusChange(data.visit_status);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setLoadError(failure.message);
      }
    }

    loadVisit();
    return () => controller.abort();
  }, [visitId, token, refresh, onStatusChange, onUnauthorized]);

  function reload() {
    setRefresh((count) => count + 1);
  }

  async function create(body) {
    setSaving(true);
    setSaveError(null);
    setNotice('');
    try {
      const result = await createLabOrder(visitId, body, { token });
      const { order } = result;
      setContext((current) => ({
        ...current,
        orders: [order, ...current.orders.filter((entry) => entry.id !== order.id)],
      }));
      setNotice(result.replayed ? 'Permintaan sudah tercatat.' : 'Permintaan lab tersimpan.');
      reload();
      return true;
    } catch (failure) {
      if (failure.status === 401) onUnauthorized();
      else setSaveError(failure);
      return false;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <Paper component="section" variant="outlined" aria-labelledby="lab-visit-title" className="grid min-w-0 gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Typography component="h2" variant="h6" id="lab-visit-title">Permintaan lab kunjungan</Typography>
          <Button onClick={reload} disabled={saving}>Muat ulang</Button>
        </div>
        <LoadStatus loading={!context} text="Memuat permintaan…" error={loadError} onRetry={reload} />
        {notice && <Alert severity="success" role="status">{notice}</Alert>}
        {canRequest && context?.can_order && (
          context.tests.length > 0
            ? <LabOrderForm tests={context.tests} saving={saving} error={saveError} onCreate={create} />
            : <Typography color="text.secondary">Belum ada pemeriksaan lab aktif di master.</Typography>
        )}
        {canRequest && context?.visit_status === 'waiting' && (
          <Typography color="text.secondary">Simpan pemeriksaan untuk mulai membuat permintaan lab.</Typography>
        )}
        {context?.orders.length === 0 && <Typography color="text.secondary">Belum ada permintaan pada kunjungan ini.</Typography>}
        {context?.orders.map((order) => <LabOrderCard key={order.id} order={order} />)}
      </Paper>
      <LabHistory visitId={visitId} token={token} refresh={refresh} onUnauthorized={onUnauthorized} />
    </div>
  );
}
