<?php

declare(strict_types=1);

use yii\db\Migration;

final class m261123_000006_add_prescription_idempotency_key extends Migration
{
    public function safeUp(): void
    {
        $this->addColumn('prescriptions', 'idempotency_key', 'UUID');
        $this->createIndex('prescriptions_visit_idempotency_uq', 'prescriptions', ['visit_id', 'idempotency_key'], true);
    }

    public function safeDown(): void
    {
        $this->dropIndex('prescriptions_visit_idempotency_uq', 'prescriptions');
        $this->dropColumn('prescriptions', 'idempotency_key');
    }
}
