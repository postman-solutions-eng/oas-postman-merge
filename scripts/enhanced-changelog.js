#!/usr/bin/env node
/* 
 * Enhanced Semantic Changelog
 * Extends current changelog.js with curated content preservation reporting
 */

const fs = require('fs');
const yargs = require('yargs');

const argv = yargs(process.argv.slice(2))
  .option('before', { type: 'string', demandOption: true })
  .option('after',  { type: 'string', demandOption: true })
  .option('out',    { type: 'string', demandOption: true })
  .option('include-preserved', { type: 'boolean', default: true })
  .strict().argv;

function generateEnhancedChangelog(before, after) {
  let output = '# Semantic Collection Changes\n\n';
  
  // API Evolution - detect actual endpoint changes
  output += '## 🔄 API Evolution\n';
  
  const apiChanges = detectApiChanges(before, after);
  
  if (apiChanges.added.length > 0) {
    output += '\n### ➕ **Added Endpoints**\n';
    apiChanges.added.forEach(endpoint => {
      output += `- \`${endpoint.method} ${endpoint.path}\` - ${endpoint.name}\n`;
    });
  }
  
  if (apiChanges.removed.length > 0) {
    output += '\n### ➖ **Removed Endpoints**\n';
    apiChanges.removed.forEach(endpoint => {
      output += `- \`${endpoint.method} ${endpoint.path}\` - ${endpoint.name}\n`;
    });
  }
  
  if (apiChanges.modified.length > 0) {
    output += '\n### 🔄 **Modified Endpoints**\n';
    apiChanges.modified.forEach(endpoint => {
      output += `- \`${endpoint.method} ${endpoint.path}\` - ${endpoint.changes.join(', ')}\n`;
    });
  }
  
  if (apiChanges.added.length === 0 && apiChanges.removed.length === 0 && apiChanges.modified.length === 0) {
    output += '\nNo structural API changes detected.\n';
  }
  
  if (argv.includePreserved) {
    // NEW: Curated Content Preservation Report
    output += '\n## ✅ Preserved Curated Content\n';
    
    const preservation = analyzePreservation(before, after);
    output += `- **Test Scripts**: ${preservation.scripts.before} → ${preservation.scripts.after} (${preservation.scripts.preserved ? '✅ Preserved' : '❌ Changed'})\n`;
    output += `- **Auth Configs**: ${preservation.auth.before} → ${preservation.auth.after} (${preservation.auth.preserved ? '✅ Preserved' : '❌ Changed'})\n`;
    
    // Verbose header reporting
    if (preservation.headers.count > 0) {
      output += `- **Custom Headers**: ${preservation.headers.count} preserved\n`;
      if (preservation.headers.details.length > 0) {
        output += `  - Found: ${preservation.headers.details.join(', ')}\n`;
      }
    } else {
      output += `- **Custom Headers**: None detected\n`;
    }
    
    // Verbose description reporting  
    if (preservation.descriptions.count > 0) {
      output += `- **Custom Descriptions**: ${preservation.descriptions.count} with delimiters preserved\n`;
      if (preservation.descriptions.details.length > 0) {
        output += `  - Locations: ${preservation.descriptions.details.join(', ')}\n`;
      }
    } else {
      output += `- **Custom Descriptions**: None detected\n`;
    }
    
    // NEW: Change Impact Analysis
    output += '\n## 📊 Change Impact\n';
    output += `- **Semantic changes**: ${apiChanges.added.length + apiChanges.removed.length + apiChanges.modified.length} meaningful API modifications\n`;
    output += `- **Format changes**: Ignored (XML↔JSON, whitespace, etc.)\n`;
    const totalCount = preservation.scripts.after + preservation.auth.after + preservation.headers.count + preservation.descriptions.count;
    output += `- **Curation impact**: ${preservation.semanticChanges === 0 ? 'Zero' : 'Minimal'} (${totalCount} items protected)\n`;
  }
  
  return output;
}

function detectApiChanges(before, after) {
  const beforeEndpoints = extractEndpoints(before);
  const afterEndpoints = extractEndpoints(after);
  
  const beforeKeys = new Set(beforeEndpoints.map(e => `${e.method}:${e.path}`));
  const afterKeys = new Set(afterEndpoints.map(e => `${e.method}:${e.path}`));
  
  // Find added endpoints
  const added = afterEndpoints.filter(e => !beforeKeys.has(`${e.method}:${e.path}`));
  
  // Find removed endpoints  
  const removed = beforeEndpoints.filter(e => !afterKeys.has(`${e.method}:${e.path}`));
  
  // Find modified endpoints (same method+path, different parameters/structure)
  const modified = [];
  afterEndpoints.forEach(afterEndpoint => {
    const key = `${afterEndpoint.method}:${afterEndpoint.path}`;
    if (beforeKeys.has(key)) {
      const beforeEndpoint = beforeEndpoints.find(e => `${e.method}:${e.path}` === key);
      const changes = detectEndpointChanges(beforeEndpoint, afterEndpoint);
      if (changes.length > 0) {
        modified.push({
          ...afterEndpoint,
          changes
        });
      }
    }
  });
  
  return { added, removed, modified };
}

