import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { demoDate, expect, login, request } from './support/simrsApi.mjs';

const visitPath = (id) => '/billing/visits/' + id;
const paymentPath = (id) => '/billing/invoices/' + id + '/payments';

test('Penerbitan invoice dan pembayaran bertahap idempoten', async (t) => {
  const [admin, registrar, doctor, internalDoctor, pharmacy, cashier] = await Promise.all([
    login('demo.admin'), login('demo.pendaftaran'), login('demo.dokter.umum'),
    login('demo.dokter.dalam'), login('demo.farmasi'), login('demo.kasir'),
  ]);

  const patient = await expect(201, '/master-data/patients', {
    method: 'POST', token: admin,
    body: {
      medical_record_no: 'TEST-BILL-' + randomUUID().slice(0, 8), full_name: 'Pasien fiktif uji billing',
      birth_date: '1990-01-01', sex: 'unspecified',
    },
  });

  async function register(doctorToken) {
    const schedules = await expect(200, '/registration/schedules?date=' + demoDate, { token: doctorToken });
    assert.ok(schedules.items[0], 'Jadwal dokter demo tersedia.');

    return expect(201, '/registration/visits', {
      method: 'POST', token: registrar, body: { patient_id: patient.id, schedule_id: schedules.items[0].id },
    });
  }

  const [general, internal] = await Promise.all([register(doctor), register(internalDoctor)]);
  const examinations = [general, internal].map((visit) => '/examinations/visits/' + visit.id);
  const issue = (visit) => request(visitPath(visit.id) + '/invoice', { method: 'POST', token: cashier });
  const detail = (visit) => expect(200, visitPath(visit.id), { token: cashier });
  const pay = (invoice, body) => request(paymentPath(invoice.id), { method: 'POST', token: cashier, body });

  await expect(403, '/billing/visits', { token: doctor });
  assert.equal((await issue(general)).status, 409);

  const draft = { chief_complaint: 'Keluhan simulasi billing', diagnoses: [], expected_updated_at: null };
  const [generalExam, internalExam] = await Promise.all([
    expect(200, examinations[0], { method: 'PUT', token: doctor, body: draft }),
    expect(200, examinations[1], { method: 'PUT', token: internalDoctor, body: draft }),
  ]);

  const procedurePath = '/procedures/visits/' + general.id + '/items';
  const procedures = (await expect(200, '/procedures/visits/' + general.id, { token: doctor })).options;
  const performed = procedures.find((item) => item.code === 'DEMO-TDK-001');
  const removed = procedures.find((item) => item.code === 'DEMO-TDK-002');
  await expect(201, procedurePath, {
    method: 'POST', token: doctor, body: { procedure_id: performed.id, quantity: 2 },
  });
  const added = await expect(201, procedurePath, {
    method: 'POST', token: doctor, body: { procedure_id: removed.id },
  });
  const cancelled = added.items.find((item) => item.procedure_id === removed.id);
  await expect(200, procedurePath + '/' + cancelled.id + '/cancel', {
    method: 'POST', token: doctor, body: { expected_quantity: 1 },
  });

  const prescriptionPath = '/prescriptions/visits/' + general.id;
  const medicines = (await expect(200, prescriptionPath, { token: doctor })).medicines;
  async function prescribe(medicine) {
    return (await expect(201, prescriptionPath, {
      method: 'POST', token: doctor, body: {
        idempotency_key: randomUUID(), items: [{
          medicine_id: medicine.id, dose: 'Dosis simulasi', frequency: 'Frekuensi simulasi', quantity: 2,
        }],
      },
    })).prescription;
  }

  const recipe = await prescribe(medicines.find((item) => item.code === 'DEMO-OBT-001'));
  await prescribe(medicines.find((item) => item.code === 'DEMO-OBT-002'));
  await expect(200, '/pharmacy/prescriptions/' + recipe.id + '/dispense', { method: 'POST', token: pharmacy });

  function finish(path, token, exam) {
    return expect(200, path, {
      method: 'PUT', token, body: {
        ...draft, expected_updated_at: exam.examination.updated_at, finish: true,
        diagnoses: [{ description: 'Diagnosis fiktif uji billing', is_primary: true }],
      },
    });
  }
  await Promise.all([
    finish(examinations[0], doctor, generalExam), finish(examinations[1], internalDoctor, internalExam),
  ]);

  let firstInvoice;
  let secondInvoice;
  await t.test('Satu invoice per kunjungan dan hanya komponen layanan yang selesai', async () => {
    const quote = await detail(general);
    assert.equal(quote.can_issue, true);
    assert.deepEqual(quote.billing.items.map((item) => item.item_type), ['registration', 'procedure', 'medicine']);

    const results = await Promise.all([issue(general), issue(general)]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 201], results.map((result) => result.data?.message).join(' / '));
    firstInvoice = results[0].data.detail.billing.invoice;
    assert.equal(firstInvoice.id, results[1].data.detail.billing.invoice.id);
    assert.equal(firstInvoice.status, 'unpaid');
    assert.equal(firstInvoice.total_amount, quote.billing.total_amount);
    assert.deepEqual(results[0].data.detail.billing.items, quote.billing.items);

    const second = await issue(internal);
    assert.equal(second.status, 201, second.data?.message);
    secondInvoice = second.data.detail.billing.invoice;
  });

  await t.test('UUID global yang sama aman ketika dipakai pada dua invoice', async () => {
    const body = { idempotency_key: randomUUID(), amount: '0.01', method: 'cash' };
    const results = await Promise.all([pay(firstInvoice, body), pay(secondInvoice, body)]);
    assert.deepEqual(results.map((result) => result.status).sort(), [201, 409], results.map((result) => result.data?.message).join(' / '));
    assert.match(results.find((result) => result.status === 409).data.message, /kunci pembayaran/i);
    const left = (await detail(general)).billing.invoice;
    const right = (await detail(internal)).billing.invoice;
    assert.equal(Number(left.paid_amount) + Number(right.paid_amount), 0.01);
  });

  await t.test('Bayar bertahap, tolak saldo ganda, dan ulangi bukti bayar', async () => {
    const previous = (await detail(general)).billing.invoice;
    const partial = { idempotency_key: randomUUID(), amount: '12500.10', method: 'cash' };
    const copies = await Promise.all([pay(firstInvoice, partial), pay(firstInvoice, partial)]);
    assert.deepEqual(copies.map((result) => result.status).sort(), [200, 201], copies.map((result) => result.data?.message).join(' / '));
    assert.deepEqual(copies[0].data.payment, copies[1].data.payment);
    const afterPartial = copies[0].data.detail.billing.invoice;
    assert.equal(afterPartial.paid_amount, (Number(previous.paid_amount) + 12500.10).toFixed(2));
    assert.equal(afterPartial.status, 'partial');
    assert.equal((await pay(firstInvoice, { ...partial, amount: '12500.11' })).status, 409);
    assert.equal((await pay(firstInvoice, { ...partial, method: 'non_cash' })).status, 409);

    const final = {
      idempotency_key: randomUUID(), amount: afterPartial.balance_amount, method: 'non_cash',
      external_reference: 'TRANSFER-SIMULASI',
    };
    const competing = { ...final, idempotency_key: randomUUID() };
    const last = await Promise.all([pay(firstInvoice, final), pay(firstInvoice, competing)]);
    assert.deepEqual(last.map((result) => result.status).sort(), [201, 409]);
    const paid = last.find((result) => result.status === 201).data;
    assert.equal(paid.detail.billing.invoice.status, 'paid');
    assert.equal(paid.detail.billing.invoice.balance_amount, '0.00');
    assert.equal(paid.detail.visit.status, 'completed');
    assert.equal(paid.payment.external_reference, final.external_reference);

    const replay = await pay(firstInvoice, last[0].status === 201 ? final : competing);
    assert.equal(replay.status, 200);
    assert.equal(replay.data.replayed, true);
    assert.deepEqual(replay.data.payment, paid.payment);
    assert.equal(replay.data.detail.billing.invoice.status, 'paid');
    assert.equal((await pay(firstInvoice, { ...final, idempotency_key: randomUUID() })).status, 409);

    const second = await pay(secondInvoice, { amount: '2500', method: 'cash', idempotency_key: randomUUID() });
    assert.equal(second.status, 201, second.data?.message);
    const history = await expect(200, visitPath(general.id) + '/history?page=1&page_size=20', { token: cashier });
    assert.equal(history.total, 4);
    assert.ok(history.items.some((payment) => payment.invoice_id === secondInvoice.id));
    assert.ok(history.items.some((payment) => payment.receipt_no === paid.payment.receipt_no));
  });
});
