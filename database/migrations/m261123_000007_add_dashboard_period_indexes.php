<?php

declare(strict_types=1);

use yii\db\Migration;

final class m261123_000007_add_dashboard_period_indexes extends Migration
{
    public function safeUp(): void
    {
        $this->createIndex('invoices_issued_at_idx', 'invoices', ['issued_at', 'id']);
        $this->execute(<<<'SQL'
            CREATE INDEX visit_procedures_active_time_idx ON visit_procedures (performed_at)
            WHERE cancelled_at IS NULL
            SQL);
    }

    public function safeDown(): void
    {
        $this->dropIndex('visit_procedures_active_time_idx', 'visit_procedures');
        $this->dropIndex('invoices_issued_at_idx', 'invoices');
    }
}
