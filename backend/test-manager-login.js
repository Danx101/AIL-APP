const fetch = require('node-fetch');

async function loginAsManager() {
  try {
    const response = await fetch('http://localhost:3001/api/v1/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: 'manager@abnehmen.com',
        password: 'manager123' // Replace with actual password
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('Manager login successful!');
      console.log('Token:', data.token);
      console.log('\nTest manager endpoints with:');
      console.log(`curl -H "Authorization: Bearer ${data.token}" http://localhost:3001/api/v1/manager/stats`);
      console.log(`curl -H "Authorization: Bearer ${data.token}" http://localhost:3001/api/v1/manager/studios`);
    } else {
      console.error('Login failed:', data);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

loginAsManager();