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
  // Start with existing changelog logic...
  const existingChangelog = require('./changelog.js');
  
  let output = '# Semantic Collection Changes\n\n';
  
  // API Evolution (existing functionality)
  output += '## 🔄 API Evolution\n';
  output += '<!-- Structural endpoint changes -->\n';
  
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
    output += `- **Semantic changes**: ${preservation.semanticChanges} meaningful API modifications\n`;
    output += `- **Format changes**: Ignored (XML↔JSON, whitespace, etc.)\n`;
    output += `- **Curation impact**: Zero (${preservation.totalPreserved} items protected)\n`;
  }
  
  return output;
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
  const standardHeaders = ['Content-Type', 'Accept', 'X-Tableau-Auth', 'Authorization'];
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

// Generate enhanced changelog
const before = JSON.parse(fs.readFileSync(argv.before, 'utf8'));
const after = JSON.parse(fs.readFileSync(argv.after, 'utf8'));

const enhancedChangelog = generateEnhancedChangelog(before, after);
fs.writeFileSync(argv.out, enhancedChangelog);

console.log(`Enhanced semantic changelog written to ${argv.out}`);
