import { HttpError } from '../errors.js';

const jakarta = 'Asia/Jakarta';
const calendar = new Intl.DateTimeFormat('en', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: jakarta,
});

function monthToDate() {
  const { year, month, day } = Object.fromEntries(calendar.formatToParts(new Date()).map(({ type, value }) => [type, value]));
  return { date_from: year + '-' + month + '-01', date_to: year + '-' + month + '-' + day };
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function dashboardPeriod(query) {
  const { date_from, date_to } = query.date_from === undefined && query.date_to === undefined ? monthToDate() : query;
  if (!validDate(date_from) || !validDate(date_to)) {
    throw new HttpError(400, 'Isi tanggal mulai dan tanggal akhir dalam format YYYY-MM-DD.');
  }
  if (date_from > date_to) {
    throw new HttpError(400, 'Tanggal akhir harus sama dengan atau setelah tanggal mulai.');
  }

  return { date_from, date_to, time_zone: jakarta };
}
