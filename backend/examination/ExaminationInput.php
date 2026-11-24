<?php

declare(strict_types=1);

namespace app\examination;

final class ExaminationInput
{
    private const TEXT_FIELDS = ['chief_complaint', 'anamnesis', 'physical_findings'];
    public const INTEGER_FIELDS = ['systolic_bp', 'diastolic_bp', 'pulse_rate', 'respiratory_rate'];

    public static function parse(array $body): array
    {
        $errors = [];
        $allowed = [
            ...self::TEXT_FIELDS, ...self::INTEGER_FIELDS, 'temperature_c',
            'diagnoses', 'expected_updated_at', 'reason', 'finish',
        ];
        if (array_diff(array_keys($body), $allowed)) {
            $errors['body'] = 'Ada field yang tidak dikenal.';
        }

        $fields = [];
        foreach (self::TEXT_FIELDS as $name) {
            $fields[$name] = self::text($body[$name] ?? null, $name, $errors, $name === 'chief_complaint');
        }
        foreach (self::INTEGER_FIELDS as $name) {
            $fields[$name] = self::vitalInteger($body[$name] ?? null, $name, $errors);
        }
        $fields['temperature_c'] = self::temperature($body['temperature_c'] ?? null, $errors);

        $version = $body['expected_updated_at'] ?? null;
        if (!array_key_exists('expected_updated_at', $body)
            || ($version !== null && (!is_string($version) || $version === '' || strlen($version) > 64))
        ) {
            $errors['expected_updated_at'] = 'Muat ulang data pemeriksaan sebelum menyimpan.';
        }

        $finish = array_key_exists('finish', $body) ? $body['finish'] : false;
        if (!is_bool($finish)) {
            $errors['finish'] = 'Isi finish dengan true atau false.';
        }

        $diagnoses = self::diagnoses($body['diagnoses'] ?? null, $errors);
        $reason = self::text($body['reason'] ?? null, 'reason', $errors);
        if ($errors !== []) {
            throw new InvalidExaminationInput($errors);
        }

        return [
            'fields' => $fields,
            'diagnoses' => $diagnoses,
            'expected_updated_at' => $version,
            'reason' => $reason,
            'finish' => $finish,
        ];
    }

    private static function text(mixed $value, string $field, array &$errors, bool $required = false): ?string
    {
        if ($value !== null && (!is_string($value) || !mb_check_encoding($value, 'UTF-8') || str_contains($value, "\0"))) {
            $errors[$field] = 'Isi dengan teks yang valid.';
            return null;
        }

        $value = trim($value ?? '');
        if ($required && $value === '') {
            $errors[$field] = 'Field ini wajib diisi.';
        }

        return $value === '' ? null : $value;
    }

    private static function vitalInteger(mixed $value, string $field, array &$errors): ?int
    {
        if ($value === null || $value === '') {
            return null;
        }

        $number = is_int($value) || is_string($value)
            ? filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 32767]])
            : false;
        if ($number === false) {
            $errors[$field] = 'Isi dengan bilangan bulat antara 1 dan 32767.';
            return null;
        }

        return $number;
    }

    private static function temperature(mixed $value, array &$errors): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ((!is_string($value) && !is_int($value) && !is_float($value))
            || !preg_match('/\A[0-9]{1,3}(?:\.[0-9])?\z/', (string) $value)
            || (float) $value <= 0
        ) {
            $errors['temperature_c'] = 'Isi suhu positif dengan maksimal satu angka desimal.';
            return null;
        }

        return number_format((float) $value, 1, '.', '');
    }

    private static function diagnoses(mixed $values, array &$errors): array
    {
        if (!is_array($values) || !array_is_list($values)) {
            $errors['diagnoses'] = 'Kirim diagnosis sebagai daftar.';
            return [];
        }

        $primary = [];
        $secondary = [];
        $codes = [];
        foreach ($values as $index => $value) {
            $field = 'diagnoses.' . $index;
            if (!is_array($value) || array_diff_key($value, ['code' => true, 'description' => true, 'is_primary' => true])) {
                $errors[$field] = 'Isi kode, deskripsi, dan status diagnosis utama.';
                continue;
            }

            $code = self::text($value['code'] ?? null, $field . '.code', $errors);
            $description = self::text($value['description'] ?? null, $field . '.description', $errors, true);
            $isPrimary = $value['is_primary'] ?? null;
            if (!is_bool($isPrimary)) {
                $errors[$field . '.is_primary'] = 'Tentukan apakah diagnosis ini utama.';
                continue;
            }

            if ($code !== null) {
                $codeKey = mb_strtoupper($code, 'UTF-8');
                if (mb_strlen($code, 'UTF-8') > 20) {
                    $errors[$field . '.code'] = 'Kode diagnosis maksimal 20 karakter.';
                } elseif (isset($codes[$codeKey])) {
                    $errors[$field . '.code'] = 'Kode diagnosis ini sudah dipakai.';
                }
                $codes[$codeKey] = true;
            }

            $diagnosis = ['code' => $code, 'description' => $description, 'is_primary' => $isPrimary];
            if ($isPrimary) {
                $primary[] = $diagnosis;
            } else {
                $secondary[] = $diagnosis;
            }
        }

        if (($primary !== [] || $secondary !== []) && count($primary) !== 1) {
            $errors['diagnoses'] = 'Pilih tepat satu diagnosis utama.';
        }

        return [...$primary, ...$secondary];
    }
}
