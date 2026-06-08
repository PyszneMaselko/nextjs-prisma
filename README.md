# Policy Checker MVP

Web MVP for the SKILL AND CHILL recruitment case study. The app evaluates purchase/vendor requests against published, versioned business policies and stores an auditable decision snapshot.

## What is included

- Purchase request form with dynamic personal-data fields.
- Role-specific screens for requester intake, reviewer queue, policy studio and audit reconstruction.
- Request queue, filters, detail view, comments and attachment metadata.
- Deterministic rule engine with explainable decisions.
- Decisions: `APPROVED`, `REQUIRES_REVIEW`, `REJECTED`, `MISSING_INFORMATION`.
- Policy, policy version and rule models in Prisma.
- Rule builder and basic rule testing console.
- Evaluation history with input snapshot, result snapshot and applied policy versions.
- Manual override stored separately from the original system decision.
- Operational dashboard with request counts, rule hits and missing fields.
- Demo scenario: SaaS request for Acme Analytics, 8 000 EUR, personal data, no DPA.

## Stack

- Next.js pages router
- TypeScript
- Prisma
- PostgreSQL
- Zod
- SWR
- Medusa UI, Medusa icons and the Medusa Tailwind preset
- Tailwind CSS
- Vitest

## Local commands

```bash
npm install
npm run test
npm run build
```

Because this project path contains `&`, local Windows shells may fail on package binaries such as `next` or `prisma`. Direct node invocations work:

```powershell
node .\node_modules\prisma\build\index.js generate
node .\node_modules\next\dist\bin\next build
```

## Database

The Prisma schema expects:

```bash
DATABASE_URL="postgresql://..."
```

Run migrations and seed after pointing `DATABASE_URL` to a reachable Postgres database:

```bash
prisma migrate deploy
npm run seed
```

For local UI verification without a reachable Postgres database, run the app in memory demo mode:

```powershell
$env:POLICY_CHECKER_MEMORY_DEMO="1"
node .\node_modules\next\dist\bin\next dev -p 3000
```

Memory mode is for local demo/testing only. The normal API path uses Prisma and PostgreSQL.

## Notes

- AI is not used to make final decisions. The rule engine evaluates JSON conditions and effects deterministically.
- Published policy versions should not be edited directly; create a new draft version, add rules, then publish.
- Attachment handling is metadata-only in this MVP. A production version should connect this model to object storage.
