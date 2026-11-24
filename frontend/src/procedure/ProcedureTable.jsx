import { Button, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { formatCurrency } from '../format.js';

export function ProcedureTable({ items, canWrite, saving, onSelect }) {
  if (items.length === 0) {
    return <Typography color="text.secondary">Belum ada tindakan tercatat.</Typography>;
  }

  return (
    <TableContainer tabIndex={0} className="rounded-lg border border-slate-200">
      <Table size="small" aria-label="Daftar tindakan kunjungan" className="min-w-[39rem]">
        <TableHead className="bg-slate-50">
          <TableRow>
            <TableCell>Tindakan</TableCell>
            <TableCell align="right">Jumlah</TableCell>
            <TableCell align="right">Tarif satuan</TableCell>
            <TableCell align="right">Subtotal</TableCell>
            <TableCell>Status</TableCell>
            {canWrite && <TableCell>Aksi</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id} hover>
              <TableCell>
                {item.name}
                <Typography component="span" variant="caption" color="text.secondary" className="block">{item.code}</Typography>
              </TableCell>
              <TableCell align="right">{item.quantity}</TableCell>
              <TableCell align="right" className="whitespace-nowrap">{formatCurrency(item.unit_price)}</TableCell>
              <TableCell align="right" className="whitespace-nowrap">{formatCurrency(item.subtotal)}</TableCell>
              <TableCell>
                <Chip size="small" variant="outlined" label={item.cancelled_at ? 'Dibatalkan' : 'Tercatat'} />
              </TableCell>
              {canWrite && (
                <TableCell>
                  {!item.cancelled_at && (
                    <div className="flex flex-wrap gap-1">
                      <Button size="small" disabled={saving} onClick={() => onSelect({ item, cancel: false })}>Ubah jumlah</Button>
                      <Button size="small" color="error" disabled={saving} onClick={() => onSelect({ item, cancel: true })}>
                        Batalkan
                      </Button>
                    </div>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
