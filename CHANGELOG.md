# Semantic Collection Changes

## 🔄 API Evolution

No structural API changes detected.

## ✅ Preserved Curated Content
- **Test Scripts**: 2 → 2 (✅ Preserved)
  - Locations: Collection: Demo API > test script (1 tests), sites > {siteId} > Folder: custom-views > test script (1 tests)
- **Auth Configs**: 2 → 2 (✅ Preserved)
  - Locations: Collection: Demo API > Auth: apikey, Folder: sites > Auth: bearer
- **Custom Headers**: 2 preserved
  - Found: sites > {siteId} > custom-views > Request: list Custom Views > Header: X-Demo-Version, _retired > Request: delete Legacy Token > Header: X-Audit-User
- **Custom Descriptions**: 4 with delimiters preserved
  - Locations: Collection: Demo API, Folder: sites, sites > {siteId} > Folder: custom-views, sites > {siteId} > Folder: legacyTokens

## 📊 Change Impact
- **Semantic changes**: 0 meaningful API modifications
- **Format changes**: Ignored (XML↔JSON, whitespace, etc.)
- **Curation impact**: Zero (10 items protected)
