-- Snapshot skema PostgreSQL dari migrasi Yii2.

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.12
-- Dumped by pg_dump version 17.12

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    visit_id bigint NOT NULL,
    actor_user_id bigint NOT NULL,
    entity_type character varying(50) NOT NULL,
    entity_id bigint NOT NULL,
    action character varying(30) NOT NULL,
    before_data jsonb,
    after_data jsonb,
    reason text,
    occurred_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT audit_logs_check CHECK (((before_data IS NOT NULL) OR (after_data IS NOT NULL)))
);


--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: auth_login_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_login_attempts (
    subject_hash character varying(64) NOT NULL,
    window_started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    attempt_count smallint NOT NULL,
    CONSTRAINT auth_login_attempts_attempt_count_check CHECK ((attempt_count > 0))
);


--
-- Name: auth_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_tokens (
    token_hash character varying(64) NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp with time zone DEFAULT (CURRENT_TIMESTAMP + '08:00:00'::interval) NOT NULL,
    CONSTRAINT auth_tokens_check CHECK ((expires_at > created_at))
);


--
-- Name: clinics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clinics (
    id bigint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    registration_fee numeric(14,2) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT clinics_registration_fee_check CHECK (((registration_fee >= (0)::numeric) AND (registration_fee <> 'NaN'::numeric)))
);


--
-- Name: clinics_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.clinics ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.clinics_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: diagnoses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diagnoses (
    id bigint NOT NULL,
    examination_id bigint NOT NULL,
    code character varying(20),
    description text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL
);


--
-- Name: diagnoses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.diagnoses ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.diagnoses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: doctor_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctor_schedules (
    id bigint NOT NULL,
    doctor_id bigint NOT NULL,
    clinic_id bigint NOT NULL,
    practice_date date NOT NULL,
    starts_at time without time zone NOT NULL,
    ends_at time without time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT doctor_schedules_check CHECK ((starts_at < ends_at))
);


--
-- Name: doctor_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.doctor_schedules ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.doctor_schedules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: doctors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctors (
    staff_id bigint NOT NULL,
    specialty character varying(100) NOT NULL,
    practice_license_no character varying(64)
);


--
-- Name: examinations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.examinations (
    id bigint NOT NULL,
    visit_id bigint NOT NULL,
    examiner_id bigint NOT NULL,
    chief_complaint text NOT NULL,
    anamnesis text,
    physical_findings text,
    systolic_bp smallint,
    diastolic_bp smallint,
    pulse_rate smallint,
    respiratory_rate smallint,
    temperature_c numeric(4,1),
    examined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT examinations_diastolic_bp_check CHECK ((diastolic_bp > 0)),
    CONSTRAINT examinations_pulse_rate_check CHECK ((pulse_rate > 0)),
    CONSTRAINT examinations_respiratory_rate_check CHECK ((respiratory_rate > 0)),
    CONSTRAINT examinations_systolic_bp_check CHECK ((systolic_bp > 0)),
    CONSTRAINT examinations_temperature_c_check CHECK (((temperature_c > (0)::numeric) AND (temperature_c <> 'NaN'::numeric)))
);


--
-- Name: examinations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.examinations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.examinations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: integration_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.integration_outbox (
    id bigint NOT NULL,
    event_key uuid NOT NULL,
    lab_order_id bigint NOT NULL,
    event_type character varying(80) NOT NULL,
    payload jsonb NOT NULL,
    attempt_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    next_attempt_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    published_at timestamp with time zone,
    last_error text,
    CONSTRAINT integration_outbox_attempt_count_check CHECK ((attempt_count >= 0)),
    CONSTRAINT integration_outbox_payload_check CHECK ((jsonb_typeof(payload) = 'object'::text))
);


