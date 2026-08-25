---
name: flo-distribute-deliverables
description: Prepare and track Flo distribution specifications, deliverables, and readiness gates. Use for publish, deliver, syndicate, or handoff workflows.
---

# Flo distribute deliverables

## Workflow

1. List or fetch distribution specifications (`flo_api_list_distribution_specifications` or generated equivalent).
2. Inspect deliverables and readiness evaluations for the target spec/revision.
3. Trigger publish or deliver actions only when the user explicitly confirms.
4. Return deliverable ids, gate status, and blocking reasons from the API response.

## Safety

- Distribution actions can affect external destinations — confirm environment (dev/stg/prd) first.
- Never expose raw API keys in summaries.
