import {spawnSync} from 'node:child_process';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required for schema validation.');
  process.exit(2);
}

const result = spawnSync('corepack', ['pnpm', 'exec', 'prisma', 'validate', '--schema', 'apps/clinical-api/prisma/schema.prisma'], {
  stdio: 'inherit',
  shell: true,
});
process.exit(result.status ?? 1);
