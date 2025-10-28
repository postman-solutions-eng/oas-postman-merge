# Testing OAS → Postman Merge with Your Collections

This guide helps you test the merge tool with your **real Postman collections and OpenAPI specs** to see how it preserves your curated content while keeping APIs in sync.

## 🚀 Quick Setup

### 1. Clone and Install
```bash
git clone https://github.com/postman-solutions-eng/oas-postman-merge.git
cd oas-postman-merge
npm install
```

### 2. Install OpenAPI Converter
```bash
npm install -g openapi-to-postmanv2@latest
```

## 📁 Prepare Your Files

### Your OpenAPI Spec
- **Location**: Place your OpenAPI spec in `openapi/your-api.yaml` (or `.json`)
- **Requirements**: Valid OpenAPI 3.0+ specification
- **Validation**: Test with `npx swagger-parser validate openapi/your-api.yaml`

### Your Postman Collection
- **Export**: Export your curated collection from Postman as JSON
- **Location**: Place it as `collections/your-collection.json`
- **Backup**: Keep a backup copy - the merge will modify this file

## ⚙️ Configuration

### Option 1: Use Example Config (Recommended)
Copy and customize an example configuration:

```bash
# For single API
cp examples/configs/rest-api.config.yaml config/my-test.config.yaml

# For microservices
cp examples/configs/microservices.config.yaml config/my-test.config.yaml
```

### Option 2: Create Custom Config
Create `config/my-test.config.yaml`:

```yaml
services:
  - name: "My API"
    spec: "openapi/your-api.yaml"          # ← Your OpenAPI spec
    workingFolder: ["API v1"]              # ← Folder in your collection

options:
  # Preserve your custom request names
  keepWorkingItemName: true
  
  # Use OpenAPI operationId when available
  preferOperationId: true
  
  # Delimiter for separating curated vs generated docs
  descriptionDelimiter: "\n---\n"
  
  # Tag new endpoints for easy identification
  tagNew: "status:new"
  
  # What to do with removed endpoints
  retireMode: "move"    # move | skip | delete
  
  # Keep your folder organization
  order: "keep"         # keep | alpha
```

## 🔄 Running the Test

### Step 1: Generate Reference Collection
```bash
# Convert your OpenAPI spec to a Postman collection
mkdir -p ref
openapi-to-postmanv2 -s openapi/your-api.yaml -o ref/your-api.postman_collection.json -p
```

### Step 2: Run the Merge
```bash
# Merge while preserving your curated content
node scripts/merge.js \
  --config config/my-test.config.yaml \
  --working collections/your-collection.json \
  --refdir ref \
  --out collections/your-collection.merged.json
```

### Step 3: Generate Changelog
```bash
# See what changed in human-readable format
node scripts/enhanced-changelog.js \
  --before collections/your-collection.json \
  --after collections/your-collection.merged.json \
  --out CHANGELOG.md
```

### Step 4: Review Results
```bash
# Look at the semantic changelog
cat CHANGELOG.md

# Import the merged collection back into Postman
# File: collections/your-collection.merged.json
```

## 🔍 What to Look For

### ✅ **Should Be Preserved** (Your Curated Content)
- **Authentication configs** (Bearer tokens, API keys, OAuth)
- **Pre-request and test scripts** (`pm.test`, `pm.environment.set`)
- **Custom headers** (API keys, correlation IDs, etc.)
- **Environment variables** (`{{baseUrl}}`, `{{apiKey}}`)
- **Custom request names** ("Create User (Admin Only)")
- **Documentation links** and notes above the `---` delimiter
- **Folder-level auth** and variables

### 🔄 **Should Be Updated** (From OpenAPI Spec)
- **Request methods** (GET, POST, PUT, DELETE)
- **URL paths** and path parameters
- **Query parameters** (new ones added, old ones removed)
- **Request body schemas** (JSON structure)
- **Response examples** and schemas
- **Generated documentation** (below the `---` delimiter)

### 📊 **Changelog Should Show**
- **Added Endpoints**: New API endpoints from your spec
- **Modified Endpoints**: Changed parameters or methods
- **Preserved Content**: Scripts, auth, headers, descriptions maintained
- **Removed Endpoints**: Moved to `_retired` folder (if `retireMode: "move"`)

## 🐛 Common Issues & Solutions

### Issue: "File not found" Error
```bash
# Check file paths match your config
ls -la openapi/your-api.yaml
ls -la collections/your-collection.json
```

### Issue: "Invalid OpenAPI spec"
```bash
# Validate your spec first
npx swagger-parser validate openapi/your-api.yaml
```

### Issue: "Merge not preserving auth"
**Solution**: Check your descriptions use the `---` delimiter:
```markdown
Custom auth setup instructions for our team.

Important: Use the staging API key for testing.
---
Generated from OpenAPI spec. Version 1.2.0
```

### Issue: Large, noisy diffs
```bash
# Normalize the JSON for cleaner diffs
node scripts/normalize.js collections/your-collection.merged.json
```

### Issue: "Auth Configs Changed" in changelog
This is normal when new endpoints are added (they get new auth configs). Only worry if your existing endpoint auth is lost.

## 🧪 Advanced Testing Scenarios

### Test 1: New Endpoints
1. Add a new endpoint to your OpenAPI spec
2. Run the merge
3. Verify it appears tagged with `status:new`
4. Check that existing endpoints are unchanged

### Test 2: Modified Endpoints  
1. Add a query parameter to an existing endpoint in your spec
2. Run the merge
3. Verify the parameter is added but your test scripts remain

### Test 3: Removed Endpoints
1. Remove an endpoint from your OpenAPI spec
2. Run the merge with `retireMode: "move"`
3. Verify it moves to `_retired` folder instead of being deleted

### Test 4: Large Collections
```bash
# For collections with 100+ requests, enable debug logging
DEBUG=1 node scripts/merge.js --config config/my-test.config.yaml ...
```

## 📤 Providing Feedback

### What to Share
When reporting results, include:

1. **Collection size**: "~50 requests across 5 folders"
2. **API type**: "REST API with OAuth 2.0"
3. **What worked**: "All auth preserved, new endpoints tagged correctly"
4. **Issues found**: "Custom header 'X-Correlation-ID' was lost"
5. **Changelog snippet**: Copy relevant parts

### Where to Report
- 🐛 **Issues**: [GitHub Issues](https://github.com/postman-solutions-eng/oas-postman-merge/issues)
- 💬 **Discussion**: [GitHub Discussions](https://github.com/postman-solutions-eng/oas-postman-merge/discussions)
- 📧 **Direct feedback**: Include your use case and collection complexity

## 🎯 Success Criteria

**This tool is working well for you if:**

✅ **Zero manual work**: No need to reconfigure auth, scripts, or headers after merge  
✅ **Small, reviewable diffs**: Changes are clearly API evolution, not formatting noise  
✅ **Reliable automation**: Can run this as part of your API development workflow  
✅ **Team-friendly**: Other developers can understand what changed from the changelog  

## 🚀 Next Steps

If testing goes well:
1. **Integrate with CI/CD**: Use the GitHub Actions workflow
2. **Team adoption**: Share config examples with your team
3. **Automation**: Set up automatic collection publishing to Postman
4. **Monitoring**: Track API evolution over time with changelog history

---

**Thank you for helping test this tool!** Your real-world feedback will help make it better for the entire API community. 🙏
