<?php

declare(strict_types=1);

namespace app\controllers;

use app\http\RequestInput;
use app\procedure\InvalidProcedureInput;
use app\procedure\ProcedureData;
use app\procedure\ProcedureInput;
use Yii;
use yii\web\Controller;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

final class ProcedureController extends Controller
{
    public function actionView(string $id): array
    {
        $userId = $this->doctorUserId();

        return $this->data()->view($this->visitId($id), $userId);
    }

    public function actionAdd(string $id): array
    {
        $userId = $this->doctorUserId();
        $visitId = $this->visitId($id);

        return $this->write(function () use ($visitId, $userId): array {
            $input = ProcedureInput::addition(RequestInput::jsonObject(Yii::$app->getRequest()));

            return $this->data()->add($visitId, $userId, $input);
        }, 201);
    }

    public function actionUpdate(string $id, string $itemId): array
    {
        return $this->change($id, $itemId, cancel: false);
    }

    public function actionCancel(string $id, string $itemId): array
    {
        return $this->change($id, $itemId, cancel: true);
    }

    private function change(string $id, string $itemId, bool $cancel): array
    {
        $userId = $this->doctorUserId();
        $visitId = $this->visitId($id);
        $itemId = RequestInput::id($itemId) ?? throw new NotFoundHttpException('Tindakan kunjungan tidak ditemukan.');

        return $this->write(function () use ($visitId, $itemId, $userId, $cancel): array {
            $input = ProcedureInput::change(RequestInput::jsonObject(Yii::$app->getRequest()), $cancel);

            return $this->data()->change($visitId, $itemId, $userId, $input);
        });
    }

    private function write(callable $save, int $successStatus = 200): array
    {
        try {
            $result = $save();
        } catch (InvalidProcedureInput $exception) {
            Yii::$app->getResponse()->setStatusCode(422);

            return [
                'name' => 'Unprocessable Entity',
                'message' => $exception->getMessage(),
                'status' => 422,
                'code' => 0,
                'errors' => $exception->errors,
            ];
        }

        Yii::$app->getResponse()->setStatusCode($successStatus);

        return $result;
    }

    private function doctorUserId(): string
    {
        $user = Yii::$app->getUser();
        if (!$user->can('procedures.manage')) {
            throw new ForbiddenHttpException('Akses tindakan medis ditolak untuk peran ini.');
        }

        return (string) $user->getId();
    }

    private function visitId(string $id): string
    {
        return RequestInput::id($id) ?? throw new NotFoundHttpException('Kunjungan tidak ditemukan.');
    }

    private function data(): ProcedureData
    {
        return new ProcedureData(Yii::$app->getDb());
    }
}
