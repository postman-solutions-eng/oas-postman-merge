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
# ✅ Auto-detects your OpenAPI spec and collection files
# ✅ Uses tags-based folder organization for cleaner structure  
# ✅ No configuration files needed for testing
npm run test-merge
```

### 4. Check Results
```bash
# See what changed
cat CHANGELOG.md

# Import the merged collection back into Postman
# File will be: collections/your-collection.merged.json
```

## 🔄 Multiple Tests & Cleanup

### Testing Different Specs/Collections
```bash
# Test 1: Your current files
npm run test-merge

# Test 2: Different spec (replace your files)
cp /path/to/v2-spec.yaml openapi/my-api.yaml
npm run test-merge  # Auto-cleans previous artifacts

# Test 3: Different collection 
cp /path/to/other-collection.json collections/my-collection.json
npm run test-merge
```

### Manual Cleanup Between Tests
```bash
# Clean up all generated files to start fresh
npm run clean

# Shows what's preserved vs. cleaned:
# ✅ Preserved: Your openapi/*.yaml and collections/*.json files
# 🧹 Cleaned: ref/ folder, *.merged.json files, generated configs
```

### Previous Test Results
The tool automatically **preserves previous changelogs** with timestamps:
- `CHANGELOG.md` - Latest test results
- `CHANGELOG.2024-10-28T14-30-15.md` - Previous test
- `CHANGELOG.2024-10-28T14-25-32.md` - Earlier test

So you can compare results across different API versions! 📊

**That's it!** 🎉 The tool automatically:
- Detects your OpenAPI spec and collection
- Converts the spec to Postman format  
- Merges while preserving your auth, scripts, headers, and **custom Postman variables**
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
  folderOrganization: "Tags"            # "Tags" (cleaner) or "Paths" (URL structure)
```

### Target Folder Merging
**Merge into a specific folder instead of the collection root:**

```yaml
collection:
  # Path to target folder (use "/" for nested folders)
  # Example: "Tableau Cloud Manager REST API/Administrative Methods"
  targetFolder: "Administrative Methods"

services:
  - name: "Admin API"
    spec: "openapi/admin-api.yaml"
    workingFolder: []  # empty = merge directly into targetFolder

options:
  # ... same options as above ...
```

**Why use target folders?**
- ✅ Merge multiple specs into different sections of one collection
- ✅ Keep other parts of your collection untouched
- ✅ Retirement scoped to just the target folder
- ✅ Perfect for monorepo API collections

**Requirements:**
- The target folder **must already exist** in your collection
- Use Postman folder names exactly (case-sensitive)
- Use `/` to separate nested folders (e.g., `"Parent/Child"`)

### Manual Workflow (Alternative to npm run test-merge)
```bash
# Step by step commands if you want more control
mkdir -p ref
# Add folderStrategy=Tags for cleaner organization, or folderStrategy=Paths for URL-based structure
openapi-to-postmanv2 -s openapi/my-api.yaml -o ref/my-api.postman_collection.json -p -O folderStrategy=Tags
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
