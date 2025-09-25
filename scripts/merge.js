#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('config',  { type: 'string', demandOption: true })
  .option('working', { type: 'string', demandOption: true })
  .option('refdir',  { type: 'string', demandOption: true })
  .option('out',     { type: 'string', demandOption: true })
  .strict()
  .argv;

// --------- util
const deepClone = (o) => JSON.parse(JSON.stringify(o || null));
const asArray = (x) => Array.isArray(x) ? x : (x == null ? [] : [x]);

function readJSON(p) { return JSON.parse(fs.readFileSync(p,'utf8')); }
function writeJSON(p, j) { fs.writeFileSync(p, JSON.stringify(j, null, 2)); }

function loadConfig(p) {
  const txt = fs.readFileSync(p, 'utf8');
  const doc = yaml.load(txt);
  const defaults = {
    options: {
      preferOperationId: true,
      keepWorkingItemName: true,
      descriptionDelimiter: '\n---\n',
      tagNew: 'status:new',
      retireMode: 'move', // move | skip | delete
      order: 'keep'       // keep | alpha
    }
  };
  return { ...defaults, ...doc, options: { ...defaults.options, ...(doc.options || {}) } };
}

// Normalize a URL to "/path/with/:vars" string for matching
function getNormalizedPathFromUrl(urlLike) {
  if (!urlLike) return '';
  if (typeof urlLike === 'string') {
    try {
      // strip host if present
      const u = new URL(urlLike, 'http://dummy');
      return (u.pathname || '').replace(/\/+/g,'/').replace(/^\//,'');
    } catch {
      // treat it as /a/b form already
      return urlLike.replace(/^\//,'');
    }
  }
  const u = urlLike;
  if (u.raw) {
    const raw = u.raw;
    const withoutProto = raw.replace(/^[a-z]+:\/\/[^/]+/i, '');
    return withoutProto.replace(/^\//,'').split('?')[0];
  }
  const pathArr = Array.isArray(u.path) ? u.path : [];
  return pathArr.join('/').replace(/^\//,'');
}

// Build a stable key for request matching
function reqKey(item) {
  const r = item.request || {};
  const m = (r.method || 'GET').toUpperCase();
  const p = getNormalizedPathFromUrl(r.url);
  return `${m} ${p}`;
}

// Traverse collection tree
function walkItems(coll, fn, trail = []) {
  for (const it of asArray(coll.item)) {
    if (it.item) {
      walkItems(it, fn, trail.concat(it.name || ''));
    } else {
      fn(it, trail);
    }
  }
}

// Find or create a folder path under a parent item/collection
function ensureFolder(parent, segments) {
  let node = parent;
  for (const seg of segments) {
    if (!seg) continue;
    let next = (node.item || []).find(x => x.item && x.name === seg);
    if (!next) {
      next = { name: seg, item: [] };
      node.item = node.item || [];
      node.item.push(next);
    }
    node = next;
  }
  return node;
}

// Description helpers
let DELIM = '\n---\n';
let KEEP_NAME = true;

function getDescString(obj) {
  const d = obj && obj.description;
  if (!d) return '';
  if (typeof d === 'string') return d;
  if (typeof d === 'object' && typeof d.content === 'string') return d.content;
  return '';
}
function setDescString(targetReq, text, oldReqForType) {
  // Keep same type/shape as old if possible, else use {content,type}
  if (oldReqForType && oldReqForType.description && typeof oldReqForType.description === 'object') {
    targetReq.description = { content: text, type: 'text/plain' };
  } else {
    targetReq.description = text;
  }
}

function mergeDescriptionPreserveTop(oldReq, refReq) {
  const a = getDescString(oldReq) || '';
  const b = getDescString(refReq) || '';
  const [headsA] = a.split(DELIM);
  const [, tailB = ''] = b.split(DELIM);
  const head = headsA && headsA.trim().length ? headsA : '';
  const tail = tailB && tailB.trim().length ? tailB : (b && b.trim().length ? b : '');
  return head && tail ? `${head}${DELIM}${tail}` : (head || tail || '');
}

// Headers (preserve {{var}} values from old where keys match)
function mergeHeadersPreserveVars(newReq, oldReq) {
  const oldH = {};
  if (Array.isArray(oldReq.header)) {
    for (const h of oldReq.header) oldH[String(h.key || '').toLowerCase()] = h;
  }
  if (!Array.isArray(newReq.header)) return;
  newReq.header = newReq.header.map(h => {
    const key = String(h.key || '').toLowerCase();
    const old = oldH[key];
    if (!old) return h;
    const isVar = typeof (old.value || '') === 'string' && /\{\{.+\}\}/.test(old.value);
    if (isVar) return { ...h, value: old.value };
    return h;
  });
}

// URL merge: keep old shape, update path/query/vars
function mergeUrlPreserveShape(targetReq, refReq) {
  const oldUrl = targetReq.url;
  const newUrl = deepClone(refReq.url);

  if (!oldUrl) { targetReq.url = newUrl; return; }

  if (typeof oldUrl === 'string') {
    const want = getNormalizedPathFromUrl(newUrl);
    const have = getNormalizedPathFromUrl(oldUrl);
    if (want && have && want === have) {
      targetReq.url = oldUrl; // keep string
    } else {
      targetReq.url = newUrl?.raw || (`${(newUrl.host||[]).join('')}/${(newUrl.path||[]).join('/')}`.replace(/\/+/g,'/'));
    }
    return;
  }

  // object shape
  const o = deepClone(oldUrl);
  const n = newUrl || {};

  // path
  if (Array.isArray(o.path)) {
    if (Array.isArray(n.path)) o.path = n.path;
    else if (typeof n.raw === 'string') o.path = n.raw.split('?')[0].replace(/^[^/]*:\/\//,'').split('/').slice(1);
  } else if (typeof o.path === 'string') {
    if (Array.isArray(n.path)) o.path = n.path.join('/');
    else if (typeof n.raw === 'string') o.path = n.raw.split('?')[0].replace(/^[^/]*:\/\//,'').split('/').slice(1).join('/');
  }

  // host (only if ref has one)
  if (Array.isArray(n.host) && n.host.length) o.host = n.host;

  // variables & query
  if (Array.isArray(n.variable)) o.variable = n.variable;
  if (Array.isArray(n.query)) o.query = n.query.slice().sort((a,b)=>String(a.key).localeCompare(String(b.key)));

  // raw: keep if existed; otherwise omit to avoid churn
  if ('raw' in o && n.raw) o.raw = n.raw;

  targetReq.url = o;
}

// Structural updater (DO NOT clobber entire request)
function updateStructural(targetItem, refItem) {
  targetItem.request = targetItem.request || {};
  const oldReq = targetItem.request;
  const refReq = refItem.request || {};
  const nextReq = deepClone(refReq);

  // method
  targetItem.request.method = (refReq.method || oldReq.method || 'GET').toUpperCase();

  // description: preserve head, refresh tail
  const mergedDesc = mergeDescriptionPreserveTop(oldReq, refReq);
  setDescString(targetItem.request, mergedDesc, oldReq);

  // headers
  mergeHeadersPreserveVars(nextReq, oldReq);
  if (Array.isArray(nextReq.header)) {
    nextReq.header.sort((a,b)=>String(a.key||'').toLowerCase().localeCompare(String(b.key||'').toLowerCase()));
  }
  targetItem.request.header = nextReq.header ?? targetItem.request.header;

  // body: keep old raw with variables intact
  if (oldReq?.body?.mode === 'raw' && typeof oldReq.body.raw === 'string' && /\{\{.+\}\}/.test(oldReq.body.raw)) {
    targetItem.request.body = oldReq.body;
  } else {
    targetItem.request.body = nextReq.body ?? targetItem.request.body;
  }

  // never import request-level auth from ref; preserve item's own .auth
  if ('auth' in targetItem.request) {
    // keep as-is (collection-level or item-level)
  }

  // URL: merge with shape preservation
  mergeUrlPreserveShape(targetItem.request, nextReq);

  // name: keep working name unless config says otherwise
  if (!KEEP_NAME && refItem.name) targetItem.name = refItem.name;

  // we intentionally do NOT touch:
  // - item.event[]
  // - item.response[]
  // - item.variable[]
  // - item.auth (at item level)
}

function alphaOrderFolders(node) {
  if (!node || !Array.isArray(node.item)) return;
  node.item.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  for (const it of node.item) alphaOrderFolders(it);
}

// --------- main merge logic
function main() {
  const cfg = loadConfig(argv.config);
  DELIM = cfg.options.descriptionDelimiter || DELIM;
  KEEP_NAME = !!cfg.options.keepWorkingItemName;

  const working = readJSON(argv.working);

  // Build a map of existing requests by key
  const workMap = new Map();
  const workByKeyToRef = new Map(); // folder path → array of items at that path (for placement)
  walkItems(working, (it, trail) => {
    workMap.set(reqKey(it), it);
    const key = trail.join(' / ');
    if (!workByKeyToRef.has(key)) workByKeyToRef.set(key, []);
    workByKeyToRef.get(key).push(it);
  });

  let updated = 0, added = 0, retired = 0;

  for (const svc of (cfg.services || [])) {
    // load the reference collection produced by openapi2postmanv2
    const specFile = path.basename(svc.spec, path.extname(svc.spec));
    const refPath = path.join(argv.refdir, `${specFile}.postman_collection.json`);
    if (!fs.existsSync(refPath)) {
      console.error(`Reference not found for ${svc.name}: ${refPath}`);
      continue;
    }
    const ref = readJSON(refPath);

    // find subtree in working where to apply changes
    const targetParent = ensureFolder(working, asArray(svc.workingFolder || []));

    // iterate ref requests
    const seenKeys = new Set();
    walkItems(ref, (rit, rtrail) => {
      const k = reqKey(rit);
      if (!k.trim()) return;
      seenKeys.add(k);
      const existing = workMap.get(k);
      if (existing) {
        updateStructural(existing, rit);
        updated++;
      } else {
        // add new request under an equivalent folder path if possible
        const parent = ensureFolder(targetParent, rtrail);
        const clone = deepClone(rit);
        // tag new if requested
        if (cfg.options.tagNew) {
          clone.protocolProfileBehavior = clone.protocolProfileBehavior || {};
          clone.protocolProfileBehavior['x-status'] = cfg.options.tagNew;
        }
        parent.item = parent.item || [];
        parent.item.push(clone);
        // update workMap so later steps see it
        workMap.set(k, clone);
        added++;
      }
    });

    // retire requests that are in working but not in ref
    if (cfg.options.retireMode !== 'skip') {
      const retiredFolder = ensureFolder(targetParent, ['_retired']);
      // collect candidates only under this service subtree
      function retireWalk(node) {
        for (const it of asArray(node.item)) {
          if (it.item) {
            if (it.name !== '_retired') retireWalk(it);
          } else {
            const k = reqKey(it);
            if (k && !seenKeys.has(k)) {
              // move or delete
              if (cfg.options.retireMode === 'delete') {
                // remove by marking and filtering later
                it.__DELETE_ME__ = true;
              } else {
                // move to _retired if not already there
                if (node !== retiredFolder) {
                  retiredFolder.item = retiredFolder.item || [];
                  retiredFolder.item.push(it);
                  it.__MOVED__ = true;
                }
              }
              retired++;
            }
          }
        }
        // filter deletes
        node.item = asArray(node.item).filter(x => !x.__DELETE_ME__);
      }
      retireWalk(targetParent);
    }
  }

  if (cfg.options.order === 'alpha') alphaOrderFolders(working);

  writeJSON(argv.out, working);
  console.log(`Merged → ${argv.out}`);
  console.log(`Updated: ${updated}  •  Added: ${added}  •  Retired: ${retired}`);
}

main();