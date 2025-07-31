const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Initialize database connection with unified interface
const db = require('./src/database/database-wrapper');

// Initialize services
const schedulerService = require('./src/services/schedulerService');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
// CORS configuration for development and production
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:51124', 
      'http://localhost:53288',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:51124',
      'http://127.0.0.1:53288',
      'https://ail-app.vercel.app'
    ];
    
    // Add production frontend URL
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
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

// Studio routes
const studioRoutes = require('./src/routes/studios');
app.use('/api/v1/studios', studioRoutes);

// Manager routes
const managerRoutes = require('./src/routes/manager');
app.use('/api/v1/manager', managerRoutes);

// Manager lead routes
const managerLeadRoutes = require('./src/routes/managerLeads');
app.use('/api/v1/manager', managerLeadRoutes);

// Appointment routes
const appointmentRoutes = require('./src/routes/appointments');
app.use('/api/v1/appointments', appointmentRoutes);

// Session routes
const sessionRoutes = require('./src/routes/sessions');
app.use('/api/v1', sessionRoutes);

// Lead routes
const leadRoutes = require('./src/routes/leads');
app.use('/api/v1/leads', leadRoutes);

// Twilio webhook routes
const twilioRoutes = require('./src/routes/twilio');
app.use('/api/v1/twilio', twilioRoutes);

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
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`⚡ API status: http://localhost:${PORT}/api/v1/status`);
  
  // Initialize MySQL database in production
  if (process.env.NODE_ENV === 'production') {
    try {
      const { initializeDatabase } = require('./src/database/mysql-connection');
      await initializeDatabase();
      console.log('🗄️ MySQL database initialized');
    } catch (error) {
      console.error('❌ Failed to initialize MySQL database:', error);
    }
  }
  
  // Initialize scheduler service
  try {
    await schedulerService.initialize();
  } catch (error) {
    console.error('Failed to initialize scheduler service:', error);
  }
});

module.exports = app;