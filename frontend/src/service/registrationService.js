import { coreRequest } from './coreRequest.js';

export function searchPatients({ term, page }, options) {
  const params = new URLSearchParams({ q: term, page, page_size: 6 });
  return coreRequest(`registration/patients?${params}`, options);
}

export function listPatientVisits(patientId, page, options) {
  const params = new URLSearchParams({ page, page_size: 6 });
  return coreRequest(`registration/patients/${patientId}/visits?${params}`, options);
}

export function listSchedules(date, options) {
  const params = new URLSearchParams({ date });
  return coreRequest(`registration/schedules?${params}`, options);
}

export function listQueue({ date, status, page, clinicId }, options) {
  const params = new URLSearchParams({ date, status, page, page_size: 15 });
  if (clinicId) params.set('clinic_id', clinicId);
  return coreRequest(`registration/visits?${params}`, options);
}

export function registerVisit(patientId, scheduleId, options) {
  return coreRequest('registration/visits', {
    ...options,
    method: 'POST',
    body: { patient_id: patientId, schedule_id: scheduleId },
  });
}

export function cancelVisit(visitId, options) {
  return coreRequest(`registration/visits/${visitId}/cancel`, { ...options, method: 'POST' });
}
