# Testing the OAS → Postman Auto-Merge

This guide walks you through testing the automated OpenAPI-to-Postman merge workflow.

## What This Tool Does

When an OpenAPI spec changes, it automatically:
1. Updates the Postman collection (preserving your customizations)
2. Creates a PR for review
3. Publishes to Postman when merged

---

## Setup (Do This First)

### 1. Clone the Repo

```bash
git clone git@github.com:postman-solutions-eng/oas-postman-merge.git
cd oas-postman-merge
npm install
```

### 2. Import the Demo Collection into Postman

1. Open Postman
2. Click **Import** (top left)
3. Select the file: `examples/demo/working.json` from the cloned repo
4. Choose which workspace to import into (or create a new one)
5. Click **Import**

You should now see **"Demo API"** in your Postman workspace.

### 3. Configure GitHub Secrets (Required for Auto-Publish)

For the workflow to publish to Postman, add these to your GitHub repo:

**Add Secret:** https://github.com/postman-solutions-eng/oas-postman-merge/settings/secrets/actions
| Name | Value |
|------|-------|
| `POSTMAN_API_KEY` | Your Postman API key ([get one here](https://go.postman.co/settings/me/api-keys)) |

**Add Variable:** https://github.com/postman-solutions-eng/oas-postman-merge/settings/variables/actions
| Name | Value |
|------|-------|
| `WORKING_COLLECTION_UID` | The UID of your imported collection (see below) |

**To get the Collection UID:**
1. In Postman, click your **Demo API** collection
2. Click the `ⓘ` info icon (or right-click → View Details)
3. Copy the **Collection UID** (format: `12345678-abcd-1234-...`)

### 4. (Optional) Fork the Collection

If you want your own copy to experiment with:

1. Right-click the **Demo API** collection
2. Click **Create a fork**
3. Name it "Demo API - [Your Name]"

---

## Quick Start: Try the Demo

### Step 1: Make a Change to the OpenAPI Spec

Edit `openapi/demo-v2.yaml` — add a new endpoint, modify a parameter, or remove something.

Example — add this under `paths:`:

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

### Step 2: Push and Watch

```bash
git checkout -b my-test-change
git add openapi/demo-v2.yaml
git commit -m "test: add new endpoint"
git push -u origin my-test-change
```

Then go to GitHub and create a PR. The workflow will:
1. ✅ Validate the OpenAPI spec
2. ✅ Run the merge
3. ✅ Create an auto-PR with the merged collection

### Step 3: Review the Auto-PR

The workflow creates a second PR (targeting `main`) with:
- 📝 **Changelog** in the PR description (what endpoints changed)
- 📊 **Diff** of the collection JSON

### Step 4: Merge and Publish

When you merge the auto-PR to `main`:
1. The **publish** job runs automatically
2. The collection updates in Postman within seconds
3. Check Postman — your changes are live!

**If you forked the collection:** Click **Pull changes** in Postman to see what changed.

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

You can also run the merge locally without pushing to GitHub:

```bash
# Run the merge
npm run merge

# See the changelog
cat CHANGELOG.md

# Dry-run publish (validates but doesn't push to Postman)
npm run publish:test

# Actually publish to Postman
npm run setup:publish   # First time: configure your target collection
npm run publish         # Push to Postman
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
