import { coreRequest } from './coreRequest.js';

export function getExamination(visitId, options) {
  return coreRequest('examinations/visits/' + visitId, options);
}

export function saveExamination(visitId, body, options) {
  return coreRequest('examinations/visits/' + visitId, { ...options, method: 'PUT', body });
}

export function getMedicalRecordHistory(visitId, page, options) {
  const params = new URLSearchParams({ page, page_size: 5 });
  return coreRequest('examinations/visits/' + visitId + '/history?' + params, options);
}
