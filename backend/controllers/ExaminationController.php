<?php

declare(strict_types=1);

namespace app\controllers;

use app\examination\ExaminationData;
use app\examination\ExaminationInput;
use app\examination\InvalidExaminationInput;
use app\http\RequestInput;
use Yii;
use yii\web\Controller;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

final class ExaminationController extends Controller
{
    public function actionView(string $id): array
    {
        $userId = $this->doctorUserId();

        return $this->data()->view($this->visitId($id), $userId);
    }

    public function actionHistory(string $id): array
    {
        $userId = $this->doctorUserId();
        [$page, $pageSize] = RequestInput::pagination(Yii::$app->getRequest());

        return $this->data()->history($this->visitId($id), $userId, $page, $pageSize);
    }

    public function actionSave(string $id): array
    {
        $userId = $this->doctorUserId();
        $visitId = $this->visitId($id);
        try {
            $input = ExaminationInput::parse(RequestInput::jsonObject(Yii::$app->getRequest()));

            return $this->data()->save($visitId, $userId, $input);
        } catch (InvalidExaminationInput $exception) {
            Yii::$app->getResponse()->setStatusCode(422);

            return [
                'name' => 'Unprocessable Entity',
                'message' => $exception->getMessage(),
                'code' => 0,
                'status' => 422,
                'errors' => $exception->errors,
            ];
        }
    }

    private function doctorUserId(): string
    {
        $user = Yii::$app->getUser();
        if (!$user->can('examinations.manage')) {
            throw new ForbiddenHttpException('Akses pemeriksaan dan rekam medis ditolak untuk peran ini.');
        }

        return (string) $user->getId();
    }

    private function visitId(string $value): string
    {
        return RequestInput::id($value) ?? throw new NotFoundHttpException('Kunjungan tidak ditemukan.');
    }

    private function data(): ExaminationData
    {
        return new ExaminationData(Yii::$app->getDb());
    }
}
