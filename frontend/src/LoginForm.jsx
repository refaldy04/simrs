import { Alert, Button, Paper, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { login } from './service/authService.js';

export function LoginForm({ notice, onLogin }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    setError('');

    try {
      const session = await login(values.get('username'), values.get('password'));
      onLogin(session);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Paper component="section" variant="outlined" aria-labelledby="login-title" className="grid gap-4 p-5 sm:p-6">
      <Typography id="login-title" component="h2" variant="h6">Masuk</Typography>
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <TextField
          id="username"
          name="username"
          label="Nama pengguna"
          autoComplete="username"
          slotProps={{ htmlInput: { maxLength: 64 } }}
          required
        />
        <TextField
          id="password"
          name="password"
          label="Kata sandi"
          type="password"
          autoComplete="current-password"
          required
        />
        {(error || notice) && <Alert severity="error">{error || notice}</Alert>}
        <Button variant="contained" type="submit" disabled={pending}>
          {pending ? 'Sedang masuk…' : 'Masuk'}
        </Button>
      </form>
    </Paper>
  );
}
