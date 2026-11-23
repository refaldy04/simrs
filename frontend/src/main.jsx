import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { authRequest, readStoredToken, storeToken } from './auth.js';
import { LoginForm } from './LoginForm.jsx';
import './style.css';

const permissionLabels = {
  'master.manage': 'Kelola master data',
  'users.manage': 'Kelola pengguna',
  'dashboard.read': 'Lihat dashboard',
  'audit.read': 'Lihat riwayat perubahan',
  'patients.manage': 'Kelola data pasien',
  'visits.register': 'Daftarkan kunjungan',
  'visits.queue': 'Lihat antrean',
  'examinations.manage': 'Catat pemeriksaan dan diagnosis',
  'procedures.manage': 'Catat tindakan medis',
  'prescriptions.create': 'Tulis resep',
  'prescriptions.dispense': 'Proses penyerahan obat',
  'lab.request': 'Ajukan pemeriksaan lab',
  'lab.requests.read': 'Lihat permintaan lab',
  'lab.results.read': 'Lihat hasil lab',
  'lab.results.write': 'Catat hasil lab',
  'billing.manage': 'Kelola tagihan dan pembayaran',
};

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
  const [session, setSession] = useState(() => {
    const token = readStoredToken();
    return token ? { token, profile: null } : null;
  });
  const [notice, setNotice] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!session || session.profile) return;

    const controller = new AbortController();
    const { signal } = controller;
    authRequest('me', { token: session.token, signal }).then(
      (profile) => {
        if (!signal.aborted) setSession({ token: session.token, profile });
      },
      (error) => {
        if (signal.aborted) return;
        if (error.status === 401) {
          storeToken(null);
          setSession(null);
          setNotice('Sesi berakhir. Masuk kembali untuk melanjutkan.');
        } else {
          setNotice(error.message);
        }
      },
    );
    return () => controller.abort();
  }, [session, restoreAttempt]);

  function login({ access_token: token, user, permissions }) {
    storeToken(token);
    setNotice('');
    setSession({ token, profile: { user, permissions } });
  }

  async function logout() {
    setSigningOut(true);
    setNotice('');
    try {
      await authRequest('logout', { method: 'POST', token: session.token });
    } catch (error) {
      if (error.status !== 401) {
        setNotice(error.message);
        return;
      }
    } finally {
      setSigningOut(false);
    }

    storeToken(null);
    setSession(null);
  }

  if (!session) {
    return (
      <main className="shell login-shell">
        <h1>SIMRS Rawat Jalan</h1>
        <LoginForm notice={notice} onLogin={login} />
      </main>
    );
  }

  if (!session.profile) {
    return (
      <main className="shell login-shell">
        <h1>SIMRS Rawat Jalan</h1>
        <div className="panel">
          {notice ? (
            <>
              <p className="feedback" role="alert">{notice}</p>
              <button className="button" type="button" onClick={() => {
                setNotice('');
                setRestoreAttempt((attempt) => attempt + 1);
              }}>Coba lagi</button>
            </>
          ) : <p role="status">Memeriksa sesi…</p>}
        </div>
      </main>
    );
  }

  const { user, permissions } = session.profile;
  return (
    <main className="shell">
      <header className="workspace-header">
        <div>
          <h1>SIMRS Rawat Jalan</h1>
          <p className="identity"><strong>{user.full_name}</strong><span>{user.role_name}</span></p>
        </div>
        <button className="button button-secondary" type="button" onClick={logout} disabled={signingOut}>
          {signingOut ? 'Sedang keluar…' : 'Keluar'}
        </button>
      </header>
      {notice && <p className="feedback" role="alert">{notice}</p>}
      <div className="workspace">
        <section className="panel" aria-labelledby="permissions-title">
          <h2 id="permissions-title">Hak akses</h2>
          {permissions.length > 0 ? (
            <ul className="permissions">
              {permissions.map((permission) => <li key={permission}>{permissionLabels[permission] ?? permission}</li>)}
            </ul>
          ) : <p>Belum ada izin untuk peran ini.</p>}
        </section>
        <section className="panel" aria-labelledby="status-title">
          <h2 id="status-title">Status layanan</h2>
          <dl>
            <ServiceStatus name="Yii2 dan PostgreSQL" endpoint="/api/core/health" />
            <ServiceStatus name="Node.js" endpoint="/api/services/health" />
          </dl>
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
