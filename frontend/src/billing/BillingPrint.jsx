import { createPortal } from 'react-dom';
import { formatCurrency, formatDate, formatDateTime } from '../format.js';
import { billingStatuses } from './BillingComponents.jsx';
import { paymentMethods } from './PaymentForm.jsx';
import './print.css';

function PrintDetails({ fields, className }) {
  return (
    <dl className={className}>
      {fields.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function InvoiceDocument({ visit, billing }) {
  const { invoice, items } = billing;

  return (
    <article aria-labelledby="invoice-title" className="invoice-document min-w-0 rounded-lg border border-slate-300 bg-white p-4 sm:p-8">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-300 pb-4">
        <div>
          <p className="text-sm">SIMRS Rawat Jalan</p>
          <h1 id="invoice-title" className="text-2xl font-bold">Invoice rawat jalan</h1>
        </div>
        <PrintDetails className="invoice-number" fields={[['No. invoice', invoice.invoice_no]]} />
      </header>
      <PrintDetails
        className="invoice-metadata grid gap-x-6 gap-y-3 py-4 sm:grid-cols-2"
        fields={[
          ['Pasien', visit.patient_name],
          ['No. rekam medis', visit.medical_record_no],
          ['Poli', visit.clinic_name],
          ['Tanggal kunjungan', formatDate(visit.visit_date)],
          ['Tanggal terbit', formatDateTime(invoice.issued_at)],
          ['Status pembayaran', billingStatuses[invoice.status].label],
        ]}
      />
      <div className="invoice-table" tabIndex={0}>
        <table aria-label="Rincian invoice">
          <thead>
            <tr>
              <th scope="col">Rincian biaya</th>
              <th scope="col">Jumlah</th>
              <th scope="col">Tarif satuan</th>
              <th scope="col">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={index}>
                <td>{item.description}</td>
                <td>{item.quantity}</td>
                <td>{formatCurrency(item.unit_price)}</td>
                <td>{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PrintDetails
        className="invoice-summary ml-auto mt-4"
        fields={[
          ['Total tagihan', formatCurrency(invoice.total_amount)],
          ['Sudah dibayar', formatCurrency(invoice.paid_amount)],
          ['Sisa tagihan', formatCurrency(invoice.balance_amount)],
        ]}
      />
    </article>
  );
}

export function ReceiptPrint({ visit, payment }) {
  return createPortal(
    <article id="billing-print">
      <h1>SIMRS Rawat Jalan</h1>
      <h2>Bukti pembayaran</h2>
      <PrintDetails fields={[
        ['No. bukti bayar', payment.receipt_no],
        ['No. invoice', payment.invoice_no],
        ['Pasien', visit.patient_name],
        ['No. rekam medis', visit.medical_record_no],
        ['Tanggal bayar', formatDateTime(payment.paid_at)],
        ['Metode', paymentMethods[payment.method]],
        ...(payment.external_reference ? [['Referensi', payment.external_reference]] : []),
        ['Kasir', payment.cashier_name],
        ['Nominal dibayar', formatCurrency(payment.amount)],
      ]} />
    </article>,
    document.body,
  );
}
