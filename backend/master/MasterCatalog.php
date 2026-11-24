<?php

declare(strict_types=1);

namespace app\master;

use yii\db\Query;

final class MasterCatalog
{
    public static function resources(): array
    {
        $resources = [
            'patients' => [
                'label' => 'Pasien',
                'table' => 'patients',
                'columns' => [
                    'medical_record_no' => 'No. rekam medis',
                    'full_name' => 'Nama lengkap',
                    'birth_date' => 'Tanggal lahir',
                    'sex' => 'Jenis kelamin',
                ],
                'search' => ['record.medical_record_no', 'record.national_id', 'record.full_name', 'record.phone'],
                'duplicate' => 'Nomor rekam medis atau nomor identitas sudah terdaftar.',
                'fields' => [
                    'medical_record_no' => self::text('No. rekam medis', 30),
                    'national_id' => self::text('Nomor identitas', 50, false),
                    'full_name' => self::text('Nama lengkap', 150),
                    'birth_date' => self::field('Tanggal lahir', 'date'),
                    'sex' => self::field('Jenis kelamin', 'choice') + ['choices' => [
                        'female' => 'Perempuan',
                        'male' => 'Laki-laki',
                        'unspecified' => 'Tidak ditentukan',
                    ]],
                    'phone' => self::text('Telepon', 30, false),
                    'address' => self::field('Alamat', 'textarea', false),
                ],
            ],
            'medical-staff' => [
                'label' => 'Tenaga medis',
                'table' => 'medical_staff',
                'columns' => [
                    'employee_no' => 'No. pegawai',
                    'full_name' => 'Nama lengkap',
                    'profession' => 'Profesi',
                    'account_name' => 'Akun',
                ],
                'search' => ['record.employee_no', 'record.full_name', 'record.profession', 'account.username'],
                'joins' => [[['account' => 'users'], 'account.id = record.user_id']],
                'aliases' => ['account_name' => 'account.username'],
                'duplicate' => 'Nomor pegawai atau akun ini sudah digunakan.',
                'fields' => [
                    'employee_no' => self::text('No. pegawai', 30),
                    'full_name' => self::text('Nama lengkap', 150),
                    'profession' => self::text('Profesi', 60),
                    'user_id' => self::relation('Akun', 'users', 'account_name', false),
                ],
            ],
            'doctors' => [
                'label' => 'Dokter',
                'table' => 'doctors',
                'primary_key' => 'staff_id',
                'columns' => [
                    'staff_name' => 'Nama dokter',
                    'specialty' => 'Spesialisasi',
                    'practice_license_no' => 'No. izin praktik',
                ],
                'search' => ['staff.full_name', 'staff.employee_no', 'record.specialty', 'record.practice_license_no'],
                'joins' => [[['staff' => 'medical_staff'], 'staff.id = record.staff_id']],
                'aliases' => ['staff_name' => 'staff.full_name'],
                'duplicate' => 'Profil dokter untuk tenaga medis ini atau nomor izin praktik sudah digunakan.',
                'fields' => [
                    'staff_id' => self::relation('Tenaga medis', 'staff', 'staff_name') + ['create_only' => true],
                    'specialty' => self::text('Spesialisasi', 100),
                    'practice_license_no' => self::text('No. izin praktik', 64, false),
                ],
            ],
            'clinics' => [
                'label' => 'Poli',
                'table' => 'clinics',
                'columns' => ['code' => 'Kode', 'name' => 'Nama poli', 'registration_fee' => 'Tarif pendaftaran'],
                'search' => ['record.code', 'record.name'],
                'duplicate' => 'Kode poli sudah digunakan.',
                'fields' => [
                    'code' => self::text('Kode', 30),
                    'name' => self::text('Nama poli', 100),
                    'registration_fee' => self::field('Tarif pendaftaran', 'money') + ['default' => '0'],
                ],
            ],
            'doctor-schedules' => [
                'label' => 'Jadwal praktik',
                'table' => 'doctor_schedules',
                'columns' => [
                    'practice_date' => 'Tanggal',
                    'doctor_name' => 'Dokter',
                    'clinic_name' => 'Poli',
                    'starts_at' => 'Mulai',
                    'ends_at' => 'Selesai',
                ],
                'search' => ['staff.full_name', 'clinic.name'],
                'sort' => ['record.practice_date' => SORT_DESC, 'record.starts_at' => SORT_ASC],
                'joins' => [
                    [['staff' => 'medical_staff'], 'staff.id = record.doctor_id'],
                    [['clinic' => 'clinics'], 'clinic.id = record.clinic_id'],
                ],
                'aliases' => ['doctor_name' => 'staff.full_name', 'clinic_name' => 'clinic.name'],
                'duplicate' => 'Dokter sudah memiliki jadwal pada tanggal dan jam mulai tersebut.',
                'fields' => [
                    'doctor_id' => self::relation('Dokter', 'doctors', 'doctor_name'),
                    'clinic_id' => self::relation('Poli', 'clinics', 'clinic_name'),
                    'practice_date' => self::field('Tanggal praktik', 'date'),
                    'starts_at' => self::field('Jam mulai', 'time'),
                    'ends_at' => self::field('Jam selesai', 'time'),
                ],
            ],
            'medical-procedures' => self::pricedResource('Tindakan medis', 'medical_procedures', 'Nama tindakan'),
            'medicines' => [
                'label' => 'Obat',
                'table' => 'medicines',
                'columns' => ['code' => 'Kode', 'name' => 'Nama obat', 'unit' => 'Satuan', 'price' => 'Harga', 'stock_quantity' => 'Stok'],
                'search' => ['record.code', 'record.name', 'record.unit'],
                'duplicate' => 'Kode obat sudah digunakan.',
                'fields' => [
                    'code' => self::text('Kode', 30),
                    'name' => self::text('Nama obat', 120),
                    'unit' => self::text('Satuan', 30),
                    'price' => self::field('Harga', 'money'),
                    'stock_quantity' => self::field('Stok', 'integer') + ['default' => 0],
                ],
            ],
            'lab-tests' => self::pricedResource('Pemeriksaan lab', 'lab_tests', 'Nama pemeriksaan'),
        ];

        foreach ($resources as &$resource) {
            $resource['fields']['is_active'] = self::field('Aktif', 'boolean') + ['default' => true];
        }
        unset($resource);

        return $resources;
    }

