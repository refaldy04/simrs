<?php

declare(strict_types=1);

namespace app\laboratory;

use InvalidArgumentException;

final class InvalidLabInput extends InvalidArgumentException
{
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Periksa isian pemeriksaan laboratorium.');
    }
}
