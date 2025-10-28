# Testing OAS → Postman Merge with Your Collections

**5-minute test** to see how the merge tool preserves your curated content while keeping your Postman collection in sync with your OpenAPI spec.

## 🚀 Quick Test

### 1. Setup
```bash
git clone https://github.com/postman-solutions-eng/oas-postman-merge.git
cd oas-postman-merge
npm install
npm install -g openapi-to-postmanv2@latest
```

### 2. Add Your Files
```bash
# Put your OpenAPI spec here (YAML or JSON)
cp /path/to/your-spec.yaml openapi/my-api.yaml

# Export your Postman collection as JSON and put it here
cp /path/to/your-collection.json collections/my-collection.json
```

### 3. Run the Test
```bash
# This does everything automatically: detect files → convert → merge → changelog
npm run test-merge
```

### 4. Check Results
```bash
# See what changed
cat CHANGELOG.md

# Import the merged collection back into Postman
# File will be: collections/your-collection.merged.json
```

**That's it!** 🎉 The tool automatically:
- Detects your OpenAPI spec and collection
- Converts the spec to Postman format  
- Merges while preserving your auth, scripts, and headers
- Generates a human-readable changelog
- Normalizes the output for clean diffs

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
- **Removed Endpoints**: Moved to `_retired` folder

## 📤 Quick Feedback

If this worked well (or didn't!), let us know:
- 🐛 **Issues**: [GitHub Issues](https://github.com/postman-solutions-eng/oas-postman-merge/issues)
- 💬 **Discussion**: [GitHub Discussions](https://github.com/postman-solutions-eng/oas-postman-merge/discussions)

Include: Collection size (~50 requests), API type (REST with OAuth), what worked, any issues.

---

## 🔧 Advanced Configuration

### Custom Config File
If you need more control, create `config/my-test.config.yaml`:

```yaml
services:
  - name: "My API"
    spec: "openapi/my-api.yaml"          # Your OpenAPI spec
    workingFolder: ["API v1"]            # Folder in your collection (optional)

options:
  keepWorkingItemName: true              # Preserve custom request names
  preferOperationId: true               # Use OpenAPI operationId when available
  descriptionDelimiter: "\n---\n"       # Delimiter for curated vs generated docs
  tagNew: "status:new"                  # Tag for new endpoints
  retireMode: "move"                    # move | skip | delete for removed endpoints
  order: "keep"                         # keep | alpha for folder organization
```

### Manual Workflow (Alternative to npm run test-merge)
```bash
# Step by step commands if you want more control
mkdir -p ref
openapi-to-postmanv2 -s openapi/my-api.yaml -o ref/my-api.postman_collection.json -p
node scripts/merge.js --config config/my-test.config.yaml --working collections/my-collection.json --refdir ref --out collections/my-collection.merged.json
node scripts/enhanced-changelog.js --before collections/my-collection.json --after collections/my-collection.merged.json --out CHANGELOG.md
```

## 🐛 Troubleshooting

### "No OpenAPI spec found"
- Place your `.yaml`, `.yml`, or `.json` spec in the `openapi/` directory
- The test script auto-detects the first spec file it finds

### "No collection found"
- Export your Postman collection as JSON
- Place it in the `collections/` directory
- Avoid names with "merged" or "working" in them

### "Invalid OpenAPI spec"
```bash
# Validate your spec first
npx swagger-parser validate openapi/your-spec.yaml
```

### "Merge not preserving auth"
Check your descriptions use the `---` delimiter:
```markdown
Custom auth setup for our team.
---
Generated from OpenAPI spec.
```

Everything above `---` is preserved, everything below gets updated.

### Large Collections
For 100+ requests, enable debug logging:
```bash
DEBUG=1 npm run test-merge
```

---

**Thank you for testing!** 🙏 Your feedback helps make this tool better for the entire API community.
