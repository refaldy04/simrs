import express from 'express';
import { requirePermission } from './authorization.js';
import { db } from './database.js';
import { handleError, sendProblem } from './errors.js';
import { startLabIntake } from './laboratory/queue.js';
import { labRouter } from './laboratory/router.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);

app.disable('x-powered-by');

app.get('/health', async (_request, response) => {
  try {
    await db.query('SELECT 1');
    response.json({ status: 'ok', database: 'ok' });
  } catch {
    response.status(503).json({ status: 'unavailable', database: 'unavailable' });
  }
});

app.get('/access/laboratory', requirePermission('lab.results.read'), (_request, response) => {
  response.json({ permission: 'lab.results.read', allowed: true });
});

app.get('/access/dashboard', requirePermission('dashboard.read'), (_request, response) => {
  response.json({ permission: 'dashboard.read', allowed: true });
});

app.use('/lab', labRouter);
app.use((_request, response) => sendProblem(response, 404, 'Endpoint tidak ditemukan.'));
app.use(handleError);

app.listen(port, '0.0.0.0', (error) => {
  if (error) throw error;
  startLabIntake();
  console.log(`SIMRS services listening on port ${port}`);
});
