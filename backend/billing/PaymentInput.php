<?php

declare(strict_types=1);

namespace app\billing;

use app\http\RequestInput;

final class PaymentInput
{
    public static function parse(array $body): array
    {
        $errors = [];
        if (array_diff_key($body, [
            'idempotency_key' => true, 'amount' => true, 'method' => true, 'external_reference' => true,
        ])) {
            $errors['body'] = 'Ada field yang tidak dikenal.';
        }

        $key = RequestInput::uuid($body['idempotency_key'] ?? null);
        if ($key === null) {
            $errors['idempotency_key'] = 'Kirim idempotency_key dalam format UUID.';
        }

        $amount = self::amount($body['amount'] ?? null);
        if ($amount === null) {
            $errors['amount'] = 'Isi nominal positif dengan maksimal 12 digit sebelum desimal dan dua digit desimal.';
        }

        $method = $body['method'] ?? null;
        if (!in_array($method, ['cash', 'non_cash'], true)) {
            $errors['method'] = 'Pilih pembayaran tunai atau non-tunai.';
        }

        $reference = $body['external_reference'] ?? null;
        if ($reference !== null) {
            if (!is_string($reference) || !mb_check_encoding($reference, 'UTF-8') || str_contains($reference, "\0")) {
                $errors['external_reference'] = 'Isi referensi dengan teks yang valid.';
            } else {
                $reference = trim($reference);
                if (mb_strlen($reference, 'UTF-8') > 100) {
                    $errors['external_reference'] = 'Referensi maksimal 100 karakter.';
                }
                $reference = $reference === '' ? null : $reference;
            }
        }

        if ($errors !== []) {
            throw new InvalidPaymentInput($errors);
        }

        return ['idempotency_key' => $key, 'amount' => $amount, 'method' => $method, 'external_reference' => $reference];
    }

    private static function amount(mixed $value): ?string
    {
        if ((!is_int($value) && !is_string($value))
            || !preg_match('/\A(0|[1-9][0-9]{0,11})(?:\.([0-9]{1,2}))?\z/', trim((string) $value), $parts)
        ) {
            return null;
        }

        $amount = $parts[1] . '.' . str_pad($parts[2] ?? '', 2, '0');

        return $amount === '0.00' ? null : $amount;
    }
}
