<?php

declare(strict_types=1);

namespace app\billing;

use DateTimeImmutable;
use yii\db\Connection;
use yii\db\Query;
use yii\web\NotFoundHttpException;

final class BillingRecords
{
    public function __construct(private readonly Connection $db)
    {
    }

    public function queue(string $term, string $status, int $page, int $pageSize): array
    {
        $query = $this->visitQuery()
            ->addSelect(['invoice.invoice_no', 'balance.total_amount', 'balance.balance_amount', 'billing_status' => 'balance.status'])
            ->leftJoin(['balance' => 'invoice_balances'], 'balance.invoice_id = invoice.id');

        if ($status === 'unissued') {
            $query->andWhere(['invoice.id' => null]);
        } elseif ($status !== 'all') {
            $query->andWhere(['balance.status' => $status]);
        }
        if ($term !== '') {
            $query->andWhere([
                'or', ['ilike', 'patient.full_name', $term], ['ilike', 'patient.medical_record_no', $term],
                ['ilike', 'invoice.invoice_no', $term],
            ]);
        }
        $query->orderBy(['visit.visit_date' => SORT_DESC, 'visit.id' => SORT_DESC]);

        return $this->page($query, $page, $pageSize, function (array $row): array {
            $row = $this->serializeVisit($row);
            foreach (['total_amount', 'balance_amount'] as $field) {
                if ($row[$field] !== null) {
                    $row[$field] = (string) $row[$field];
                }
            }
            $row['billing_status'] ??= 'unissued';

            return $row;
        });
    }

    public function visit(string $id): array
    {
        $row = $this->visitQuery()->andWhere(['visit.id' => $id])->one($this->db);
        if ($row === false) {
            throw new NotFoundHttpException('Kunjungan tagihan tidak ditemukan.');
        }

        return $this->serializeVisit($row);
    }

    public function history(string $patientId, int $page, int $pageSize): array
    {
        $query = $this->paymentQuery()->where(['visit.patient_id' => $patientId])
            ->orderBy(['payment.paid_at' => SORT_DESC, 'payment.id' => SORT_DESC]);

        return $this->page($query, $page, $pageSize, $this->serializePayment(...));
    }

    public function paymentByKey(string $key): ?array
    {
        $row = $this->paymentQuery()->where(['payment.idempotency_key' => $key])->one($this->db);

        return $row === false ? null : $this->serializePayment($row);
    }

    public function payment(string $id): array
    {
        $row = $this->paymentQuery()->where(['payment.id' => $id])->one($this->db);

        return $this->serializePayment($row);
    }

    private function visitQuery(): Query
    {
        return (new Query())->select([
            'visit.id', 'visit.patient_id', 'visit.visit_date', 'visit.status', 'visit.registration_fee',
            'patient.medical_record_no', 'patient_name' => 'patient.full_name', 'clinic_name' => 'clinic.name',
        ])->from(['visit' => 'visits'])
            ->innerJoin(['patient' => 'patients'], 'patient.id = visit.patient_id')
            ->innerJoin(['clinic' => 'clinics'], 'clinic.id = visit.clinic_id')
            ->leftJoin(['invoice' => 'invoices'], 'invoice.visit_id = visit.id')
            ->where(['<>', 'visit.status', 'cancelled'])
            ->andWhere(['or', ['visit.status' => 'awaiting_billing'], ['not', ['invoice.id' => null]]]);
    }

    private function paymentQuery(): Query
    {
        return (new Query())->select([
            'payment.id', 'payment.invoice_id', 'payment.receipt_no', 'payment.method', 'payment.amount',
            'payment.external_reference', 'payment.received_by', 'payment.paid_at',
            'invoice.invoice_no', 'visit.visit_date', 'cashier_name' => 'cashier.full_name',
        ])->from(['payment' => 'payments'])
            ->innerJoin(['invoice' => 'invoices'], 'invoice.id = payment.invoice_id')
            ->innerJoin(['visit' => 'visits'], 'visit.id = invoice.visit_id')
            ->innerJoin(['cashier' => 'users'], 'cashier.id = payment.received_by');
    }

    private function page(Query $query, int $page, int $pageSize, callable $serialize): array
    {
        $total = (int) (clone $query)->orderBy([])->count('*', $this->db);
        $rows = $query->limit($pageSize)->offset(($page - 1) * $pageSize)->all($this->db);

        return ['items' => array_map($serialize, $rows), 'total' => $total, 'page' => $page, 'page_size' => $pageSize];
    }

    private function serializeVisit(array $row): array
    {
        foreach (['id', 'patient_id', 'registration_fee'] as $field) {
            $row[$field] = (string) $row[$field];
        }

        return $row;
    }

    private function serializePayment(array $row): array
    {
        foreach (['id', 'invoice_id', 'received_by', 'amount'] as $field) {
            $row[$field] = (string) $row[$field];
        }
        $row['paid_at'] = (new DateTimeImmutable($row['paid_at']))->format(DATE_ATOM);

        return $row;
    }
}
