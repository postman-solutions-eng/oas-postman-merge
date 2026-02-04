#!/usr/bin/env node
/**
 * Interactive Setup Wizard for Postman Publishing
 * 
 * Guides users through configuring auto-publish to Postman:
 * 1. Validates Postman API key
 * 2. Lists available collections
 * 3. Helps select target collection
 * 4. Tests the connection
 * 5. Provides GitHub Actions setup instructions
 */

const readline = require('readline');
const https = require('https');
const fs = require('fs');
const path = require('path');

// ANSI colors for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (question) => new Promise(resolve => rl.question(question, resolve));

// Postman API helper
function postmanRequest(endpoint, apiKey) {
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
          if (res.statusCode === 200) {
            resolve(json);
          } else {
            reject({ status: res.statusCode, error: json.error || json });
          }
        } catch (e) {
          reject({ status: res.statusCode, error: data });
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Main wizard
async function main() {
  console.log('\n' + c('cyan', '━'.repeat(60)));
  console.log(c('bright', '  🚀 Postman Auto-Publish Setup Wizard'));
  console.log(c('cyan', '━'.repeat(60)) + '\n');

  console.log('This wizard will help you configure automatic publishing');
  console.log('of your merged collections to Postman.\n');

  console.log(c('yellow', '📋 What you\'ll need:'));
  console.log('   • A Postman API key (we\'ll help you get one)');
  console.log('   • Access to your GitHub repository settings\n');

  const ready = await ask(c('cyan', '→ Ready to begin? (y/n): '));
  if (ready.toLowerCase() !== 'y') {
    console.log('\n' + c('dim', 'No problem! Run this again when you\'re ready.'));
    rl.close();
    return;
  }

  // Step 1: Get API Key
  console.log('\n' + c('magenta', '━'.repeat(60)));
  console.log(c('bright', '  Step 1: Postman API Key'));
  console.log(c('magenta', '━'.repeat(60)) + '\n');

  console.log(c('yellow', '📝 How to get your API key:'));
  console.log('   1. Go to https://postman.co/settings/me/api-keys');
  console.log('   2. Click "Generate API Key"');
  console.log('   3. Name it something like "OAS Merge Tool"');
  console.log('   4. Copy the key (you won\'t see it again!)\n');

  const apiKey = await ask(c('cyan', '→ Paste your Postman API key: '));
  
  if (!apiKey || apiKey.length < 20) {
    console.log('\n' + c('red', '❌ That doesn\'t look like a valid API key.'));
    console.log(c('dim', '   API keys are typically 64+ characters long.'));
    rl.close();
    return;
  }

  // Validate API key
  console.log('\n' + c('dim', '   Validating API key...'));
  
  let user;
  try {
    user = await postmanRequest('/me', apiKey);
    console.log(c('green', '   ✅ API key valid!'));
    console.log(c('dim', `   Logged in as: ${user.user.username} (${user.user.email})`));
  } catch (err) {
    console.log(c('red', '   ❌ Invalid API key'));
    console.log(c('dim', `   Error: ${err.error?.message || JSON.stringify(err)}`));
    rl.close();
    return;
  }

  // Step 2: List workspaces
  console.log('\n' + c('magenta', '━'.repeat(60)));
  console.log(c('bright', '  Step 2: Select Your Workspace'));
  console.log(c('magenta', '━'.repeat(60)) + '\n');

  console.log(c('dim', '   Fetching your workspaces...'));
  
  let workspaces;
  try {
    const wsResponse = await postmanRequest('/workspaces', apiKey);
    workspaces = wsResponse.workspaces || [];
    
    if (workspaces.length === 0) {
      console.log(c('yellow', '   ⚠️  No workspaces found. Using personal workspace.'));
    } else {
      console.log(c('green', `   ✅ Found ${workspaces.length} workspace(s)\n`));
      
      workspaces.forEach((ws, i) => {
        const visibility = ws.visibility || 'personal';
        const icon = visibility === 'team' ? '👥' : visibility === 'public' ? '🌐' : '👤';
        console.log(`   ${c('cyan', `[${i + 1}]`)} ${icon} ${ws.name} ${c('dim', `(${visibility})`)}`);
      });
    }
  } catch (err) {
    console.log(c('yellow', '   ⚠️  Could not list workspaces, will show all collections'));
    workspaces = [];
  }

  let selectedWorkspace = null;
  if (workspaces.length > 0) {
    const wsChoice = await ask(c('cyan', '\n→ Select workspace number (or press Enter for all): '));
    if (wsChoice && !isNaN(wsChoice)) {
      const idx = parseInt(wsChoice) - 1;
      if (idx >= 0 && idx < workspaces.length) {
        selectedWorkspace = workspaces[idx];
        console.log(c('dim', `   Selected: ${selectedWorkspace.name}`));
      }
    }
  }

  // Step 3: List collections
  console.log('\n' + c('magenta', '━'.repeat(60)));
  console.log(c('bright', '  Step 3: Select Your Collection'));
  console.log(c('magenta', '━'.repeat(60)) + '\n');

  console.log(c('dim', '   Fetching collections...'));

  let collections;
  try {
    const endpoint = selectedWorkspace 
      ? `/collections?workspace=${selectedWorkspace.id}`
      : '/collections';
    const colResponse = await postmanRequest(endpoint, apiKey);
    collections = colResponse.collections || [];
    
    if (collections.length === 0) {
      console.log(c('red', '   ❌ No collections found'));
      console.log(c('dim', '   Make sure you have at least one collection in Postman.'));
      rl.close();
      return;
    }

    console.log(c('green', `   ✅ Found ${collections.length} collection(s)\n`));
    
    // Show collections with numbers
    collections.forEach((col, i) => {
      const shortId = col.uid.split('-').pop().substring(0, 8);
      console.log(`   ${c('cyan', `[${i + 1}]`)} ${col.name} ${c('dim', `(${shortId}...)`)}`);
    });

  } catch (err) {
    console.log(c('red', '   ❌ Failed to fetch collections'));
    console.log(c('dim', `   Error: ${err.error?.message || JSON.stringify(err)}`));
    rl.close();
    return;
  }

  const colChoice = await ask(c('cyan', '\n→ Select collection number: '));
  if (!colChoice || isNaN(colChoice)) {
    console.log(c('red', '   ❌ Invalid selection'));
    rl.close();
    return;
  }

  const colIdx = parseInt(colChoice) - 1;
  if (colIdx < 0 || colIdx >= collections.length) {
    console.log(c('red', '   ❌ Invalid selection'));
    rl.close();
    return;
  }

  const selectedCollection = collections[colIdx];
  console.log(c('green', `   ✅ Selected: ${selectedCollection.name}`));

  // Step 4: Verify access
  console.log('\n' + c('magenta', '━'.repeat(60)));
  console.log(c('bright', '  Step 4: Verify Write Access'));
  console.log(c('magenta', '━'.repeat(60)) + '\n');

  console.log(c('dim', '   Testing collection access...'));

  try {
    const colDetails = await postmanRequest(`/collections/${selectedCollection.uid}`, apiKey);
    console.log(c('green', '   ✅ Read access confirmed'));
    console.log(c('dim', `   Collection has ${colDetails.collection?.item?.length || 0} top-level items`));
    
    // Check if we're the owner (can write)
    const isOwner = selectedCollection.owner === user.user.id;
    if (isOwner) {
      console.log(c('green', '   ✅ You own this collection (full write access)'));
    } else {
      console.log(c('yellow', '   ⚠️  You may not have write access to this collection'));
      console.log(c('dim', '   The API will fail if you can\'t edit this collection'));
    }
  } catch (err) {
    console.log(c('red', '   ❌ Cannot access collection'));
    console.log(c('dim', `   Error: ${err.error?.message || JSON.stringify(err)}`));
    rl.close();
    return;
  }

  // Step 5: Generate configuration
  console.log('\n' + c('magenta', '━'.repeat(60)));
  console.log(c('bright', '  Step 5: Configuration Complete! 🎉'));
  console.log(c('magenta', '━'.repeat(60)) + '\n');

  // Save .env.local for local testing
  const envContent = `# Postman Publishing Configuration
# Generated by setup-publish wizard
# ⚠️  DO NOT COMMIT THIS FILE - add .env.local to .gitignore

POSTMAN_API_KEY=${apiKey}
WORKING_COLLECTION_UID=${selectedCollection.uid}
`;

  const envPath = path.join(process.cwd(), '.env.local');
  fs.writeFileSync(envPath, envContent);
  console.log(c('green', '✅ Created .env.local for local testing'));
  console.log(c('dim', '   (Make sure .env.local is in your .gitignore!)\n'));

  // GitHub Actions instructions
  console.log(c('yellow', '📋 GitHub Actions Setup:'));
  console.log(c('bright', '\n   Add these to your GitHub repository:\n'));
  
  console.log(c('cyan', '   1. Go to: ') + 'https://github.com/YOUR_REPO/settings/secrets/actions');
  console.log(c('cyan', '   2. Add Secret:'));
  console.log(`      Name:  ${c('green', 'POSTMAN_API_KEY')}`);
  console.log(`      Value: ${c('dim', apiKey.substring(0, 10) + '...' + apiKey.substring(apiKey.length - 5))}`);
  
  console.log(c('cyan', '\n   3. Go to: ') + 'https://github.com/YOUR_REPO/settings/variables/actions');
  console.log(c('cyan', '   4. Add Variable:'));
  console.log(`      Name:  ${c('green', 'WORKING_COLLECTION_UID')}`);
  console.log(`      Value: ${c('green', selectedCollection.uid)}`);

  console.log('\n' + c('cyan', '━'.repeat(60)));
  console.log(c('bright', '  📝 Summary'));
  console.log(c('cyan', '━'.repeat(60)));
  console.log(`
  ${c('green', '✅')} API Key validated
  ${c('green', '✅')} Collection: ${selectedCollection.name}
  ${c('green', '✅')} UID: ${selectedCollection.uid}
  ${c('green', '✅')} .env.local created for local testing
  
  ${c('yellow', '⏳')} TODO: Add secrets to GitHub (see above)
`);

  console.log(c('bright', '  🧪 Test locally:'));
  console.log(`     ${c('cyan', 'npm run publish:test')}  - Dry run (no changes)\n`);
  console.log(`     ${c('cyan', 'npm run publish')}       - Publish to Postman\n`);

  console.log(c('dim', '  Questions? See PUBLISHING.md for detailed docs.\n'));

  rl.close();
}

// Run the wizard
main().catch(err => {
  console.error(c('red', '\n❌ Unexpected error:'), err);
  rl.close();
  process.exit(1);
});
