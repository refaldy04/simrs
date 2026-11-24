<?php

declare(strict_types=1);

namespace app\registration;

use yii\db\Connection;
use yii\db\Query;
use yii\web\ConflictHttpException;
use yii\web\NotFoundHttpException;
use yii\web\UnprocessableEntityHttpException;

final class RegistrationData
{
    public const STATUSES = ['waiting', 'in_examination', 'awaiting_billing', 'completed', 'cancelled'];

    public function __construct(private readonly Connection $db)
    {
    }

    public function patients(string $term, int $page, int $pageSize): array
    {
        $query = (new Query())
            ->select(['id', 'medical_record_no', 'full_name', 'birth_date'])
            ->from('patients')
            ->where(['is_active' => true])
            ->andWhere([
                'or',
                ['ilike', 'full_name', $term],
                ['ilike', 'medical_record_no', $term],
                ['national_id' => $term],
            ])
            ->orderBy(['full_name' => SORT_ASC, 'id' => SORT_ASC]);

        return $this->page($query, $page, $pageSize);
    }

    public function history(string $patientId, int $page, int $pageSize): array
    {
        if (!(new Query())->from('patients')->where(['id' => $patientId])->exists($this->db)) {
            throw new NotFoundHttpException('Pasien tidak ditemukan.');
        }

        $query = $this->visitQuery()
            ->where(['visit.patient_id' => $patientId])
            ->orderBy(['visit.visit_date' => SORT_DESC, 'visit.id' => SORT_DESC]);

        return $this->page($query, $page, $pageSize);
    }

    public function schedules(string $date, ?string $doctorUserId): array
    {
        $query = $this->scheduleQuery()
            ->andWhere(['schedule.practice_date' => $date])
            ->orderBy(['clinic.name' => SORT_ASC, 'schedule.starts_at' => SORT_ASC, 'schedule.id' => SORT_ASC]);
        if ($doctorUserId !== null) {
            $query->andWhere(['staff.user_id' => $doctorUserId]);
        }

        return ['date' => $date, 'items' => array_map($this->serialize(...), $query->all($this->db))];
    }

    public function queue(
        string $date,
        ?string $clinicId,
        string $status,
        ?string $doctorUserId,
        int $page,
        int $pageSize,
    ): array {
        $query = $this->visitQuery()->where(['visit.visit_date' => $date]);
        if ($doctorUserId !== null) {
            $query->andWhere(['staff.user_id' => $doctorUserId]);
        }
        $clinics = (clone $query)
            ->select(['id' => 'clinic.id', 'name' => 'clinic.name'])
            ->distinct()
            ->orderBy(['name' => SORT_ASC, 'id' => SORT_ASC])
            ->all($this->db);

        $query->andFilterWhere(['visit.clinic_id' => $clinicId]);
        if ($status !== 'all') {
            $query->andWhere(['visit.status' => $status]);
        }
        $query->orderBy(['clinic.name' => SORT_ASC, 'clinic.id' => SORT_ASC, 'visit.queue_number' => SORT_ASC]);

        return $this->page($query, $page, $pageSize) + [
            'date' => $date,
            'clinics' => array_map($this->serialize(...), $clinics),
        ];
    }

    public function register(string $patientId, string $scheduleId, string $userId): array
    {
        return $this->db->transaction(function (Connection $db) use ($patientId, $scheduleId, $userId): array {
            $patient = $db->createCommand(
                'SELECT id FROM patients WHERE id = :id AND is_active FOR SHARE',
                [':id' => $patientId],
            )->queryScalar();
            if ($patient === false) {
                throw new UnprocessableEntityHttpException('Pilih pasien yang aktif.');
            }

            $command = $this->scheduleQuery()->andWhere(['schedule.id' => $scheduleId])->createCommand($db);
            $schedule = $db->createCommand(
                $command->getSql() . ' FOR SHARE OF schedule, clinic, doctor, staff',
                $command->params,
            )->queryOne();
            if ($schedule === false) {
                throw new UnprocessableEntityHttpException('Jadwal sudah tidak tersedia. Muat ulang pilihan jadwal.');
            }

            $queueNumber = $db->createCommand(<<<'SQL'
                INSERT INTO visit_queue_counters (clinic_id, visit_date, last_number)
                VALUES (:clinic_id, :visit_date, 1)
                ON CONFLICT (clinic_id, visit_date) DO UPDATE
                    SET last_number = visit_queue_counters.last_number + 1
                RETURNING last_number
                SQL, [
                    ':clinic_id' => $schedule['clinic_id'],
                    ':visit_date' => $schedule['practice_date'],
                ])->queryScalar();

            $id = $db->createCommand(<<<'SQL'
                INSERT INTO visits (
                    patient_id, schedule_id, clinic_id, visit_date,
                    queue_number, registration_fee, registered_by
                )
                VALUES (
                    :patient_id, :schedule_id, :clinic_id, :visit_date,
                    :queue_number, :registration_fee, :registered_by
                )
                ON CONFLICT (patient_id, clinic_id, visit_date) WHERE status <> 'cancelled'
                    DO NOTHING
                RETURNING id
                SQL, [
                    ':patient_id' => $patientId,
                    ':schedule_id' => $scheduleId,
                    ':clinic_id' => $schedule['clinic_id'],
                    ':visit_date' => $schedule['practice_date'],
                    ':queue_number' => $queueNumber,
                    ':registration_fee' => $schedule['registration_fee'],
                    ':registered_by' => $userId,
                ])->queryScalar();
            if ($id === false) {
                throw new ConflictHttpException('Pasien sudah terdaftar di poli ini pada tanggal tersebut.');
            }

            return $this->visit((string) $id);
        });
    }

