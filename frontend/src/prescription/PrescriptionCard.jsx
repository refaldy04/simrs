import { Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { formatDate, formatDateTime } from '../format.js';

export const prescriptionStatuses = {
  pending: { label: 'Menunggu penyerahan', color: 'warning' },
  dispensed: { label: 'Diserahkan', color: 'success' },
  cancelled: { label: 'Dibatalkan', color: 'default' },
};

export function PrescriptionItems({ items, showStock = false }) {
  return (
    <TableContainer tabIndex={0} className="rounded-lg border border-slate-200">
      <Table size="small" aria-label="Daftar obat resep" className="min-w-[32rem]">
        <TableHead className="bg-slate-50">
          <TableRow>
            <TableCell>Obat</TableCell>
            <TableCell>Dosis</TableCell>
            <TableCell>Frekuensi</TableCell>
            <TableCell align="right">Jumlah</TableCell>
            {showStock && <TableCell align="right">Stok</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {item.name}
                <Typography component="span" variant="caption" color="text.secondary" className="block">{item.code}</Typography>
              </TableCell>
              <TableCell className="wrap-anywhere">{item.dose}</TableCell>
              <TableCell className="wrap-anywhere">{item.frequency}</TableCell>
              <TableCell align="right" className="whitespace-nowrap">{item.quantity} {item.unit}</TableCell>
              {showStock && <TableCell align="right">{item.medicine_active ? item.stock_quantity : 'Nonaktif'}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function PrescriptionCard({ prescription, showPatient = false, showStock = false, children }) {
  const status = prescriptionStatuses[prescription.status];

  return (
    <Paper component="article" variant="outlined" className="grid min-w-0 gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Typography component="h3" variant="subtitle1" className="font-semibold wrap-anywhere">
            {showPatient ? prescription.patient_name : 'Resep #' + prescription.id}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {showPatient && prescription.medical_record_no + ' · '}
            {formatDate(prescription.visit_date)} · {prescription.clinic_name} · {prescription.doctor_name}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {prescription.dispensed_at
              ? 'Diserahkan ' + formatDateTime(prescription.dispensed_at) + ' oleh ' + prescription.pharmacist_name
              : 'Dibuat ' + formatDateTime(prescription.prescribed_at)}
          </Typography>
        </div>
        <Chip size="small" variant="outlined" color={status.color} label={status.label} />
      </div>
      <PrescriptionItems items={prescription.items} showStock={showStock && prescription.status === 'pending'} />
      {children}
    </Paper>
  );
}
