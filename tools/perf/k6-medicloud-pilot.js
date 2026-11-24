import http from 'k6/http';
import {check, sleep} from 'k6';

export const options = {
  scenarios: {
    pilot_read_mix: {
      executor: 'ramping-vus',
      startVUs: 2,
      stages: [
        {duration: '15s', target: 10},
        {duration: '30s', target: 20},
        {duration: '15s', target: 0},
      ],
    },
  },
  thresholds: {
    'http_req_duration{kind:read}': ['p(95)<300'],
    'http_req_duration{kind:write}': ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.CLINICAL_API_BASE_URL || 'http://127.0.0.1:4000';
const AUTH_TOKEN = __ENV.CLINICAL_API_BEARER_TOKEN || 'synthetic-bff-patient';

export default function () {
  const headers = {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'x-tenant-id': 'synthetic-hospital-a',
  };

  const ovRes = http.get(`${BASE_URL}/v1/workspace/overview`, {headers, tags: {kind: 'read'}});
  check(ovRes, {'overview status is 200': (r) => r.status === 200});

  const apptsRes = http.get(`${BASE_URL}/v1/workspace/appointments`, {headers, tags: {kind: 'read'}});
  check(apptsRes, {'appointments status is 200': (r) => r.status === 200});

  sleep(0.3);
}
