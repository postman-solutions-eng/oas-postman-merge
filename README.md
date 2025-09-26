# OAS → Postman Collection Merge

[![OAS → Working Collection (PR + optional publish)](https://github.com/postman-solutions-eng/postman-merge-demo/actions/workflows/oas-merge.yaml/badge.svg)](https://github.com/postman-solutions-eng/postman-merge-demo/actions/workflows/oas-merge.yaml)

Automate keeping your curated Postman collections in sync with OpenAPI specs.  
Preserve auth, scripts, and doc links — get small, reviewable diffs and (optionally) publish back to Postman.

---

## Quick Start

```bash
# Install deps
npm i

# Generate a reference collection from your spec
npx openapi-to-postmanv2 -s openapi/demo.yaml -o ref/demo.postman_collection.json -p

# Merge into a new artifact
node scripts/merge.js --config config/merge.config.yaml \
  --working collections/working.json --refdir ref --out collections/working.merged.json

# Review the changelog
node scripts/changelog.js --before collections/working.json \
  --after collections/working.merged.json --out CHANGELOG.md

# Replace & normalize for tidy diffs
cp collections/working.merged.json collections/working.json
node scripts/normalize.js collections/working.json
jq -S . collections/working.json > tmp && mv tmp collections/working.json
```

---

## How It Works

- Specs in `openapi/` are converted to **Reference collections**.
- Reference is merged into `collections/working.json`:
  - Updates only structural fields (method, URL, params, body).
  - Preserves curated content (auth, scripts, names, doc links).
  - New endpoints tagged `status:new`.
  - Removed endpoints moved to `_retired`.
- A changelog (`CHANGELOG.md`) lists **Added** and **Retired** endpoints.
- JSON is normalized and sorted for stable diffs.
- GitHub Actions:
  - Opens a PR with changes.
  - Optionally publishes to Postman on merge to `main`.

---

## Repo Layout

```
collections/working.json        # curated source of truth
openapi/*.yaml|json             # your OpenAPI specs
config/merge.config.yaml        # mapping & options
scripts/merge.js                # merge engine
scripts/normalize.js            # cleanup for stable diffs
scripts/changelog.js            # Added/Retired summary
.github/workflows/oas-merge.yml # CI pipeline
```

---

## Config Example

```yaml
services:
  - name: "Demo"
    spec: "openapi/demo.yaml"
    workingFolder: ["sites"]
options:
  keepWorkingItemName: true
  descriptionDelimiter: "\n---\n"
  tagNew: "status:new"
  retireMode: "move"   # move | skip | delete
  order: "keep"
```

---

## Why Use This

- Avoids re-import/reconfigure churn.  
- Protects curated work (auth, scripts, doc links).  
- PR diffs are small and reviewable.  
- Removed endpoints are safely archived in `_retired`.  
- Optionally auto-publishes collections back to Postman.

---
