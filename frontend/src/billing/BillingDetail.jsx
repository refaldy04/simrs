import { Alert, Button, Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { formatDate } from '../format.js';
import { VisitStatus } from '../registration/VisitTable.jsx';
import { getBillingDetail, issueInvoice } from '../service/billingService.js';
import { BillingComponents } from './BillingComponents.jsx';
import { ReceiptPrint } from './BillingPrint.jsx';
import { PaymentForm } from './PaymentForm.jsx';
import { PaymentHistory } from './PaymentHistory.jsx';

export function BillingDetail({ visitId, token, onUnauthorized }) {
  const [detail, setDetail] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [issueError, setIssueError] = useState('');
  const [retry, setRetry] = useState(0);
  const [issuing, setIssuing] = useState(false);
  const [paymentCount, setPaymentCount] = useState(0);
  const [notice, setNotice] = useState(null);
  const [receiptToPrint, setReceiptToPrint] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadDetail() {
      setLoadError('');
      try {
        const data = await getBillingDetail(visitId, { token, signal });
        if (!signal.aborted) setDetail(data);
      } catch (error) {
        if (signal.aborted) return;
        if (error.status === 401) onUnauthorized();
        else setLoadError(error.message);
      }
    }

    loadDetail();
    return () => controller.abort();
  }, [visitId, token, retry, onUnauthorized]);

  useEffect(() => {
    if (!receiptToPrint) return;

    function closePrint() {
      setReceiptToPrint(null);
    }

    window.addEventListener('afterprint', closePrint);
    window.print();
    return () => window.removeEventListener('afterprint', closePrint);
  }, [receiptToPrint]);

  function refresh() {
    setRetry((count) => count + 1);
    setPaymentCount((count) => count + 1);
  }

  async function issue() {
    setIssuing(true);
    setIssueError('');
    setNotice(null);
    try {
      const result = await issueInvoice(visitId, { token });
      setDetail(result.detail);
      setNotice({ text: 'Tagihan diterbitkan.' });
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      else setIssueError(error.message);
    } finally {
      setIssuing(false);
    }
  }

  function paymentSaved(result) {
    setDetail(result.detail);
    setPaymentCount((count) => count + 1);
    setNotice({
      text: result.replayed ? 'Pembayaran sudah tercatat.' : 'Pembayaran berhasil dicatat.',
      payment: result.payment,
    });
  }

  function printReceipt(payment) {
    setReceiptToPrint({ visit: detail.visit, payment });
  }

  const visit = detail?.visit;
  const invoice = detail?.billing.invoice;

  return (
    <div className="grid min-w-0 gap-4">
      <Paper component="section" variant="outlined" aria-labelledby="billing-detail-title" className="grid gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Typography id="billing-detail-title" component="h2" variant="h6">Tagihan pasien</Typography>
          <Button href="#/billing" variant="outlined">Kembali ke daftar tagihan</Button>
        </div>
        <LoadStatus loading={!detail} text="Memuat tagihan…" error={loadError} onRetry={refresh} />
        {visit && (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <Typography variant="h5" className="wrap-anywhere">{visit.patient_name}</Typography>
              <VisitStatus status={visit.status} />
            </div>
            <Typography color="text.secondary">
              {visit.medical_record_no} · {formatDate(visit.visit_date)} · {visit.clinic_name}
            </Typography>
            <div className="flex flex-wrap gap-2">
              {detail.can_issue && (
                <Button variant="contained" disabled={issuing} onClick={issue}>
                  {issuing ? 'Menerbitkan…' : 'Terbitkan tagihan'}
                </Button>
              )}
              {invoice && (
                <Button variant="outlined" href={'#/billing/' + visitId + '/invoice'}>
                  Cetak invoice
                </Button>
              )}
              <Button onClick={refresh} disabled={issuing}>Muat ulang</Button>
            </div>
          </>
        )}
        {issueError && <Alert severity="error">{issueError}</Alert>}
      </Paper>
      {notice && (
        <Alert
          severity="success"
          role="status"
          action={notice.payment && <Button color="inherit" size="small" onClick={() => printReceipt(notice.payment)}>Cetak bukti bayar</Button>}
        >
          {notice.text}
        </Alert>
      )}
      {detail && (
        <>
          <BillingComponents billing={detail.billing} />
          {invoice && (
            <PaymentForm
              key={invoice.id}
              invoice={invoice}
              token={token}
              onSaved={paymentSaved}
              onRefresh={refresh}
              onUnauthorized={onUnauthorized}
            />
          )}
          <PaymentHistory visitId={visitId} token={token} paymentCount={paymentCount} onPrint={printReceipt} onUnauthorized={onUnauthorized} />
        </>
      )}
      {receiptToPrint && <ReceiptPrint visit={receiptToPrint.visit} payment={receiptToPrint.payment} />}
    </div>
  );
}
