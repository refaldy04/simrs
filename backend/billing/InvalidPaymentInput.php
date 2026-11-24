<?php

declare(strict_types=1);

namespace app\billing;

use RuntimeException;

final class InvalidPaymentInput extends RuntimeException
{
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Periksa isian pembayaran.');
    }
}
