import { HttpError } from './errors.js';

function pageNumber(value, fallback, max) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) {
    throw new HttpError(400, 'Parameter halaman tidak valid.');
  }

  return Number(value);
}

export function pagination(query) {
  return {
    page: pageNumber(query.page, 1, Math.floor(Number.MAX_SAFE_INTEGER / 100)),
    pageSize: pageNumber(query.page_size, 20, 100),
  };
}
