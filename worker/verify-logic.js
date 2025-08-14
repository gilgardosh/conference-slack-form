#!/usr/bin/env node

// Simple test to verify our worker logic works
console.log('🧪 Testing Cloudflare Worker Logic\n');

// Test utility functions
const { 
  generateId, 
  sanitizeCompanyNamePreview,
  jsonResponse,
  errorResponse 
} = require('./src/utils.ts');

console.log('✅ Utils imported successfully');

// Test ID generation
const id1 = generateId();
const id2 = generateId();
console.log(`📝 Generated IDs: ${id1.slice(0, 8)}... and ${id2.slice(0, 8)}...`);
console.log(`🔄 IDs are unique: ${id1 !== id2}`);

// Test company name sanitization
const testCases = [
  'Test Company',
  'Test Company Inc.',
  'My  Super   Company',
  'Company@#$%^&*()',
];

console.log('\n🏢 Company name sanitization:');
testCases.forEach(name => {
  const sanitized = sanitizeCompanyNamePreview(name);
  console.log(`  "${name}" → "${sanitized}"`);
});

// Test email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailTests = [
  ['test@example.com', true],
  ['invalid-email', false],
  ['user@domain.co.uk', true],
  ['user space@example.com', false],
];

console.log('\n📧 Email validation:');
emailTests.forEach(([email, expected]) => {
  const isValid = emailRegex.test(email);
  const status = isValid === expected ? '✅' : '❌';
  console.log(`  ${status} "${email}" → ${isValid}`);
});

console.log('\n🎉 All core logic tests completed!');
console.log('\n📝 To test endpoints manually:');
console.log('1. Start the worker: yarn dev (in /worker directory)');
console.log('2. Test ping: curl http://localhost:8787/api/ping');
console.log('3. Test submit: curl -X POST http://localhost:8787/api/submit -H "Content-Type: application/json" -d \'{"companyName":"Test Co","email":"test@example.com"}\'');
