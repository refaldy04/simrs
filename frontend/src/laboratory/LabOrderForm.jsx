import { Alert, Button, Checkbox, FormControlLabel, FormGroup, TextField } from '@mui/material';
import { useRef, useState } from 'react';
import { formatCurrency } from '../format.js';

export function LabOrderForm({ tests, saving, error, onCreate }) {
  const [selectedTests, setSelectedTests] = useState([]);
  const [notes, setNotes] = useState('');
  const request = useRef(null);
  const fields = error?.fields ?? {};
  const availableTests = selectedTests.filter((id) => tests.some((test) => test.id === id));

  function selectTest(id, checked) {
    setSelectedTests((current) => checked ? [...current, id] : current.filter((value) => value !== id));
  }

  async function submit(event) {
    event.preventDefault();
    if (saving || availableTests.length === 0) return;

    const body = { lab_test_ids: [...availableTests].sort(), clinical_notes: notes.trim() };
    const signature = JSON.stringify(body);
    if (request.current?.signature !== signature) {
      request.current = { signature, key: crypto.randomUUID() };
    }

    if (await onCreate({ ...body, idempotency_key: request.current.key })) {
      request.current = null;
      setSelectedTests([]);
      setNotes('');
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      {error && <Alert severity="error">{fields.lab_test_ids ?? error.message}</Alert>}
      <fieldset disabled={saving} className="min-w-0 rounded-lg border border-slate-200 px-3 pb-2">
        <legend className="px-1 text-sm font-semibold">Pilih pemeriksaan</legend>
        <FormGroup className="max-h-56 flex-nowrap overflow-y-auto px-2">
          {tests.map((test) => (
            <FormControlLabel
              key={test.id}
              label={test.name + ' · ' + formatCurrency(test.price)}
              control={(
                <Checkbox
                  checked={selectedTests.includes(test.id)}
                  onChange={(event) => selectTest(test.id, event.target.checked)}
                />
              )}
            />
          ))}
        </FormGroup>
      </fieldset>
      <TextField
        label="Catatan klinis (opsional)"
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        disabled={saving}
        multiline
        minRows={2}
        error={Boolean(fields.clinical_notes)}
        helperText={fields.clinical_notes}
        slotProps={{ htmlInput: { maxLength: 2000 } }}
      />
      <Button type="submit" variant="contained" className="justify-self-start" disabled={saving || availableTests.length === 0}>
        {saving ? 'Menyimpan…' : 'Kirim permintaan'}
      </Button>
    </form>
  );
}
