class ApiError extends Error {
  constructor(status, message, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export async function coreRequest(path, { method = 'GET', token, body, signal } = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body !== undefined) headers.set('Content-Type', 'application/json');

  const timeout = AbortSignal.timeout(10000);
  let response;
  try {
    response = await fetch(`/api/core/${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, 'Layanan SIMRS sulit dihubungi. Coba lagi.');
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    const message = response.status >= 500 ? null : data?.message;
    throw new ApiError(response.status, message ?? 'Permintaan gagal. Coba lagi.', data?.errors);
  }

  return data;
}
