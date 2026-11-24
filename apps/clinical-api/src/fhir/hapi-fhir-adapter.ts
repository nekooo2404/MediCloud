import {readFileSync} from 'node:fs';
import {isIP} from 'node:net';
import {fileURLToPath} from 'node:url';

const classificationPath = fileURLToPath(new URL('../../../../packages/contracts/data-classification.json', import.meta.url));
const classification = JSON.parse(readFileSync(classificationPath, 'utf8')) as {
  prohibited_event_fields: readonly string[];
};

const SYNTHETIC_REF_RE = /^synthetic-[a-z0-9-]+$/;
const CORRELATION_ID_RE = /^(?:synthetic-[a-z0-9-]+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const FHIR_ID_RE = /^[A-Za-z0-9\-.]{1,64}$/;
const JWT_LIKE_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
const TENANT_SECURITY_SYSTEM = 'urn:medicloud:synthetic:tenant';
const DATA_CLASS_TAG_SYSTEM = 'urn:medicloud:data-class';
const DATA_CLASS_TAG_CODE = 'restricted-clinical-synthetic';
const MAPPING_VERSION_SYSTEM = 'urn:medicloud:mapping-version';
export const FHIR_MAPPING_VERSION = '1.1.0';

const LOINC_OBSERVATION_MAP: Record<string, {loincCode: string; display: string; ucumCode: string}> = {
  'synthetic-systolic-bp': {loincCode: '8480-6', display: 'Systolic blood pressure', ucumCode: 'mm[Hg]'},
  'synthetic-diastolic-bp': {loincCode: '8462-4', display: 'Diastolic blood pressure', ucumCode: 'mm[Hg]'},
  'synthetic-heart-rate': {loincCode: '8867-4', display: 'Heart rate', ucumCode: '/min'},
  'synthetic-temperature': {loincCode: '8310-5', display: 'Body temperature', ucumCode: 'Cel'},
  'synthetic-spo2': {loincCode: '59408-5', display: 'Oxygen saturation by Pulse oximetry', ucumCode: '%'},
  'synthetic-blood-glucose': {loincCode: '2339-0', display: 'Glucose in Blood', ucumCode: 'mmol/L'},
};

const FHIR_PII_PROHIBITED_KEYS = new Set([
  ...classification.prohibited_event_fields,
  'name',
  'telecom',
  'address',
  'birthDate',
  'photo',
  'contact',
  'communication',
  'text',
  'note',
  'deceasedBoolean',
  'deceasedDateTime',
]);

export interface FhirCoding {
  system: string;
  code: string;
  display?: string;
}

export interface FhirMeta {
  profile: readonly string[];
  security: readonly FhirCoding[];
  tag: readonly FhirCoding[];
}

export interface FhirReference {
  reference: string;
}

export interface FhirPatientResource {
  resourceType: 'Patient';
  id: string;
  meta: FhirMeta;
  identifier: readonly {system: string; value: string}[];
  active: true;
}

export interface FhirEncounterResource {
  resourceType: 'Encounter';
  id: string;
  meta: FhirMeta;
  status: 'in-progress' | 'finished' | 'cancelled';
  class: FhirCoding;
  subject: FhirReference;
  participant: readonly {individual: FhirReference}[];
  appointment: readonly FhirReference[];
  period?: {start: string; end?: string};
}

export interface FhirObservationResource {
  resourceType: 'Observation';
  id: string;
  meta: FhirMeta;
  status: 'preliminary' | 'final' | 'amended';
  code: {coding: readonly FhirCoding[]};
  subject: FhirReference;
  encounter: FhirReference;
  effectiveDateTime: string;
  valueQuantity: {value: number; unit: string; system: string; code: string};
}

export type FhirR4Resource = FhirPatientResource | FhirEncounterResource | FhirObservationResource;

export class FhirBoundaryError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'FhirBoundaryError';
  }
}

export class FhirConformanceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'FhirConformanceError';
  }
}

export class FhirTransportError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'FhirTransportError';
  }
}

function buildMeta(profileUrl: string, tenantCode: string): FhirMeta {
  return {
    profile: [profileUrl],
    security: [{system: TENANT_SECURITY_SYSTEM, code: tenantCode}],
    tag: [
      {system: DATA_CLASS_TAG_SYSTEM, code: DATA_CLASS_TAG_CODE},
      {system: MAPPING_VERSION_SYSTEM, code: FHIR_MAPPING_VERSION},
    ],
  };
}

