<?php

declare(strict_types=1);

use app\models\User;
use app\security\RoleAccess;
use yii\filters\auth\HttpBearerAuth;
use yii\log\FileTarget;
use yii\web\JsonParser;
use yii\web\Response;

return [
    'id' => 'simrs-backend',
    'basePath' => dirname(__DIR__),
    'bootstrap' => ['log'],
    'as authenticator' => [
        'class' => HttpBearerAuth::class,
        'except' => ['health/index', 'auth/login'],
        'pattern' => '/^Bearer\s+([a-f0-9]{64})$/i',
    ],
    'components' => [
        'db' => require __DIR__ . '/db.php',
        'log' => [
            'targets' => [
                [
                    'class' => FileTarget::class,
                    'levels' => ['error', 'warning'],
                    'logVars' => [],
                ],
            ],
        ],
        'request' => [
            'cookieValidationKey' => (string) getenv('YII_COOKIE_VALIDATION_KEY'),
            'enableCsrfValidation' => false,
            'parsers' => ['application/json' => JsonParser::class],
        ],
        'response' => [
            'format' => Response::FORMAT_JSON,
            'on beforeSend' => static function ($event): void {
                $event->sender->getHeaders()->set('Cache-Control', 'no-store');
            },
        ],
        'user' => [
            'identityClass' => User::class,
            'enableSession' => false,
            'loginUrl' => null,
            'accessChecker' => ['class' => RoleAccess::class],
        ],
        'urlManager' => [
            'enablePrettyUrl' => true,
            'showScriptName' => false,
            'enableStrictParsing' => true,
            'rules' => [
                'GET health' => 'health/index',
                'POST auth/login' => 'auth/login',
                'GET auth/me' => 'auth/me',
                'GET auth/access' => 'auth/access',
                'POST auth/logout' => 'auth/logout',
                'GET master-data' => 'master-data/catalog',
                'GET master-data/<resource:[a-z-]+>/options' => 'master-data/options',
                'GET master-data/<resource:[a-z-]+>/<id:\d+>' => 'master-data/view',
                'PATCH master-data/<resource:[a-z-]+>/<id:\d+>' => 'master-data/update',
                'DELETE master-data/<resource:[a-z-]+>/<id:\d+>' => 'master-data/archive',
                'GET master-data/<resource:[a-z-]+>' => 'master-data/index',
                'POST master-data/<resource:[a-z-]+>' => 'master-data/create',
                'GET registration/patients' => 'registration/patients',
                'GET registration/patients/<id:\d+>/visits' => 'registration/history',
                'GET registration/schedules' => 'registration/schedules',
                'POST registration/visits/<id:\d+>/cancel' => 'registration/cancel',
                'GET registration/visits' => 'registration/queue',
                'POST registration/visits' => 'registration/register',
                'GET examinations/visits/<id:\d+>/history' => 'examination/history',
                'GET examinations/visits/<id:\d+>' => 'examination/view',
                'PUT examinations/visits/<id:\d+>' => 'examination/save',
            ],
        ],
    ],
];
