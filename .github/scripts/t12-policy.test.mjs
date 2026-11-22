import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const scriptsDir = fileURLToPath(new URL('.', import.meta.url));
const tempDirs = [];

function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'medicloud-t12-'));
  tempDirs.push(dir);
  return dir;
}

function writeRel(rootDir, relPath, content) {
  const target = join(rootDir, relPath);
  mkdirSync(join(target, '..'), {recursive: true});
  writeFileSync(target, content, 'utf8');
}

function runScript(scriptName, targetRoot) {
  const proc = spawnSync(process.execPath, [join(scriptsDir, scriptName), '--root', targetRoot], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
  });
  return {
    status: proc.status ?? 1,
    stdout: proc.stdout ?? '',
    stderr: proc.stderr ?? '',
    json: proc.stdout ? JSON.parse(proc.stdout) : null,
  };
}

function seedCleanClassification(rootDir) {
  writeRel(
    rootDir,
    'packages/contracts/data-classification.json',
    JSON.stringify({
      policy: {
        synthetic_only: true,
        private_database_publicly_exposed: false,
        tenant_id_server_derived: true,
        raw_clinical_data_in_public_cloud: false,
      },
    }),
  );
}

function seedCleanDependencies(rootDir) {
  writeRel(
    rootDir,
    'package.json',
    JSON.stringify({
      name: 'synthetic-medicloud',
      packageManager: 'pnpm@10.22.0',
      engines: {node: '>=22'},
      dependencies: {ajv: '^8.17.1'},
      devDependencies: {typescript: '^5.8.3'},
    }),
  );
  writeRel(
    rootDir,
    'pnpm-lock.yaml',
    [
      "lockfileVersion: '9.0'",
      'importers:',
      '  .:',
      '    dependencies:',
      '      ajv:',
      '        specifier: ^8.17.1',
      '        version: 8.20.0',
      '    devDependencies:',
      '      typescript:',
      '        specifier: ^5.8.3',
      '        version: 5.9.3',
      'packages:',
      '  ajv@8.20.0:',
      '    resolution: {integrity: sha512-syntheticIntegrityHashValue==}',
      '  typescript@5.9.3:',
      '    resolution: {integrity: sha512-syntheticTypeScriptIntegrity==}',
      'snapshots:',
      '  ajv@8.20.0: {}',
      '  typescript@5.9.3: {}',
      '',
    ].join('\n'),
  );
}

function seedValidImagesAndWorkflow(rootDir) {
  for (const name of ['Dockerfile.patient-portal', 'Dockerfile.clinical-api']) {
    const src = readFileSync(join(repoRoot, '.github/docker', name), 'utf8');
    writeRel(rootDir, `.github/docker/${name}`, src);
  }
  const ciYaml = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  writeRel(rootDir, '.github/workflows/ci.yml', ciYaml);
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop(), {recursive: true, force: true});
  }
});

describe('T12 secret and synthetic PHI scanner', () => {
  it('passes clean synthetic directory and rejects .env, AWS keys, unredacted DB URIs, and PHI keys', () => {
    const cleanRoot = createTempRepo();
    seedCleanClassification(cleanRoot);
    writeRel(cleanRoot, 'docs/evidence/sample.json', JSON.stringify({fixtures: {id: 'synthetic-1'}}));
    assert.equal(runScript('secret-and-phi-scan.mjs', cleanRoot).status, 0);

    const envRoot = createTempRepo();
    seedCleanClassification(envRoot);
    writeRel(envRoot, '.env', 'PORT=3000\n');
    const envRes = runScript('secret-and-phi-scan.mjs', envRoot);
    assert.equal(envRes.status, 1);
    assert.ok(envRes.json.secret_findings.some((f) => f.rule === 'forbidden_secret_file'));

    const keyRoot = createTempRepo();
    seedCleanClassification(keyRoot);
    const awsKey = ['AKIA', '000000000000TEST'].join('');
    const dbUri = ['postgres://synthetic:', 'TestOnlyPass1', '@db.internal:5432/medicloud'].join('');
    const remoteDefaultDbUri = ['postgres://postgres:', 'postgres', '@db.internal:5432/medicloud'].join('');
    const encPem = ['-----BEGIN ENCRYPTED ', 'PRIVATE KEY-----'].join('');
    writeRel(keyRoot, 'apps/leaked.ts', `const k = "${awsKey}";\nconst d = "${dbUri}";\nconst r = "${remoteDefaultDbUri}";\nconst p = "${encPem}";\n`);
    const keyRes = runScript('secret-and-phi-scan.mjs', keyRoot);
    assert.equal(keyRes.status, 1);
    assert.ok(keyRes.json.secret_findings.some((f) => f.rule === 'aws_access_key'));
    assert.ok(keyRes.json.secret_findings.some((f) => f.rule === 'private_key_header'));
    assert.ok(
      keyRes.json.secret_findings.filter((f) => f.rule === 'unredacted_postgres_credential').length === 2,
    );

    const phiRoot = createTempRepo();
    seedCleanClassification(phiRoot);
    writeRel(phiRoot, 'docs/evidence/bad.json', JSON.stringify({fixtures: {full_name: 'Not Allowed'}}));
    const phiRes = runScript('secret-and-phi-scan.mjs', phiRoot);
    assert.equal(phiRes.status, 1);
    assert.ok(phiRes.json.phi_policy_violations.some((f) => f.rule === 'forbidden_phi_fixture_key:full_name'));
  });
});

