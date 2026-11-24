<?php

declare(strict_types=1);

namespace app\billing;

use DateTimeImmutable;
use yii\db\Connection;
use yii\web\NotFoundHttpException;

final class VisitCharges
{
    public function __construct(private readonly Connection $db)
    {
    }

    public function lockVisit(string $id): array
    {
        $visit = $this->db->createCommand(
            'SELECT id, status, visit_date, registration_fee FROM visits WHERE id = :id FOR UPDATE',
            [':id' => $id],
        )->queryOne();
        if ($visit === false) {
            throw new NotFoundHttpException('Kunjungan tidak ditemukan.');
        }

        $visit['id'] = (string) $visit['id'];
        $visit['registration_fee'] = (string) $visit['registration_fee'];

        return $visit;
    }

    public function invoiceForVisit(string $visitId, bool $lock = false): ?array
    {
        $sql = 'SELECT id FROM invoices WHERE visit_id = :visit_id';
        if ($lock) {
            $sql .= ' FOR UPDATE';
        }
        $id = $this->db->createCommand($sql, [':visit_id' => $visitId])->queryScalar();

        return $id === false ? null : $this->invoiceSummary((string) $id);
    }

    public function invoiceSummary(string $id): array
    {
        $invoice = $this->db->createCommand(<<<'SQL'
            SELECT invoice.id, invoice.invoice_no, invoice.issued_at,
                balance.total_amount, balance.paid_amount, balance.balance_amount, balance.status
            FROM invoices AS invoice
            JOIN invoice_balances AS balance ON balance.invoice_id = invoice.id
            WHERE invoice.id = :id
            SQL, [':id' => $id])->queryOne();

        return [
            'id' => (string) $invoice['id'],
            'invoice_no' => $invoice['invoice_no'],
            'issued_at' => (new DateTimeImmutable($invoice['issued_at']))->format(DATE_ATOM),
            'total_amount' => (string) $invoice['total_amount'],
            'paid_amount' => (string) $invoice['paid_amount'],
            'balance_amount' => (string) $invoice['balance_amount'],
            'status' => $invoice['status'],
        ];
    }

    public function details(array $visit, ?array $invoice): array
    {
        if ($invoice === null) {
            return $this->estimate($visit);
        }

        $rows = $this->db->createCommand(<<<'SQL'
            SELECT item_type, description, quantity, unit_price, quantity * unit_price AS subtotal
            FROM invoice_items
            WHERE invoice_id = :invoice_id
            ORDER BY CASE item_type WHEN 'registration' THEN 0 WHEN 'procedure' THEN 1 WHEN 'lab' THEN 2 ELSE 3 END, id
            SQL, [':invoice_id' => $invoice['id']])->queryAll();

        return [
            'invoice' => $invoice,
            'total_amount' => $invoice['total_amount'],
            'items' => array_map($this->line(...), $rows),
        ];
    }

    public function syncProcedure(array $invoice, array $item): void
    {
        if ($item['cancelled_at'] !== null) {
            $this->db->createCommand()->delete('invoice_items', [
                'invoice_id' => $invoice['id'],
                'visit_procedure_id' => $item['id'],
            ])->execute();
            return;
        }

        $this->db->createCommand(<<<'SQL'
            INSERT INTO invoice_items (
                invoice_id, visit_id, item_type, description, quantity, unit_price, visit_procedure_id
            )
            VALUES (:invoice_id, :visit_id, 'procedure', :description, :quantity, :unit_price, :procedure_item_id)
            ON CONFLICT (visit_procedure_id) DO UPDATE
                SET quantity = EXCLUDED.quantity, unit_price = EXCLUDED.unit_price
            SQL, [
                ':invoice_id' => $invoice['id'],
                ':visit_id' => $item['visit_id'],
                ':description' => $item['name'],
                ':quantity' => $item['quantity'],
                ':unit_price' => $item['unit_price'],
                ':procedure_item_id' => $item['id'],
            ])->execute();
    }

    public function syncPrescription(array $invoice, string $prescriptionId): void
    {
        $this->db->createCommand(<<<'SQL'
            INSERT INTO invoice_items (
                invoice_id, visit_id, item_type, description, quantity, unit_price, prescription_item_id
            )
            SELECT :invoice_id, item.visit_id, 'medicine', medicine.name, item.quantity, item.unit_price, item.id
            FROM prescription_items AS item
            JOIN medicines AS medicine ON medicine.id = item.medicine_id
            WHERE item.prescription_id = :prescription_id
            ON CONFLICT (prescription_item_id) DO NOTHING
            SQL, [':invoice_id' => $invoice['id'], ':prescription_id' => $prescriptionId])->execute();
    }

