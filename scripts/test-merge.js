#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 OAS → Postman Test Merge');
console.log('================================\n');

// Simple config detection
let configFile = 'config/merge.config.yaml';
if (fs.existsSync('config/my-test.config.yaml')) {
  configFile = 'config/my-test.config.yaml';
}

// Auto-detect OpenAPI spec
const openApiFiles = fs.readdirSync('openapi/').filter(f => 
  f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json')
);

if (openApiFiles.length === 0) {
  console.log('❌ No OpenAPI spec found in openapi/ directory');
  console.log('   Add your spec file to openapi/ and try again');
  process.exit(1);
}

const specFile = `openapi/${openApiFiles[0]}`;
console.log(`📋 Using spec: ${specFile}`);

// Auto-detect collection
const collectionFiles = fs.readdirSync('collections/').filter(f => 
  f.endsWith('.json') && !f.includes('merged') && !f.includes('working')
);

let collectionFile = 'collections/working.json';
if (collectionFiles.length > 0) {
  collectionFile = `collections/${collectionFiles[0]}`;
}

if (!fs.existsSync(collectionFile)) {
  console.log(`❌ No collection found at ${collectionFile}`);
  console.log('   Export your Postman collection and place it in collections/');
  process.exit(1);
}

console.log(`📦 Using collection: ${collectionFile}`);
console.log(`⚙️  Using config: ${configFile}\n`);

// Run the workflow
async function runCommand(cmd, description) {
  console.log(`🔄 ${description}...`);
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ ${description} failed:`);
        if (stderr && stderr.includes('openapi-to-postmanv2: command not found')) {
          console.log('   Install the converter first: npm install -g openapi-to-postmanv2@latest');
        } else {
          console.log(stderr || stdout);
        }
        reject(error);
      } else {
        console.log(`✅ ${description} complete\n`);
        resolve(stdout);
      }
    });
  });
}

async function main() {
  try {
    // Create ref directory
    if (!fs.existsSync('ref')) {
      fs.mkdirSync('ref');
    }
    
    // Step 1: Convert OpenAPI to Postman
    const refFile = `ref/${path.basename(specFile, path.extname(specFile))}.postman_collection.json`;
    await runCommand(
      `openapi-to-postmanv2 -s "${specFile}" -o "${refFile}" -p`,
      'Converting OpenAPI spec to Postman collection'
    );
    
    // Step 2: Run merge
    const mergedFile = collectionFile.replace('.json', '.merged.json');
    await runCommand(
      `node scripts/merge.js --config "${configFile}" --working "${collectionFile}" --refdir ref --out "${mergedFile}"`,
      'Merging collections while preserving curation'
    );
    
    // Step 3: Generate changelog
    await runCommand(
      `node scripts/enhanced-changelog.js --before "${collectionFile}" --after "${mergedFile}" --out CHANGELOG.md`,
      'Generating semantic changelog'
    );
    
    // Step 4: Normalize merged collection (internal step)
    await runCommand(
      `node scripts/normalize.js "${mergedFile}"`,
      'Normalizing merged collection for clean diffs'
    );
    
    console.log('🎉 Test merge complete!\n');
    console.log('📊 Results:');
    console.log(`   • Merged collection: ${mergedFile}`);
    console.log(`   • Changelog: CHANGELOG.md`);
    console.log(`   • Import ${mergedFile} into Postman to test\n`);
    
    console.log('📝 View changelog:');
    console.log('   cat CHANGELOG.md\n');
    
  } catch (error) {
    console.log('❌ Test merge failed');
    process.exit(1);
  }
}

main();
