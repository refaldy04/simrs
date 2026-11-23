<?php

declare(strict_types=1);

namespace app\controllers;

use Yii;
use yii\db\Exception;
use yii\web\Controller;

final class HealthController extends Controller
{
    public function actionIndex(): array
    {
        try {
            Yii::$app->getDb()->createCommand('SELECT 1')->queryScalar();
        } catch (Exception $exception) {
            Yii::warning('PostgreSQL health check failed: ' . $exception->getMessage(), __METHOD__);
            Yii::$app->getResponse()->setStatusCode(503);

            return ['status' => 'unavailable', 'database' => 'unavailable'];
        }

        return ['status' => 'ok', 'database' => 'ok'];
    }
}
