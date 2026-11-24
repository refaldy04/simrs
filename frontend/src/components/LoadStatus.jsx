import { Alert, Button, Typography } from '@mui/material';

export function LoadStatus({ loading, text, error, onRetry }) {
  if (error) {
    return (
      <Alert
        severity="error"
        action={<Button size="small" color="inherit" onClick={onRetry}>Coba lagi</Button>}
      >
        {error}
      </Alert>
    );
  }

  if (loading) {
    return <Typography role="status" color="text.secondary">{text}</Typography>;
  }

  return null;
}
