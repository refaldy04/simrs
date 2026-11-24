<?php

declare(strict_types=1);

namespace app\prescription;

use app\http\RequestInput;

final class PrescriptionInput
{
    public static function parse(array $body): array
    {
        $errors = [];
        if (array_diff_key($body, ['idempotency_key' => true, 'items' => true])) {
            $errors['body'] = 'Ada field yang tidak dikenal.';
        }

        $key = $body['idempotency_key'] ?? null;
        if (!is_string($key) || !preg_match('/\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i', $key)) {
            $errors['idempotency_key'] = 'Kirim idempotency_key dalam format UUID.';
        }

        $rows = $body['items'] ?? null;
        $items = [];
        if (!is_array($rows) || !array_is_list($rows) || $rows === []) {
            $errors['items'] = 'Tambahkan minimal satu obat.';
        } else {
            foreach ($rows as $index => $row) {
                $item = self::item($row, 'items.' . $index, $errors);
                if ($item !== null) {
                    $items[] = $item;
                }
            }
        }

        if ($errors !== []) {
            throw new InvalidPrescriptionInput($errors);
        }

        return ['idempotency_key' => strtolower($key), 'items' => $items];
    }

    private static function item(mixed $row, string $path, array &$errors): ?array
    {
        if (!is_array($row) || array_diff_key($row, [
            'medicine_id' => true, 'dose' => true, 'frequency' => true, 'quantity' => true, 'expected_unit_price' => true,
        ])) {
            $errors[$path] = 'Isi obat, dosis, frekuensi, dan jumlah.';
            return null;
        }

        $medicineId = RequestInput::id($row['medicine_id'] ?? null);
        if ($medicineId === null) {
            $errors[$path . '.medicine_id'] = 'Pilih obat dari master.';
        }

        $quantity = $row['quantity'] ?? null;
        $quantity = is_int($quantity) || is_string($quantity)
            ? filter_var($quantity, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 2147483647]])
            : false;
        if ($quantity === false) {
            $errors[$path . '.quantity'] = 'Isi jumlah dengan bilangan bulat positif.';
        }

        $price = $row['expected_unit_price'] ?? null;
        if ($price !== null && (!is_string($price) || !preg_match('/\A(?:0|[1-9][0-9]{0,11})\.[0-9]{2}\z/', $price))) {
            $errors[$path . '.expected_unit_price'] = 'Gunakan harga dari pilihan obat.';
        }

        return [
            'medicine_id' => $medicineId,
            'dose' => self::text($row['dose'] ?? null, $path . '.dose', $errors),
            'frequency' => self::text($row['frequency'] ?? null, $path . '.frequency', $errors),
            'quantity' => $quantity,
            'expected_unit_price' => $price,
        ];
    }

    private static function text(mixed $value, string $field, array &$errors): ?string
    {
        if (!is_string($value) || !mb_check_encoding($value, 'UTF-8') || str_contains($value, "\0")) {
            $errors[$field] = 'Isi dengan teks yang valid.';
            return null;
        }

        $value = trim($value);
        if ($value === '' || mb_strlen($value, 'UTF-8') > 100) {
            $errors[$field] = 'Isi antara 1 dan 100 karakter.';
        }

        return $value;
    }
}
