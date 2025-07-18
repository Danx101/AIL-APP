const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

async function initializeDatabase() {
  const db = new sqlite3.Database(dbPath);
  
  try {
    console.log('🔧 Initializing database with manager support...');
    
    // Enable foreign key constraints
    await new Promise((resolve, reject) => {
      db.run('PRAGMA foreign_keys = ON', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Create users table with manager role
    await new Promise((resolve, reject) => {
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
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Users table created');
    
    // Create activation codes table
    await new Promise((resolve, reject) => {
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
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Activation codes table created');
    
    // Create studios table
    await new Promise((resolve, reject) => {
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
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Studios table created');
    
    // Create manager codes table
    await new Promise((resolve, reject) => {
      db.run(`
        CREATE TABLE IF NOT EXISTS manager_codes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          intended_owner_name TEXT NOT NULL,
          intended_city TEXT NOT NULL,
          intended_studio_name TEXT,
          created_by_manager_id INTEGER NOT NULL,
          used_by_user_id INTEGER,
          is_used BOOLEAN DEFAULT 0,
          expires_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by_manager_id) REFERENCES users(id),
          FOREIGN KEY (used_by_user_id) REFERENCES users(id)
        )
      `, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Manager codes table created');
    
    // Create manager account
    const email = 'manager@abnehmen.com';
    const password = 'Manager123!';
    const firstName = 'System';
    const lastName = 'Manager';
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO users (email, password_hash, role, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
        [email, passwordHash, 'manager', firstName, lastName],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    
    console.log('✅ Manager account created successfully');
    console.log('');
    console.log('🔑 Login Credentials:');
    console.log('📧 Email: manager@abnehmen.com');
    console.log('🔐 Password: Manager123!');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error.message);
  } finally {
    db.close();
  }
}

initializeDatabase();