--
-- Name: integration_outbox_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.integration_outbox ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.integration_outbox_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id bigint NOT NULL,
    invoice_id bigint NOT NULL,
    visit_id bigint NOT NULL,
    item_type character varying(12) NOT NULL,
    description character varying(180) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    visit_procedure_id bigint,
    lab_order_item_id bigint,
    prescription_item_id bigint,
    CONSTRAINT invoice_items_check CHECK ((((item_type)::text = 'procedure'::text) = (visit_procedure_id IS NOT NULL))),
    CONSTRAINT invoice_items_check1 CHECK ((((item_type)::text = 'lab'::text) = (lab_order_item_id IS NOT NULL))),
    CONSTRAINT invoice_items_check2 CHECK ((((item_type)::text = 'medicine'::text) = (prescription_item_id IS NOT NULL))),
    CONSTRAINT invoice_items_item_type_check CHECK (((item_type)::text = ANY ((ARRAY['registration'::character varying, 'procedure'::character varying, 'lab'::character varying, 'medicine'::character varying])::text[]))),
    CONSTRAINT invoice_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT invoice_items_unit_price_check CHECK (((unit_price >= (0)::numeric) AND (unit_price <> 'NaN'::numeric)))
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id bigint NOT NULL,
    visit_id bigint NOT NULL,
    invoice_no character varying(40) NOT NULL,
    issued_by bigint NOT NULL,
    issued_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id bigint NOT NULL,
    invoice_id bigint NOT NULL,
    receipt_no character varying(40) NOT NULL,
    idempotency_key uuid NOT NULL,
    method character varying(12) NOT NULL,
    amount numeric(14,2) NOT NULL,
    external_reference character varying(100),
    received_by bigint NOT NULL,
    paid_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT payments_amount_check CHECK (((amount > (0)::numeric) AND (amount <> 'NaN'::numeric))),
    CONSTRAINT payments_method_check CHECK (((method)::text = ANY ((ARRAY['cash'::character varying, 'non_cash'::character varying])::text[])))
);


--
-- Name: invoice_balances; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.invoice_balances AS
 SELECT invoice.id AS invoice_id,
    invoice.visit_id,
    charge.total_amount,
    receipt.paid_amount,
    (charge.total_amount - receipt.paid_amount) AS balance_amount,
        CASE
            WHEN (receipt.paid_amount >= charge.total_amount) THEN 'paid'::text
            WHEN (receipt.paid_amount > (0)::numeric) THEN 'partial'::text
            ELSE 'unpaid'::text
        END AS status
   FROM ((public.invoices invoice
     CROSS JOIN LATERAL ( SELECT COALESCE(sum(((invoice_items.quantity)::numeric * invoice_items.unit_price)), (0)::numeric) AS total_amount
           FROM public.invoice_items
          WHERE (invoice_items.invoice_id = invoice.id)) charge)
     CROSS JOIN LATERAL ( SELECT COALESCE(sum(payments.amount), (0)::numeric) AS paid_amount
           FROM public.payments
          WHERE (payments.invoice_id = invoice.id)) receipt);


--
-- Name: invoice_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.invoice_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invoice_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.invoices ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invoices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lab_order_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_order_items (
    id bigint NOT NULL,
    lab_order_id bigint NOT NULL,
    visit_id bigint NOT NULL,
    lab_test_id bigint NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    CONSTRAINT lab_order_items_unit_price_check CHECK (((unit_price >= (0)::numeric) AND (unit_price <> 'NaN'::numeric)))
);


