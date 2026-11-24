<?php

declare(strict_types=1);

namespace app\master;

use DateTimeImmutable;
use DateTimeZone;
use yii\db\Connection;
use yii\db\Expression;
use yii\db\Query;
use yii\web\ConflictHttpException;
use yii\web\NotFoundHttpException;

final class MasterData
{
    private string $table;
    private string $primaryKey;

    public function __construct(
        private readonly Connection $db,
        private readonly string $key,
        private readonly array $definition,
    ) {
        $this->table = $definition['table'];
        $this->primaryKey = $definition['primary_key'] ?? 'id';
    }

    public function page(string $term, string $status, int $page, int $pageSize): array
    {
        $query = $this->query();
        if ($status !== 'all') {
            $query->andWhere(['record.is_active' => $status === 'active']);
        }
        if ($term !== '') {
            $search = ['or'];
            foreach ($this->definition['search'] as $column) {
                $search[] = ['ilike', $column, $term];
            }
            if ($this->key === 'doctor-schedules') {
                $search[] = ['ilike', new Expression('CAST(record.practice_date AS TEXT)'), $term];
            }
            $query->andWhere($search);
        }

        $total = (int) (clone $query)->count('*', $this->db);
        $sort = ($this->definition['sort'] ?? []) + ['record.' . $this->primaryKey => SORT_DESC];
        $items = $query->select($this->projection(array_keys($this->definition['columns'])))
            ->orderBy($sort)
            ->limit($pageSize)
            ->offset(($page - 1) * $pageSize)
            ->all($this->db);

        return [
            'items' => array_map($this->serialize(...), $items),
            'page' => $page,
            'page_size' => $pageSize,
            'total' => $total,
        ];
    }

    public function view(string $id): array
    {
        $fields = array_keys($this->definition['fields'] + ($this->definition['aliases'] ?? []));
        $row = $this->query()->select($this->projection($fields))
            ->where(['record.' . $this->primaryKey => $id])
            ->one($this->db);
        if ($row === false) {
            throw new NotFoundHttpException('Data tidak ditemukan.');
        }

        return $this->serialize($row);
    }

    public function options(): array
    {
        $options = [];
        foreach ($this->definition['fields'] as $key => $field) {
            if ($field['type'] !== 'relation') {
                continue;
            }
            $rows = MasterCatalog::lookup($field['lookup'])->orderBy(['label' => SORT_ASC, 'value' => SORT_ASC])
                ->all($this->db);
            $options[$key] = array_map(static function (array $row): array {
                $row['value'] = (string) $row['value'];
                return $row;
            }, $rows);
        }

        return $options;
    }

    public function create(array $body, string $actorId): array
    {
        $values = MasterInput::validate($this->definition['fields'], $body, true);

        return $this->db->transaction(function (Connection $db) use ($values, $actorId): array {
            $this->validateChanges($values, null);
            $params = [];
            $sql = $db->getQueryBuilder()->insert($this->table, $values, $params)
                . ' RETURNING ' . $db->quoteColumnName($this->primaryKey);
            $id = (string) $db->createCommand($sql, $params)->queryScalar();
            if ($this->key === 'medicines' && $values['stock_quantity'] > 0) {
                $this->recordStockMovement($id, $values['stock_quantity'], $actorId, 'receipt');
            }

            return $this->view($id);
        });
    }

    public function update(string $id, array $body, string $actorId): array
    {
        $fields = $this->definition['fields'];
        if ($this->key === 'medicines') {
            $fields['expected_stock_quantity'] = ['label' => 'Stok sebelumnya', 'type' => 'integer', 'required' => true];
        }
        $values = MasterInput::validate($fields, $body, false);
        $expectedStock = $values['expected_stock_quantity'] ?? null;
        unset($values['expected_stock_quantity']);

        return $this->db->transaction(function (Connection $db) use ($id, $values, $expectedStock, $actorId): array {
            $current = $this->lockRecord($id);
            $this->validateChanges($values, $current);

            $stockDelta = 0;
            if (isset($values['stock_quantity'])) {
                $stockDelta = $values['stock_quantity'] - (int) $current['stock_quantity'];
                if ($stockDelta !== 0 && $expectedStock !== (int) $current['stock_quantity']) {
                    throw new ConflictHttpException('Stok sudah berubah. Muat ulang data sebelum menyesuaikan stok.');
                }
            }

            if ($values !== []) {
                $db->createCommand()->update($this->table, $values, [$this->primaryKey => $id])->execute();
            }
            if ($stockDelta !== 0) {
                $this->recordStockMovement($id, $stockDelta, $actorId, 'adjustment');
            }

            return $this->view($id);
        });
    }

    public function archive(string $id): void
    {
        $updated = $this->db->createCommand()->update($this->table, ['is_active' => false], [
            $this->primaryKey => $id,
        ])->execute();
        if ($updated === 0) {
            throw new NotFoundHttpException('Data tidak ditemukan.');
        }
    }

    private function query(): Query
    {
        $query = (new Query())->from(['record' => $this->table]);
        foreach ($this->definition['joins'] ?? [] as [$table, $condition]) {
            $query->leftJoin($table, $condition);
        }

        return $query;
    }

