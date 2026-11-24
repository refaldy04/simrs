import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as pause } from 'node:timers/promises';
import test from 'node:test';
import { demoDate, expect, login, request } from './support/simrsApi.mjs';

const servicesUrl = process.env.SIMRS_TEST_SERVICES_URL;
const visitLab = (id) => '/lab/visits/' + id;
const orderLab = (id) => '/lab/orders/' + id;

test('Permintaan lab, hasil atomik, dan biaya pada invoice yang sudah terbit', async () => {
  assert.ok(servicesUrl, 'Isi SIMRS_TEST_SERVICES_URL untuk API Node.js pengujian.');
  const [admin, registrar, doctor, secondDoctor, staff, cashier] = await Promise.all([
    login('demo.admin'), login('demo.pendaftaran'), login('demo.dokter.umum'),
    login('demo.dokter.dalam'), login('demo.lab'), login('demo.kasir'),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const [{ id: patientId, medical_record_no: recordNo }, optionalTest] = await Promise.all([
    expect(201, '/master-data/patients', {
      method: 'POST', token: admin, body: {
        medical_record_no: 'TEST-LAB-' + suffix, full_name: 'Pasien fiktif uji laboratorium',
        birth_date: '1990-01-01', sex: 'unspecified',
      },
    }),
    expect(201, '/master-data/lab-tests', {
      method: 'POST', token: admin, body: {
        code: 'TEST-LAB-' + suffix, name: 'Pemeriksaan fiktif uji biaya', price: '21000.00',
      },
    }),
  ]);

  async function register(token) {
    const { items } = await expect(200, '/registration/schedules?date=' + demoDate, { token });
    assert.ok(items[0], 'Jadwal dokter demo tersedia.');
    return expect(201, '/registration/visits', {
      method: 'POST', token: registrar, body: { patient_id: patientId, schedule_id: items[0].id },
    });
  }

  const [visit, nextVisit] = await Promise.all([register(doctor), register(secondDoctor)]);
  const labPath = visitLab(visit.id);
  const exam = '/examinations/visits/' + visit.id;
  const bill = '/billing/visits/' + visit.id;
  const fromNode = (status, path, options) => expect(status, path, { token: staff, baseUrl: servicesUrl, ...options });
  const place = (body) => request(labPath + '/orders', { token: doctor, method: 'POST', body });
  const initial = { chief_complaint: 'Keluhan fiktif uji laboratorium', diagnoses: [], expected_updated_at: null };
  const { examination } = await expect(200, exam, { method: 'PUT', token: doctor, body: initial });

  await expect(404, labPath + '/history', { token: secondDoctor });
  await fromNode(401, '/lab/orders', { token: undefined });
  await fromNode(403, '/lab/orders', { token: doctor });
  await fromNode(400, '/lab/orders?page_size=101');

  const lab = await expect(200, labPath, { token: doctor });
  assert.equal(lab.can_order, true);
  assert.deepEqual(lab.orders, []);
  const demoTest = lab.tests.find((item) => item.code === 'DEMO-LAB-002');
  assert.ok(demoTest);

  const body = {
    idempotency_key: randomUUID(), lab_test_ids: [optionalTest.id, demoTest.id],
    clinical_notes: 'Catatan klinis fiktif uji laboratorium',
  };
  assert.equal((await place({ ...body, lab_test_ids: [optionalTest.id, optionalTest.id] })).status, 422);
  const placements = await Promise.all([place(body), place({ ...body, lab_test_ids: [...body.lab_test_ids].reverse() })]);
  assert.deepEqual(placements.map((result) => result.status).sort(), [200, 201], placements.map((entry) => entry.data?.message).join(' / '));
  const order = placements.find((entry) => entry.status === 201).data.order;
  assert.equal(placements.find((entry) => entry.status === 200).data.order.id, order.id);
  assert.equal((await place({ ...body, clinical_notes: 'Isian berbeda' })).status, 409);

  let opened;
  const queuePath = '/lab/orders?q=' + encodeURIComponent(recordNo) + '&page_size=1';
  for (let attempt = 0; attempt < 12; attempt += 1) {
    opened = await fromNode(200, queuePath);
    if (opened.total > 0) break;
    await pause(250);
  }
  assert.equal(opened.total, 1);
  assert.equal(opened.items[0].id, order.id);
  assert.equal((await fromNode(200, queuePath + '&page=2')).total, 1);
  const orderPath = orderLab(order.id);
  const resultsPath = orderPath + '/results';
  const results = order.items.map((item, index) => ({
    lab_order_item_id: item.id, result_value: 'Hasil fiktif ' + (index + 1),
    unit: 'unit simulasi', reference_range: 'Rujukan fiktif', notes: 'Catatan fiktif',
  }));

  await fromNode(403, resultsPath, { token: doctor, method: 'PUT', body: { items: results } });
  await fromNode(415, resultsPath, { method: 'PUT' });
  await fromNode(422, resultsPath, { method: 'PUT', body: { items: results.slice(0, 1) } });
  const stillOpen = await fromNode(200, orderPath);
  assert.equal(stillOpen.status, 'requested');
  assert.ok(stillOpen.items.every((item) => item.result === null));
  assert.equal((await expect(200, labPath + '/history', { token: doctor })).total, 0);

  await expect(200, '/master-data/lab-tests/' + optionalTest.id, {
    method: 'PATCH', token: admin, body: { price: '98000.00' },
  });
  await expect(200, exam, {
    method: 'PUT', token: doctor, body: {
      ...initial, expected_updated_at: examination.updated_at, finish: true,
      diagnoses: [{ description: 'Diagnosis fiktif uji laboratorium', is_primary: true }],
    },
  });
  const { detail } = await expect(201, bill + '/invoice', { method: 'POST', token: cashier });
  assert.deepEqual(detail.billing.items.map((item) => item.item_type), ['registration']);
  const original = detail.billing.invoice;
  const paid = await expect(201, '/billing/invoices/' + original.id + '/payments', {
    method: 'POST', token: cashier, body: {
      idempotency_key: randomUUID(), amount: original.total_amount, method: 'cash',
    },
  });
  assert.equal(paid.detail.visit.status, 'completed');

  const submit = (items) => fromNode(200, resultsPath, { method: 'PUT', body: { items } });
  const saves = await Promise.all([submit(results), submit([...results].reverse())]);
  assert.deepEqual(saves.map((entry) => entry.replayed).sort(), [false, true]);
  assert.deepEqual(saves[0].order, saves[1].order);
  assert.equal(saves[0].order.status, 'completed');
  assert.ok(saves[0].order.items.every((item) => item.result.entered_by_name && item.result.entered_at));
  const changed = [{ ...results[0], result_value: 'Isian berbeda' }, results[1]];
  await fromNode(409, resultsPath, { method: 'PUT', body: { items: changed } });
  assert.equal((await fromNode(200, queuePath)).total, 0);
  assert.equal((await fromNode(200, queuePath + '&status=completed')).items[0].id, order.id);

  const updated = await expect(200, bill, { token: cashier });
  assert.equal(updated.visit.status, 'awaiting_billing');
  assert.equal(updated.billing.invoice.id, original.id);
  assert.equal(updated.billing.invoice.paid_amount, original.total_amount);
  assert.equal(updated.billing.invoice.balance_amount, (21000 + Number(demoTest.price)).toFixed(2));
  assert.equal(updated.billing.invoice.status, 'partial');
  assert.deepEqual(updated.billing.items.filter((item) => item.item_type === 'lab').map((item) => item.unit_price).sort(),
    ['21000.00', demoTest.price].sort());

  const history = await expect(200, visitLab(nextVisit.id) + '/history?page_size=1', { token: secondDoctor });
  assert.equal(history.total, 1);
  assert.deepEqual(history.items[0], saves[0].order);
});
