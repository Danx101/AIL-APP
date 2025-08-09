const mysql = require('mysql2/promise');
// Only load .env in development - Railway provides env vars in production
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

let pool = null;

// Parse Railway's MYSQL_PUBLIC_URL if available
let parsedConfig = {};
if (process.env.MYSQL_PUBLIC_URL) {
  try {
    const url = new URL(process.env.MYSQL_PUBLIC_URL);
    parsedConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1) // Remove leading /
    };
    console.log('Parsed MYSQL_PUBLIC_URL successfully');
  } catch (e) {
    console.error('Failed to parse MYSQL_PUBLIC_URL:', e.message);
  }
}

// Support Railway's MySQL vars (no underscore) and our custom DB_ prefixed vars
const dbConfig = {
  host: parsedConfig.host || process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST || 'localhost',
  port: parsedConfig.port || process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
  user: parsedConfig.user || process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || 'root',
  password: parsedConfig.password || process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || '',
  database: parsedConfig.database || process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'abnehmen_app',
  ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : false,
  timezone: 'Z',
  // Connection pool settings
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Connection timeout settings
  connectTimeout: 60000  // 60 seconds
};

console.log('MySQL Config:', {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  database: dbConfig.database,
  hasPassword: !!dbConfig.password
});

async function initializeDatabase() {
  try {
    // Create connection pool instead of single connection
    pool = await mysql.createPool(dbConfig);
    console.log('✅ MySQL database pool created successfully');
    
    // Test the connection
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('✅ MySQL database connection verified');
    
    // Initialize tables
    await createTables();
    
    // Set up pool event handlers
    pool.on('connection', (connection) => {
      console.log('New MySQL connection established');
    });
    
    pool.on('enqueue', () => {
      console.log('Waiting for available connection slot');
    });
    
    return pool;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

async function createTables() {
  // Get a connection from the pool for table creation
  const connection = await pool.getConnection();
  
  try {
    const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('manager', 'studio_owner', 'customer') NOT NULL,
      first_name VARCHAR(100),
      last_name VARCHAR(100),
      phone VARCHAR(20),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`,
    
    `CREATE TABLE IF NOT EXISTS studios (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      owner_id INT NOT NULL,
      address TEXT,
      phone VARCHAR(20),
      email VARCHAR(255),
      business_hours TEXT,
      city VARCHAR(100),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )`,
    
    `CREATE TABLE IF NOT EXISTS activation_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      studio_id INT,
      used_by_user_id INT,
      is_used BOOLEAN DEFAULT FALSE,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
    )`,
    
    `CREATE TABLE IF NOT EXISTS manager_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(50) UNIQUE NOT NULL,
      created_by_user_id INT,
      used_by_user_id INT,
      is_used BOOLEAN DEFAULT FALSE,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    )`,
    
    `CREATE TABLE IF NOT EXISTS appointments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customer_id INT NOT NULL,
      studio_id INT NOT NULL,
      appointment_date DATE NOT NULL,
      appointment_time TIME NOT NULL,
      duration_minutes INT DEFAULT 60,
      status ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show') DEFAULT 'scheduled',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
    )`,
    
    `CREATE TABLE IF NOT EXISTS leads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone_number VARCHAR(20) NOT NULL,
      email VARCHAR(255),
      studio_id INT,
      status ENUM('neu', 'kontaktiert', 'konvertiert', 'nicht_interessiert') DEFAULT 'neu',
      source VARCHAR(100),
      source_type ENUM('manual', 'imported') DEFAULT 'manual',
      notes TEXT,
      google_sheets_row_id INT,
      google_sheets_sync_id VARCHAR(100),
      created_by_manager_id INT,
      created_by_user_id INT,
      lead_score INT DEFAULT 0,
      conversion_status ENUM('lead', 'prospect', 'customer', 'lost') DEFAULT 'lead',
      last_contacted TIMESTAMP NULL,
      next_follow_up TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
      INDEX idx_phone_studio (phone_number, studio_id),
      INDEX idx_sync_id (google_sheets_sync_id)
    )`,
    
    `CREATE TABLE IF NOT EXISTS lead_call_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lead_id INT NOT NULL,
      call_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      call_duration INT,
      call_outcome ENUM('answered', 'no_answer', 'busy', 'voicemail', 'callback_requested') NOT NULL,
      notes TEXT,
      next_action VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
    )`,
    
    `CREATE TABLE IF NOT EXISTS google_sheets_integrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      studio_id INT,
      manager_id INT,
      sheet_id VARCHAR(255) NOT NULL,
      sheet_name VARCHAR(255),
      column_mapping JSON,
      auto_sync_enabled BOOLEAN DEFAULT TRUE,
      sync_frequency_minutes INT DEFAULT 60,
      last_sync_at TIMESTAMP NULL,
      sync_status ENUM('active', 'paused', 'error') DEFAULT 'active',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_studio_active (studio_id, is_active),
      INDEX idx_manager (manager_id)
    )`
  ];

    for (const table of tables) {
      try {
        await connection.execute(table);
      } catch (error) {
        console.error('Error creating table:', error);
      }
    }
    
    console.log('✅ Database tables initialized');
    
    // Create sync tracking tables
    try {
      const { createMySQLSyncTables } = require('./migrations/add_sync_tracking');
      await createMySQLSyncTables(connection);
    } catch (error) {
      console.error('Error creating sync tracking tables:', error.message);
    }
    
    // Add missing timestamps to existing tables
    try {
      const { addMySQLTimestamps } = require('./migrations/add_missing_timestamps');
      await addMySQLTimestamps(connection);
    } catch (error) {
      console.error('Error adding missing timestamps:', error.message);
    }
  } finally {
    // Always release the connection back to the pool
    connection.release();
  }
}

function getConnection() {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializeDatabase() first.');
  }
  // Return the pool instead of a single connection
  // The database wrapper will handle getting connections from the pool
  return pool;
}

async function closeConnection() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('🔌 Database connection pool closed');
  }
}

module.exports = {
  initializeDatabase,
  getConnection,
  closeConnection
};