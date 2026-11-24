<?php

declare(strict_types=1);

namespace app\examination;

use app\registration\RegistrationData;
use yii\db\Connection;
use yii\db\Expression;
use yii\db\Query;
use yii\db\Transaction;
use yii\web\ConflictHttpException;

final class ExaminationData
{
    private readonly RegistrationData $registration;

    public function __construct(private readonly Connection $db)
    {
        $this->registration = new RegistrationData($db);
    }

    public function view(string $visitId, string $userId): array
    {
        return $this->db->transaction(function () use ($visitId, $userId): array {
            $visit = $this->visit($visitId, $userId);

            return $this->context($visit, $this->examination($visitId));
        }, Transaction::REPEATABLE_READ);
    }

    public function history(string $visitId, string $userId, int $page, int $pageSize): array
    {
        return $this->db->transaction(function () use ($visitId, $userId, $page, $pageSize): array {
            $visit = $this->visit($visitId, $userId);
            $query = $this->examinationQuery()
                ->addSelect(['visit.visit_date', 'clinic_name' => 'clinic.name'])
                ->innerJoin(['visit' => 'visits'], 'visit.id = exam.visit_id')
                ->innerJoin(['clinic' => 'clinics'], 'clinic.id = visit.clinic_id')
                ->where(['visit.patient_id' => $visit['patient_id']])
                ->andWhere(['<>', 'visit.status', 'cancelled']);
            $total = (int) (clone $query)->count('*', $this->db);
            $rows = $query
                ->orderBy(['visit.visit_date' => SORT_DESC, 'exam.examined_at' => SORT_DESC, 'exam.id' => SORT_DESC])
                ->limit($pageSize)
                ->offset(($page - 1) * $pageSize)
                ->all($this->db);

            return [
                'items' => array_map($this->serialize(...), $rows),
                'page' => $page,
                'page_size' => $pageSize,
                'total' => $total,
            ];
        }, Transaction::REPEATABLE_READ);
    }

    public function save(string $visitId, string $userId, array $input): array
    {
        return $this->db->transaction(function () use ($visitId, $userId, $input): array {
            $visit = $this->visit($visitId, $userId, lock: true);
            $before = $this->examination($visitId);
            if ($input['expected_updated_at'] !== ($before['updated_at'] ?? null)) {
                throw new ConflictHttpException('Pemeriksaan sudah berubah. Muat ulang data sebelum menyimpan.');
            }

            $finish = $input['finish'];
            $status = $visit['status'];
            $inProgress = in_array($status, ['waiting', 'in_examination'], true);
            if ($finish && !$inProgress) {
                throw new ConflictHttpException('Pemeriksaan kunjungan ini sudah selesai.');
            }

            $nextStatus = $status;
            if ($inProgress) {
                $nextStatus = $finish ? 'awaiting_billing' : 'in_examination';
            }

            $fields = $input['fields'];
            $diagnoses = $input['diagnoses'];
            $diagnosesChanged = $diagnoses !== ($before['diagnoses'] ?? []);
            $dataChanged = $before === null
                || array_replace($fields, array_intersect_key($before, $fields)) !== $fields
                || $diagnosesChanged;
            if (!$dataChanged && $status === $nextStatus) {
                return $this->context($visit, $before);
            }

            if (in_array($nextStatus, ['awaiting_billing', 'completed'], true) && $diagnoses === []) {
                throw new InvalidExaminationInput(['diagnoses' => 'Isi diagnosis utama untuk pemeriksaan ini.']);
            }
            if ($dataChanged && $this->requiresReason($visit) && $input['reason'] === null) {
                throw new InvalidExaminationInput(['reason' => 'Isi alasan perubahan pemeriksaan.']);
            }

            $examId = $this->writeExamination($visit, $before, $fields);
            if ($diagnosesChanged) {
                $this->writeDiagnoses($examId, $diagnoses);
            }
            if ($status !== $nextStatus) {
                $this->db->createCommand()->update('visits', ['status' => $nextStatus], ['id' => $visitId])->execute();
            }

            $after = $this->examination($visitId);
            $this->db->createCommand()->insert('audit_logs', [
                'visit_id' => $visitId,
                'actor_user_id' => $userId,
                'entity_type' => 'examination',
                'entity_id' => $examId,
                'action' => $finish ? 'finish' : ($before === null ? 'create' : 'update'),
                'before_data' => ['status' => $status, 'examination' => $before],
                'after_data' => ['status' => $nextStatus, 'examination' => $after],
                'reason' => $input['reason'],
            ])->execute();

            $visit['status'] = $nextStatus;

            return $this->context($visit, $after);
        });
    }

