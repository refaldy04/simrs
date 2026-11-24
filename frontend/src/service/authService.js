import { coreRequest } from './coreRequest.js';

export function login(username, password) {
  return coreRequest('auth/login', { method: 'POST', body: { username, password } });
}

export function getProfile(options) {
  return coreRequest('auth/me', options);
}

export function logout(options) {
  return coreRequest('auth/logout', { ...options, method: 'POST' });
}
