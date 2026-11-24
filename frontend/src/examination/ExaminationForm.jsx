import { Alert, Button, Paper, TextField, Typography } from '@mui/material';
import { useRef, useState } from 'react';
import { saveExamination } from '../service/examinationService.js';
import { DiagnosisFields } from './DiagnosisFields.jsx';
import { noteFields, vitalFields } from './fields.js';

function initialDiagnoses(examination) {
  const saved = examination?.diagnoses ?? [];
  const primary = saved.find((diagnosis) => diagnosis.is_primary) ?? { is_primary: true, description: '' };
  const secondary = saved.filter((diagnosis) => !diagnosis.is_primary);

  return [primary, ...secondary].map((diagnosis, index) => ({
    ...diagnosis,
    code: diagnosis.code ?? '',
    key: index,
  }));
}

export function ExaminationForm({ context, token, onSaved, onReload, onUnauthorized }) {
  const { visit, examination, requires_revision_reason: requiresReason } = context;
  const [diagnoses, setDiagnoses] = useState(() => initialDiagnoses(examination));
  const nextDiagnosisKey = useRef(diagnoses.length);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const errors = saveError?.fields ?? {};
  const canFinish = visit.status === 'waiting' || visit.status === 'in_examination';

  function addDiagnosis() {
    const key = nextDiagnosisKey.current++;
    setDiagnoses((current) => [...current, { key, code: '', description: '', is_primary: false }]);
  }

  function removeDiagnosis(key) {
    setDiagnoses((current) => current.filter((diagnosis) => diagnosis.key !== key));
  }

  function changeDiagnosis(key, name, value) {
    setDiagnoses((current) => current.map((diagnosis) => (
      diagnosis.key === key ? { ...diagnosis, [name]: value } : diagnosis
    )));
  }

  function reloadForm() {
    if (window.confirm('Muat ulang pemeriksaan? Isian yang belum disimpan akan hilang.')) onReload();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const finish = event.nativeEvent.submitter?.value === 'finish';
    const primary = diagnoses[0];
    if ((finish || requiresReason || diagnoses.length > 1) && !primary.description.trim()) {
      setSaveError({ message: 'Isi diagnosis utama.', fields: { 'diagnoses.0.description': 'Isi diagnosis utama.' } });
      return;
    }

    const fields = Object.fromEntries(new FormData(event.currentTarget));
    const selectedDiagnoses = primary.description.trim() || primary.code.trim() ? diagnoses : diagnoses.slice(1);
    const body = {
      ...fields,
      diagnoses: selectedDiagnoses.map(({ code, description, is_primary }) => ({ code, description, is_primary })),
      expected_updated_at: examination?.updated_at ?? null,
      finish,
    };
    setSaving(true);
    setSaveError(null);

    try {
      const result = await saveExamination(visit.id, body, { token });
      onSaved(result, finish);
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      else setSaveError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper component="section" variant="outlined" aria-labelledby="exam-form-title" className="min-w-0 p-4 sm:p-6">
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <Typography id="exam-form-title" component="h2" variant="h6">Hasil pemeriksaan</Typography>
        {noteFields.map(({ name, label, required }) => (
          <TextField
            key={name}
            name={name}
            label={label}
            required={required}
            defaultValue={examination?.[name] ?? ''}
            disabled={saving}
            error={Boolean(errors[name])}
            helperText={errors[name]}
            multiline
            minRows={2}
            fullWidth
          />
        ))}
        <section aria-labelledby="vital-title" className="grid gap-3">
          <Typography id="vital-title" component="h3" variant="subtitle1" className="font-semibold">Tanda vital</Typography>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {vitalFields.map(({ name, label, decimal }) => (
              <TextField
                key={name}
                name={name}
                label={label}
                size="small"
                type="number"
                defaultValue={examination?.[name] ?? ''}
                disabled={saving}
                error={Boolean(errors[name])}
                helperText={errors[name]}
                slotProps={{ htmlInput: decimal ? { min: 0.1, max: 999.9, step: 0.1 } : { min: 1, max: 32767, step: 1 } }}
              />
            ))}
          </div>
        </section>
        <DiagnosisFields
          diagnoses={diagnoses}
          errors={errors}
          disabled={saving}
          onAdd={addDiagnosis}
          onRemove={removeDiagnosis}
          onChange={changeDiagnosis}
        />
        {requiresReason && (
          <TextField
            name="reason"
            label="Alasan perubahan"
            disabled={saving}
            error={Boolean(errors.reason)}
            helperText={errors.reason}
            required
            multiline
            minRows={2}
          />
        )}
        {saveError && (
          <Alert
            severity="error"
            action={saveError.status === 409 && (
              <Button type="button" color="inherit" size="small" onClick={reloadForm}>Muat ulang data</Button>
            )}
          >
            {saveError.message}
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" value="save" variant={canFinish ? 'outlined' : 'contained'} disabled={saving}>
            {saving ? 'Menyimpan…' : 'Simpan pemeriksaan'}
          </Button>
          {canFinish && (
            <Button type="submit" value="finish" variant="contained" disabled={saving}>
              Selesaikan pemeriksaan
            </Button>
          )}
        </div>
      </form>
    </Paper>
  );
}
