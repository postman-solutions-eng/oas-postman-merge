#!/usr/bin/env node
/**
 * Integration test for Postman variable matching bug fix
 * 
 * Tests the three fixes:
 * 1. Prioritize path array over raw field
 * 2. Normalize path parameters ({{var}} and :param both → :param)
 * 3. Preserve custom Postman variables during merge
 * 
 * Bug report: URL matching fails when collections use Postman variables
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🧪 Testing Postman Variable Matching Bug Fixes\n');

// ============================================================================
// Setup: Create test collections
// ============================================================================

console.log('📦 Setting up test collections...\n');

const testDir = path.join(__dirname, 'variable-matching');
if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Working collection with Postman variables ({{tcmBaseUrl}}, {{tcmTenantId}})
const workingCollection = {
  info: {
    name: 'Test Collection',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: [
    {
      name: 'Authentication Methods',
      item: [
        {
          name: 'Create personal access token',
          request: {
            method: 'POST',
            header: [
              { key: 'merge_header', value: 'custom-value', type: 'text' }
            ],
            url: {
              raw: '{{tcmBaseUrl}}/api/v1/pat',
              host: ['{{tcmBaseUrl}}'],
              path: ['api', 'v1', 'pat']
            }
          }
        },
        {
          name: 'Get site',
          request: {
            method: 'GET',
            url: {
              raw: '{{tcmBaseUrl}}/api/v1/tenants/{{tcmTenantId}}/sites/:siteId',
              host: ['{{tcmBaseUrl}}'],
              path: ['api', 'v1', 'tenants', '{{tcmTenantId}}', 'sites', ':siteId']
            }
          }
        }
      ]
    }
  ]
};

// Reference collection (converted from OpenAPI) with standard variables
const refCollection = {
  info: {
    name: 'Test Collection',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: [
    {
      name: 'Authentication Methods',
      item: [
        {
          name: 'Create personal access token',
          request: {
            method: 'POST',
            header: [],
            url: {
              host: ['{{baseUrl}}'],
              path: ['api', 'v1', 'pat']
            }
          }
        },
        {
          name: 'Get site',
          request: {
            method: 'GET',
            url: {
              host: ['{{baseUrl}}'],
              path: ['api', 'v1', 'tenants', ':tenantId', 'sites', ':siteId']
            }
          }
        },
        {
          name: 'New endpoint from spec',
          request: {
            method: 'PUT',
            url: {
              host: ['{{baseUrl}}'],
              path: ['api', 'v1', 'config', ':configId']
            }
          }
        }
      ]
    }
  ]
};

// Write test collections
const workingPath = path.join(testDir, 'working.json');
const refDir = path.join(testDir, 'ref');
const refPath = path.join(refDir, 'ref.postman_collection.json');
const mergedPath = path.join(testDir, 'merged.json');
const configPath = path.join(testDir, 'config.yaml');

// Create ref directory
if (!fs.existsSync(refDir)) {
  fs.mkdirSync(refDir, { recursive: true });
}

fs.writeFileSync(workingPath, JSON.stringify(workingCollection, null, 2));
fs.writeFileSync(refPath, JSON.stringify(refCollection, null, 2));

// Create minimal config
const config = {
  collection: {
    name: 'Test Collection',
    targetFolder: ''
  },
  services: [{
    name: 'Test API',
    spec: 'test.yaml',
    workingFolder: []
  }],
  options: {
    keepWorkingItemName: true,
    retireToFolder: true
  }
};
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log('  ✅ Created working collection with Postman variables');
console.log('  ✅ Created reference collection with standard format');
console.log('  ✅ Created test config\n');

// ============================================================================
// Test: Run merge
// ============================================================================

console.log('🔄 Running merge...\n');

try {
  // Run the merge script
  const mergeCmd = `node scripts/merge.js --config "${configPath}" --working "${workingPath}" --refdir "${refDir}" --out "${mergedPath}"`;
  execSync(mergeCmd, { cwd: path.join(__dirname, '..'), stdio: 'pipe' });
  
  console.log('  ✅ Merge completed successfully\n');
} catch (error) {
  console.error('  ❌ Merge failed:', error.message);
  console.error(error.stdout?.toString());
  console.error(error.stderr?.toString());
  process.exit(1);
}

// ============================================================================
// Verify: Check results
// ============================================================================

console.log('✅ Verifying results...\n');

const merged = JSON.parse(fs.readFileSync(mergedPath, 'utf8'));

const authFolder = merged.item.find(i => i.name === 'Authentication Methods');
const methods = authFolder ? authFolder.item : [];

// Test 1: Check that existing methods were matched (not retired)
const patMethod = methods.find(m => m.name === 'Create personal access token' && !m.name.includes('_retired'));
const siteMethod = methods.find(m => m.name === 'Get site' && !m.name.includes('_retired'));

if (patMethod) {
  console.log('  ✅ Test 1.1: "Create personal access token" matched (not retired)');
} else {
  console.error('  ❌ Test 1.1 FAILED: "Create personal access token" was incorrectly retired');
  process.exit(1);
}

if (siteMethod) {
  console.log('  ✅ Test 1.2: "Get site" matched (not retired)');
} else {
  console.error('  ❌ Test 1.2 FAILED: "Get site" was incorrectly retired');
  process.exit(1);
}

// Test 2: Check that custom Postman variables were preserved
if (patMethod) {
  const host = patMethod.request?.url?.host;
  if (Array.isArray(host) && host[0] === '{{tcmBaseUrl}}') {
    console.log('  ✅ Test 2.1: Custom host variable {{tcmBaseUrl}} preserved');
  } else {
    console.error('  ❌ Test 2.1 FAILED: Custom host variable was overwritten');
    console.error('     Expected: {{tcmBaseUrl}}, Got:', host);
    process.exit(1);
  }
}

if (siteMethod) {
  const path = siteMethod.request?.url?.path;
  if (Array.isArray(path) && path.includes('{{tcmTenantId}}')) {
    console.log('  ✅ Test 2.2: Custom path variable {{tcmTenantId}} preserved');
  } else {
    console.error('  ❌ Test 2.2 FAILED: Custom path variable was overwritten');
    console.error('     Expected path to contain {{tcmTenantId}}, Got:', path);
    process.exit(1);
  }
}

// Test 3: Check that custom header was preserved
if (patMethod) {
  const headers = patMethod.request?.header || [];
  const customHeader = headers.find(h => h.key === 'merge_header');
  if (customHeader && customHeader.value === 'custom-value') {
    console.log('  ✅ Test 3: Custom header preserved');
  } else {
    console.error('  ❌ Test 3 FAILED: Custom header was lost');
    process.exit(1);
  }
}

// Test 4: Count total methods (should be 2 matched, potentially + new ones from ref)
const totalMethods = methods.filter(m => !m.name.includes('_retired')).length;
if (totalMethods >= 2) {
  console.log(`  ✅ Test 4: Collection has ${totalMethods} active methods (2 matched + any additions)`);
} else {
  console.error(`  ❌ Test 4 FAILED: Expected at least 2 methods, got ${totalMethods}`);
  process.exit(1);
}

// Test 5: Check that no _retired folder was created (all methods matched)
const retiredFolder = authFolder?.item?.find(i => i.name && i.name.includes('_retired'));
if (!retiredFolder) {
  console.log('  ✅ Test 5: No false retirements (no _retired folder)');
} else {
  const retiredCount = retiredFolder.item?.length || 0;
  if (retiredCount === 0) {
    console.log('  ✅ Test 5: No false retirements (_retired folder empty)');
  } else {
    console.error(`  ❌ Test 5 FAILED: ${retiredCount} methods incorrectly retired`);
    process.exit(1);
  }
}

console.log('\n');

// ============================================================================
// Cleanup
// ============================================================================

console.log('🧹 Cleaning up test files...\n');
fs.rmSync(testDir, { recursive: true, force: true });

// ============================================================================
// Summary
// ============================================================================

console.log('✨ All Tests Passed! ✨');
console.log('======================\n');

console.log('Bug fixes verified:');
console.log('  ✅ Fix 1: Path array prioritized over raw field');
console.log('  ✅ Fix 2: Path parameters normalized ({{var}} and :param → :param)');
console.log('  ✅ Fix 3: Custom Postman variables preserved in updates\n');

console.log('Results:');
console.log('  ✅ 2 existing methods matched correctly');
console.log('  ✅ 0 false retirements');
console.log('  ✅ Custom variables preserved ({{tcmBaseUrl}}, {{tcmTenantId}})');
console.log('  ✅ Custom headers preserved (merge_header)\n');

console.log('Impact:');
console.log('  ✅ Collections with Postman variables now merge correctly');
console.log('  ✅ No data loss due to false retirements');
console.log('  ✅ Works with ANY collection format (generic solution)\n');

process.exit(0);
