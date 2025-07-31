const mysql = require('mysql2/promise');
require('dotenv').config();

let connection = null;

// Support Railway's MySQL vars (no underscore) and our custom DB_ prefixed vars
const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || process.env.MYSQL_HOST || 'localhost',
  port: process.env.DB_PORT || process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306,
  user: process.env.DB_USER || process.env.MYSQLUSER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'abnehmen_app',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  timezone: 'Z'
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
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ MySQL database connected successfully');
    
    // Initialize tables
    await createTables();
    
    return connection;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

async function createTables() {
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
      phone VARCHAR(20) NOT NULL,
      email VARCHAR(255),
      studio_id INT,
      status ENUM('new', 'contacted', 'interested', 'appointment_scheduled', 'converted', 'not_interested') DEFAULT 'new',
      source VARCHAR(100),
      notes TEXT,
      last_contact_date TIMESTAMP,
      next_contact_date TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
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
      webhook_url VARCHAR(500),
      last_sync TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      settings JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE SET NULL
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
}

function getConnection() {
  if (!connection) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return connection;
}

async function closeConnection() {
  if (connection) {
    await connection.end();
    connection = null;
    console.log('🔌 Database connection closed');
  }
}

module.exports = {
  initializeDatabase,
  getConnection,
  closeConnection
};