const API_BASE = 'http://localhost:8787';

async function testRateLimit() {
  console.log('Testing Rate Limiting...\n');

  // Test 1: Normal requests
  console.log('=== Test 1: Normal Requests ===');
  for (let i = 1; i <= 5; i++) {
    try {
      const response = await fetch(`${API_BASE}/api/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: `Test Company ${i}`,
          email: `test${i}@example.com`
        })
      });

      console.log(`Request ${i}:`);
      console.log(`  Status: ${response.status}`);
      console.log(`  Rate Limit: ${response.headers.get('X-RateLimit-Limit')}`);
      console.log(`  Remaining IP: ${response.headers.get('X-RateLimit-Remaining-IP')}`);
      console.log(`  Remaining Email: ${response.headers.get('X-RateLimit-Remaining-Email')}`);
      
      const data = await response.json();
      console.log(`  Response: ${JSON.stringify(data)}`);
      console.log('');
    } catch (error) {
      console.error(`Request ${i} failed:`, error);
    }
  }

  // Test 2: Same IP rate limit
  console.log('=== Test 2: IP Rate Limiting ===');
  const sameIPRequests = [];
  
  // Make many requests quickly (same IP, different emails)
  for (let i = 1; i <= 12; i++) {
    sameIPRequests.push(
      fetch(`${API_BASE}/api/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: `Burst Company ${i}`,
          email: `burst${i}@example.com`
        })
      }).then(async (response) => {
        const data = await response.json();
        return {
          requestNumber: i,
          status: response.status,
          limit: response.headers.get('X-RateLimit-Limit'),
          remainingIP: response.headers.get('X-RateLimit-Remaining-IP') || response.headers.get('X-RateLimit-Remaining'),
          data
        };
      })
    );
  }

  const results = await Promise.all(sameIPRequests);
  results.forEach(result => {
    console.log(`Burst Request ${result.requestNumber}:`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Remaining: ${result.remainingIP}`);
    if (result.status === 429) {
      console.log(`  Rate Limited: ${result.data.metadata?.type}`);
    }
    console.log('');
  });

  // Test 3: Same email rate limit
  console.log('=== Test 3: Email Rate Limiting ===');
  const sameEmailRequests = [];
  
  // Make requests with same email but different "IPs" (simulated)
  for (let i = 1; i <= 5; i++) {
    sameEmailRequests.push(
      fetch(`${API_BASE}/api/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': `192.168.1.${i}` // Won't work but shows intent
        },
        body: JSON.stringify({
          companyName: `Email Test Company ${i}`,
          email: 'same-email@example.com'
        })
      }).then(async (response) => {
        const data = await response.json();
        return {
          requestNumber: i,
          status: response.status,
          remainingEmail: response.headers.get('X-RateLimit-Remaining-Email') || response.headers.get('X-RateLimit-Remaining'),
          data
        };
      })
    );
  }

  const emailResults = await Promise.all(sameEmailRequests);
  emailResults.forEach(result => {
    console.log(`Same Email Request ${result.requestNumber}:`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Remaining Email: ${result.remainingEmail}`);
    if (result.status === 429) {
      console.log(`  Rate Limited: ${result.data.metadata?.type}`);
    }
    console.log('');
  });
}

// Run the test
testRateLimit().catch(console.error);
