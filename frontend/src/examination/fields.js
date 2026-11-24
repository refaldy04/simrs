export const noteFields = [
  { name: 'chief_complaint', label: 'Keluhan utama', required: true },
  { name: 'anamnesis', label: 'Anamnesis' },
  { name: 'physical_findings', label: 'Hasil pemeriksaan fisik' },
];

export const vitalFields = [
  { name: 'systolic_bp', label: 'Sistolik (mmHg)' },
  { name: 'diastolic_bp', label: 'Diastolik (mmHg)' },
  { name: 'pulse_rate', label: 'Nadi (kali/menit)' },
  { name: 'respiratory_rate', label: 'Pernapasan (kali/menit)' },
  { name: 'temperature_c', label: 'Suhu (°C)', decimal: true },
];
