import express from 'express';
import { requirePermission } from '../authorization.js';
import { HttpError } from '../errors.js';
import { pagination } from '../httpInput.js';
import { dashboardPeriod } from './period.js';
import { dashboardInvoices, dashboardSummary } from './reports.js';

export const dashboardRouter = express.Router();

dashboardRouter.use(requirePermission('dashboard.read'));

dashboardRouter.get('/summary', async (request, response) => {
  response.json(await dashboardSummary(dashboardPeriod(request.query)));
});

dashboardRouter.get('/invoices', async (request, response) => {
  const period = dashboardPeriod(request.query);
  const status = request.query.status ?? 'all';
  if (!['all', 'unpaid', 'partial', 'paid'].includes(status)) {
    throw new HttpError(400, 'Status pembayaran tidak valid.');
  }

  response.json(await dashboardInvoices(period, { status, ...pagination(request.query) }));
});
