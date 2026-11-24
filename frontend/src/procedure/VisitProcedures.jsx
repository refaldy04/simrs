import { Alert, Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { addVisitProcedure, cancelVisitProcedure, getVisitProcedures, updateVisitProcedure } from '../service/procedureService.js';
import { BillingComponents } from './BillingComponents.jsx';
import { ProcedureDialog, ProcedureForm } from './ProcedureForm.jsx';
import { ProcedureTable } from './ProcedureTable.jsx';

export function VisitProcedures({ visitId, visitStatus, token, onStatusChange, onUnauthorized }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  const [selection, setSelection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadProcedures() {
      try {
        const result = await getVisitProcedures(visitId, { token, signal });
        if (!signal.aborted) setData(result);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setLoadError(failure.message);
      }
    }

    loadProcedures();
    return () => controller.abort();
  }, [visitId, visitStatus, token, reloadCount, onUnauthorized]);

  function reload() {
    setData(null);
    setSelection(null);
    setLoadError('');
    setError(null);
    setNotice('');
    setReloadCount((value) => value + 1);
  }

  function selectAction(next) {
    setSelection(next);
    setError(null);
    setNotice('');
  }

  async function save(request, successMessage) {
    setSaving(true);
    setError(null);
    setNotice('');
    try {
      const result = await request();
      setData(result);
      setSelection(null);
      setNotice(successMessage);
      onStatusChange(result.visit_status);
      return true;
    } catch (failure) {
      if (failure.status === 401) onUnauthorized();
      else setError(failure);
      return false;
    } finally {
      setSaving(false);
    }
  }

  function add(body) {
    return save(() => addVisitProcedure(visitId, body, { token }), 'Tindakan ditambahkan.');
  }

  function change(body) {
    const { item, cancel } = selection;
    if (cancel) {
      return save(() => cancelVisitProcedure(visitId, item.id, body, { token }), 'Tindakan dibatalkan.');
    }

    return save(() => updateVisitProcedure(visitId, item.id, body, { token }), 'Jumlah tindakan diperbarui.');
  }

  const recordedIds = new Set(data?.items.filter((item) => !item.cancelled_at).map((item) => item.procedure_id));
  const available = data?.options.filter((option) => !recordedIds.has(option.id)) ?? [];

  return (
    <div className="grid min-w-0 gap-4">
      <Paper component="section" variant="outlined" aria-labelledby="visit-procedures-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
        <Typography id="visit-procedures-title" component="h2" variant="h6">Tindakan medis</Typography>
        <LoadStatus loading={!data} text="Memuat tindakan…" error={loadError} onRetry={reload} />
        {notice && <Alert severity="success" role="status">{notice}</Alert>}
        {data && (
          <>
            {!data.can_write && <Alert severity="info">Simpan pemeriksaan untuk mulai mencatat tindakan.</Alert>}
            {data.can_write && available.length > 0 && (
              <ProcedureForm
                options={available}
                requiresReason={data.requires_revision_reason}
                saving={saving}
                error={selection ? null : error}
                onAdd={add}
                onReload={reload}
              />
            )}
            {data.can_write && available.length === 0 && (
              <Typography color="text.secondary">
                {data.options.length === 0 ? 'Belum ada master tindakan aktif.' : 'Semua pilihan tindakan sudah tercatat.'}
              </Typography>
            )}
            <ProcedureTable items={data.items} canWrite={data.can_write} saving={saving} onSelect={selectAction} />
          </>
        )}
      </Paper>
      {data && <BillingComponents billing={data.billing} />}
      {selection && (
        <ProcedureDialog
          selection={selection}
          requiresReason={data.requires_revision_reason}
          saving={saving}
          error={error}
          onSave={change}
          onClose={() => selectAction(null)}
          onReload={reload}
        />
      )}
    </div>
  );
}
