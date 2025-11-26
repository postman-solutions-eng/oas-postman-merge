#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const yargs = require('yargs');
// const { hideBin } = require('yargs/helpers');

const argv = yargs(process.argv.slice(2))
  .option('config',  { 
    type: 'string', 
    demandOption: true,
    describe: 'Path to merge configuration YAML file'
  })
  .option('working', { 
    type: 'string', 
    demandOption: true,
    describe: 'Path to working Postman collection JSON file'
  })
  .option('refdir',  { 
    type: 'string', 
    demandOption: true,
    describe: 'Directory containing reference collections'
  })
  .option('out',     { 
    type: 'string', 
    demandOption: true,
    describe: 'Output path for merged collection'
  })
  .strict()
  .help()
  .version()
  .argv;

// ---------- utils
const deepClone = (o) => JSON.parse(JSON.stringify(o || null));
const asArray = (x) => Array.isArray(x) ? x : (x == null ? [] : [x]);

// Enhanced logging
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

// Security: Validate file paths to prevent path traversal
function validatePath(filePath, description) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error(`Invalid ${description}: path must be a non-empty string`);
  }
  
  // Check for path traversal attempts
  if (filePath.includes('..') || filePath.includes('\0')) {
    throw new Error(`Invalid ${description}: path contains potentially dangerous characters`);
  }
  
  // Resolve to absolute path to prevent confusion
  return path.resolve(filePath);
}

// Validate collection structure
function validateCollection(collection, filePath) {
  if (!collection || typeof collection !== 'object') {
    throw new Error(`Invalid collection in ${filePath}: must be a JSON object`);
  }
  
  if (!collection.info || typeof collection.info.name !== 'string') {
    throw new Error(`Invalid collection in ${filePath}: missing or invalid info.name`);
  }
  
  // Warn about large collections (potential performance issue)
  const collectionStr = JSON.stringify(collection);
  const sizeMB = Buffer.byteLength(collectionStr, 'utf8') / (1024 * 1024);
  if (sizeMB > 50) {
    log(`Warning: Large collection detected (${sizeMB.toFixed(1)}MB). Performance may be affected.`, 'warn');
  }
}

