const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const date = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeZone: 'UTC' });

export function displayValue(record, key, field) {
  const value = record[key];
  if (value === null || value === undefined || value === '') return '—';
  if (field?.display) return record[field.display] || value;

  switch (field?.type) {
    case 'choice': return field.choices[value] ?? value;
    case 'money': return currency.format(value);
    case 'date': {
      const day = new Date(value + 'T00:00:00Z');
      return Number.isNaN(day.getTime()) ? value : date.format(day);
    }
    case 'time': return value.endsWith(':00') ? value.slice(0, 5) : value;
    case 'boolean': return value ? 'Aktif' : 'Nonaktif';
    default: return value;
  }
}
