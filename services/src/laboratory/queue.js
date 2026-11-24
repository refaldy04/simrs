import { db } from '../database.js';
import { HttpError } from '../errors.js';

export async function listOrders({ term, status, page, pageSize }) {
  const pattern = '%' + term.replace(/[\\%_]/g, '\\$&') + '%';
  try {
    const { rows: [result] } = await db.query(`
      WITH matching AS (
        SELECT lab.id, lab.visit_id, lab.status, lab.ordered_at,
          visit.visit_date::text, patient.full_name AS patient_name, patient.medical_record_no,
          clinic.name AS clinic_name
        FROM lab_orders AS lab
        JOIN visits AS visit ON visit.id = lab.visit_id
        JOIN patients AS patient ON patient.id = visit.patient_id
        JOIN clinics AS clinic ON clinic.id = visit.clinic_id
        WHERE visit.status <> 'cancelled'
          AND ($1::text IN ('all', lab.status) OR ($1 = 'open' AND lab.status IN ('requested', 'in_progress')))
          AND ($2 = '%%' OR patient.full_name ILIKE $2 OR patient.medical_record_no ILIKE $2)
          AND NOT EXISTS (
            SELECT 1 FROM integration_outbox AS event
            WHERE event.lab_order_id = lab.id AND event.event_type = 'lab.order.requested' AND event.published_at IS NULL
          )
      )
      SELECT (SELECT count(*) FROM matching) AS total,
        COALESCE((
          SELECT jsonb_agg(to_jsonb(orders)) FROM (
            SELECT id::text AS id, visit_id::text AS visit_id, status, ordered_at,
              visit_date, patient_name, medical_record_no, clinic_name
            FROM matching
            ORDER BY CASE WHEN $1 = 'open' THEN ordered_at END, ordered_at DESC, matching.id DESC
            LIMIT $3 OFFSET $4
          ) AS orders
        ), '[]'::jsonb) AS items
    `, [status, pattern, pageSize, (page - 1) * pageSize]);

    return { items: result.items, total: Number(result.total), page, page_size: pageSize };
  } catch (error) {
    console.error('Antrean lab gagal dibaca.', error.code ?? error.name);
    throw new HttpError(503, 'Antrean laboratorium sedang tidak tersedia.');
  }
}

export function startLabIntake() {
  let failed = false;

  async function publish() {
    try {
      // Tanda terbit membuat permintaan terlihat di antrean Node.js.
      await db.query(`
        WITH pending AS (
          SELECT id FROM integration_outbox
          WHERE event_type = 'lab.order.requested' AND published_at IS NULL AND next_attempt_at <= CURRENT_TIMESTAMP
          ORDER BY next_attempt_at, id
          LIMIT 100 FOR UPDATE SKIP LOCKED
        )
        UPDATE integration_outbox AS event
        SET published_at = clock_timestamp(), attempt_count = attempt_count + 1, last_error = NULL
        FROM pending WHERE event.id = pending.id
      `);
      failed = false;
    } catch (error) {
      if (!failed) console.warn('Penerimaan permintaan lab akan dicoba ulang.', error.code ?? error.name);
      failed = true;
    }

    setTimeout(publish, 2000).unref();
  }

  void publish();
}