function readJSON(filePath) {
  try {
    const safePath = validatePath(filePath, 'JSON file path');
    
    if (!fs.existsSync(safePath)) {
      throw new Error(`File not found: ${safePath}`);
    }
    
    const content = fs.readFileSync(safePath, 'utf8');
    const data = JSON.parse(content);
    
    // Validate if it looks like a Postman collection
    // Check for collection-like files more precisely
    const fileName = path.basename(filePath).toLowerCase();
    if (fileName.endsWith('.postman_collection.json') || fileName === 'working.json') {
      validateCollection(data, safePath);
    }
    
    return data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in file ${filePath}: ${error.message}`);
    }
    throw new Error(`Failed to read JSON file ${filePath}: ${error.message}`);
  }
}

function writeJSON(filePath, data) {
  try {
    const safePath = validatePath(filePath, 'output file path');
    
    // Ensure directory exists
    const dir = path.dirname(safePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Validate data before writing
    if (data && typeof data === 'object' && data.info && data.info.name) {
      validateCollection(data, safePath);
    }
    
    const jsonString = JSON.stringify(data, null, 4);
    fs.writeFileSync(safePath, jsonString);
    log(`Successfully wrote ${jsonString.length} characters to ${safePath}`);
  } catch (error) {
    throw new Error(`Failed to write JSON file ${filePath}: ${error.message}`);
  }
}

function loadConfig(configPath) {
  try {
    if (!fs.existsSync(configPath)) {
      throw new Error(`Config file not found: ${configPath}`);
    }
    
    const txt = fs.readFileSync(configPath, 'utf8');
    const doc = yaml.load(txt) || {};
    
    const defaults = {
      services: [],
      collection: {
        targetFolder: '' // e.g., "Parent/Child" - empty = root level
      },
      options: {
        preferOperationId: true,
        keepWorkingItemName: true,
        descriptionDelimiter: '\n---\n',
        tagNew: 'status:new',
        retireMode: 'move', // move | skip | delete
        order: 'keep'       // keep | alpha
      }
    };
    
    const config = { 
      ...defaults, 
      ...doc, 
      collection: { ...defaults.collection, ...(doc.collection || {}) },
      options: { ...defaults.options, ...(doc.options || {}) } 
    };
    
    // Validate config
    if (!config.services || config.services.length === 0) {
      log('Warning: No services defined in config', 'warn');
    }
    
    // Validate targetFolder if specified
    if (config.collection && config.collection.targetFolder) {
      const tf = config.collection.targetFolder;
      if (typeof tf !== 'string') {
        throw new Error('collection.targetFolder must be a string (e.g., "Parent/Child")');
      }
      if (tf.includes('..') || tf.includes('\0')) {
        throw new Error('collection.targetFolder contains invalid characters');
      }
    }
    
    return config;
  } catch (error) {
    if (error.name === 'YAMLException') {
      throw new Error(`Invalid YAML in config file ${configPath}: ${error.message}`);
    }
    throw new Error(`Failed to load config file ${configPath}: ${error.message}`);
  }
}

// Normalize a URL to "path/with/:vars" (no leading slash)
function getNormalizedPathFromUrl(urlLike) {
  if (!urlLike) return '';
  
  // Handle string URLs
  if (typeof urlLike === 'string') {
    try {
      const u = new URL(urlLike, 'http://dummy');
      return (u.pathname || '').replace(/^\//, '');
    } catch {
      return urlLike.replace(/^\//, '');
    }
  }
  
  const u = urlLike;
  
  // FIX 1: Prioritize path array (more reliable and consistent)
  // Path array exists in both working and reference collections and is clean
  // (doesn't contain protocol, host, or Postman variables in the path structure)
  const pathArr = Array.isArray(u.path) ? u.path : [];
  if (pathArr.length > 0) {
    // FIX 2: Normalize path parameters and variables for matching
    // Working collection may use {{varName}} while ref uses :paramName
    // Both should match as they represent the same path structure
    const normalizedPath = pathArr
      .map(segment => {
        // Replace {{varName}} with :param
        if (/^\{\{[^}]+\}\}$/.test(segment)) {
          return ':param';
        }
        // Replace :paramName with :param
        if (/^:[a-zA-Z0-9_-]+$/.test(segment)) {
          return ':param';
        }
        return segment;
      })
      .join('/');
    return normalizedPath.replace(/^\//, '');
  }
  
  // Fallback to raw field only if path array is empty
  if (u.raw) {
    const raw = u.raw.replace(/^[a-z]+:\/\/[^/]+/i, '');
    return raw.replace(/^\//, '').split('?')[0];
  }
  
  return '';
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

// Find an existing folder by path (e.g., "Parent/Child")
// Returns null if not found
function findFolder(parent, pathString) {
  if (!pathString || pathString.trim() === '') {
    return parent; // Empty path = root level
  }
  
  const segments = pathString.split('/').map(s => s.trim()).filter(s => s);
  let node = parent;
  
  for (const seg of segments) {
    node.item = node.item || [];
    const next = node.item.find(x => x.item && x.name === seg);
    if (!next) {
      return null; // Folder not found
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
    const isVar = typeof old.value === 'string' && /\{\{[^{}]+\}\}/.test(old.value);
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

  // FIX 3: Preserve custom Postman variables in path segments
  // Map old path segments to preserve variables
  const oldPathMap = new Map();
  if (Array.isArray(o.path)) {
    o.path.forEach((segment, idx) => {
      if (/^\{\{[^}]+\}\}$/.test(segment)) {
        oldPathMap.set(idx, segment);
      }
    });
  }

  // path: update structure but preserve Postman variables
  if (Array.isArray(o.path)) {
    if (Array.isArray(n.path)) {
      // Use new path structure but restore Postman variables at their positions
      o.path = n.path.map((segment, idx) => {
        if (oldPathMap.has(idx)) {
          return oldPathMap.get(idx);
        }
        return segment;
      });
    }
    else if (typeof n.raw === 'string') o.path = n.raw.split('?')[0].replace(/^[^/]*:\/\//,'').split('/').slice(1);
  } else if (typeof o.path === 'string') {
    if (Array.isArray(n.path)) o.path = n.path.join('/');
    else if (typeof n.raw === 'string') o.path = n.raw.split('?')[0].replace(/^[^/]*:\/\//,'').split('/').slice(1).join('/');
  }

  // FIX 3: Preserve custom Postman variables in host
  // host: preserve if old host contains Postman variables
  const oldHasVars = Array.isArray(o.host) && o.host.some(h => /\{\{[^}]+\}\}/.test(h));
  if (!oldHasVars && Array.isArray(n.host) && n.host.length) {
    o.host = n.host;
  }
  // else: keep old host (preserves custom Postman variables like {{tcmBaseUrl}})

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
  if (oldReq?.body?.mode === 'raw' && typeof oldReq.body.raw === 'string' && /\{\{[^{}]+\}\}/.test(oldReq.body.raw)) {
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

  // Determine merge root: target folder or collection root
  let mergeRoot = working;
  let targetFolderPath = cfg.collection?.targetFolder || '';
  
  if (targetFolderPath) {
    log(`Looking for target folder: "${targetFolderPath}"`);
    mergeRoot = findFolder(working, targetFolderPath);
    
    if (!mergeRoot) {
      throw new Error(
        `Target folder not found: "${targetFolderPath}"\n` +
        `Please ensure the folder exists in your collection before running the merge.\n` +
        `Tip: You can create it manually in Postman, or remove 'collection.targetFolder' from your config to merge at the root level.`
      );
    }
    
    log(`✅ Found target folder: "${targetFolderPath}"`);
  } else {
    log('Merging at collection root level');
  }

  // map existing requests (scoped to merge root)
  const workMap = new Map();
  walkItems(mergeRoot, (it) => workMap.set(reqKey(it), it));

  let updated = 0, added = 0, retired = 0;

  for (const svc of (cfg.services || [])) {
    const specBase = path.basename(svc.spec, path.extname(svc.spec));
    const refPath = path.join(argv.refdir, `${specBase}.postman_collection.json`);
    if (!fs.existsSync(refPath)) { console.error(`Missing ref: ${refPath}`); continue; }
    const ref = readJSON(refPath);

    // Use mergeRoot instead of working for scoped merges
    const targetRoot = ensureFolder(mergeRoot, asArray(svc.workingFolder || []));
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
  log(`Merge completed successfully → ${argv.out}`);
  log(`Updated: ${updated}  •  Added: ${added}  •  Retired: ${retired}`);
}

// Main execution with error handling
async function runMain() {
  try {
    // Validate all input paths first
    const safeConfig = validatePath(argv.config, 'config file');
    const safeWorking = validatePath(argv.working, 'working collection');
    const safeRefdir = validatePath(argv.refdir, 'reference directory');
    const safeOut = validatePath(argv.out, 'output file');
    
    log('Starting OAS → Postman merge process...');
    log(`Config: ${safeConfig}`);
    log(`Working: ${safeWorking}`);
    log(`Reference dir: ${safeRefdir}`);
    log(`Output: ${safeOut}`);
    
    // Check that reference directory exists
    if (!fs.existsSync(safeRefdir)) {
      throw new Error(`Reference directory not found: ${safeRefdir}`);
    }
    
    main();
    
    log('✅ Merge process completed successfully');
    process.exit(0);
  } catch (error) {
    log(`Merge failed: ${error.message}`, 'error');
    
    if (process.env.DEBUG) {
      console.error('\nStack trace:', error.stack);
    } else {
      log('Run with DEBUG=1 for detailed error information', 'info');
    }
    
    process.exit(1);
  }
}

runMain();