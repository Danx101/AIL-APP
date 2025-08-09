const fetch = require('node-fetch');

async function testEndpoints() {
  // First login as manager
  const loginRes = await fetch('http://localhost:3001/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'manager@abnehmen.com',
      password: 'manager123'
    })
  });
  
  const loginData = await loginRes.json();
  
  if (!loginRes.ok) {
    console.log('Login failed:', loginData);
    return;
  }
  
  const token = loginData.token;
  console.log('Login successful, token received');
  
  // Test studios endpoint
  const studiosRes = await fetch('http://localhost:3001/api/v1/manager/studios', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const studiosData = await studiosRes.json();
  console.log('\nStudios endpoint:', studiosRes.status, studiosRes.ok ? 'OK' : 'FAILED');
  if (!studiosRes.ok) {
    console.log('Error:', studiosData);
  } else {
    console.log('Studios count:', studiosData.studios.length);
    console.log('Studios:', studiosData.studios.map(s => s.name));
  }
  
  // Test stats endpoint
  const statsRes = await fetch('http://localhost:3001/api/v1/manager/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const statsData = await statsRes.json();
  console.log('\nStats endpoint:', statsRes.status, statsRes.ok ? 'OK' : 'FAILED');
  if (!statsRes.ok) {
    console.log('Error:', statsData);
  } else {
    console.log('Stats:', statsData.statistics);
  }
  
  // Test lead stats endpoint
  const leadStatsRes = await fetch('http://localhost:3001/api/v1/manager/leads/stats', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const leadStatsData = await leadStatsRes.json();
  console.log('\nLead stats endpoint:', leadStatsRes.status, leadStatsRes.ok ? 'OK' : 'FAILED');
  if (!leadStatsRes.ok) {
    console.log('Error:', leadStatsData);
  } else {
    console.log('Lead stats:', leadStatsData);
  }
}

testEndpoints().catch(console.error);