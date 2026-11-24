import { coreRequest, servicesRequest } from './coreRequest.js';

export function getVisitLab(visitId, options) {
  return coreRequest('lab/visits/' + visitId, options);
}

export function getLabHistory(visitId, page, options) {
  const params = new URLSearchParams({ page, page_size: 5 });
  return coreRequest('lab/visits/' + visitId + '/history?' + params, options);
}

export function createLabOrder(visitId, body, options) {
  return coreRequest('lab/visits/' + visitId + '/orders', { ...options, method: 'POST', body });
}

export function getLabQueue({ term, status, page }, options) {
  const params = new URLSearchParams({ q: term, status, page, page_size: 10 });
  return servicesRequest('lab/orders?' + params, options);
}

export function getLabOrder(orderId, options) {
  return servicesRequest('lab/orders/' + orderId, options);
}

export function saveLabResults(orderId, items, options) {
  return servicesRequest('lab/orders/' + orderId + '/results', { ...options, method: 'PUT', body: { items } });
}
