import {
  Alert, Button, Checkbox, DialogActions, DialogContent, FormControl, FormControlLabel, FormHelperText, TextField, Typography,
} from '@mui/material';
import { useState } from 'react';
import { SelectField } from '../components/SelectField.jsx';
import { displayValue } from './format.js';

function MasterField({ fieldKey, field, value, options, record, saving, error, onChange }) {
  const id = 'master-field-' + fieldKey;

  if (record && field.create_only) {
    return (
      <div>
        <Typography component="label" htmlFor={id} color="text.secondary" variant="body2">{field.label}</Typography>
        <Typography component="output" id={id} className="block wrap-anywhere">{displayValue(record, fieldKey, field)}</Typography>
      </div>
    );
  }

  if (field.type === 'boolean') {
    const errorId = id + '-error';
    return (
      <FormControl error={Boolean(error)}>
        <FormControlLabel
          label={field.label}
          control={(
            <Checkbox
              name={fieldKey}
              checked={value}
              disabled={saving}
              onChange={(event) => onChange(event.target.checked)}
              slotProps={{ input: { id, 'aria-describedby': error ? errorId : undefined } }}
            />
          )}
        />
        {error && <FormHelperText id={errorId}>{error}</FormHelperText>}
      </FormControl>
    );
  }

  const fieldProps = {
    id,
    name: fieldKey,
    label: field.label,
    value,
    required: field.required,
    disabled: saving,
    error: Boolean(error),
    helperText: error,
    onChange: (event) => onChange(event.target.value),
  };

  if (field.type === 'relation' || field.type === 'choice') {
    const choices = field.type === 'relation'
      ? (options[fieldKey] ?? [])
      : Object.entries(field.choices).map(([value, label]) => ({ value, label }));
    const retainCurrentValue = value !== '' && !choices.some((option) => option.value === value);

    return (
      <SelectField {...fieldProps}>
        <option value="">{field.required ? 'Pilih ' + field.label.toLowerCase() : '—'}</option>
        {retainCurrentValue && (
          <option value={value}>{record ? displayValue(record, fieldKey, field) : value} (pilihan saat ini)</option>
        )}
        {choices.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}{option.hint ? ' · ' + option.hint : ''}
          </option>
        ))}
      </SelectField>
    );
  }

  const isNumber = field.type === 'money' || field.type === 'integer';
  const isTextarea = field.type === 'textarea';
  const input = { maxLength: field.max_length };
  if (isNumber) {
    input.min = 0;
    input.step = field.type === 'money' ? '0.01' : '1';
  }
  if (field.type === 'integer') input.max = 2147483647;
  if (field.type === 'time') input.step = '1';

  return (
    <TextField
      {...fieldProps}
      size="small"
      type={isNumber ? 'number' : field.type}
      multiline={isTextarea}
      minRows={isTextarea ? 3 : undefined}
      className={isTextarea ? 'sm:col-span-2' : undefined}
      slotProps={{
        htmlInput: input,
        inputLabel: field.type === 'date' || field.type === 'time' ? { shrink: true } : undefined,
      }}
    />
  );
}

function initialValues(fields, record) {
  const values = {};
  for (const [key, field] of Object.entries(fields)) {
    const value = record?.[key] ?? field.default ?? '';
    values[key] = field.type === 'boolean' ? value === true : String(value);
  }
  return values;
}

export function MasterRecordForm({ fields, record, options, saving, saveError, onClose, onSave }) {
  const [initial] = useState(() => initialValues(fields, record));
  const [draft, setDraft] = useState(initial);

  function handleSubmit(event) {
    event.preventDefault();

    const changes = {};
    for (const [key, value] of Object.entries(draft)) {
      if (!record || (!fields[key].create_only && value !== initial[key])) changes[key] = value;
    }
    if (record && Object.keys(changes).length === 0) {
      onClose();
      return;
    }
    if (record && Object.hasOwn(changes, 'stock_quantity')) {
      changes.expected_stock_quantity = record.stock_quantity;
    }
    onSave(changes);
  }

  return (
    <form className="flex min-h-0 flex-col" onSubmit={handleSubmit}>
      <DialogContent>
        {saveError && <Alert severity="error" className="mb-4">{saveError.message}</Alert>}
        <div className="grid gap-4 pt-1 sm:grid-cols-2">
          {Object.entries(fields).map(([key, field]) => (
            <MasterField
              key={key}
              fieldKey={key}
              field={field}
              value={draft[key]}
              options={options}
              record={record}
              saving={saving}
              error={saveError?.fields?.[key]}
              onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
            />
          ))}
        </div>
      </DialogContent>
      <DialogActions>
        <Button type="button" disabled={saving} onClick={onClose}>Batal</Button>
        <Button variant="contained" type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
      </DialogActions>
    </form>
  );
}
