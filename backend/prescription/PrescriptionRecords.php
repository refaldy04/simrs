<?php

declare(strict_types=1);

namespace app\prescription;

use DateTimeImmutable;
use yii\db\Connection;
use yii\db\Expression;
use yii\db\Query;
use yii\web\NotFoundHttpException;

final class PrescriptionRecords
{
    public function __construct(private readonly Connection $db)
    {
    }

    public function forVisit(string $visitId): array
    {
        $rows = $this->query()->where(['rx.visit_id' => $visitId])
            ->orderBy(['rx.prescribed_at' => SORT_DESC, 'rx.id' => SORT_DESC])->all($this->db);

        return $this->withItems($rows);
    }

    public function history(string $patientId, int $page, int $pageSize): array
    {
        $query = $this->query()->where(['visit.patient_id' => $patientId, 'rx.status' => 'dispensed'])
            ->orderBy(['rx.dispensed_at' => SORT_DESC, 'rx.id' => SORT_DESC]);

        return $this->page($query, $page, $pageSize);
    }

    public function pharmacy(string $term, string $status, int $page, int $pageSize): array
    {
        $query = $this->query()->where(['<>', 'visit.status', 'cancelled']);
        if ($status !== 'all') {
            $query->andWhere(['rx.status' => $status]);
        }
        if ($term !== '') {
            $query->andWhere(['or', ['ilike', 'patient.full_name', $term], ['ilike', 'patient.medical_record_no', $term]]);
        }

        $time = $status === 'dispensed' ? 'rx.dispensed_at' : 'rx.prescribed_at';
        $direction = $status === 'pending' ? SORT_ASC : SORT_DESC;
        $query->orderBy([$time => $direction, 'rx.id' => $direction]);

        return $this->page($query, $page, $pageSize);
    }

    public function record(string $id): array
    {
        $row = $this->query()->where(['rx.id' => $id])->one($this->db);
        if ($row === false) {
            throw new NotFoundHttpException('Resep tidak ditemukan.');
        }

        return $this->withItems([$row])[0];
    }

    public function medicineOptions(): array
    {
        $rows = (new Query())->select(['id', 'code', 'name', 'unit', 'price', 'stock_quantity'])
            ->from('medicines')->where(['is_active' => true])
            ->orderBy(['name' => SORT_ASC, 'id' => SORT_ASC])->all($this->db);

        return array_map(static function (array $row): array {
            $row['id'] = (string) $row['id'];
            $row['price'] = (string) $row['price'];
            $row['stock_quantity'] = (int) $row['stock_quantity'];

            return $row;
        }, $rows);
    }

    public function items(array $prescriptionIds, bool $stockOrder = false): array
    {
        if ($prescriptionIds === []) {
            return [];
        }

        $order = $stockOrder ? ['item.medicine_id' => SORT_ASC, 'item.id' => SORT_ASC] : ['item.id' => SORT_ASC];
        $rows = (new Query())->select([
            'item.*', 'medicine.code', 'medicine.name', 'medicine.unit', 'medicine.stock_quantity',
            'medicine_active' => new Expression('CASE WHEN medicine.is_active THEN 1 ELSE 0 END'),
            'subtotal' => new Expression('item.quantity * item.unit_price'),
        ])->from(['item' => 'prescription_items'])
            ->innerJoin(['medicine' => 'medicines'], 'medicine.id = item.medicine_id')
            ->where(['item.prescription_id' => $prescriptionIds])
            ->orderBy($order)->all($this->db);

        return array_map(static function (array $row): array {
            foreach (['id', 'prescription_id', 'visit_id', 'medicine_id', 'unit_price', 'subtotal'] as $field) {
                $row[$field] = (string) $row[$field];
            }
            $row['quantity'] = (int) $row['quantity'];
            $row['stock_quantity'] = (int) $row['stock_quantity'];
            $row['medicine_active'] = (bool) $row['medicine_active'];

            return $row;
        }, $rows);
    }

    private function query(): Query
    {
        return (new Query())->select([
            'rx.id', 'rx.visit_id', 'rx.status', 'rx.prescribed_at', 'rx.dispensed_at', 'rx.prescribed_by', 'rx.dispensed_by',
            'visit.visit_date', 'patient.medical_record_no', 'patient_name' => 'patient.full_name',
            'clinic_name' => 'clinic.name', 'doctor_name' => 'doctor.full_name', 'pharmacist_name' => 'pharmacist.full_name',
        ])->from(['rx' => 'prescriptions'])
            ->innerJoin(['visit' => 'visits'], 'visit.id = rx.visit_id')
            ->innerJoin(['patient' => 'patients'], 'patient.id = visit.patient_id')
            ->innerJoin(['clinic' => 'clinics'], 'clinic.id = visit.clinic_id')
            ->innerJoin(['doctor' => 'medical_staff'], 'doctor.id = rx.prescribed_by')
            ->leftJoin(['pharmacist' => 'users'], 'pharmacist.id = rx.dispensed_by');
    }

    private function page(Query $query, int $page, int $pageSize): array
    {
        $total = (int) (clone $query)->orderBy([])->count('*', $this->db);
        $rows = $query->limit($pageSize)->offset(($page - 1) * $pageSize)->all($this->db);

        return ['items' => $this->withItems($rows), 'page' => $page, 'page_size' => $pageSize, 'total' => $total];
    }

    private function withItems(array $rows): array
    {
        $byPrescription = [];
        foreach ($this->items(array_column($rows, 'id')) as $item) {
            $byPrescription[$item['prescription_id']][] = $item;
        }

        foreach ($rows as &$row) {
            foreach (['id', 'visit_id', 'prescribed_by', 'dispensed_by'] as $field) {
                if ($row[$field] !== null) {
                    $row[$field] = (string) $row[$field];
                }
            }
            $row['prescribed_at'] = (new DateTimeImmutable($row['prescribed_at']))->format(DATE_ATOM);
            if ($row['dispensed_at'] !== null) {
                $row['dispensed_at'] = (new DateTimeImmutable($row['dispensed_at']))->format(DATE_ATOM);
            }
            $row['items'] = $byPrescription[$row['id']] ?? [];
        }
        unset($row);

        return $rows;
    }
}
