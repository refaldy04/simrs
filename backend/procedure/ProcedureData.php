<?php

declare(strict_types=1);

namespace app\procedure;

use app\billing\VisitCharges;
use app\registration\RegistrationData;
use yii\db\Connection;
use yii\db\Expression;
use yii\db\Query;
use yii\db\Transaction;
use yii\web\ConflictHttpException;
use yii\web\NotFoundHttpException;

final class ProcedureData
{
    private readonly RegistrationData $registration;
    private readonly VisitCharges $charges;

    public function __construct(private readonly Connection $db)
    {
        $this->registration = new RegistrationData($db);
        $this->charges = new VisitCharges($db);
    }

    public function view(string $visitId, string $userId): array
    {
        return $this->db->transaction(function () use ($visitId, $userId): array {
            $visit = $this->visit($visitId, $userId);

            return $this->context($visit, $this->charges->invoiceForVisit($visitId));
        }, Transaction::REPEATABLE_READ);
    }

    public function add(string $visitId, string $userId, array $input): array
    {
        return $this->db->transaction(function () use ($visitId, $userId, $input): array {
            $visit = $this->visit($visitId, $userId, lock: true);
            $invoice = $this->charges->invoiceForVisit($visitId, lock: true);
            $this->validateReason($visit, $invoice, $input['reason']);

            $alreadyRecorded = (new Query())->from('visit_procedures')->where([
                'visit_id' => $visitId,
                'procedure_id' => $input['procedure_id'],
                'cancelled_at' => null,
            ])->exists($this->db);
            if ($alreadyRecorded) {
                throw new ConflictHttpException('Tindakan ini sudah tercatat. Ubah jumlah pada tindakan yang ada.');
            }

            $master = $this->db->createCommand(
                'SELECT price FROM medical_procedures WHERE id = :id AND is_active FOR SHARE',
                [':id' => $input['procedure_id']],
            )->queryOne();
            if ($master === false) {
                throw new InvalidProcedureInput(['procedure_id' => 'Pilih tindakan medis yang aktif.']);
            }
            $price = (string) $master['price'];
            if ($input['expected_unit_price'] !== null && $input['expected_unit_price'] !== $price) {
                throw new ConflictHttpException('Tarif master berubah. Muat ulang daftar tindakan.');
            }

            $insert = $this->db->createCommand()->insert('visit_procedures', [
                'visit_id' => $visitId,
                'procedure_id' => $input['procedure_id'],
                'performed_by' => $visit['doctor_id'],
                'quantity' => $input['quantity'],
                'unit_price' => $price,
            ]);
            $itemId = (string) $this->db->createCommand($insert->getSql() . ' RETURNING id', $insert->params)->queryScalar();
            $after = $this->item($visitId, $itemId);

            return $this->recordChange($visit, $invoice, $userId, 'create', null, $after, $input['reason']);
        });
    }

    public function change(string $visitId, string $itemId, string $userId, array $input): array
    {
        return $this->db->transaction(function () use ($visitId, $itemId, $userId, $input): array {
            $visit = $this->visit($visitId, $userId, lock: true);
            $invoice = $this->charges->invoiceForVisit($visitId, lock: true);
            $before = $this->item($visitId, $itemId);
            $quantity = $input['quantity'];
            $cancel = $quantity === null;

            if ($before['cancelled_at'] !== null) {
                if ($cancel) {
                    return $this->context($visit, $invoice);
                }
                throw new ConflictHttpException('Tindakan ini sudah dibatalkan.');
            }
            if ($input['expected_quantity'] !== $before['quantity']) {
                throw new ConflictHttpException('Jumlah tindakan sudah berubah. Muat ulang data.');
            }
            if ($quantity === $before['quantity']) {
                return $this->context($visit, $invoice);
            }

            $this->validateReason($visit, $invoice, $input['reason']);
            $changes = $cancel
                ? ['cancelled_at' => new Expression('GREATEST(clock_timestamp(), performed_at)')]
                : ['quantity' => $quantity];
            $this->db->createCommand()->update('visit_procedures', $changes, ['id' => $itemId, 'visit_id' => $visitId])->execute();
            $after = $this->item($visitId, $itemId);

            return $this->recordChange($visit, $invoice, $userId, $cancel ? 'cancel' : 'update', $before, $after, $input['reason']);
        });
    }

