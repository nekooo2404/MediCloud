export interface RedactedBffLogInput {
  action: string;
  status: number;
  correlationId: string;
  mode: 'upstream' | 'synthetic';
  reason?: string;
}

export function createRedactedBffLog(input: RedactedBffLogInput) {
  return {
    ts: new Date().toISOString(),
    service: 'patient-portal-bff',
    action: input.action,
    status: input.status,
    correlation_id: input.correlationId,
    mode: input.mode,
    reason: input.reason ?? 'ok',
  };
}

export function logBffEvent(input: RedactedBffLogInput): void {
  if (process.env.NODE_ENV === 'test') return;
  console.info(JSON.stringify(createRedactedBffLog(input)));
}
