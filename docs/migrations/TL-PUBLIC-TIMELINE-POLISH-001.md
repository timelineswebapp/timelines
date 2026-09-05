# TL-PUBLIC-TIMELINE-POLISH-001

## Scope

Public timeline presentation polish only. No timeline content, chronology fields, database records, backend runtime behavior, security headers, analytics configuration, or production data were changed.

## Changes

- Removed the repeated `View canonical milestone` copy from public timeline event rows while retaining the canonical milestone route, URL-addressable `event` deep links, share controls, and an accessible event-card detail interaction.
- Added an event-specific accessible label to each detail trigger.
- Increased the detail sheet's perceived opacity and backdrop separation while preserving the Liquid Glass treatment. Source rows remain a lighter nested glass surface.
- Removed the public source `Confidence N%` presentation from the sheet and standalone milestone detail. The underlying `credibilityScore` remains available to internal systems.
- Added Escape handling, initial focus on Close, return-focus behavior, dialog labelling, and bounded mobile-height scrolling.
- Updated the public platform certification invariant to certify the event-identity deep-link interaction instead of the removed copy.

## Confidence audit

The public `Confidence 80%` was pseudo-precision rather than a source-specific assessment. Published projections currently assign `credibilityScore: 0.8` uniformly in `functions/src/pipeline.ts` during projection construction. The public percentage was therefore removed without changing stored or internal evidence data.

## Berlin Wall same-day ordering audit

Read-only production inspection found both events normalized to `1989-11-09` with day precision and no intra-day time:

- `Berlin Wall Opens`: `eventOrder=6`, event id `4000000025`.
- `Günter Schabowski's Press Conference Announcement`: `eventOrder=7`, event id `4000000026`.

The deterministic comparator sorts normalized date components and then preserves `eventOrder`, id, and title. Consequently, the displayed order is historically counter-causal for this same-day pair: the press conference announcement should precede the wall opening. No content or chronology data was changed under this presentation-only task. This requires a future Timeline Quality/content correction with explicit same-day ordering semantics.

## Console diagnostic classification

- Cloudflare Insights beacon blocked by CSP: genuine integration/configuration mismatch. Track separately and align the collector deliberately; do not weaken the CSP with a broad source allowance.
- Google Analytics `google.com/g/collect` blocked by CSP: genuine endpoint/configuration mismatch. Track separately and align the configured collector with the narrow analytics allowlist.
- Unused font/logo preloads: non-blocking performance diagnostics. Track as a focused performance cleanup if production measurements show recurring waste.
- `/favicon.ico` 404: genuine small public asset defect. Add the intended icon through a separate asset task.

## Verification

- Application suite: 249 passed, 0 failed.
- Public platform certification: 8 passed, 0 failed.
- TypeScript: passed (`tsc --noEmit`).
- ESLint: passed.
- Next.js optimized production build: passed; 52 static pages generated.
- Responsive implementation: existing tablet/mobile breakpoints preserved; detail height is bounded with `88dvh`, internal overflow, overscroll containment, safe-area bottom padding, and source-row wrapping/stacking. The desktop production viewport was visually inspected at 1280×720; automated CSS regressions cover the responsive-safe surface properties.
- Accessibility: labelled modal dialog, keyboard Escape close, Close autofocus, invoking-event focus restoration, readable nested source links, and event-specific trigger labels verified in production.

## Deployment

- Platform: Vercel production, frontend only.
- Deployment id: `dpl_FVkNWrAHPTct12fZSbuHavW2Ejrp`.
- Deployment URL: `https://timelines-i3uvvpz8r-timelines-app.vercel.app`.
- Canonical alias: `https://www.timelines.sbs`.
- State: `READY`.
- Canonical production verification: `/timeline/the-fall-of-the-berlin-wall` loaded successfully; an event detail opened via its accessible card, showed the stronger glass surface and lighter source rows, contained no confidence percentage, closed with Escape, and restored focus.

## Cleanup

Removed the unrelated `docs/.DS_Store` from the repository working tree by moving it to the user's Trash before certification.
