import { Button, Typography } from '@mui/material';

export function ListPagination({ data, onPage, disabled = false, showTotal = false }) {
  const lastPage = Math.max(1, Math.ceil(data.total / data.page_size));
  if (lastPage === 1 && !showTotal) return null;

  return (
    <nav aria-label="Halaman data" className="flex flex-wrap items-center justify-between gap-2">
      <Typography variant="body2" color="text.secondary">
        {showTotal && data.total.toLocaleString('id-ID') + ' data · '}
        Halaman {data.page} dari {lastPage}
      </Typography>
      <div className="flex gap-2">
        <Button size="small" variant="outlined" disabled={disabled || data.page <= 1} onClick={() => onPage(data.page - 1)}>
          Sebelumnya
        </Button>
        <Button size="small" variant="outlined" disabled={disabled || data.page >= lastPage} onClick={() => onPage(data.page + 1)}>
          Berikutnya
        </Button>
      </div>
    </nav>
  );
}