--
-- Name: lab_order_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.lab_order_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lab_order_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lab_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_orders (
    id bigint NOT NULL,
    visit_id bigint NOT NULL,
    ordered_by bigint NOT NULL,
    status character varying(12) DEFAULT 'requested'::character varying NOT NULL,
    clinical_notes text,
    ordered_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT lab_orders_check CHECK ((completed_at >= ordered_at)),
    CONSTRAINT lab_orders_check1 CHECK ((((status)::text = 'completed'::text) = (completed_at IS NOT NULL))),
    CONSTRAINT lab_orders_status_check CHECK (((status)::text = ANY ((ARRAY['requested'::character varying, 'in_progress'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: lab_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.lab_orders ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lab_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: lab_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_results (
    lab_order_item_id bigint NOT NULL,
    result_value text NOT NULL,
    unit character varying(30),
    reference_range character varying(120),
    notes text,
    entered_by bigint NOT NULL,
    entered_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: lab_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_tests (
    id bigint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(120) NOT NULL,
    price numeric(14,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT lab_tests_price_check CHECK (((price >= (0)::numeric) AND (price <> 'NaN'::numeric)))
);


--
-- Name: lab_tests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.lab_tests ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.lab_tests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: medical_procedures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_procedures (
    id bigint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(120) NOT NULL,
    price numeric(14,2) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT medical_procedures_price_check CHECK (((price >= (0)::numeric) AND (price <> 'NaN'::numeric)))
);


--
-- Name: medical_procedures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.medical_procedures ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.medical_procedures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: medical_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_staff (
    id bigint NOT NULL,
    user_id bigint,
    employee_no character varying(30) NOT NULL,
    full_name character varying(150) NOT NULL,
    profession character varying(60) NOT NULL,
    is_active boolean DEFAULT true NOT NULL
);


--
-- Name: medical_staff_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.medical_staff ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.medical_staff_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: medicine_stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medicine_stock_movements (
    id bigint NOT NULL,
    medicine_id bigint NOT NULL,
    prescription_item_id bigint,
    movement_type character varying(12) NOT NULL,
    quantity_delta integer NOT NULL,
    recorded_by bigint NOT NULL,
    recorded_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text,
    CONSTRAINT medicine_stock_movements_check CHECK ((((movement_type)::text = 'dispense'::text) = (prescription_item_id IS NOT NULL))),
    CONSTRAINT medicine_stock_movements_check1 CHECK ((((movement_type)::text <> 'dispense'::text) OR (quantity_delta < 0))),
    CONSTRAINT medicine_stock_movements_check2 CHECK ((((movement_type)::text <> 'receipt'::text) OR (quantity_delta > 0))),
    CONSTRAINT medicine_stock_movements_movement_type_check CHECK (((movement_type)::text = ANY ((ARRAY['receipt'::character varying, 'dispense'::character varying, 'adjustment'::character varying])::text[]))),
    CONSTRAINT medicine_stock_movements_quantity_delta_check CHECK ((quantity_delta <> 0))
);


--
-- Name: medicine_stock_movements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.medicine_stock_movements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.medicine_stock_movements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: medicines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medicines (
    id bigint NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(120) NOT NULL,
    unit character varying(30) NOT NULL,
    price numeric(14,2) NOT NULL,
    stock_quantity integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT medicines_price_check CHECK (((price >= (0)::numeric) AND (price <> 'NaN'::numeric))),
    CONSTRAINT medicines_stock_quantity_check CHECK ((stock_quantity >= 0))
);


--
-- Name: medicines_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.medicines ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.medicines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id bigint NOT NULL,
    medical_record_no character varying(30) NOT NULL,
    national_id character varying(50),
    full_name character varying(150) NOT NULL,
    birth_date date NOT NULL,
    sex character varying(12) NOT NULL,
    phone character varying(30),
    address text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT patients_sex_check CHECK (((sex)::text = ANY ((ARRAY['female'::character varying, 'male'::character varying, 'unspecified'::character varying])::text[])))
);


--
-- Name: patients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.patients ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.patients_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.payments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: prescription_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescription_items (
    id bigint NOT NULL,
    prescription_id bigint NOT NULL,
    visit_id bigint NOT NULL,
    medicine_id bigint NOT NULL,
    dose character varying(100) NOT NULL,
    frequency character varying(100) NOT NULL,
    quantity integer NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    CONSTRAINT prescription_items_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT prescription_items_unit_price_check CHECK (((unit_price >= (0)::numeric) AND (unit_price <> 'NaN'::numeric)))
);


--
-- Name: prescription_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.prescription_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.prescription_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: prescriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.prescriptions (
    id bigint NOT NULL,
    visit_id bigint NOT NULL,
    prescribed_by bigint NOT NULL,
    status character varying(12) DEFAULT 'pending'::character varying NOT NULL,
    prescribed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dispensed_by bigint,
    dispensed_at timestamp with time zone,
    CONSTRAINT prescriptions_check CHECK ((dispensed_at >= prescribed_at)),
    CONSTRAINT prescriptions_check1 CHECK ((((status)::text = 'dispensed'::text) = (dispensed_by IS NOT NULL))),
    CONSTRAINT prescriptions_check2 CHECK ((((status)::text = 'dispensed'::text) = (dispensed_at IS NOT NULL))),
    CONSTRAINT prescriptions_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'dispensed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: prescriptions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.prescriptions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.prescriptions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    code character varying(30) NOT NULL,
    name character varying(80) NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    role_code character varying(30) NOT NULL,
    username character varying(64) NOT NULL,
    password_hash character varying(255) NOT NULL,
    full_name character varying(150) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT users_username_check CHECK ((((username)::text = lower(btrim((username)::text))) AND ((username)::text <> ''::text)))
);


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.users ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: visit_procedures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_procedures (
    id bigint NOT NULL,
    visit_id bigint NOT NULL,
    procedure_id bigint NOT NULL,
    performed_by bigint NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(14,2) NOT NULL,
    performed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    cancelled_at timestamp with time zone,
    CONSTRAINT visit_procedures_check CHECK ((cancelled_at >= performed_at)),
    CONSTRAINT visit_procedures_quantity_check CHECK ((quantity > 0)),
    CONSTRAINT visit_procedures_unit_price_check CHECK (((unit_price >= (0)::numeric) AND (unit_price <> 'NaN'::numeric)))
);


--
-- Name: visit_procedures_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.visit_procedures ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.visit_procedures_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: visit_queue_counters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visit_queue_counters (
    clinic_id bigint NOT NULL,
    visit_date date NOT NULL,
    last_number integer DEFAULT 0 NOT NULL,
    CONSTRAINT visit_queue_counters_last_number_check CHECK ((last_number >= 0))
);


--
-- Name: visits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.visits (
    id bigint NOT NULL,
    patient_id bigint NOT NULL,
    schedule_id bigint NOT NULL,
    clinic_id bigint NOT NULL,
    visit_date date NOT NULL,
    queue_number integer NOT NULL,
    status character varying(20) DEFAULT 'waiting'::character varying NOT NULL,
    registration_fee numeric(14,2) NOT NULL,
    registered_by bigint NOT NULL,
    registered_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT visits_queue_number_check CHECK ((queue_number > 0)),
    CONSTRAINT visits_registration_fee_check CHECK (((registration_fee >= (0)::numeric) AND (registration_fee <> 'NaN'::numeric))),
    CONSTRAINT visits_status_check CHECK (((status)::text = ANY ((ARRAY['waiting'::character varying, 'in_examination'::character varying, 'awaiting_billing'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: visits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.visits ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.visits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_login_attempts auth_login_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_login_attempts
    ADD CONSTRAINT auth_login_attempts_pkey PRIMARY KEY (subject_hash);


--
-- Name: auth_tokens auth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT auth_tokens_pkey PRIMARY KEY (token_hash);


--
-- Name: clinics clinics_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_code_key UNIQUE (code);


--
-- Name: clinics clinics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clinics
    ADD CONSTRAINT clinics_pkey PRIMARY KEY (id);


--
-- Name: diagnoses diagnoses_examination_id_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_examination_id_code_key UNIQUE (examination_id, code);


--
-- Name: diagnoses diagnoses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_pkey PRIMARY KEY (id);


--
-- Name: doctor_schedules doctor_schedules_doctor_id_practice_date_starts_at_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_doctor_id_practice_date_starts_at_key UNIQUE (doctor_id, practice_date, starts_at);


--
-- Name: doctor_schedules doctor_schedules_id_clinic_id_practice_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_id_clinic_id_practice_date_key UNIQUE (id, clinic_id, practice_date);


--
-- Name: doctor_schedules doctor_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_pkey PRIMARY KEY (id);


--
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_pkey PRIMARY KEY (staff_id);


--
-- Name: doctors doctors_practice_license_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_practice_license_no_key UNIQUE (practice_license_no);


--
-- Name: examinations examinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examinations
    ADD CONSTRAINT examinations_pkey PRIMARY KEY (id);


--
-- Name: examinations examinations_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examinations
    ADD CONSTRAINT examinations_visit_id_key UNIQUE (visit_id);


--
-- Name: integration_outbox integration_outbox_event_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_outbox
    ADD CONSTRAINT integration_outbox_event_key_key UNIQUE (event_key);


--
-- Name: integration_outbox integration_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_outbox
    ADD CONSTRAINT integration_outbox_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_lab_order_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_lab_order_item_id_key UNIQUE (lab_order_item_id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_prescription_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_prescription_item_id_key UNIQUE (prescription_item_id);


--
-- Name: invoice_items invoice_items_visit_procedure_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_visit_procedure_id_key UNIQUE (visit_procedure_id);


--
-- Name: invoices invoices_id_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_id_visit_id_key UNIQUE (id, visit_id);


--
-- Name: invoices invoices_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_no_key UNIQUE (invoice_no);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_visit_id_key UNIQUE (visit_id);


--
-- Name: lab_order_items lab_order_items_id_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_order_items
    ADD CONSTRAINT lab_order_items_id_visit_id_key UNIQUE (id, visit_id);


--
-- Name: lab_order_items lab_order_items_lab_order_id_lab_test_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_order_items
    ADD CONSTRAINT lab_order_items_lab_order_id_lab_test_id_key UNIQUE (lab_order_id, lab_test_id);


--
-- Name: lab_order_items lab_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_order_items
    ADD CONSTRAINT lab_order_items_pkey PRIMARY KEY (id);


--
-- Name: lab_orders lab_orders_id_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_id_visit_id_key UNIQUE (id, visit_id);


--
-- Name: lab_orders lab_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_pkey PRIMARY KEY (id);


--
-- Name: lab_results lab_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_pkey PRIMARY KEY (lab_order_item_id);


--
-- Name: lab_tests lab_tests_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_code_key UNIQUE (code);


--
-- Name: lab_tests lab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_pkey PRIMARY KEY (id);


--
-- Name: medical_procedures medical_procedures_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_procedures
    ADD CONSTRAINT medical_procedures_code_key UNIQUE (code);


--
-- Name: medical_procedures medical_procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_procedures
    ADD CONSTRAINT medical_procedures_pkey PRIMARY KEY (id);


--
-- Name: medical_staff medical_staff_employee_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_staff
    ADD CONSTRAINT medical_staff_employee_no_key UNIQUE (employee_no);


--
-- Name: medical_staff medical_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_staff
    ADD CONSTRAINT medical_staff_pkey PRIMARY KEY (id);


--
-- Name: medical_staff medical_staff_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_staff
    ADD CONSTRAINT medical_staff_user_id_key UNIQUE (user_id);


--
-- Name: medicine_stock_movements medicine_stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicine_stock_movements
    ADD CONSTRAINT medicine_stock_movements_pkey PRIMARY KEY (id);


--
-- Name: medicine_stock_movements medicine_stock_movements_prescription_item_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicine_stock_movements
    ADD CONSTRAINT medicine_stock_movements_prescription_item_id_key UNIQUE (prescription_item_id);


--
-- Name: medicines medicines_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicines
    ADD CONSTRAINT medicines_code_key UNIQUE (code);


--
-- Name: medicines medicines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicines
    ADD CONSTRAINT medicines_pkey PRIMARY KEY (id);


--
-- Name: patients patients_medical_record_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_medical_record_no_key UNIQUE (medical_record_no);


--
-- Name: patients patients_national_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_national_id_key UNIQUE (national_id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: payments payments_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_receipt_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_receipt_no_key UNIQUE (receipt_no);


--
-- Name: prescription_items prescription_items_id_medicine_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_id_medicine_id_key UNIQUE (id, medicine_id);


--
-- Name: prescription_items prescription_items_id_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_id_visit_id_key UNIQUE (id, visit_id);


--
-- Name: prescription_items prescription_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_pkey PRIMARY KEY (id);


--
-- Name: prescriptions prescriptions_id_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_id_visit_id_key UNIQUE (id, visit_id);


--
-- Name: prescriptions prescriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (code);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: visit_procedures visit_procedures_id_visit_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_procedures
    ADD CONSTRAINT visit_procedures_id_visit_id_key UNIQUE (id, visit_id);


--
-- Name: visit_procedures visit_procedures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_procedures
    ADD CONSTRAINT visit_procedures_pkey PRIMARY KEY (id);


--
-- Name: visit_queue_counters visit_queue_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_queue_counters
    ADD CONSTRAINT visit_queue_counters_pkey PRIMARY KEY (clinic_id, visit_date);


--
-- Name: visits visits_clinic_id_visit_date_queue_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_clinic_id_visit_date_queue_number_key UNIQUE (clinic_id, visit_date, queue_number);


--
-- Name: visits visits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_pkey PRIMARY KEY (id);


--
-- Name: audit_logs_visit_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_visit_time_idx ON public.audit_logs USING btree (visit_id, occurred_at);


--
-- Name: auth_login_attempts_window_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_login_attempts_window_idx ON public.auth_login_attempts USING btree (window_started_at);


--
-- Name: auth_tokens_expiry_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_tokens_expiry_idx ON public.auth_tokens USING btree (expires_at);


--
-- Name: auth_tokens_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX auth_tokens_user_idx ON public.auth_tokens USING btree (user_id);


--
-- Name: diagnoses_primary_per_exam_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX diagnoses_primary_per_exam_uq ON public.diagnoses USING btree (examination_id) WHERE is_primary;


--
-- Name: doctor_schedules_clinic_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX doctor_schedules_clinic_date_idx ON public.doctor_schedules USING btree (clinic_id, practice_date);


--
-- Name: integration_outbox_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX integration_outbox_pending_idx ON public.integration_outbox USING btree (next_attempt_at, id) WHERE (published_at IS NULL);


--
-- Name: invoice_items_invoice_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoice_items_invoice_idx ON public.invoice_items USING btree (invoice_id);


--
-- Name: invoice_items_registration_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoice_items_registration_uq ON public.invoice_items USING btree (invoice_id) WHERE ((item_type)::text = 'registration'::text);


--
-- Name: lab_orders_status_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_orders_status_time_idx ON public.lab_orders USING btree (status, ordered_at);


--
-- Name: lab_orders_visit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lab_orders_visit_idx ON public.lab_orders USING btree (visit_id);


--
-- Name: medicine_stock_movements_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX medicine_stock_movements_time_idx ON public.medicine_stock_movements USING btree (recorded_at, medicine_id);


--
-- Name: payments_invoice_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_invoice_time_idx ON public.payments USING btree (invoice_id, paid_at);


--
-- Name: payments_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_time_idx ON public.payments USING btree (paid_at);


--
-- Name: prescription_items_prescription_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prescription_items_prescription_idx ON public.prescription_items USING btree (prescription_id);


--
-- Name: prescriptions_status_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prescriptions_status_time_idx ON public.prescriptions USING btree (status, prescribed_at);


--
-- Name: prescriptions_visit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX prescriptions_visit_idx ON public.prescriptions USING btree (visit_id);


--
-- Name: visit_procedures_visit_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visit_procedures_visit_idx ON public.visit_procedures USING btree (visit_id);


--
-- Name: visits_date_clinic_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visits_date_clinic_idx ON public.visits USING btree (visit_date, clinic_id);


--
-- Name: visits_patient_clinic_date_active_uq; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX visits_patient_clinic_date_active_uq ON public.visits USING btree (patient_id, clinic_id, visit_date) WHERE ((status)::text <> 'cancelled'::text);


--
-- Name: visits_patient_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visits_patient_date_idx ON public.visits USING btree (patient_id, visit_date);


--
-- Name: visits_schedule_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX visits_schedule_idx ON public.visits USING btree (schedule_id);


--
-- Name: audit_logs audit_logs_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.users(id);


--
-- Name: audit_logs audit_logs_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id);


--
-- Name: auth_tokens auth_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT auth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: diagnoses diagnoses_examination_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diagnoses
    ADD CONSTRAINT diagnoses_examination_id_fkey FOREIGN KEY (examination_id) REFERENCES public.examinations(id);


--
-- Name: doctor_schedules doctor_schedules_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id);


--
-- Name: doctor_schedules doctor_schedules_doctor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctor_schedules
    ADD CONSTRAINT doctor_schedules_doctor_id_fkey FOREIGN KEY (doctor_id) REFERENCES public.doctors(staff_id);


--
-- Name: doctors doctors_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.medical_staff(id);


--
-- Name: examinations examinations_examiner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examinations
    ADD CONSTRAINT examinations_examiner_id_fkey FOREIGN KEY (examiner_id) REFERENCES public.doctors(staff_id);


--
-- Name: examinations examinations_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.examinations
    ADD CONSTRAINT examinations_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id);


--
-- Name: integration_outbox integration_outbox_lab_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.integration_outbox
    ADD CONSTRAINT integration_outbox_lab_order_id_fkey FOREIGN KEY (lab_order_id) REFERENCES public.lab_orders(id);


--
-- Name: invoice_items invoice_items_invoice_id_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_visit_id_fkey FOREIGN KEY (invoice_id, visit_id) REFERENCES public.invoices(id, visit_id);


--
-- Name: invoice_items invoice_items_lab_order_item_id_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_lab_order_item_id_visit_id_fkey FOREIGN KEY (lab_order_item_id, visit_id) REFERENCES public.lab_order_items(id, visit_id);


--
-- Name: invoice_items invoice_items_prescription_item_id_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_prescription_item_id_visit_id_fkey FOREIGN KEY (prescription_item_id, visit_id) REFERENCES public.prescription_items(id, visit_id);


--
-- Name: invoice_items invoice_items_visit_procedure_id_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_visit_procedure_id_visit_id_fkey FOREIGN KEY (visit_procedure_id, visit_id) REFERENCES public.visit_procedures(id, visit_id);


--
-- Name: invoices invoices_issued_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_issued_by_fkey FOREIGN KEY (issued_by) REFERENCES public.users(id);


--
-- Name: invoices invoices_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id);


--
-- Name: lab_order_items lab_order_items_lab_order_id_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_order_items
    ADD CONSTRAINT lab_order_items_lab_order_id_visit_id_fkey FOREIGN KEY (lab_order_id, visit_id) REFERENCES public.lab_orders(id, visit_id);


--
-- Name: lab_order_items lab_order_items_lab_test_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_order_items
    ADD CONSTRAINT lab_order_items_lab_test_id_fkey FOREIGN KEY (lab_test_id) REFERENCES public.lab_tests(id);


--
-- Name: lab_orders lab_orders_ordered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_ordered_by_fkey FOREIGN KEY (ordered_by) REFERENCES public.doctors(staff_id);


--
-- Name: lab_orders lab_orders_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_orders
    ADD CONSTRAINT lab_orders_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id);


--
-- Name: lab_results lab_results_entered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_entered_by_fkey FOREIGN KEY (entered_by) REFERENCES public.users(id);


--
-- Name: lab_results lab_results_lab_order_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_results
    ADD CONSTRAINT lab_results_lab_order_item_id_fkey FOREIGN KEY (lab_order_item_id) REFERENCES public.lab_order_items(id);


--
-- Name: medical_staff medical_staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_staff
    ADD CONSTRAINT medical_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: medicine_stock_movements medicine_stock_movements_medicine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicine_stock_movements
    ADD CONSTRAINT medicine_stock_movements_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id);


--
-- Name: medicine_stock_movements medicine_stock_movements_prescription_item_id_medicine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicine_stock_movements
    ADD CONSTRAINT medicine_stock_movements_prescription_item_id_medicine_id_fkey FOREIGN KEY (prescription_item_id, medicine_id) REFERENCES public.prescription_items(id, medicine_id);


--
-- Name: medicine_stock_movements medicine_stock_movements_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medicine_stock_movements
    ADD CONSTRAINT medicine_stock_movements_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.users(id);


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: payments payments_received_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_received_by_fkey FOREIGN KEY (received_by) REFERENCES public.users(id);


--
-- Name: prescription_items prescription_items_medicine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_medicine_id_fkey FOREIGN KEY (medicine_id) REFERENCES public.medicines(id);


--
-- Name: prescription_items prescription_items_prescription_id_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescription_items
    ADD CONSTRAINT prescription_items_prescription_id_visit_id_fkey FOREIGN KEY (prescription_id, visit_id) REFERENCES public.prescriptions(id, visit_id);


--
-- Name: prescriptions prescriptions_dispensed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_dispensed_by_fkey FOREIGN KEY (dispensed_by) REFERENCES public.users(id);


--
-- Name: prescriptions prescriptions_prescribed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_prescribed_by_fkey FOREIGN KEY (prescribed_by) REFERENCES public.doctors(staff_id);


--
-- Name: prescriptions prescriptions_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.prescriptions
    ADD CONSTRAINT prescriptions_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id);


--
-- Name: users users_role_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_role_code_fkey FOREIGN KEY (role_code) REFERENCES public.roles(code);


--
-- Name: visit_procedures visit_procedures_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_procedures
    ADD CONSTRAINT visit_procedures_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.doctors(staff_id);


--
-- Name: visit_procedures visit_procedures_procedure_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_procedures
    ADD CONSTRAINT visit_procedures_procedure_id_fkey FOREIGN KEY (procedure_id) REFERENCES public.medical_procedures(id);


--
-- Name: visit_procedures visit_procedures_visit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_procedures
    ADD CONSTRAINT visit_procedures_visit_id_fkey FOREIGN KEY (visit_id) REFERENCES public.visits(id);


--
-- Name: visit_queue_counters visit_queue_counters_clinic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visit_queue_counters
    ADD CONSTRAINT visit_queue_counters_clinic_id_fkey FOREIGN KEY (clinic_id) REFERENCES public.clinics(id);


--
-- Name: visits visits_clinic_id_visit_date_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_clinic_id_visit_date_fkey FOREIGN KEY (clinic_id, visit_date) REFERENCES public.visit_queue_counters(clinic_id, visit_date);


--
-- Name: visits visits_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id);


--
-- Name: visits visits_registered_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_registered_by_fkey FOREIGN KEY (registered_by) REFERENCES public.users(id);


--
-- Name: visits visits_schedule_id_clinic_id_visit_date_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.visits
    ADD CONSTRAINT visits_schedule_id_clinic_id_visit_date_fkey FOREIGN KEY (schedule_id, clinic_id, visit_date) REFERENCES public.doctor_schedules(id, clinic_id, practice_date);


--
-- PostgreSQL database dump complete
--
