<?php

declare(strict_types=1);

use yii\db\Migration;

final class m261123_000005_add_doctor_active_status extends Migration
{
    public function safeUp(): void
    {
        $this->addColumn('doctors', 'is_active', $this->boolean()->notNull()->defaultValue(true));
    }

    public function safeDown(): void
    {
        $this->dropColumn('doctors', 'is_active');
    }
}
