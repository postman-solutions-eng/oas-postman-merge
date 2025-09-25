#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Postman Collection merge (Reference → Working), JSON-only (no SDK clone())
 *
 * What it does (per service in config):
 * - Builds a key map from the Reference (generated from OAS) and from the Working folder.
 * - Updates structural request fields (method, url, headers, body, spec text BELOW delimiter).
 * - Preserves human work:
 *   - item.auth (request-level), folder/collection auth
 *   - item.event[] (pre-request/tests)
 *   - item.name (configurable)
 *   - notes/doc links ABOVE a delimiter (default "\n---\n") in description
 *   - responses/examples (we never touch `response` array)
 * - Adds new endpoints (tags them as status:new) under the service folder.
 * - Moves removed endpoints into a `_retired` folder (idempotent).
 *
 * Input:
 *   --config  path to YAML config
 *   --working path to Working collection JSON
 *   --refdir  directory containing Reference collection JSONs (one per spec)
 *   --out     path to write merged Working collection JSON
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// --- robust yargs (CJS)
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv))
  .option('config',  { type: 'string', demandOption: true })
  .option('working', { type: 'string', demandOption: true })
  .option('refdir',  { type: 'string', demandOption: true })
  .option('out',     { type: 'string', demandOption: true })
  .strict()
  .argv;

// --------- utils
const cfg = yaml.load(fs.readFileSync(argv.config, 'utf8'));
const DELIM = cfg.options?.descriptionDelimiter || '\n---\n';
const KEEP_NAME = !!cfg.options?.keepWorkingItemName;
const TAG_NEW = cfg.options?.tagNew || 'status:new';
const RETIRE_MODE = cfg.options?.retireMode || 'move';
const ORDER = cfg.options?.order || 'keep';
const PREFER_OPID = !!cfg.options?.preferOperationId;

