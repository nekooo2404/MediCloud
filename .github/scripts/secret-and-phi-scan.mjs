import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {extname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

function resolveTargetRoot() {
  const idx = process.argv.indexOf('--root');
  if (idx >= 0 && process.argv[idx + 1]) {
    return resolve(process.argv[idx + 1]);
  }
  return fileURLToPath(new URL('../..', import.meta.url));
}

const repoRoot = resolveTargetRoot();
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'coverage', '.vitest']);
const SKIP_REL_PREFIXES = ['.medicloud/agent-company/runtime', '.agents/skills'];
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg',
  '.woff', '.woff2', '.ttf', '.eot', '.pdf', '.zip', '.gz',
  '.tsbuildinfo', '.lock',
]);

const FORBIDDEN_SECRET_FILES = [
  /^\.env$/,
  /^\.env\.(?!example$).+/i,
  /\.(pem|key|p12|pfx)$/i,
  /^id_(rsa|ed25519|ecdsa|dsa)$/i,
  /^credentials\.json$/i,
  /^service-account.*\.json$/i,
];

const PRIVATE_KEY_MARKER = ['-----BEGIN ', '(?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----'].join('');
const SECRET_RULES = [
  {id: 'private_key_header', regex: new RegExp(PRIVATE_KEY_MARKER)},
  {id: 'aws_access_key', regex: /\bAKIA[0-9A-Z]{16}\b/},
  {id: 'github_pat', regex: /\b(?:ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,})\b/},
  {id: 'slack_token', regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/},
  {id: 'gcp_service_account_key', regex: /"type"\s*:\s*"service_account"[\s\S]*"private_key"\s*:/},
];
const POSTGRES_CREDENTIAL_RE = /postgres(?:ql)?:\/\/([^/\s:@`'"${}]+):([^/\s@`'"${}]+)@([^/\s:]+)/gi;
const BALANCED_PLACEHOLDER_RE = /^<[A-Za-z0-9_.-]+>$/;
const REMOTE_SAFE_PLACEHOLDERS = new Set(['redacted', 'placeholder', 'synthetic']);
const LOCAL_SAFE_PLACEHOLDERS = new Set(['postgres', 'medicloud', 'changeme', '***', ...REMOTE_SAFE_PLACEHOLDERS]);

const PHI_FIXTURE_KEYS = new Set([
  'full_name',
  'phone_number',
  'identity_number',
  'diagnosis',
  'clinical_result',
  'dicom_content',
  'access_token',
  'secret',
  'password',
  'name',
  'telecom',
  'address',
  'birthDate',
  'note',
]);

function normalizeRel(absPath) {
  return relative(repoRoot, absPath).split(sep).join('/');
}

function collectFiles(dirPath, results) {
  const entries = readdirSync(dirPath, {withFileTypes: true});
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const rel = normalizeRel(fullPath);
    if (SKIP_DIRS.has(entry.name) || SKIP_REL_PREFIXES.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) {
      continue;
    }
    if (entry.isDirectory()) {
      collectFiles(fullPath, results);
      continue;
    }
    if (entry.isFile()) {
      results.push({fullPath, rel, name: entry.name});
    }
  }
}

function scanFixtureObject(value, fileRel, findings) {
  if (Array.isArray(value)) {
    for (const item of value) scanFixtureObject(item, fileRel, findings);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value)) {
    if (PHI_FIXTURE_KEYS.has(key)) {
      findings.push({file: fileRel, rule: `forbidden_phi_fixture_key:${key}`});
    }
    scanFixtureObject(nested, fileRel, findings);
  }
}

const files = [];
collectFiles(repoRoot, files);

const secretFindings = [];
const phiFindings = [];
let filesScanned = 0;

