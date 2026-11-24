const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'UTC' });
const dateTime = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
const localDate = new Intl.DateTimeFormat('en', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Jakarta',
});

export function formatCurrency(value) {
  return currency.format(value);
}

export function formatDate(value) {
  const day = new Date(value + 'T00:00:00Z');
  return Number.isNaN(day.getTime()) ? value : date.format(day);
}

export function formatDateTime(value) {
  const instant = new Date(value);
  return Number.isNaN(instant.getTime()) ? value : dateTime.format(instant);
}

export function formatTime(value) {
  return value.endsWith(':00') ? value.slice(0, 5) : value;
}

export function todayInJakarta() {
  const { year, month, day } = Object.fromEntries(localDate.formatToParts(new Date())
    .map(({ type, value }) => [type, value]));
  return [year, month, day].join('-');
}
