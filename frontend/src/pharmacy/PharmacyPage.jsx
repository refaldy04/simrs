import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, TextField, Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { ListPagination } from '../components/ListPagination.jsx';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { SelectField } from '../components/SelectField.jsx';
import { PrescriptionCard, PrescriptionItems, prescriptionStatuses } from '../prescription/PrescriptionCard.jsx';
import { dispensePrescription, getPharmacyPrescriptions } from '../service/prescriptionService.js';

function insufficientStock(items) {
  const totals = new Map();
  for (const item of items) {
    totals.set(item.medicine_id, (totals.get(item.medicine_id) ?? 0) + item.quantity);
  }

  return items.some((item) => !item.medicine_active || item.stock_quantity < totals.get(item.medicine_id));
}

export function PharmacyPage({ token, onUnauthorized }) {
  const [searchDraft, setSearchDraft] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);
  const [selection, setSelection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadQueue() {
      setData(null);
      setLoadError('');
      try {
        const result = await getPharmacyPrescriptions({ term, status, page }, { token, signal });
        if (signal.aborted) return;

        const lastPage = Math.max(1, Math.ceil(result.total / result.page_size));
        if (page > lastPage) setPage(lastPage);
        else setData(result);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setLoadError(failure.message);
      }
    }

    loadQueue();
    return () => controller.abort();
  }, [term, status, page, token, reloadCount, onUnauthorized]);

  function reload() {
    setReloadCount((count) => count + 1);
  }

  function search(event) {
    event.preventDefault();
    setTerm(searchDraft.trim());
    setPage(1);
    reload();
  }

  function choosePrescription(prescription) {
    setSaveError('');
    setSelection(prescription);
  }

  async function dispense() {
    if (saving) return;

    setSaving(true);
    setSaveError('');
    setNotice('');
    try {
      const { prescription } = await dispensePrescription(selection.id, { token });
      setNotice('Penyerahan obat untuk ' + prescription.patient_name + ' tercatat.');
      setSelection(null);
      reload();
    } catch (failure) {
      if (failure.status === 401) onUnauthorized();
      else setSaveError(failure.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4">
      <Paper component="section" variant="outlined" aria-labelledby="pharmacy-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
        <Typography id="pharmacy-title" component="h2" variant="h6">Farmasi</Typography>
        <div className="grid gap-3 sm:flex sm:flex-wrap">
          <form className="flex min-w-0 gap-2" onSubmit={search}>
            <TextField
              id="pharmacy-search"
              label="Nama atau no. rekam medis"
              type="search"
              size="small"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              slotProps={{ htmlInput: { maxLength: 150 } }}
              className="min-w-0"
            />
            <Button variant="outlined" type="submit">Cari</Button>
          </form>
          <SelectField id="pharmacy-status" label="Status resep" value={status} onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}>
            {Object.entries(prescriptionStatuses).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
            <option value="all">Semua status</option>
          </SelectField>
          {!loadError && <Button variant="outlined" onClick={reload}>Muat ulang</Button>}
        </div>
        {notice && <Alert severity="success" role="status">{notice}</Alert>}
        <LoadStatus loading={!data} text="Memuat antrean resep…" error={loadError} onRetry={reload} />
        {data?.items.length === 0 && <Typography color="text.secondary">Belum ada resep untuk filter ini.</Typography>}
        {data?.items.map((prescription) => (
          <PrescriptionCard key={prescription.id} prescription={prescription} showPatient showStock>
            {prescription.status === 'pending' && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="contained" onClick={() => choosePrescription(prescription)}>Serahkan obat</Button>
                {insufficientStock(prescription.items) && <Typography color="warning.dark">Stok resep kurang.</Typography>}
              </div>
            )}
          </PrescriptionCard>
        ))}
        {data && <ListPagination data={data} onPage={setPage} showTotal />}
      </Paper>
      {selection && (
        <Dialog open fullWidth maxWidth="sm" aria-labelledby="dispense-title" onClose={saving ? undefined : () => choosePrescription(null)}>
          <DialogTitle id="dispense-title">Konfirmasi penyerahan obat</DialogTitle>
          <DialogContent>
            <div className="grid min-w-0 gap-3">
              <Typography>{selection.patient_name} · {selection.medical_record_no}</Typography>
              <PrescriptionItems items={selection.items} showStock />
              {saveError && <Alert severity="error">{saveError}</Alert>}
            </div>
          </DialogContent>
          <DialogActions>
            {saveError && (
              <Button onClick={() => { choosePrescription(null); reload(); }} disabled={saving}>Muat ulang stok</Button>
            )}
            <Button onClick={() => choosePrescription(null)} disabled={saving}>Batal</Button>
            <Button variant="contained" onClick={dispense} disabled={saving}>
              {saving ? 'Memproses…' : 'Konfirmasi penyerahan'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