    public function cancel(string $id, string $userId): array
    {
        return $this->db->transaction(function (Connection $db) use ($id, $userId): array {
            $changed = $db->createCommand()->update('visits', ['status' => 'cancelled'], [
                'id' => $id,
                'status' => 'waiting',
            ])->execute();
            $visit = $this->visit($id);

            if ($changed === 0 && $visit['status'] !== 'cancelled') {
                throw new ConflictHttpException('Pembatalan hanya tersedia untuk antrean yang menunggu.');
            }
            if ($changed === 1) {
                $db->createCommand()->insert('audit_logs', [
                    'visit_id' => $id,
                    'actor_user_id' => $userId,
                    'entity_type' => 'visit',
                    'entity_id' => $id,
                    'action' => 'cancel',
                    'before_data' => '{"status":"waiting"}',
                    'after_data' => '{"status":"cancelled"}',
                ])->execute();
            }

            return $visit;
        });
    }

    private function scheduleQuery(): Query
    {
        return (new Query())
            ->select([
                'schedule.id', 'schedule.clinic_id', 'schedule.doctor_id', 'schedule.practice_date',
                'schedule.starts_at', 'schedule.ends_at', 'clinic.registration_fee',
                'clinic_name' => 'clinic.name', 'doctor_name' => 'staff.full_name',
            ])
            ->from(['schedule' => 'doctor_schedules'])
            ->innerJoin(['clinic' => 'clinics'], 'clinic.id = schedule.clinic_id')
            ->innerJoin(['doctor' => 'doctors'], 'doctor.staff_id = schedule.doctor_id')
            ->innerJoin(['staff' => 'medical_staff'], 'staff.id = doctor.staff_id')
            ->where([
                'schedule.is_active' => true,
                'clinic.is_active' => true,
                'doctor.is_active' => true,
                'staff.is_active' => true,
            ]);
    }

    private function visitQuery(): Query
    {
        return (new Query())
            ->select([
                'visit.id', 'visit.patient_id', 'visit.clinic_id', 'visit.schedule_id',
                'visit.visit_date', 'visit.queue_number', 'visit.status', 'visit.registration_fee',
                'visit.registered_at', 'schedule.doctor_id', 'schedule.starts_at', 'schedule.ends_at',
                'patient.medical_record_no', 'patient_name' => 'patient.full_name',
                'clinic_name' => 'clinic.name', 'doctor_name' => 'staff.full_name',
            ])
            ->from(['visit' => 'visits'])
            ->innerJoin(['patient' => 'patients'], 'patient.id = visit.patient_id')
            ->innerJoin(['clinic' => 'clinics'], 'clinic.id = visit.clinic_id')
            ->innerJoin(['schedule' => 'doctor_schedules'], 'schedule.id = visit.schedule_id')
            ->innerJoin(['staff' => 'medical_staff'], 'staff.id = schedule.doctor_id');
    }

    private function visit(string $id): array
    {
        $visit = $this->visitQuery()->where(['visit.id' => $id])->one($this->db);
        if ($visit === false) {
            throw new NotFoundHttpException('Kunjungan tidak ditemukan.');
        }

        return $this->serialize($visit);
    }

    private function page(Query $query, int $page, int $pageSize): array
    {
        $total = (int) (clone $query)->orderBy([])->count('*', $this->db);
        $rows = $query->limit($pageSize)->offset(($page - 1) * $pageSize)->all($this->db);

        return [
            'items' => array_map($this->serialize(...), $rows),
            'page' => $page,
            'page_size' => $pageSize,
            'total' => $total,
        ];
    }

    private function serialize(array $row): array
    {
        foreach (['id', 'patient_id', 'clinic_id', 'doctor_id', 'schedule_id', 'registration_fee'] as $key) {
            if (isset($row[$key])) {
                $row[$key] = (string) $row[$key];
            }
        }
        if (isset($row['queue_number'])) {
            $row['queue_number'] = (int) $row['queue_number'];
        }

        return $row;
    }
}
