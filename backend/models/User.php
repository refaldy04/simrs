<?php

declare(strict_types=1);

namespace app\models;

use yii\db\ActiveRecord;
use yii\db\Expression;
use yii\web\IdentityInterface;

/**
 * @property int|string $id
 * @property string $username
 * @property string $full_name
 * @property string $role_code
 * @property string $password_hash
 * @property bool $is_active
 */
final class User extends ActiveRecord implements IdentityInterface
{
    private ?string $accessTokenHash = null;

    public static function tableName(): string
    {
        return 'users';
    }

    public static function findIdentity($id): ?self
    {
        return self::findOne(['id' => $id, 'is_active' => true]);
    }

    public static function findIdentityByAccessToken($token, $type = null): ?self
    {
        if (!is_string($token) || strlen($token) !== 64) {
            return null;
        }

        $hash = hash('sha256', $token);
        $account = self::find()
            ->alias('account')
            ->select('account.*')
            ->innerJoin('auth_tokens AS token', 'token.user_id = account.id')
            ->where(['token.token_hash' => $hash, 'account.is_active' => true])
            ->andWhere(['>', 'token.expires_at', new Expression('CURRENT_TIMESTAMP')])
            ->one();

        if ($account !== null) {
            $account->accessTokenHash = $hash;
        }

        return $account;
    }

    public function getId(): string
    {
        return (string) $this->id;
    }

    public function getAuthKey(): ?string
    {
        return null;
    }

    public function validateAuthKey($authKey): bool
    {
        return false;
    }

    public function fields(): array
    {
        return ['id', 'username', 'full_name', 'role_code', 'is_active'];
    }

    public function revokeAccessToken(): void
    {
        if ($this->accessTokenHash !== null) {
            self::getDb()->createCommand()
                ->delete('auth_tokens', ['token_hash' => $this->accessTokenHash])
                ->execute();
        }
    }
}
