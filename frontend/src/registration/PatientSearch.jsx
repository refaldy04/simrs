import { Button, Link, Paper, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { ListPagination } from '../components/ListPagination.jsx';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { formatDate } from '../format.js';
import { searchPatients } from '../service/registrationService.js';

export function PatientSearch({ patient, disabled, token, onSelect, onUnauthorized }) {
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState(null);
  const [patients, setPatients] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!search) return;

    const controller = new AbortController();
    const { signal } = controller;

    async function loadPatients() {
      try {
        const data = await searchPatients(search, { token, signal });
        if (!signal.aborted) setPatients(data);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setError(failure.message);
      }
    }

    loadPatients();
    return () => controller.abort();
  }, [search, token, onUnauthorized]);

  function requestPage(term, page) {
    setPatients(null);
    setError('');
    setSearch(term ? { term, page } : null);
  }

  function handleSubmit(event) {
    event.preventDefault();
    onSelect(null);
    requestPage(searchDraft.trim(), 1);
  }

  return (
    <Paper component="section" variant="outlined" aria-labelledby="patient-search-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
      <Typography id="patient-search-title" component="h2" variant="h6">Cari pasien</Typography>
      <form className="flex min-w-0 items-start gap-2" onSubmit={handleSubmit}>
        <TextField
          id="visit-patient-search"
          label="No. rekam medis, identitas, atau nama"
          size="small"
          type="search"
          value={searchDraft}
          slotProps={{ htmlInput: { maxLength: 150 } }}
          onChange={(event) => setSearchDraft(event.target.value)}
          disabled={disabled}
          fullWidth
          required
        />
        <Button variant="outlined" type="submit" disabled={disabled} className="min-h-10">Cari</Button>
      </form>
      {search && (
        <LoadStatus
          loading={patients === null}
          text="Mencari pasien…"
          error={error}
          onRetry={() => requestPage(search.term, search.page)}
        />
      )}
      {patients && (
        <>
          {patients.items.length > 0 ? (
            <ul className="divide-y divide-slate-200">
              {patients.items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <Typography className="font-semibold">{item.full_name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {item.medical_record_no} · {formatDate(item.birth_date)}
                    </Typography>
                  </div>
                  <Button
                    size="small"
                    variant="outlined"
                    aria-label={'Pilih ' + item.full_name}
                    disabled={disabled || patient?.id === item.id}
                    onClick={() => onSelect(item)}
                  >
                    {patient?.id === item.id ? 'Dipilih' : 'Pilih'}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <Typography>Pasien tidak ditemukan. <Link href="#/master-data/patients">Buka master pasien</Link>.</Typography>
          )}
          <ListPagination data={patients} onPage={(page) => requestPage(search.term, page)} disabled={disabled} />
        </>
      )}
    </Paper>
  );
}
