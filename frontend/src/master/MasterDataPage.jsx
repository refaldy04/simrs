import {
  Alert, Button, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { ListPagination } from '../components/ListPagination.jsx';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { SelectField } from '../components/SelectField.jsx';
import { archiveMasterRecord, listMasterRecords, listMasterResources } from '../service/masterDataService.js';
import { displayValue } from './format.js';
import { MasterRecordDialog } from './MasterRecordDialog.jsx';

function RecordsTable({ resource, items, archiving, onOpen, onArchive }) {
  const columns = Object.entries(resource.columns);

  return (
    <TableContainer tabIndex={0} className="rounded-lg border border-slate-200">
      <Table size="small" aria-label={'Daftar ' + resource.label.toLowerCase()} className="min-w-[36rem]">
        <TableHead className="bg-slate-50">
          <TableRow>
            {columns.map(([key, label]) => <TableCell key={key} scope="col">{label}</TableCell>)}
            <TableCell scope="col">Status</TableCell>
            <TableCell scope="col">Aksi</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((record) => (
            <TableRow key={record.id} hover>
              {columns.map(([key]) => (
                <TableCell key={key} className="wrap-anywhere">{displayValue(record, key, resource.fields[key])}</TableCell>
              ))}
              <TableCell>
                <Chip
                  size="small"
                  variant="outlined"
                  color={record.is_active ? 'success' : 'default'}
                  label={record.is_active ? 'Aktif' : 'Nonaktif'}
                />
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  <Button size="small" onClick={() => onOpen({ mode: 'view', id: record.id })}>Lihat</Button>
                  <Button size="small" onClick={() => onOpen({ mode: 'edit', id: record.id })}>Ubah</Button>
                  {record.is_active && (
                    <Button size="small" color="error" disabled={archiving !== null} onClick={() => onArchive(record)}>
                      {archiving === record.id ? 'Memproses…' : 'Nonaktifkan'}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function MasterRecords({ resource, token, onUnauthorized }) {
  const [searchDraft, setSearchDraft] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const resourceKey = resource.key;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setResult(null);
    setLoadError('');

    async function loadRecords() {
      try {
        const data = await listMasterRecords(resourceKey, { query, status, page }, { token, signal });
        if (signal.aborted) return;

        const lastPage = Math.max(1, Math.ceil(data.total / data.page_size));
        if (page > lastPage) setPage(lastPage);
        else setResult(data);
      } catch (error) {
        if (signal.aborted) return;
        if (error.status === 401) onUnauthorized();
        else setLoadError(error.message);
      }
    }

    loadRecords();
    return () => controller.abort();
  }, [resourceKey, page, query, reloadCount, status, token, onUnauthorized]);

  function reloadRecords() {
    setReloadCount((count) => count + 1);
  }

  function searchRecords(event) {
    event.preventDefault();
    setQuery(searchDraft.trim());
    setPage(1);
  }

  function changeStatus(event) {
    setStatus(event.target.value);
    setPage(1);
  }

  function openDialog(nextDialog) {
    setNotice('');
    setActionError('');
    setDialog(nextDialog);
  }

  function recordSaved(message) {
    setDialog(null);
    setNotice(message);
    reloadRecords();
  }

  async function archive(record) {
    if (!window.confirm('Nonaktifkan data ini?')) return;

    setArchiving(record.id);
    setNotice('');
    setActionError('');
    try {
      await archiveMasterRecord(resourceKey, record.id, { token });
      setNotice('Data dinonaktifkan.');
      reloadRecords();
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      else setActionError(error.message);
    } finally {
      setArchiving(null);
    }
  }

  return (
    <Paper component="section" variant="outlined" aria-labelledby="master-records-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography id="master-records-title" component="h2" variant="h6">{resource.label}</Typography>
        <Button variant="contained" onClick={() => openDialog({ mode: 'create' })}>
          Tambah {resource.label.toLowerCase()}
        </Button>
      </div>
      <div className="grid gap-3 sm:flex sm:flex-wrap">
        <form className="flex min-w-0 gap-2" onSubmit={searchRecords}>
          <TextField
            id="master-search"
            label="Pencarian"
            size="small"
            type="search"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 150 } }}
            className="min-w-0"
          />
          <Button variant="outlined" type="submit">Cari</Button>
        </form>
        <SelectField id="master-status" label="Status" value={status} onChange={changeStatus} className="min-w-36">
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
          <option value="all">Semua</option>
        </SelectField>
      </div>
      {notice && <Alert severity="success" role="status">{notice}</Alert>}
      {actionError && <Alert severity="error">{actionError}</Alert>}
      <LoadStatus loading={result === null} text="Memuat daftar…" error={loadError} onRetry={reloadRecords} />
      {result && (
        <>
          {result.items.length > 0 ? (
            <RecordsTable resource={resource} items={result.items} archiving={archiving} onOpen={openDialog} onArchive={archive} />
          ) : (
            <Typography color="text.secondary">Belum ada data yang cocok.</Typography>
          )}
          <ListPagination data={result} onPage={setPage} showTotal />
        </>
      )}
      {dialog && (
        <MasterRecordDialog
          key={dialog.mode + ':' + (dialog.id ?? 'new')}
          resource={resource}
          mode={dialog.mode}
          id={dialog.id}
          token={token}
          onUnauthorized={onUnauthorized}
          onClose={() => setDialog(null)}
          onEdit={() => setDialog({ mode: 'edit', id: dialog.id })}
          onSaved={recordSaved}
        />
      )}
    </Paper>
  );
}

export function MasterDataPage({ token, requestedKey, onUnauthorized }) {
  const [resources, setResources] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadResources() {
      try {
        const data = await listMasterResources({ token, signal });
        if (!signal.aborted) setResources(data.resources);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setError(failure.message);
      }
    }

    loadResources();
    return () => controller.abort();
  }, [onUnauthorized, retry, token]);

  function retryResources() {
    setError('');
    setRetry((count) => count + 1);
  }

  const selected = resources?.find((resource) => resource.key === requestedKey) ?? resources?.[0];
  if (!selected) {
    return (
      <Paper component="section" variant="outlined" aria-labelledby="master-data-title" className="grid gap-3 p-4 sm:p-6">
        <Typography id="master-data-title" component="h2" variant="h6">Master data</Typography>
        <LoadStatus loading={resources === null} text="Memuat master data…" error={error} onRetry={retryResources} />
        {resources?.length === 0 && <Typography>Belum ada master data yang bisa dibuka.</Typography>}
      </Paper>
    );
  }

  if (resources.length === 1) {
    return <MasterRecords key={selected.key} resource={selected} token={token} onUnauthorized={onUnauthorized} />;
  }

  return (
    <div className="grid min-w-0 items-start gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <Paper component="nav" variant="outlined" aria-label="Jenis master data" className="flex flex-wrap gap-1 p-2 lg:grid">
        {resources.map((resource) => (
          <Button
            key={resource.key}
            href={'#/master-data/' + resource.key}
            variant={resource.key === selected.key ? 'contained' : 'text'}
            aria-current={resource.key === selected.key ? 'page' : undefined}
            className="justify-start"
          >
            {resource.label}
          </Button>
        ))}
      </Paper>
      <MasterRecords key={selected.key} resource={selected} token={token} onUnauthorized={onUnauthorized} />
    </div>
  );
}