export function toFhirPatient(input: {id: string; tenantCode: string; profileRef: string}): FhirPatientResource {
  const resource: FhirPatientResource = {
    resourceType: 'Patient',
    id: input.id,
    meta: buildMeta('http://hl7.org/fhir/StructureDefinition/Patient', input.tenantCode),
    identifier: [{system: 'urn:medicloud:synthetic:patient-profile', value: input.profileRef}],
    active: true,
  };
  validateFhirR4Resource(resource);
  return resource;
}

export function toFhirEncounter(input: {
  id: string;
  tenantCode: string;
  appointmentId: string;
  patientId: string;
  practitionerId: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'AMENDED' | 'CANCELLED';
  createdAt?: Date;
  completedAt?: Date | null;
}): FhirEncounterResource {
  const mappedStatus =
    input.status === 'CANCELLED' ? 'cancelled' : input.status === 'COMPLETED' || input.status === 'AMENDED' ? 'finished' : 'in-progress';
  const resource: FhirEncounterResource = {
    resourceType: 'Encounter',
    id: input.id,
    meta: buildMeta('http://hl7.org/fhir/StructureDefinition/Encounter', input.tenantCode),
    status: mappedStatus,
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AMB',
      display: 'ambulatory',
    },
    subject: {reference: `Patient/${input.patientId}`},
    participant: [{individual: {reference: `Practitioner/${input.practitionerId}`}}],
    appointment: [{reference: `Appointment/${input.appointmentId}`}],
    ...(input.createdAt
      ? {
          period: {
            start: input.createdAt.toISOString(),
            ...(input.completedAt ? {end: input.completedAt.toISOString()} : {}),
          },
        }
      : {}),
  };
  validateFhirR4Resource(resource);
  return resource;
}

export function toFhirObservation(input: {
  id: string;
  tenantCode: string;
  encounterId: string;
  patientId: string;
  code: string;
  value: number;
  unit: string;
  measuredAt: Date;
  status?: 'PRELIMINARY' | 'FINAL' | 'AMENDED' | 'DRAFT';
}): FhirObservationResource {
  const mapped = LOINC_OBSERVATION_MAP[input.code];
  const fhirStatus: FhirObservationResource['status'] =
    input.status === 'AMENDED' ? 'amended' : input.status === 'PRELIMINARY' || input.status === 'DRAFT' ? 'preliminary' : 'final';
  const coding: FhirCoding[] = [{system: 'urn:medicloud:synthetic:observation-code', code: input.code}];
  if (mapped) {
    coding.push({system: 'http://loinc.org', code: mapped.loincCode, display: mapped.display});
  }
  const resource: FhirObservationResource = {
    resourceType: 'Observation',
    id: input.id,
    meta: buildMeta('http://hl7.org/fhir/StructureDefinition/Observation', input.tenantCode),
    status: fhirStatus,
    code: {coding},
    subject: {reference: `Patient/${input.patientId}`},
    encounter: {reference: `Encounter/${input.encounterId}`},
    effectiveDateTime: input.measuredAt.toISOString(),
    valueQuantity: mapped
      ? {
          value: input.value,
          unit: input.unit,
          system: 'http://unitsofmeasure.org',
          code: mapped.ucumCode,
        }
      : {
          value: input.value,
          unit: input.unit,
          system: 'urn:medicloud:synthetic:unit',
          code: input.unit,
        },
  };
  validateFhirR4Resource(resource);
  return resource;
}

function scanForProhibitedContent(value: unknown): void {
  if (typeof value === 'string') {
    if (/\bBearer\s+/i.test(value) || JWT_LIKE_RE.test(value)) {
      throw new FhirConformanceError('prohibited_credential_content', 'FHIR resource must not contain credentials or tokens');
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) scanForProhibitedContent(item);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      if (FHIR_PII_PROHIBITED_KEYS.has(key)) {
        throw new FhirConformanceError('prohibited_phi_field', `FHIR resource contains prohibited PHI/PII field: ${key}`);
      }
      scanForProhibitedContent(nested);
    }
  }
}

export function extractFhirTenantCode(resource: unknown): string | undefined {
  if (!resource || typeof resource !== 'object') return undefined;
  const meta = (resource as {meta?: {security?: unknown}}).meta;
  if (!meta || !Array.isArray(meta.security)) return undefined;
  const entry = meta.security.find(
    (item): item is FhirCoding =>
      Boolean(item && typeof item === 'object' && (item as FhirCoding).system === TENANT_SECURITY_SYSTEM && typeof (item as FhirCoding).code === 'string'),
  );
  return entry?.code;
}

function isValidFhirId(id: string | undefined): id is string {
  return typeof id === 'string' && FHIR_ID_RE.test(id) && id !== '.' && id !== '..';
}