describe('T12 dependency and lockfile audit', () => {
  it('passes locked dependencies and rejects unpinned specs, lockfile drift, blocked packages, and missing hashes', () => {
    const cleanRoot = createTempRepo();
    seedCleanDependencies(cleanRoot);
    assert.equal(runScript('dependency-audit.mjs', cleanRoot).status, 0);

    const driftRoot = createTempRepo();
    seedCleanDependencies(driftRoot);
    writeRel(
      driftRoot,
      'package.json',
      JSON.stringify({
        name: 'synthetic-medicloud',
        packageManager: 'pnpm@10.22.0',
        engines: {node: '>=22'},
        dependencies: {ajv: 'latest', extra: '1.0.0'},
        devDependencies: {typescript: '^5.8.3'},
      }),
    );
    const driftRes = runScript('dependency-audit.mjs', driftRoot);
    assert.equal(driftRes.status, 1);
    assert.ok(driftRes.json.unpinned_or_untrusted_specs >= 1);
    assert.ok(driftRes.json.lockfile_drift >= 1);

    const badLockRoot = createTempRepo();
    seedCleanDependencies(badLockRoot);
    writeRel(
      badLockRoot,
      'pnpm-lock.yaml',
      [
        "lockfileVersion: '9.0'",
        'importers:',
        '  .:',
        '    dependencies:',
        '      ajv:',
        '        specifier: ^8.17.1',
        '        version: 8.20.0',
        '    devDependencies:',
        '      typescript:',
        '        specifier: ^5.8.3',
        '        version: 5.9.3',
        'packages:',
        '  event-stream@3.3.6:',
        '    resolution: {integrity: sha1-missingSha512==}',
        '',
      ].join('\n'),
    );
    const badLockRes = runScript('dependency-audit.mjs', badLockRoot);
    assert.equal(badLockRes.status, 1);
    assert.ok(badLockRes.json.blocked_packages >= 1);
    assert.ok(badLockRes.json.missing_integrity_hashes >= 1);
  });
});

describe('T12 immutable image and CI workflow policy verifier', () => {
  it('passes digest-pinned Dockerfiles/workflow and rejects unpinned base images, root user, :latest tags, and push: true', () => {
    const cleanRoot = createTempRepo();
    seedValidImagesAndWorkflow(cleanRoot);
    assert.equal(runScript('verify-immutable-images.mjs', cleanRoot).status, 0);

    const badDockerRoot = createTempRepo();
    seedValidImagesAndWorkflow(badDockerRoot);
    writeRel(
      badDockerRoot,
      '.github/docker/Dockerfile.clinical-api',
      'FROM node:22-alpine\nADD https://example.com/a.tar.gz /tmp/\nUSER node\nUSER root\nCOPY . .\nCMD ["pnpm", "run", "contracts:validate"]\n',
    );
    const badDockerRes = runScript('verify-immutable-images.mjs', badDockerRoot);
    assert.equal(badDockerRes.status, 1);
    assert.ok(badDockerRes.json.findings.some((f) => f.rule === 'unpinned_base_image'));
    assert.ok(badDockerRes.json.findings.some((f) => f.rule === 'forbidden_add_instruction'));
    assert.ok(badDockerRes.json.findings.some((f) => f.rule === 'missing_non_root_user_node'));
    assert.ok(badDockerRes.json.findings.some((f) => f.rule === 'forbidden_package_manager_runtime_cmd'));

    const badCiRoot = createTempRepo();
    seedValidImagesAndWorkflow(badCiRoot);
    const badCi = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8')
      .replace('contents: read', 'contents: write')
      .replace('push: false', 'push: true')
      .replace('medicloud/patient-portal:sha-${{ github.sha }}', 'medicloud/patient-portal:latest');
    writeRel(badCiRoot, '.github/workflows/ci.yml', badCi);
    const badCiRes = runScript('verify-immutable-images.mjs', badCiRoot);
    assert.equal(badCiRes.status, 1);
    assert.ok(badCiRes.json.findings.some((f) => f.rule === 'excessive_or_missing_workflow_permissions'));
    assert.ok(badCiRes.json.findings.some((f) => f.rule.startsWith('unexpected_docker_push')));
    assert.ok(badCiRes.json.findings.some((f) => f.rule.startsWith('non_immutable_image_tag')));
  });
});
