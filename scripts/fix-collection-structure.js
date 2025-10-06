#!/usr/bin/env node
/**
 * Post-process generated Postman collections to fix folder structure
 * Converts flat folder names like "sites/{site Id}/custom-views" 
 * into proper nested folder structure
 */

const fs = require('fs');
const path = require('path');

function fixCollectionStructure(collection) {
  if (!collection.item) return collection;
  
  const fixedItems = [];
  const nestedStructure = {};
  
  for (const item of collection.item) {
    if (item.item && item.name.includes('/')) {
      // This is a flat folder that should be nested
      const pathParts = item.name.split('/').map(p => p.trim());
      
      // Create nested structure
      let current = nestedStructure;
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        const cleanPart = part.replace(/\{site Id\}/g, '{siteId}'); // Fix space bug
        
        if (!current[cleanPart]) {
          current[cleanPart] = {
            name: cleanPart,
            item: [],
            folders: {}
          };
        }
        
        if (i === pathParts.length - 1) {
          // Last part - add the actual items
          current[cleanPart].item = item.item;
          if (item.description) current[cleanPart].description = item.description;
          if (item.auth) current[cleanPart].auth = item.auth;
          if (item.event) current[cleanPart].event = item.event;
        }
        
        current = current[cleanPart].folders;
      }
    } else {
      // Normal item - keep as is
      fixedItems.push(item);
    }
  }
  
  // Convert nested structure back to Postman format
  function convertToPostmanItems(structure) {
    const items = [];
    for (const [name, data] of Object.entries(structure)) {
      const folderItem = {
        name: data.name,
        item: data.item.concat(convertToPostmanItems(data.folders))
      };
      if (data.description) folderItem.description = data.description;
      if (data.auth) folderItem.auth = data.auth;
      if (data.event) folderItem.event = data.event;
      items.push(folderItem);
    }
    return items;
  }
  
  fixedItems.push(...convertToPostmanItems(nestedStructure));
  
  return {
    ...collection,
    item: fixedItems
  };
}

// CLI usage
if (require.main === module) {
  const inputFile = process.argv[2];
  const outputFile = process.argv[3] || inputFile;
  
  if (!inputFile) {
    console.error('Usage: node fix-collection-structure.js <input.json> [output.json]');
    process.exit(1);
  }
  
  try {
    const collection = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    const fixed = fixCollectionStructure(collection);
    fs.writeFileSync(outputFile, JSON.stringify(fixed, null, 2));
    console.log(`Fixed collection structure: ${inputFile} → ${outputFile}`);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = { fixCollectionStructure };
