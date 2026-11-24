<?php

declare(strict_types=1);

namespace app\controllers;

use app\http\RequestInput;
use app\registration\RegistrationData;
use DateTimeImmutable;
use DateTimeZone;
use Yii;
use yii\db\IntegrityException;
use yii\web\BadRequestHttpException;
use yii\web\ConflictHttpException;
use yii\web\Controller;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;
use yii\web\UnprocessableEntityHttpException;

final class RegistrationController extends Controller
{
    public function actionPatients(): array
    {
        $this->requirePermission('visits.register');
        $request = Yii::$app->getRequest();
        $term = RequestInput::searchTerm($request);
        if ($term === '') {
            throw new BadRequestHttpException('Masukkan nomor rekam medis, nomor identitas, atau nama pasien.');
        }
        [$page, $pageSize] = RequestInput::pagination($request);

        return $this->data()->patients($term, $page, $pageSize);
    }

    public function actionHistory(string $id): array
    {
        $this->requirePermission('visits.register');
        $patientId = RequestInput::id($id) ?? throw new NotFoundHttpException('Pasien tidak ditemukan.');
        [$page, $pageSize] = RequestInput::pagination(Yii::$app->getRequest());

        return $this->data()->history($patientId, $page, $pageSize);
    }

    public function actionSchedules(): array
    {
        $doctorUserId = $this->queueDoctorUserId();

        return $this->data()->schedules($this->date(), $doctorUserId);
    }

    public function actionQueue(): array
    {
        $doctorUserId = $this->queueDoctorUserId();
        $request = Yii::$app->getRequest();
        $clinic = $request->get('clinic_id');
        $clinicId = RequestInput::id($clinic);
        $status = $request->get('status', 'all');
        if (($clinic !== null && $clinicId === null)
            || ($status !== 'all' && !in_array($status, RegistrationData::STATUSES, true))
        ) {
            throw new BadRequestHttpException('Filter poli atau status antrean tidak valid.');
        }
        [$page, $pageSize] = RequestInput::pagination($request);

        return $this->data()->queue($this->date(), $clinicId, $status, $doctorUserId, $page, $pageSize);
    }

    public function actionRegister(): array
    {
        $userId = $this->requirePermission('visits.register');
        $body = RequestInput::jsonObject(Yii::$app->getRequest());
        $patientId = RequestInput::id($body['patient_id'] ?? null);
        $scheduleId = RequestInput::id($body['schedule_id'] ?? null);
        if ($patientId === null || $scheduleId === null || array_diff_key($body, ['patient_id' => true, 'schedule_id' => true])) {
            throw new UnprocessableEntityHttpException('Kirim patient_id dan schedule_id yang valid.');
        }

        try {
            $visit = $this->data()->register($patientId, $scheduleId, $userId);
        } catch (IntegrityException $exception) {
            if (in_array($exception->errorInfo[0] ?? null, ['23505', '23503'], true)) {
                throw new ConflictHttpException('Data antrean berubah. Muat ulang jadwal dan antrean.');
            }
            throw $exception;
        }

        Yii::$app->getResponse()->setStatusCode(201);

        return $visit;
    }

    public function actionCancel(string $id): array
    {
        $userId = $this->requirePermission('visits.register');
        $visitId = RequestInput::id($id) ?? throw new NotFoundHttpException('Kunjungan tidak ditemukan.');

        return $this->data()->cancel($visitId, $userId);
    }

    private function requirePermission(string $permission): string
    {
        $user = Yii::$app->getUser();
        if (!$user->can($permission)) {
            throw new ForbiddenHttpException('Akses pendaftaran atau antrean ditolak untuk peran ini.');
        }

        return (string) $user->getId();
    }

    private function queueDoctorUserId(): ?string
    {
        $userId = $this->requirePermission('visits.queue');

        return Yii::$app->getUser()->can('visits.register') ? null : $userId;
    }

    private function date(): string
    {
        $today = (new DateTimeImmutable('today', new DateTimeZone('Asia/Jakarta')))->format('Y-m-d');
        $value = Yii::$app->getRequest()->get('date', $today);

        return RequestInput::date($value) ?? throw new BadRequestHttpException('Tanggal harus valid dengan format YYYY-MM-DD.');
    }

    private function data(): RegistrationData
    {
        return new RegistrationData(Yii::$app->getDb());
    }
}
