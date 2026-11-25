import {
  Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { BillingStatus, billingStatuses } from '../billing/BillingComponents.jsx';
import { ListPagination } from '../components/ListPagination.jsx';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { formatCurrency, formatDateTime } from '../format.js';
import { getDashboardInvoices } from '../service/dashboardService.js';

export function DashboardInvoices({ period, status, token, onClose, onUnauthorized }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const title = status === 'all' ? 'Rincian semua invoice' : 'Rincian invoice · ' + billingStatuses[status].label;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadInvoices() {
      setData(null);
      setError('');
      try {
        const result = await getDashboardInvoices(period, status, page, { token, signal });
        if (signal.aborted) return;
        const lastPage = Math.max(1, Math.ceil(result.total / result.page_size));
        if (page > lastPage) setPage(lastPage);
        else setData(result);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setError(failure.message);
      }
    }

    loadInvoices();
    return () => controller.abort();
  }, [period, status, page, token, retry, onUnauthorized]);

  return (
    <Paper component="section" variant="outlined" aria-labelledby="dashboard-invoices-title" className="grid min-w-0 gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Typography id="dashboard-invoices-title" component="h3" variant="h6">{title}</Typography>
        <Button size="small" onClick={onClose}>Tutup rincian</Button>
      </div>
      <LoadStatus loading={!data} text="Memuat rincian invoice…" error={error} onRetry={() => setRetry((count) => count + 1)} />
      {data?.items.length === 0 && <Typography color="text.secondary">Belum ada invoice untuk status ini.</Typography>}
      {data?.items.length > 0 && (
        <TableContainer tabIndex={0} className="rounded-lg border border-slate-200">
          <Table size="small" aria-label="Daftar invoice periode" className="min-w-[49rem]">
            <TableHead className="bg-slate-50">
              <TableRow>
                <TableCell>No. invoice</TableCell>
                <TableCell>Tanggal terbit</TableCell>
                <TableCell>Poli</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Sudah dibayar</TableCell>
                <TableCell align="right">Sisa tagihan</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.invoice_no}</TableCell>
                  <TableCell>{formatDateTime(invoice.issued_at)}</TableCell>
                  <TableCell>{invoice.clinic_name}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap tabular-nums">{formatCurrency(invoice.total_amount)}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap tabular-nums">{formatCurrency(invoice.paid_amount)}</TableCell>
                  <TableCell align="right" className="whitespace-nowrap tabular-nums">{formatCurrency(invoice.balance_amount)}</TableCell>
                  <TableCell><BillingStatus status={invoice.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {data && <ListPagination data={data} onPage={setPage} showTotal />}
    </Paper>
  );
}
