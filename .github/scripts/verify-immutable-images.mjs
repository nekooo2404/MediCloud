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
const DIGEST_FROM_RE = /^FROM\s+([^\s]+@sha256:[0-9a-f]{64})(?:\s+AS\s+[A-Za-z0-9_-]+)?$/i;
const RUNTIME_PKG_MANAGER_RE = /\b(?:pnpm|npm|npx|corepack)\b/i;

const dockerfiles = [
  '.github/docker/Dockerfile.patient-portal',
  '.github/docker/Dockerfile.clinical-api',
];
const findings = [];

for (const relPath of dockerfiles) {
  const absPath = join(repoRoot, relPath);
  if (!existsSync(absPath)) {
    findings.push({file: relPath, rule: 'missing_dockerfile'});
    continue;
  }
  const raw = readFileSync(absPath, 'utf8');
  const instructions = raw
    .replace(/\\\r?\n/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  const stages = [];
  for (const line of instructions) {
    if (/^FROM\s+/i.test(line)) {
      stages.push([line]);
      if (!DIGEST_FROM_RE.test(line)) {
        findings.push({file: relPath, rule: 'unpinned_base_image', line});
      }
      if (/:latest\b/i.test(line)) {
        findings.push({file: relPath, rule: 'mutable_latest_base_tag', line});
      }
    } else if (stages.length > 0) {
      stages[stages.length - 1].push(line);
    }

    if (/^ADD\s+/i.test(line)) {
      findings.push({file: relPath, rule: 'forbidden_add_instruction', line});
    }
    if (/^COPY\s+.*(?:\.env|\.git\b|docs\/evidence|credentials)/i.test(line)) {
      findings.push({file: relPath, rule: 'forbidden_copy_target', line});
    }
    if (/^COPY\s+(?:--chown=[^\s]+\s+)?\.\/?\s+\.\/?$/i.test(line)) {
      findings.push({file: relPath, rule: 'unselective_copy_dot_dot', line});
    }
  }

  if (stages.length === 0) {
    findings.push({file: relPath, rule: 'missing_from_instruction'});
    continue;
  }
  if (!raw.includes('--frozen-lockfile')) {
    findings.push({file: relPath, rule: 'missing_frozen_lockfile'});
  }
  if (!raw.includes('org.opencontainers.image.revision')) {
    findings.push({file: relPath, rule: 'missing_oci_revision_label'});
  }

  const finalStage = stages[stages.length - 1];
  const userLines = finalStage.filter((line) => /^USER\s+/i.test(line));
  const lastUser = userLines[userLines.length - 1];
  if (!lastUser || !/^USER\s+node(?:\s|$)/i.test(lastUser)) {
    findings.push({file: relPath, rule: 'missing_non_root_user_node'});
  }

  const entryLines = finalStage.filter((line) => /^(?:CMD|ENTRYPOINT)\s+/i.test(line));
  for (const entryLine of entryLines) {
    if (RUNTIME_PKG_MANAGER_RE.test(entryLine)) {
      findings.push({file: relPath, rule: 'forbidden_package_manager_runtime_cmd', line: entryLine});
    }
  }
}

const workflowPath = '.github/workflows/ci.yml';
const workflowAbs = join(repoRoot, workflowPath);
let mutableTagsCount = 0;

if (!existsSync(workflowAbs)) {
  findings.push({file: workflowPath, rule: 'missing_workflow_file'});
} else {
  const workflowRaw = readFileSync(workflowAbs, 'utf8');
  const workflow = YAML.parse(workflowRaw);

  if (workflow?.permissions?.contents !== 'read' || Object.keys(workflow?.permissions ?? {}).length !== 1) {
    findings.push({file: workflowPath, rule: 'excessive_or_missing_workflow_permissions'});
  }

  const jobs = workflow?.jobs ?? {};
  for (const requiredJob of ['quality', 'security-scan', 'immutable-image-build']) {
    if (!jobs[requiredJob]) {
      findings.push({file: workflowPath, rule: `missing_required_job:${requiredJob}`});
    }
  }

  const buildNeeds = jobs['immutable-image-build']?.needs ?? [];
  if (!Array.isArray(buildNeeds) || !buildNeeds.includes('quality') || !buildNeeds.includes('security-scan')) {
    findings.push({file: workflowPath, rule: 'image_build_missing_gate_dependencies'});
  }

  for (const [jobName, jobDef] of Object.entries(jobs)) {
    if (jobDef?.permissions) {
      const perms = jobDef.permissions;
      if (typeof perms !== 'object' || perms.contents !== 'read' || Object.keys(perms).length !== 1) {
        findings.push({file: workflowPath, rule: `job_level_permission_escalation:${jobName}`});
      }
    }
    const steps = Array.isArray(jobDef?.steps) ? jobDef.steps : [];
    for (const step of steps) {
      if (typeof step?.uses === 'string' && /@(?:main|master|latest)\b/i.test(step.uses)) {
        findings.push({file: workflowPath, rule: `mutable_action_ref:${jobName}:${step.uses}`});
      }
      if (typeof step?.uses === 'string' && step.uses.startsWith('docker/build-push-action')) {
        if (step.with?.push !== false || step.with?.load !== false) {
          findings.push({file: workflowPath, rule: `unexpected_docker_push:${jobName}`});
        }
        const tags = String(step.with?.tags ?? '');
        if (/:latest\b/i.test(tags) || !tags.includes(':sha-${{ github.sha }}')) {
          mutableTagsCount += 1;
          findings.push({file: workflowPath, rule: `non_immutable_image_tag:${jobName}:${tags}`});
        }
      }
      const runScript = typeof step?.run === 'string' ? step.run : '';
      if (/\b(?:gcloud\s+run\s+deploy|terraform\s+apply|kubectl\s+apply)\b/i.test(runScript)) {
        findings.push({file: workflowPath, rule: `forbidden_cloud_deploy_command:${jobName}`});
      }
    }
  }
}

const summary = {
  check: 'ci:verify-images',
  dockerfiles_verified: dockerfiles.length,
  workflow_verified: findings.filter((item) => item.file === workflowPath).length === 0,
  mutable_latest_tags: mutableTagsCount,
  non_root_enforced: findings.filter((item) => item.rule === 'missing_non_root_user_node').length === 0,
  digest_pinned_base_images: findings.filter((item) => item.rule === 'unpinned_base_image').length === 0,
  findings,
  status: findings.length === 0 ? 'PASS' : 'FAIL',
};

console.log(JSON.stringify(summary, null, 2));
if (summary.status !== 'PASS') process.exit(1);
