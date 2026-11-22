import {describe, expect, it} from 'vitest';
import {bookingFingerprint, validateBookingRequest} from '../apps/clinical-api/src/scheduling/service.js';

const context = {correlationId: 'synthetic-trace-t05', idempotencyHeader: 'synthetic-idempotency-001'};
const input = {slotId: '00000000-0000-4000-8000-000000000201', patientId: '00000000-0000-4000-8000-000000000031', idempotencyKey: 'synthetic-idempotency-001'};

describe('T05 scheduling request rules', () => {
  it('accepts matching idempotency header and body key', () => expect(() => validateBookingRequest(input, context)).not.toThrow());
  it('rejects a mismatched idempotency key', () => {
    expect(() => validateBookingRequest({...input, idempotencyKey: 'synthetic-idempotency-002'}, context)).toThrowError('Idempotency-Key must match body.idempotency_key');
  });
  it('rejects short keys and invalid correlation IDs', () => {
    try {
      validateBookingRequest({...input, idempotencyKey: 'short'}, {...context, idempotencyHeader: 'short'});
      expect.fail('expected short idempotency key to be rejected');
    } catch (error) {
      expect(error).toMatchObject({code: 'idempotency_key_mismatch', status: 409});
    }
    try {
      validateBookingRequest(input, {...context, correlationId: 'raw-trace'});
      expect.fail('expected invalid correlation ID to be rejected');
    } catch (error) {
      expect(error).toMatchObject({code: 'invalid_correlation_id', status: 400});
    }
  });
  it('changes the request fingerprint when booking inputs change', () => {
    expect(bookingFingerprint(input, 'portal')).not.toBe(bookingFingerprint({...input, slotId: '00000000-0000-4000-8000-000000000202'}, 'portal'));
    expect(bookingFingerprint(input, 'portal')).not.toBe(bookingFingerprint(input, 'staff'));
    expect(bookingFingerprint(input, 'portal')).toBe(bookingFingerprint({...input}, 'portal'));
  });
});
