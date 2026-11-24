<?php

declare(strict_types=1);

namespace app\laboratory;

use app\http\RequestInput;

final class LabInput
{
    public static function request(array $body): array
    {
        $errors = self::unknownFields($body, ['idempotency_key', 'lab_test_ids', 'clinical_notes']);
        $key = RequestInput::uuid($body['idempotency_key'] ?? null);
        if ($key === null) {
            $errors['idempotency_key'] = 'Kirim idempotency_key dalam format UUID.';
        }

        $tests = $body['lab_test_ids'] ?? null;
        $testIds = [];
        if (!is_array($tests) || !array_is_list($tests) || $tests === []) {
            $errors['lab_test_ids'] = 'Pilih minimal satu pemeriksaan lab.';
        } else {
            foreach ($tests as $value) {
                $id = RequestInput::id($value);
                if ($id === null || in_array($id, $testIds, true)) {
                    $errors['lab_test_ids'] = 'Gunakan ID pemeriksaan yang valid dan unik.';
                    break;
                }
                $testIds[] = $id;
            }
        }
        sort($testIds, SORT_STRING);

        $notes = self::text($body['clinical_notes'] ?? null, 'clinical_notes', 2000, $errors);
        if ($errors !== []) {
            throw new InvalidLabInput($errors);
        }

        return ['idempotency_key' => $key, 'lab_test_ids' => $testIds, 'clinical_notes' => $notes];
    }

    public static function results(array $body): array
    {
        $errors = self::unknownFields($body, ['items']);
        $rows = $body['items'] ?? null;
        $items = [];
        if (!is_array($rows) || !array_is_list($rows) || $rows === []) {
            $errors['items'] = 'Isi hasil untuk setiap pemeriksaan yang diminta.';
        } else {
            foreach ($rows as $index => $row) {
                $path = 'items.' . $index;
                if (!is_array($row) || array_diff_key($row, array_flip([
                    'lab_order_item_id', 'result_value', 'unit', 'reference_range', 'notes',
                ]))) {
                    $errors[$path] = 'Isian hasil pemeriksaan tidak valid.';
                    continue;
                }

                $id = RequestInput::id($row['lab_order_item_id'] ?? null);
                if ($id === null || isset($items[$id])) {
                    $errors[$path . '.lab_order_item_id'] = 'Gunakan ID item yang valid dan unik.';
                    continue;
                }

                $items[$id] = [
                    'result_value' => self::text($row['result_value'] ?? null, $path . '.result_value', 2000, $errors, required: true),
                    'unit' => self::text($row['unit'] ?? null, $path . '.unit', 30, $errors),
                    'reference_range' => self::text($row['reference_range'] ?? null, $path . '.reference_range', 120, $errors),
                    'notes' => self::text($row['notes'] ?? null, $path . '.notes', 2000, $errors),
                ];
            }
        }
        if ($errors !== []) {
            throw new InvalidLabInput($errors);
        }

        return $items;
    }

    private static function unknownFields(array $body, array $fields): array
    {
        return array_diff_key($body, array_flip($fields)) ? ['body' => 'Ada field yang tidak dikenal.'] : [];
    }

    private static function text(mixed $value, string $field, int $max, array &$errors, bool $required = false): ?string
    {
        if ($value !== null && (!is_string($value) || !mb_check_encoding($value, 'UTF-8') || str_contains($value, "\0"))) {
            $errors[$field] = 'Isi dengan teks yang valid.';
            return null;
        }

        $text = trim($value ?? '');
        if ($required && $text === '') {
            $errors[$field] = 'Isi hasil pemeriksaan.';
        } elseif (mb_strlen($text, 'UTF-8') > $max) {
            $errors[$field] = 'Isi maksimal ' . $max . ' karakter.';
        }

        return $text === '' ? null : $text;
    }
}
