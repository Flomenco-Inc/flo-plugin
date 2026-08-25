---
name: flo-logo-brand-qc
description: Run logo and brand QC checks on Flo assets against a reference image. Use for brand compliance, logo placement, or visual QC requests.
---

# Flo logo brand QC

## Workflow

1. Identify the candidate asset (search if needed — see `flo-search-and-retrieve`).
2. Identify the reference logo asset id (stored reference image in Flo).
3. Use distribution/review/model tools exposed by MCP for QC when available, or asset analysis endpoints under `/assets` and `/models`.
4. Return pass/fail summary, scores, and links to any generated QC artifacts.

## Notes

- The Claude-specific plugin also exposes `flo_qc_logo` via interface-agent; prefer MCP API tools in generic clients (Cursor/Kiro).
- Always include both asset ids in the result for traceability.