function extractEndpoints(collection) {
  const endpoints = [];
  
  function traverseItems(items, pathPrefix = '') {
    items.forEach(item => {
      if (item.request) {
        // This is a request item
        const method = item.request.method;
        const url = item.request.url;
        let path = '';
        
        if (typeof url === 'string') {
          // Extract path from raw URL
          path = url.replace(/{{[^}]+}}/g, '').split('?')[0];
        } else if (url && url.path) {
          // Extract path from structured URL
          path = '/' + url.path.filter(p => p && p !== '').map(p => p.startsWith(':') ? `{${p.slice(1)}}` : p).join('/');
        }
        
        endpoints.push({
          name: item.name,
          method: method,
          path: path,
          queryParams: extractQueryParams(url),
          headers: extractHeaders(item.request.header || [])
        });
      } else if (item.item) {
        // This is a folder, recurse
        traverseItems(item.item, pathPrefix);
      }
    });
  }
  
  if (collection.item) {
    traverseItems(collection.item);
  }
  
  return endpoints;
}

function extractQueryParams(url) {
  const params = [];
  if (url && url.query) {
    url.query.forEach(q => {
      params.push(q.key);
    });
  }
  return params;
}

function extractHeaders(headers) {
  return headers.map(h => h.key);
}

function detectEndpointChanges(before, after) {
  const changes = [];
  
  // Check for new query parameters
  const beforeParams = new Set(before.queryParams);
  const afterParams = new Set(after.queryParams);
  
  const newParams = after.queryParams.filter(p => !beforeParams.has(p));
  const removedParams = before.queryParams.filter(p => !afterParams.has(p));
  
  if (newParams.length > 0) {
    changes.push(`added query params: ${newParams.join(', ')}`);
  }
  if (removedParams.length > 0) {
    changes.push(`removed query params: ${removedParams.join(', ')}`);
  }
  
  return changes;
}

function analyzePreservation(before, after) {
  // Analyze what curated content was preserved
  return {
    scripts: { 
      before: countScripts(before), 
      after: countScripts(after),
      preserved: countScripts(before) === countScripts(after)
    },
    auth: {
      before: countAuthConfigs(before),
      after: countAuthConfigs(after), 
      preserved: countAuthConfigs(before) === countAuthConfigs(after)
    },
    headers: countCustomHeaders(after, before),
    descriptions: countCustomDescriptions(after, before),
    semanticChanges: estimateSemanticChanges(before, after),
    totalPreserved: countScripts(after) + countAuthConfigs(after) + countCustomHeaders(after, before).count
  };
}

function countScripts(collection) {
  // Count pm.test instances as proxy for curated scripts
  return (JSON.stringify(collection).match(/pm\.test/g) || []).length;
}

function countAuthConfigs(collection) {
  // Count auth configurations
  return (JSON.stringify(collection).match(/"auth":/g) || []).length;
}

function countCustomHeaders(after, before = null) {
  if (!before) {
    // Fallback to old approach if no before collection available
    return { count: 0, details: [] };
  }

  // Extract headers from both collections
  function extractHeaders(collection) {
    const headers = new Set();
    const content = JSON.stringify(collection);
    const headerMatches = content.match(/"key":\s*"([^"]+)"/g) || [];
    headerMatches.forEach(match => {
      const header = match.match(/"key":\s*"([^"]+)"/)[1];
      headers.add(header);
    });
    return headers;
  }

  const beforeHeaders = extractHeaders(before);
  const afterHeaders = extractHeaders(after);
  
  // Standard headers that shouldn't count as "custom" even if preserved
  const standardHeaders = new Set([
    'Accept', 'Accept-Encoding', 'Accept-Language', 'Authorization', 
    'Cache-Control', 'Connection', 'Content-Length', 'Content-Type', 
    'Content-Encoding', 'Cookie', 'Date', 'ETag', 'Expires', 
    'Host', 'If-Match', 'If-Modified-Since', 'If-None-Match',
    'Last-Modified', 'Location', 'Origin', 'Referer', 'Server',
    'Transfer-Encoding', 'User-Agent', 'Vary', 'WWW-Authenticate', 'Link'
  ]);
  
  // Common API headers that shouldn't count as custom
  const apiHeaders = new Set([
    'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset',
    'X-GitHub-Media-Type', 'X-GitHub-Enterprise-Version', 'X-OAuth-Scopes',
    'X-CommonMarker-Version', 'X-Request-ID', 'X-Response-Time'
  ]);
  
  // Find headers that were preserved AND are likely user-added
  const preservedCuratedHeaders = [];
  beforeHeaders.forEach(header => {
    if (afterHeaders.has(header)) {
      // Skip standard HTTP headers
      if (standardHeaders.has(header)) return;
      
      // Skip known API headers  
      if (apiHeaders.has(header)) return;
      
      // Skip things that look like query parameters (lowercase, underscore)
      if (/^[a-z_]+$/.test(header)) return;
      
      // What's left should be truly custom headers
      preservedCuratedHeaders.push(header);
    }
  });
  
  return {
    count: preservedCuratedHeaders.length,
    details: preservedCuratedHeaders.sort()
  };
}

