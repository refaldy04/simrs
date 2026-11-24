import { formatCurrency, formatDate, formatTime } from '../format.js';

export function displayValue(record, key, field) {
  const value = record[key];
  if (value === null || value === undefined || value === '') return '—';
  if (field?.display) return record[field.display] || value;

  switch (field?.type) {
    case 'choice': return field.choices[value] ?? value;
    case 'money': return formatCurrency(value);
    case 'date': return formatDate(value);
    case 'time': return formatTime(value);
    case 'boolean': return value ? 'Aktif' : 'Nonaktif';
    default: return value;
  }
}
