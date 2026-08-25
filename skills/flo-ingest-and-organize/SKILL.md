---
name: flo-ingest-and-organize
description: Upload or register new media in Flo, place it in the right inventory/collection, and tag metadata. Use for ingest, import, organize, or catalog requests.
---

# Flo ingest and organize

## Workflow

1. Confirm target inventory or collection if the user specified one.
2. Start upload with `flo_api_create_upload` / upload presign flow from the OpenAPI upload tools.
3. Create or update the asset record (`flo_api_create_asset`, `flo_api_patch_asset`).
4. Attach tags/metadata (`flo_api_update_asset_metadata` or related patch tools).
5. Add to collection when requested (`flo_api_add_collection_member` or equivalent generated tool).

## Safety

- Ask before overwriting existing assets or metadata.
- Use test keys only in non-production environments unless the user confirms live data.
