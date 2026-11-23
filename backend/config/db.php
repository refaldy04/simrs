<?php

declare(strict_types=1);

use yii\db\Connection;

$host = getenv('DB_HOST');
$port = getenv('DB_PORT');
$database = getenv('DB_NAME');

return [
    'class' => Connection::class,
    'dsn' => "pgsql:host={$host};port={$port};dbname={$database}",
    'username' => (string) getenv('DB_USER'),
    'password' => (string) getenv('DB_PASSWORD'),
    'charset' => 'utf8',
];
