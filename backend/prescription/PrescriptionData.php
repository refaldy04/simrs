<?php

declare(strict_types=1);

namespace app\prescription;

use app\billing\VisitCharges;
use app\registration\RegistrationData;
use yii\db\Connection;
use yii\db\Query;
use yii\db\Transaction;
use yii\web\ConflictHttpException;
use yii\web\NotFoundHttpException;

final class PrescriptionData
{
    private readonly RegistrationData $registration;
    private readonly PrescriptionRecords $records;
    private readonly VisitCharges $charges;

    public function __construct(private readonly Connection $db)
    {
        $this->registration = new RegistrationData($db);
        $this->records = new PrescriptionRecords($db);
        $this->charges = new VisitCharges($db);
    }

    public function forVisit(string $visitId, string $userId): array
    {
        return $this->db->transaction(function () use ($visitId, $userId): array {
            $visit = $this->doctorVisit($visitId, $userId);
            $canCreate = $this->canCreate($visit);

            return [
                'can_create' => $canCreate,
                'medicines' => $canCreate ? $this->records->medicineOptions() : [],
                'prescriptions' => $this->records->forVisit($visitId),
            ];
        }, Transaction::REPEATABLE_READ);
    }

    public function history(string $visitId, string $userId, int $page, int $pageSize): array
    {
        return $this->db->transaction(function () use ($visitId, $userId, $page, $pageSize): array {
            $visit = $this->doctorVisit($visitId, $userId);

            return $this->records->history($visit['patient_id'], $page, $pageSize);
        }, Transaction::REPEATABLE_READ);
    }

    public function pharmacy(string $term, string $status, int $page, int $pageSize): array
    {
        return $this->db->transaction(
            fn (): array => $this->records->pharmacy($term, $status, $page, $pageSize),
            Transaction::REPEATABLE_READ,
        );
    }

    public function create(string $visitId, string $userId, array $input): array
    {
        return $this->db->transaction(function () use ($visitId, $userId, $input): array {
            $visit = $this->doctorVisit($visitId, $userId, lock: true);
            $existing = (new Query())->select('id')->from('prescriptions')->where([
                'visit_id' => $visitId,
                'idempotency_key' => $input['idempotency_key'],
            ])->scalar($this->db);

            if ($existing !== false) {
                $prescription = $this->records->record((string) $existing);
                if ($this->clinicalItems($prescription['items']) !== $this->clinicalItems($input['items'])) {
                    throw new ConflictHttpException('Kunci penyimpanan sudah dipakai untuk resep dengan isian berbeda.');
                }

                return ['prescription' => $prescription, 'replayed' => true];
            }
            if (!$this->canCreate($visit)) {
                throw new ConflictHttpException('Simpan hasil pemeriksaan sebelum membuat resep.');
            }

            $medicines = $this->checkMedicineStock($input['items']);
            $command = $this->db->createCommand()->insert('prescriptions', [
                'visit_id' => $visitId,
                'prescribed_by' => $visit['doctor_id'],
                'idempotency_key' => $input['idempotency_key'],
            ]);
            $id = (string) $this->db->createCommand($command->getSql() . ' RETURNING id', $command->params)->queryScalar();

            $rows = [];
            foreach ($input['items'] as $item) {
                $rows[] = [
                    $id, $visitId, $item['medicine_id'], $item['dose'], $item['frequency'],
                    $item['quantity'], $medicines[$item['medicine_id']]['price'],
                ];
            }
            $this->db->createCommand()->batchInsert('prescription_items', [
                'prescription_id', 'visit_id', 'medicine_id', 'dose', 'frequency', 'quantity', 'unit_price',
            ], $rows)->execute();
            $this->audit($id, $visitId, $userId, 'create', null, ['status' => 'pending']);

            return ['prescription' => $this->records->record($id), 'replayed' => false];
        });
    }

    public function cancel(string $visitId, string $id, string $userId): array
    {
        return $this->db->transaction(function () use ($visitId, $id, $userId): array {
            $this->doctorVisit($visitId, $userId, lock: true);
            $status = $this->lockPrescription($id, $visitId);

            if ($status === 'dispensed') {
                throw new ConflictHttpException('Resep yang obatnya sudah diserahkan tidak dapat dibatalkan.');
            }
            if ($status === 'pending') {
                $this->db->createCommand()->update('prescriptions', ['status' => 'cancelled'], ['id' => $id])->execute();
                $this->audit($id, $visitId, $userId, 'cancel', ['status' => 'pending'], ['status' => 'cancelled']);
            }

            return ['prescription' => $this->records->record($id)];
        });
    }