    public static function lookup(string $source): Query
    {
        return match ($source) {
            'users' => (new Query())->select(['value' => 'u.id', 'label' => 'u.username'])
                ->from(['u' => 'users'])->where(['u.is_active' => true]),
            'staff' => (new Query())->select(['value' => 's.id', 'label' => 's.full_name', 'hint' => 's.employee_no'])
                ->from(['s' => 'medical_staff'])->where(['s.is_active' => true]),
            'doctors' => (new Query())->select(['value' => 'd.staff_id', 'label' => 's.full_name', 'hint' => 's.employee_no'])
                ->from(['d' => 'doctors'])->innerJoin(['s' => 'medical_staff'], 's.id = d.staff_id')
                ->where(['d.is_active' => true, 's.is_active' => true]),
            'clinics' => (new Query())->select(['value' => 'c.id', 'label' => 'c.name', 'hint' => 'c.code'])
                ->from(['c' => 'clinics'])->where(['c.is_active' => true]),
        };
    }

    private static function pricedResource(string $label, string $table, string $nameLabel): array
    {
        return [
            'label' => $label,
            'table' => $table,
            'columns' => ['code' => 'Kode', 'name' => $nameLabel, 'price' => 'Tarif'],
            'search' => ['record.code', 'record.name'],
            'duplicate' => 'Kode sudah digunakan.',
            'fields' => [
                'code' => self::text('Kode', 30),
                'name' => self::text($nameLabel, 120),
                'price' => self::field('Tarif', 'money'),
            ],
        ];
    }

    private static function field(string $label, string $type, bool $required = true): array
    {
        return ['label' => $label, 'type' => $type, 'required' => $required];
    }

    private static function text(string $label, int $maxLength, bool $required = true): array
    {
        return self::field($label, 'text', $required) + ['max_length' => $maxLength];
    }

    private static function relation(string $label, string $lookup, string $display, bool $required = true): array
    {
        return self::field($label, 'relation', $required) + ['lookup' => $lookup, 'display' => $display];
    }
}
