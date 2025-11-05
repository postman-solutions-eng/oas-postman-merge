#!/usr/bin/env node

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 OAS → Postman Test Merge');
console.log('================================\n');

// Auto-cleanup previous test artifacts for cleaner experience
if (fs.existsSync('ref')) {
  fs.rmSync('ref', { recursive: true, force: true });
  console.log('🧹 Cleaned up previous test artifacts\n');
}

// Generate dynamic config based on auto-detected files (no static config needed)
let dynamicConfig = null;

// Auto-detect OpenAPI spec (prioritize user files over demo files)
let openApiFiles = fs.readdirSync('openapi/').filter(f => 
  f.endsWith('.yaml') || f.endsWith('.yml') || f.endsWith('.json')
);

if (openApiFiles.length === 0) {
  console.log('❌ No OpenAPI spec found in openapi/ directory');
  console.log('   Add your spec file to openapi/ and try again');
  process.exit(1);
}

// Prioritize user files (anything that's NOT a demo file)
// Look for user files - exclude exact demo filenames, not just demo- prefix
const demoFiles = new Set(['demo-v1.yaml', 'demo-v1.yml', 'demo-v2.yaml', 'demo-v2.yml']);
const userFiles = openApiFiles.filter(f => !demoFiles.has(f));
const specFile = `openapi/${userFiles.length > 0 ? userFiles[0] : openApiFiles[0]}`;
console.log(`📋 Using spec: ${specFile}`);

// Auto-detect collection
const collectionFiles = fs.readdirSync('collections/').filter(f => 
  f.endsWith('.json') && !f.endsWith('.merged.json') && f !== 'working.json'
);

if (collectionFiles.length === 0) {
  console.log('❌ No collection found in collections/ directory');
  console.log('   Export your Postman collection and place it in collections/');
  console.log('   Example: collections/my-api-collection.json');
  process.exit(1);
}

const collectionFile = `collections/${collectionFiles[0]}`;

console.log(`📦 Using collection: ${collectionFile}`);

// Create dynamic config based on auto-detected files
const tempConfigFile = 'config/test-merge-temp.config.yaml';
dynamicConfig = `services:
  - name: "Test API"
    spec: "${specFile}"
    workingFolder: []

options:
  preferOperationId: true
  keepWorkingItemName: true
  descriptionDelimiter: "\\n---\\n"
  tagNew: "status:new"
  retireMode: "move"
  order: "keep"
  # Use tags-based organization for cleaner folder structure
  folderOrganization: "Tags"
`;

console.log(`⚙️  Generated dynamic config for detected files\n`);

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
    
    // Write temporary config file
    fs.writeFileSync(tempConfigFile, dynamicConfig);
    console.log('📝 Created temporary config file\n');
    
    // Step 1: Convert OpenAPI to Postman
    const refFile = `ref/${path.basename(specFile, path.extname(specFile))}.postman_collection.json`;
    // Use npx for better reliability with global installations
    // Add folder strategy option (Tags = cleaner organization by functional area)
    await runCommand(
      `npx openapi-to-postmanv2 -s "${specFile}" -o "${refFile}" -p -O folderStrategy=Tags`,
      'Converting OpenAPI spec to Postman collection (Tags organization)'
    );
    
    // Step 2: Run merge
    const mergedFile = collectionFile.replace('.json', '.merged.json');
    await runCommand(
      `node scripts/merge.js --config "${tempConfigFile}" --working "${collectionFile}" --refdir ref --out "${mergedFile}"`,
      'Merging collections while preserving curation'
    );
    
    // Step 3: Generate changelog (preserve previous if exists)
    if (fs.existsSync('CHANGELOG.md')) {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
      fs.renameSync('CHANGELOG.md', `CHANGELOG.${timestamp}.md`);
      console.log(`📋 Previous changelog saved as CHANGELOG.${timestamp}.md`);
    }
    
    await runCommand(
      `node scripts/enhanced-changelog.js --before "${collectionFile}" --after "${mergedFile}" --out CHANGELOG.md`,
      'Generating semantic changelog'
    );
    
    // Step 4: Normalize merged collection (cleanup step)
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
  } finally {
    // Clean up temporary config file
    if (fs.existsSync(tempConfigFile)) {
      fs.unlinkSync(tempConfigFile);
    }
  }
}

main();
