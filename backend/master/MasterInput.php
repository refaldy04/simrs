<?php

declare(strict_types=1);

namespace app\master;

use app\http\RequestInput;

final class MasterInput
{
    public static function validate(array $fields, array $body, bool $creating): array
    {
        $values = [];
        $errors = array_fill_keys(array_keys(array_diff_key($body, $fields)), 'Kolom ini tidak dapat diubah.');

        foreach ($fields as $key => $field) {
            if (!array_key_exists($key, $body)) {
                if ($creating && array_key_exists('default', $field)) {
                    $values[$key] = $field['default'];
                } elseif ($creating && $field['required']) {
                    $errors[$key] = $field['label'] . ' wajib diisi.';
                }
                continue;
            }

            if (!$creating && ($field['create_only'] ?? false)) {
                $errors[$key] = $field['label'] . ' hanya dipilih saat membuat data.';
                continue;
            }

            $value = is_string($body[$key]) ? trim($body[$key]) : $body[$key];
            if ($value === null || $value === '') {
                if ($field['required']) {
                    $errors[$key] = $field['label'] . ' wajib diisi.';
                } else {
                    $values[$key] = null;
                }
                continue;
            }

            $normalized = match ($field['type']) {
                'text', 'textarea' => self::text($value, $field['max_length'] ?? null),
                'boolean' => is_bool($value) ? $value : null,
                'relation' => RequestInput::id($value),
                'integer' => self::integer($value),
                'money' => self::money($value),
                'date' => RequestInput::date($value),
                'time' => self::time($value),
                'choice' => is_string($value) && isset($field['choices'][$value]) ? $value : null,
            };

            if ($normalized === null) {
                $errors[$key] = $field['label'] . ' tidak valid.';
            } else {
                $values[$key] = $normalized;
            }
        }

        if ($errors !== []) {
            throw new InvalidMasterData($errors);
        }

        return $values;
    }

    private static function text(mixed $value, ?int $maxLength): ?string
    {
        if (!is_string($value) || str_contains($value, "\0") || !mb_check_encoding($value, 'UTF-8')) {
            return null;
        }

        return $maxLength !== null && mb_strlen($value, 'UTF-8') > $maxLength ? null : $value;
    }

    private static function integer(mixed $value): ?int
    {
        if (!is_int($value) && !(is_string($value) && preg_match('/\A[0-9]+\z/', $value))) {
            return null;
        }

        $quantity = (int) $value;

        return $quantity >= 0 && $quantity <= 2147483647 ? $quantity : null;
    }

    private static function money(mixed $value): ?string
    {
        if (is_int($value) || is_float($value)) {
            $value = json_encode($value, JSON_PRESERVE_ZERO_FRACTION);
        }

        return is_string($value) && preg_match('/\A[0-9]{1,12}(?:\.[0-9]{1,2})?\z/', $value) ? $value : null;
    }

    private static function time(mixed $value): ?string
    {
        if (!is_string($value) || !preg_match('/\A(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9](?:\.[0-9]{1,6})?)?\z/', $value)) {
            return null;
        }

        if (str_contains($value, '.')) {
            return rtrim(rtrim($value, '0'), '.');
        }

        return strlen($value) === 5 ? $value . ':00' : $value;
    }
}
