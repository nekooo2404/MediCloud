const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RlsSqlExecutor {
  $executeRawUnsafe: (query: string, ...values: unknown[]) => Promise<unknown>;
}

export interface TenantTransactionOptions {
  enforceRuntimeRole?: boolean;
}

export async function setTransactionTenantContext(
  tx: RlsSqlExecutor,
  tenantId: string,
  options: TenantTransactionOptions = {},
): Promise<void> {
  if (!UUID_REGEX.test(tenantId)) {
    throw new Error('Invalid tenantId for PostgreSQL transaction RLS context');
  }
  await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, tenantId);
  if (options.enforceRuntimeRole) {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE medicloud_runtime`);
  }
}