for (const {fullPath, rel, name} of files) {
  if (FORBIDDEN_SECRET_FILES.some((pattern) => pattern.test(name))) {
    secretFindings.push({file: rel, line: 0, rule: 'forbidden_secret_file'});
  }
  if (BINARY_EXTENSIONS.has(extname(name).toLowerCase())) continue;
  const stats = statSync(fullPath);
  if (stats.size > 2 * 1024 * 1024) continue;

  filesScanned += 1;
  if (rel === '.github/scripts/secret-and-phi-scan.mjs') continue;

  const content = readFileSync(fullPath, 'utf8');
  const isDocMarkdown = rel.startsWith('docs/') && rel.endsWith('.md');
  const hasPemFooter = /-----END\s+(?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/.test(content);
  for (const rule of SECRET_RULES) {
    if (rule.regex.test(content)) {
      const lines = content.split(/\r?\n/);
      const matchedLineIdx = lines.findIndex(
        (line) =>
          rule.regex.test(line) &&
          !(rule.id === 'private_key_header' && isDocMarkdown && !hasPemFooter && /`[^`]*PRIVATE KEY-----`/.test(line)),
      );
      if (matchedLineIdx < 0) {
        if (rule.id === 'private_key_header' && isDocMarkdown && !hasPemFooter) continue;
        secretFindings.push({file: rel, line: 1, rule: rule.id});
      } else {
        secretFindings.push({file: rel, line: matchedLineIdx + 1, rule: rule.id});
      }
    }
  }

  POSTGRES_CREDENTIAL_RE.lastIndex = 0;
  let match;
  while ((match = POSTGRES_CREDENTIAL_RE.exec(content)) !== null) {
    const rawPassword = match[2];
    const host = match[3].toLowerCase();
    const isLocalSynthetic = host === 'localhost' || host === '127.0.0.1';
    const clean = rawPassword.toLowerCase();
    const allowedPlaceholder =
      BALANCED_PLACEHOLDER_RE.test(rawPassword) ||
      REMOTE_SAFE_PLACEHOLDERS.has(clean) ||
      (isLocalSynthetic && LOCAL_SAFE_PLACEHOLDERS.has(clean));
    if (!allowedPlaceholder) {
      const lineNumber = content.slice(0, match.index).split(/\r?\n/).length;
      secretFindings.push({file: rel, line: lineNumber, rule: 'unredacted_postgres_credential'});
    }
  }
}

const classificationPath = join(repoRoot, 'packages/contracts/data-classification.json');
if (!existsSync(classificationPath)) {
  phiFindings.push({file: 'packages/contracts/data-classification.json', rule: 'missing_data_classification'});
} else {
  const classification = JSON.parse(readFileSync(classificationPath, 'utf8'));
  if (
    classification.policy?.synthetic_only !== true ||
    classification.policy?.private_database_publicly_exposed !== false ||
    classification.policy?.raw_clinical_data_in_public_cloud !== false
  ) {
    phiFindings.push({file: 'packages/contracts/data-classification.json', rule: 'invalid_synthetic_policy'});
  }
}

function scanEvidenceJsonTree(dirPath) {
  for (const entry of readdirSync(dirPath, {withFileTypes: true})) {
    const abs = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanEvidenceJsonTree(abs);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.json')) {
      const rel = normalizeRel(abs);
      const parsed = JSON.parse(readFileSync(abs, 'utf8'));
      if (parsed && typeof parsed === 'object' && 'fixtures' in parsed) {
        scanFixtureObject(parsed.fixtures, rel, phiFindings);
      } else {
        scanFixtureObject(parsed, rel, phiFindings);
      }
    }
  }
}

const evidenceDir = join(repoRoot, 'docs/evidence');
if (existsSync(evidenceDir)) {
  scanEvidenceJsonTree(evidenceDir);
}

const summary = {
  check: 'ci:scan:secrets',
  files_discovered: files.length,
  files_scanned: filesScanned,
  secret_findings_count: secretFindings.length,
  phi_policy_violations_count: phiFindings.length,
  secret_findings: secretFindings,
  phi_policy_violations: phiFindings,
  status: secretFindings.length === 0 && phiFindings.length === 0 ? 'PASS' : 'FAIL',
};

console.log(JSON.stringify(summary, null, 2));
if (summary.status !== 'PASS') process.exit(1);
