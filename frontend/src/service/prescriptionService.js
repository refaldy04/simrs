import { coreRequest } from './coreRequest.js';

export function getVisitPrescriptions(visitId, options) {
  return coreRequest('prescriptions/visits/' + visitId, options);
}

export function createPrescription(visitId, body, options) {
  return coreRequest('prescriptions/visits/' + visitId, { ...options, method: 'POST', body });
}

export function cancelPrescription(visitId, prescriptionId, options) {
  return coreRequest('prescriptions/visits/' + visitId + '/' + prescriptionId + '/cancel', { ...options, method: 'POST' });
}

export function getMedicineHistory(visitId, page, options) {
  const params = new URLSearchParams({ page, page_size: 5 });
  return coreRequest('prescriptions/visits/' + visitId + '/history?' + params, options);
}

export function getPharmacyPrescriptions({ term, status, page }, options) {
  const params = new URLSearchParams({ q: term, status, page, page_size: 10 });
  return coreRequest('pharmacy/prescriptions?' + params, options);
}

export function dispensePrescription(prescriptionId, options) {
  return coreRequest('pharmacy/prescriptions/' + prescriptionId + '/dispense', { ...options, method: 'POST' });
}
