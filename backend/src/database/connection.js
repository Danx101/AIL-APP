const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../database.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log(' Connected to SQLite database');
    
    // Enable foreign key constraints
    db.run('PRAGMA foreign_keys = ON');
    
    // Create basic tables for Phase 0
    createBasicTables();
    
    // Run manager codes migration
    const { runMigration } = require('./migrations/add_manager_codes_table');
    runMigration().catch(console.error);
    
    // Run appointment tables migration
    const { runMigration: runAppointmentMigration } = require('./migrations/add_appointment_tables');
    runAppointmentMigration().catch(console.error);
  }
});

function createBasicTables() {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('manager', 'studio_owner', 'customer')),
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Activation codes table
  db.run(`
    CREATE TABLE IF NOT EXISTS activation_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      studio_id INTEGER,
      used_by_user_id INTEGER,
      is_used BOOLEAN DEFAULT 0,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (used_by_user_id) REFERENCES users(id)
    )
  `);

  // Studios table
  db.run(`
    CREATE TABLE IF NOT EXISTS studios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      owner_id INTEGER NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT,
      business_hours TEXT,
      city TEXT,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id)
    )
  `);

  console.log(' Basic database tables created/verified');
}

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('=� Database connection closed');
    }
    process.exit(0);
  });
});

module.exports = db;