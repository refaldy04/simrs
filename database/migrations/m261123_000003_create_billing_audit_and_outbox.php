<?php

declare(strict_types=1);

use yii\db\Migration;

final class m261123_000003_create_billing_audit_and_outbox extends Migration
{
    public function safeUp(): void
    {
        $this->execute(<<<'SQL'
            CREATE TABLE invoices (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                visit_id BIGINT NOT NULL UNIQUE REFERENCES visits (id),
                invoice_no VARCHAR(40) NOT NULL UNIQUE,
                issued_by BIGINT NOT NULL REFERENCES users (id),
                issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (id, visit_id)
            )
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE invoice_items (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                invoice_id BIGINT NOT NULL,
                visit_id BIGINT NOT NULL,
                item_type VARCHAR(12) NOT NULL CHECK (item_type IN ('registration', 'procedure', 'lab', 'medicine')),
                description VARCHAR(180) NOT NULL,
                quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
                unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0 AND unit_price <> 'NaN'),
                visit_procedure_id BIGINT UNIQUE,
                lab_order_item_id BIGINT UNIQUE,
                prescription_item_id BIGINT UNIQUE,
                CHECK ((item_type = 'procedure') = (visit_procedure_id IS NOT NULL)),
                CHECK ((item_type = 'lab') = (lab_order_item_id IS NOT NULL)),
                CHECK ((item_type = 'medicine') = (prescription_item_id IS NOT NULL)),
                FOREIGN KEY (invoice_id, visit_id) REFERENCES invoices (id, visit_id),
                FOREIGN KEY (visit_procedure_id, visit_id) REFERENCES visit_procedures (id, visit_id),
                FOREIGN KEY (lab_order_item_id, visit_id) REFERENCES lab_order_items (id, visit_id),
                FOREIGN KEY (prescription_item_id, visit_id) REFERENCES prescription_items (id, visit_id)
            )
            SQL);
        $this->createIndex('invoice_items_invoice_idx', 'invoice_items', 'invoice_id');
        $this->execute(<<<'SQL'
            CREATE UNIQUE INDEX invoice_items_registration_uq
            ON invoice_items (invoice_id) WHERE item_type = 'registration'
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE payments (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                invoice_id BIGINT NOT NULL REFERENCES invoices (id),
                receipt_no VARCHAR(40) NOT NULL UNIQUE,
                idempotency_key UUID NOT NULL UNIQUE,
                method VARCHAR(12) NOT NULL CHECK (method IN ('cash', 'non_cash')),
                amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0 AND amount <> 'NaN'),
                external_reference VARCHAR(100),
                received_by BIGINT NOT NULL REFERENCES users (id),
                paid_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            SQL);
        $this->createIndex('payments_invoice_time_idx', 'payments', ['invoice_id', 'paid_at']);
        $this->createIndex('payments_time_idx', 'payments', 'paid_at');

        $this->execute(<<<'SQL'
            CREATE VIEW invoice_balances AS
            SELECT invoice.id AS invoice_id,
                invoice.visit_id,
                charge.total_amount,
                receipt.paid_amount,
                charge.total_amount - receipt.paid_amount AS balance_amount,
                CASE
                    WHEN receipt.paid_amount >= charge.total_amount THEN 'paid'
                    WHEN receipt.paid_amount > 0 THEN 'partial'
                    ELSE 'unpaid'
                END AS status
            FROM invoices AS invoice
            CROSS JOIN LATERAL (
                SELECT COALESCE(SUM(quantity * unit_price), 0) AS total_amount
                FROM invoice_items
                WHERE invoice_id = invoice.id
            ) AS charge
            CROSS JOIN LATERAL (
                SELECT COALESCE(SUM(amount), 0) AS paid_amount
                FROM payments
                WHERE invoice_id = invoice.id
            ) AS receipt
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE audit_logs (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                visit_id BIGINT NOT NULL REFERENCES visits (id),
                actor_user_id BIGINT NOT NULL REFERENCES users (id),
                entity_type VARCHAR(50) NOT NULL,
                entity_id BIGINT NOT NULL,
                action VARCHAR(30) NOT NULL,
                before_data JSONB,
                after_data JSONB,
                reason TEXT,
                occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CHECK (before_data IS NOT NULL OR after_data IS NOT NULL)
            )
            SQL);
        $this->createIndex('audit_logs_visit_time_idx', 'audit_logs', ['visit_id', 'occurred_at']);

        $this->execute(<<<'SQL'
            CREATE TABLE integration_outbox (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                event_key UUID NOT NULL UNIQUE,
                lab_order_id BIGINT NOT NULL REFERENCES lab_orders (id),
                event_type VARCHAR(80) NOT NULL,
                payload JSONB NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
                attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                published_at TIMESTAMPTZ,
                last_error TEXT
            )
            SQL);
        $this->execute(<<<'SQL'
            CREATE INDEX integration_outbox_pending_idx
            ON integration_outbox (next_attempt_at, id) WHERE published_at IS NULL
            SQL);
    }

    public function safeDown(): void
    {
        $this->execute('DROP VIEW invoice_balances');
        $this->execute('DROP TABLE integration_outbox, audit_logs, payments, invoice_items, invoices');
    }
}
