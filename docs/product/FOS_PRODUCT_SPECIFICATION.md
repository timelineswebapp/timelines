FOS_PRODUCT_SPECIFICATION.md

TiMELiNES Founder Operating System — Product Specification

Version: 1.0

Status: Living Product Specification

Authority Level: Tier 2

Parent Authority:

* Product Constitution
* Institutional Architecture
* Founder Operating System (LOCK)

⸻

Purpose

This document specifies how the Founder Operating System is implemented as a product.

It defines:

* information architecture
* navigation
* operational workflows
* screen responsibilities
* interaction behavior
* reusable UI components

This document does not replace the Founder Operating System.

The Founder Operating System remains the governing architectural authority.

This specification exists to guide implementation.

It may evolve through production experience.

⸻

Product Philosophy

The Founder should experience TiMELiNES as operating a historical publishing institution.

The product should feel:

* calm
* intelligent
* editorial
* operational
* continuous
* trustworthy

It should never feel:

* technical
* developer-oriented
* infrastructure-focused
* API-driven

⸻

Design Principles

Calm

Reduce cognitive load.

Only show what matters.

⸻

Continuous

The institution is always operating.

The interface reflects continuous activity.

⸻

Operational

The Founder supervises.

The platform performs.

⸻

Editorial

Focus on historical publishing.

Not software administration.

⸻

Progressive Disclosure

Reveal complexity only when required.

Implementation details belong inside Diagnostics.

⸻

Information Architecture

Primary navigation:

Home
Queue
Library
Analytics
Settings
──────────────
Diagnostics

This navigation is considered stable.

Future additions should integrate into this structure rather than expanding it.

⸻

Home

Purpose

Provide the Founder with an immediate understanding of today’s operational state.

Primary Question

“What requires my attention today?”

⸻

Layout

1. Institution Summary
2. Add Topics
3. Founder Inbox
4. Queue Summary
5. Factory Suggestions
6. Recent Publications
7. Activity Feed
8. Operational Health

This order reflects visual priority.

⸻

Institution Summary

Display:

* Institution status
* Factory status
* Factory mode
* Active workflows
* Queue depth
* Inbox count
* Published today
* Failed topics

⸻

Add Topics

Single input supporting:

* one topic
* multiple topics
* comma-separated
* newline-separated

Primary action:

Queue Topics

⸻

Queue Summary

Provide a concise overview.

Display:

* Running
* Queued
* Waiting Review
* Published Today
* Failed

Selecting a section opens the Queue page filtered accordingly.

⸻

Founder Inbox

Display only actionable items.

Each card contains:

* Topic
* Reason
* Priority
* Suggested action

Primary actions:

Approve

Return for Revision

Reject

Retry

Dismiss

No additional navigation should normally be required.

⸻

Factory Suggestions

Each suggestion contains:

* Topic
* Confidence
* Reason
* Estimated authority quality

Actions:

Queue

Dismiss

Ignore

Suggestions remain outside production.

⸻

Recent Publications

Each publication displays:

* Topic
* Publication time
* Verification
* Public link

Recent Publications confirm successful institutional output.

⸻

Activity Feed

Chronological operational events.

Examples:

* Topic entered Research
* Extraction completed
* Governance Review required
* Published
* Suggestion generated
* Operational alert

Maximum default history:

50 events.

⸻

Operational Health

Summarize:

* Institution
* Factory
* Governance
* Historical Library
* Published Memory
* Projection

Use simple status:

Healthy

Warning

Critical

⸻

Queue

Purpose

Represent all production work.

⸻

Sections

Running

Queued

Waiting Review

Published Today

Failed

Cancelled

⸻

Queue Card

Display:

* Topic
* Origin
* Progress
* Stage
* ETA
* Priority

Actions vary by state.

⸻

Filters

Origin:

Founder

Factory

Visitor

Status

Priority

Search

⸻

Topic Details

Purpose:

Everything related to one Topic.

Sections:

Overview

Timeline

Evidence Summary

Publication Preview

Activity

History

Diagnostics

Diagnostics remain collapsed by default.

⸻

Library

Purpose:

Browse published knowledge.

Includes:

Timelines

Historical Objects

Milestones

Relationships

Sources

Collections

Coverage

No operational workflow appears here.

⸻

Analytics

Purpose:

Understand platform usage.

Sections:

Visitors

Search

Reading

Engagement

Popular Topics

Failed Searches

Growth

Publication Metrics

⸻

Settings

Purpose:

Configure institution behavior.

Sections:

Factory

Automation

Notifications

Providers

Appearance

Preferences

⸻

Diagnostics

Purpose:

Technical investigation.

Contains:

Factory

Governance

Historical Library

Published Memory

Projection

Workers

Scheduler

Replay

Providers

Logs

API tools

JSON

Identifiers

Diagnostics remain isolated from normal operation.

⸻

Visual Hierarchy

Priority order:

1. Human-required work
2. Production work
3. Publications
4. Suggestions
5. Operational health
6. Technical information

Technical information should never visually dominate operational work.

⸻

Terminology

Preferred:

Topic

Queue

Research

Preparing

Publishing

Published

Waiting Review

Retry

Revision

Avoid exposing:

Package Draft

Authority Preparation

Governance Handoff

Lifecycle Transition

Replay Boundary

Worker Lease

Heartbeat

HTTP methods

Endpoints

⸻

Component Library

Reusable components include:

Topic Card

Queue Card

Inbox Card

Suggestion Card

Publication Card

Health Card

Statistic Card

Activity Card

Status Badge

Progress Indicator

Every operational page should be composed from these shared components.

⸻

Empty States

Every screen should provide helpful empty states.

Examples:

“No Topics are currently processing.”

“No review items require your attention.”

“No Factory Suggestions are available.”

⸻

Loading States

Loading should preserve layout stability.

Prefer skeletons over spinners.

⸻

Error States

Errors should:

* explain the problem
* suggest the next action
* avoid technical language

Example:

“Research could not be completed because the source provider was temporarily unavailable.”

Rather than:

“Worker timeout.”

⸻

Responsive Behavior

Desktop:

Full operational layout.

Tablet:

Two-column layout.

Mobile:

Single-column.

Diagnostics may simplify presentation but preserve functionality.

⸻

Accessibility

Support:

Keyboard navigation

Logical focus order

Accessible color contrast

Semantic headings

Screen readers

Readable status indicators

Accessibility is a product requirement, not an enhancement.

⸻

Evolution Policy

This specification may evolve based on:

* Founder experience
* Visitor behavior
* Operational observations
* Production evidence
* Usability testing

It shall never conflict with the Founder Operating System.

If a conflict exists:

The Founder Operating System prevails.

⸻

Success Criteria

The Founder should be able to operate TiMELiNES by naturally progressing through:

Home

↓

Queue

↓

Founder Inbox (when required)

↓

Published Library

↓

Analytics

Without needing to understand the underlying institutional implementation.

The platform should feel like operating a living historical publishing institution rather than administering a software system.