import { useState } from 'react';
import { coreRequest } from './api.js';

export function LoginForm({ notice, onLogin }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError('');
    const values = new FormData(event.currentTarget);

    try {
      const session = await coreRequest('auth/login', {
        method: 'POST',
        body: { username: values.get('username'), password: values.get('password') },
      });
      onLogin(session);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="login-title">
      <h2 id="login-title">Masuk</h2>
      <form className="login-form" onSubmit={submit}>
        <label htmlFor="username">Nama pengguna</label>
        <input id="username" name="username" autoComplete="username" maxLength={64} required />
        <label htmlFor="password">Kata sandi</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        {(error || notice) && <p className="feedback" role="alert">{error || notice}</p>}
        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Sedang masuk…' : 'Masuk'}
        </button>
      </form>
    </section>
  );
}
