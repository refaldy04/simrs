<?php

declare(strict_types=1);

namespace app\billing;

use yii\db\Connection;
use yii\db\Query;
use yii\db\Transaction;
use yii\web\ConflictHttpException;
use yii\web\NotFoundHttpException;

final class BillingData
{
    private readonly VisitCharges $charges;
    private readonly BillingRecords $records;

    public function __construct(private readonly Connection $db)
    {
        $this->charges = new VisitCharges($db);
        $this->records = new BillingRecords($db);
    }

    public function queue(string $term, string $status, int $page, int $pageSize): array
    {
        return $this->db->transaction(
            fn (): array => $this->records->queue($term, $status, $page, $pageSize),
            Transaction::REPEATABLE_READ,
        );
    }

    public function view(string $visitId): array
    {
        return $this->db->transaction(function () use ($visitId): array {
            $visit = $this->records->visit($visitId);

            return $this->detail($visit, $this->charges->invoiceForVisit($visitId));
        }, Transaction::REPEATABLE_READ);
    }

    public function history(string $visitId, int $page, int $pageSize): array
    {
        return $this->db->transaction(function () use ($visitId, $page, $pageSize): array {
            $visit = $this->records->visit($visitId);

            return $this->records->history($visit['patient_id'], $page, $pageSize);
        }, Transaction::REPEATABLE_READ);
    }

    public function issue(string $visitId, string $actor): array
    {
        return $this->db->transaction(function () use ($visitId, $actor): array {
            $lockedVisit = $this->charges->lockVisit($visitId);
            $invoice = $this->charges->invoiceForVisit($visitId, lock: true);

            if ($invoice !== null) {
                return ['detail' => $this->detail($this->records->visit($visitId), $invoice), 'replayed' => true];
            }
            if ($lockedVisit['status'] !== 'awaiting_billing') {
                throw new ConflictHttpException('Selesaikan pemeriksaan sebelum menerbitkan tagihan.');
            }

            $insert = $this->db->createCommand()->insert('invoices', [
                'visit_id' => $visitId,
                'invoice_no' => 'INV-' . str_replace('-', '', $lockedVisit['visit_date']) . '-' . $visitId,
                'issued_by' => $actor,
            ]);
            $invoiceId = (string) $this->db->createCommand($insert->getSql() . ' RETURNING id', $insert->params)->queryScalar();
            $this->charges->addInvoiceItems($lockedVisit, $invoiceId);
            $invoice = $this->charges->invoiceSummary($invoiceId);
            $this->charges->syncVisitPaymentStatus($lockedVisit, $invoice);
            $this->audit($visitId, $actor, 'invoice', $invoiceId, null, $invoice);

            return ['detail' => $this->detail($this->records->visit($visitId), $invoice), 'replayed' => false];
        });
    }

    public function pay(string $invoiceId, string $actor, array $input): array
    {
        return $this->db->transaction(function () use ($invoiceId, $actor, $input): array {
            $visitId = (new Query())->select('visit_id')->from('invoices')->where(['id' => $invoiceId])->scalar($this->db);
            if ($visitId === false) {
                throw new NotFoundHttpException('Tagihan tidak ditemukan.');
            }

            $visitId = (string) $visitId;
            $visit = $this->charges->lockVisit($visitId);
            $invoice = $this->charges->invoiceForVisit($visitId, lock: true);
            if ($invoice === null || $invoice['id'] !== $invoiceId) {
                throw new NotFoundHttpException('Tagihan tidak ditemukan.');
            }

            $existing = $this->records->paymentByKey($input['idempotency_key']);
            if ($existing !== null) {
                return $this->replay($visitId, $invoice, $existing, $input);
            }
            if (!in_array($visit['status'], ['awaiting_billing', 'completed'], true)) {
                throw new ConflictHttpException('Kunjungan belum siap menerima pembayaran.');
            }

            $id = $this->insertPayment($invoiceId, $actor, $input);
            if ($id === false) {
                $existing = $this->records->paymentByKey($input['idempotency_key']);
                if ($existing !== null) {
                    return $this->replay($visitId, $invoice, $existing, $input);
                }

                throw new ConflictHttpException('Nominal pembayaran melebihi sisa tagihan terbaru.');
            }

            $payment = $this->records->payment((string) $id);
            $after = $this->charges->invoiceSummary($invoiceId);
            $this->charges->syncVisitPaymentStatus($visit, $after);
            $this->audit($visitId, $actor, 'payment', (string) $id, $invoice, ['invoice' => $after, 'payment' => $payment]);

            return [
                'detail' => $this->detail($this->records->visit($visitId), $after),
                'payment' => $payment,
                'replayed' => false,
            ];
        });
    }

    private function detail(array $visit, ?array $invoice): array
    {
        return [
            'visit' => $visit,
            'can_issue' => $invoice === null && $visit['status'] === 'awaiting_billing',
            'billing' => $this->charges->details($visit, $invoice),
        ];
    }

    private function replay(string $visitId, array $invoice, array $existing, array $input): array
    {
        if ($existing['invoice_id'] !== $invoice['id']
            || $existing['amount'] !== $input['amount']
            || $existing['method'] !== $input['method']
            || $existing['external_reference'] !== $input['external_reference']
        ) {
            throw new ConflictHttpException('Kunci pembayaran sudah dipakai untuk transaksi dengan isian berbeda.');
        }

        return [
            'detail' => $this->detail($this->records->visit($visitId), $invoice),
            'payment' => $existing,
            'replayed' => true,
        ];
    }

    private function insertPayment(string $invoiceId, string $actor, array $input): mixed
    {
        return $this->db->createCommand(<<<'SQL'
            INSERT INTO payments (invoice_id, receipt_no, idempotency_key, method, amount, external_reference, received_by)
            SELECT balance.invoice_id, :receipt_no, :key, :method, :amount, :reference, :actor
            FROM invoice_balances AS balance
            WHERE balance.invoice_id = :invoice_id AND balance.balance_amount >= :amount_limit
            ON CONFLICT DO NOTHING
            RETURNING id
            SQL, [
                ':invoice_id' => $invoiceId,
                ':receipt_no' => 'RCPT-' . str_replace('-', '', $input['idempotency_key']),
                ':key' => $input['idempotency_key'],
                ':method' => $input['method'],
                ':amount' => $input['amount'],
                ':reference' => $input['external_reference'],
                ':actor' => $actor,
                ':amount_limit' => $input['amount'],
            ])->queryScalar();
    }

    private function audit(string $visitId, string $actor, string $type, string $id, ?array $before, array $after): void
    {
        $this->db->createCommand()->insert('audit_logs', [
            'visit_id' => $visitId,
            'actor_user_id' => $actor,
            'entity_type' => $type,
            'entity_id' => $id,
            'action' => 'create',
            'before_data' => $before,
            'after_data' => $after,
        ])->execute();
    }
}
