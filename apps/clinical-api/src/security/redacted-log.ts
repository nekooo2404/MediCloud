const safeSynthetic = (value: string | undefined, fallback: string) => value?.match(/^synthetic-[a-z0-9-]+$/) ? value : fallback;

export function redactedMutationLog(input: {action: string; status: number; correlationId: string; resourceRef?: string; reason?: string}) {
  return {
    event: 'clinical_api.mutation',
    action: safeSynthetic(input.action, 'synthetic-redacted-action'),
    status: input.status,
    correlation_id: safeSynthetic(input.correlationId, 'synthetic-redacted-correlation'),
    resource_ref: safeSynthetic(input.resourceRef, 'synthetic-redacted-resource'),
    reason: safeSynthetic(input.reason, 'synthetic-redacted-reason'),
  };
}
