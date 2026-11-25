import { servicesRequest } from './coreRequest.js';

export function getDashboardSummary(period, options) {
  return servicesRequest('dashboard/summary?' + new URLSearchParams(period), options);
}

export function getDashboardInvoices(period, status, page, options) {
  const params = new URLSearchParams({ ...period, status, page, page_size: 10 });
  return servicesRequest('dashboard/invoices?' + params, options);
}
