-- Data fiktif untuk PostgreSQL development. Jalankan setelah migrasi Yii2.
BEGIN;

SELECT pg_advisory_xact_lock(hashtextextended('simrs.demo.seed.v1', 0));

INSERT INTO roles (code, name) VALUES
    ('admin', 'Administrator'),
    ('registration', 'Petugas Pendaftaran'),
    ('doctor', 'Dokter'),
    ('pharmacy', 'Petugas Farmasi'),
    ('laboratory', 'Petugas Laboratorium'),
    ('cashier', 'Kasir')
ON CONFLICT (code) DO NOTHING;

DO $seed$
DECLARE
    demo_date CONSTANT DATE := DATE '2026-11-23';
    demo_hash CONSTANT TEXT := '$2y$12$LZxhwesuIhaFuntIiCsCCeebaVypMLPo5Zmbot6OFRdYF3Z3CNSiq';
    registration_user BIGINT;
    pharmacy_user BIGINT;
    laboratory_user BIGINT;
    cashier_user BIGINT;
    general_doctor BIGINT;
    internal_doctor BIGINT;
    general_clinic BIGINT;
    internal_clinic BIGINT;
    general_schedule BIGINT;
    internal_schedule BIGINT;
    paid_visit BIGINT;
    partial_visit BIGINT;
    unpaid_visit BIGINT;
    active_visit BIGINT;
    paid_exam BIGINT;
    dispensed_prescription BIGINT;
    pending_prescription BIGINT;
    completed_lab_order BIGINT;
    requested_lab_order BIGINT;
    completed_lab_item BIGINT;
    paid_invoice BIGINT;
    partial_invoice BIGINT;
