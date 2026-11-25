import { db } from '../database.js';
import { HttpError } from '../errors.js';

const periodBounds = `
  SELECT $1::date AS date_from, $2::date AS date_to,
    $1::date::timestamp AT TIME ZONE $3::text AS start_at,
    ($2::date + 1)::timestamp AT TIME ZONE $3::text AS end_at
`;

async function report(sql, params) {
  try {
    const { rows: [result] } = await db.query(sql, params);
    return result;
  } catch (error) {
    console.error('Dashboard gagal dibaca.', error.code ?? error.name);
    throw new HttpError(503, 'Data dashboard sedang tidak tersedia.');
  }
}

export async function dashboardSummary(period) {
  const totals = await report(`
    WITH period AS (${periodBounds}),
    visits_by_clinic AS (
      SELECT clinic.id::text AS id, clinic.name, COUNT(*) AS count
      FROM visits AS visit
      JOIN clinics AS clinic ON clinic.id = visit.clinic_id
      CROSS JOIN period
      WHERE visit.visit_date BETWEEN period.date_from AND period.date_to
        AND visit.status <> 'cancelled'
      GROUP BY clinic.id
    ),
    procedures AS (
      SELECT master.id::text AS id, master.code, master.name, SUM(performed.quantity) AS quantity
      FROM visit_procedures AS performed
      JOIN medical_procedures AS master ON master.id = performed.procedure_id
      JOIN visits AS visit ON visit.id = performed.visit_id
      CROSS JOIN period
      WHERE performed.performed_at >= period.start_at AND performed.performed_at < period.end_at
        AND performed.cancelled_at IS NULL AND visit.status <> 'cancelled'
      GROUP BY master.id
    ),
    medicines AS (
      SELECT master.id::text AS id, master.code, master.name, master.unit,
        SUM(-movement.quantity_delta::bigint) AS quantity
      FROM medicine_stock_movements AS movement
      JOIN medicines AS master ON master.id = movement.medicine_id
      CROSS JOIN period
      WHERE movement.recorded_at >= period.start_at AND movement.recorded_at < period.end_at
        AND movement.movement_type = 'dispense'
      GROUP BY master.id
    ),
    payments_by_method AS (
      SELECT payment.method, COUNT(*) AS count, SUM(payment.amount) AS amount
      FROM payments AS payment
      CROSS JOIN period
      WHERE payment.paid_at >= period.start_at AND payment.paid_at < period.end_at
      GROUP BY payment.method
    ),
    invoices_by_status AS (
      SELECT balance.status, COUNT(*) AS count, SUM(balance.balance_amount) AS amount
      FROM invoices AS invoice
      JOIN invoice_balances AS balance ON balance.invoice_id = invoice.id
      CROSS JOIN period
      WHERE invoice.issued_at >= period.start_at AND invoice.issued_at < period.end_at
      GROUP BY balance.status
    )
    SELECT
      (SELECT jsonb_build_object(
        'total', COALESCE(SUM(count), 0),
        'by_clinic', COALESCE(jsonb_agg(to_jsonb(visits_by_clinic) ORDER BY count DESC, name, id), '[]'::jsonb)
      ) FROM visits_by_clinic) AS visits,
      (SELECT jsonb_build_object(
        'total', COALESCE(SUM(quantity), 0),
        'items', COALESCE(jsonb_agg(to_jsonb(procedures) ORDER BY quantity DESC, name, id), '[]'::jsonb)
      ) FROM procedures) AS procedures,
      (SELECT jsonb_build_object(
        'total_types', COUNT(*),
        'items', COALESCE(jsonb_agg(to_jsonb(medicines) ORDER BY quantity DESC, name, id), '[]'::jsonb)
      ) FROM medicines) AS medicines,
      (SELECT jsonb_build_object(
        'total_amount', COALESCE(SUM(amount), 0.00)::text,
        'payment_count', COALESCE(SUM(count), 0),
        'by_method', COALESCE(jsonb_agg(jsonb_build_object(
          'method', method, 'count', count, 'amount', amount::text
        ) ORDER BY method), '[]'::jsonb)
      ) FROM payments_by_method) AS revenue,
      (SELECT jsonb_build_object(
        'total', COALESCE(SUM(count), 0),
        'balance_amount', ROUND(COALESCE(SUM(amount), 0), 2)::text,
        'by_status', COALESCE(jsonb_agg(jsonb_build_object(
          'status', status, 'count', count, 'balance_amount', ROUND(amount, 2)::text
        ) ORDER BY status), '[]'::jsonb)
      ) FROM invoices_by_status) AS invoices
  `, [period.date_from, period.date_to, period.time_zone]);

  return { period, ...totals };
}

export async function dashboardInvoices(period, { status, page, pageSize }) {
  const result = await report(`
    WITH period AS (${periodBounds}),
    matching AS (
      SELECT invoice.id, invoice.invoice_no, invoice.issued_at, clinic.name AS clinic_name,
        balance.status, balance.total_amount, balance.paid_amount, balance.balance_amount
      FROM invoices AS invoice
      JOIN visits AS visit ON visit.id = invoice.visit_id
      JOIN clinics AS clinic ON clinic.id = visit.clinic_id
      JOIN invoice_balances AS balance ON balance.invoice_id = invoice.id
      CROSS JOIN period
      WHERE invoice.issued_at >= period.start_at AND invoice.issued_at < period.end_at
        AND ($4::text = 'all' OR balance.status = $4)
    )
    SELECT (SELECT COUNT(*) FROM matching) AS total,
      COALESCE((
        SELECT jsonb_agg(to_jsonb(items) ORDER BY issued_at DESC, id::bigint DESC) FROM (
          SELECT id::text AS id, invoice_no, issued_at, clinic_name, status,
            ROUND(total_amount, 2)::text AS total_amount,
            ROUND(paid_amount, 2)::text AS paid_amount,
            ROUND(balance_amount, 2)::text AS balance_amount
          FROM matching
          ORDER BY issued_at DESC, matching.id DESC
          LIMIT $5 OFFSET $6
        ) AS items
      ), '[]'::jsonb) AS items
  `, [period.date_from, period.date_to, period.time_zone, status, pageSize, (page - 1) * pageSize]);

  return { period, items: result.items, total: Number(result.total), page, page_size: pageSize };
}
