import { useEffect, useRef, useState } from 'react';
import { coreRequest } from '../api.js';
import { displayValue } from './format.js';

function MasterField({ fieldKey, field, value, onChange, options, record, editing, error }) {
  const id = 'master-field-' + fieldKey;
  const attributes = {
    id,
    name: fieldKey,
    required: field.required,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? id + '-error' : undefined,
  };

  let control;
  if (editing && field.create_only) {
    control = <output id={id}>{displayValue(record, fieldKey, field)}</output>;
  } else if (field.type === 'boolean') {
    return (
      <div className="master-field">
        <label className="master-checkbox" htmlFor={id}>
          <input
            id={id}
            name={fieldKey}
            type="checkbox"
            checked={value}
            onChange={(event) => onChange(event.target.checked)}
          />
          {field.label}
        </label>
        {error && <p className="field-error">{error}</p>}
      </div>
    );
  } else if (field.type === 'relation' || field.type === 'choice') {
    const choices = field.type === 'relation'
      ? (options[fieldKey] ?? [])
      : Object.entries(field.choices).map(([value, label]) => ({ value, label }));
    const retained = value !== '' && !choices.some((option) => option.value === value);
    control = (
      <select {...attributes} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{field.required ? 'Pilih ' + field.label.toLowerCase() : '—'}</option>
        {retained && <option value={value}>{displayValue(record, fieldKey, field)} (pilihan saat ini)</option>}
        {choices.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}{option.hint ? ' · ' + option.hint : ''}
          </option>
        ))}
      </select>
    );
  } else if (field.type === 'textarea') {
    control = (
      <textarea {...attributes} rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
    );
  } else {
    const numeric = field.type === 'money' || field.type === 'integer';
    control = (
      <input
        {...attributes}
        type={numeric ? 'number' : field.type}
        value={value}
        min={numeric ? 0 : undefined}
        max={field.type === 'integer' ? 2147483647 : undefined}
        step={field.type === 'money' ? '0.01' : numeric || field.type === 'time' ? '1' : undefined}
        maxLength={field.max_length}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }

  return (
    <div className={'master-field' + (field.type === 'textarea' ? ' master-field-wide' : '')}>
      <label htmlFor={id}>{field.label}</label>
      {control}
      {error && <p className="field-error" id={id + '-error'}>{error}</p>}
    </div>
  );
}

function MasterForm({ fields, record, options, saving, errors, onClose, onSave }) {
  const [initial] = useState(() => Object.fromEntries(Object.entries(fields).map(([key, field]) => {
    const value = record?.[key] ?? field.default ?? '';
    return [key, field.type === 'boolean' ? value === true : String(value)];
  })));
  const [draft, setDraft] = useState(initial);

  function submit(event) {
    event.preventDefault();
    const editing = record !== null;
    const changes = Object.entries(draft).filter(([key, value]) => (
      !editing || (!fields[key].create_only && value !== initial[key])
    ));
    const body = Object.fromEntries(changes);
    if (editing && Object.hasOwn(body, 'stock_quantity')) {
      body.expected_stock_quantity = record.stock_quantity;
    }
    if (editing && changes.length === 0) {
      onClose();
      return;
    }

    void onSave(body);
  }

  return (
    <form onSubmit={submit}>
      <fieldset className="master-fieldset" disabled={saving}>
        {Object.entries(fields).map(([key, field]) => (
          <MasterField
            key={key}
            fieldKey={key}
            field={field}
            value={draft[key]}
            options={options}
            record={record}
            editing={record !== null}
            error={errors[key]}
            onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
          />
        ))}
      </fieldset>
      <div className="master-dialog-actions">
        <button className="button button-secondary" type="button" disabled={saving} onClick={onClose}>Batal</button>
        <button className="button" type="submit" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</button>
      </div>
    </form>
  );
}

export function MasterRecordDialog({ resource, mode, id, token, onUnauthorized, onClose, onEdit, onSaved }) {
  const dialog = useRef(null);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const path = 'master-data/' + resource.key;

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const fetchOptions = mode !== 'view' && Object.values(resource.fields)
      .some((field) => field.type === 'relation' && !(mode === 'edit' && field.create_only));
    const record = id ? coreRequest(path + '/' + id, { token, signal }) : Promise.resolve(null);
    const lookups = fetchOptions
      ? coreRequest(path + '/options', { token, signal })
      : Promise.resolve({ options: {} });
    Promise.all([record, lookups]).then(
      ([record, { options }]) => { if (!signal.aborted) setData({ record, options }); },
      (error) => {
        if (signal.aborted) return;
        if (error.status === 401) onUnauthorized();
        else setLoadError(error.message);
      },
    );
    return () => controller.abort();
  }, [id, mode, onUnauthorized, path, resource.fields, retry, token]);

  async function save(body) {
    setSaving(true);
    setSaveError(null);
    try {
      await coreRequest(id ? path + '/' + id : path, { token, method: id ? 'PATCH' : 'POST', body });
      onSaved(id ? 'Perubahan disimpan.' : 'Data ditambahkan.');
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      else setSaveError(error);
    } finally {
      setSaving(false);
    }
  }

  const title = { create: 'Tambah ', view: 'Detail ', edit: 'Ubah ' }[mode] + resource.label.toLowerCase();
  return (
    <dialog ref={dialog} className="master-dialog" aria-labelledby="master-dialog-title" onCancel={(event) => {
      event.preventDefault();
      if (!saving) onClose();
    }}>
      <h2 id="master-dialog-title">{title}</h2>
      {loadError && (
        <>
          <p className="feedback" role="alert">{loadError}</p>
          <div className="master-dialog-actions">
            <button className="button button-secondary" type="button" onClick={onClose}>Tutup</button>
            <button className="button" type="button" onClick={() => { setLoadError(''); setRetry((value) => value + 1); }}>
              Coba lagi
            </button>
          </div>
        </>
      )}
      {!data && !loadError && <p role="status">Memuat data…</p>}
      {data && mode === 'view' && (
        <>
          <dl className="master-detail">
            {Object.entries(resource.fields).map(([key, field]) => (
              <div key={key}>
                <dt>{field.label}</dt>
                <dd>{displayValue(data.record, key, field)}</dd>
              </div>
            ))}
          </dl>
          <div className="master-dialog-actions">
            <button className="button button-secondary" type="button" onClick={onClose}>Tutup</button>
            <button className="button" type="button" onClick={onEdit}>Ubah</button>
          </div>
        </>
      )}
      {data && mode !== 'view' && (
        <>
          {saveError && <p className="feedback" role="alert">{saveError.message}</p>}
          <MasterForm
            fields={resource.fields}
            record={data.record}
            options={data.options}
            saving={saving}
            errors={saveError?.fields ?? {}}
            onClose={onClose}
            onSave={save}
          />
        </>
      )}
    </dialog>
  );
}