BEGIN
    IF EXISTS (SELECT 1 FROM invoices WHERE invoice_no = 'DEMO-INV-001') THEN
        RAISE NOTICE 'Data demo SIMRS sudah tersedia.';
        RETURN;
    END IF;

    INSERT INTO users (username, role_code, password_hash, full_name)
    SELECT account.username, account.role_code, demo_hash, account.full_name
    FROM (VALUES
        ('demo.admin', 'admin', 'Administrator Demo'),
        ('demo.pendaftaran', 'registration', 'Petugas Pendaftaran Demo'),
        ('demo.dokter.umum', 'doctor', 'Dokter Umum Demo'),
        ('demo.dokter.dalam', 'doctor', 'Dokter Penyakit Dalam Demo'),
        ('demo.farmasi', 'pharmacy', 'Petugas Farmasi Demo'),
        ('demo.lab', 'laboratory', 'Petugas Lab Demo'),
        ('demo.kasir', 'cashier', 'Kasir Demo')
    ) AS account (username, role_code, full_name);

    SELECT id INTO STRICT registration_user FROM users WHERE username = 'demo.pendaftaran';
    SELECT id INTO STRICT pharmacy_user FROM users WHERE username = 'demo.farmasi';
    SELECT id INTO STRICT laboratory_user FROM users WHERE username = 'demo.lab';
    SELECT id INTO STRICT cashier_user FROM users WHERE username = 'demo.kasir';

    INSERT INTO medical_staff (user_id, employee_no, full_name, profession)
    SELECT id, 'DEMO-STF-001', full_name, 'Dokter'
    FROM users WHERE username = 'demo.dokter.umum'
    RETURNING id INTO general_doctor;

    INSERT INTO medical_staff (user_id, employee_no, full_name, profession)
    SELECT id, 'DEMO-STF-002', full_name, 'Dokter'
    FROM users WHERE username = 'demo.dokter.dalam'
    RETURNING id INTO internal_doctor;

    INSERT INTO medical_staff (user_id, employee_no, full_name, profession)
    SELECT account.id, staff.employee_no, account.full_name, staff.profession
    FROM (VALUES
        ('demo.farmasi', 'DEMO-STF-003', 'Farmasi'),
        ('demo.lab', 'DEMO-STF-004', 'Laboratorium')
    ) AS staff (username, employee_no, profession)
    JOIN users AS account USING (username);

    INSERT INTO doctors (staff_id, specialty, practice_license_no) VALUES
        (general_doctor, 'Umum', 'DEMO-SIP-001'),
        (internal_doctor, 'Penyakit Dalam', 'DEMO-SIP-002');

    INSERT INTO clinics (code, name, registration_fee)
    VALUES ('DEMO-UMUM', 'Poli Umum Demo', 30000) RETURNING id INTO general_clinic;

    INSERT INTO clinics (code, name, registration_fee)
    VALUES ('DEMO-DALAM', 'Poli Penyakit Dalam Demo', 40000) RETURNING id INTO internal_clinic;

    INSERT INTO doctor_schedules (doctor_id, clinic_id, practice_date, starts_at, ends_at)
    VALUES (general_doctor, general_clinic, demo_date, '08:00', '12:00') RETURNING id INTO general_schedule;

    INSERT INTO doctor_schedules (doctor_id, clinic_id, practice_date, starts_at, ends_at)
    VALUES (internal_doctor, internal_clinic, demo_date, '08:00', '12:00') RETURNING id INTO internal_schedule;

    INSERT INTO patients (medical_record_no, full_name, birth_date, sex) VALUES
        ('DEMO-RM-001', 'Pasien Demo Satu', '1991-05-16', 'female'),
        ('DEMO-RM-002', 'Pasien Demo Dua', '1988-08-10', 'male'),
        ('DEMO-RM-003', 'Pasien Demo Tiga', '1994-03-21', 'female'),
        ('DEMO-RM-004', 'Pasien Demo Empat', '1998-12-05', 'male'),
        ('DEMO-RM-005', 'Pasien Demo Lima', '1995-02-14', 'unspecified');

    INSERT INTO medical_procedures (code, name, price) VALUES
        ('DEMO-TDK-001', 'Pemeriksaan dokter demo', 100000),
        ('DEMO-TDK-002', 'Tindakan perawatan demo', 75000);

    INSERT INTO medicines (code, name, unit, price, stock_quantity) VALUES
        ('DEMO-OBT-001', 'Obat Simulasi A', 'tablet', 4000, 100),
        ('DEMO-OBT-002', 'Obat Simulasi B', 'kapsul', 5000, 30);

    INSERT INTO lab_tests (code, name, price) VALUES
        ('DEMO-LAB-001', 'Pemeriksaan laboratorium demo A', 120000),
        ('DEMO-LAB-002', 'Pemeriksaan laboratorium demo B', 90000);

    INSERT INTO visit_queue_counters (clinic_id, visit_date, last_number) VALUES
        (general_clinic, demo_date, 3),
        (internal_clinic, demo_date, 2);

    INSERT INTO visits (
        patient_id, schedule_id, clinic_id, visit_date, queue_number, status, registration_fee, registered_by, registered_at
    )
    SELECT patient.id, schedule.id, clinic.id, demo_date, fixture.queue_number, fixture.status, clinic.registration_fee,
        registration_user, fixture.registered_at
    FROM (VALUES
        ('DEMO-RM-001', general_schedule, 1, 'completed', TIMESTAMPTZ '2026-11-23 08:00+07'),
        ('DEMO-RM-002', general_schedule, 2, 'awaiting_billing', TIMESTAMPTZ '2026-11-23 08:30+07'),
        ('DEMO-RM-003', internal_schedule, 1, 'awaiting_billing', TIMESTAMPTZ '2026-11-23 08:45+07'),
        ('DEMO-RM-004', internal_schedule, 2, 'in_examination', TIMESTAMPTZ '2026-11-23 09:00+07'),
        ('DEMO-RM-005', general_schedule, 3, 'waiting', TIMESTAMPTZ '2026-11-23 09:05+07')
    ) AS fixture (record_no, schedule_id, queue_number, status, registered_at)
    JOIN patients AS patient ON patient.medical_record_no = fixture.record_no
    JOIN doctor_schedules AS schedule ON schedule.id = fixture.schedule_id
    JOIN clinics AS clinic ON clinic.id = schedule.clinic_id;

    SELECT id INTO STRICT paid_visit FROM visits
    WHERE clinic_id = general_clinic AND visit_date = demo_date AND queue_number = 1;
    SELECT id INTO STRICT partial_visit FROM visits
    WHERE clinic_id = general_clinic AND visit_date = demo_date AND queue_number = 2;
    SELECT id INTO STRICT unpaid_visit FROM visits
    WHERE clinic_id = internal_clinic AND visit_date = demo_date AND queue_number = 1;
    SELECT id INTO STRICT active_visit FROM visits
    WHERE clinic_id = internal_clinic AND visit_date = demo_date AND queue_number = 2;

    INSERT INTO examinations (
        visit_id, examiner_id, chief_complaint, anamnesis, physical_findings,
        systolic_bp, diastolic_bp, pulse_rate, respiratory_rate, temperature_c, examined_at, updated_at
    )
    VALUES (
        paid_visit, general_doctor, 'Keluhan dalam skenario demo', 'Anamnesis fiktif', 'Temuan pemeriksaan fiktif',
        120, 80, 76, 18, 36.7, '2026-11-23 08:20+07', '2026-11-23 08:20+07'
    ) RETURNING id INTO paid_exam;

    INSERT INTO examinations (visit_id, examiner_id, chief_complaint, examined_at, updated_at) VALUES
        (partial_visit, general_doctor, 'Keluhan demo pembayaran sebagian', '2026-11-23 08:50+07', '2026-11-23 08:50+07'),
        (unpaid_visit, internal_doctor, 'Keluhan demo belum dibayar', '2026-11-23 09:15+07', '2026-11-23 09:15+07'),
        (active_visit, internal_doctor, 'Keluhan demo pemeriksaan berjalan', '2026-11-23 09:30+07', '2026-11-23 09:30+07');

    INSERT INTO diagnoses (examination_id, code, description, is_primary)
    SELECT id, 'DEMO-DX-001', 'Diagnosis utama simulasi', TRUE
    FROM examinations WHERE visit_id IN (paid_visit, partial_visit, unpaid_visit);

    INSERT INTO diagnoses (examination_id, code, description)
    VALUES (paid_exam, 'DEMO-DX-002', 'Diagnosis sekunder simulasi');

    INSERT INTO visit_procedures (visit_id, procedure_id, performed_by, unit_price, performed_at)
    SELECT paid_visit, id, general_doctor, price, TIMESTAMPTZ '2026-11-23 08:35+07'
    FROM medical_procedures WHERE code IN ('DEMO-TDK-001', 'DEMO-TDK-002')
    UNION ALL
    SELECT partial_visit, id, general_doctor, price, TIMESTAMPTZ '2026-11-23 09:00+07'
    FROM medical_procedures WHERE code = 'DEMO-TDK-001';

    INSERT INTO prescriptions (visit_id, prescribed_by, status, prescribed_at, dispensed_by, dispensed_at)
    VALUES (paid_visit, general_doctor, 'dispensed', '2026-11-23 08:45+07', pharmacy_user, '2026-11-23 09:15+07')
    RETURNING id INTO dispensed_prescription;

    INSERT INTO prescriptions (visit_id, prescribed_by, prescribed_at)
    VALUES (active_visit, internal_doctor, '2026-11-23 09:35+07') RETURNING id INTO pending_prescription;

    INSERT INTO prescription_items (prescription_id, visit_id, medicine_id, dose, frequency, quantity, unit_price)
    SELECT fixture.prescription_id, fixture.visit_id, medicine.id, 'Dosis simulasi', 'Frekuensi simulasi',
        fixture.quantity, medicine.price
    FROM (VALUES
        (dispensed_prescription, paid_visit, 'DEMO-OBT-001', 10),
        (dispensed_prescription, paid_visit, 'DEMO-OBT-002', 4),
        (pending_prescription, active_visit, 'DEMO-OBT-002', 2)
    ) AS fixture (prescription_id, visit_id, medicine_code, quantity)
    JOIN medicines AS medicine ON medicine.code = fixture.medicine_code;

    INSERT INTO medicine_stock_movements (medicine_id, movement_type, quantity_delta, recorded_by, recorded_at, notes)
    SELECT id, 'receipt', stock_quantity, pharmacy_user, '2026-11-23 07:30+07', 'Stok awal demo'
    FROM medicines WHERE code IN ('DEMO-OBT-001', 'DEMO-OBT-002');

    UPDATE medicines AS medicine
    SET stock_quantity = medicine.stock_quantity - dispensed.quantity
    FROM (
        SELECT medicine_id, SUM(quantity)::INTEGER AS quantity
        FROM prescription_items WHERE prescription_id = dispensed_prescription
        GROUP BY medicine_id
    ) AS dispensed
    WHERE medicine.id = dispensed.medicine_id;

    INSERT INTO medicine_stock_movements (
        medicine_id, prescription_item_id, movement_type, quantity_delta, recorded_by, recorded_at
    )
    SELECT medicine_id, id, 'dispense', -quantity, pharmacy_user, '2026-11-23 09:15+07'
    FROM prescription_items WHERE prescription_id = dispensed_prescription;

    INSERT INTO lab_orders (visit_id, ordered_by, status, ordered_at, completed_at)
    VALUES (paid_visit, general_doctor, 'completed', '2026-11-23 08:40+07', '2026-11-23 09:30+07')
    RETURNING id INTO completed_lab_order;

    INSERT INTO lab_orders (visit_id, ordered_by, ordered_at)
    VALUES (active_visit, internal_doctor, '2026-11-23 09:40+07') RETURNING id INTO requested_lab_order;

    INSERT INTO lab_order_items (lab_order_id, visit_id, lab_test_id, unit_price)
    SELECT completed_lab_order, paid_visit, id, price FROM lab_tests WHERE code = 'DEMO-LAB-001'
    RETURNING id INTO completed_lab_item;

    INSERT INTO lab_order_items (lab_order_id, visit_id, lab_test_id, unit_price)
    SELECT requested_lab_order, active_visit, id, price FROM lab_tests WHERE code = 'DEMO-LAB-002';

    INSERT INTO lab_results (lab_order_item_id, result_value, entered_by, entered_at)
    VALUES (completed_lab_item, 'Hasil pemeriksaan fiktif', laboratory_user, '2026-11-23 09:30+07');

    INSERT INTO invoices (visit_id, invoice_no, issued_by, issued_at) VALUES
        (paid_visit, 'DEMO-INV-001', cashier_user, '2026-11-23 09:45+07'),
        (partial_visit, 'DEMO-INV-002', cashier_user, '2026-11-23 09:10+07'),
        (unpaid_visit, 'DEMO-INV-003', cashier_user, '2026-11-23 09:35+07');

    SELECT id INTO STRICT paid_invoice FROM invoices WHERE invoice_no = 'DEMO-INV-001';
    SELECT id INTO STRICT partial_invoice FROM invoices WHERE invoice_no = 'DEMO-INV-002';

    INSERT INTO invoice_items (invoice_id, visit_id, item_type, description, unit_price)
    SELECT invoice.id, visit.id, 'registration', 'Pendaftaran rawat jalan', visit.registration_fee
    FROM invoices AS invoice
    JOIN visits AS visit ON visit.id = invoice.visit_id
    WHERE visit.id IN (paid_visit, partial_visit, unpaid_visit);

    INSERT INTO invoice_items (
        invoice_id, visit_id, item_type, description, quantity, unit_price, visit_procedure_id
    )
    SELECT invoice.id, performed.visit_id, 'procedure', procedure.name, performed.quantity, performed.unit_price, performed.id
    FROM visit_procedures AS performed
    JOIN medical_procedures AS procedure ON procedure.id = performed.procedure_id
    JOIN invoices AS invoice ON invoice.visit_id = performed.visit_id
    WHERE invoice.id IN (paid_invoice, partial_invoice);

    INSERT INTO invoice_items (invoice_id, visit_id, item_type, description, unit_price, lab_order_item_id)
    SELECT paid_invoice, paid_visit, 'lab', test.name, item.unit_price, item.id
    FROM lab_order_items AS item
    JOIN lab_tests AS test ON test.id = item.lab_test_id
    WHERE item.id = completed_lab_item;

    INSERT INTO invoice_items (
        invoice_id, visit_id, item_type, description, quantity, unit_price, prescription_item_id
    )
    SELECT paid_invoice, paid_visit, 'medicine', medicine.name, item.quantity, item.unit_price, item.id
    FROM prescription_items AS item
    JOIN medicines AS medicine ON medicine.id = item.medicine_id
    WHERE item.prescription_id = dispensed_prescription;

    INSERT INTO payments (invoice_id, receipt_no, idempotency_key, method, amount, received_by, paid_at) VALUES
        (paid_invoice, 'DEMO-RCPT-001', '00000000-0000-4000-8000-000000000001', 'cash', 200000,
            cashier_user, '2026-11-23 09:50+07'),
        (partial_invoice, 'DEMO-RCPT-003', '00000000-0000-4000-8000-000000000003', 'cash', 50000,
            cashier_user, '2026-11-23 09:20+07');

    INSERT INTO payments (
        invoice_id, receipt_no, idempotency_key, method, amount, external_reference, received_by, paid_at
    )
    SELECT invoice_id, 'DEMO-RCPT-002', '00000000-0000-4000-8000-000000000002', 'non_cash', balance_amount,
        'DEMO-TRANSFER-001', cashier_user, '2026-11-23 10:00+07'
    FROM invoice_balances WHERE invoice_id = paid_invoice;

    INSERT INTO audit_logs (visit_id, actor_user_id, entity_type, entity_id, action, after_data, occurred_at)
    SELECT paid_visit, staff.user_id, 'examination', exam.id, 'create',
        jsonb_build_object('chief_complaint', exam.chief_complaint), exam.examined_at
    FROM examinations AS exam
    JOIN medical_staff AS staff ON staff.id = exam.examiner_id
    WHERE exam.id = paid_exam;

    INSERT INTO integration_outbox (event_key, lab_order_id, event_type, payload, created_at, next_attempt_at)
    VALUES (
        '00000000-0000-4000-8000-000000000101', requested_lab_order, 'lab.order.requested',
        jsonb_build_object('lab_order_id', requested_lab_order), '2026-11-23 09:40+07', '2026-11-23 09:40+07'
    );
END
$seed$;

COMMIT;
