<?php

declare(strict_types=1);

namespace app\controllers;

use app\http\RequestInput;
use app\prescription\InvalidPrescriptionInput;
use app\prescription\PrescriptionData;
use app\prescription\PrescriptionInput;
use Yii;
use yii\web\BadRequestHttpException;
use yii\web\Controller;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

final class PrescriptionController extends Controller
{
    public function actionVisit(string $id): array
    {
        $actor = $this->actor('prescriptions.create');

        return $this->data()->forVisit($this->id($id, 'Kunjungan tidak ditemukan.'), $actor);
    }

    public function actionHistory(string $id): array
    {
        $actor = $this->actor('prescriptions.create');
        [$page, $pageSize] = RequestInput::pagination(Yii::$app->getRequest());

        return $this->data()->history($this->id($id, 'Kunjungan tidak ditemukan.'), $actor, $page, $pageSize);
    }

    public function actionCreate(string $id): array
    {
        $actor = $this->actor('prescriptions.create');
        $visitId = $this->id($id, 'Kunjungan tidak ditemukan.');
        try {
            $input = PrescriptionInput::parse(RequestInput::jsonObject(Yii::$app->getRequest()));
            $result = $this->data()->create($visitId, $actor, $input);
        } catch (InvalidPrescriptionInput $exception) {
            Yii::$app->getResponse()->setStatusCode(422);

            return [
                'name' => 'Unprocessable Entity',
                'message' => $exception->getMessage(),
                'status' => 422,
                'code' => 0,
                'errors' => $exception->errors,
            ];
        }

        Yii::$app->getResponse()->setStatusCode($result['replayed'] ? 200 : 201);

        return $result;
    }

    public function actionCancel(string $id, string $prescriptionId): array
    {
        $actor = $this->actor('prescriptions.create');
        $visitId = $this->id($id, 'Kunjungan tidak ditemukan.');

        return $this->data()->cancel($visitId, $this->id($prescriptionId, 'Resep tidak ditemukan.'), $actor);
    }

    public function actionPharmacy(): array
    {
        $this->actor('prescriptions.dispense');
        $request = Yii::$app->getRequest();
        $status = $request->get('status', 'pending');
        if (!in_array($status, ['all', 'pending', 'dispensed', 'cancelled'], true)) {
            throw new BadRequestHttpException('Status resep tidak valid.');
        }
        [$page, $pageSize] = RequestInput::pagination($request);

        return $this->data()->pharmacy(RequestInput::searchTerm($request), $status, $page, $pageSize);
    }

    public function actionDispense(string $id): array
    {
        $actor = $this->actor('prescriptions.dispense');

        return $this->data()->dispense($this->id($id, 'Resep tidak ditemukan.'), $actor);
    }

    private function actor(string $permission): string
    {
        $user = Yii::$app->getUser();
        if (!$user->can($permission)) {
            throw new ForbiddenHttpException('Akses resep atau penyerahan obat ditolak untuk peran ini.');
        }

        return (string) $user->getId();
    }

    private function id(string $value, string $message): string
    {
        return RequestInput::id($value) ?? throw new NotFoundHttpException($message);
    }

    private function data(): PrescriptionData
    {
        return new PrescriptionData(Yii::$app->getDb());
    }
}
