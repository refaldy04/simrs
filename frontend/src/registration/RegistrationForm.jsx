import { Alert, Button, Paper, Typography } from '@mui/material';
import { useState } from 'react';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { SelectField } from '../components/SelectField.jsx';
import { formatCurrency, formatDate, formatTime } from '../format.js';
import { registerVisit } from '../service/registrationService.js';
import { PatientSearch } from './PatientSearch.jsx';
import { VisitHistory } from './VisitHistory.jsx';
import { VisitStatus } from './VisitTable.jsx';

export function RegistrationForm({ date, schedules, scheduleError, onReloadSchedules, token, onUnauthorized }) {
  const [patient, setPatient] = useState(null);
  const [selection, setSelection] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyReloadCount, setHistoryReloadCount] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const slots = schedules ?? [];
  const clinics = new Map();
  for (const slot of slots) clinics.set(slot.clinic_id, slot.clinic_name);

  const choice = selection?.date === date ? selection : null;
  const clinicId = clinics.has(choice?.clinicId) ? choice.clinicId : '';
  const clinicSlots = slots.filter((slot) => slot.clinic_id === clinicId);
  const selectedSlot = clinicSlots.find((slot) => slot.id === choice?.scheduleId);

  function selectPatient(item) {
    setPatient(item);
    setHistoryPage(1);
    setTicket(null);
    setError('');
  }

  function changeClinic(event) {
    setSelection({ date, clinicId: event.target.value, scheduleId: '' });
    setError('');
  }

  function changeSchedule(event) {
    setSelection({ date, clinicId, scheduleId: event.target.value });
    setError('');
  }

  function reloadHistory() {
    setHistoryReloadCount((count) => count + 1);
  }

  async function handleRegister(event) {
    event.preventDefault();
    if (!patient || !selectedSlot || saving) return;

    setSaving(true);
    setError('');
    setTicket(null);
    try {
      const visit = await registerVisit(patient.id, selectedSlot.id, { token });
      setTicket(visit);
      setSelection((current) => {
        if (current?.scheduleId !== selectedSlot.id) return current;
        return { ...current, scheduleId: '' };
      });
      setHistoryPage(1);
      reloadHistory();
    } catch (failure) {
      if (failure.status === 401) {
        onUnauthorized();
      } else {
        setError(failure.message);
        if (failure.status === 409) reloadHistory();
        if (failure.status === 422) onReloadSchedules();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="grid items-start gap-4 md:grid-cols-2">
        <PatientSearch
          patient={patient}
          disabled={saving}
          token={token}
          onSelect={selectPatient}
          onUnauthorized={onUnauthorized}
        />

        <Paper component="section" variant="outlined" aria-labelledby="booking-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
          <Typography id="booking-title" component="h2" variant="h6">Daftarkan kunjungan</Typography>
          <LoadStatus loading={schedules === null} text="Memuat jadwal…" error={scheduleError} onRetry={onReloadSchedules} />
          {schedules?.length === 0 && <Typography color="text.secondary">Belum ada jadwal aktif pada tanggal ini.</Typography>}
          {slots.length > 0 && (
            <form className="grid gap-4" onSubmit={handleRegister}>
              {patient && (
                <div className="rounded-md bg-teal-50 px-3 py-2">
                  <Typography className="font-semibold">{patient.full_name}</Typography>
                  <Typography variant="body2" color="text.secondary">{patient.medical_record_no}</Typography>
                </div>
              )}
              <SelectField id="visit-clinic" label="Poli" value={clinicId} disabled={saving} required onChange={changeClinic}>
                <option value="">Pilih poli</option>
                {[...clinics].map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </SelectField>
              <SelectField
                id="visit-schedule"
                label="Dokter dan jam praktik"
                value={selectedSlot?.id ?? ''}
                disabled={saving || !clinicId}
                required
                onChange={changeSchedule}
              >
                <option value="">Pilih jadwal</option>
                {clinicSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slot.doctor_name} · {formatTime(slot.starts_at)}–{formatTime(slot.ends_at)}
                  </option>
                ))}
              </SelectField>
              {selectedSlot && (
                <Typography variant="body2">
                  Tarif pendaftaran <strong>{formatCurrency(selectedSlot.registration_fee)}</strong>
                </Typography>
              )}
              <Button variant="contained" type="submit" disabled={saving || !patient || !selectedSlot} className="justify-self-start">
                {saving ? 'Mendaftarkan…' : 'Daftarkan'}
              </Button>
            </form>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Paper>
      </div>

      {ticket && (
        <Paper
          component="section"
          variant="outlined"
          aria-labelledby="ticket-title"
          role="status"
          className="flex flex-wrap items-center gap-4 border-teal-200 bg-teal-50 p-4 sm:p-6"
        >
          <div className="rounded-lg bg-white px-4 py-3 text-center">
            <Typography variant="body2" color="text.secondary">No. antrean</Typography>
            <Typography component="strong" variant="h4" className="font-semibold">{ticket.queue_number}</Typography>
          </div>
          <div className="flex-1">
            <Typography id="ticket-title" component="h2" variant="h6">Kunjungan terdaftar</Typography>
            <Typography>{ticket.patient_name} · {ticket.clinic_name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {formatDate(ticket.visit_date)} · {ticket.doctor_name} · {formatTime(ticket.starts_at)}–{formatTime(ticket.ends_at)}
            </Typography>
          </div>
          <VisitStatus status={ticket.status} />
          <Button variant="outlined" href={'#/registration/queue?date=' + ticket.visit_date}>Lihat antrean</Button>
        </Paper>
      )}

      {patient && (
        <VisitHistory
          key={patient.id}
          patientId={patient.id}
          page={historyPage}
          token={token}
          reloadCount={historyReloadCount}
          onPage={setHistoryPage}
          onReload={reloadHistory}
          onUnauthorized={onUnauthorized}
        />
      )}
    </>
  );
}
