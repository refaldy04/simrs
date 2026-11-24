<?php

declare(strict_types=1);

namespace app\controllers;

use app\http\RequestInput;
use app\laboratory\InvalidLabInput;
use app\laboratory\LabData;
use app\laboratory\LabInput;
use Yii;
use yii\web\Controller;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

final class LabController extends Controller
{
    public function actionVisit(string $id): array
    {
        $actor = $this->actor('lab.results.read');

        return $this->data()->viewVisit($this->id($id, 'Kunjungan tidak ditemukan.'), $actor);
    }

    public function actionHistory(string $id): array
    {
        $actor = $this->actor('lab.results.read');
        [$page, $pageSize] = RequestInput::pagination(Yii::$app->getRequest());

        return $this->data()->history($this->id($id, 'Kunjungan tidak ditemukan.'), $actor, $page, $pageSize);
    }

    public function actionCreate(string $id): array
    {
        $actor = $this->actor('lab.request');
        $visitId = $this->id($id, 'Kunjungan tidak ditemukan.');

        return $this->write(function (array $body) use ($visitId, $actor): array {
            $result = $this->data()->create($visitId, $actor, LabInput::request($body));
            Yii::$app->getResponse()->setStatusCode($result['replayed'] ? 200 : 201);

            return $result;
        });
    }

    public function actionOrder(string $id): array
    {
        $this->actor('lab.requests.read');

        return $this->data()->order($this->id($id, 'Permintaan laboratorium tidak ditemukan.'));
    }

    public function actionComplete(string $id): array
    {
        $actor = $this->actor('lab.results.write');
        $orderId = $this->id($id, 'Permintaan laboratorium tidak ditemukan.');

        return $this->write(fn (array $body): array => $this->data()->complete($orderId, $actor, LabInput::results($body)));
    }

    private function write(callable $operation): array
    {
        try {
            return $operation(RequestInput::jsonObject(Yii::$app->getRequest()));
        } catch (InvalidLabInput $exception) {
            Yii::$app->getResponse()->setStatusCode(422);

            return [
                'name' => 'Unprocessable Entity',
                'message' => $exception->getMessage(),
                'status' => 422,
                'code' => 0,
                'errors' => $exception->errors,
            ];
        }
    }

    private function actor(string $permission): string
    {
        $user = Yii::$app->getUser();
        if (!$user->can($permission)) {
            throw new ForbiddenHttpException('Akses laboratorium ditolak untuk peran ini.');
        }

        return (string) $user->getId();
    }

    private function id(string $value, string $message): string
    {
        return RequestInput::id($value) ?? throw new NotFoundHttpException($message);
    }

    private function data(): LabData
    {
        return new LabData(Yii::$app->getDb());
    }
}