    public function syncLabOrder(array $invoice, string $orderId): void
    {
        $this->db->createCommand(<<<'SQL'
            INSERT INTO invoice_items (invoice_id, visit_id, item_type, description, unit_price, lab_order_item_id)
            SELECT :invoice_id, item.visit_id, 'lab', test.name, item.unit_price, item.id
            FROM lab_order_items AS item
            JOIN lab_tests AS test ON test.id = item.lab_test_id
            WHERE item.lab_order_id = :order_id
            ON CONFLICT (lab_order_item_id) DO NOTHING
            SQL, [':invoice_id' => $invoice['id'], ':order_id' => $orderId])->execute();
    }

    public function syncVisitPaymentStatus(array $visit, array $invoice): array
    {
        if (!in_array($visit['status'], ['awaiting_billing', 'completed'], true)) {
            return $visit;
        }

        $status = $invoice['status'] === 'paid' ? 'completed' : 'awaiting_billing';
        if ($status !== $visit['status']) {
            $this->db->createCommand()->update('visits', ['status' => $status], ['id' => $visit['id']])->execute();
            $visit['status'] = $status;
        }

        return $visit;
    }

    public function addInvoiceItems(array $visit, string $invoiceId): void
    {
        $rows = [];
        foreach ($this->projectedItems($visit) as $item) {
            $rows[] = [
                $invoiceId, $visit['id'], $item['item_type'], $item['description'], $item['quantity'], $item['unit_price'],
                $item['visit_procedure_id'], $item['lab_order_item_id'], $item['prescription_item_id'],
            ];
        }

        $this->db->createCommand()->batchInsert('invoice_items', [
            'invoice_id', 'visit_id', 'item_type', 'description', 'quantity', 'unit_price',
            'visit_procedure_id', 'lab_order_item_id', 'prescription_item_id',
        ], $rows)->execute();
    }

    private function estimate(array $visit): array
    {
        $rows = $this->projectedItems($visit);

        return [
            'invoice' => null,
            'total_amount' => (string) $rows[0]['total_amount'],
            'items' => array_map($this->line(...), $rows),
        ];
    }

    private function projectedItems(array $visit): array
    {
        return $this->db->createCommand(<<<'SQL'
            SELECT item_type, description, quantity, unit_price, visit_procedure_id, lab_order_item_id, prescription_item_id,
                quantity * unit_price AS subtotal, SUM(quantity * unit_price) OVER () AS total_amount
            FROM (
                SELECT 0 AS position, 0::bigint AS line_id, 'registration' AS item_type, 'Pendaftaran rawat jalan' AS description,
                    1 AS quantity, CAST(:registration_fee AS numeric) AS unit_price,
                    NULL::bigint AS visit_procedure_id, NULL::bigint AS lab_order_item_id, NULL::bigint AS prescription_item_id
                UNION ALL
                SELECT 1, item.id, 'procedure', master.name, item.quantity, item.unit_price, item.id, NULL, NULL
                FROM visit_procedures AS item
                JOIN medical_procedures AS master ON master.id = item.procedure_id
                WHERE item.visit_id = :procedure_visit_id AND item.cancelled_at IS NULL
                UNION ALL
                SELECT 2, item.id, 'lab', test.name, 1, item.unit_price, NULL, item.id, NULL
                FROM lab_order_items AS item
                JOIN lab_orders AS lab ON lab.id = item.lab_order_id
                JOIN lab_tests AS test ON test.id = item.lab_test_id
                WHERE item.visit_id = :lab_visit_id AND lab.status = 'completed'
                UNION ALL
                SELECT 3, item.id, 'medicine', medicine.name, item.quantity, item.unit_price, NULL, NULL, item.id
                FROM prescription_items AS item
                JOIN prescriptions AS rx ON rx.id = item.prescription_id
                JOIN medicines AS medicine ON medicine.id = item.medicine_id
                WHERE item.visit_id = :prescription_visit_id AND rx.status = 'dispensed'
            ) AS components
            ORDER BY position, line_id
            SQL, [
                ':registration_fee' => $visit['registration_fee'],
                ':procedure_visit_id' => $visit['id'],
                ':lab_visit_id' => $visit['id'],
                ':prescription_visit_id' => $visit['id'],
            ])->queryAll();
    }

    private function line(array $row): array
    {
        return [
            'item_type' => $row['item_type'],
            'description' => $row['description'],
            'quantity' => (int) $row['quantity'],
            'unit_price' => (string) $row['unit_price'],
            'subtotal' => (string) $row['subtotal'],
        ];
    }
}
