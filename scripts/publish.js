#!/usr/bin/env node
/**
 * Publish Collection to Postman
 * 
 * Pushes the merged collection to Postman via API.
 * Can be used locally or in CI/CD pipelines.
 * 
 * Usage:
 *   npm run publish              # Publish to Postman
 *   npm run publish:test         # Dry run (validates but doesn't push)
 *   node scripts/publish.js --collection path/to/collection.json
 * 
 * Environment Variables:
 *   POSTMAN_API_KEY          - Your Postman API key (required)
 *   WORKING_COLLECTION_UID   - Target collection UID (required)
 * 
 * Or use .env.local file (created by setup wizard)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

// Load .env.local if exists
function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const match = line.match(/^([A-Z_]+)=(.+)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    });
    return true;
  }
  return false;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    collection: null,
    dryRun: false,
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--dry-run' || arg === '-n') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--collection' || arg === '-c') {
      options.collection = args[++i];
    }
  }

  return options;
}

// Print usage
function printUsage() {
  console.log(`
${c('bright', 'Postman Collection Publisher')}

${c('cyan', 'Usage:')}
  npm run publish              Publish collection to Postman
  npm run publish:test         Dry run (validate only)

${c('cyan', 'Options:')}
  --collection, -c <path>      Path to collection JSON (default: collections/working.json)
  --dry-run, -n                Validate without publishing
  --verbose, -v                Show detailed output
  --help, -h                   Show this help

${c('cyan', 'Environment:')}
  POSTMAN_API_KEY              Your Postman API key ${c('red', '(required)')}
  WORKING_COLLECTION_UID       Target collection UID ${c('red', '(required)')}

${c('cyan', 'Setup:')}
  Run ${c('green', 'npm run setup:publish')} for interactive configuration wizard.

${c('cyan', 'Examples:')}
  npm run publish                                    # Publish default collection
  npm run publish:test                               # Validate without changes
  node scripts/publish.js -c my-collection.json     # Publish specific file
`);
}

// Postman API helper
function postmanPut(endpoint, apiKey, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    
    const options = {
      hostname: 'api.getpostman.com',
      port: 443,
      path: endpoint,
      method: 'PUT',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Postman API GET helper
function postmanGet(endpoint, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.getpostman.com',
      port: 443,
      path: endpoint,
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Validate collection JSON
function validateCollection(collection) {
  const errors = [];
  
  if (!collection) {
    errors.push('Collection is empty or null');
    return errors;
  }

  if (!collection.info) {
    errors.push('Missing required field: info');
  } else {
    if (!collection.info.name) {
      errors.push('Missing required field: info.name');
    }
    if (!collection.info.schema) {
      errors.push('Missing required field: info.schema');
    }
  }

  if (!collection.item || !Array.isArray(collection.item)) {
    errors.push('Missing or invalid field: item (must be array)');
  }

  return errors;
}

// Count requests recursively
function countRequests(items, depth = 0) {
  let count = 0;
  for (const item of items || []) {
    if (item.request) {
      count++;
    }
    if (item.item) {
      count += countRequests(item.item, depth + 1);
    }
  }
  return count;
}

// Main publish function
async function main() {
  console.log('\n' + c('cyan', '━'.repeat(60)));
  console.log(c('bright', '  📤 Postman Collection Publisher'));
  console.log(c('cyan', '━'.repeat(60)) + '\n');

  const options = parseArgs();
  
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  // Load environment
  const hasEnvLocal = loadEnvLocal();
  if (hasEnvLocal && options.verbose) {
    console.log(c('dim', '   Loaded configuration from .env.local'));
  }

  const apiKey = process.env.POSTMAN_API_KEY;
  const collectionUid = process.env.WORKING_COLLECTION_UID;

  // Validate environment
  console.log(c('yellow', '🔍 Checking configuration...'));
  
  if (!apiKey) {
    console.log(c('red', '\n❌ Missing POSTMAN_API_KEY'));
    console.log(c('dim', '   Run: npm run setup:publish'));
    console.log(c('dim', '   Or set POSTMAN_API_KEY environment variable\n'));
    process.exit(1);
  }

  if (!collectionUid) {
    console.log(c('red', '\n❌ Missing WORKING_COLLECTION_UID'));
    console.log(c('dim', '   Run: npm run setup:publish'));
    console.log(c('dim', '   Or set WORKING_COLLECTION_UID environment variable\n'));
    process.exit(1);
  }

  console.log(c('green', '   ✅ API key configured'));
  console.log(c('green', `   ✅ Target: ${collectionUid.substring(0, 20)}...`));

  // Find collection file
  const collectionPath = options.collection || 'collections/working.json';
  const fullPath = path.isAbsolute(collectionPath) 
    ? collectionPath 
    : path.join(process.cwd(), collectionPath);

  console.log(c('dim', `   📄 Collection: ${collectionPath}`));

  if (!fs.existsSync(fullPath)) {
    console.log(c('red', `\n❌ Collection file not found: ${collectionPath}`));
    console.log(c('dim', '   Make sure you\'ve run the merge first\n'));
    process.exit(1);
  }

  // Load and validate collection
  console.log(c('yellow', '\n📋 Validating collection...'));

  let collection;
  try {
    const content = fs.readFileSync(fullPath, 'utf8');
    collection = JSON.parse(content);
  } catch (err) {
    console.log(c('red', `\n❌ Failed to parse collection: ${err.message}`));
    process.exit(1);
  }

  const validationErrors = validateCollection(collection);
  if (validationErrors.length > 0) {
    console.log(c('red', '\n❌ Collection validation failed:'));
    validationErrors.forEach(e => console.log(c('red', `   • ${e}`)));
    process.exit(1);
  }

  const requestCount = countRequests(collection.item);
  const folderCount = (collection.item || []).length;

  console.log(c('green', `   ✅ Name: ${collection.info.name}`));
  console.log(c('green', `   ✅ Schema: Postman Collection v2.1`));
  console.log(c('green', `   ✅ Content: ${requestCount} requests in ${folderCount} top-level items`));

  // Verify API key works
  console.log(c('yellow', '\n🔑 Verifying API access...'));

  try {
    const meResult = await postmanGet('/me', apiKey);
    if (meResult.status !== 200) {
      console.log(c('red', '\n❌ Invalid API key'));
      console.log(c('dim', `   Status: ${meResult.status}`));
      if (meResult.data?.error) {
        console.log(c('dim', `   Error: ${meResult.data.error.message || meResult.data.error}`));
      }
      process.exit(1);
    }
    console.log(c('green', `   ✅ Authenticated as: ${meResult.data.user?.username || 'unknown'}`));
  } catch (err) {
    console.log(c('red', `\n❌ API connection failed: ${err.message}`));
    process.exit(1);
  }

  // Verify target collection exists
  console.log(c('yellow', '\n🎯 Checking target collection...'));

  try {
    const colResult = await postmanGet(`/collections/${collectionUid}`, apiKey);
    if (colResult.status !== 200) {
      console.log(c('red', '\n❌ Target collection not found or not accessible'));
      console.log(c('dim', `   UID: ${collectionUid}`));
      console.log(c('dim', `   Status: ${colResult.status}`));
      console.log(c('dim', '\n   Run: npm run setup:publish to reconfigure'));
      process.exit(1);
    }
    
    const targetName = colResult.data.collection?.info?.name || 'Unknown';
    const targetRequests = countRequests(colResult.data.collection?.item);
    console.log(c('green', `   ✅ Found: ${targetName}`));
    console.log(c('green', `   ✅ Current: ${targetRequests} requests`));
    console.log(c('cyan', `   📊 After publish: ${requestCount} requests`));
    
    const diff = requestCount - targetRequests;
    if (diff > 0) {
      console.log(c('green', `   ➕ Adding ${diff} request(s)`));
    } else if (diff < 0) {
      console.log(c('yellow', `   ➖ Removing ${Math.abs(diff)} request(s)`));
    } else {
      console.log(c('dim', `   ↔️  Same request count`));
    }
  } catch (err) {
    console.log(c('red', `\n❌ Failed to check target: ${err.message}`));
    process.exit(1);
  }

  // Dry run stop point
  if (options.dryRun) {
    console.log('\n' + c('cyan', '━'.repeat(60)));
    console.log(c('yellow', '  🧪 DRY RUN - No changes made'));
    console.log(c('cyan', '━'.repeat(60)));
    console.log(`
  ${c('green', '✅')} Configuration valid
  ${c('green', '✅')} Collection valid  
  ${c('green', '✅')} API access verified
  ${c('green', '✅')} Target collection accessible
  
  ${c('bright', 'Ready to publish!')} Run without --dry-run to push changes.
`);
    process.exit(0);
  }

  // Confirm before publish
  console.log('\n' + c('yellow', '⚠️  About to publish to Postman!'));
  console.log(c('dim', '   This will update your live collection.\n'));

  // In non-interactive mode (CI), skip confirmation
  const isCI = process.env.CI || process.env.GITHUB_ACTIONS;
  
  if (!isCI) {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const confirm = await new Promise(resolve => {
      rl.question(c('cyan', '→ Continue? (y/n): '), answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
    
    if (!confirm) {
      console.log(c('dim', '\n   Cancelled. No changes made.\n'));
      process.exit(0);
    }
  }

  // Publish!
  console.log(c('yellow', '\n📤 Publishing to Postman...'));

  try {
    const payload = { collection };
    const result = await postmanPut(`/collections/${collectionUid}`, apiKey, payload);
    
    if (result.status === 200) {
      console.log(c('green', '\n' + '━'.repeat(60)));
      console.log(c('green', c('bright', '  ✅ Successfully published to Postman!')));
      console.log(c('green', '━'.repeat(60)));
      console.log(`
  ${c('cyan', 'Collection:')} ${collection.info.name}
  ${c('cyan', 'UID:')} ${collectionUid}
  ${c('cyan', 'Requests:')} ${requestCount}
  
  ${c('dim', 'View in Postman: https://postman.co/collection/' + collectionUid)}
`);
    } else {
      console.log(c('red', `\n❌ Publish failed (HTTP ${result.status})`));
      if (result.data?.error) {
        console.log(c('dim', `   Error: ${result.data.error.message || JSON.stringify(result.data.error)}`));
      }
      if (result.status === 403) {
        console.log(c('dim', '\n   You may not have write access to this collection.'));
        console.log(c('dim', '   Make sure you own the collection or have editor access.'));
      }
      process.exit(1);
    }
  } catch (err) {
    console.log(c('red', `\n❌ Publish failed: ${err.message}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error(c('red', '\n❌ Unexpected error:'), err);
  process.exit(1);
});
