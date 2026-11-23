<?php

declare(strict_types=1);

use yii\db\Migration;

final class m261123_000002_create_outpatient_workflow extends Migration
{
    public function safeUp(): void
    {
        $this->execute(<<<'SQL'
            CREATE TABLE visit_queue_counters (
                clinic_id BIGINT NOT NULL REFERENCES clinics (id),
                visit_date DATE NOT NULL,
                last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
                PRIMARY KEY (clinic_id, visit_date)
            )
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE visits (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                patient_id BIGINT NOT NULL REFERENCES patients (id),
                schedule_id BIGINT NOT NULL,
                clinic_id BIGINT NOT NULL,
                visit_date DATE NOT NULL,
                queue_number INTEGER NOT NULL CHECK (queue_number > 0),
                status VARCHAR(20) NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting', 'in_examination', 'awaiting_billing', 'completed', 'cancelled')),
                registration_fee NUMERIC(14, 2) NOT NULL
                    CHECK (registration_fee >= 0 AND registration_fee <> 'NaN'),
                registered_by BIGINT NOT NULL REFERENCES users (id),
                registered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (schedule_id, clinic_id, visit_date)
                    REFERENCES doctor_schedules (id, clinic_id, practice_date),
                FOREIGN KEY (clinic_id, visit_date) REFERENCES visit_queue_counters (clinic_id, visit_date),
                UNIQUE (clinic_id, visit_date, queue_number)
            )
            SQL);
        $this->execute(<<<'SQL'
            CREATE UNIQUE INDEX visits_patient_clinic_date_active_uq
            ON visits (patient_id, clinic_id, visit_date) WHERE status <> 'cancelled'
            SQL);
        $this->createIndex('visits_patient_date_idx', 'visits', ['patient_id', 'visit_date']);
        $this->createIndex('visits_date_clinic_idx', 'visits', ['visit_date', 'clinic_id']);
        $this->createIndex('visits_schedule_idx', 'visits', 'schedule_id');

        $this->execute(<<<'SQL'
            CREATE TABLE examinations (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                visit_id BIGINT NOT NULL UNIQUE REFERENCES visits (id),
                examiner_id BIGINT NOT NULL REFERENCES doctors (staff_id),
                chief_complaint TEXT NOT NULL,
                anamnesis TEXT,
                physical_findings TEXT,
                systolic_bp SMALLINT CHECK (systolic_bp > 0),
                diastolic_bp SMALLINT CHECK (diastolic_bp > 0),
                pulse_rate SMALLINT CHECK (pulse_rate > 0),
                respiratory_rate SMALLINT CHECK (respiratory_rate > 0),
                temperature_c NUMERIC(4, 1) CHECK (temperature_c > 0 AND temperature_c <> 'NaN'),
                examined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE diagnoses (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                examination_id BIGINT NOT NULL REFERENCES examinations (id),
                code VARCHAR(20),
                description TEXT NOT NULL,
                is_primary BOOLEAN NOT NULL DEFAULT FALSE,
                UNIQUE (examination_id, code)
            )
            SQL);
        $this->execute(<<<'SQL'
            CREATE UNIQUE INDEX diagnoses_primary_per_exam_uq
            ON diagnoses (examination_id) WHERE is_primary
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE visit_procedures (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                visit_id BIGINT NOT NULL REFERENCES visits (id),
                procedure_id BIGINT NOT NULL REFERENCES medical_procedures (id),
                performed_by BIGINT NOT NULL REFERENCES doctors (staff_id),
                quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
                unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0 AND unit_price <> 'NaN'),
                performed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                cancelled_at TIMESTAMPTZ CHECK (cancelled_at >= performed_at),
                UNIQUE (id, visit_id)
            )
            SQL);
        $this->createIndex('visit_procedures_visit_idx', 'visit_procedures', 'visit_id');

        $this->execute(<<<'SQL'
            CREATE TABLE prescriptions (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                visit_id BIGINT NOT NULL REFERENCES visits (id),
                prescribed_by BIGINT NOT NULL REFERENCES doctors (staff_id),
                status VARCHAR(12) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'dispensed', 'cancelled')),
                prescribed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                dispensed_by BIGINT REFERENCES users (id),
                dispensed_at TIMESTAMPTZ CHECK (dispensed_at >= prescribed_at),
                CHECK ((status = 'dispensed') = (dispensed_by IS NOT NULL)),
                CHECK ((status = 'dispensed') = (dispensed_at IS NOT NULL)),
                UNIQUE (id, visit_id)
            )
            SQL);
        $this->createIndex('prescriptions_visit_idx', 'prescriptions', 'visit_id');
        $this->createIndex('prescriptions_status_time_idx', 'prescriptions', ['status', 'prescribed_at']);

        $this->execute(<<<'SQL'
            CREATE TABLE prescription_items (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                prescription_id BIGINT NOT NULL,
                visit_id BIGINT NOT NULL,
                medicine_id BIGINT NOT NULL REFERENCES medicines (id),
                dose VARCHAR(100) NOT NULL,
                frequency VARCHAR(100) NOT NULL,
                quantity INTEGER NOT NULL CHECK (quantity > 0),
                unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0 AND unit_price <> 'NaN'),
                FOREIGN KEY (prescription_id, visit_id) REFERENCES prescriptions (id, visit_id),
                UNIQUE (id, visit_id),
                UNIQUE (id, medicine_id)
            )
            SQL);
        $this->createIndex('prescription_items_prescription_idx', 'prescription_items', 'prescription_id');

        $this->execute(<<<'SQL'
            CREATE TABLE medicine_stock_movements (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                medicine_id BIGINT NOT NULL REFERENCES medicines (id),
                prescription_item_id BIGINT UNIQUE,
                movement_type VARCHAR(12) NOT NULL
                    CHECK (movement_type IN ('receipt', 'dispense', 'adjustment')),
                quantity_delta INTEGER NOT NULL CHECK (quantity_delta <> 0),
                recorded_by BIGINT NOT NULL REFERENCES users (id),
                recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                notes TEXT,
                CHECK ((movement_type = 'dispense') = (prescription_item_id IS NOT NULL)),
                CHECK (movement_type <> 'dispense' OR quantity_delta < 0),
                CHECK (movement_type <> 'receipt' OR quantity_delta > 0),
                FOREIGN KEY (prescription_item_id, medicine_id) REFERENCES prescription_items (id, medicine_id)
            )
            SQL);
        $this->createIndex('medicine_stock_movements_time_idx', 'medicine_stock_movements', ['recorded_at', 'medicine_id']);

        $this->execute(<<<'SQL'
            CREATE TABLE lab_orders (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                visit_id BIGINT NOT NULL REFERENCES visits (id),
                ordered_by BIGINT NOT NULL REFERENCES doctors (staff_id),
                status VARCHAR(12) NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested', 'in_progress', 'completed', 'cancelled')),
                clinical_notes TEXT,
                ordered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMPTZ CHECK (completed_at >= ordered_at),
                CHECK ((status = 'completed') = (completed_at IS NOT NULL)),
                UNIQUE (id, visit_id)
            )
            SQL);
        $this->createIndex('lab_orders_visit_idx', 'lab_orders', 'visit_id');
        $this->createIndex('lab_orders_status_time_idx', 'lab_orders', ['status', 'ordered_at']);

        $this->execute(<<<'SQL'
            CREATE TABLE lab_order_items (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                lab_order_id BIGINT NOT NULL,
                visit_id BIGINT NOT NULL,
                lab_test_id BIGINT NOT NULL REFERENCES lab_tests (id),
                unit_price NUMERIC(14, 2) NOT NULL CHECK (unit_price >= 0 AND unit_price <> 'NaN'),
                FOREIGN KEY (lab_order_id, visit_id) REFERENCES lab_orders (id, visit_id),
                UNIQUE (lab_order_id, lab_test_id),
                UNIQUE (id, visit_id)
            )
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE lab_results (
                lab_order_item_id BIGINT PRIMARY KEY REFERENCES lab_order_items (id),
                result_value TEXT NOT NULL,
                unit VARCHAR(30),
                reference_range VARCHAR(120),
                notes TEXT,
                entered_by BIGINT NOT NULL REFERENCES users (id),
                entered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            SQL);
    }

    public function safeDown(): void
    {
        $this->execute(<<<'SQL'
            DROP TABLE lab_results, lab_order_items, lab_orders, medicine_stock_movements,
                prescription_items, prescriptions, visit_procedures, diagnoses,
                examinations, visits, visit_queue_counters
            SQL);
    }
}
