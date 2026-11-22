import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {basename, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const npmCliCandidate = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const useDirectNpmCli = basename(npmCliCandidate) === 'npm-cli.js' && existsSync(npmCliCandidate);

const stages = [
  {name: 'contracts:validate', args: ['run', 'contracts:validate']},
  {name: 'ci:scan:secrets', args: ['run', 'ci:scan:secrets']},
  {name: 'ci:scan:deps', args: ['run', 'ci:scan:deps']},
  {name: 'ci:verify-images', args: ['run', 'ci:verify-images']},
  {name: 'ci:test', args: ['run', 'ci:test']},
  {name: 'typecheck', args: ['run', 'typecheck']},
  {name: 'lint', args: ['run', 'lint']},
  {name: 'ci:lint:all', args: ['run', 'ci:lint:all']},
  {name: 'test', args: ['test']},
  {name: 'build', args: ['run', 'build']},
  {name: 'astryx:doctor', args: ['run', 'astryx', '--', 'doctor', '--built', 'apps/patient-portal']},
];

function runNpmStage(args) {
  if (useDirectNpmCli) {
    return spawnSync(process.execPath, [npmCliCandidate, ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: false,
    });
  }
  if (process.platform === 'win32') {
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm', ...args], {
      cwd: repoRoot,
      encoding: 'utf8',
      shell: false,
    });
  }
  return spawnSync('npm', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
  });
}

const results = [];
let failed = false;

for (const stage of stages) {
  const startedAt = new Date().toISOString();
  const proc = runNpmStage(stage.args);
  const endedAt = new Date().toISOString();
  const exitCode = proc.status ?? 1;
  results.push({
    stage: stage.name,
    command: `npm ${stage.args.join(' ')}`,
    started_at: startedAt,
    ended_at: endedAt,
    exit_code: exitCode,
    status: exitCode === 0 ? 'PASS' : 'FAIL',
  });
  if (exitCode !== 0) {
    if (proc.error?.message) {
      process.stderr.write(`${proc.error.message}\n`);
    }
    process.stderr.write(proc.stderr ?? '');
    process.stdout.write(proc.stdout ?? '');
    failed = true;
    break;
  }
}

const summary = {
  check: 'ci:dry-run',
  stages_executed: results.length,
  stages_total: stages.length,
  results,
  status: failed ? 'FAIL' : 'PASS',
};

console.log(JSON.stringify(summary, null, 2));
if (failed) process.exit(1);
