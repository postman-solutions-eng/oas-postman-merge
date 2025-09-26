#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const yargs = require('yargs');
// const { hideBin } = require('yargs/helpers');

const argv = yargs(process.argv.slice(2))
  .option('config',  { type: 'string', demandOption: true })
  .option('working', { type: 'string', demandOption: true })
  .option('refdir',  { type: 'string', demandOption: true })
  .option('out',     { type: 'string', demandOption: true })
  .strict()
  .argv;

// ---------- utils
const deepClone = (o) => JSON.parse(JSON.stringify(o || null));
const asArray = (x) => Array.isArray(x) ? x : (x == null ? [] : [x]);

function readJSON(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function writeJSON(p, j) { fs.writeFileSync(p, JSON.stringify(j, null, 4)); }

function loadConfig(p) {
  const txt = fs.readFileSync(p, 'utf8');
  const doc = yaml.load(txt) || {};
  const defaults = {
    services: [],
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

// Normalize a URL to "path/with/:vars" (no leading slash)
function getNormalizedPathFromUrl(urlLike) {
  if (!urlLike) return '';
  if (typeof urlLike === 'string') {
    try {
      const u = new URL(urlLike, 'http://dummy');
      return (u.pathname || '').replace(/^\//, '');
    } catch {
      return urlLike.replace(/^\//, '');
    }
  }
  const u = urlLike;
  if (u.raw) {
    const raw = u.raw.replace(/^[a-z]+:\/\/[^/]+/i, '');
    return raw.replace(/^\//, '').split('?')[0];
  }
  const pathArr = Array.isArray(u.path) ? u.path : [];
  return pathArr.join('/').replace(/^\//, '');
}

// Build a stable key for request matching
function reqKey(item) {
  const r = item.request || {};
  const m = (r.method || 'GET').toUpperCase();
  const p = getNormalizedPathFromUrl(r.url);
  return `${m} ${p}`;
}

// Walk collection items
function walkItems(node, fn, trail = []) {
  for (const it of asArray(node.item)) {
    if (it && it.item) walkItems(it, fn, trail.concat(it.name || ''));
    else if (it) fn(it, trail);
  }
}

// Ensure (or create) a folder path
function ensureFolder(parent, segments) {
  let node = parent;
  node.item = node.item || [];
  for (const seg of segments || []) {
    if (!seg) continue;
    let next = node.item.find(x => x.item && x.name === seg);
    if (!next) {
      next = { name: seg, item: [] };
      node.item.push(next);
    }
    node = next;
  }
  return node;
}

// ----- description handling
let DELIM = '\n---\n';
let KEEP_NAME = true;

function getDescString(obj) {
  const d = obj && obj.description;
  if (!d) return '';
  if (typeof d === 'string') return d;
  if (typeof d === 'object' && typeof d.content === 'string') return d.content;
  return '';
}

function setDescString(targetReq, text, oldReq) {
  // Keep shape: if old had {content,type}, keep that; otherwise plain string
  if (oldReq && typeof oldReq.description === 'object') {
    targetReq.description = { content: text, type: 'text/plain' };
  } else {
    targetReq.description = text;
  }
}

function mergeDescriptionPreserveTop(oldReq, refReq) {
  const a = getDescString(oldReq) || '';
  const b = getDescString(refReq) || '';
  const [headA] = a.split(DELIM);
  const [, tailB = ''] = b.split(DELIM);
  const head = headA && headA.trim() ? headA : '';
  const tail = tailB && tailB.trim() ? tailB : (b && b.trim() ? b : '');
  return head && tail ? `${head}${DELIM}${tail}` : (head || tail || '');
}

// Headers: preserve {{var}} values from old where keys match
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
    const isVar = typeof old.value === 'string' && /\{\{.+\}\}/.test(old.value);
    return isVar ? { ...h, value: old.value } : h;
  });
}

// URL: preserve old shape, update path/query/vars
function mergeUrlPreserveShape(targetReq, refReq) {
  const oldUrl = targetReq.url;
  const newUrl = deepClone(refReq.url);

  if (!oldUrl) { targetReq.url = newUrl; return; }

  if (typeof oldUrl === 'string') {
    const want = getNormalizedPathFromUrl(newUrl);
    const have = getNormalizedPathFromUrl(oldUrl);
    targetReq.url = (want && have && want === have)
      ? oldUrl
      : (newUrl?.raw || (`${(newUrl.host||[]).join('')}/${(newUrl.path||[]).join('/')}`.replace(/\/+/g,'/')));
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

  // host
  if (Array.isArray(n.host) && n.host.length) o.host = n.host;

  // variables & query
  if (Array.isArray(n.variable)) o.variable = n.variable;
  if (Array.isArray(n.query)) o.query = n.query.slice().sort((a,b)=>String(a.key).localeCompare(String(b.key)));

  // raw: keep if existed; else omit to avoid churn
  if ('raw' in o && n.raw) o.raw = n.raw;

  targetReq.url = o;
}

// Structural update without clobbering request
function updateStructural(targetItem, refItem) {
  targetItem.request = targetItem.request || {};
  const oldReq = targetItem.request;
  const refReq = refItem.request || {};
  const nextReq = deepClone(refReq);

  // method
  targetItem.request.method = (refReq.method || oldReq.method || 'GET').toUpperCase();

  // description
  const mergedDesc = mergeDescriptionPreserveTop(oldReq, refReq);
  setDescString(targetItem.request, mergedDesc, oldReq);

  // headers
  mergeHeadersPreserveVars(nextReq, oldReq);
  if (Array.isArray(nextReq.header)) {
    nextReq.header.sort((a,b)=>String(a.key||'').toLowerCase().localeCompare(String(b.key||'').toLowerCase()));
  }
  targetItem.request.header = nextReq.header ?? targetItem.request.header;

  // body
  if (oldReq?.body?.mode === 'raw' && typeof oldReq.body.raw === 'string' && /\{\{.+\}\}/.test(oldReq.body.raw)) {
    targetItem.request.body = oldReq.body;
  } else {
    targetItem.request.body = nextReq.body ?? targetItem.request.body;
  }

  // request-level auth: do not import from ref; keep item/collection auth as-is

  // URL
  mergeUrlPreserveShape(targetItem.request, nextReq);

  // name
  if (!KEEP_NAME && refItem.name) targetItem.name = refItem.name;
}

function alphaOrderFolders(node) {
  if (!node || !Array.isArray(node.item)) return;
  node.item.sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
  for (const it of node.item) alphaOrderFolders(it);
}

// ------------- main
function main() {
  const cfg = loadConfig(argv.config);
  DELIM = cfg.options.descriptionDelimiter || DELIM;
  KEEP_NAME = !!cfg.options.keepWorkingItemName;

  const working = readJSON(argv.working);

  // map existing requests
  const workMap = new Map();
  walkItems(working, (it) => workMap.set(reqKey(it), it));

  let updated = 0, added = 0, retired = 0;

  for (const svc of (cfg.services || [])) {
    const specBase = path.basename(svc.spec, path.extname(svc.spec));
    const refPath = path.join(argv.refdir, `${specBase}.postman_collection.json`);
    if (!fs.existsSync(refPath)) { console.error(`Missing ref: ${refPath}`); continue; }
    const ref = readJSON(refPath);

    const targetRoot = ensureFolder(working, asArray(svc.workingFolder || []));
    const seen = new Set();

    // add/update
    walkItems(ref, (rit, rtrail) => {
      const k = reqKey(rit);
      if (!k.trim()) return;
      seen.add(k);
      const existing = workMap.get(k);
      if (existing) {
        updateStructural(existing, rit);
        updated++;
      } else {
        const parent = ensureFolder(targetRoot, rtrail);
        const clone = deepClone(rit);
        if (cfg.options.tagNew) {
          clone.protocolProfileBehavior = clone.protocolProfileBehavior || {};
          clone.protocolProfileBehavior['x-status'] = cfg.options.tagNew;
        }
        parent.item = parent.item || [];
        parent.item.push(clone);
        workMap.set(k, clone);
        added++;
      }
    });

    // retire
    if (cfg.options.retireMode !== 'skip') {
      const retiredFolder = ensureFolder(targetRoot, ['_retired']);
      function sweep(node) {
        node.item = asArray(node.item).reduce((acc, it) => {
          if (it.item) {
            if (it.name !== '_retired') sweep(it);
            acc.push(it);
          } else {
            const k = reqKey(it);
            if (k && !seen.has(k)) {
              if (cfg.options.retireMode === 'delete') {
                retired++;
              } else {
                if (node !== retiredFolder) {
                  retiredFolder.item = retiredFolder.item || [];
                  retiredFolder.item.push(it);
                }
                retired++;
              }
            } else {
              acc.push(it);
            }
          }
          return acc;
        }, []);
      }
      sweep(targetRoot);
    }
  }

  if (cfg.options.order === 'alpha') alphaOrderFolders(working);

  writeJSON(argv.out, working);
  console.log(`Merged → ${argv.out}`);
  console.log(`Updated: ${updated}  •  Added: ${added}  •  Retired: ${retired}`);
}

main();