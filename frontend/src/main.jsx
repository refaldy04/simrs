import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

const statusLabels = {
  checking: 'Memeriksa…',
  ready: 'Siap',
  unavailable: 'Tidak tersedia',
};

function ServiceStatus({ name, endpoint }) {
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function check() {
      try {
        const response = await fetch(endpoint, { cache: 'no-store', signal });
        const data = await response.json();
        setStatus(response.ok && data.status === 'ok' ? 'ready' : 'unavailable');
      } catch {
        if (!signal.aborted) setStatus('unavailable');
      }
    }

    void check();
    return () => controller.abort();
  }, [endpoint]);

  return (
    <div className="service">
      <dt>{name}</dt>
      <dd aria-live="polite" data-status={status}>{statusLabels[status]}</dd>
    </div>
  );
}

function App() {
  return (
    <main>
      <h1>SIMRS Rawat Jalan</h1>
      <section aria-labelledby="status-title">
        <h2 id="status-title">Status layanan</h2>
        <dl>
          <ServiceStatus name="Yii2 dan PostgreSQL" endpoint="/api/core/health" />
          <ServiceStatus name="Node.js" endpoint="/api/services/health" />
        </dl>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