    private function visit(string $visitId, string $userId, bool $lock = false): array
    {
        $visit = $this->registration->assignedVisit($visitId, $userId, $lock);
        if ($visit['status'] === 'cancelled') {
            throw new ConflictHttpException('Kunjungan yang dibatalkan tidak tersedia untuk pemeriksaan.');
        }

        return $visit;
    }

    private function context(array $visit, ?array $exam): array
    {
        return [
            'visit' => $visit,
            'examination' => $exam,
            'requires_revision_reason' => $this->requiresReason($visit),
        ];
    }

    private function requiresReason(array $visit): bool
    {
        return in_array($visit['status'], ['awaiting_billing', 'completed'], true)
            || (new Query())->from('invoices')->where(['visit_id' => $visit['id']])->exists($this->db);
    }

    private function examinationQuery(): Query
    {
        $diagnoses = new Expression(<<<'SQL'
            (SELECT COALESCE(json_agg(
                json_build_object('code', dx.code, 'description', dx.description, 'is_primary', dx.is_primary)
                ORDER BY dx.is_primary DESC, dx.id ASC
            ), '[]'::json) FROM diagnoses AS dx WHERE dx.examination_id = exam.id)
            SQL);

        return (new Query())
            ->select(['exam.*', 'examiner_name' => 'staff.full_name', 'diagnoses' => $diagnoses])
            ->from(['exam' => 'examinations'])
            ->innerJoin(['staff' => 'medical_staff'], 'staff.id = exam.examiner_id');
    }

    private function examination(string $visitId): ?array
    {
        $row = $this->examinationQuery()->where(['exam.visit_id' => $visitId])->one($this->db);

        return $row === false ? null : $this->serialize($row);
    }

    private function serialize(array $row): array
    {
        foreach (['id', 'visit_id', 'examiner_id', 'temperature_c'] as $field) {
            if ($row[$field] !== null) {
                $row[$field] = (string) $row[$field];
            }
        }
        foreach (ExaminationInput::INTEGER_FIELDS as $field) {
            if ($row[$field] !== null) {
                $row[$field] = (int) $row[$field];
            }
        }
        $row['diagnoses'] = json_decode($row['diagnoses'], true, flags: JSON_THROW_ON_ERROR);

        return $row;
    }

    private function writeExamination(array $visit, ?array $before, array $fields): string
    {
        if ($before === null) {
            $insert = $this->db->createCommand()->insert('examinations', $fields + [
                'visit_id' => $visit['id'],
                'examiner_id' => $visit['doctor_id'],
            ]);

            return (string) $this->db->createCommand($insert->getSql() . ' RETURNING id', $insert->params)->queryScalar();
        }

        $this->db->createCommand()->update('examinations', $fields + [
            'updated_at' => new Expression("GREATEST(clock_timestamp(), updated_at + INTERVAL '1 microsecond')"),
        ], ['id' => $before['id']])->execute();

        return $before['id'];
    }

    private function writeDiagnoses(string $examId, array $diagnoses): void
    {
        $this->db->createCommand()->delete('diagnoses', ['examination_id' => $examId])->execute();
        if ($diagnoses === []) {
            return;
        }

        $rows = [];
        foreach ($diagnoses as $diagnosis) {
            $rows[] = [$examId, $diagnosis['code'], $diagnosis['description'], $diagnosis['is_primary']];
        }
        $this->db->createCommand()->batchInsert('diagnoses', ['examination_id', 'code', 'description', 'is_primary'], $rows)->execute();
    }
}
