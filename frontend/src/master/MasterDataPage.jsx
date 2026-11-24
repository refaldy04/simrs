import { useEffect, useState } from 'react';
import { coreRequest } from '../api.js';
import { displayValue } from './format.js';
import { MasterRecordDialog } from './MasterRecordDialog.jsx';
import './master.css';

function RecordsTable({ resource, items, archiving, onOpen, onArchive }) {
  const columns = Object.entries(resource.columns);

  return (
    <div className="master-table-scroll" tabIndex={0} aria-label={'Daftar ' + resource.label.toLowerCase()}>
      <table className="master-table">
        <thead>
          <tr>
            {columns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}
            <th scope="col">Status</th>
            <th scope="col">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((record) => (
            <tr key={record.id}>
              {columns.map(([key]) => <td key={key}>{displayValue(record, key, resource.fields[key])}</td>)}
              <td>
                <span className="master-status" data-active={record.is_active}>
                  {record.is_active ? 'Aktif' : 'Nonaktif'}
                </span>
              </td>
              <td>
                <div className="master-row-actions">
                  <button type="button" onClick={() => onOpen({ mode: 'view', id: record.id })}>Lihat</button>
                  <button type="button" onClick={() => onOpen({ mode: 'edit', id: record.id })}>Ubah</button>
                  {record.is_active && (
                    <button type="button" className="archive-action" disabled={archiving !== null} onClick={() => onArchive(record)}>
                      {archiving === record.id ? 'Memproses…' : 'Nonaktifkan'}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MasterRecords({ resource, token, onUnauthorized }) {
  const [searchDraft, setSearchDraft] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialog, setDialog] = useState(null);
  const [archiving, setArchiving] = useState(null);
  const path = 'master-data/' + resource.key;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const params = new URLSearchParams({ q: query, status, page: String(page), page_size: '10' });
    setResult(null);
    setLoadError('');
    coreRequest(path + '?' + params.toString(), { token, signal }).then(
      (data) => {
        if (signal.aborted) return;
        const lastPage = Math.max(1, Math.ceil(data.total / data.page_size));
        if (page > lastPage) setPage(lastPage);
        else setResult(data);
      },
      (error) => {
        if (signal.aborted) return;
        if (error.status === 401) onUnauthorized();
        else setLoadError(error.message);
      },
    );
    return () => controller.abort();
  }, [page, path, query, revision, status, token, onUnauthorized]);

  function refresh() {
    setRevision((value) => value + 1);
  }

  function openDialog(next) {
    setNotice('');
    setActionError('');
    setDialog(next);
  }

  async function archive(record) {
    if (!window.confirm('Nonaktifkan data ini?')) return;

    setArchiving(record.id);
    setNotice('');
    setActionError('');
    try {
      await coreRequest(path + '/' + record.id, { token, method: 'DELETE' });
      setNotice('Data dinonaktifkan.');
      refresh();
    } catch (error) {
      if (error.status === 401) onUnauthorized();
      else setActionError(error.message);
    } finally {
      setArchiving(null);
    }
  }

  return (
    <section className="panel master-records" aria-labelledby="master-records-title">
      <div className="master-records-heading">
        <h2 id="master-records-title">{resource.label}</h2>
        <button className="button" type="button" onClick={() => openDialog({ mode: 'create' })}>
          Tambah {resource.label.toLowerCase()}
        </button>
      </div>
      <div className="master-toolbar">
        <form className="master-search" onSubmit={(event) => {
          event.preventDefault();
          setQuery(searchDraft.trim());
          setPage(1);
        }}>
          <label htmlFor="master-search">Pencarian</label>
          <div>
            <input id="master-search" type="search" value={searchDraft} maxLength={150}
              onChange={(event) => setSearchDraft(event.target.value)} />
            <button className="button button-secondary" type="submit">Cari</button>
          </div>
        </form>
        <div className="master-filter">
          <label htmlFor="master-status">Status</label>
          <select id="master-status" value={status} onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
            <option value="all">Semua</option>
          </select>
        </div>
      </div>
      {notice && <p className="master-notice" role="status">{notice}</p>}
      {actionError && <p className="feedback" role="alert">{actionError}</p>}
      {loadError ? (
        <>
          <p className="feedback" role="alert">{loadError}</p>
          <button type="button" className="button button-secondary" onClick={refresh}>Coba lagi</button>
        </>
      ) : !result ? <p role="status">Memuat daftar…</p> : (
        <>
          {result.items.length ? (
            <RecordsTable
              resource={resource}
              items={result.items}
              archiving={archiving}
              onOpen={openDialog}
              onArchive={archive}
            />
          ) : <p className="master-empty">Belum ada data yang cocok.</p>}
          <div className="master-pagination" aria-label="Halaman data">
            <span>{result.total.toLocaleString('id-ID')} data · Halaman {result.page}</span>
            <div>
              <button className="button button-secondary" type="button" disabled={page === 1}
                onClick={() => setPage((value) => value - 1)}>Sebelumnya</button>
              <button className="button button-secondary" type="button" disabled={page * result.page_size >= result.total}
                onClick={() => setPage((value) => value + 1)}>Berikutnya</button>
            </div>
          </div>
        </>
      )}
      {dialog && (
        <MasterRecordDialog
          key={dialog.mode + ':' + (dialog.id ?? 'new')}
          resource={resource}
          mode={dialog.mode}
          id={dialog.id}
          token={token}
          onUnauthorized={onUnauthorized}
          onClose={() => setDialog(null)}
          onEdit={() => setDialog({ mode: 'edit', id: dialog.id })}
          onSaved={(message) => {
            setDialog(null);
            setNotice(message);
            refresh();
          }}
        />
      )}
    </section>
  );
}

export function MasterDataPage({ token, requestedKey, onUnauthorized }) {
  const [resources, setResources] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    coreRequest('master-data', { token, signal }).then(
      ({ resources }) => { if (!signal.aborted) setResources(resources); },
      (failure) => {
        if (signal.aborted) return;
        if (failure.status === 401) onUnauthorized();
        else setError(failure.message);
      },
    );
    return () => controller.abort();
  }, [onUnauthorized, retry, token]);

  const selected = resources?.find((resource) => resource.key === requestedKey) ?? resources?.[0];
  if (!selected) {
    return (
      <section className="panel" aria-labelledby="master-data-title">
        <h2 id="master-data-title">Master data</h2>
        {error ? (
          <>
            <p className="feedback" role="alert">{error}</p>
            <button className="button button-secondary" type="button" onClick={() => {
              setError('');
              setRetry((value) => value + 1);
            }}>Coba lagi</button>
          </>
        ) : <p role="status">Memuat master data…</p>}
      </section>
    );
  }

  return (
    <div className={resources.length > 1 ? 'master-layout' : undefined}>
      {resources.length > 1 && (
        <nav className="panel master-resources" aria-label="Jenis master data">
          {resources.map((resource) => (
            <a key={resource.key} href={'#/master-data/' + resource.key}
              aria-current={resource.key === selected.key ? 'page' : undefined}>
              {resource.label}
            </a>
          ))}
        </nav>
      )}
      <MasterRecords key={selected.key} resource={selected} token={token} onUnauthorized={onUnauthorized} />
    </div>
  );
}
