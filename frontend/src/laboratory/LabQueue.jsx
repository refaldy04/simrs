import {
  Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { ListPagination } from '../components/ListPagination.jsx';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { SelectField } from '../components/SelectField.jsx';
import { formatDate, formatDateTime } from '../format.js';
import { getLabQueue } from '../service/labService.js';
import { LabStatus, labStatuses } from './LabOrderCard.jsx';

export function LabQueue({ token, onUnauthorized }) {
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadQueue() {
      setData(null);
      setError('');
      try {
        const result = await getLabQueue({ term, status, page }, { token, signal });
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
  }, [term, status, page, token, refresh, onUnauthorized]);

  function reload() {
    setRefresh((count) => count + 1);
  }

  function searchOrders(event) {
    event.preventDefault();
    setTerm(search.trim());
    setPage(1);
    reload();
  }

  return (
    <Paper component="section" variant="outlined" aria-labelledby="lab-queue-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
      <Typography id="lab-queue-title" component="h2" variant="h6">Antrean laboratorium</Typography>
      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <form onSubmit={searchOrders} className="flex min-w-0 gap-2">
          <TextField
            id="lab-search"
            label="Nama atau no. rekam medis"
            type="search"
            size="small"
            value={search}
            className="min-w-0 sm:w-64"
            slotProps={{ htmlInput: { maxLength: 150 } }}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button type="submit" variant="outlined">Cari</Button>
        </form>
        <SelectField id="lab-status" label="Status permintaan" value={status} onChange={(event) => {
          setStatus(event.target.value);
          setPage(1);
        }}>
          <option value="open">Permintaan aktif</option>
          {Object.entries(labStatuses).map(([key, option]) => <option key={key} value={key}>{option.label}</option>)}
          <option value="all">Semua status</option>
        </SelectField>
        {!error && <Button onClick={reload} variant="outlined">Muat ulang</Button>}
      </div>
      <LoadStatus loading={!data} text="Memuat antrean laboratorium…" error={error} onRetry={reload} />
      {data?.items.length === 0 && <Typography color="text.secondary">Belum ada permintaan untuk filter ini.</Typography>}
      {data?.items.length > 0 && (
        <TableContainer tabIndex={0} className="rounded-lg border border-slate-200">
          <Table size="small" aria-label="Daftar permintaan lab" className="min-w-[39rem]">
            <TableHead className="bg-slate-50">
              <TableRow>
                <TableCell>Pasien</TableCell>
                <TableCell>Kunjungan</TableCell>
                <TableCell>Waktu permintaan</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Aksi</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.items.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell>
                    {order.patient_name}
                    <Typography component="span" variant="caption" color="text.secondary" className="block">
                      {order.medical_record_no}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {formatDate(order.visit_date)}
                    <Typography component="span" variant="caption" color="text.secondary" className="block">
                      {order.clinic_name}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDateTime(order.ordered_at)}</TableCell>
                  <TableCell><LabStatus status={order.status} /></TableCell>
                  <TableCell><Button href={'#/laboratory/' + order.id} size="small">Buka permintaan</Button></TableCell>
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
