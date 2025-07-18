const managerController = require('./src/controllers/managerController');
const jwt = require('jsonwebtoken');

// Mock request and response objects
const req = {
  body: {
    intendedOwnerName: 'Test Owner',
    intendedCity: 'Test City',
    intendedStudioName: 'Test Studio'
  },
  user: {
    userId: 1,
    email: 'manager@abnehmen.com',
    role: 'manager'
  }
};

const res = {
  status: (code) => {
    console.log('Status:', code);
    return {
      json: (data) => {
        console.log('Response:', JSON.stringify(data, null, 2));
      }
    };
  }
};

// Test the function
console.log('Testing manager code generation...');
managerController.generateStudioOwnerCodes(req, res);