const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Initialize database connection
const db = require('./src/database/connection');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'abnehmen-backend'
  });
});

// API routes
app.get('/api/v1/status', (req, res) => {
  res.json({ 
    message: 'Abnehmen im Liegen API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Authentication routes
const authRoutes = require('./src/routes/auth');
app.use('/api/v1/auth', authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`=� Server running on port ${PORT}`);
  console.log(`=� Health check: http://localhost:${PORT}/health`);
  console.log(`=' API status: http://localhost:${PORT}/api/v1/status`);
});

module.exports = app;