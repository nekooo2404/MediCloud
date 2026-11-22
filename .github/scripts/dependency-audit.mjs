import {existsSync, readFileSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import YAML from 'yaml';

function resolveTargetRoot() {
  const idx = process.argv.indexOf('--root');
  if (idx >= 0 && process.argv[idx + 1]) {
    return resolve(process.argv[idx + 1]);
  }
  return fileURLToPath(new URL('../..', import.meta.url));
}

const repoRoot = resolveTargetRoot();
const SEMVER_SPEC_RE = /^[~^]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const BLOCKED_SPEC_PREFIXES = ['*', 'latest', 'next', 'file:', 'link:', 'git+', 'http://', 'https://', 'github:'];
const BLOCKED_PACKAGE_VERSIONS = new Set([
  'event-stream@3.3.6',
  'ua-parser-js@0.7.29',
  'ua-parser-js@0.8.0',
  'colors@1.4.1',
  'faker@6.6.6',
  'node-ipc@10.1.1',
  'node-ipc@10.1.2',
]);

const findings = [];
const pkgPath = join(repoRoot, 'package.json');
const lockPath = join(repoRoot, 'pnpm-lock.yaml');

let pkg = {};
let directDeps = {};
let devDeps = {};

if (!existsSync(pkgPath)) {
  findings.push({rule: 'missing_package_json', detail: 'package.json is required'});
} else {
  pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (!pkg.packageManager || !/^pnpm@\d+\.\d+\.\d+$/.test(pkg.packageManager)) {
    findings.push({rule: 'unpinned_package_manager', detail: 'packageManager must be pinned to an exact pnpm@x.y.z version'});
  }
  if (!pkg.engines?.node || !String(pkg.engines.node).includes('22')) {
    findings.push({rule: 'missing_node_engine', detail: 'engines.node must require >=22'});
  }
  directDeps = pkg.dependencies ?? {};
  devDeps = pkg.devDependencies ?? {};
}

let unpinnedCount = 0;

for (const [sectionName, group] of [
  ['dependencies', directDeps],
  ['devDependencies', devDeps],
]) {
  for (const [name, specifier] of Object.entries(group)) {
    const raw = String(specifier);
    const isBlockedPrefix = BLOCKED_SPEC_PREFIXES.some((prefix) => raw === prefix || raw.startsWith(prefix));
    if (isBlockedPrefix || !SEMVER_SPEC_RE.test(raw)) {
      unpinnedCount += 1;
      findings.push({rule: 'unpinned_or_untrusted_specifier', section: sectionName, package: name, specifier: raw});
    }
  }
}

let lockfileDriftCount = 0;
let missingIntegrityCount = 0;
let blockedPackageCount = 0;
let lockedPackagesCount = 0;
let lockedSnapshotsCount = 0;

if (!existsSync(lockPath)) {
  findings.push({rule: 'missing_lockfile', detail: 'pnpm-lock.yaml is required'});
} else {
  const lock = YAML.parse(readFileSync(lockPath, 'utf8'));
  if (String(lock?.lockfileVersion) !== '9.0') {
    findings.push({rule: 'unexpected_lockfile_version', version: String(lock?.lockfileVersion ?? 'missing')});
  }

  const rootImporter = lock?.importers?.['.'] ?? {};
  for (const [sectionName, pkgGroup] of [
    ['dependencies', directDeps],
    ['devDependencies', devDeps],
  ]) {
    const lockGroup = rootImporter[sectionName] ?? {};
    for (const [name, expectedSpec] of Object.entries(pkgGroup)) {
      const actualSpec = lockGroup[name]?.specifier;
      if (actualSpec !== expectedSpec) {
        lockfileDriftCount += 1;
        findings.push({rule: 'lockfile_specifier_drift', section: sectionName, package: name, packageJson: expectedSpec, lockfile: actualSpec ?? null});
      }
    }
    for (const lockName of Object.keys(lockGroup)) {
      if (!(lockName in pkgGroup)) {
        lockfileDriftCount += 1;
        findings.push({rule: 'lockfile_extra_package', section: sectionName, package: lockName});
      }
    }
  }

  const lockedPackages = lock?.packages ?? {};
  lockedPackagesCount = Object.keys(lockedPackages).length;
  lockedSnapshotsCount = Object.keys(lock?.snapshots ?? {}).length;

  for (const [pkgKey, meta] of Object.entries(lockedPackages)) {
    const normalizedKey = pkgKey.split('(')[0];
    if (BLOCKED_PACKAGE_VERSIONS.has(normalizedKey)) {
      blockedPackageCount += 1;
      findings.push({rule: 'blocked_supply_chain_package', package: normalizedKey});
    }
    const integrity = meta?.resolution?.integrity;
    if (typeof integrity !== 'string' || !/^sha512-[A-Za-z0-9+/=]+$/.test(integrity)) {
      missingIntegrityCount += 1;
      findings.push({rule: 'missing_package_integrity_hash', package: pkgKey});
    }
  }
}

const summary = {
  check: 'ci:scan:deps',
  package_manager: pkg.packageManager ?? null,
  direct_dependencies: Object.keys(directDeps).length,
  dev_dependencies: Object.keys(devDeps).length,
  locked_packages_checked: lockedPackagesCount,
  locked_snapshots_checked: lockedSnapshotsCount,
  unpinned_or_untrusted_specs: unpinnedCount,
  lockfile_drift: lockfileDriftCount,
  missing_integrity_hashes: missingIntegrityCount,
  blocked_packages: blockedPackageCount,
  findings,
  status: findings.length === 0 ? 'PASS' : 'FAIL',
};

console.log(JSON.stringify(summary, null, 2));
if (summary.status !== 'PASS') process.exit(1);
