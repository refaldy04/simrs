<?php

declare(strict_types=1);

namespace app\controllers;

use app\models\User;
use app\security\LoginThrottle;
use app\security\RoleAccess;
use DateTimeImmutable;
use Yii;
use yii\db\Connection;
use yii\db\Expression;
use yii\db\Query;
use yii\web\BadRequestHttpException;
use yii\web\Controller;
use yii\web\ForbiddenHttpException;
use yii\web\Response;
use yii\web\TooManyRequestsHttpException;
use yii\web\UnauthorizedHttpException;
use yii\web\UnsupportedMediaTypeHttpException;

final class AuthController extends Controller
{
    private const DUMMY_PASSWORD_HASH = '$2b$12$VOTEQgX0mgDg8N6TbPX1BeDS5nD2neLPr67htLlgXNKnf7NSXdUkS';

    public function actionLogin(): array
    {
        $request = Yii::$app->getRequest();
        $contentType = strtolower(
            trim(explode(';', (string) $request->getContentType(), 2)[0])
        );
        if ($contentType !== 'application/json') {
            throw new UnsupportedMediaTypeHttpException('Kirim kredensial dalam format JSON.');
        }

        $username = $request->getBodyParam('username');
        $password = $request->getBodyParam('password');
        if (!is_string($username) || !is_string($password)) {
            throw new BadRequestHttpException('Nama pengguna dan kata sandi wajib diisi.');
        }

        $username = mb_strtolower(trim($username), 'UTF-8');
        if ($username === '' || mb_strlen($username, 'UTF-8') > 64 || str_contains($username, "\0")
            || $password === '' || strlen($password) > 1024 || str_contains($password, "\0")
        ) {
            throw new BadRequestHttpException('Periksa nama pengguna dan kata sandi.');
        }

        $retryAfter = LoginThrottle::recordAttempt($username);
        if ($retryAfter !== null) {
            Yii::$app->getResponse()->getHeaders()->set('Retry-After', (string) $retryAfter);
            throw new TooManyRequestsHttpException('Terlalu banyak percobaan masuk. Coba lagi sebentar.');
        }

        $user = User::findOne(['username' => $username, 'is_active' => true]);
        $validPassword = password_verify($password, $user?->password_hash ?? self::DUMMY_PASSWORD_HASH);
        if (!$validPassword || $user === null) {
            throw new UnauthorizedHttpException('Nama pengguna atau kata sandi salah.');
        }

        return Yii::$app->getDb()->transaction(function (Connection $db) use ($user, $username): array {
            $db->createCommand()->delete('auth_tokens', [
                '<=', 'expires_at', new Expression('CURRENT_TIMESTAMP'),
            ])->execute();

            $token = bin2hex(random_bytes(32));
            $expiresAt = $db->createCommand(<<<'SQL'
                INSERT INTO auth_tokens (user_id, token_hash)
                VALUES (:user_id, :token_hash)
                RETURNING expires_at
                SQL, [
                    ':user_id' => $user->getId(),
                    ':token_hash' => hash('sha256', $token),
                ])->queryScalar();

            LoginThrottle::clearAfterLogin($username);

            return $this->profile($user) + [
                'access_token' => $token,
                'token_type' => 'Bearer',
                'expires_at' => (new DateTimeImmutable($expiresAt))->format(DATE_ATOM),
            ];
        });
    }

    public function actionMe(): array
    {
        /** @var User $user */
        $user = Yii::$app->getUser()->getIdentity();

        return $this->profile($user);
    }

    public function actionAccess(?string $permission = null): array
    {
        if ($permission === null || $permission === '') {
            throw new BadRequestHttpException('Parameter permission wajib diisi.');
        }

        if (!Yii::$app->getUser()->can($permission)) {
            throw new ForbiddenHttpException('Akses ditolak untuk peran akun ini.');
        }

        return ['permission' => $permission, 'allowed' => true];
    }

    public function actionLogout(): Response
    {
        /** @var User $user */
        $user = Yii::$app->getUser()->getIdentity();
        $user->revokeAccessToken();

        return Yii::$app->getResponse()->setStatusCode(204);
    }

    private function profile(User $user): array
    {
        $roleName = (new Query())->select('name')->from('roles')->where(['code' => $user->role_code])->scalar();

        return [
            'user' => [
                'id' => $user->getId(),
                'username' => $user->username,
                'full_name' => $user->full_name,
                'role_code' => $user->role_code,
                'role_name' => $roleName,
            ],
            'permissions' => RoleAccess::permissionsFor($user->role_code),
        ];
    }
}
