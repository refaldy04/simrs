import { coreRequest } from './coreRequest.js';

export function getVisitProcedures(visitId, options) {
  return coreRequest('procedures/visits/' + visitId, options);
}

export function addVisitProcedure(visitId, body, options) {
  return coreRequest('procedures/visits/' + visitId + '/items', { ...options, method: 'POST', body });
}

export function updateVisitProcedure(visitId, itemId, body, options) {
  return coreRequest('procedures/visits/' + visitId + '/items/' + itemId, { ...options, method: 'PATCH', body });
}

export function cancelVisitProcedure(visitId, itemId, body, options) {
  return coreRequest('procedures/visits/' + visitId + '/items/' + itemId + '/cancel', { ...options, method: 'POST', body });
}
