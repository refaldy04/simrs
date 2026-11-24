<?php

declare(strict_types=1);

namespace app\master;

use RuntimeException;

final class InvalidMasterData extends RuntimeException
{
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Periksa isian data.');
    }
}
