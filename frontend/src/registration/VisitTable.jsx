import {
  Button, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { formatDate, formatTime } from '../format.js';

export const visitStatuses = {
  waiting: 'Menunggu',
  in_examination: 'Dalam pemeriksaan',
  awaiting_billing: 'Menunggu pembayaran',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const statusColors = {
  waiting: 'warning',
  in_examination: 'info',
  awaiting_billing: 'warning',
  completed: 'success',
};

export function VisitStatus({ status }) {
  return (
    <Chip
      size="small"
      variant="outlined"
      color={statusColors[status] ?? 'default'}
      label={visitStatuses[status] ?? status}
    />
  );
}

export function VisitTable({ items, history = false, cancelling = null, onCancel, canExamine = false }) {
  const showActions = onCancel || canExamine;

  return (
    <TableContainer tabIndex={0} className="rounded-lg border border-slate-200">
      <Table size="small" aria-label={history ? 'Daftar riwayat kunjungan' : 'Daftar antrean'} className="min-w-[36rem]">
        <TableHead className="bg-slate-50">
          <TableRow>
            {history && <TableCell scope="col">Tanggal</TableCell>}
            <TableCell scope="col">No. antrean</TableCell>
            {!history && <TableCell scope="col">Pasien</TableCell>}
            <TableCell scope="col">Poli</TableCell>
            <TableCell scope="col">Dokter</TableCell>
            {!history && <TableCell scope="col">Jam praktik</TableCell>}
            <TableCell scope="col">Status</TableCell>
            {showActions && <TableCell scope="col">Aksi</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((visit) => (
            <TableRow key={visit.id} hover>
              {history && <TableCell>{formatDate(visit.visit_date)}</TableCell>}
              <TableCell><strong>{visit.queue_number}</strong></TableCell>
              {!history && (
                <TableCell>
                  {visit.patient_name}
                  <Typography component="span" variant="body2" color="text.secondary" className="block">
                    {visit.medical_record_no}
                  </Typography>
                </TableCell>
              )}
              <TableCell>{visit.clinic_name}</TableCell>
              <TableCell>{visit.doctor_name}</TableCell>
              {!history && <TableCell>{formatTime(visit.starts_at)}–{formatTime(visit.ends_at)}</TableCell>}
              <TableCell><VisitStatus status={visit.status} /></TableCell>
              {showActions && (
                <TableCell>
                  {onCancel && visit.status === 'waiting' && (
                    <Button size="small" color="error" disabled={cancelling !== null} onClick={() => onCancel(visit)}>
                      {cancelling === visit.id ? 'Membatalkan…' : 'Batalkan'}
                    </Button>
                  )}
                  {canExamine && visit.status !== 'cancelled' && (
                    <Button size="small" href={'#/examinations/' + visit.id}>
                      {visit.status === 'waiting' ? 'Periksa' : 'Buka pemeriksaan'}
                    </Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
