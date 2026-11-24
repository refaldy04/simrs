<?php

declare(strict_types=1);

namespace app\laboratory;

use app\billing\VisitCharges;
use app\registration\RegistrationData;
use yii\db\Connection;
use yii\db\Expression;
use yii\db\Query;
use yii\db\Transaction;
use yii\web\ConflictHttpException;
use yii\web\NotFoundHttpException;

final class LabData
{
    private const ORDER_REQUESTED = 'lab.order.requested';

    private readonly RegistrationData $registration;
    private readonly VisitCharges $charges;
    private readonly LabRecords $records;

    public function __construct(private readonly Connection $db)
    {
        $this->registration = new RegistrationData($db);
        $this->charges = new VisitCharges($db);
        $this->records = new LabRecords($db);
    }

    public function viewVisit(string $id, string $actor): array
    {
        return $this->db->transaction(function () use ($id, $actor): array {
            $visit = $this->registration->assignedVisit($id, $actor);
            $canOrder = $this->canOrder($visit);

            return [
                'visit_status' => $visit['status'],
                'can_order' => $canOrder,
                'tests' => $canOrder ? $this->records->tests() : [],
                'orders' => $this->records->forVisit($id),
            ];
        }, Transaction::REPEATABLE_READ);
    }

    public function history(string $id, string $actor, int $page, int $pageSize): array
    {
        return $this->db->transaction(function () use ($id, $actor, $page, $pageSize): array {
            $visit = $this->registration->assignedVisit($id, $actor);

            return $this->records->history($visit['patient_id'], $page, $pageSize);
        }, Transaction::REPEATABLE_READ);
    }

    public function order(string $id): array
    {
        return $this->db->transaction(
            fn (): array => $this->records->order($id),
            Transaction::REPEATABLE_READ,
        );
    }

    public function create(string $visitId, string $actor, array $input): array
    {
        return $this->db->transaction(function () use ($visitId, $actor, $input): array {
            $visit = $this->registration->assignedVisit($visitId, $actor, lock: true);
            $event = (new Query())->select(['lab_order_id', 'event_type'])->from('integration_outbox')
                ->where(['event_key' => $input['idempotency_key']])->one($this->db);
            if ($event !== false) {
                return $this->replayOrder($visitId, $event, $input);
            }
            if (!$this->canOrder($visit)) {
                throw new ConflictHttpException('Permintaan lab tersedia setelah pemeriksaan dimulai dan sebelum kunjungan selesai.');
            }

            $tests = $this->activeTests($input['lab_test_ids']);
            $insert = $this->db->createCommand()->insert('lab_orders', [
                'visit_id' => $visitId,
                'ordered_by' => $visit['doctor_id'],
                'clinical_notes' => $input['clinical_notes'],
            ]);
            $id = (string) $this->db->createCommand($insert->getSql() . ' RETURNING id', $insert->params)->queryScalar();
            $rows = array_map(static fn (array $test): array => [$id, $visitId, $test['id'], $test['price']], $tests);
            $this->db->createCommand()->batchInsert('lab_order_items', [
                'lab_order_id', 'visit_id', 'lab_test_id', 'unit_price',
            ], $rows)->execute();

            $this->enqueue($id, $input['idempotency_key']);
            $order = $this->records->order($id);
            $this->audit($order, $actor, 'create', null, $order);

            return ['order' => $order, 'replayed' => false];
        });
    }

    public function complete(string $id, string $actor, array $results): array
    {
        return $this->db->transaction(function () use ($id, $actor, $results): array {
            $visitId = (new Query())->select('visit_id')->from('lab_orders')->where(['id' => $id])->scalar($this->db);
            if ($visitId === false) {
                throw new NotFoundHttpException('Permintaan laboratorium tidak ditemukan.');
            }

            $visit = $this->charges->lockVisit((string) $visitId);
            $before = $this->records->order($id);
            $itemIds = array_column($before['items'], 'id');
            if (count($itemIds) !== count($results) || array_diff($itemIds, array_keys($results))) {
                throw new InvalidLabInput(['items' => 'Kirim tepat satu hasil untuk setiap item pada permintaan ini.']);
            }
            if ($before['status'] === 'completed') {
                return $this->replayResults($before, $results);
            }
            if (!in_array($before['status'], ['requested', 'in_progress'], true)
                || in_array($visit['status'], ['waiting', 'cancelled'], true)
            ) {
                throw new ConflictHttpException('Permintaan ini tidak tersedia untuk pencatatan hasil.');
            }

            $invoice = $this->charges->invoiceForVisit($visit['id'], lock: true);
            $this->saveResults($id, $actor, $results);
            $updatedInvoice = null;
            if ($invoice !== null) {
                $this->charges->syncLabOrder($invoice, $id);
                $updatedInvoice = $this->charges->invoiceSummary($invoice['id']);
                $this->charges->syncVisitPaymentStatus($visit, $updatedInvoice);
            }
            $order = $this->records->order($id);
            $this->audit($order, $actor, 'finish', ['order' => $before, 'invoice' => $invoice], [
                'order' => $order,
                'invoice' => $updatedInvoice,
            ]);

            return ['order' => $order, 'replayed' => false];
        });
    }

