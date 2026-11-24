import {
  Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { formatCurrency, formatTime, todayInJakarta } from '../format.js';
import { listSchedules } from '../service/registrationService.js';
import { RegistrationForm } from './RegistrationForm.jsx';
import { VisitQueue } from './VisitQueue.jsx';

function registrationLink(view, date) {
  const path = view === 'register' ? '#/registration' : '#/registration/' + view;
  return path + '?date=' + date;
}

function ScheduleList({ schedules, error, onReload }) {
  return (
    <Paper component="section" variant="outlined" aria-labelledby="practice-schedules-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
      <Typography id="practice-schedules-title" component="h2" variant="h6">Jadwal praktik</Typography>
      <LoadStatus loading={schedules === null} text="Memuat jadwal…" error={error} onRetry={onReload} />
      {schedules?.length === 0 && <Typography color="text.secondary">Belum ada jadwal aktif pada tanggal ini.</Typography>}
      {schedules?.length > 0 && (
        <TableContainer tabIndex={0} className="rounded-lg border border-slate-200">
          <Table size="small" aria-label="Daftar jadwal praktik" className="min-w-[34rem]">
            <TableHead className="bg-slate-50">
              <TableRow>
                <TableCell scope="col">Poli</TableCell>
                <TableCell scope="col">Dokter</TableCell>
                <TableCell scope="col">Jam praktik</TableCell>
                <TableCell scope="col">Tarif pendaftaran</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schedules.map((slot) => (
                <TableRow key={slot.id} hover>
                  <TableCell>{slot.clinic_name}</TableCell>
                  <TableCell>{slot.doctor_name}</TableCell>
                  <TableCell>{formatTime(slot.starts_at)}–{formatTime(slot.ends_at)}</TableCell>
                  <TableCell>{formatCurrency(slot.registration_fee)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}

function ScheduleViews({ view, date, token, onUnauthorized }) {
  const [result, setResult] = useState(null);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setResult(null);

    async function loadSchedules() {
      try {
        const data = await listSchedules(date, { token, signal });
        if (!signal.aborted) setResult({ date, schedules: data.items });
      } catch (error) {
        if (signal.aborted) return;
        if (error.status === 401) onUnauthorized();
        else setResult({ date, error: error.message });
      }
    }

    loadSchedules();
    return () => controller.abort();
  }, [date, token, onUnauthorized, reloadCount]);

  function reloadSchedules() {
    setReloadCount((count) => count + 1);
  }

  const current = result?.date === date ? result : null;
  const schedules = current?.schedules ?? null;
  const error = current?.error ?? '';

  if (view === 'schedules') {
    return <ScheduleList schedules={schedules} error={error} onReload={reloadSchedules} />;
  }

  return (
    <RegistrationForm
      date={date}
      schedules={schedules}
      scheduleError={error}
      onReloadSchedules={reloadSchedules}
      token={token}
      onUnauthorized={onUnauthorized}
    />
  );
}

export function RegistrationPage({ view, requestedDate, token, canRegister, canExamine, onUnauthorized }) {
  const date = requestedDate ?? todayInJakarta();
  const tabs = [
    ...(canRegister ? [['register', 'Pendaftaran']] : []),
    ['schedules', 'Jadwal'],
    ['queue', 'Antrean'],
  ];

  function changeDate(event) {
    if (event.target.value) window.location.hash = registrationLink(view, event.target.value);
  }

  return (
    <div className="grid min-w-0 gap-4">
      <Paper component="section" variant="outlined" className="flex flex-wrap items-center justify-between gap-4 p-4 sm:px-6">
        <nav aria-label="Layanan rawat jalan" className="flex flex-wrap gap-2">
          {tabs.map(([key, label]) => (
            <Button
              key={key}
              href={registrationLink(key, date)}
              variant={view === key ? 'contained' : 'text'}
              aria-current={view === key ? 'page' : undefined}
            >
              {label}
            </Button>
          ))}
        </nav>
        <TextField
          id="registration-date"
          type="date"
          label="Tanggal layanan"
          size="small"
          value={date}
          onChange={changeDate}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Paper>

      {view === 'queue' ? (
        <VisitQueue
          key={date}
          date={date}
          token={token}
          canRegister={canRegister}
          canExamine={canExamine}
          onUnauthorized={onUnauthorized}
        />
      ) : (
        <ScheduleViews key={view} view={view} date={date} token={token} onUnauthorized={onUnauthorized} />
      )}
    </div>
  );
}