function isValidFhirReference(
  ref: string | undefined,
  prefix: 'Patient' | 'Practitioner' | 'Appointment' | 'Encounter',
): boolean {
  if (!ref || !ref.startsWith(`${prefix}/`)) return false;
  return isValidFhirId(ref.slice(prefix.length + 1));
}

export function validateFhirR4Resource(resource: unknown): asserts resource is FhirR4Resource {
  if (!resource || typeof resource !== 'object' || Array.isArray(resource)) {
    throw new FhirConformanceError('invalid_fhir_resource', 'FHIR resource must be a JSON object');
  }
  scanForProhibitedContent(resource);

  const candidate = resource as Partial<FhirR4Resource>;
  if (!isValidFhirId(candidate.id)) {
    throw new FhirConformanceError('invalid_fhir_id', 'FHIR resource id is missing or invalid');
  }
  const tenantCode = extractFhirTenantCode(candidate);
  if (!tenantCode || !SYNTHETIC_REF_RE.test(tenantCode)) {
    throw new FhirConformanceError('invalid_fhir_tenant_security', 'FHIR resource must carry a synthetic tenant security tag');
  }
  const tags = candidate.meta?.tag;
  const hasSyntheticClassTag = Array.isArray(tags) && tags.some((tag) => tag.system === DATA_CLASS_TAG_SYSTEM && tag.code === DATA_CLASS_TAG_CODE);
  if (!hasSyntheticClassTag) {
    throw new FhirConformanceError('invalid_fhir_data_class', 'FHIR resource must carry synthetic restricted-clinical classification tag');
  }

  switch (candidate.resourceType) {
    case 'Patient': {
      const patient = candidate as FhirPatientResource;
      if (patient.active !== true || !Array.isArray(patient.identifier) || patient.identifier.length === 0) {
        throw new FhirConformanceError('invalid_fhir_patient', 'FHIR Patient requires active=true and a synthetic identifier');
      }
      const primaryId = patient.identifier[0];
      if (!primaryId || primaryId.system !== 'urn:medicloud:synthetic:patient-profile' || !SYNTHETIC_REF_RE.test(primaryId.value)) {
        throw new FhirConformanceError('invalid_fhir_patient_identifier', 'FHIR Patient identifier must reference a synthetic profile');
      }
      return;
    }
    case 'Encounter': {
      const encounter = candidate as FhirEncounterResource;
      if (!['in-progress', 'finished', 'cancelled'].includes(encounter.status) || encounter.class?.code !== 'AMB') {
        throw new FhirConformanceError('invalid_fhir_encounter', 'FHIR Encounter requires valid status and AMB class');
      }
      if (!isValidFhirReference(encounter.subject?.reference, 'Patient')) {
        throw new FhirConformanceError('invalid_fhir_encounter_subject', 'FHIR Encounter requires Patient subject reference');
      }
      if (!Array.isArray(encounter.participant) || !isValidFhirReference(encounter.participant[0]?.individual?.reference, 'Practitioner')) {
        throw new FhirConformanceError('invalid_fhir_encounter_participant', 'FHIR Encounter requires Practitioner participant reference');
      }
      if (!Array.isArray(encounter.appointment) || !isValidFhirReference(encounter.appointment[0]?.reference, 'Appointment')) {
        throw new FhirConformanceError('invalid_fhir_encounter_appointment', 'FHIR Encounter requires Appointment reference');
      }
      return;
    }
    case 'Observation': {
      const observation = candidate as FhirObservationResource;
      const primaryCoding = observation.code?.coding?.[0];
      if (
        !['preliminary', 'final', 'amended'].includes(observation.status) ||
        !primaryCoding ||
        !SYNTHETIC_REF_RE.test(primaryCoding.code)
      ) {
        throw new FhirConformanceError('invalid_fhir_observation_code', 'FHIR Observation requires valid status and synthetic primary code');
      }
      if (!isValidFhirReference(observation.subject?.reference, 'Patient') || !isValidFhirReference(observation.encounter?.reference, 'Encounter')) {
        throw new FhirConformanceError('invalid_fhir_observation_refs', 'FHIR Observation requires Patient and Encounter references');
      }
      if (!observation.effectiveDateTime || Number.isNaN(Date.parse(observation.effectiveDateTime))) {
        throw new FhirConformanceError('invalid_fhir_observation_time', 'FHIR Observation requires valid effectiveDateTime');
      }
      if (typeof observation.valueQuantity?.value !== 'number' || !Number.isFinite(observation.valueQuantity.value) || !observation.valueQuantity?.unit) {
        throw new FhirConformanceError('invalid_fhir_observation_value', 'FHIR Observation requires finite numeric valueQuantity');
      }
      return;
    }
    default:
      throw new FhirConformanceError('unsupported_fhir_resource', 'FHIR resourceType must be Patient, Encounter, or Observation');
  }
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map((segment) => Number(segment));
  if (parts.length !== 4 || parts.some((num) => !Number.isInteger(num) || num < 0 || num > 255)) return false;
  if (parts[0] === 127 || parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

export function assertPrivateFhirEndpoint(
  baseUrl: string,
  options: {requireTls?: boolean; allowedHosts?: readonly string[]} = {},
): URL {
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new FhirBoundaryError('invalid_fhir_endpoint', 'HAPI FHIR endpoint must be a valid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new FhirBoundaryError('invalid_fhir_protocol', 'HAPI FHIR endpoint must use http or https');
  }
  const requireTls = options.requireTls ?? process.env.MEDICLOUD_ENV === 'production';
  if (requireTls && parsed.protocol !== 'https:') {
    throw new FhirBoundaryError('fhir_tls_required', 'Production HAPI FHIR endpoint requires HTTPS/mTLS transport');
  }
  if (parsed.username || parsed.password) {
    throw new FhirBoundaryError('fhir_endpoint_credentials_forbidden', 'HAPI FHIR URL must not embed credentials');
  }
  if (parsed.search || parsed.hash) {
    throw new FhirBoundaryError('fhir_endpoint_query_forbidden', 'HAPI FHIR endpoint must not include query or fragment');
  }
  const rawHost = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  const isCloudMetadataHost =
    rawHost === 'metadata' ||
    rawHost === 'instance-data' ||
    rawHost === 'metadata.goog' ||
    rawHost === 'metadata.google.internal' ||
    rawHost.endsWith('.google.internal') ||
    rawHost.endsWith('.ec2.internal');
  if (isCloudMetadataHost) {
    throw new FhirBoundaryError('public_fhir_endpoint_forbidden', 'Cloud metadata endpoints are forbidden');
  }
  if (options.allowedHosts && options.allowedHosts.length > 0) {
    const normalizedAllowlist = options.allowedHosts.map((h) => h.trim().toLowerCase());
    if (!normalizedAllowlist.includes(rawHost)) {
      throw new FhirBoundaryError('fhir_egress_not_allowlisted', `FHIR host ${rawHost} is outside configured egress allowlist`);
    }
  }
  const isLoopbackHost = rawHost === 'localhost' || rawHost === '::1';
  const ipVersion = isIP(rawHost);
  const allowedIp = ipVersion === 4 ? isPrivateIpv4(rawHost) : ipVersion === 6 && rawHost === '::1';
  const allowedPrivateDomain =
    ipVersion === 0 &&
    (isLoopbackHost ||
      rawHost === 'hapi-fhir' ||
      rawHost.endsWith('.internal') ||
      rawHost.endsWith('.private') ||
      rawHost.endsWith('.openstack.local') ||
      rawHost.endsWith('.private.example'));

  if (!allowedIp && !allowedPrivateDomain) {
    throw new FhirBoundaryError('public_fhir_endpoint_forbidden', 'HAPI FHIR adapter is restricted to the private network boundary');
  }
  return parsed;
}

export interface PrivateHapiFhirClient {
  upsertResource<T extends FhirR4Resource>(resource: T, correlationId: string): Promise<T>;
  getResource<T extends FhirR4Resource>(resourceType: T['resourceType'], id: string, expectedTenantCode: string, correlationId: string): Promise<T>;
}

export function createPrivateHapiFhirClient(options: {
  baseUrl: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  bearerToken?: string;
  requireTlsAndAuth?: boolean;
  allowedHosts?: readonly string[];
  maxRetries?: number;
}): PrivateHapiFhirClient {
  const requireTlsAndAuth = options.requireTlsAndAuth ?? process.env.MEDICLOUD_ENV === 'production';
  const endpoint = assertPrivateFhirEndpoint(options.baseUrl, {
    requireTls: requireTlsAndAuth,
    allowedHosts: options.allowedHosts,
  });
  const bearerToken = options.bearerToken ?? process.env.HAPI_FHIR_BEARER_TOKEN;
  if (requireTlsAndAuth && (!bearerToken || bearerToken.trim().length < 8)) {
    throw new FhirBoundaryError('fhir_auth_required', 'Production HAPI FHIR client requires service bearer/mTLS credential');
  }
  const basePath = endpoint.toString().replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? 5000;
  const maxRetries = Math.min(Math.max(options.maxRetries ?? 1, 0), 3);
  const fetchFn = options.fetchImpl ?? fetch;

  const ensureCorrelation = (correlationId: string) => {
    if (!CORRELATION_ID_RE.test(correlationId)) {
      throw new FhirConformanceError('invalid_correlation_id', 'FHIR correlation_id must be synthetic or UUID');
    }
  };

  function buildAuthHeaders(correlationId: string, tenantCode?: string): Record<string, string> {
    return {
      accept: 'application/fhir+json',
      'x-correlation-id': correlationId,
      'x-medicloud-mapping-version': FHIR_MAPPING_VERSION,
      ...(tenantCode ? {'x-tenant-code': tenantCode} : {}),
      ...(bearerToken ? {authorization: `Bearer ${bearerToken}`} : {}),
    };
  }

  async function executeFetch(targetUrl: string, init: RequestInit): Promise<Response> {
    let lastError: FhirTransportError | null = null;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await fetchFn(targetUrl, {
          ...init,
          redirect: 'error',
          signal: AbortSignal.timeout(timeoutMs),
        });
        if ([502, 503, 504].includes(response.status) && attempt < maxRetries) {
          lastError = new FhirTransportError(response.status, 'fhir_transient_upstream', `Transient FHIR status ${response.status}`);
          continue;
        }
        return response;
      } catch {
        lastError = new FhirTransportError(503, 'fhir_network_error', 'Private HAPI FHIR request failed');
        if (attempt >= maxRetries) break;
      }
    }
    throw lastError ?? new FhirTransportError(503, 'fhir_network_error', 'Private HAPI FHIR request failed');
  }

  async function parseJsonResponse(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new FhirTransportError(502, 'fhir_invalid_json', 'Private HAPI FHIR returned invalid JSON');
    }
  }

  return {
    async upsertResource<T extends FhirR4Resource>(resource: T, correlationId: string): Promise<T> {
      ensureCorrelation(correlationId);
      validateFhirR4Resource(resource);
      const tenantCode = extractFhirTenantCode(resource);
      const targetUrl = `${basePath}/fhir/${resource.resourceType}/${encodeURIComponent(resource.id)}`;
      const response = await executeFetch(targetUrl, {
        method: 'PUT',
        headers: {
          'content-type': 'application/fhir+json',
          ...buildAuthHeaders(correlationId, tenantCode),
        },
        body: JSON.stringify(resource),
      });
      if (!response.ok) {
        throw new FhirTransportError(response.status, 'fhir_upsert_failed', `Private HAPI FHIR rejected ${resource.resourceType}`);
      }
      const saved = await parseJsonResponse(response);
      validateFhirR4Resource(saved);
      if (saved.resourceType !== resource.resourceType || extractFhirTenantCode(saved) !== tenantCode) {
        throw new FhirConformanceError('fhir_response_mismatch', 'Private HAPI FHIR returned mismatched resource');
      }
      return saved as T;
    },

    async getResource<T extends FhirR4Resource>(
      resourceType: T['resourceType'],
      id: string,
      expectedTenantCode: string,
      correlationId: string,
    ): Promise<T> {
      ensureCorrelation(correlationId);
      if (!isValidFhirId(id)) throw new FhirConformanceError('invalid_fhir_id', 'FHIR resource id is invalid');
      if (!SYNTHETIC_REF_RE.test(expectedTenantCode)) {
        throw new FhirConformanceError('invalid_tenant_code', 'expectedTenantCode must be synthetic');
      }
      const targetUrl = `${basePath}/fhir/${resourceType}/${encodeURIComponent(id)}`;
      const response = await executeFetch(targetUrl, {
        method: 'GET',
        headers: buildAuthHeaders(correlationId, expectedTenantCode),
      });
      if (response.status === 404) {
        throw new FhirTransportError(404, 'fhir_resource_not_found', 'FHIR resource not found');
      }
      if (!response.ok) {
        throw new FhirTransportError(response.status, 'fhir_read_failed', `Private HAPI FHIR failed reading ${resourceType}`);
      }
      const loaded = await parseJsonResponse(response);
      validateFhirR4Resource(loaded);
      if (loaded.resourceType !== resourceType || extractFhirTenantCode(loaded) !== expectedTenantCode) {
        // Disclosure-safe 404 when a returned resource belongs to another tenant.
        throw new FhirTransportError(404, 'fhir_resource_not_found', 'FHIR resource not found');
      }
      return loaded as T;
    },
  };
}
