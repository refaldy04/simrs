<?php

declare(strict_types=1);

use yii\log\FileTarget;
use yii\web\JsonParser;
use yii\web\Response;

return [
    'id' => 'simrs-backend',
    'basePath' => dirname(__DIR__),
    'bootstrap' => ['log'],
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
            'parsers' => ['application/json' => JsonParser::class],
        ],
        'response' => ['format' => Response::FORMAT_JSON],
        'urlManager' => [
            'enablePrettyUrl' => true,
            'showScriptName' => false,
            'enableStrictParsing' => true,
            'rules' => ['GET health' => 'health/index'],
        ],
    ],
];
