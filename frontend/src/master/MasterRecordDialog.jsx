import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { LoadStatus } from '../components/LoadStatus.jsx';
import { getMasterOptions, getMasterRecord, saveMasterRecord } from '../service/masterDataService.js';
import { displayValue } from './format.js';
import { MasterRecordForm } from './MasterRecordForm.jsx';

const modeTitles = { create: 'Tambah', view: 'Detail', edit: 'Ubah' };

export function MasterRecordDialog({ resource, mode, id, token, onUnauthorized, onClose, onEdit, onSaved }) {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const { key, fields } = resource;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function loadDialog() {
      try {
        const needsOptions = mode !== 'view' && Object.values(fields).some(
          (field) => field.type === 'relation' && !(mode === 'edit' && field.create_only),
        );
        const recordRequest = id ? getMasterRecord(key, id, { token, signal }) : null;
        const optionsRequest = needsOptions ? getMasterOptions(key, { token, signal }) : null;
        const [record, lookups] = await Promise.all([recordRequest, optionsRequest]);
        if (!signal.aborted) setData({ record, options: lookups?.options ?? {} });
      } catch (error) {
        if (signal.aborted) return;
        if (error.status === 401) onUnauthorized();
        else setLoadError(error.message);
      }
    }

    loadDialog();
    return () => controller.abort();
  }, [id, key, mode, onUnauthorized, fields, retry, token]);

  function retryDialog() {
    setLoadError('');
    setRetry((count) => count + 1);
  }

  function handleClose(_event, reason) {
    if (!saving && reason !== 'backdropClick') onClose();
  }

  async function save(body) {
    setSaving(true);
    setSaveError(null);
    try {
      await saveMasterRecord(key, id, body, { token });
      onSaved(id ? 'Perubahan disimpan.' : 'Data ditambahkan.');
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      else setSaveError(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={handleClose} fullWidth maxWidth="sm" aria-labelledby="master-dialog-title">
      <DialogTitle id="master-dialog-title">{modeTitles[mode]} {resource.label.toLowerCase()}</DialogTitle>
      {!data && (
        <DialogContent>
          <LoadStatus loading text="Memuat data…" error={loadError} onRetry={retryDialog} />
        </DialogContent>
      )}
      {!data && loadError && (
        <DialogActions><Button onClick={onClose}>Tutup</Button></DialogActions>
      )}
      {data && mode === 'view' && (
        <>
          <DialogContent>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {Object.entries(fields).map(([fieldKey, field]) => (
                <div key={fieldKey} className="min-w-0">
                  <Typography component="dt" color="text.secondary" variant="body2">{field.label}</Typography>
                  <Typography component="dd" className="wrap-anywhere">{displayValue(data.record, fieldKey, field)}</Typography>
                </div>
              ))}
            </dl>
          </DialogContent>
          <DialogActions>
            <Button onClick={onClose}>Tutup</Button>
            <Button variant="contained" onClick={onEdit}>Ubah</Button>
          </DialogActions>
        </>
      )}
      {data && mode !== 'view' && (
        <MasterRecordForm
          fields={fields}
          record={data.record}
          options={data.options}
          saving={saving}
          saveError={saveError}
          onClose={onClose}
          onSave={save}
        />
      )}
    </Dialog>
  );
}
