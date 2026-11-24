import { Alert, Button, Paper, Tab, Tabs, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { formatDate } from '../format.js';
import { LabVisitPanel } from '../laboratory/LabVisitPanel.jsx';
import { PrescriptionPanel } from '../prescription/PrescriptionPanel.jsx';
import { VisitProcedures } from '../procedure/VisitProcedures.jsx';
import { VisitStatus } from '../registration/VisitTable.jsx';
import { getExamination } from '../service/examinationService.js';
import { ExaminationForm } from './ExaminationForm.jsx';
import { MedicalRecordHistory } from './MedicalRecordHistory.jsx';

export function ExaminationPage({
  visitId, token, canManageProcedures, canPrescribe, canReadLab, canRequestLab, onUnauthorized,
}) {
  const [tab, setTab] = useState('examination');
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

  const visitStatusChanged = useCallback((status) => {
    setContext((current) => {
      if (!current || current.visit.status === status) return current;
      return { ...current, visit: { ...current.visit, status } };
    });
  }, []);

  const visit = context?.visit;
  const hasTabs = canManageProcedures || canPrescribe || canReadLab;
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
          {hasTabs && (
            <Tabs value={tab} onChange={(_event, value) => setTab(value)} aria-label="Bagian kunjungan" variant="scrollable">
              <Tab id="examination-tab" aria-controls="examination-panel" label="Pemeriksaan & RME" value="examination" />
              {canManageProcedures && <Tab id="procedures-tab" aria-controls="procedures-panel" label="Tindakan & tagihan" value="procedures" />}
              {canPrescribe && <Tab id="prescription-tab" aria-controls="prescription-panel" label="Resep" value="prescription" />}
              {canReadLab && <Tab id="lab-tab" aria-controls="lab-panel" label="Laboratorium" value="laboratory" />}
            </Tabs>
          )}
          <div role="tabpanel" id="examination-panel" aria-labelledby={hasTabs ? 'examination-tab' : undefined} hidden={tab !== 'examination'}>
            <div className="grid min-w-0 gap-4">
              <ExaminationForm
                key={context.examination?.updated_at ?? 'new'}
                context={context}
                token={token}
                onSaved={examinationSaved}
                onReload={reload}
                onUnauthorized={onUnauthorized}
              />
              <MedicalRecordHistory visitId={visitId} token={token} savedCount={savedCount} onUnauthorized={onUnauthorized} />
            </div>
          </div>
          {canManageProcedures && (
            <div role="tabpanel" id="procedures-panel" aria-labelledby="procedures-tab" hidden={tab !== 'procedures'}>
              {tab === 'procedures' && (
                <VisitProcedures
                  visitId={visitId}
                  visitStatus={visit.status}
                  token={token}
                  onStatusChange={visitStatusChanged}
                  onUnauthorized={onUnauthorized}
                />
              )}
            </div>
          )}
          {canPrescribe && (
            <div role="tabpanel" id="prescription-panel" aria-labelledby="prescription-tab" hidden={tab !== 'prescription'}>
              <PrescriptionPanel
                visitId={visitId}
                visitStatus={visit.status}
                token={token}
                active={tab === 'prescription'}
                onUnauthorized={onUnauthorized}
              />
            </div>
          )}
          {canReadLab && (
            <div role="tabpanel" id="lab-panel" aria-labelledby="lab-tab" hidden={tab !== 'laboratory'}>
              {tab === 'laboratory' && (
                <LabVisitPanel
                  visitId={visitId}
                  token={token}
                  canRequest={canRequestLab}
                  onStatusChange={visitStatusChanged}
                  onUnauthorized={onUnauthorized}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
