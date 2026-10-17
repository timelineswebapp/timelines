# TiMELiNES AI Development Rules

This repository contains the TiMELiNES platform.

TiMELiNES presents complex histories and developments as chronological timelines.

## Architecture Principles

- Separation of concerns
- Strict schema validation
- Backend controls database access
- Frontend never directly accesses database
- All data flows through API routes
- TypeScript strict mode enabled

## Technology Stack

Frontend: Next.js 14 + TypeScript  
Backend: Next.js API routes  
Database: PostgreSQL (Neon)  
Hosting: Vercel  

## UI Design

Design style: Apple Liquid Glass

Principles:

- minimalistic
- mobile-first
- clean typography
- glass effects
- strong vertical timeline layout

## Database Model

Core entities:

- timelines
- events
- sources
- tags
- timeline_requests

Events are the atomic knowledge unit.

## Coding Standards

- Use TypeScript everywhere
- Use repository pattern for database access
- Validate all inputs using schema validation
- Avoid business logic inside UI components

## Security

- No direct DB access from frontend
- Rate limit timeline request endpoint
- Sanitize all user input

## Phase Structure

Phase 1:
- curated timelines (50-200)
- manual admin content creation
- simple search

Phase 2:
- LLM generated timelines
- automated verification pipeline
- expanded knowledge graph

## Deployment

Deployment platform: Vercel

Every commit to main triggers deployment.

Environment variables:

- DATABASE_URL
- NEXT_PUBLIC_SITE_URL
- NEXT_PUBLIC_GA_ID
- NEXT_PUBLIC_ADSENSE_ID

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
