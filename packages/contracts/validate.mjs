import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = new URL('.', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const openapi = await readJson('./openapi.json');
const eventSchema = await readJson('./schemas/event-envelope.schema.json');
const classification = await readJson('./data-classification.json');

assert.equal(openapi.openapi, '3.1.0');
assert.deepEqual(Object.keys(openapi.paths).sort(), [
  '/v1/admin/metrics', '/v1/appointments', '/v1/appointments/{id}',
  '/v1/appointments/{id}/check-in', '/v1/doctors', '/v1/encounters',
  '/v1/encounters/{id}/observations', '/v1/me/records', '/v1/slots',
  '/v1/specialties',
]);
assert.deepEqual(classification.policy, {
  synthetic_only: true,
  private_database_publicly_exposed: false,
  tenant_id_server_derived: true,
  raw_clinical_data_in_public_cloud: false,
});
const appointmentOperation = openapi.paths['/v1/appointments'].post;
assert.equal(appointmentOperation.parameters[0].$ref, '#/components/parameters/IdempotencyKey');
assert.equal(openapi.components.parameters.IdempotencyKey.required, true);
assert.match(openapi.components.parameters.IdempotencyKey.description, /body\.idempotency_key/);
assert.match(openapi.paths['/v1/doctors'].get.description, /non-authoritative/);
assert.equal(openapi.components.parameters.TenantId.required, false);
assert.match(openapi.components.parameters.TenantId.description, /server derives authorization tenant/);
for (const [path, item] of Object.entries(openapi.paths)) {
  for (const [method, operation] of Object.entries(item)) {
    if (!['get', 'post'].includes(method) || operation.security?.length === 0) continue;
    assert.ok(operation.responses['401'], `${method.toUpperCase()} ${path} must declare 401`);
    assert.ok(operation.responses['403'], `${method.toUpperCase()} ${path} must declare 403`);
    assert.ok(operation.responses['404'], `${method.toUpperCase()} ${path} must declare disclosure-safe 404`);
  }
}
for (const responseName of ['Encounter', 'Observation', 'Specialties', 'Doctors', 'Slots', 'Records', 'Metrics']) {
  assert.notEqual(openapi.components.responses[responseName].content['application/json'].schema.$ref, '#/components/schemas/SimpleData');
}

const ajv = new Ajv({strict: false});
addFormats(ajv);
const validateEvent = ajv.compile(eventSchema);
const validEvent = {
  event_id: '00000000-0000-4000-8000-000000000001',
  event_type: 'appointment.created',
  schema_version: 1,
  tenant_id: 'synthetic-hospital-a',
  occurred_at: '2026-11-21T00:00:00Z',
  correlation_id: 'trace-001',
  payload: {appointment_ref: 'synthetic-appointment-001', channel: 'portal'},
};
assert.equal(validateEvent(validEvent), true);
assert.equal(validateEvent({...validEvent, event_type: 'appointment.cancelled'}), false);
assert.equal(validateEvent({...validEvent, event_type: 'encounter.completed', payload: {encounter_ref: 'synthetic-encounter-001', observation_count: 1}}), true);
assert.equal(validateEvent({...validEvent, event_type: 'encounter.completed', payload: {resource_ref: 'synthetic-resource-001'}}), false);
assert.equal(validateEvent({...validEvent, payload: {appointment_ref: 'x', full_name: 'forbidden'}}), false);
assert.equal(validateEvent({...validEvent, event_id: undefined}), false);
for (const field of classification.prohibited_event_fields) {
  assert.equal(validateEvent({...validEvent, payload: {appointment_ref: 'synthetic-appointment-001', channel: 'portal', [field]: 'forbidden'}}), false);
}

console.log('T02 contract validation passed: OpenAPI, event schema, policy and rejection fixtures.');
