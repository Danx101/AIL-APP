const express = require('express');
const path = require('path');

const app = express();
const PORT = 3002;

// Serve static files
app.use(express.static('.'));

// Serve the test page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-manager-dashboard.html'));
});

app.listen(PORT, () => {
    console.log(`Test server running at http://localhost:${PORT}`);
    console.log('Open http://localhost:3002 in your browser to test the manager dashboard');
});