<?php

declare(strict_types=1);

use yii\db\Migration;

final class m261123_000001_create_access_and_master_data extends Migration
{
    public function safeUp(): void
    {
        $this->execute(<<<'SQL'
            CREATE TABLE roles (
                code VARCHAR(30) PRIMARY KEY,
                name VARCHAR(80) NOT NULL
            )
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE users (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                role_code VARCHAR(30) NOT NULL REFERENCES roles (code),
                username VARCHAR(64) NOT NULL UNIQUE CHECK (username = lower(btrim(username)) AND username <> ''),
                password_hash VARCHAR(255) NOT NULL,
                full_name VARCHAR(150) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE patients (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                medical_record_no VARCHAR(30) NOT NULL UNIQUE,
                national_id VARCHAR(50) UNIQUE,
                full_name VARCHAR(150) NOT NULL,
                birth_date DATE NOT NULL,
                sex VARCHAR(12) NOT NULL CHECK (sex IN ('female', 'male', 'unspecified')),
                phone VARCHAR(30),
                address TEXT,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE medical_staff (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                user_id BIGINT UNIQUE REFERENCES users (id),
                employee_no VARCHAR(30) NOT NULL UNIQUE,
                full_name VARCHAR(150) NOT NULL,
                profession VARCHAR(60) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE
            )
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE doctors (
                staff_id BIGINT PRIMARY KEY REFERENCES medical_staff (id),
                specialty VARCHAR(100) NOT NULL,
                practice_license_no VARCHAR(64) UNIQUE
            )
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE clinics (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                code VARCHAR(30) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                registration_fee NUMERIC(14, 2) NOT NULL DEFAULT 0
                    CHECK (registration_fee >= 0 AND registration_fee <> 'NaN'),
                is_active BOOLEAN NOT NULL DEFAULT TRUE
            )
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE doctor_schedules (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                doctor_id BIGINT NOT NULL REFERENCES doctors (staff_id),
                clinic_id BIGINT NOT NULL REFERENCES clinics (id),
                practice_date DATE NOT NULL,
                starts_at TIME NOT NULL,
                ends_at TIME NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                CHECK (starts_at < ends_at),
                UNIQUE (doctor_id, practice_date, starts_at),
                UNIQUE (id, clinic_id, practice_date)
            )
            SQL);
        $this->createIndex('doctor_schedules_clinic_date_idx', 'doctor_schedules', ['clinic_id', 'practice_date']);

        $this->execute(<<<'SQL'
            CREATE TABLE medical_procedures (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                code VARCHAR(30) NOT NULL UNIQUE,
                name VARCHAR(120) NOT NULL,
                price NUMERIC(14, 2) NOT NULL CHECK (price >= 0 AND price <> 'NaN'),
                is_active BOOLEAN NOT NULL DEFAULT TRUE
            )
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE medicines (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                code VARCHAR(30) NOT NULL UNIQUE,
                name VARCHAR(120) NOT NULL,
                unit VARCHAR(30) NOT NULL,
                price NUMERIC(14, 2) NOT NULL CHECK (price >= 0 AND price <> 'NaN'),
                stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
                is_active BOOLEAN NOT NULL DEFAULT TRUE
            )
            SQL);

        $this->execute(<<<'SQL'
            CREATE TABLE lab_tests (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                code VARCHAR(30) NOT NULL UNIQUE,
                name VARCHAR(120) NOT NULL,
                price NUMERIC(14, 2) NOT NULL CHECK (price >= 0 AND price <> 'NaN'),
                is_active BOOLEAN NOT NULL DEFAULT TRUE
            )
            SQL);
    }

    public function safeDown(): void
    {
        $this->execute(<<<'SQL'
            DROP TABLE lab_tests, medicines, medical_procedures, doctor_schedules,
                clinics, doctors, medical_staff, patients, users, roles
            SQL);
    }
}
