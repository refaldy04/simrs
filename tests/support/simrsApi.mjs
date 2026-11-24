import assert from 'node:assert/strict';

const base = process.env.SIMRS_TEST_API_URL;
const demoPassword = process.env.SIMRS_TEST_PASSWORD ?? 'SimrsDemo2026!';
export const demoDate = '2026-11-23';

export async function request(path, { token, method = 'GET', body, baseUrl = base } = {}) {
  assert.ok(baseUrl, 'Arahkan API ke stack pengujian yang sudah di-seed.');
  const headers = { Accept: 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(baseUrl.replace(/\/$/, '') + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(12000),
  });

  return { status: response.status, data: await response.json().catch(() => null) };
}

export async function expect(status, path, options) {
  const result = await request(path, options);
  assert.equal(result.status, status, (options?.method ?? 'GET') + ' ' + path + ' ' + (result.data?.message ?? ''));

  return result.data;
}

export async function login(username) {
  const result = await expect(200, '/auth/login', { method: 'POST', body: { username, password: demoPassword } });

  return result.access_token;
}
