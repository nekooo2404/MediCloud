import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import type {ValidateFunction} from 'ajv';
import {SchedulingError} from '../scheduling/service.js';

const openapiPath = fileURLToPath(new URL('../../../../packages/contracts/openapi.json', import.meta.url));
const openapi = JSON.parse(readFileSync(openapiPath, 'utf8')) as {
  components: {schemas: Record<string, Record<string, unknown>>};
};

const ajv = new Ajv({strict: false, allErrors: true});
addFormats(ajv);

const validators = new Map<string, ValidateFunction>();
for (const [name, schema] of Object.entries(openapi.components.schemas)) {
  validators.set(name, ajv.compile(schema));
}

export function validateContractBody<T>(schemaName: string, body: unknown): T {
  const validator = validators.get(schemaName);
  if (!validator) {
    throw new SchedulingError(500, 'contract_schema_missing', `Missing contract schema: ${schemaName}`);
  }
  const ok = validator(body);
  if (!ok) {
    const first = validator.errors?.[0];
    if (first?.keyword === 'additionalProperties') {
      throw new SchedulingError(400, 'unknown_field', 'request contains an unknown field');
    }
    if (first?.keyword === 'required' && typeof first.params?.missingProperty === 'string') {
      const prop = first.params.missingProperty;
      throw new SchedulingError(400, `${prop}_required`, `${prop} is required`);
    }
    if (first?.instancePath === '/measured_at') {
      throw new SchedulingError(400, 'invalid_measured_at', 'measured_at must be a valid ISO-8601 date-time');
    }
    const location = first?.instancePath || '/';
    const msg = first?.message || 'schema validation failed';
    throw new SchedulingError(400, 'validation_error', `Dữ liệu không hợp lệ tại ${location}: ${msg}`);
  }
  return body as T;
}
