import { Alert, Button, Chip, Paper, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import { readStoredToken, storeToken } from './auth.js';
import { LoadStatus } from './components/LoadStatus.jsx';
import { LoginForm } from './LoginForm.jsx';
import { MasterDataPage } from './master/MasterDataPage.jsx';
import { RegistrationPage } from './registration/RegistrationPage.jsx';
import { getProfile, logout } from './service/authService.js';
import { WorkspaceOverview } from './WorkspaceOverview.jsx';

export function App() {
  const [session, setSession] = useState(() => {
    const token = readStoredToken();
    return token ? { token, profile: null } : null;
  });
  const [notice, setNotice] = useState('');
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [locationHash, setLocationHash] = useState(() => window.location.hash);

  const expireSession = useCallback(() => {
    storeToken(null);
    setSession(null);
    setNotice('Sesi berakhir. Masuk kembali untuk melanjutkan.');
  }, []);

  useEffect(() => {
    function syncLocation() {
      setLocationHash(window.location.hash);
    }

    window.addEventListener('hashchange', syncLocation);
    return () => window.removeEventListener('hashchange', syncLocation);
  }, []);

  useEffect(() => {
    if (!session || session.profile) return;

    const controller = new AbortController();
    const { signal } = controller;

    async function restoreSession() {
      try {
        const profile = await getProfile({ token: session.token, signal });
        if (!signal.aborted) setSession({ token: session.token, profile });
      } catch (error) {
        if (signal.aborted) return;
        if (error.status === 401) expireSession();
        else setNotice(error.message);
      }
    }

    restoreSession();
    return () => controller.abort();
  }, [session, restoreAttempt, expireSession]);

  function retrySession() {
    setNotice('');
    setRestoreAttempt((attempt) => attempt + 1);
  }

  function handleLogin({ access_token: token, user, permissions }) {
    storeToken(token);
    setNotice('');
    setSession({ token, profile: { user, permissions } });
  }

  async function handleLogout() {
    setSigningOut(true);
    setNotice('');
    try {
      await logout({ token: session.token });
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

  if (!session?.profile) {
    return (
      <main className="mx-auto grid w-full max-w-md gap-5 px-4 pt-12 sm:pt-24">
        <Typography component="h1" variant="h4" className="font-semibold">SIMRS Rawat Jalan</Typography>
        {session ? (
          <Paper variant="outlined" className="p-5">
            <LoadStatus loading text="Memeriksa sesi…" error={notice} onRetry={retrySession} />
          </Paper>
        ) : (
          <LoginForm notice={notice} onLogin={handleLogin} />
        )}
      </main>
    );
  }

  const { user, permissions } = session.profile;
  const canOpenMaster = permissions.includes('master.manage') || permissions.includes('patients.manage');
  const canRegister = permissions.includes('visits.register');
  const canReadQueue = permissions.includes('visits.queue');
  const masterRoute = canOpenMaster ? /^#\/master-data(?:\/([a-z-]+))?$/.exec(locationHash) : null;
  const registrationRoute = canReadQueue
    ? /^#\/registration(?:\/(schedules|queue))?(?:\?date=(\d{4}-\d{2}-\d{2}))?$/.exec(locationHash)
    : null;
  const onOverview = !masterRoute && !registrationRoute;

  let content = <WorkspaceOverview permissions={permissions} />;
  if (masterRoute) {
    content = <MasterDataPage token={session.token} requestedKey={masterRoute[1]} onUnauthorized={expireSession} />;
  } else if (registrationRoute) {
    content = (
      <RegistrationPage
        view={registrationRoute[1] ?? (canRegister ? 'register' : 'queue')}
        requestedDate={registrationRoute[2]}
        token={session.token}
        canRegister={canRegister}
        onUnauthorized={expireSession}
      />
    );
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="grid gap-1">
            <Typography component="h1" variant="h5" className="font-semibold">SIMRS Rawat Jalan</Typography>
            <div className="flex flex-wrap items-center gap-2">
              <Typography variant="body2">{user.full_name}</Typography>
              <Chip size="small" variant="outlined" label={user.role_name} />
            </div>
          </div>
          <Button variant="outlined" onClick={handleLogout} disabled={signingOut}>
            {signingOut ? 'Sedang keluar…' : 'Keluar'}
          </Button>
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 sm:py-7">
        {notice && <Alert severity="error">{notice}</Alert>}
        {(canOpenMaster || canReadQueue) && (
          <nav aria-label="Navigasi utama" className="flex flex-wrap gap-2">
            <Button href="#/" variant={onOverview ? 'contained' : 'text'} aria-current={onOverview ? 'page' : undefined}>
              Ringkasan
            </Button>
            {canOpenMaster && (
              <Button href="#/master-data" variant={masterRoute ? 'contained' : 'text'} aria-current={masterRoute ? 'page' : undefined}>
                Master data
              </Button>
            )}
            {canReadQueue && (
              <Button
                href={canRegister ? '#/registration' : '#/registration/queue'}
                variant={registrationRoute ? 'contained' : 'text'}
                aria-current={registrationRoute ? 'page' : undefined}
              >
                {canRegister ? 'Pendaftaran & antrean' : 'Jadwal & antrean'}
              </Button>
            )}
          </nav>
        )}
        {content}
      </main>
    </>
  );
}
