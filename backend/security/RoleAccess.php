<?php

declare(strict_types=1);

namespace app\security;

use app\models\User;
use yii\rbac\CheckAccessInterface;

final class RoleAccess implements CheckAccessInterface
{
    private const PERMISSIONS = [
        'admin' => [
            'master.manage',
            'users.manage',
            'dashboard.read',
            'audit.read',
        ],
        'registration' => [
            'patients.manage',
            'visits.register',
            'visits.queue',
        ],
        'doctor' => [
            'visits.queue',
            'examinations.manage',
            'procedures.manage',
            'prescriptions.create',
            'lab.request',
            'lab.results.read',
        ],
        'pharmacy' => ['prescriptions.dispense'],
        'laboratory' => ['lab.requests.read', 'lab.results.read', 'lab.results.write'],
        'cashier' => ['billing.manage'],
    ];

    public static function permissionsFor(string $roleCode): array
    {
        return self::PERMISSIONS[$roleCode] ?? [];
    }

    public function checkAccess($userId, $permissionName, $params = []): bool
    {
        $account = User::findIdentity($userId);

        return $account !== null && in_array($permissionName, self::permissionsFor($account->role_code), true);
    }
}
