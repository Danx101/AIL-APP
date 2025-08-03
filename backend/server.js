const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
// Only load .env in development - Railway provides env vars in production
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

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
      'https://ail-app.vercel.app',
      'https://ail-app-danylo-gevel.vercel.app',
      'https://ail-j358ubjbs-danylo-gevel.vercel.app',
      'https://ail-app-frontend.vercel.app',
      'https://abnehmen-app.vercel.app',
      // Add common development ports
      'http://localhost:3001',
      'http://localhost:5000',
      'http://localhost:8080',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5000',
      'http://127.0.0.1:8080'
    ];
    
    // Add production frontend URL
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    // Log the origin for debugging
    console.log('CORS request from origin:', origin);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(new Error(`Not allowed by CORS: ${origin}`));
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

// Debug routes (temporary - before auth middleware)
const debugRoutes = require('./src/routes/debugRoutes');
app.use('/api/v1/debug', debugRoutes);

// Database test route (temporary)
const dbTestRoutes = require('./src/routes/dbTest');
app.use('/api/v1/db', dbTestRoutes);

// Authentication routes
const authRoutes = require('./src/routes/auth');
app.use('/api/v1/auth', authRoutes);

// Studio routes
const studioRoutes = require('./src/routes/studios');
app.use('/api/v1/studios', studioRoutes);

// Studio appointment and block routes
const studioAppointmentRoutes = require('./src/routes/studioAppointments');
app.use('/api/v1/studios', studioAppointmentRoutes);

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

// Dialogflow routes
const dialogflowRoutes = require('./src/routes/dialogflow');
app.use('/api/v1/dialogflow', dialogflowRoutes);

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