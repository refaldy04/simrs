<?php

declare(strict_types=1);

namespace app\security;

use Yii;
use yii\db\Expression;

final class LoginThrottle
{
    private const MAX_ATTEMPTS = 10;

    public static function recordAttempt(string $username): ?int
    {
        $attempt = Yii::$app->getDb()->createCommand(<<<'SQL'
            INSERT INTO auth_login_attempts AS counter (subject_hash, attempt_count)
            VALUES (:subject, 1)
            ON CONFLICT (subject_hash) DO UPDATE
            SET attempt_count = CASE
                    WHEN counter.window_started_at <= CURRENT_TIMESTAMP - INTERVAL '1 minute' THEN 1
                    ELSE LEAST(counter.attempt_count + 1, :max_count)
                END,
                window_started_at = CASE
                    WHEN counter.window_started_at <= CURRENT_TIMESTAMP - INTERVAL '1 minute' THEN CURRENT_TIMESTAMP
                    ELSE counter.window_started_at
                END
            RETURNING attempt_count, GREATEST(1, CEIL(EXTRACT(EPOCH FROM
                (window_started_at + INTERVAL '1 minute' - CURRENT_TIMESTAMP)))) AS retry_after
            SQL, [
                ':subject' => hash('sha256', $username),
                ':max_count' => self::MAX_ATTEMPTS + 1,
            ])->queryOne();

        return (int) $attempt['attempt_count'] > self::MAX_ATTEMPTS ? (int) $attempt['retry_after'] : null;
    }

    public static function clearAfterLogin(string $username): void
    {
        Yii::$app->getDb()->createCommand()->delete('auth_login_attempts', [
            'or',
            ['subject_hash' => hash('sha256', $username)],
            ['<', 'window_started_at', new Expression("CURRENT_TIMESTAMP - INTERVAL '1 day'")],
        ])->execute();
    }
}
