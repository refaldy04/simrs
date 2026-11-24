async function checkHealth(path, signal) {
  const response = await fetch(path, { cache: 'no-store', signal });
  const data = await response.json();
  return response.ok && data.status === 'ok';
}

export function checkCoreHealth(signal) {
  return checkHealth('/api/core/health', signal);
}

export function checkNodeHealth(signal) {
  return checkHealth('/api/services/health', signal);
}
