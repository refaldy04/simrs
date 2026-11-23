<?php

declare(strict_types=1);

use yii\db\Migration;

final class m261123_000004_create_auth_tables extends Migration
{
    public function safeUp(): void
    {
        $this->execute(<<<'SQL'
            CREATE TABLE auth_tokens (
                token_hash VARCHAR(64) PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '8 hours'),
                CHECK (expires_at > created_at)
            )
            SQL);
        $this->createIndex('auth_tokens_user_idx', 'auth_tokens', 'user_id');
        $this->createIndex('auth_tokens_expiry_idx', 'auth_tokens', 'expires_at');

        $this->execute(<<<'SQL'
            CREATE TABLE auth_login_attempts (
                subject_hash VARCHAR(64) PRIMARY KEY,
                window_started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                attempt_count SMALLINT NOT NULL CHECK (attempt_count > 0)
            )
            SQL);
        $this->createIndex('auth_login_attempts_window_idx', 'auth_login_attempts', 'window_started_at');
    }

    public function safeDown(): void
    {
        $this->dropTable('auth_login_attempts');
        $this->dropTable('auth_tokens');
    }
}
