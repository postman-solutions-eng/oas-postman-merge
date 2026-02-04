# Testing the OAS → Postman Auto-Merge

This guide walks you through testing the automated OpenAPI-to-Postman merge workflow.

## What This Tool Does

When an OpenAPI spec changes, it automatically:
1. Updates the Postman collection (preserving your customizations)
2. Creates a PR for review
3. Publishes to Postman when merged

---

## Quick Start: Try the Demo

### Step 1: Fork the Collection in Postman

1. Go to the **Demo API** collection in the team workspace
2. Click the `•••` menu → **Create a fork**
3. Name it something like "Demo API - [Your Name]"
4. This is YOUR copy to safely test with

### Step 2: Watch the Magic Happen

We'll simulate an API change. Here's what to look for:

1. **Check the repo:** https://github.com/postman-solutions-eng/oas-postman-merge
2. **Look at the OpenAPI spec:** `openapi/demo-v2.yaml`
3. **When someone pushes a change** → a PR appears automatically

### Step 3: Review the PR

The auto-generated PR shows:
- 📝 **Changelog** in the PR description (what endpoints changed)
- 📊 **Diff** of the collection JSON

### Step 4: After PR Merges

1. The main collection updates in Postman automatically
2. **In YOUR fork:** Click **Pull changes** to see what changed
3. Review the diff before accepting

---

## Try It Yourself

### Make a Test Change

Edit `openapi/demo-v2.yaml` and add a new endpoint:

```yaml
  /sites/{siteId}/test-endpoint:
    get:
      operationId: testEndpoint
      summary: My test endpoint
      parameters:
        - in: path
          name: siteId
          required: true
          schema: { type: string }
      responses:
        "200": { description: ok }
```

Push it to a branch → create PR → watch the workflow run!

---

## What Gets Preserved

When the merge runs, YOUR customizations are kept:

| Preserved ✅ | Updated 🔄 |
|--------------|------------|
| Test scripts | New endpoints added |
| Custom descriptions | Removed endpoints retired |
| Auth configurations | Parameter changes |
| Example responses | URL/method changes |
| Custom headers | |

---

## The Fork Workflow (Recommended)

```
┌─────────────────────────────────────────┐
│  Main Collection (auto-updated)         │
│  "Demo API"                             │
└─────────────────────────────────────────┘
              ↓ fork
┌─────────────────────────────────────────┐
│  Your Fork (safe sandbox)               │
│  "Demo API - Your Name"                 │
│                                         │
│  • Pull changes when ready              │
│  • Review diff before accepting         │
│  • Add your own customizations          │
└─────────────────────────────────────────┘
```

---

## Local Testing (Optional)

If you want to test locally:

```bash
# Clone the repo
git clone git@github.com:postman-solutions-eng/oas-postman-merge.git
cd oas-postman-merge

# Install dependencies
npm install

# Run the merge locally
npm run merge

# See the changelog
cat CHANGELOG.md

# Dry-run publish (no changes made)
npm run publish:test
```

---

## Troubleshooting

### "I don't see the PR"
- Check the [Actions tab](https://github.com/postman-solutions-eng/oas-postman-merge/actions) for workflow status
- Make sure your change was to `openapi/*.yaml`

### "The workflow failed"
- Check the error in the Actions log
- Common issue: Invalid OpenAPI syntax

### "I don't see changes in my fork"
- Click **Pull changes** in Postman to sync with the main collection
- You must manually pull — changes don't auto-sync to forks

---

## Questions?

Ping the team in Slack or open an issue in the repo!
