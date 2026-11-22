# T03 Migration and Seed Evidence

**Environment:** Disposable Docker PostgreSQL 16, `localhost:55432`, synthetic credentials only.
**Database lifecycle:** Container `medicloud-t03-postgres` was created for validation and stopped after checks.
**Schema tool:** Prisma 6.19.0.

## Commands and results

- `DATABASE_URL=postgresql://medicloud:medicloud@localhost:55432/medicloud prisma validate`: PASS.
- `prisma migrate dev --name init`: PASS; migration `20261121104559_init` applied to empty database.
- `npm run db:seed`: PASS, counts `2/8/4/40/20/10/10/50` for tenants/users/practitioners/slots/appointments/encounters/observations/outbox.
- `npm run db:seed` repeated: PASS, identical counts; no duplicate rows.
- `docker stop medicloud-t03-postgres`: PASS; disposable database removed by `--rm` lifecycle.

No real PHI/PII, credentials or patient data were used.
