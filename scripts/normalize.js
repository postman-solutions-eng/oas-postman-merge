#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');

function walk(node) {
  if (!node) return;

  // Strip volatile IDs
  delete node.id;
  if (node.info) delete node.info._postman_id;

  // Remove empty description objects
  if (node.description && typeof node.description === 'object' && !node.description.content && !node.description.type) {
    delete node.description;
  }

  if (node.request) {
    const r = node.request;

    // Drop non-standard request.name (causes churn)
    if (r.name) delete r.name;

    // Normalize empty description objects
    if (r.description && typeof r.description === 'object' && !r.description.content && !r.description.type) {
      delete r.description;
    }

    // Sort headers & query params for stable diffs
    if (Array.isArray(r.header)) {
      r.header.sort((a,b)=>String(a.key||'').localeCompare(String(b.key||'')));
    }
    if (r.url && typeof r.url === 'object' && Array.isArray(r.url.query)) {
      r.url.query.sort((a,b)=>String(a.key||'').localeCompare(String(b.key||'')));
    }

    // Remove null/empty noise
    if (r.auth === null) delete r.auth;
    if (r.body && Object.keys(r.body).length === 0) delete r.body;
  }

  // Keep protocolProfileBehavior minimal (preserve only x-status tag we add)
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