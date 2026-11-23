<?php

declare(strict_types=1);

use yii\console\controllers\MigrateController;

return [
    'id' => 'simrs-console',
    'basePath' => dirname(__DIR__),
    'aliases' => ['@database' => dirname(__DIR__, 2) . '/database'],
    'components' => [
        'db' => require __DIR__ . '/db.php',
    ],
    'controllerMap' => [
        'migrate' => [
            'class' => MigrateController::class,
            'migrationPath' => '@database/migrations',
        ],
    ],
];
