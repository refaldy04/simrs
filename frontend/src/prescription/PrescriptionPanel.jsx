import { Alert, Button, Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { cancelPrescription, createPrescription, getVisitPrescriptions } from '../service/prescriptionService.js';
import { MedicineHistory } from './MedicineHistory.jsx';
import { PrescriptionCard } from './PrescriptionCard.jsx';
import { PrescriptionForm } from './PrescriptionForm.jsx';

export function PrescriptionPanel({ visitId, visitStatus, token, active, onUnauthorized }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!active) return;

    const controller = new AbortController();
    const { signal } = controller;

    async function loadPrescriptions() {
      setLoadError('');
      try {
        const result = await getVisitPrescriptions(visitId, { token, signal });
        if (!signal.aborted) setData(result);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setLoadError(failure.message);
      }
    }

    loadPrescriptions();
    return () => controller.abort();
  }, [visitId, visitStatus, token, active, reloadCount, onUnauthorized]);

  function reload() {
    setSaveError(null);
    setReloadCount((count) => count + 1);
  }

  async function save(request, successMessage) {
    setSaving(true);
    setSaveError(null);
    setNotice('');
    try {
      const { prescription } = await request();
      setData((current) => ({
        ...current,
        prescriptions: [prescription, ...current.prescriptions.filter((row) => row.id !== prescription.id)],
      }));
      setNotice(successMessage);
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

  function create(body) {
    return save(() => createPrescription(visitId, body, { token }), 'Resep disimpan.');
  }

  function cancel(prescription) {
    if (window.confirm('Batalkan resep #' + prescription.id + '?')) {
      return save(() => cancelPrescription(visitId, prescription.id, { token }), 'Resep dibatalkan.');
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <Paper component="section" variant="outlined" aria-labelledby="prescriptions-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Typography id="prescriptions-title" component="h2" variant="h6">Resep kunjungan</Typography>
          <Button size="small" variant="outlined" onClick={reload} disabled={saving}>Muat ulang resep dan stok</Button>
        </div>
        <LoadStatus loading={!data} text="Memuat resep…" error={loadError} onRetry={reload} />
        {notice && <Alert severity="success" role="status">{notice}</Alert>}
        {saveError && <Alert severity="error">{saveError.message}</Alert>}
        {data && (
          <>
            {!data.can_create && <Alert severity="info">Simpan hasil pemeriksaan untuk mulai membuat resep.</Alert>}
            {data.can_create && data.medicines.length > 0 && (
              <PrescriptionForm medicines={data.medicines} saving={saving} error={saveError} onCreate={create} />
            )}
            {data.can_create && data.medicines.length === 0 && <Typography>Belum ada master obat aktif.</Typography>}
            {data.prescriptions.length === 0 && <Typography color="text.secondary">Belum ada resep untuk kunjungan ini.</Typography>}
            {data.prescriptions.map((prescription) => (
              <PrescriptionCard key={prescription.id} prescription={prescription}>
                {prescription.status === 'pending' && (
                  <Button className="justify-self-start" color="error" disabled={saving} onClick={() => cancel(prescription)}>
                    Batalkan resep
                  </Button>
                )}
              </PrescriptionCard>
            ))}
          </>
        )}
      </Paper>
      <MedicineHistory visitId={visitId} token={token} active={active} reloadCount={reloadCount} onUnauthorized={onUnauthorized} />
    </div>
  );
}
