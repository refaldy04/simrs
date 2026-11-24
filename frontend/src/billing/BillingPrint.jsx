import { createPortal } from 'react-dom';
import { formatCurrency, formatDate, formatDateTime } from '../format.js';
import { billingStatuses } from './BillingComponents.jsx';
import { paymentMethods } from './PaymentForm.jsx';
import './print.css';

function PrintDetails({ fields }) {
  return (
    <dl>
      {fields.map(([name, value]) => (
        <div key={name}><dt>{name}</dt><dd>{value}</dd></div>
      ))}
    </dl>
  );
}

function InvoicePrint({ visit, billing }) {
  const { invoice, items } = billing;

  return (
    <>
      <h2>Invoice rawat jalan</h2>
      <PrintDetails fields={[
        ['No. invoice', invoice.invoice_no],
        ['Tanggal terbit', formatDateTime(invoice.issued_at)],
        ['Pasien', visit.patient_name],
        ['No. rekam medis', visit.medical_record_no],
        ['Kunjungan', formatDate(visit.visit_date) + ' · ' + visit.clinic_name],
        ['Status', billingStatuses[invoice.status].label],
      ]} />
      <table aria-label="Rincian invoice">
        <thead><tr><th>Rincian biaya</th><th>Jumlah</th><th>Tarif satuan</th><th>Subtotal</th></tr></thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index}>
              <td>{item.description}</td><td>{item.quantity}</td>
              <td>{formatCurrency(item.unit_price)}</td><td>{formatCurrency(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <PrintDetails fields={[
        ['Total tagihan', formatCurrency(invoice.total_amount)],
        ['Sudah dibayar', formatCurrency(invoice.paid_amount)],
        ['Sisa tagihan', formatCurrency(invoice.balance_amount)],
      ]} />
    </>
  );
}

function ReceiptPrint({ visit, payment }) {
  return (
    <>
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
    </>
  );
}

export function BillingPrint({ job }) {
  return createPortal(
    <article id="billing-print">
      <h1>SIMRS Rawat Jalan</h1>
      {job.type === 'invoice'
        ? <InvoicePrint visit={job.visit} billing={job.billing} />
        : <ReceiptPrint visit={job.visit} payment={job.payment} />}
    </article>,
    document.body,
  );
}
