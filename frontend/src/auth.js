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
