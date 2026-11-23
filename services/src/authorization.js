const coreApiTarget = process.env.CORE_API_TARGET ?? 'http://127.0.0.1:8080';

function deny(response, status, name, message) {
  if (status === 401) response.set('WWW-Authenticate', 'Bearer');
  return response.status(status).json({ name, message, code: 0, status });
}

export function requirePermission(permission) {
  const url = new URL('/auth/access', coreApiTarget);
  url.searchParams.set('permission', permission);

  return async function authorize(request, response, next) {
    response.set('Cache-Control', 'no-store');
    const authorization = request.get('authorization');
    if (!authorization) {
      return deny(response, 401, 'Unauthorized', 'Token akses diperlukan.');
    }

    try {
      const check = await fetch(url, {
        headers: { authorization, accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
        redirect: 'error',
      });
      if (check.status === 401) {
        return deny(response, 401, 'Unauthorized', 'Token akses tidak valid atau sudah kedaluwarsa.');
      }
      if (check.status === 403) {
        return deny(response, 403, 'Forbidden', 'Akses ditolak untuk peran akun ini.');
      }
      if (check.ok) {
        const result = await check.json();
        if (result.allowed === true && result.permission === permission) return next();
      }
    } catch {
      return deny(response, 503, 'Service Unavailable', 'Layanan autentikasi sedang tidak tersedia.');
    }

    return deny(response, 503, 'Service Unavailable', 'Layanan autentikasi sedang tidak tersedia.');
  };
}
