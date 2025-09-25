#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('before', { type: 'string', demandOption: true })
  .option('after',  { type: 'string', demandOption: true })
  .option('out',    { type: 'string', demandOption: true })
  .strict().argv;

function asArray(x){return Array.isArray(x)?x:(x==null?[]:[x]);}

function normPath(url) {
  if (!url) return '';
  if (typeof url === 'string') {
    try {
      const u = new URL(url, 'http://dummy');
      return (u.pathname||'').replace(/\/+/g,'/').replace(/\/$/,'');
    } catch {
      return `/${url.replace(/^\//,'')}`.replace(/\/+/g,'/');
    }
  }
  const raw = url.raw;
  if (raw) {
    const p = raw.replace(/^[a-z]+:\/\/[^/]+/i,'').split('?')[0];
    return (p || '').replace(/\/+/g,'/').replace(/\/$/,'');
  }
  const host = Array.isArray(url.host) ? url.host.join('') : '';
  const path = Array.isArray(url.path) ? url.path.join('/') : '';
  const p = `${host ? '' : ''}/${path}`; // keep only path
  return p.replace(/\/+/g,'/').replace(/\/$/,'');
}

function collect(coll) {
  const out = new Map();
  function walk(node, trail=[]) {
    for (const it of asArray(node.item)) {
      if (it.item) walk(it, trail.concat(it.name||''));
      else {
        const r = it.request || {};
        const k = `${(r.method||'GET').toUpperCase()} ${normPath(r.url)}`;
        out.set(k, {item: it, trail});
      }
    }
  }
  walk(coll);
  return out;
}

function prettyName(entry) {
  const it = entry.item;
  const r = it.request || {};
  const path = normPath(r.url).replace(/^\//,'');
  const name = it.name || (r && r.url && r.url?.path?.slice?.(-1)?.[0]) || path.split('/').slice(-1)[0] || '';
  return { method: (r.method||'GET').toUpperCase(), path, name, folder: entry.trail.join(' / ') };
}

function lineAdded(pn) {
  return `- ${pn.method} {{baseUrl}}/${pn.path.replace(/^\//,'')} — **${pn.name}** (${pn.folder || ''})`;
}

function lineRetired(pn) {
  return `- ${pn.method} {{baseUrl}}/${pn.path.replace(/^\//,'')} — **${pn.name}** (${pn.folder || ''})`;
}

function main() {
  const before = JSON.parse(fs.readFileSync(argv.before, 'utf8'));
  const after  = JSON.parse(fs.readFileSync(argv.after,  'utf8'));

  const b = collect(before);
  const a = collect(after);

  const added = [];
  const retired = [];

  for (const [k, v] of a.entries()) {
    if (!b.has(k)) added.push(prettyName(v));
  }
  for (const [k, v] of b.entries()) {
    if (!a.has(k)) retired.push(prettyName(v));
  }

  let md = '## Collection Changes\n\n';
  if (added.length) {
    md += '### Added\n';
    for (const pn of added) md += lineAdded(pn) + '\n';
    md += '\n';
  }
  if (retired.length) {
    md += '### Retired (not deleted)\n';
    for (const pn of retired) md += lineRetired(pn) + '\n';
    md += '\n';
  }
  if (!added.length && !retired.length) {
    md += 'No structural changes.\n';
  }

  fs.writeFileSync(argv.out, md);
  console.log(`Wrote ${argv.out}`);
}

main();