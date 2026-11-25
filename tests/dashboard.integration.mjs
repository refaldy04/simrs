import assert from 'node:assert/strict';
import test from 'node:test';
import { demoDate, expect, login } from './support/simrsApi.mjs';

const servicesUrl = process.env.SIMRS_TEST_SERVICES_URL;
const summaryPath = '/dashboard/summary';
const invoicesPath = '/dashboard/invoices';
const demoPeriod = '?date_from=' + demoDate + '&date_to=' + demoDate;

test('Dashboard membatasi akses dan memvalidasi periode', async () => {
  assert.ok(servicesUrl, 'Isi SIMRS_TEST_SERVICES_URL untuk API Node.js pengujian.');
  const [admin, doctor] = await Promise.all([login('demo.admin'), login('demo.dokter.umum')]);
  const fromNode = (status, path, token = admin) => expect(status, path, { baseUrl: servicesUrl, token });

  try {
    await expect(401, summaryPath, { baseUrl: servicesUrl });
    await fromNode(403, summaryPath + demoPeriod, doctor);
    await fromNode(403, invoicesPath + demoPeriod, doctor);
    await fromNode(400, summaryPath + '?date_from=2026-02-30&date_to=2026-03-01');
    await fromNode(400, summaryPath + '?date_from=2026-11-24&date_to=2026-11-23');
    await fromNode(400, summaryPath + '?date_to=' + demoDate);
    await fromNode(400, summaryPath + demoPeriod + '&date_to=' + demoDate);
    await fromNode(400, invoicesPath + demoPeriod + '&status=waiting');
    await fromNode(400, invoicesPath + demoPeriod + '&page_size=101');

    const todayParts = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Jakarta',
    });
    const before = todayParts.format(new Date());
    const defaultSummary = await fromNode(200, summaryPath);
    const after = todayParts.format(new Date());
    assert.ok([before, after].includes(defaultSummary.period.date_to));
    assert.equal(defaultSummary.period.date_from, defaultSummary.period.date_to.slice(0, 7) + '-01');
    assert.equal(defaultSummary.period.time_zone, 'Asia/Jakarta');
  } finally {
    await Promise.all([admin, doctor].map((token) => expect(204, '/auth/logout', { token, method: 'POST' })));
  }
});

test('Statistik, rincian invoice, dan periode kosong konsisten', async () => {
  assert.ok(servicesUrl, 'Isi SIMRS_TEST_SERVICES_URL untuk API Node.js pengujian.');
  const token = await login('demo.admin');
  const options = { token, baseUrl: servicesUrl };
  const cents = (amount) => BigInt(amount.replace('.', ''));

  try {
    const summary = await expect(200, summaryPath + demoPeriod, options);
    assert.deepEqual(summary.period, { date_from: demoDate, date_to: demoDate, time_zone: 'Asia/Jakarta' });
    assert.ok(summary.visits.total >= 5);
    assert.ok(summary.visits.by_clinic.some((clinic) => clinic.name === 'Poli Umum Demo' && clinic.count >= 3));
    assert.equal(summary.visits.total, summary.visits.by_clinic.reduce((sum, clinic) => sum + clinic.count, 0));
    assert.ok(summary.procedures.total >= 3);
    assert.equal(summary.procedures.total, summary.procedures.items.reduce((sum, item) => sum + item.quantity, 0));
    assert.equal(summary.medicines.total_types, summary.medicines.items.length);
    assert.ok(summary.medicines.items.some((item) => item.code === 'DEMO-OBT-001' && item.quantity >= 10));
    assert.ok(cents(summary.revenue.total_amount) >= 43500000n);
    assert.equal(cents(summary.revenue.total_amount), summary.revenue.by_method.reduce((sum, entry) => sum + cents(entry.amount), 0n));
    assert.equal(summary.invoices.total, summary.invoices.by_status.reduce((sum, entry) => sum + entry.count, 0));
    assert.equal(cents(summary.invoices.balance_amount), summary.invoices.by_status.reduce((sum, entry) => sum + cents(entry.balance_amount), 0n));

    const invoices = await expect(200, invoicesPath + demoPeriod + '&page_size=1', options);
    const nextPage = await expect(200, invoicesPath + demoPeriod + '&page_size=1&page=2', options);
    assert.equal(invoices.total, summary.invoices.total);
    assert.equal(invoices.items.length, 1);
    assert.notEqual(invoices.items[0].id, nextPage.items[0].id);
    assert.equal(nextPage.page, 2);

    for (const status of ['unpaid', 'partial', 'paid']) {
      const list = await expect(200, invoicesPath + demoPeriod + '&status=' + status + '&page_size=1', options);
      assert.equal(list.total, summary.invoices.by_status.find((entry) => entry.status === status)?.count ?? 0);
      assert.ok(list.items.every((invoice) => invoice.status === status));
    }

    const emptyPeriod = '?date_from=1900-01-01&date_to=1900-01-01';
    const empty = await expect(200, summaryPath + emptyPeriod, options);
    assert.deepEqual(empty.visits, { total: 0, by_clinic: [] });
    assert.deepEqual(empty.procedures, { total: 0, items: [] });
    assert.deepEqual(empty.medicines, { total_types: 0, items: [] });
    assert.deepEqual(empty.revenue, { total_amount: '0.00', payment_count: 0, by_method: [] });
    assert.deepEqual(empty.invoices, { total: 0, balance_amount: '0.00', by_status: [] });
    const emptyInvoices = await expect(200, invoicesPath + emptyPeriod, options);
    assert.equal(emptyInvoices.total, 0);
    assert.deepEqual(emptyInvoices.items, []);
  } finally {
    await expect(204, '/auth/logout', { token, method: 'POST' });
  }
});