function countCustomDescriptions(after, before = null) {
  if (!before) {
    // Fallback: just count descriptions with delimiters in final collection
    const content = JSON.stringify(after);
    const descMatches = content.match(/"description":\s*"[^"]*---[^"]*"/g) || [];
    return { count: descMatches.length, details: [] };
  }

  // Find descriptions that had delimiters in the original collection and were preserved
  const locations = [];
  
  try {
    const beforeParsed = JSON.parse(JSON.stringify(before));
    const afterParsed = JSON.parse(JSON.stringify(after));
    
    // Check collection-level description
    if (beforeParsed.info && beforeParsed.info.description && beforeParsed.info.description.includes('---') &&
        afterParsed.info && afterParsed.info.description && afterParsed.info.description.includes('---')) {
      locations.push(`Collection: ${afterParsed.info.name || 'Root'}`);
    }
    
    // Recursively check items for preserved curated descriptions
    function findPreservedDescriptions(beforeItems, afterItems, path = []) {
      if (!Array.isArray(beforeItems) || !Array.isArray(afterItems)) return;
      
      // Create maps to match items by name
      const beforeMap = new Map();
      const afterMap = new Map();
      
      beforeItems.forEach(item => beforeMap.set(item.name, item));
      afterItems.forEach(item => afterMap.set(item.name, item));
      
      beforeMap.forEach((beforeItem, name) => {
        const afterItem = afterMap.get(name);
        if (!afterItem) return;
        
        const currentPath = [...path, name].filter(Boolean);
        
        // Check if this item had a curated description in before and still has it in after
        if (beforeItem.description && beforeItem.description.includes('---') &&
            afterItem.description && afterItem.description.includes('---')) {
          
          const isFolder = beforeItem.item && Array.isArray(beforeItem.item);
          const itemType = isFolder ? 'Folder' : 'Request';
          
          const pathStr = currentPath.length > 1 ? 
            `${currentPath.slice(0, -1).join(' > ')} > ${itemType}: ${currentPath[currentPath.length - 1]}` :
            `${itemType}: ${currentPath[0]}`;
          locations.push(pathStr);
        }
        
        // Recursively check nested items
        if (beforeItem.item && afterItem.item && Array.isArray(beforeItem.item) && Array.isArray(afterItem.item)) {
          findPreservedDescriptions(beforeItem.item, afterItem.item, currentPath);
        }
      });
    }
    
    if (beforeParsed.item && afterParsed.item) {
      findPreservedDescriptions(beforeParsed.item, afterParsed.item);
    }
    
  } catch (e) {
    // Fallback to pattern counting
    const content = JSON.stringify(after);
    const descMatches = content.match(/"description":\s*"[^"]*---[^"]*"/g) || [];
    return { count: descMatches.length, details: [`${descMatches.length} item(s)`] };
  }
  
  return {
    count: locations.length,
    details: locations.slice(0, 5)
  };
}

function estimateSemanticChanges(before, after) {
  // Rough estimate based on endpoint count differences
  const beforeEndpoints = (JSON.stringify(before).match(/"method":/g) || []).length;
  const afterEndpoints = (JSON.stringify(after).match(/"method":/g) || []).length;
  return Math.abs(afterEndpoints - beforeEndpoints);
}

// Enhanced logging
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : 'ℹ️';
  console.log(`${prefix} [${timestamp}] ${message}`);
}

// Safe file operations
function readJSONFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON in file ${filePath}: ${error.message}`);
    }
    throw new Error(`Failed to read file ${filePath}: ${error.message}`);
  }
}

function writeFile(filePath, content) {
  try {
    const path = require('path');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
    log(`Successfully wrote changelog to ${filePath}`);
  } catch (error) {
    throw new Error(`Failed to write file ${filePath}: ${error.message}`);
  }
}

// Main execution with error handling
async function runMain() {
  try {
    log('Starting enhanced semantic changelog generation...');
    log(`Before: ${argv.before}`);
    log(`After: ${argv.after}`);
    log(`Output: ${argv.out}`);
    
    const before = readJSONFile(argv.before);
    const after = readJSONFile(argv.after);
    
    log('Analyzing collection changes...');
    const enhancedChangelog = generateEnhancedChangelog(before, after);
    
    writeFile(argv.out, enhancedChangelog);
    
    log('✅ Enhanced semantic changelog generated successfully');
    process.exit(0);
  } catch (error) {
    log(`Changelog generation failed: ${error.message}`, 'error');
    
    if (process.env.DEBUG) {
      console.error('\nStack trace:', error.stack);
    } else {
      log('Run with DEBUG=1 for detailed error information', 'info');
    }
    
    process.exit(1);
  }
}

runMain();
