import { STATUS_CODES } from 'node:http';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function sendProblem(response, status, message) {
  if (status === 401) response.set('WWW-Authenticate', 'Bearer');
  return response.status(status).json({ name: STATUS_CODES[status], message, code: 0, status });
}

export function handleError(error, _request, response, next) {
  if (response.headersSent) return next(error);
  if (error instanceof HttpError) return sendProblem(response, error.status, error.message);
  if (error.status === 413) return sendProblem(response, 413, 'Ukuran body JSON melebihi batas.');
  if (error.status === 415) return sendProblem(response, 415, 'Kirim data dalam format JSON UTF-8.');
  if (error.status === 400) return sendProblem(response, 400, 'Body JSON tidak valid.');

  console.error('Permintaan Node.js gagal diproses.', error.code ?? error.name);
  return sendProblem(response, 500, 'Permintaan gagal diproses.');
}
