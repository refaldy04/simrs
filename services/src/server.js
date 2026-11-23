import express from 'express';
import { requirePermission } from './authorization.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.disable('x-powered-by');

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.get('/access/laboratory', requirePermission('lab.results.read'), (_request, response) => {
  response.json({ permission: 'lab.results.read', allowed: true });
});

app.get('/access/dashboard', requirePermission('dashboard.read'), (_request, response) => {
  response.json({ permission: 'dashboard.read', allowed: true });
});

app.use((_request, response) => {
  response.status(404).json({ status: 'not_found' });
});

app.listen(port, '0.0.0.0', (error) => {
  if (error) throw error;
  console.log(`SIMRS services listening on port ${port}`);
});
