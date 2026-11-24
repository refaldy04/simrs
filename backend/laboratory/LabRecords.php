<?php

declare(strict_types=1);

namespace app\laboratory;

use DateTimeImmutable;
use yii\db\Connection;
use yii\db\Query;
use yii\web\NotFoundHttpException;

final class LabRecords
{
    public function __construct(private readonly Connection $db)
    {
    }

    public function tests(): array
    {
        $rows = (new Query())->select(['id', 'code', 'name', 'price'])->from('lab_tests')
            ->where(['is_active' => true])->orderBy(['name' => SORT_ASC, 'id' => SORT_ASC])->all($this->db);

        return array_map(static function (array $row): array {
            $row['id'] = (string) $row['id'];
            $row['price'] = (string) $row['price'];

            return $row;
        }, $rows);
    }

    public function forVisit(string $visitId): array
    {
        $rows = $this->orders()->where(['lab.visit_id' => $visitId])
            ->orderBy(['lab.ordered_at' => SORT_DESC, 'lab.id' => SORT_DESC])->all($this->db);

        return $this->withItems($rows);
    }

    public function history(string $patientId, int $page, int $pageSize): array
    {
        $query = $this->orders()->where(['visit.patient_id' => $patientId, 'lab.status' => 'completed'])
            ->andWhere(['<>', 'visit.status', 'cancelled']);
        $total = (int) (clone $query)->count('*', $this->db);
        $rows = $query->orderBy(['visit.visit_date' => SORT_DESC, 'lab.completed_at' => SORT_DESC, 'lab.id' => SORT_DESC])
            ->limit($pageSize)->offset(($page - 1) * $pageSize)->all($this->db);

        return ['items' => $this->withItems($rows), 'page' => $page, 'page_size' => $pageSize, 'total' => $total];
    }

    public function order(string $id): array
    {
        $row = $this->orders()->where(['lab.id' => $id])->one($this->db);
        if ($row === false) {
            throw new NotFoundHttpException('Permintaan laboratorium tidak ditemukan.');
        }

        return $this->withItems([$row])[0];
    }

    private function orders(): Query
    {
        return (new Query())->select([
            'lab.id', 'lab.visit_id', 'lab.status', 'lab.clinical_notes', 'lab.ordered_at', 'lab.completed_at',
            'visit.visit_date', 'patient.medical_record_no', 'patient_name' => 'patient.full_name',
            'clinic_name' => 'clinic.name', 'doctor_name' => 'doctor.full_name',
        ])->from(['lab' => 'lab_orders'])
            ->innerJoin(['visit' => 'visits'], 'visit.id = lab.visit_id')
            ->innerJoin(['patient' => 'patients'], 'patient.id = visit.patient_id')
            ->innerJoin(['clinic' => 'clinics'], 'clinic.id = visit.clinic_id')
            ->innerJoin(['doctor' => 'medical_staff'], 'doctor.id = lab.ordered_by');
    }

    private function withItems(array $orders): array
    {
        if ($orders === []) {
            return [];
        }

        $rows = (new Query())->select([
            'item.id', 'item.lab_order_id', 'item.lab_test_id', 'item.unit_price',
            'test.code', 'test.name', 'result.result_value', 'result.unit', 'result.reference_range',
            'result.notes', 'result.entered_at', 'entered_by_name' => 'staff.full_name',
        ])->from(['item' => 'lab_order_items'])
            ->innerJoin(['test' => 'lab_tests'], 'test.id = item.lab_test_id')
            ->leftJoin(['result' => 'lab_results'], 'result.lab_order_item_id = item.id')
            ->leftJoin(['staff' => 'users'], 'staff.id = result.entered_by')
            ->where(['item.lab_order_id' => array_column($orders, 'id')])->orderBy(['item.id' => SORT_ASC])->all($this->db);

        $byOrder = [];
        foreach ($rows as $row) {
            $byOrder[$row['lab_order_id']][] = [
                'id' => (string) $row['id'],
                'lab_test_id' => (string) $row['lab_test_id'],
                'code' => $row['code'],
                'name' => $row['name'],
                'unit_price' => (string) $row['unit_price'],
                'result' => $row['entered_at'] === null ? null : [
                    'result_value' => $row['result_value'],
                    'unit' => $row['unit'],
                    'reference_range' => $row['reference_range'],
                    'notes' => $row['notes'],
                    'entered_at' => (new DateTimeImmutable($row['entered_at']))->format(DATE_ATOM),
                    'entered_by_name' => $row['entered_by_name'],
                ],
            ];
        }

        return array_map(static function (array $order) use ($byOrder): array {
            $order['id'] = (string) $order['id'];
            $order['visit_id'] = (string) $order['visit_id'];
            $order['ordered_at'] = (new DateTimeImmutable($order['ordered_at']))->format(DATE_ATOM);
            if ($order['completed_at'] !== null) {
                $order['completed_at'] = (new DateTimeImmutable($order['completed_at']))->format(DATE_ATOM);
            }
            $order['items'] = $byOrder[$order['id']] ?? [];

            return $order;
        }, $orders);
    }
}
