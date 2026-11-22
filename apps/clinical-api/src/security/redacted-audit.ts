import type {AuthorizationDecision} from './types.js';

export function toAuthorizationAudit(decision: AuthorizationDecision, correlationId: string) {
  if (!/^synthetic-[a-z0-9-]+$/.test(correlationId) || !/^synthetic-[a-z0-9-]+$/.test(decision.audit.resourceRef)) throw new Error('Audit context is required');
  return {
    action: decision.audit.action,
    reason: decision.audit.reason,
    resource_ref: decision.audit.resourceRef,
    correlation_id: correlationId,
  };
}
