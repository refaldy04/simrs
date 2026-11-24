<?php

declare(strict_types=1);

namespace app\examination;

use RuntimeException;

final class InvalidExaminationInput extends RuntimeException
{
    public function __construct(public readonly array $errors)
    {
        parent::__construct('Periksa isian pemeriksaan.');
    }
}
