<?php

declare(strict_types=1);

namespace app\http;

use yii\web\BadRequestHttpException;
use yii\web\Request;
use yii\web\UnsupportedMediaTypeHttpException;

final class RequestInput
{
    public static function id(mixed $value): ?string
    {
        if (!is_int($value) && !is_string($value)) {
            return null;
        }

        $id = (string) $value;
        if (!preg_match('/\A[1-9][0-9]{0,18}\z/', $id)
            || (strlen($id) === 19 && strcmp($id, '9223372036854775807') > 0)
        ) {
            return null;
        }

        return $id;
    }

    public static function date(mixed $value): ?string
    {
        if (!is_string($value) || !preg_match('/\A([0-9]{4})-([0-9]{2})-([0-9]{2})\z/', $value, $parts)) {
            return null;
        }

        return checkdate((int) $parts[2], (int) $parts[3], (int) $parts[1]) ? $value : null;
    }

    public static function jsonObject(Request $request): array
    {
        $contentType = strtolower(trim(explode(';', (string) $request->getContentType(), 2)[0]));
        if ($contentType !== 'application/json') {
            throw new UnsupportedMediaTypeHttpException('Kirim data dalam format JSON.');
        }
        if (!str_starts_with(ltrim($request->getRawBody()), '{')) {
            throw new BadRequestHttpException('Body permintaan harus berupa objek JSON.');
        }

        return $request->getBodyParams();
    }

    public static function searchTerm(Request $request): string
    {
        $term = $request->get('q', '');
        if (!is_string($term) || !mb_check_encoding($term, 'UTF-8') || mb_strlen($term) > 150 || str_contains($term, "\0")) {
            throw new BadRequestHttpException('Kata kunci pencarian tidak valid.');
        }

        return trim($term);
    }

    public static function pagination(Request $request): array
    {
        $page = filter_var($request->get('page', 1), FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => intdiv(PHP_INT_MAX, 100)],
        ]);
        $pageSize = filter_var($request->get('page_size', 20), FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => 100],
        ]);
        if ($page === false || $pageSize === false) {
            throw new BadRequestHttpException('Parameter halaman tidak valid.');
        }

        return [$page, $pageSize];
    }
}
