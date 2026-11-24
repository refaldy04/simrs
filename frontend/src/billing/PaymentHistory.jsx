import { Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { ListPagination } from '../components/ListPagination.jsx';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { formatCurrency, formatDateTime } from '../format.js';
import { getPaymentHistory } from '../service/billingService.js';
import { paymentMethods } from './PaymentForm.jsx';

export function PaymentHistory({ visitId, token, paymentCount, onPrint, onUnauthorized }) {
  const [page, setPage] = useState(1);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadHistory() {
      setError('');
      try {
        const data = await getPaymentHistory(visitId, page, { token, signal });
        if (!signal.aborted) setHistory(data);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setError(failure.message);
      }
    }

    loadHistory();
    return () => controller.abort();
  }, [visitId, token, page, paymentCount, retry, onUnauthorized]);

  return (
    <Paper component="section" variant="outlined" aria-labelledby="payment-history-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
      <Typography id="payment-history-title" component="h2" variant="h6">Riwayat pembayaran pasien</Typography>
      <LoadStatus loading={!history} text="Memuat riwayat pembayaran…" error={error} onRetry={() => setRetry((count) => count + 1)} />
      {history?.items.length === 0 && <Typography color="text.secondary">Belum ada pembayaran.</Typography>}
      {history?.items.length > 0 && (
        <TableContainer tabIndex={0} className="rounded-lg border border-slate-200">
          <Table size="small" aria-label="Daftar pembayaran pasien" className="min-w-[39rem]">
            <TableHead className="bg-slate-50">
              <TableRow>
                <TableCell>No. invoice dan bukti</TableCell>
                <TableCell>Waktu bayar</TableCell>
                <TableCell>Metode</TableCell>
                <TableCell align="right">Nominal</TableCell>
                <TableCell>Aksi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.items.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    {payment.invoice_no}
                    <Typography component="span" variant="caption" color="text.secondary" className="block wrap-anywhere">
                      {payment.receipt_no}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDateTime(payment.paid_at)}</TableCell>
                  <TableCell>{paymentMethods[payment.method]}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap">{formatCurrency(payment.amount)}</TableCell>
                  <TableCell><Button size="small" onClick={() => onPrint(payment)}>Cetak bukti bayar</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {history && <ListPagination data={history} onPage={setPage} />}
    </Paper>
  );
}
