<?php

declare(strict_types=1);

use yii\web\Application;

ini_set('zend.exception_ignore_args', '1');

require dirname(__DIR__) . '/vendor/autoload.php';
require dirname(__DIR__) . '/vendor/yiisoft/yii2/Yii.php';

$config = require dirname(__DIR__) . '/config/web.php';
(new Application($config))->run();
