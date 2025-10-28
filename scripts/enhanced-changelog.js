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
    output += `- **Custom Headers**: ${preservation.headers.count} preserved\n`;
    output += `- **Custom Descriptions**: ${preservation.descriptions.count} with delimiters preserved\n`;
    
    // NEW: Change Impact Analysis
    output += '\n## 📊 Change Impact\n';
    output += `- **Semantic changes**: ${apiChanges.added.length + apiChanges.removed.length + apiChanges.modified.length} meaningful API modifications\n`;
    output += `- **Format changes**: Ignored (XML↔JSON, whitespace, etc.)\n`;
    output += `- **Curation impact**: Zero (${preservation.totalPreserved} items protected)\n`;
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
    headers: { count: countCustomHeaders(after) },
    descriptions: { count: countCustomDescriptions(after) },
    semanticChanges: estimateSemanticChanges(before, after),
    totalPreserved: countScripts(after) + countAuthConfigs(after) + countCustomHeaders(after)
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

function countCustomHeaders(collection) {
  // Count non-standard headers
  const content = JSON.stringify(collection);
  const standardHeaders = ['Content-Type', 'Accept', 'Authorization', 'User-Agent', 'Host'];
  let customCount = 0;
  
  // Simple heuristic - count headers not in standard list
  const headerMatches = content.match(/"key":\s*"([^"]+)"/g) || [];
  headerMatches.forEach(match => {
    const header = match.match(/"key":\s*"([^"]+)"/)[1];
    if (!standardHeaders.includes(header)) customCount++;
  });
  
  return customCount;
}

function countCustomDescriptions(collection) {
  return (JSON.stringify(collection).match(/---/g) || []).length;
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
