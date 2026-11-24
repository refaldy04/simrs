import {
  Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import { formatCurrency } from '../format.js';

const itemTypes = {
  registration: 'Pendaftaran',
  procedure: 'Tindakan',
  lab: 'Laboratorium',
  medicine: 'Obat',
};

export const billingStatuses = {
  unissued: { label: 'Belum terbit', color: 'default' },
  unpaid: { label: 'Belum dibayar', color: 'default' },
  partial: { label: 'Dibayar sebagian', color: 'warning' },
  paid: { label: 'Lunas', color: 'success' },
};

export function BillingStatus({ status }) {
  const option = billingStatuses[status];

  return <Chip size="small" variant="outlined" color={option.color} label={option.label} />;
}

export function BillingComponents({ billing }) {
  const invoice = billing.invoice;

  return (
    <Paper component="section" variant="outlined" aria-labelledby="billing-components-title" className="grid min-w-0 gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Typography id="billing-components-title" component="h2" variant="h6">Komponen tagihan</Typography>
          <Typography variant="body2" color="text.secondary">
            {invoice ? 'Tagihan ' + invoice.invoice_no : 'Estimasi biaya kunjungan'}
          </Typography>
        </div>
        {invoice && <BillingStatus status={invoice.status} />}
      </div>
      <TableContainer tabIndex={0} className="rounded-lg border border-slate-200">
        <Table size="small" aria-label="Rincian komponen tagihan" className="min-w-[34rem]">
          <TableHead className="bg-slate-50">
            <TableRow>
              <TableCell>Komponen</TableCell>
              <TableCell align="right">Jumlah</TableCell>
              <TableCell align="right">Tarif satuan</TableCell>
              <TableCell align="right">Subtotal</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {billing.items.map((item, index) => (
              <TableRow key={index}>
                <TableCell>
                  {item.description}
                  <Typography component="span" variant="caption" color="text.secondary" className="block">
                    {itemTypes[item.item_type]}
                  </Typography>
                </TableCell>
                <TableCell align="right">{item.quantity}</TableCell>
                <TableCell align="right" className="whitespace-nowrap">{formatCurrency(item.unit_price)}</TableCell>
                <TableCell align="right" className="whitespace-nowrap">{formatCurrency(item.subtotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <dl className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-slate-600">{invoice ? 'Total tagihan' : 'Total estimasi'}</dt>
          <dd className="font-semibold">{formatCurrency(billing.total_amount)}</dd>
        </div>
        {invoice && (
          <>
            <div>
              <dt className="text-sm text-slate-600">Sudah dibayar</dt>
              <dd className="font-semibold">{formatCurrency(invoice.paid_amount)}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-600">Sisa tagihan</dt>
              <dd className="font-semibold">{formatCurrency(invoice.balance_amount)}</dd>
            </div>
          </>
        )}
      </dl>
    </Paper>
  );
}