// safe JSON read/write
function readJSON(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJSON(file, obj) {
  fs.writeFileSync(file, JSON.stringify(obj, null, 2));
}
function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

// ensure arrays
function ensureArray(obj, key) {
  if (!obj[key]) obj[key] = [];
  else if (!Array.isArray(obj[key])) obj[key] = [obj[key]];
  return obj[key];
}

// find or create a folder by path of names
function findOrCreateFolder(root, names) {
  let node = root;
  for (const seg of names) {
    ensureArray(node, 'item');
    let next = node.item.find(x => x && x.item && x.name === seg);
    if (!next) {
      next = { name: seg, item: [] };
      node.item.push(next);
    }
    node = next;
  }
  return node;
}

// flatten requests under a node; skip `_retired` unless includeRetired=true
function flattenRequests(root, includeRetired = false) {
  const acc = [];
  function walk(node, parent=null, parentIdx=-1, pathTrail=[]) {
    const items = Array.isArray(node?.item) ? node.item : [];
    for (let i=0; i<items.length; i++) {
      const it = items[i];
      if (it && it.item) {
        if (!includeRetired && it.name === '_retired') continue;
        walk(it, node, i, pathTrail.concat([it.name]));
      } else if (it && it.request) {
        acc.push({ item: it, parent: node, index: i, pathTrail });
      }
    }
  }
  walk(root);
  return acc;
}

// get description as string (supports string or {content,type})
function getDescString(desc) {
  if (!desc) return '';
  if (typeof desc === 'string') return desc;
  if (typeof desc === 'object' && typeof desc.content === 'string') return desc.content;
  return '';
}
function setDescString(targetReq, newText, preferObjectFrom) {
  // set description respecting original format
  const orig = preferObjectFrom?.description ?? targetReq?.description;
  if (orig && typeof orig === 'object' && 'content' in orig) {
    targetReq.description = { content: newText, type: orig.type || 'text/plain' };
  } else {
    targetReq.description = newText;
  }
}
function mergeDescriptionPreserveTop(oldReq, refReq) {
  const oldText = getDescString(oldReq?.description);
  const refText = getDescString(refReq?.description);
  const idx = oldText.indexOf(DELIM);
  const top = idx >= 0 ? oldText.slice(0, idx) : oldText; // human notes
  const merged = (top || '').replace(/\s+$/, '') + (DELIM + (refText || ''));
  return merged;
}

// normalize path key like "/sites/:siteId/custom-views"
function getNormalizedPathFromUrl(url) {
  if (!url) return '';
  if (typeof url === 'string') {
    // try to strip protocol/host/query
    const raw = url.split('://').pop();
    const p = raw.split('?')[0];
    const slashIdx = p.indexOf('/');
    return slashIdx >= 0 ? p.slice(slashIdx) : '/' + p;
  }
  if (Array.isArray(url.path)) {
    return '/' + url.path.join('/').replace(/\/+/g, '/').replace(/\/$/, '');
  }
  if (typeof url.raw === 'string') {
    return getNormalizedPathFromUrl(url.raw);
  }
  return '';
}

// extract best-available identity key
function getItemKey(it) {
  const method = (it.request?.method || '').toUpperCase();
  let opId = null;

  if (PREFER_OPID) {
    // try to infer from description text "operationId: xyz"
    const desc = getDescString(it.request?.description);
    const m = desc.match(/operationId:\s*([A-Za-z0-9_.-]+)/);
    opId = m ? m[1] : null;
  }

  if (PREFER_OPID && opId) {
    return `opId:${opId}`;
  }
  const normPath = getNormalizedPathFromUrl(it.request?.url);
  return `mp:${method} ${normPath}`;
}

// build map key -> { item, parent, index }
function buildMap(root, includeRetired=false) {
  const entries = flattenRequests(root, includeRetired);
  const map = new Map();
  for (const e of entries) {
    const key = getItemKey(e.item);
    if (!key) continue;
    // last one wins; keys should be unique per collection
    map.set(key, e);
  }
  return map;
}

// merge headers; keep variableized values from old ({{var}}) if same key exists
function mergeHeadersPreserveVars(newReq, oldReq) {
  const oldHeaders = Array.isArray(oldReq?.header) ? oldReq.header : [];
  const newHeaders = Array.isArray(newReq?.header) ? newReq.header : [];

  const oldMap = new Map(oldHeaders.map(h => [String(h.key || '').toLowerCase(), h]));
  for (const h of newHeaders) {
    const k = String(h.key || '').toLowerCase();
    const old = oldMap.get(k);
    if (old && typeof old.value === 'string' && /\{\{.+\}\}/.test(old.value)) {
      h.value = old.value; // keep variableized value
    }
  }
}

// update structural request fields from ref → target, preserving human work
function updateStructural(targetItem, refItem) {
  const oldReq = targetItem.request || {};
  const refReq = refItem.request || {};
  const newReq = deepClone(refReq);

  // description: keep human notes above DELIM, refresh spec text below
  const mergedDesc = mergeDescriptionPreserveTop(oldReq, refReq);
  setDescString(newReq, mergedDesc, oldReq);

  // headers: keep {{var}} values from old where keys match
  mergeHeadersPreserveVars(newReq, oldReq);

  // body: if old used variables in raw body, keep it
  if (oldReq?.body?.mode === 'raw' && typeof oldReq.body.raw === 'string' && /\{\{.+\}\}/.test(oldReq.body.raw)) {
    newReq.body = oldReq.body;
  }

  // never carry over request-level auth from ref (we preserve item-level auth separately)
  if (newReq.auth !== undefined) delete newReq.auth;

  // apply
  targetItem.request = newReq;

  // preserve sacred fields at the item level
  if (KEEP_NAME && targetItem.name) {
    // keep existing name; else adopt ref name
  } else if (refItem.name) {
    targetItem.name = refItem.name;
  }
  // preserve item-level auth, events, variables, and responses (we don't touch them)
  // nothing to do: we never reassigned those properties
}

// add a brand-new item (deep clone), annotate as new
function addNewItem(destFolder, refItem) {
  ensureArray(destFolder, 'item');
  const clone = deepClone(refItem);
  clone.protocolProfileBehavior = Object.assign({}, clone.protocolProfileBehavior, { 'x-status': TAG_NEW });
  destFolder.item.push(clone);
}

// move an item to `_retired` under destFolder (idempotent)
function retireItem(destFolder, e) {
  const retired = findOrCreateFolder(destFolder, ['_retired']);
  // remove from current parent (if still present there)
  if (e.parent && Array.isArray(e.parent.item)) {
    const existing = e.parent.item[e.index];
    if (existing === e.item) {
      e.parent.item.splice(e.index, 1);
    }
  }
  // don't duplicate in retired
  ensureArray(retired, 'item');
  if (!retired.item.includes(e.item)) {
    retired.item.push(e.item);
  }
}

// sort items in a folder alphabetically by name (optional)
function sortFolderAlpha(folder) {
  if (!Array.isArray(folder.item)) return;
  folder.item.sort((a, b) => (a?.name || '').localeCompare(b?.name || ''));
  for (const it of folder.item) {
    if (it && it.item) sortFolderAlpha(it);
  }
}

// ------------- main
(function main() {
  const working = readJSON(argv.working);
  ensureArray(working, 'item');

  let totalAdded = 0, totalUpdated = 0, totalRetired = 0;

  for (const svc of (cfg.services || [])) {
    const specBase = path.basename(svc.spec, path.extname(svc.spec));
    const refFile = path.join(argv.refdir, `${specBase}.postman_collection.json`);
    if (!fs.existsSync(refFile)) {
      console.warn(`[warn] Reference file not found for service "${svc.name}": ${refFile}`);
      continue;
    }

    const ref = readJSON(refFile);
    ensureArray(ref, 'item');

    // destination working folder for this service
    const dest = findOrCreateFolder(working, svc.workingFolder || []);
    ensureArray(dest, 'item');

    // build maps
    const wkMap = buildMap(dest /* working subtree */, /* includeRetired */ false);
    const refMap = buildMap(ref, /* includeRetired */ true);

    // updates & adds
    for (const [key, refEntry] of refMap.entries()) {
      const wkEntry = wkMap.get(key);
      if (wkEntry) {
        updateStructural(wkEntry.item, refEntry.item);
        totalUpdated++;
      } else {
        addNewItem(dest, refEntry.item);
        totalAdded++;
      }
    }

    // retire removed
    for (const [key, wkEntry] of wkMap.entries()) {
      if (!refMap.has(key)) {
        if (RETIRE_MODE === 'tag') {
          wkEntry.item.protocolProfileBehavior = Object.assign({}, wkEntry.item.protocolProfileBehavior, { 'x-status': 'status:deprecated' });
        } else {
          retireItem(dest, wkEntry);
        }
        totalRetired++;
      }
    }

    // optional ordering
    if (ORDER === 'alpha') sortFolderAlpha(dest);
  }

  writeJSON(argv.out, working);
  console.log(`Merged → ${argv.out}`);
  console.log(`Updated: ${totalUpdated}  •  Added: ${totalAdded}  •  Retired: ${totalRetired}`);
})();