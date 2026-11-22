import {describe, expect, it} from 'vitest';
import {createApprovedEvent} from '../apps/clinical-api/src/outbox/policy-gateway.js';
import {isUniqueViolation, retryDelayMs} from '../apps/event-relay/src/relay.js';

describe('T06 outbox policy and relay rules', () => {
  it('accepts an allowlisted appointment event', () => {
    expect(createApprovedEvent({eventType: 'appointment.created', tenantId: 'synthetic-hospital-a', correlationId: 'synthetic-t06-1', payload: {appointment_ref: 'synthetic-appointment-1', channel: 'portal'}}).event_type).toBe('appointment.created');
  });
  it('rejects prohibited or unknown payload fields', () => {
    expect(() => createApprovedEvent({eventType: 'appointment.created', tenantId: 'synthetic-hospital-a', correlationId: 'synthetic-t06-2', payload: {appointment_ref: 'synthetic-appointment-1', channel: 'portal', full_name: 'forbidden'}})).toThrow();
  });
  it('uses bounded exponential backoff and identifies unique event delivery', () => {
    expect(retryDelayMs(1, 100)).toBe(100);
    expect(retryDelayMs(3, 100)).toBe(400);
    expect(retryDelayMs(100, 100)).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    expect(() => retryDelayMs(0, 100)).toThrow();
    expect(() => retryDelayMs(1, 0)).toThrow();
    expect(isUniqueViolation({code: 'P2002'})).toBe(true);
    expect(isUniqueViolation({code: 'P2025'})).toBe(false);
  });
});
