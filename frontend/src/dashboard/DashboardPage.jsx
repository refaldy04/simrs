import { useEffect, useState } from 'react';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { getDashboardSummary } from '../service/dashboardService.js';
import { DashboardInvoices } from './DashboardInvoices.jsx';
import { DashboardPeriodFilter, currentMonthPeriod } from './DashboardPeriodFilter.jsx';
import { DashboardSummary } from './DashboardSummary.jsx';

export function DashboardPage({ query, token, onUnauthorized }) {
  const [period] = useState(() => {
    const params = new URLSearchParams(query);
    const initial = currentMonthPeriod();
    return {
      date_from: params.get('date_from') ?? initial.date_from,
      date_to: params.get('date_to') ?? initial.date_to,
    };
  });
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [invoiceStatus, setInvoiceStatus] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadDashboard() {
      setSummary(null);
      setError('');
      try {
        const data = await getDashboardSummary(period, { token, signal });
        if (!signal.aborted) setSummary(data);
      } catch (failure) {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setError(failure.message);
      }
    }

    loadDashboard();
    return () => controller.abort();
  }, [period, token, retry, onUnauthorized]);

  function reload() {
    setRetry((count) => count + 1);
  }

  function applyPeriod(range) {
    const next = '#/dashboard?' + new URLSearchParams(range);
    if (window.location.hash === next) reload();
    else window.location.hash = next;
  }

  return (
    <div className="grid min-w-0 gap-4">
      <DashboardPeriodFilter period={period} onApply={applyPeriod} />
      <LoadStatus loading={!summary} text="Memuat statistik…" error={error} onRetry={reload} />
      {summary && (
        <DashboardSummary summary={summary} selectedStatus={invoiceStatus} onSelectStatus={setInvoiceStatus}>
          {invoiceStatus && (
            <DashboardInvoices
              key={invoiceStatus}
              period={period}
              status={invoiceStatus}
              token={token}
              onClose={() => setInvoiceStatus(null)}
              onUnauthorized={onUnauthorized}
            />
          )}
        </DashboardSummary>
      )}
    </div>
  );
}