    public function dispense(string $id, string $userId): array
    {
        return $this->db->transaction(function () use ($id, $userId): array {
            $visitId = (new Query())->select('visit_id')->from('prescriptions')->where(['id' => $id])->scalar($this->db);
            if ($visitId === false) {
                throw new NotFoundHttpException('Resep tidak ditemukan.');
            }

            $visitId = (string) $visitId;
            $visit = $this->charges->lockVisit($visitId);
            $status = $this->lockPrescription($id, $visitId);
            if ($status === 'dispensed') {
                return ['prescription' => $this->records->record($id)];
            }
            if ($status !== 'pending' || in_array($visit['status'], ['waiting', 'cancelled'], true)) {
                throw new ConflictHttpException('Resep ini tidak tersedia untuk penyerahan obat.');
            }

            $invoice = $this->charges->invoiceForVisit($visitId, lock: true);
            $items = $this->records->items([$id], stockOrder: true);
            if ($items === []) {
                throw new ConflictHttpException('Resep tidak memiliki obat untuk diserahkan.');
            }

            foreach ($items as $item) {
                $this->subtractStock($item);
            }
            $at = $this->db->createCommand(<<<'SQL'
                UPDATE prescriptions
                SET status = 'dispensed', dispensed_by = :user_id,
                    dispensed_at = GREATEST(clock_timestamp(), prescribed_at)
                WHERE id = :id
                RETURNING dispensed_at
                SQL, [':user_id' => $userId, ':id' => $id])->queryScalar();

            $movements = [];
            foreach ($items as $item) {
                $movements[] = [$item['medicine_id'], $item['id'], 'dispense', -$item['quantity'], $userId, $at];
            }
            $this->db->createCommand()->batchInsert('medicine_stock_movements', [
                'medicine_id', 'prescription_item_id', 'movement_type', 'quantity_delta', 'recorded_by', 'recorded_at',
            ], $movements)->execute();

            $updatedInvoice = null;
            if ($invoice !== null) {
                $this->charges->syncPrescription($invoice, $id);
                $updatedInvoice = $this->charges->invoiceSummary($invoice['id']);
                $this->charges->syncVisitPaymentStatus($visit, $updatedInvoice);
            }
            $this->audit(
                $id,
                $visitId,
                $userId,
                'dispense',
                ['status' => 'pending', 'invoice' => $invoice],
                ['status' => 'dispensed', 'invoice' => $updatedInvoice],
            );

            return ['prescription' => $this->records->record($id)];
        });
    }

    private function doctorVisit(string $visitId, string $userId, bool $lock = false): array
    {
        $visit = $this->registration->assignedVisit($visitId, $userId, $lock);
        if ($visit['status'] === 'cancelled') {
            throw new ConflictHttpException('Kunjungan dibatalkan.');
        }

        return $visit;
    }

    private function canCreate(array $visit): bool
    {
        return $visit['status'] !== 'waiting'
            && (new Query())->from('examinations')->where(['visit_id' => $visit['id']])->exists($this->db);
    }

    private function clinicalItems(array $items): array
    {
        return array_map(static fn (array $item): array => [
            $item['medicine_id'], $item['dose'], $item['frequency'], $item['quantity'],
        ], $items);
    }

    private function checkMedicineStock(array $items): array
    {
        $totalByMedicine = [];
        foreach ($items as $item) {
            $id = $item['medicine_id'];
            $totalByMedicine[$id] = ($totalByMedicine[$id] ?? 0) + $item['quantity'];
        }

        $command = (new Query())->select(['id', 'name', 'price', 'stock_quantity'])->from('medicines')
            ->where(['id' => array_keys($totalByMedicine), 'is_active' => true])
            ->orderBy(['id' => SORT_ASC])->createCommand($this->db);
        $medicines = $this->db->createCommand($command->getSql() . ' FOR SHARE', $command->params)->queryAll();
        $byId = array_column($medicines, null, 'id');

        foreach ($items as $index => $item) {
            $id = $item['medicine_id'];
            $medicine = $byId[$id] ?? null;
            if ($medicine === null) {
                throw new InvalidPrescriptionInput(['items.' . $index . '.medicine_id' => 'Pilih obat yang aktif.']);
            }
            if ($item['expected_unit_price'] !== null && $item['expected_unit_price'] !== (string) $medicine['price']) {
                throw new ConflictHttpException('Harga ' . $medicine['name'] . ' berubah. Muat ulang pilihan obat.');
            }
            if ($totalByMedicine[$id] > (int) $medicine['stock_quantity']) {
                throw new ConflictHttpException('Stok ' . $medicine['name'] . ' tidak cukup untuk jumlah yang diresepkan.');
            }
        }

        return $byId;
    }

    private function lockPrescription(string $id, string $visitId): string
    {
        $status = $this->db->createCommand(
            'SELECT status FROM prescriptions WHERE id = :id AND visit_id = :visit_id FOR UPDATE',
            [':id' => $id, ':visit_id' => $visitId],
        )->queryScalar();
        if ($status === false) {
            throw new NotFoundHttpException('Resep tidak ditemukan.');
        }

        return $status;
    }

    private function subtractStock(array $item): void
    {
        $updated = $this->db->createCommand(<<<'SQL'
            UPDATE medicines
            SET stock_quantity = stock_quantity - :quantity
            WHERE id = :id AND is_active AND stock_quantity >= :minimum
            SQL, [
                ':quantity' => $item['quantity'],
                ':id' => $item['medicine_id'],
                ':minimum' => $item['quantity'],
            ])->execute();

        if ($updated === 0) {
            throw new ConflictHttpException('Obat ' . $item['name'] . ' tidak tersedia dalam jumlah yang diresepkan. Muat ulang stok.');
        }
    }

    private function audit(string $id, string $visitId, string $userId, string $action, ?array $before, array $after): void
    {
        $this->db->createCommand()->insert('audit_logs', [
            'visit_id' => $visitId,
            'actor_user_id' => $userId,
            'entity_type' => 'prescription',
            'entity_id' => $id,
            'action' => $action,
            'before_data' => $before,
            'after_data' => $after,
        ])->execute();
    }
}
