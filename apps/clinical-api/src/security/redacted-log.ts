const ACTION_RE = /^[a-z][a-z0-9._:-]{1,79}$/i;
const CORRELATION_RE = /^(?:synthetic-[a-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|req-[a-z0-9-]+)$/i;
const RESOURCE_REF_RE = /^(?:synthetic-[a-z0-9-]+|[a-z]+:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const REASON_RE = /^[a-z0-9][a-z0-9._:-]{1,79}$/i;

function sanitizeToken(value: string | undefined, pattern: RegExp, fallback: string): string {
  if (!value) return fallback;
  return pattern.test(value) ? value : fallback;
}

export function redactedMutationLog(input: {
  action: string;
  status: number;
  correlationId: string;
  resourceRef?: string;
  reason?: string;
  tenantCode?: string;
}) {
  return {
    event: 'clinical_api.mutation',
    action: sanitizeToken(input.action, ACTION_RE, 'redacted.action'),
    status: Number.isFinite(input.status) ? input.status : 500,
    correlation_id: sanitizeToken(input.correlationId, CORRELATION_RE, 'synthetic-redacted-correlation'),
    resource_ref: sanitizeToken(input.resourceRef, RESOURCE_REF_RE, 'synthetic-redacted-resource'),
    reason: sanitizeToken(input.reason, REASON_RE, 'ok'),
    ...(input.tenantCode ? {tenant: sanitizeToken(input.tenantCode, REASON_RE, 'redacted-tenant')} : {}),
  };
}
