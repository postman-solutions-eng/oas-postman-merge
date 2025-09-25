#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const argv = yargs(hideBin(process.argv))
  .option('before', { type: 'string', demandOption: true })
  .option('after',  { type: 'string', demandOption: true })
  .option('out',    { type: 'string', demandOption: true })
  .strict()
  .argv;

// flatten requests, with control over retired handling
function flatten(coll, { skipRetired=false, onlyRetired=false } = {}, trail = [], rows = []) {
  for (const it of (coll.item || [])) {
    if (it.item) {
      const isRetired = it.name === '_retired';
      if (onlyRetired && !isRetired) {
        flatten(it, { skipRetired, onlyRetired }, trail.concat([it.name]), rows);
        continue;
      }
      if (skipRetired && isRetired) continue;
      if (!onlyRetired) flatten(it, { skipRetired, onlyRetired }, trail.concat([it.name]), rows);
      if (onlyRetired && isRetired) flatten(it, { skipRetired, onlyRetired }, trail.concat([it.name]), rows);
    } else if (it.request) {
      const method = (it.request.method || '').toUpperCase();
      const url = (() => {
        const u = it.request.url || {};
        if (typeof u === 'string') return u;
        if (u.raw) return u.raw;
        const host = Array.isArray(u.host) ? u.host.join('') : (u.host || '');
        const path = Array.isArray(u.path) ? u.path.join('/') : (u.path || '');
        return `${host}/${path}`.replace(/\/+/g, '/');
      })();
      rows.push({ name: it.name, path: trail.join(' / '), method, url });
    }
  }
  return rows;
}
const key = x => `${x.method} ${x.url}`.trim().toUpperCase();

const before = JSON.parse(fs.readFileSync(argv.before, 'utf8'));
const after  = JSON.parse(fs.readFileSync(argv.after,  'utf8'));

const beforeRows  = flatten(before, { skipRetired: true });
const afterRows   = flatten(after,  { skipRetired: true });
const retiredRows = flatten(after,  { onlyRetired: true });

const bMap = new Map(beforeRows.map(x => [key(x), x]));
const aMap = new Map(afterRows.map(x => [key(x), x]));
const rMap = new Map(retiredRows.map(x => [key(x), x]));

const added = [];
const retired = [];

// Added = in AFTER (non-retired) but not in BEFORE
for (const [k, v] of aMap) if (!bMap.has(k)) added.push(v);

// Retired = in BEFORE but not in AFTER (non-retired) AND present under _retired in AFTER
for (const [k, v] of bMap) {
  if (!aMap.has(k) && rMap.has(k)) retired.push(v);
}

let md = `## Collection Changes\n\n`;
if (added.length) {
  md += `### Added\n`;
  for (const x of added) md += `- ${x.method} ${x.url} — **${x.name}** (${x.path})\n`;
  md += `\n`;
}
if (retired.length) {
  md += `### Retired (not deleted)\n`;
  for (const x of retired) md += `- ${x.method} ${x.url} — **${x.name}** (${x.path})\n`;
  md += `\n`;
}
if (!added.length && !retired.length) md += `No structural changes.\n`;

fs.writeFileSync(argv.out, md);
console.log(`Wrote ${argv.out}`);