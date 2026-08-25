---
name: flo-run-workflow
description: List, inspect, and execute Flo workflows (flows) and track executions. Use when the user wants to run automations, pipelines, or flows in Flo.
---

# Flo run workflow

## Workflow

1. List flows with `flo_api_list_flows` when the target flow is unknown.
2. Inspect flow details with `flo_api_get_flow` before executing destructive steps.
3. Execute with `flo_api_execute_flow` (pass required body parameters from the tool schema).
4. Poll execution status with `flo_api_get_execution`, `flo_api_list_execution_steps`, or timeline tools.
5. Report execution id, status, and any failure messages verbatim from the API.

## Tips

- Prefer dry-run or read-only inspection when the user is exploring.
- For long runs, give the execution id so the user can check progress later.
