import { Alert, Button, TextField, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { SelectField } from '../components/SelectField.jsx';
import { formatCurrency } from '../format.js';

function emptyItem(key) {
  return { key, medicine_id: '', dose: '', frequency: '', quantity: '1' };
}

export function PrescriptionForm({ medicines, saving, error, onCreate }) {
  const [items, setItems] = useState(() => [emptyItem(0)]);
  const nextItem = useRef(1);
  const request = useRef(null);
  const fields = error?.fields ?? {};

  function addItem() {
    const key = nextItem.current++;
    setItems((current) => [...current, emptyItem(key)]);
  }

  function removeItem(key) {
    setItems((current) => current.filter((item) => item.key !== key));
  }

  function changeItem(key, event) {
    const { name, value } = event.target;
    setItems((current) => current.map((item) => item.key === key ? { ...item, [name]: value } : item));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const clinicalItems = items.map(({ medicine_id, dose, frequency, quantity }) => ({
      medicine_id,
      dose: dose.trim(),
      frequency: frequency.trim(),
      quantity: Number(quantity),
    }));
    const signature = JSON.stringify(clinicalItems);
    if (request.current?.signature !== signature) {
      request.current = { signature, key: crypto.randomUUID() };
    }
    const saved = await onCreate({
      idempotency_key: request.current.key,
      items: clinicalItems.map((item) => ({
        ...item,
        expected_unit_price: medicines.find((medicine) => medicine.id === item.medicine_id)?.price ?? null,
      })),
    });
    if (saved) {
      request.current = null;
      setItems([emptyItem(nextItem.current++)]);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      {fields.items && <Alert severity="error">{fields.items}</Alert>}
      {items.map((item, index) => {
        const medicine = medicines.find((option) => option.id === item.medicine_id);
        const field = 'items.' + index + '.';

        return (
          <fieldset key={item.key} className="grid min-w-0 gap-3 rounded-lg border border-slate-200 p-3" disabled={saving}>
            <legend className="px-1 text-sm font-semibold">Obat {index + 1}</legend>
            <div className="flex flex-wrap items-center gap-2">
              <SelectField
                id={'prescription-medicine-' + item.key}
                name="medicine_id"
                label="Obat"
                value={medicine?.id ?? ''}
                onChange={(event) => changeItem(item.key, event)}
                error={Boolean(fields[field + 'medicine_id'])}
                helperText={fields[field + 'medicine_id']}
                className="min-w-0 flex-1"
                required
              >
                <option value="">Pilih obat</option>
                {medicines.map((option) => (
                  <option key={option.id} value={option.id} disabled={option.stock_quantity === 0}>
                    {option.name} · Stok {option.stock_quantity} {option.unit}
                  </option>
                ))}
              </SelectField>
              {items.length > 1 && (
                <Button size="small" color="error" aria-label={'Hapus obat ' + (index + 1)} onClick={() => removeItem(item.key)}>
                  Hapus
                </Button>
              )}
            </div>
            {medicine && (
              <Typography variant="body2" color="text.secondary">
                Stok {medicine.stock_quantity} {medicine.unit} · {formatCurrency(medicine.price)} per {medicine.unit}
              </Typography>
            )}
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem]">
              <TextField
                name="dose"
                label="Dosis"
                size="small"
                value={item.dose}
                onChange={(event) => changeItem(item.key, event)}
                slotProps={{ htmlInput: { maxLength: 100 } }}
                error={Boolean(fields[field + 'dose'])}
                helperText={fields[field + 'dose']}
                required
              />
              <TextField
                name="frequency"
                label="Frekuensi"
                size="small"
                value={item.frequency}
                onChange={(event) => changeItem(item.key, event)}
                slotProps={{ htmlInput: { maxLength: 100 } }}
                error={Boolean(fields[field + 'frequency'])}
                helperText={fields[field + 'frequency']}
                required
              />
              <TextField
                name="quantity"
                label="Jumlah"
                size="small"
                type="number"
                value={item.quantity}
                onChange={(event) => changeItem(item.key, event)}
                slotProps={{ htmlInput: { min: 1, max: 2147483647, step: 1 } }}
                error={Boolean(fields[field + 'quantity'])}
                helperText={fields[field + 'quantity']}
                required
              />
            </div>
          </fieldset>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <Button variant="outlined" disabled={saving} onClick={addItem}>Tambah obat</Button>
        <Button type="submit" variant="contained" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan resep'}</Button>
      </div>
    </form>
  );
}
