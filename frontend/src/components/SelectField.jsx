import { TextField } from '@mui/material';

export function SelectField({ children, ...props }) {
  return (
    <TextField select size="small" slotProps={{ select: { native: true }, inputLabel: { shrink: true } }} {...props}>
      {children}
    </TextField>
  );
}
