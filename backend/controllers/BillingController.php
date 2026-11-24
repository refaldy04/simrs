<?php

declare(strict_types=1);

namespace app\controllers;

use app\billing\BillingData;
use app\billing\InvalidPaymentInput;
use app\billing\PaymentInput;
use app\http\RequestInput;
use Yii;
use yii\web\BadRequestHttpException;
use yii\web\Controller;
use yii\web\ForbiddenHttpException;
use yii\web\NotFoundHttpException;

final class BillingController extends Controller
{
    public function actionQueue(): array
    {
        $this->cashier();
        $request = Yii::$app->getRequest();
        $status = $request->get('status', 'all');
        if (!in_array($status, ['all', 'unissued', 'unpaid', 'partial', 'paid'], true)) {
            throw new BadRequestHttpException('Status tagihan tidak valid.');
        }
        [$page, $pageSize] = RequestInput::pagination($request);

        return $this->data()->queue(RequestInput::searchTerm($request), $status, $page, $pageSize);
    }

    public function actionView(string $id): array
    {
        $this->cashier();

        return $this->data()->view($this->id($id, 'Kunjungan tagihan tidak ditemukan.'));
    }

    public function actionHistory(string $id): array
    {
        $this->cashier();
        [$page, $pageSize] = RequestInput::pagination(Yii::$app->getRequest());

        return $this->data()->history($this->id($id, 'Kunjungan tagihan tidak ditemukan.'), $page, $pageSize);
    }

    public function actionIssue(string $id): array
    {
        $actor = $this->cashier();
        $result = $this->data()->issue($this->id($id, 'Kunjungan tagihan tidak ditemukan.'), $actor);

        return $this->created($result);
    }

    public function actionPay(string $id): array
    {
        $actor = $this->cashier();
        $invoiceId = $this->id($id, 'Tagihan tidak ditemukan.');
        try {
            $input = PaymentInput::parse(RequestInput::jsonObject(Yii::$app->getRequest()));
            $result = $this->data()->pay($invoiceId, $actor, $input);
        } catch (InvalidPaymentInput $exception) {
            Yii::$app->getResponse()->setStatusCode(422);

            return [
                'name' => 'Unprocessable Entity',
                'message' => $exception->getMessage(),
                'status' => 422,
                'code' => 0,
                'errors' => $exception->errors,
            ];
        }

        return $this->created($result);
    }

    private function cashier(): string
    {
        $user = Yii::$app->getUser();
        if (!$user->can('billing.manage')) {
            throw new ForbiddenHttpException('Akses tagihan dan pembayaran ditolak untuk peran ini.');
        }

        return (string) $user->getId();
    }

    private function id(string $value, string $message): string
    {
        return RequestInput::id($value) ?? throw new NotFoundHttpException($message);
    }

    private function data(): BillingData
    {
        return new BillingData(Yii::$app->getDb());
    }

    private function created(array $result): array
    {
        Yii::$app->getResponse()->setStatusCode($result['replayed'] ? 200 : 201);

        return $result;
    }
}
