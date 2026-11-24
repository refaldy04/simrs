import express from 'express';
import { coreApiTarget, requirePermission } from '../authorization.js';
import { HttpError } from '../errors.js';
import { listOrders } from './queue.js';

const canReadQueue = requirePermission('lab.requests.read');
const canWriteResults = requirePermission('lab.results.write');
const statuses = ['open', 'requested', 'in_progress', 'completed', 'cancelled', 'all'];
const jsonBody = express.json({ limit: '512kb' });

export const labRouter = express.Router();

function pageNumber(value, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) {
    throw new HttpError(400, 'Parameter halaman tidak valid.');
  }

  return Number(value);
}

function orderId(value) {
  if (!/^[1-9]\d{0,18}$/.test(value) || (value.length === 19 && value > '9223372036854775807')) {
    throw new HttpError(404, 'Permintaan laboratorium tidak ditemukan.');
  }
  return value;
}

function requireJson(request, _response, next) {
  if (!request.is('application/json')) throw new HttpError(415, 'Kirim data dalam format JSON.');
  next();
}

async function forwardToCore(request, response, path, body) {
  let upstream;
  let data;
  try {
    const headers = { authorization: request.get('authorization'), accept: 'application/json' };
    if (body !== undefined) headers['content-type'] = 'application/json';
    upstream = await fetch(new URL(path, coreApiTarget), {
      method: request.method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
      redirect: 'error',
    });
    data = await upstream.json();
  } catch {
    throw new HttpError(503, 'Layanan inti laboratorium sedang tidak tersedia.');
  }

  if (!data || typeof data !== 'object' || upstream.status >= 500) {
    throw new HttpError(503, 'Layanan inti laboratorium sedang tidak tersedia.');
  }
  if (upstream.status === 401) response.set('WWW-Authenticate', 'Bearer');
  response.status(upstream.status).json(data);
}

labRouter.get('/orders', canReadQueue, async (request, response) => {
  const { status = 'open', q = '' } = request.query;
  if (!statuses.includes(status)) throw new HttpError(400, 'Status permintaan lab tidak valid.');
  if (typeof q !== 'string' || [...q].length > 150 || q.includes('\0')) {
    throw new HttpError(400, 'Kata kunci pencarian tidak valid.');
  }
  const page = pageNumber(request.query.page, 1, Math.floor(Number.MAX_SAFE_INTEGER / 100));
  const pageSize = pageNumber(request.query.page_size, 20, 100);

  response.json(await listOrders({ term: q.trim(), status, page, pageSize }));
});

labRouter.get('/orders/:id', canReadQueue, async (request, response) => {
  const id = orderId(request.params.id);
  await forwardToCore(request, response, '/lab/orders/' + id);
});

labRouter.put('/orders/:id/results', canWriteResults, requireJson, jsonBody, async (request, response) => {
  const id = orderId(request.params.id);
  if (!request.body || Array.isArray(request.body) || typeof request.body !== 'object') {
    throw new HttpError(400, 'Body permintaan harus berupa objek JSON.');
  }
  await forwardToCore(request, response, '/lab/orders/' + id + '/results', request.body);
});
