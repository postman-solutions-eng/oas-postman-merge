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
      return (u.pathname||'').replace(/\/+/g,'/').replace(/\/$/, '');
    } catch {
      return `/${url.replace(/^\//,'')}`.replace(/\/+/g,'/').replace(/\/$/, '');
    }
  }
  if (url.raw) {
    const p = url.raw.replace(/^[a-z]+:\/\/[^/]+/i,'').split('?')[0];
    return (p || '').replace(/\/+/g,'/').replace(/\/$/, '');
  }
  const path = Array.isArray(url.path) ? url.path.join('/') : '';
  return (`/${path}`).replace(/\/+/g,'/').replace(/\/$/, '');
}

function collect(coll, { ignoreRetired=false } = {}) {
  const out = new Map();
  function walk(node, trail=[]) {
    for (const it of asArray(node.item)) {
      const nextTrail = trail.concat(it.name || '');
      const isRetiredFolder = ignoreRetired && nextTrail.some(x => x === '_retired');
      if (it.item) {
        // folder
        if (!isRetiredFolder) walk(it, nextTrail);
        else if (!ignoreRetired) walk(it, nextTrail);
      } else {
        if (isRetiredFolder && ignoreRetired) continue;
        const r = it.request || {};
        const k = `${(r.method||'GET').toUpperCase()} ${normPath(r.url)}`;
        out.set(k, { item: it, trail: nextTrail.slice(0, -1) });
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
  const name = it.name || path.split('/').slice(-1)[0] || '';
  return { method: (r.method||'GET').toUpperCase(), path, name, folder: entry.trail.join(' / ') };
}

function line(method, path, name, folder) {
  const f = folder ? ` (${folder})` : '';
  return `- ${method} {{baseUrl}}/${path} — **${name}**${f}`;
}

function main() {
  const before = JSON.parse(fs.readFileSync(argv.before, 'utf8'));
  const after  = JSON.parse(fs.readFileSync(argv.after,  'utf8'));

  const bAll = collect(before);                       // all requests before
  const aLive = collect(after, { ignoreRetired:true });// after, excluding anything under _retired

  const added = [];
  const retired = [];

  // Added = in aLive but not in bAll
  for (const [k, v] of aLive.entries()) {
    if (!bAll.has(k)) added.push(prettyName(v));
  }
  // Retired = in bAll but not in aLive
  for (const [k, v] of bAll.entries()) {
    if (!aLive.has(k)) retired.push(prettyName(v));
  }

  let md = '## Collection Changes\n\n';
  if (added.length) {
    md += '### Added\n';
    for (const {method, path, name, folder} of added) md += line(method, path, name, folder) + '\n';
    md += '\n';
  }
  if (retired.length) {
    md += '### Retired (not deleted)\n';
    for (const {method, path, name, folder} of retired) md += line(method, path, name, folder) + '\n';
    md += '\n';
  }
  if (!added.length && !retired.length) {
    md += 'No structural changes.\n';
  }

  fs.writeFileSync(argv.out, md);
  console.log(`Wrote ${argv.out}`);
}
main();