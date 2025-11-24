# OAS → Postman Collection Merge

[![OAS → Working Collection (PR + optional publish)](https://github.com/postman-solutions-eng/oas-postman-merge/actions/workflows/oas-merge.yaml/badge.svg)](https://github.com/postman-solutions-eng/oas-postman-merge/actions/workflows/oas-merge.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/oas-postman-merge.svg)](https://badge.fury.io/js/oas-postman-merge)

**Automated tool to merge OpenAPI specs into Postman collections while preserving curated content.**

🔄 **Keep collections in sync** with evolving APIs  
🛡️ **Preserve auth, scripts, and docs** from being overwritten  
📝 **Get semantic, reviewable diffs** instead of noisy regeneration  
🚀 **Publish automatically** to Postman via CI/CD  

> **Perfect for teams** who want the best of both worlds: OpenAPI-driven API development with rich, curated Postman collections for testing and documentation.

---

## 🚀 Installation

### NPM (Recommended)
```bash
npm install -g oas-postman-merge
```

### Clone & Run
```bash
git clone https://github.com/postman-solutions-eng/oas-postman-merge.git
cd oas-postman-merge
npm install
```

## ⚡ Quick Start

> **🧪 Want to test with your own collections?**  
> See our **[Testing Guide](TESTING.md)** for a streamlined 5-minute test with real collections and specs.

---

### 1. **Setup your files**
```bash
# Your OpenAPI spec
openapi/my-api.yaml

# Your curated Postman collection  
collections/working.json

# Configuration
config/merge.config.yaml
```

### 2. **Run the merge**
```bash
# Generate a reference collection from your spec (with tags-based organization)
npx openapi-to-postmanv2 -s openapi/my-api.yaml -o ref/my-api.postman_collection.json -p -O folderStrategy=Tags

# Merge preserving curated content
oas-postman-merge --config config/merge.config.yaml \
  --working collections/my-collection.json --refdir ref --out collections/my-collection.merged.json

# Generate semantic changelog
oas-changelog --before collections/my-collection.json \
  --after collections/my-collection.merged.json --out CHANGELOG.md
```

### 3. **Automated via GitHub Actions**
```yaml
# .github/workflows/oas-merge.yaml
name: OAS → Postman Merge
on:
  push:
    paths: ['openapi/**']
    
jobs:
  merge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install -g oas-postman-merge
      - run: oas-postman-merge --config config/merge.config.yaml
      # Creates PR with changes + optional publish to Postman
```

---

## How It Works

- Specs in `openapi/` are converted to **Reference collections**.
- Reference is merged into your working collection:
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
collections/my-collection.json  # curated source of truth
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
# Optional: Merge into a specific folder instead of collection root
collection:
  targetFolder: "API v2"  # Leave empty for root-level merge

services:
  - name: "Demo"
    spec: "openapi/demo.yaml"
    workingFolder: ["sites"]  # Subfolder within targetFolder
    
options:
  keepWorkingItemName: true
  descriptionDelimiter: "\n---\n"
  tagNew: "status:new"
  retireMode: "move"   # move | skip | delete
  order: "keep"
```

**Target Folder Merging**: Perfect for merging multiple specs into different sections of one collection. Retirement and updates are scoped to just that folder. See [TESTING.md](TESTING.md#target-folder-merging) for details.

---

## 🎯 Why Use This?

### The Problem
- **Manual re-imports** destroy curated auth, scripts, and documentation
- **Generated collections** lack the rich context teams need for testing
- **Large diffs** make API changes impossible to review
- **Inconsistent workflows** between API design and collection maintenance

### The Solution  
- ✅ **Preserve curation** - Auth, scripts, headers, and docs stay intact
- ✅ **Semantic diffs** - See actual API changes, not formatting noise  
- ✅ **Automated workflow** - CI/CD keeps collections in sync without manual work
- ✅ **Safe archives** - Removed endpoints go to `_retired` folder, not deleted
- ✅ **Team collaboration** - PRs show exactly what changed in your API

---

## 🔧 Troubleshooting

### Common Issues

**❌ "File not found" errors**
```bash
# Ensure your config file paths are correct
ls -la config/merge.config.yaml
ls -la collections/my-collection.json
```

**❌ "Invalid JSON" errors**  
```bash
# Validate your collection file
jq . collections/my-collection.json > /dev/null && echo "Valid JSON" || echo "Invalid JSON"
```

**❌ Merge not preserving auth**
```yaml
# Check your config delimiter
options:
  descriptionDelimiter: "\n---\n"  # Must match your descriptions
```

**❌ Large, noisy diffs**
```bash
# Run normalize to clean up the JSON
npm run normalize collections/my-collection.json
```

### Debug Mode
```bash
# Get detailed error information
DEBUG=1 oas-postman-merge --config config/merge.config.yaml ...
```

### Testing with Your Own Collections
- 🧪 **[Testing Guide](TESTING.md)** - 5-minute test with your own collections and specs

### Getting Help
- 📖 **[Contributing Guide](CONTRIBUTING.md)** - Development and testing help
- 🐛 **[GitHub Issues](https://github.com/postman-solutions-eng/oas-postman-merge/issues)** - Bug reports and feature requests
- 💬 **[GitHub Discussions](https://github.com/postman-solutions-eng/oas-postman-merge/discussions)** - Questions and community help

---
