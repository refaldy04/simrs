import {
  Accordion, AccordionDetails, AccordionSummary, Chip, Paper, Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { ListPagination } from '../components/ListPagination.jsx';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { formatDate } from '../format.js';
import { getMedicalRecordHistory } from '../service/examinationService.js';
import { noteFields, vitalFields } from './fields.js';

function MedicalRecord({ record }) {
  return (
    <Accordion disableGutters variant="outlined">
      <AccordionSummary expandIcon={<span aria-hidden="true">▾</span>}>
        <div className="min-w-0 wrap-anywhere">
          <Typography className="font-semibold">{formatDate(record.visit_date)} · {record.clinic_name}</Typography>
          <Typography variant="body2" color="text.secondary">{record.examiner_name}</Typography>
        </div>
      </AccordionSummary>
      <AccordionDetails className="grid gap-4 border-t border-slate-200">
        <dl className="grid gap-3">
          {noteFields.map(({ name, label }) => (
            <div key={name}>
              <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
              <Typography component="dd" className="whitespace-pre-wrap wrap-anywhere">{record[name] ?? '—'}</Typography>
            </div>
          ))}
        </dl>
        <div className="grid gap-2">
          <Typography variant="subtitle2" component="h3">Tanda vital</Typography>
          <dl className="grid gap-3 sm:grid-cols-2">
            {vitalFields.map(({ name, label }) => (
              <div key={name}>
                <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
                <Typography component="dd">{record[name] ?? '—'}</Typography>
              </div>
            ))}
          </dl>
        </div>
        <div className="grid gap-2">
          <Typography variant="subtitle2" component="h3">Diagnosis</Typography>
          {record.diagnoses.length > 0 ? (
            <ul className="grid gap-2">
              {record.diagnoses.map((diagnosis, index) => (
                <li key={index} className="flex flex-wrap items-start gap-2">
                  <Chip size="small" variant="outlined" label={diagnosis.is_primary ? 'Utama' : 'Sekunder'} />
                  <Typography variant="body2" className="min-w-0 wrap-anywhere">
                    {diagnosis.code && diagnosis.code + ' · '}{diagnosis.description}
                  </Typography>
                </li>
              ))}
            </ul>
          ) : (
            <Typography variant="body2" color="text.secondary">Belum ada diagnosis.</Typography>
          )}
        </div>
      </AccordionDetails>
    </Accordion>
  );
}

export function MedicalRecordHistory({ visitId, token, savedCount, onUnauthorized }) {
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setHistory(null);
    setError('');

    async function loadHistory() {
      try {
        const data = await getMedicalRecordHistory(visitId, page, { token, signal });
        if (!signal.aborted) setHistory(data);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setError(failure.message);
      }
    }

    loadHistory();
    return () => controller.abort();
  }, [visitId, token, page, savedCount, retry, onUnauthorized]);

  return (
    <Paper component="section" variant="outlined" aria-labelledby="medical-record-title" className="grid min-w-0 gap-3 p-4 sm:p-6">
      <Typography id="medical-record-title" component="h2" variant="h6">Riwayat rekam medis</Typography>
      <LoadStatus
        loading={history === null}
        text="Memuat riwayat rekam medis…"
        error={error}
        onRetry={() => setRetry((count) => count + 1)}
      />
      {history?.items.length === 0 && <Typography color="text.secondary">Belum ada pemeriksaan tersimpan.</Typography>}
      {history?.items.map((record) => <MedicalRecord key={record.id} record={record} />)}
      {history && <ListPagination data={history} onPage={setPage} />}
    </Paper>
  );
}
