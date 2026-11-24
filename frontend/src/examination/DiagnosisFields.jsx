import { Button, TextField, Typography } from '@mui/material';

export function DiagnosisFields({ diagnoses, errors, disabled, onAdd, onRemove, onChange }) {
  return (
    <section aria-labelledby="diagnosis-title" className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Typography id="diagnosis-title" component="h3" variant="subtitle1" className="font-semibold">
          Diagnosis
        </Typography>
        <Button size="small" variant="outlined" disabled={disabled} onClick={onAdd}>
          Tambah diagnosis sekunder
        </Button>
      </div>
      {errors.diagnoses && <Typography color="error" role="alert">{errors.diagnoses}</Typography>}
      {diagnoses.map((diagnosis, index) => {
        const label = diagnosis.is_primary ? 'utama' : 'sekunder ' + index;
        const codeError = errors['diagnoses.' + index + '.code'];
        const descriptionError = errors['diagnoses.' + index + '.description'];

        return (
          <div key={diagnosis.key} className="grid min-w-0 gap-3 rounded-lg border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Typography variant="body2" className="font-semibold">Diagnosis {label}</Typography>
              {!diagnosis.is_primary && (
                <Button
                  size="small"
                  color="error"
                  aria-label={'Hapus diagnosis ' + label}
                  disabled={disabled}
                  onClick={() => onRemove(diagnosis.key)}
                >
                  Hapus
                </Button>
              )}
            </div>
            <div className="grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)]">
              <TextField
                size="small"
                label={'Kode ' + label + ' (opsional)'}
                value={diagnosis.code}
                onChange={(event) => onChange(diagnosis.key, 'code', event.target.value)}
                slotProps={{ htmlInput: { maxLength: 20 } }}
                disabled={disabled}
                error={Boolean(codeError)}
                helperText={codeError}
              />
              <TextField
                size="small"
                label={'Deskripsi diagnosis ' + label}
                value={diagnosis.description}
                onChange={(event) => onChange(diagnosis.key, 'description', event.target.value)}
                required={!diagnosis.is_primary}
                disabled={disabled}
                error={Boolean(descriptionError)}
                helperText={descriptionError}
                multiline
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}
