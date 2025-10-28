#!/usr/bin/env node
/*
 * Cleanup Script for OAS → Postman Testing
 * Removes generated files to start fresh between tests
 */

const fs = require('fs');
const path = require('path');

console.log('🧹 Cleaning up test artifacts...\n');

const itemsToClean = [
  // Reference collections directory
  { path: 'ref', type: 'directory', desc: 'Generated reference collections' },
  
  // Merged collection files
  { path: 'collections/*.merged.json', type: 'glob', desc: 'Merged collection outputs' },
  
  // Generated changelog
  { path: 'CHANGELOG.md', type: 'file', desc: 'Test changelog' },
  
  // Auto-generated test configs
  { path: 'config/test-merge.config.yaml', type: 'file', desc: 'Auto-generated test config' },
];

function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        fs.rmSync(filePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(filePath);
      }
      return true;
    }
  } catch (error) {
    console.log(`   ⚠️  Could not delete ${filePath}: ${error.message}`);
    return false;
  }
  return false;
}

function cleanGlob(pattern, desc) {
  const [dir, filePattern] = pattern.split('/');
  let cleaned = 0;
  
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    const regex = new RegExp(filePattern.replace('*', '.*'));
    
    files.forEach(file => {
      if (regex.test(file)) {
        if (deleteFile(path.join(dir, file))) {
          cleaned++;
        }
      }
    });
  }
  
  return cleaned;
}

let totalCleaned = 0;

itemsToClean.forEach(item => {
  const { path: itemPath, type, desc } = item;
  
  if (type === 'directory' || type === 'file') {
    if (deleteFile(itemPath)) {
      console.log(`✅ Removed: ${desc} (${itemPath})`);
      totalCleaned++;
    }
  } else if (type === 'glob') {
    const cleaned = cleanGlob(itemPath, desc);
    if (cleaned > 0) {
      console.log(`✅ Removed: ${cleaned} ${desc.toLowerCase()} (${itemPath})`);
      totalCleaned += cleaned;
    }
  }
});

console.log(`\n🎯 Cleaned up ${totalCleaned} items`);

// Show what user files remain (should be untouched)
console.log('\n📋 Your files (preserved):');

['openapi', 'collections', 'config'].forEach(dir => {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir)
      .filter(f => !f.includes('merged') && !f.includes('test-merge'))
      .filter(f => f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json'));
    
    if (files.length > 0) {
      files.forEach(file => {
        console.log(`   📁 ${dir}/${file}`);
      });
    }
  }
});

console.log('\n✨ Ready for fresh testing! Run "npm run test-merge" again.');
