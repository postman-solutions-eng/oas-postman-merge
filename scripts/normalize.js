#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');

function descToString(d) {
  if (!d) return undefined;
  if (typeof d === 'string') return d;
  if (typeof d === 'object') {
    if (typeof d.content === 'string') return d.content; // collapse {content,type} → "content"
    if (typeof d.raw === 'string') return d.raw;
  }
  return undefined;
}

function walk(node) {
  if (!node) return;

  // Strip volatile IDs
  delete node.id;
  if (node.info) delete node.info._postman_id;

  // Canonicalize description on any node
  const nd = descToString(node.description);
  if (nd !== undefined) {
    if (nd.length) node.description = nd;
    else delete node.description;
  }

  if (node.request) {
    const r = node.request;

    // Drop non-standard request.name
    if (r.name) delete r.name;

    // Canonicalize request.description to a string
    const rd = descToString(r.description);
    if (rd !== undefined) {
      if (rd.length) r.description = rd;
      else delete r.description;
    }

    // Sort headers & query for stable diffs
    if (Array.isArray(r.header)) r.header.sort((a,b)=>String(a.key||'').localeCompare(String(b.key||'')));
    if (r.url && typeof r.url === 'object' && Array.isArray(r.url.query))
      r.url.query.sort((a,b)=>String(a.key||'').localeCompare(String(b.key||'')));

    // Remove null/empty noise
    if (r.auth === null) delete r.auth;
    if (r.body && Object.keys(r.body).length === 0) delete r.body;

    // Prefer host/path representation; drop raw if redundant
    if (r.url && typeof r.url === 'object' && 'raw' in r.url && (Array.isArray(r.url.path) || Array.isArray(r.url.host))) {
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

  // Recurse
  if (Array.isArray(node.item)) node.item.forEach(walk);
  if (Array.isArray(node.response)) node.response.forEach(r => { delete r.id; });
}

const file = process.argv[2];
if (!file) {
  console.error('usage: normalize.js <collection.json>');
  process.exit(1);
}
const coll = JSON.parse(fs.readFileSync(file, 'utf8'));
walk(coll);
fs.writeFileSync(file, JSON.stringify(coll, null, 2));
console.log(`Normalized ${file}`);