<?php

declare(strict_types=1);

namespace app\procedure;

use app\http\RequestInput;

final class ProcedureInput
{
    public static function addition(array $body): array
    {
        $errors = self::unknownFields($body, ['procedure_id', 'quantity', 'expected_unit_price', 'reason']);
        $procedureId = RequestInput::id($body['procedure_id'] ?? null);
        if ($procedureId === null) {
            $errors['procedure_id'] = 'Pilih tindakan dari master tindakan.';
        }

        $quantity = self::quantity(array_key_exists('quantity', $body) ? $body['quantity'] : 1, 'quantity', $errors);
        $price = $body['expected_unit_price'] ?? null;
        if ($price !== null && (!is_string($price) || !preg_match('/\A(?:0|[1-9][0-9]{0,11})\.[0-9]{2}\z/', $price))) {
            $errors['expected_unit_price'] = 'Gunakan tarif dari pilihan tindakan.';
        }
        $reason = self::reason($body['reason'] ?? null, $errors);
        if ($errors !== []) {
            throw new InvalidProcedureInput($errors);
        }

        return ['procedure_id' => $procedureId, 'quantity' => $quantity, 'expected_unit_price' => $price, 'reason' => $reason];
    }

    public static function change(array $body, bool $cancel): array
    {
        $fields = $cancel ? ['expected_quantity', 'reason'] : ['quantity', 'expected_quantity', 'reason'];
        $errors = self::unknownFields($body, $fields);
        $expected = self::quantity($body['expected_quantity'] ?? null, 'expected_quantity', $errors);
        $quantity = $cancel ? null : self::quantity($body['quantity'] ?? null, 'quantity', $errors);
        $reason = self::reason($body['reason'] ?? null, $errors);
        if ($errors !== []) {
            throw new InvalidProcedureInput($errors);
        }

        return ['expected_quantity' => $expected, 'quantity' => $quantity, 'reason' => $reason];
    }

    private static function unknownFields(array $body, array $allowed): array
    {
        return array_diff(array_keys($body), $allowed) ? ['body' => 'Ada field yang tidak dikenal.'] : [];
    }

    private static function quantity(mixed $value, string $field, array &$errors): ?int
    {
        $number = is_string($value) || is_int($value)
            ? filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 2147483647]])
            : false;
        if ($number === false) {
            $errors[$field] = 'Isi jumlah dengan bilangan bulat positif.';
            return null;
        }

        return $number;
    }

    private static function reason(mixed $value, array &$errors): ?string
    {
        if ($value === null) {
            return null;
        }
        if (!is_string($value) || !mb_check_encoding($value, 'UTF-8') || str_contains($value, "\0")) {
            $errors['reason'] = 'Isi alasan dengan teks yang valid.';
            return null;
        }

        $reason = trim($value);

        return $reason === '' ? null : $reason;
    }
}
