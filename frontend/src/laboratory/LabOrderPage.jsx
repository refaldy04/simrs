import { Alert, Button, Paper, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { getLabOrder, saveLabResults } from '../service/labService.js';
import { LabOrderCard } from './LabOrderCard.jsx';

const resultFields = [
  { name: 'result_value', label: 'Hasil pemeriksaan', maxLength: 2000, required: true, multiline: true },
  { name: 'unit', label: 'Satuan', maxLength: 30 },
  { name: 'reference_range', label: 'Nilai rujukan', maxLength: 120 },
  { name: 'notes', label: 'Catatan hasil', maxLength: 2000, multiline: true },
];

function LabResultForm({ order, saving, error, onSave }) {
  const [items, setItems] = useState(() => order.items.map((item) => ({
    lab_order_item_id: item.id,
    result_value: item.result?.result_value ?? '',
    unit: item.result?.unit ?? '',
    reference_range: item.result?.reference_range ?? '',
    notes: item.result?.notes ?? '',
  })));
  const fields = error?.fields ?? {};

  function changeField(id, name, value) {
    setItems((current) => current.map((item) => (
      item.lab_order_item_id === id ? { ...item, [name]: value } : item
    )));
  }

  function submit(event) {
    event.preventDefault();
    if (!saving) onSave(items);
  }

  return (
    <Paper component="section" variant="outlined" aria-labelledby="lab-results-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
      <Typography id="lab-results-title" component="h2" variant="h6">Catat hasil pemeriksaan</Typography>
      {error && <Alert severity="error">{fields.items ?? error.message}</Alert>}
      <form onSubmit={submit} className="grid gap-3">
        {items.map((item, index) => (
          <fieldset disabled={saving} key={item.lab_order_item_id} className="grid min-w-0 gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold">{order.items[index].name}</legend>
            {resultFields.map(({ name, label, maxLength, required, multiline }) => {
              const field = fields['items.' + index + '.' + name];
              return (
                <TextField
                  key={name}
                  label={label}
                  size="small"
                  className={multiline ? 'sm:col-span-2' : ''}
                  value={item[name]}
                  onChange={(event) => changeField(item.lab_order_item_id, name, event.target.value)}
                  required={required}
                  multiline={multiline}
                  error={Boolean(field)}
                  helperText={field}
                  slotProps={{ htmlInput: { maxLength } }}
                />
              );
            })}
          </fieldset>
        ))}
        <Button variant="contained" type="submit" className="justify-self-start" disabled={saving || items.length === 0}>
          {saving ? 'Menyimpan…' : 'Simpan hasil'}
        </Button>
      </form>
    </Paper>
  );
}

export function LabOrderPage({ orderId, token, canWriteResults, onUnauthorized }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadOrder() {
      setError('');
      try {
        const data = await getLabOrder(orderId, { token, signal });
        if (!signal.aborted) setOrder(data);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setError(failure.message);
      }
    }

    loadOrder();
    return () => controller.abort();
  }, [orderId, token, refresh, onUnauthorized]);

  function reload() {
    setSaveError(null);
    setRefresh((count) => count + 1);
  }

  async function save(items) {
    setSaving(true);
    setSaveError(null);
    setNotice('');
    try {
      const result = await saveLabResults(orderId, items, { token });
      setOrder(result.order);
      setNotice(result.replayed ? 'Hasil pemeriksaan sudah tercatat.' : 'Hasil pemeriksaan disimpan.');
      reload();
    } catch (failure) {
      if (failure.status === 401) onUnauthorized();
      else setSaveError(failure);
    } finally {
      setSaving(false);
    }
  }

  const canSave = canWriteResults && ['requested', 'in_progress'].includes(order?.status);

  return (
    <div className="grid min-w-0 gap-4">
      <Paper component="section" variant="outlined" aria-labelledby="lab-order-title" className="grid min-w-0 gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Typography id="lab-order-title" component="h2" variant="h6">Permintaan laboratorium</Typography>
          <div className="flex flex-wrap gap-2">
            <Button onClick={reload} disabled={saving}>Muat ulang</Button>
            <Button href="#/laboratory" variant="outlined">Kembali ke antrean lab</Button>
          </div>
        </div>
        <LoadStatus loading={!order} text="Memuat permintaan lab…" error={error} onRetry={reload} />
        {notice && <Alert severity="success" role="status">{notice}</Alert>}
        {order && <LabOrderCard order={order} showPatient />}
      </Paper>
      {canSave && <LabResultForm order={order} saving={saving} error={saveError} onSave={save} />}
    </div>
  );
}
