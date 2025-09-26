#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');

function descToString(d) {
  if (!d) return undefined;
  if (typeof d === 'string') return d;
  if (typeof d === 'object') {
    if (typeof d.content === 'string') return d.content;
    if (typeof d.raw === 'string') return d.raw;
  }
  return undefined;
}

// Deep walk: for every object we see, if it has a "description" field, collapse it.
// Also strip common noisy keys and sort stable arrays.
function normalizeAny(node, parentKey = '') {
  if (!node || typeof node !== 'object') return;

  // Collapse any .description we encounter (works for info, request, responses, params, etc.)
  if ('description' in node) {
    const s = descToString(node.description);
    if (s !== undefined) {
      if (s.length) node.description = s;
      else delete node.description;
    }
  }

  // Strip volatile IDs on known shapes
  if ('id' in node && (parentKey === 'item' || parentKey === 'response' || parentKey === 'event')) {
    delete node.id;
  }
  if (node.info && node.info._postman_id) delete node.info._postman_id;

  // Request-specific cleanup
  if (node.request) {
    const r = node.request;
    if (r.name) delete r.name;
    if (Array.isArray(r.header)) r.header.sort((a,b)=>String(a.key||'').localeCompare(String(b.key||'')));
    if (r.url && typeof r.url === 'object' && Array.isArray(r.url.query))
      r.url.query.sort((a,b)=>String(a.key||'').localeCompare(String(b.key||'')));
    if (r.auth === null) delete r.auth;
    if (r.body && Object.keys(r.body).length === 0) delete r.body;
    if (r.url && typeof r.url === 'object' && 'raw' in r.url &&
        (Array.isArray(r.url.path) || Array.isArray(r.url.host))) {
      delete r.url.raw;
    }
  }

  // Keep protocolProfileBehavior minimal (preserve only x-status)
  if (node.protocolProfileBehavior) {
    const keep = {};
    for (const [k,v] of Object.entries(node.protocolProfileBehavior)) {
      if (k === 'x-status') keep[k] = v;
    }
    if (Object.keys(keep).length) node.protocolProfileBehavior = keep;
    else delete node.protocolProfileBehavior;
  }

  // Recurse into arrays/objects
  if (Array.isArray(node)) {
    node.forEach((v) => normalizeAny(v, parentKey));
  } else {
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === 'object') normalizeAny(v, k);
    }
  }
}

const file = process.argv[2];
if (!file) {
  console.error('usage: normalize.js <collection.json>');
  process.exit(1);
}
const coll = JSON.parse(fs.readFileSync(file, 'utf8'));
normalizeAny(coll, '');
fs.writeFileSync(file, JSON.stringify(coll, null, 4));
console.log(`Normalized ${file}`);