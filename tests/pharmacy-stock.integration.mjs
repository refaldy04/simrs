import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';

const base = process.env.SIMRS_TEST_API_URL;
const demoDate = '2026-11-23';
const demoPassword = process.env.SIMRS_TEST_PASSWORD ?? 'SimrsDemo2026!';

async function request(path, { token, method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(base.replace(/\/$/, '') + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });

  return { status: response.status, data: await response.json().catch(() => null) };
}

async function expect(status, path, options) {
  const result = await request(path, options);
  assert.equal(result.status, status, (options?.method ?? 'GET') + ' ' + path + ' ' + (result.data?.message ?? ''));

  return result.data;
}

async function login(username) {
  const result = await expect(200, '/auth/login', { method: 'POST', body: { username, password: demoPassword } });

  return result.access_token;
}

function prescriptionItem(medicine, quantity) {
  return {
    medicine_id: medicine.id,
    dose: 'Dosis simulasi',
    frequency: 'Frekuensi simulasi',
    quantity,
    expected_unit_price: medicine.price,
  };
}

test('Resep dan penyerahan menjaga stok serta komponen tagihan', async (t) => {
  assert.ok(base, 'Arahkan SIMRS_TEST_API_URL ke stack pengujian yang sudah di-seed.');
  const [admin, registrar, doctor, pharmacy] = await Promise.all([
    login('demo.admin'), login('demo.pendaftaran'), login('demo.dokter.umum'), login('demo.farmasi'),
  ]);
  const suffix = randomUUID().slice(0, 8);

  function addMedicine(label, price, stock) {
    return expect(201, '/master-data/medicines', {
      method: 'POST', token: admin,
      body: { code: 'TEST-STK-' + suffix + '-' + label, name: 'Obat uji stok ' + label, unit: 'unit', price, stock_quantity: stock },
    });
  }

  async function makeVisit(label) {
    const patient = await expect(201, '/master-data/patients', {
      method: 'POST', token: admin,
      body: {
        medical_record_no: 'TEST-STK-' + suffix + '-' + label,
        full_name: 'Pasien uji stok ' + label,
        birth_date: '1990-01-01',
        sex: 'unspecified',
      },
    });
    const schedules = await expect(200, '/registration/schedules?date=' + demoDate, { token: doctor });
    assert.ok(schedules.items[0], 'Jadwal dokter demo tersedia.');
    const visit = await expect(201, '/registration/visits', {
      method: 'POST', token: registrar, body: { patient_id: patient.id, schedule_id: schedules.items[0].id },
    });
    await expect(200, '/examinations/visits/' + visit.id, {
      method: 'PUT', token: doctor,
      body: { chief_complaint: 'Data fiktif uji resep', expected_updated_at: null, diagnoses: [] },
    });

    return visit;
  }

  const pathFor = (visit) => '/prescriptions/visits/' + visit.id;
  const postPrescription = (visit, body) => request(pathFor(visit), { token: doctor, method: 'POST', body });
  const postDispense = (id) => request('/pharmacy/prescriptions/' + id + '/dispense', { token: pharmacy, method: 'POST' });
  const bill = async (visit) => (await expect(200, '/procedures/visits/' + visit.id, { token: doctor })).billing;
  const stock = async (medicine) => (await expect(200, '/master-data/medicines/' + medicine.id, { token: admin })).stock_quantity;

  async function prescribe(visit, items) {
    const result = await postPrescription(visit, { idempotency_key: randomUUID(), items });
    assert.equal(result.status, 201, result.data?.message);

    return result.data.prescription;
  }

  const visits = await Promise.all([makeVisit('A'), makeVisit('B')]);

  await t.test('Dua resep berebut unit terakhir dan penyerahan ulang tidak mendebit stok', async () => {
    const medicine = await addMedicine('Satu', '1250.00', 1);
    const body = { idempotency_key: randomUUID(), items: [prescriptionItem(medicine, 1)] };
    const results = await Promise.all([postPrescription(visits[0], body), postPrescription(visits[0], body)]);
    assert.deepEqual(results.map((result) => result.status).sort(), [200, 201]);
    assert.equal(results[0].data.prescription.id, results[1].data.prescription.id);
    const first = results[0].data.prescription;
    const second = await prescribe(visits[1], [prescriptionItem(medicine, 1)]);

    assert.equal(await stock(medicine), 1);
    assert.equal((await postPrescription(visits[0], { ...body, items: [prescriptionItem(medicine, 2)] })).status, 409);
    assert.equal((await bill(visits[0])).items.filter((item) => item.item_type === 'medicine').length, 0);

    const doses = await Promise.all([postDispense(first.id), postDispense(second.id)]);
    assert.deepEqual(doses.map((result) => result.status).sort(), [200, 409]);
    const winner = doses.find((result) => result.status === 200).data.prescription;
    const loser = winner.id === first.id ? second : first;
    assert.equal(winner.status, 'dispensed');
    assert.equal((await postDispense(winner.id)).data.prescription.dispensed_at, winner.dispensed_at);
    assert.equal(await stock(medicine), 0);
    const visitsAgain = await expect(200, '/prescriptions/visits/' + loser.visit_id, { token: doctor });
    assert.equal(visitsAgain.prescriptions.find((recipe) => recipe.id === loser.id).status, 'pending');

    const winnerVisit = visits.find((visit) => visit.id === winner.visit_id);
    const history = await expect(200, pathFor(winnerVisit) + '/history', { token: doctor });
    assert.ok(history.items.some((recipe) => recipe.id === winner.id));
    const medicationLines = (await bill(winnerVisit)).items.filter((item) => item.item_type === 'medicine');
    assert.equal(medicationLines.length, 1);
    assert.equal(medicationLines[0].subtotal, '1250.00');
  });

  await t.test('Kekurangan obat kedua mengembalikan stok obat pertama', async () => {
    const first = await addMedicine('Awal', '2500.00', 5);
    const last = await addMedicine('Akhir', '3000.00', 1);
    const multiple = await prescribe(visits[0], [prescriptionItem(first, 2), prescriptionItem(last, 1)]);
    const single = await prescribe(visits[1], [prescriptionItem(last, 1)]);

    assert.equal((await postDispense(single.id)).status, 200);
    assert.equal((await postDispense(multiple.id)).status, 409);
    assert.equal(await stock(first), 5);
    assert.equal(await stock(last), 0);
    const current = await expect(200, pathFor(visits[0]), { token: doctor });
    assert.equal(current.prescriptions.find((recipe) => recipe.id === multiple.id).status, 'pending');
    await expect(200, pathFor(visits[0]) + '/' + multiple.id + '/cancel', { method: 'POST', token: doctor });
    assert.equal((await postDispense(multiple.id)).status, 409);
  });

  await t.test('Tagihan terbit memakai harga pada resep saat obat diserahkan', async () => {
    const queue = await expect(200, '/registration/visits?date=' + demoDate + '&status=awaiting_billing', { token: doctor });
    const demo = queue.items.find((visit) => visit.medical_record_no === 'DEMO-RM-002');
    assert.ok(demo, 'Kunjungan dengan tagihan parsial tersedia.');
    const original = await bill(demo);
    const medicine = await addMedicine('Invoice', '2500.00', 2);
    const recipe = await prescribe(demo, [prescriptionItem(medicine, 2)]);
    await expect(200, '/master-data/medicines/' + medicine.id, {
      method: 'PATCH', token: admin, body: { price: '5000.00' },
    });
    assert.equal((await bill(demo)).total_amount, original.total_amount);

    const handover = await postDispense(recipe.id);
    assert.equal(handover.status, 200, handover.data?.message);
    assert.equal(handover.data.prescription.items[0].unit_price, '2500.00');
    const issued = await bill(demo);
    assert.equal(issued.invoice.id, original.invoice.id);
    assert.equal(issued.invoice.paid_amount, original.invoice.paid_amount);
    assert.equal(Number(issued.total_amount) - Number(original.total_amount), 5000);
    assert.equal((await postDispense(recipe.id)).status, 200);
    assert.equal((await bill(demo)).total_amount, issued.total_amount);
    assert.equal(await stock(medicine), 0);
  });
});
