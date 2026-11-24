import { Alert, Button, Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { formatDate } from '../format.js';
import { VisitStatus } from '../registration/VisitTable.jsx';
import { getExamination } from '../service/examinationService.js';
import { ExaminationForm } from './ExaminationForm.jsx';
import { MedicalRecordHistory } from './MedicalRecordHistory.jsx';

export function ExaminationPage({ visitId, token, onUnauthorized }) {
  const [context, setContext] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadExamination() {
      try {
        const data = await getExamination(visitId, { token, signal });
        if (!signal.aborted) setContext(data);
      } catch (error) {
        if (signal.aborted) return;
        if (error.status === 401) onUnauthorized();
        else setLoadError(error.message);
      }
    }

    loadExamination();
    return () => controller.abort();
  }, [visitId, token, retry, onUnauthorized]);

  function reload() {
    setContext(null);
    setLoadError('');
    setNotice('');
    setRetry((count) => count + 1);
  }

  function examinationSaved(result, finished) {
    setContext(result);
    setNotice(finished ? 'Pemeriksaan selesai. Kunjungan menunggu pembayaran.' : 'Pemeriksaan disimpan.');
    setSavedCount((count) => count + 1);
  }

  const visit = context?.visit;
  const queueLink = '#/registration/queue' + (visit ? '?date=' + visit.visit_date : '');

  return (
    <div className="grid min-w-0 gap-4">
      <Paper component="section" variant="outlined" aria-labelledby="exam-title" className="grid gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Typography component="h2" variant="h6" id="exam-title">Pemeriksaan pasien</Typography>
          <Button href={queueLink} variant="outlined">Kembali ke antrean</Button>
        </div>
        <LoadStatus loading={!context} text="Memuat pemeriksaan…" error={loadError} onRetry={reload} />
        {visit && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Typography variant="h5" className="wrap-anywhere">{visit.patient_name}</Typography>
              <VisitStatus status={visit.status} />
            </div>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-sm text-slate-600">No. rekam medis</dt><dd>{visit.medical_record_no}</dd></div>
              <div><dt className="text-sm text-slate-600">Tanggal layanan</dt><dd>{formatDate(visit.visit_date)}</dd></div>
              <div><dt className="text-sm text-slate-600">Poli</dt><dd>{visit.clinic_name}</dd></div>
              <div><dt className="text-sm text-slate-600">No. antrean</dt><dd>{visit.queue_number}</dd></div>
            </dl>
          </>
        )}
      </Paper>
      {notice && <Alert severity="success" role="status">{notice}</Alert>}
      {context && (
        <>
          <ExaminationForm
            key={context.examination?.updated_at ?? 'new'}
            context={context}
            token={token}
            onSaved={examinationSaved}
            onReload={reload}
            onUnauthorized={onUnauthorized}
          />
          <MedicalRecordHistory visitId={visitId} token={token} savedCount={savedCount} onUnauthorized={onUnauthorized} />
        </>
      )}
    </div>
  );
}
