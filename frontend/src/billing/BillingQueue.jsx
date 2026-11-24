import {
  Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { ListPagination } from '../components/ListPagination.jsx';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { SelectField } from '../components/SelectField.jsx';
import { formatCurrency, formatDate } from '../format.js';
import { getBillingQueue } from '../service/billingService.js';
import { BillingStatus, billingStatuses } from './BillingComponents.jsx';

export function BillingQueue({ token, onUnauthorized }) {
  const [searchDraft, setSearchDraft] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadQueue() {
      setData(null);
      setError('');
      try {
        const result = await getBillingQueue({ term, status, page }, { token, signal });
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

  return (
    <Paper component="section" variant="outlined" aria-labelledby="billing-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
      <Typography id="billing-title" component="h2" variant="h6">Tagihan dan pembayaran</Typography>
      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <form onSubmit={search} className="flex min-w-0 gap-2">
          <TextField
            id="billing-search"
            label="Nama, no. rekam medis, atau invoice"
            type="search"
            size="small"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            className="min-w-0 sm:w-72"
            slotProps={{ htmlInput: { maxLength: 150 } }}
          />
          <Button type="submit" variant="outlined">Cari</Button>
        </form>
        <SelectField id="billing-status" label="Status tagihan" value={status} onChange={(event) => {
          setStatus(event.target.value);
          setPage(1);
        }}>
          <option value="all">Semua status</option>
          {Object.entries(billingStatuses).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </SelectField>
        {!error && <Button variant="outlined" onClick={reload}>Muat ulang</Button>}
      </div>
      <LoadStatus loading={!data} text="Memuat daftar tagihan…" error={error} onRetry={reload} />
      {data?.items.length === 0 && <Typography color="text.secondary">Belum ada tagihan untuk filter ini.</Typography>}
      {data?.items.length > 0 && (
        <TableContainer tabIndex={0} className="rounded-lg border border-slate-200">
          <Table size="small" aria-label="Daftar tagihan" className="min-w-[45rem]">
            <TableHead className="bg-slate-50">
              <TableRow>
                <TableCell>Pasien</TableCell>
                <TableCell>Kunjungan</TableCell>
                <TableCell>No. invoice</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Sisa tagihan</TableCell>
                <TableCell>Aksi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((visit) => (
                <TableRow key={visit.id} hover>
                  <TableCell>
                    {visit.patient_name}
                    <Typography component="span" variant="caption" color="text.secondary" className="block">
                      {visit.medical_record_no}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {formatDate(visit.visit_date)}
                    <Typography component="span" variant="caption" color="text.secondary" className="block">{visit.clinic_name}</Typography>
                  </TableCell>
                  <TableCell>{visit.invoice_no ?? '—'}</TableCell>
                  <TableCell><BillingStatus status={visit.billing_status} /></TableCell>
                  <TableCell align="right" className="whitespace-nowrap">
                    {visit.total_amount === null ? '—' : formatCurrency(visit.total_amount)}
                  </TableCell>
                  <TableCell align="right" className="whitespace-nowrap">
                    {visit.balance_amount === null ? '—' : formatCurrency(visit.balance_amount)}
                  </TableCell>
                  <TableCell><Button size="small" href={'#/billing/' + visit.id}>Buka tagihan</Button></TableCell>
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
