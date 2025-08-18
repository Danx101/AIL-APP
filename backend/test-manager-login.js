const fetch = require('node-fetch');

async function testManagerLogin() {
    try {
        // Login as manager
        const loginResponse = await fetch('http://localhost:3001/api/v1/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'manager@abnehmen.com',
                password: 'manager123'
            })
        });

        if (!loginResponse.ok) {
            const error = await loginResponse.text();
            console.error('Login failed:', error);
            return;
        }

        const loginData = await loginResponse.json();
        console.log('Login successful!');
        console.log('Token:', loginData.token);
        console.log('User:', loginData.user);

        // Test the studios endpoint
        const studiosResponse = await fetch('http://localhost:3001/api/v1/manager/studios', {
            headers: {
                'Authorization': 'Bearer ' + loginData.token
            }
        });

        if (!studiosResponse.ok) {
            const error = await studiosResponse.text();
            console.error('Studios fetch failed:', error);
            return;
        }

        const studiosData = await studiosResponse.json();
        console.log('\nStudios fetched successfully!');
        console.log('Number of studios:', studiosData.studios.length);
        studiosData.studios.forEach((studio, i) => {
            console.log('\nStudio ' + (i + 1) + ':');
            console.log('  Name:', studio.name);
            console.log('  City:', studio.city);
            console.log('  Google Sheets:', studio.has_google_sheet ? 'Connected' : 'Not connected');
            console.log('  Total Leads:', studio.total_leads);
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

testManagerLogin();
