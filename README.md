# TiMELiNES

TiMELiNES is a structured knowledge platform for publishing curated chronological timelines with editorial tooling, PostgreSQL-backed search, and source-aware event management.

## Stack

- Next.js 14 App Router with TypeScript strict mode
- PostgreSQL (Neon-ready) with repository-pattern data access
- Zod validation on all write and query surfaces
- ISR-rendered public timeline pages and authenticated admin APIs

## Local development

1. Copy `.env.example` to `.env.local`.
2. Run `npm install`.
3. Start the app with `npm run dev`.

If `DATABASE_URL` is not set, the app runs in deterministic sample-data mode for development only. Production requires a configured database.

## Scripts

- `npm run dev`: start local development
- `npm run build`: production build
- `npm run lint`: ESLint
- `npm run typecheck`: TypeScript verification
- `npm run seed`: initialize the database schema and seed curated sample timelines
