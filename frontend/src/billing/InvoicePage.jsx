import { Alert, Button } from '@mui/material';
import { useEffect, useState } from 'react';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { getBillingDetail } from '../service/billingService.js';
import { InvoiceDocument } from './BillingPrint.jsx';

export function InvoicePage({ visitId, token, onUnauthorized }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const invoiceNo = detail?.billing.invoice?.invoice_no;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadInvoice() {
      setError('');
      try {
        const data = await getBillingDetail(visitId, { token, signal });
        if (!signal.aborted) setDetail(data);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setError(failure.message);
      }
    }

    loadInvoice();
    return () => controller.abort();
  }, [visitId, token, retry, onUnauthorized]);

  useEffect(() => {
    if (!invoiceNo) return;

    const previousTitle = document.title;
    document.title = 'Invoice ' + invoiceNo;
    return () => {
      document.title = previousTitle;
    };
  }, [invoiceNo]);

  return (
    <main className="invoice-page mx-auto grid w-full max-w-3xl gap-4 px-4 py-5 sm:px-6">
      <div className="invoice-toolbar flex flex-wrap items-center justify-between gap-3">
        <Button href={'#/billing/' + visitId} variant="outlined">Kembali ke tagihan</Button>
        {invoiceNo && (
          <Button variant="contained" onClick={() => window.print()}>Cetak / Simpan PDF</Button>
        )}
      </div>
      <LoadStatus
        loading={!detail}
        text="Memuat invoice…"
        error={error}
        onRetry={() => setRetry((count) => count + 1)}
      />
      {detail && !invoiceNo && <Alert severity="info">Tagihan belum diterbitkan.</Alert>}
      {invoiceNo && <InvoiceDocument visit={detail.visit} billing={detail.billing} />}
    </main>
  );
}
