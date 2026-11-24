import { coreRequest } from './coreRequest.js';

export function listMasterResources(options) {
  return coreRequest('master-data', options);
}

export function listMasterRecords(key, { query, status, page }, options) {
  const params = new URLSearchParams({ q: query, status, page, page_size: 10 });
  return coreRequest(`master-data/${key}?${params}`, options);
}

export function getMasterRecord(key, id, options) {
  return coreRequest(`master-data/${key}/${id}`, options);
}

export function getMasterOptions(key, options) {
  return coreRequest(`master-data/${key}/options`, options);
}

export function saveMasterRecord(key, id, body, options) {
  const path = `master-data/${key}`;
  return id
    ? coreRequest(`${path}/${id}`, { ...options, method: 'PATCH', body })
    : coreRequest(path, { ...options, method: 'POST', body });
}

export function archiveMasterRecord(key, id, options) {
  return coreRequest(`master-data/${key}/${id}`, { ...options, method: 'DELETE' });
}