    private function projection(array $fields): array
    {
        $columns = ['id' => 'record.' . $this->primaryKey, 'is_active' => 'record.is_active'];
        foreach ($fields as $field) {
            $columns[$field] = $this->definition['aliases'][$field] ?? 'record.' . $field;
        }

        return $columns;
    }

    private function serialize(array $row): array
    {
        $row['id'] = (string) $row['id'];
        $row['is_active'] = in_array($row['is_active'], [true, 1, '1', 't'], true);
        foreach ($this->definition['fields'] as $key => $field) {
            if (isset($row[$key])) {
                $row[$key] = match ($field['type']) {
                    'relation', 'money' => (string) $row[$key],
                    'integer' => (int) $row[$key],
                    default => $row[$key],
                };
            }
        }

        return $row;
    }

    private function lockRecord(string $id): array
    {
        $table = $this->db->quoteTableName($this->table);
        $primaryKey = $this->db->quoteColumnName($this->primaryKey);
        $row = $this->db->createCommand(
            "SELECT * FROM {$table} WHERE {$primaryKey} = :id FOR UPDATE",
            [':id' => $id],
        )->queryOne();
        if ($row === false) {
            throw new NotFoundHttpException('Data tidak ditemukan.');
        }

        return $row;
    }

    private function validateChanges(array $values, ?array $current): void
    {
        if ($this->key === 'doctor-schedules') {
            $this->validateSchedule($values, $current);
            return;
        }

        if (isset($values['birth_date'])) {
            $today = (new DateTimeImmutable('today', new DateTimeZone('Asia/Jakarta')))->format('Y-m-d');
            if ($values['birth_date'] > $today) {
                throw new InvalidMasterData(['birth_date' => 'Tanggal lahir tidak boleh melewati hari ini.']);
            }
        }

        foreach ($this->definition['fields'] as $key => $field) {
            if ($field['type'] === 'relation' && isset($values[$key]) && $values[$key] !== (string) ($current[$key] ?? '')) {
                $this->validateRelation($key, $values[$key]);
            }
        }
    }

    private function validateRelation(string $key, string $id): void
    {
        $field = $this->definition['fields'][$key];
        $exists = (new Query())->from(['option' => MasterCatalog::lookup($field['lookup'])])
            ->where(['option.value' => $id])->exists($this->db);
        if (!$exists) {
            throw new InvalidMasterData([$key => 'Pilih ' . mb_strtolower($field['label']) . ' yang aktif.']);
        }
    }

    private function validateSchedule(array $values, ?array $current): void
    {
        $next = array_replace($current ?? [], $values);
        $scheduleFields = ['doctor_id', 'clinic_id', 'practice_date', 'starts_at', 'ends_at'];
        $changed = array_filter($scheduleFields, static function (string $field) use ($values, $current): bool {
            return isset($values[$field]) && $values[$field] !== (string) ($current[$field] ?? '');
        });

        if ($current !== null && $changed !== []
            && (new Query())->from('visits')->where(['schedule_id' => $current['id']])->exists($this->db)
        ) {
            throw new ConflictHttpException('Jadwal sudah dipakai kunjungan. Buat sesi baru untuk perubahan jadwal.');
        }
        if ($next['starts_at'] >= $next['ends_at']) {
            throw new InvalidMasterData(['ends_at' => 'Jam selesai harus setelah jam mulai.']);
        }

        $reactivating = ($values['is_active'] ?? false) && !($current['is_active'] ?? true);
        if ($current !== null && $changed === [] && !$reactivating) {
            return;
        }

        // Scheduling writes for the same doctor share one row lock.
        $this->db->createCommand('SELECT staff_id FROM doctors WHERE staff_id = :id FOR UPDATE', [
            ':id' => $next['doctor_id'],
        ])->queryScalar();
        $this->validateRelation('doctor_id', (string) $next['doctor_id']);
        $this->validateRelation('clinic_id', (string) $next['clinic_id']);
        if (!$next['is_active']) {
            return;
        }

        $overlap = (new Query())->from('doctor_schedules')
            ->where(['doctor_id' => $next['doctor_id'], 'practice_date' => $next['practice_date'], 'is_active' => true])
            ->andWhere(['<', 'starts_at', $next['ends_at']])
            ->andWhere(['>', 'ends_at', $next['starts_at']]);
        if ($current !== null) {
            $overlap->andWhere(['<>', 'id', $current['id']]);
        }
        if ($overlap->exists($this->db)) {
            throw new ConflictHttpException('Jadwal dokter bertabrakan dengan sesi aktif pada tanggal yang sama.');
        }
    }

    private function recordStockMovement(string $id, int $delta, string $actorId, string $type): void
    {
        $this->db->createCommand()->insert('medicine_stock_movements', [
            'medicine_id' => $id,
            'quantity_delta' => $delta,
            'recorded_by' => $actorId,
            'movement_type' => $type,
            'notes' => $type === 'receipt' ? 'Stok awal dari master obat' : 'Penyesuaian dari master obat',
        ])->execute();
    }
}
