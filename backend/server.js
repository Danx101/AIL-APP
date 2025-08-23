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
const emailService = require('./src/services/emailService');
const scheduledJobs = require('./src/services/scheduledJobs');

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

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`📨 ${req.method} ${req.path} - Headers:`, req.headers.authorization ? 'Auth present' : 'No auth');
  
  // Special logging for customer DELETE requests
  if (req.method === 'DELETE' && req.path.includes('/customers/')) {
    console.log(`🔥 DELETE CUSTOMER REQUEST DETECTED:`);
    console.log(`   - Method: ${req.method}`);
    console.log(`   - Full Path: ${req.path}`);
    console.log(`   - URL: ${req.url}`);
    console.log(`   - Base URL: ${req.baseUrl}`);
    console.log(`   - Route Path: ${req.route ? req.route.path : 'No route matched yet'}`);
  }
  
  next();
});

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

// Temporary migration routes (no auth required - remove after use)
const migrationRoutes = require('./src/routes/migration');
app.use('/api/v1/migration', migrationRoutes);

// Authentication routes
const authRoutes = require('./src/routes/auth');
app.use('/api/v1/auth', authRoutes);

// Customer session routes (simplified for new schema) - must come before main customer routes
const customerSessionsSimple = require('./src/routes/customerSessionsSimple');
app.use('/api/v1', customerSessionsSimple);

// Session routes  
const sessionRoutes = require('./src/routes/sessions');
app.use('/api/v1', sessionRoutes);

// Customer routes with mandatory session packages (must be before studio routes to avoid conflicts)
const customerRoutes = require('./src/routes/customers');
app.use('/api/v1', customerRoutes);

// Studio routes
const studioRoutes = require('./src/routes/studios');
app.use('/api/v1/studios', studioRoutes);

// Studio appointment and block routes
const studioAppointmentRoutes = require('./src/routes/studioAppointments');
app.use('/api/v1/studios', studioAppointmentRoutes);

// Simple appointment types routes (no studio ID needed)
const appointmentTypesSimple = require('./src/routes/appointmentTypesSimple');
app.use('/api/v1/appointment-types', appointmentTypesSimple);
// Alternative appointment types routes for frontend compatibility
app.use('/api/v1/appointments/types', appointmentTypesSimple);
app.use('/api/v1/appointments/appointment-types', appointmentTypesSimple);

// Simple blocks routes (no studio ID needed)
const blocksSimple = require('./src/routes/blocksSimple');
app.use('/api/v1/blocks', blocksSimple);

// Manager routes
const managerRoutes = require('./src/routes/manager');
app.use('/api/v1/manager', managerRoutes);

// Subscription routes
const subscriptionRoutes = require('./src/routes/subscriptions');
app.use('/api/v1/subscriptions', subscriptionRoutes);

// Secret admin panel route - no visible links to this
const adminPanelRoutes = require('./src/routes/adminPanel');
app.use('/admin-panel-2025', adminPanelRoutes);

// Manager lead routes
const managerLeadRoutes = require('./src/routes/managerLeads');
app.use('/api/v1/manager', managerLeadRoutes);

// Appointment routes
const appointmentRoutes = require('./src/routes/appointments');
app.use('/api/v1/appointments', appointmentRoutes);

// Lead appointment routes
const leadAppointmentRoutes = require('./src/routes/leadAppointments');
app.use('/api/v1/lead-appointments', leadAppointmentRoutes);

// (Customer session routes and session routes moved earlier to prevent routing conflicts)

// Lead routes (simplified for new schema)
const leadRoutes = require('./src/routes/leadsSimple');
app.use('/api/v1/leads', leadRoutes);

// Lead Kanban routes
const leadKanbanRoutes = require('./src/routes/leadKanban');
app.use('/api/v1/lead-kanban', leadKanbanRoutes);

// (Customer routes moved earlier to avoid routing conflicts)

// Unified search routes
const searchRoutes = require('./src/routes/search');
app.use('/api/v1/search', searchRoutes);

// Twilio webhook routes
const twilioRoutes = require('./src/routes/twilio');
app.use('/api/v1/twilio', twilioRoutes);

// Dialogflow routes
const dialogflowRoutes = require('./src/routes/dialogflow');
app.use('/api/v1/dialogflow', dialogflowRoutes);

// Notification routes
const notificationRoutes = require('./src/routes/notifications');
app.use('/api/v1/notifications', notificationRoutes);

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
  
  // Initialize email service
  try {
    await emailService.initialize();
  } catch (error) {
    console.error('Failed to initialize email service:', error);
  }
  
  // Initialize scheduled jobs
  try {
    scheduledJobs.initialize();
    scheduledJobs.start();
  } catch (error) {
    console.error('Failed to initialize scheduled jobs:', error);
  }
});

module.exports = app;