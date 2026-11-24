<?php

declare(strict_types=1);

namespace app\procedure;

use RuntimeException;

final class InvalidProcedureInput extends RuntimeException
{
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Periksa isian tindakan.');
    }
}
