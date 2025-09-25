#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv))
  .option('before', { type: 'string', demandOption: true })
  .option('after',  { type: 'string', demandOption: true })
  .option('out',    { type: 'string', demandOption: true })
  .argv;

function flatten(coll, trail = [], rows = []) {
  (coll.item || []).forEach(it => {
    if (it.item) flatten(it, trail.concat([it.name]), rows);
    else rows.push({ name: it.name, path: trail.join(' / '), method: it.request?.method, url: it.request?.url?.raw || (it.request?.url ? (it.request.url.host||[]).join('') + '/' + (it.request.url.path||[]).join('/') : '') });
  });
  return rows;
}
const before = JSON.parse(fs.readFileSync(argv.before, 'utf8'));
const after  = JSON.parse(fs.readFileSync(argv.after,  'utf8'));
const b = flatten(before), a = flatten(after);
const key = x => `${(x.method||'').toUpperCase()} ${x.url}`.trim();
const bMap = new Map(b.map(x => [key(x), x]));
const aMap = new Map(a.map(x => [key(x), x]));
const added = [], removed = [];
for (const [k,v] of aMap) if (!bMap.has(k)) added.push(v);
for (const [k,v] of bMap) if (!aMap.has(k)) removed.push(v);
let md = `## Collection Changes\n\n`;
if (added.length) { md += `### Added\n`; for (const x of added) md += `- ${x.method} ${x.url} — **${x.name}** (${x.path})\n`; md += `\n`; }
if (removed.length) { md += `### Retired (not deleted)\n`; for (const x of removed) md += `- ${x.method} ${x.url} — **${x.name}** (${x.path})\n`; md += `\n`; }
if (!added.length && !removed.length) md += `No structural changes.\n`;
fs.writeFileSync(argv.out, md);
console.log(`Wrote ${argv.out}`);