    private function visit(string $visitId, string $userId, bool $lock = false): array
    {
        $visit = $this->registration->assignedVisit($visitId, $userId, $lock);
        if ($visit['status'] === 'cancelled') {
            throw new ConflictHttpException('Kunjungan yang dibatalkan tidak tersedia untuk tindakan.');
        }
        if ($lock && $visit['status'] === 'waiting') {
            throw new ConflictHttpException('Simpan pemeriksaan sebelum mencatat tindakan.');
        }

        return $visit;
    }

    private function requiresReason(array $visit, ?array $invoice): bool
    {
        return $invoice !== null || in_array($visit['status'], ['awaiting_billing', 'completed'], true);
    }

    private function validateReason(array $visit, ?array $invoice, ?string $reason): void
    {
        if ($this->requiresReason($visit, $invoice) && $reason === null) {
            throw new InvalidProcedureInput(['reason' => 'Isi alasan perubahan tindakan.']);
        }
    }

    private function recordChange(
        array $visit,
        ?array $invoice,
        string $userId,
        string $action,
        ?array $before,
        array $after,
        ?string $reason,
    ): array {
        $previousStatus = $visit['status'];
        $updatedInvoice = null;
        if ($invoice !== null) {
            $this->charges->syncProcedure($invoice, $after);
            $updatedInvoice = $this->charges->invoiceSummary($invoice['id']);
            if (str_starts_with($updatedInvoice['balance_amount'], '-')) {
                throw new ConflictHttpException('Total tagihan tidak boleh lebih kecil dari jumlah yang sudah dibayar.');
            }

            $visit = $this->charges->syncVisitPaymentStatus($visit, $updatedInvoice);
        }

        $this->db->createCommand()->insert('audit_logs', [
            'visit_id' => $visit['id'],
            'actor_user_id' => $userId,
            'entity_type' => 'visit_procedure',
            'entity_id' => $after['id'],
            'action' => $action,
            'before_data' => ['visit_status' => $previousStatus, 'item' => $before, 'invoice' => $invoice],
            'after_data' => ['visit_status' => $visit['status'], 'item' => $after, 'invoice' => $updatedInvoice],
            'reason' => $reason,
        ])->execute();

        return $this->context($visit, $updatedInvoice);
    }

    private function context(array $visit, ?array $invoice): array
    {
        $items = $this->itemsQuery()->where(['item.visit_id' => $visit['id']])->orderBy(['item.id' => SORT_ASC])->all($this->db);
        $canWrite = $visit['status'] !== 'waiting';
        $options = $canWrite ? $this->options() : [];

        return [
            'visit_status' => $visit['status'],
            'can_write' => $canWrite,
            'requires_revision_reason' => $this->requiresReason($visit, $invoice),
            'items' => array_map($this->serialize(...), $items),
            'options' => $options,
            'billing' => $this->charges->details($visit, $invoice),
        ];
    }

    private function options(): array
    {
        $rows = (new Query())
            ->select(['id', 'code', 'name', 'price'])
            ->from('medical_procedures')
            ->where(['is_active' => true])
            ->orderBy(['name' => SORT_ASC, 'id' => SORT_ASC])
            ->all($this->db);

        return array_map(static function (array $row): array {
            $row['id'] = (string) $row['id'];
            $row['price'] = (string) $row['price'];

            return $row;
        }, $rows);
    }

    private function item(string $visitId, string $itemId): array
    {
        $row = $this->itemsQuery()->where(['item.visit_id' => $visitId, 'item.id' => $itemId])->one($this->db);
        if ($row === false) {
            throw new NotFoundHttpException('Tindakan kunjungan tidak ditemukan.');
        }

        return $this->serialize($row);
    }

    private function itemsQuery(): Query
    {
        return (new Query())->select([
            'item.*', 'master.code', 'master.name', 'subtotal' => new Expression('item.quantity * item.unit_price'),
        ])->from(['item' => 'visit_procedures'])
            ->innerJoin(['master' => 'medical_procedures'], 'master.id = item.procedure_id');
    }

    private function serialize(array $row): array
    {
        foreach (['id', 'visit_id', 'procedure_id', 'performed_by', 'unit_price', 'subtotal'] as $field) {
            $row[$field] = (string) $row[$field];
        }
        $row['quantity'] = (int) $row['quantity'];

        return $row;
    }
}
