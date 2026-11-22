# MediCloud Shared Contracts

Versioned P0 contracts for API requests/responses, cross-cloud events and data classification.

- `openapi.json`: HTTP contract for the private Clinical API and GCP entry point.
- `schemas/event-envelope.schema.json`: common event envelope and approved payload variants.
- `data-classification.json`: field/data boundary policy for the P0 workflow.
- `validate.mjs`: offline contract validation using Ajv and synthetic fixtures.

Only synthetic values belong in examples and fixtures. Contract changes require a new decision record or explicit approval because they affect authorization, persistence and cross-cloud data flow.
