<?php

declare(strict_types=1);

namespace app\prescription;

use RuntimeException;

final class InvalidPrescriptionInput extends RuntimeException
{
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Periksa isian resep.');
    }
}
