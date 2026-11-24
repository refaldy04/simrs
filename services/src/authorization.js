import { sendProblem } from './errors.js';

export const coreApiTarget = process.env.CORE_API_TARGET ?? 'http://127.0.0.1:8080';

export function requirePermission(permission) {
  const url = new URL('/auth/access', coreApiTarget);
  url.searchParams.set('permission', permission);

  return async function authorize(request, response, next) {
    response.set('Cache-Control', 'no-store');
    const authorization = request.get('authorization');
    if (!authorization) {
      return sendProblem(response, 401, 'Token akses diperlukan.');
    }

    try {
      const check = await fetch(url, {
        headers: { authorization, accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
        redirect: 'error',
      });
      if (check.status === 401) {
        return sendProblem(response, 401, 'Token akses tidak valid atau sudah kedaluwarsa.');
      }
      if (check.status === 403) {
        return sendProblem(response, 403, 'Akses ditolak untuk peran akun ini.');
      }
      if (check.ok) {
        const result = await check.json();
        if (result.allowed === true && result.permission === permission) return next();
      }
    } catch {
      return sendProblem(response, 503, 'Layanan autentikasi sedang tidak tersedia.');
    }

    return sendProblem(response, 503, 'Layanan autentikasi sedang tidak tersedia.');
  };
}
