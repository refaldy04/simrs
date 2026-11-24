<?php

declare(strict_types=1);

namespace app\billing;

use yii\db\Connection;

final class VisitCharges
{
    public function __construct(private readonly Connection $db)
    {
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
            SELECT invoice.id, invoice.invoice_no, balance.total_amount, balance.paid_amount, balance.balance_amount, balance.status
            FROM invoices AS invoice
            JOIN invoice_balances AS balance ON balance.invoice_id = invoice.id
            WHERE invoice.id = :id
            SQL, [':id' => $id])->queryOne();

        return [
            'id' => (string) $invoice['id'],
            'invoice_no' => $invoice['invoice_no'],
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

    private function estimate(array $visit): array
    {
        $rows = $this->db->createCommand(<<<'SQL'
            SELECT item_type, description, quantity, unit_price,
                quantity * unit_price AS subtotal, SUM(quantity * unit_price) OVER () AS total_amount
            FROM (
                SELECT 0::bigint AS line_id, 'registration' AS item_type, 'Pendaftaran rawat jalan' AS description,
                    1 AS quantity, CAST(:registration_fee AS numeric) AS unit_price
                UNION ALL
                SELECT item.id, 'procedure', master.name, item.quantity, item.unit_price
                FROM visit_procedures AS item
                JOIN medical_procedures AS master ON master.id = item.procedure_id
                WHERE item.visit_id = :visit_id AND item.cancelled_at IS NULL
            ) AS components
            ORDER BY line_id
            SQL, [
                ':registration_fee' => $visit['registration_fee'],
                ':visit_id' => $visit['id'],
            ])->queryAll();

        return [
            'invoice' => null,
            'total_amount' => (string) $rows[0]['total_amount'],
            'items' => array_map($this->line(...), $rows),
        ];
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
