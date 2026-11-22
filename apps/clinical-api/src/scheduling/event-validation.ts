import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schemaPath = fileURLToPath(new URL('../../../../packages/contracts/schemas/event-envelope.schema.json', import.meta.url));
const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as object;
const ajv = new Ajv({strict: false});
addFormats(ajv);
const validate = ajv.compile(schema);

export function validateEventEnvelope(event: unknown): void {
  if (!validate(event)) throw new Error(`event envelope rejected: ${ajv.errorsText(validate.errors)}`);
}
