import { coreRequest } from './coreRequest.js';

export function getBillingQueue({ term, status, page }, options) {
  const params = new URLSearchParams({ q: term, status, page, page_size: 10 });
  return coreRequest('billing/visits?' + params, options);
}

export function getBillingDetail(visitId, options) {
  return coreRequest('billing/visits/' + visitId, options);
}

export function issueInvoice(visitId, options) {
  return coreRequest('billing/visits/' + visitId + '/invoice', { ...options, method: 'POST' });
}

export function recordPayment(invoiceId, body, options) {
  return coreRequest('billing/invoices/' + invoiceId + '/payments', { ...options, method: 'POST', body });
}

export function getPaymentHistory(visitId, page, options) {
  const params = new URLSearchParams({ page, page_size: 10 });
  return coreRequest('billing/visits/' + visitId + '/history?' + params, options);
}
