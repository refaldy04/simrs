import { Chip, Paper, Typography } from '@mui/material';
import { formatDate, formatDateTime } from '../format.js';

export const labStatuses = {
  requested: { label: 'Menunggu hasil', color: 'warning' },
  in_progress: { label: 'Dalam proses', color: 'info' },
  completed: { label: 'Selesai', color: 'success' },
  cancelled: { label: 'Dibatalkan', color: 'default' },
};

export function LabStatus({ status }) {
  const option = labStatuses[status];
  return <Chip size="small" variant="outlined" color={option.color} label={option.label} />;
}

function LabResult({ result }) {
  return (
    <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-slate-600">Hasil</dt>
        <dd className="whitespace-pre-wrap wrap-anywhere">{result.result_value}{result.unit && ' ' + result.unit}</dd>
      </div>
      {result.reference_range && (
        <div>
          <dt className="text-slate-600">Nilai rujukan</dt>
          <dd className="whitespace-pre-wrap wrap-anywhere">{result.reference_range}</dd>
        </div>
      )}
      {result.notes && (
        <div className="sm:col-span-2">
          <dt className="text-slate-600">Catatan hasil</dt>
          <dd className="whitespace-pre-wrap wrap-anywhere">{result.notes}</dd>
        </div>
      )}
      <div className="sm:col-span-2">
        <dt className="text-slate-600">Dicatat oleh</dt>
        <dd>{result.entered_by_name} · {formatDateTime(result.entered_at)}</dd>
      </div>
    </dl>
  );
}

export function LabOrderCard({ order, showPatient = false }) {
  return (
    <Paper component="article" variant="outlined" className="grid min-w-0 gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Typography component="h3" variant="subtitle1">Permintaan #{order.id}</Typography>
        <LabStatus status={order.status} />
      </div>
      {showPatient && <Typography className="wrap-anywhere">{order.patient_name} · {order.medical_record_no}</Typography>}
      <div className="text-sm text-slate-600">
        <p>{formatDate(order.visit_date)} · {order.clinic_name}</p>
        <p>Diminta {order.doctor_name} · {formatDateTime(order.ordered_at)}</p>
      </div>
      {order.clinical_notes && (
        <dl className="text-sm">
          <dt className="text-slate-600">Catatan klinis</dt>
          <dd className="whitespace-pre-wrap wrap-anywhere">{order.clinical_notes}</dd>
        </dl>
      )}
      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
        {order.items.map((item) => (
          <li key={item.id} className="p-3">
            <Typography variant="body2" className="font-semibold wrap-anywhere">{item.name}</Typography>
            {order.status === 'completed' && item.result && <LabResult result={item.result} />}
          </li>
        ))}
      </ul>
    </Paper>
  );
}
