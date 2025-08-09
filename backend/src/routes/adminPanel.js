const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../database/database-wrapper');

const router = express.Router();

// Admin login page - serves HTML directly for hidden access
router.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Admin Panel</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f5f5f5;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
        }
        .login-container {
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          width: 100%;
          max-width: 400px;
        }
        h2 {
          text-align: center;
          color: #333;
          margin-bottom: 30px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 5px;
          color: #666;
          font-weight: bold;
        }
        input {
          width: 100%;
          padding: 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 16px;
          box-sizing: border-box;
        }
        button {
          width: 100%;
          padding: 12px;
          background-color: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          font-weight: bold;
        }
        button:hover {
          background-color: #0056b3;
        }
        .error {
          color: #dc3545;
          text-align: center;
          margin-top: 10px;
          display: none;
        }
        .success {
          color: #28a745;
          text-align: center;
          margin-top: 10px;
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <h2>Admin Panel Access</h2>
        <form id="adminLoginForm">
          <div class="form-group">
            <label for="email">Email</label>
            <input type="email" id="email" name="email" required />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required />
          </div>
          <button type="submit">Login</button>
          <div class="error" id="errorMsg"></div>
          <div class="success" id="successMsg"></div>
        </form>
      </div>
      
      <script>
        document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const email = document.getElementById('email').value;
          const password = document.getElementById('password').value;
          const errorMsg = document.getElementById('errorMsg');
          const successMsg = document.getElementById('successMsg');
          
          errorMsg.style.display = 'none';
          successMsg.style.display = 'none';
          
          try {
            const response = await fetch('/admin-panel-2025/login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
              successMsg.textContent = 'Login successful! Redirecting...';
              successMsg.style.display = 'block';
              
              // Store token
              localStorage.setItem('adminToken', data.token);
              localStorage.setItem('userRole', data.user.role);
              
              // Redirect to appropriate dashboard
              setTimeout(() => {
                window.location.href = '/admin-panel-2025/dashboard';
              }, 1000);
            } else {
              errorMsg.textContent = data.message || 'Login failed';
              errorMsg.style.display = 'block';
            }
          } catch (error) {
            errorMsg.textContent = 'Network error. Please try again.';
            errorMsg.style.display = 'block';
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Admin login endpoint - only accepts manager role
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find user
    const user = await db.get('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is a manager
    if (user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager role required.' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      },
      token
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Admin dashboard - serves manager dashboard HTML
router.get('/dashboard', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Manager Dashboard</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 20px;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          padding: 30px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
          color: #333;
          margin-bottom: 30px;
        }
        .nav {
          display: flex;
          gap: 20px;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #eee;
        }
        .nav-item {
          padding: 10px 20px;
          background-color: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          cursor: pointer;
          text-decoration: none;
          color: #333;
        }
        .nav-item:hover {
          background-color: #e9ecef;
        }
        .nav-item.active {
          background-color: #007bff;
          color: white;
        }
        .content {
          min-height: 400px;
        }
        .logout {
          float: right;
          background-color: #dc3545;
          color: white;
          padding: 10px 20px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }
        .logout:hover {
          background-color: #c82333;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <button class="logout" onclick="logout()">Logout</button>
        <h1>Manager Dashboard</h1>
        
        <div class="nav">
          <a href="/api/v1/manager/stats" class="nav-item">Statistics</a>
          <a href="/api/v1/manager/studio-owner-codes" class="nav-item">Studio Owner Codes</a>
          <a href="/api/v1/manager/studios" class="nav-item">Studios</a>
          <a href="/api/v1/manager/leads" class="nav-item">Leads</a>
        </div>
        
        <div class="content">
          <p>Welcome to the Manager Dashboard. Use the navigation above to access different sections.</p>
          <p>For full functionality, please use the main application with your manager credentials.</p>
        </div>
      </div>
      
      <script>
        // Check if user is authenticated
        const token = localStorage.getItem('adminToken');
        const role = localStorage.getItem('userRole');
        
        if (!token || role !== 'manager') {
          window.location.href = '/admin-panel-2025';
        }
        
        function logout() {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('userRole');
          window.location.href = '/admin-panel-2025';
        }
      </script>
    </body>
    </html>
  `);
});

module.exports = router;