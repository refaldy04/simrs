import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { SelectField } from '../components/SelectField.jsx';
import { formatCurrency } from '../format.js';

export function ProcedureError({ error, onReload }) {
  if (!error) return null;

  return (
    <Alert
      severity="error"
      action={error.status === 409 && <Button type="button" size="small" color="inherit" onClick={onReload}>Muat ulang data</Button>}
    >
      {error.message}
    </Alert>
  );
}

export function ProcedureForm({ options, requiresReason, saving, error, onAdd, onReload }) {
  const [procedureId, setProcedureId] = useState('');
  const selected = options.find((option) => option.id === procedureId);
  const fields = error?.fields ?? {};

  async function handleSubmit(event) {
    event.preventDefault();
    if (!selected || saving) return;

    const form = event.currentTarget;
    const values = new FormData(form);
    const saved = await onAdd({
      procedure_id: selected.id,
      quantity: Number(values.get('quantity')),
      expected_unit_price: selected.price,
      reason: values.get('reason'),
    });
    if (saved) {
      form.reset();
      setProcedureId('');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg border border-slate-200 p-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <SelectField
          id="procedure-picker"
          name="procedure_id"
          label="Tindakan medis"
          value={selected?.id ?? ''}
          onChange={(event) => setProcedureId(event.target.value)}
          required
          disabled={saving}
          error={Boolean(fields.procedure_id)}
          helperText={fields.procedure_id}
        >
          <option value="">Pilih tindakan</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name} · {formatCurrency(option.price)}
            </option>
          ))}
        </SelectField>
        <TextField
          name="quantity"
          label="Jumlah"
          size="small"
          type="number"
          defaultValue={1}
          slotProps={{ htmlInput: { min: 1, max: 2147483647, step: 1 } }}
          required
          disabled={saving}
          error={Boolean(fields.quantity)}
          helperText={fields.quantity}
        />
      </div>
      {selected && <Typography variant="body2">Tarif satuan <strong>{formatCurrency(selected.price)}</strong></Typography>}
      {requiresReason && (
        <TextField
          name="reason"
          label="Alasan perubahan"
          multiline
          minRows={2}
          required
          disabled={saving}
          error={Boolean(fields.reason)}
          helperText={fields.reason}
        />
      )}
      <ProcedureError error={error} onReload={onReload} />
      <Button type="submit" variant="contained" className="justify-self-start" disabled={saving || !selected}>
        {saving ? 'Menyimpan…' : 'Tambah tindakan'}
      </Button>
    </form>
  );
}

export function ProcedureDialog({ selection, requiresReason, saving, error, onSave, onClose, onReload }) {
  const { item, cancel } = selection;
  const fields = error?.fields ?? {};

  function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const values = new FormData(event.currentTarget);
    const body = { expected_quantity: item.quantity, reason: values.get('reason') };
    if (!cancel) body.quantity = Number(values.get('quantity'));
    onSave(body);
  }

  return (
    <Dialog open fullWidth maxWidth="xs" aria-labelledby="procedure-dialog-title" onClose={saving ? undefined : onClose}>
      <form onSubmit={handleSubmit}>
        <DialogTitle id="procedure-dialog-title">{cancel ? 'Batalkan tindakan' : 'Ubah jumlah tindakan'}</DialogTitle>
        <DialogContent>
          <div className="grid gap-4 pt-1">
            <div>
              <Typography>{item.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {item.quantity} × {formatCurrency(item.unit_price)}
              </Typography>
            </div>
            {!cancel && (
              <TextField
                name="quantity"
                label="Jumlah"
                autoFocus
                type="number"
                defaultValue={item.quantity}
                slotProps={{ htmlInput: { min: 1, max: 2147483647, step: 1 } }}
                required
                disabled={saving}
                error={Boolean(fields.quantity)}
                helperText={fields.quantity}
              />
            )}
            {requiresReason && (
              <TextField
                name="reason"
                label="Alasan perubahan"
                multiline
                minRows={2}
                required
                disabled={saving}
                error={Boolean(fields.reason)}
                helperText={fields.reason}
              />
            )}
            <ProcedureError error={error} onReload={onReload} />
          </div>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={onClose} disabled={saving}>Tutup</Button>
          <Button type="submit" variant="contained" color={cancel ? 'error' : 'primary'} disabled={saving}>
            {cancel ? 'Batalkan tindakan' : 'Simpan perubahan'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