    private function canOrder(array $visit): bool
    {
        return in_array($visit['status'], ['in_examination', 'awaiting_billing'], true);
    }

    private function activeTests(array $ids): array
    {
        $query = (new Query())->select(['id', 'price'])->from('lab_tests')
            ->where(['id' => $ids, 'is_active' => true])->orderBy(['id' => SORT_ASC])->createCommand($this->db);
        $tests = $this->db->createCommand($query->getSql() . ' FOR SHARE', $query->params)->queryAll();
        if (count($tests) !== count($ids)) {
            throw new InvalidLabInput(['lab_test_ids' => 'Pilih pemeriksaan lab yang masih aktif.']);
        }

        return $tests;
    }

    private function enqueue(string $id, string $key): void
    {
        $insert = $this->db->createCommand()->insert('integration_outbox', [
            'event_key' => $key, 'lab_order_id' => $id, 'event_type' => self::ORDER_REQUESTED,
            'payload' => ['lab_order_id' => $id],
        ]);
        $inserted = $this->db->createCommand($insert->getSql() . ' ON CONFLICT (event_key) DO NOTHING', $insert->params)->execute();
        if ($inserted !== 1) {
            throw new ConflictHttpException('Kunci permintaan sudah dipakai untuk order lab lain.');
        }
    }

    private function replayOrder(string $visitId, array $event, array $input): array
    {
        $order = $this->records->order((string) $event['lab_order_id']);
        $testIds = array_column($order['items'], 'lab_test_id');
        sort($testIds, SORT_STRING);
        if ($event['event_type'] !== self::ORDER_REQUESTED || $order['visit_id'] !== $visitId
            || $order['clinical_notes'] !== $input['clinical_notes'] || $testIds !== $input['lab_test_ids']
        ) {
            throw new ConflictHttpException('Kunci permintaan sudah dipakai dengan isian berbeda.');
        }

        return ['order' => $order, 'replayed' => true];
    }

    private function replayResults(array $order, array $results): array
    {
        foreach ($order['items'] as $item) {
            $submitted = $results[$item['id']];
            $stored = array_intersect_key($item['result'] ?? [], $submitted);
            if ($stored !== $submitted) {
                throw new ConflictHttpException('Hasil sudah disimpan dengan isian berbeda. Muat ulang permintaan.');
            }
        }

        return ['order' => $order, 'replayed' => true];
    }

    private function saveResults(string $id, string $actor, array $results): void
    {
        $rows = [];
        foreach ($results as $itemId => $result) {
            $rows[] = [(string) $itemId, $result['result_value'], $result['unit'], $result['reference_range'], $result['notes'], $actor];
        }
        $insert = $this->db->createCommand()->batchInsert('lab_results', [
            'lab_order_item_id', 'result_value', 'unit', 'reference_range', 'notes', 'entered_by',
        ], $rows);
        $this->db->createCommand($insert->getSql() . <<<'SQL'
             ON CONFLICT (lab_order_item_id) DO UPDATE SET
                result_value = EXCLUDED.result_value, unit = EXCLUDED.unit,
                reference_range = EXCLUDED.reference_range, notes = EXCLUDED.notes,
                entered_by = EXCLUDED.entered_by, entered_at = EXCLUDED.entered_at
            SQL, $insert->params)->execute();
        $this->db->createCommand()->update('lab_orders', [
            'status' => 'completed',
            'completed_at' => new Expression('GREATEST(clock_timestamp(), ordered_at)'),
        ], ['id' => $id])->execute();
    }

    private function audit(array $order, string $actor, string $action, ?array $before, array $after): void
    {
        $this->db->createCommand()->insert('audit_logs', [
            'visit_id' => $order['visit_id'], 'actor_user_id' => $actor,
            'entity_type' => 'lab_order', 'entity_id' => $order['id'], 'action' => $action,
            'before_data' => $before, 'after_data' => $after,
        ])->execute();
    }
}
