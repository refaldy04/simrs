import {
  Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { billingStatuses } from '../billing/BillingComponents.jsx';
import { paymentMethods } from '../billing/PaymentForm.jsx';
import { formatCurrency } from '../format.js';

const number = new Intl.NumberFormat('id-ID');
const invoiceStatuses = ['unpaid', 'partial', 'paid'];

function MetricCards({ summary }) {
  const metrics = [
    ['Kunjungan', number.format(summary.visits.total)],
    ['Tindakan medis', number.format(summary.procedures.total)],
    ['Jenis obat diserahkan', number.format(summary.medicines.total_types)],
    ['Pendapatan diterima', formatCurrency(summary.revenue.total_amount)],
  ];

  return (
    <dl aria-label="Ringkasan statistik" className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map(([label, value]) => (
        <Paper component="div" variant="outlined" key={label} className="min-w-0 p-4 sm:p-5">
          <Typography component="dt" variant="body2" color="text.secondary">{label}</Typography>
          <Typography component="dd" variant="h5" className="mt-1 font-semibold tabular-nums wrap-anywhere">{value}</Typography>
        </Paper>
      ))}
    </dl>
  );
}

function VisitsByClinic({ clinics }) {
  const largestCount = clinics[0]?.count ?? 1;

  return (
    <Paper component="section" variant="outlined" aria-labelledby="dashboard-clinics-title" className="grid min-w-0 content-start gap-4 p-4 sm:p-5">
      <Typography id="dashboard-clinics-title" component="h3" variant="h6">Kunjungan per poli</Typography>
      {clinics.length === 0 ? (
        <Typography color="text.secondary">Belum ada kunjungan pada periode ini.</Typography>
      ) : (
        <ul className="grid gap-4">
          {clinics.map((clinic) => (
            <li key={clinic.id} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="wrap-anywhere">{clinic.name}</span>
                <strong className="tabular-nums">{number.format(clinic.count)}</strong>
              </div>
              <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-700" style={{ width: (100 * clinic.count / largestCount) + '%' }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Paper>
  );
}

function RevenueByMethod({ revenue }) {
  return (
    <Paper component="section" variant="outlined" aria-labelledby="dashboard-revenue-title" className="grid min-w-0 content-start gap-3 p-4 sm:p-5">
      <div>
        <Typography id="dashboard-revenue-title" component="h3" variant="h6">Pendapatan per metode</Typography>
        <Typography variant="body2" color="text.secondary">{number.format(revenue.payment_count)} pembayaran pada periode ini</Typography>
      </div>
      {revenue.by_method.length === 0 ? (
        <Typography color="text.secondary">Belum ada pembayaran diterima.</Typography>
      ) : (
        <dl className="divide-y divide-slate-200">
          {revenue.by_method.map((entry) => (
            <div key={entry.method} className="flex flex-wrap justify-between gap-2 py-2">
              <dt>{paymentMethods[entry.method]}</dt>
              <dd className="font-semibold tabular-nums">{formatCurrency(entry.amount)}</dd>
            </div>
          ))}
        </dl>
      )}
    </Paper>
  );
}

function PaymentStatus({ invoices, selectedStatus, onSelectStatus }) {
  return (
    <Paper component="section" variant="outlined" aria-labelledby="dashboard-status-title" className="grid min-w-0 content-start gap-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Typography id="dashboard-status-title" component="h3" variant="h6">Status pembayaran</Typography>
          <Typography variant="body2" color="text.secondary">Status terkini untuk invoice yang terbit pada periode ini</Typography>
        </div>
        <Button size="small" aria-pressed={selectedStatus === 'all'} onClick={() => onSelectStatus('all')} disabled={invoices.total === 0}>
          Semua invoice
        </Button>
      </div>
      <ul className="grid gap-2">
        {invoiceStatuses.map((status) => {
          const count = invoices.by_status.find((entry) => entry.status === status)?.count ?? 0;
          return (
            <li key={status}>
              <Button
                fullWidth
                variant={selectedStatus === status ? 'contained' : 'outlined'}
                color={billingStatuses[status].color === 'default' ? 'inherit' : billingStatuses[status].color}
                aria-pressed={selectedStatus === status}
                disabled={count === 0}
                onClick={() => onSelectStatus(status)}
                className="justify-between gap-2"
              >
                {billingStatuses[status].label}
                <strong className="tabular-nums">{number.format(count)}</strong>
              </Button>
            </li>
          );
        })}
      </ul>
      <dl className="flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-3">
        <dt>Sisa tagihan</dt>
        <dd className="font-semibold tabular-nums">{formatCurrency(invoices.balance_amount)}</dd>
      </dl>
    </Paper>
  );
}

function ActivityTable({ id, title, rows, empty, showUnit = false }) {
  return (
    <Paper component="section" variant="outlined" aria-labelledby={id} className="grid min-w-0 content-start gap-3 p-4 sm:p-5">
      <Typography id={id} component="h3" variant="h6">{title}</Typography>
      {rows.length === 0 ? (
        <Typography color="text.secondary">{empty}</Typography>
      ) : (
        <TableContainer className="rounded-lg border border-slate-200">
          <Table size="small" aria-labelledby={id}>
            <TableHead className="bg-slate-50">
              <TableRow>
                <TableCell>Nama</TableCell>
                {showUnit && <TableCell>Satuan</TableCell>}
                <TableCell align="right">Jumlah</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="wrap-anywhere">
                    {row.name}
                    <Typography component="span" variant="caption" color="text.secondary" className="block">{row.code}</Typography>
                  </TableCell>
                  {showUnit && <TableCell className="wrap-anywhere">{row.unit}</TableCell>}
                  <TableCell align="right" className="whitespace-nowrap tabular-nums">{number.format(row.quantity)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
}

export function DashboardSummary({ summary, selectedStatus, onSelectStatus, children }) {
  return (
    <>
      <MetricCards summary={summary} />
      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <VisitsByClinic clinics={summary.visits.by_clinic} />
        <PaymentStatus invoices={summary.invoices} selectedStatus={selectedStatus} onSelectStatus={onSelectStatus} />
      </div>
      {children}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <ActivityTable
          id="dashboard-procedures-title"
          title="Rincian tindakan medis"
          rows={summary.procedures.items}
          empty="Belum ada tindakan medis pada periode ini."
        />
        <ActivityTable
          id="dashboard-medicines-title"
          title="Penggunaan obat"
          rows={summary.medicines.items}
          empty="Belum ada obat yang diserahkan pada periode ini."
          showUnit
        />
        <RevenueByMethod revenue={summary.revenue} />
      </div>
    </>
  );
}
