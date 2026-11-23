const TOKEN_STORAGE_KEY = 'simrs.access_token';

export function readStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token) {
  try {
    if (token === null) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    }
  } catch {
    // The in-memory session still works if the browser restricts storage.
  }
}

class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function authRequest(path, { method = 'GET', token, body, signal } = {}) {
  const headers = new Headers({ Accept: 'application/json' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body) headers.set('Content-Type', 'application/json');

  const timeout = AbortSignal.timeout(10000);
  let response;
  try {
    response = await fetch(`/api/core/auth/${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new AuthError(0, 'Layanan SIMRS sulit dihubungi. Coba lagi.');
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok || data === null) {
    const message = response.status >= 500 ? null : data?.message;
    throw new AuthError(response.status, message ?? 'Permintaan gagal. Coba lagi.');
  }

  return data;
}
