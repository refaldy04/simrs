import { Alert, Button, Paper, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { SelectField } from '../components/SelectField.jsx';
import { recordPayment } from '../service/billingService.js';

export const paymentMethods = { cash: 'Tunai', non_cash: 'Non-tunai (simulasi)' };
const rejectedStatuses = [400, 403, 404, 409, 415, 422];

function storageKey(invoiceId) {
  return 'simrs.billing.pending.' + invoiceId;
}

function readPendingPayment(invoiceId) {
  try {
    const payment = JSON.parse(sessionStorage.getItem(storageKey(invoiceId)));
    return payment?.idempotency_key && payment?.amount ? payment : null;
  } catch {
    return null;
  }
}

function storePendingPayment(invoiceId, payment) {
  try {
    if (payment) sessionStorage.setItem(storageKey(invoiceId), JSON.stringify(payment));
    else sessionStorage.removeItem(storageKey(invoiceId));
  } catch {
    // State React tetap menyimpan percobaan selama halaman terbuka.
  }
}

export function PaymentForm({ invoice, token, onSaved, onRefresh, onUnauthorized }) {
  const [pending, setPending] = useState(() => readPendingPayment(invoice.id));
  const [amount, setAmount] = useState(pending?.amount ?? '');
  const [method, setMethod] = useState(pending?.method ?? 'cash');
  const [reference, setReference] = useState(pending?.external_reference ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const fields = error?.fields ?? {};

  function savePending(payment) {
    setPending(payment);
    storePendingPayment(invoice.id, payment);
  }

  async function submit(event) {
    event.preventDefault();
    if (saving || (invoice.status === 'paid' && !pending)) return;

    const body = pending ?? {
      idempotency_key: crypto.randomUUID(),
      amount: amount.trim().replace(',', '.'),
      method,
      external_reference: method === 'non_cash' ? reference.trim() || null : null,
    };
    savePending(body);
    setSaving(true);
    setError(null);

    try {
      const result = await recordPayment(invoice.id, body, { token });
      savePending(null);
      setAmount('');
      setReference('');
      onSaved(result);
    } catch (failure) {
      if (failure.status === 401) {
        onUnauthorized();
      } else {
        if (rejectedStatuses.includes(failure.status)) savePending(null);
        setError(failure);
        if (failure.status === 409) onRefresh();
      }
    } finally {
      setSaving(false);
    }
  }

  if (invoice.status === 'paid' && !pending) {
    return error ? <Alert severity="error">{error.message}</Alert> : null;
  }

  return (
    <Paper component="section" variant="outlined" aria-labelledby="payment-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
      <Typography id="payment-title" component="h2" variant="h6">Catat pembayaran</Typography>
      {pending && !saving && (
        <Alert severity="warning">
          Status pembayaran belum terkonfirmasi. Kirim ulang transaksi ini untuk memperoleh hasilnya.
        </Alert>
      )}
      {error && <Alert severity="error">{error.message}</Alert>}
      <form onSubmit={submit} className="grid gap-3">
        <div className="grid items-start gap-3 sm:grid-cols-2">
          <TextField
            name="amount"
            label="Nominal pembayaran"
            size="small"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            slotProps={{ htmlInput: { inputMode: 'decimal', maxLength: 16 } }}
            helperText={fields.amount ?? 'Masukkan nominal tanpa pemisah ribuan.'}
            error={Boolean(fields.amount)}
            disabled={saving || Boolean(pending)}
            required
          />
          <SelectField
            id="payment-method"
            label="Metode pembayaran"
            value={method}
            onChange={(event) => setMethod(event.target.value)}
            disabled={saving || Boolean(pending)}
            error={Boolean(fields.method)}
            helperText={fields.method}
          >
            {Object.entries(paymentMethods).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </SelectField>
        </div>
        {method === 'non_cash' && (
          <TextField
            label="Referensi transaksi (opsional)"
            size="small"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            disabled={saving || Boolean(pending)}
            error={Boolean(fields.external_reference)}
            helperText={fields.external_reference}
          />
        )}
        <div className="flex flex-wrap gap-2">
          {!pending && (
            <Button type="button" variant="outlined" disabled={saving} onClick={() => setAmount(invoice.balance_amount)}>
              Isi sisa tagihan
            </Button>
          )}
          <Button type="submit" variant="contained" disabled={saving}>
            {saving ? 'Mencatat…' : pending ? 'Kirim ulang pembayaran' : 'Simpan pembayaran'}
          </Button>
        </div>
      </form>
    </Paper>
  );
}
