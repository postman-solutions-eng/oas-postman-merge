# Semantic Collection Changes

## 🔄 API Evolution

### ➕ **Added Endpoints**
- `POST /sites/{siteId}/custom-views/{customViewId}/share` - share Custom View

### 🔄 **Modified Endpoints**
- `GET /sites/{siteId}/custom-views` - added query params: includeSubsites

## ✅ Preserved Curated Content
- **Test Scripts**: 2 → 2 (✅ Preserved)
- **Auth Configs**: 2 → 4 (❌ Changed)
- **Custom Headers**: 23 preserved
- **Custom Descriptions**: 4 with delimiters preserved

## 📊 Change Impact
- **Semantic changes**: 2 meaningful API modifications
- **Format changes**: Ignored (XML↔JSON, whitespace, etc.)
- **Curation impact**: Zero (29 items protected)
