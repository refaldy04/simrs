import { Alert, Button, Paper, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { formatDate, todayInJakarta } from '../format.js';

export function currentMonthPeriod() {
  const today = todayInJakarta();
  return { date_from: today.slice(0, 7) + '-01', date_to: today };
}

export function DashboardPeriodFilter({ period, onApply }) {
  const [draft, setDraft] = useState(period);
  const [error, setError] = useState('');

  function changeDate(event) {
    const { name, value } = event.target;
    setError('');
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function apply(event) {
    event.preventDefault();
    if (draft.date_from > draft.date_to) {
      setError('Tanggal akhir harus sama dengan atau setelah tanggal mulai.');
      return;
    }
    onApply(draft);
  }

  function showCurrentMonth() {
    const currentMonth = currentMonthPeriod();
    setDraft(currentMonth);
    setError('');
    onApply(currentMonth);
  }

  return (
    <Paper component="section" variant="outlined" aria-labelledby="dashboard-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Typography id="dashboard-title" component="h2" variant="h5">Dashboard statistik</Typography>
        <Typography variant="body2" color="text.secondary">
          {formatDate(period.date_from)} – {formatDate(period.date_to)} · WIB
        </Typography>
      </div>
      <form onSubmit={apply} className="grid gap-3 sm:flex sm:flex-wrap sm:items-center" aria-label="Filter periode">
        <TextField
          type="date"
          size="small"
          name="date_from"
          label="Tanggal mulai"
          value={draft.date_from}
          onChange={changeDate}
          slotProps={{ inputLabel: { shrink: true } }}
          required
        />
        <TextField
          type="date"
          size="small"
          name="date_to"
          label="Tanggal akhir"
          value={draft.date_to}
          onChange={changeDate}
          slotProps={{ inputLabel: { shrink: true } }}
          required
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="contained">Terapkan</Button>
          <Button type="button" onClick={showCurrentMonth}>Bulan ini</Button>
        </div>
      </form>
      {error && <Alert severity="error">{error}</Alert>}
    </Paper>
  );
}
