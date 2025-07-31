// Database wrapper to provide unified interface for SQLite and MySQL

const isProduction = process.env.NODE_ENV === 'production';

let db;

if (isProduction) {
  // MySQL connection
  const mysqlConnection = require('./mysql-connection');
  
  // MySQL wrapper with SQLite-like interface
  db = {
    connection: null,
    initialized: false,
    
    // Initialize MySQL connection
    async init() {
      if (!this.initialized) {
        await mysqlConnection.initializeDatabase();
        this.connection = mysqlConnection.getConnection();
        this.initialized = true;
      }
    },
    
    // SQLite-like get method for MySQL
    async get(query, params = []) {
      if (!this.initialized) await this.init();
      
      try {
        const [rows] = await this.connection.execute(query, params);
        return rows[0] || null;
      } catch (error) {
        console.error('MySQL get error:', error);
        throw error;
      }
    },
    
    // SQLite-like all method for MySQL
    async all(query, params = []) {
      if (!this.initialized) await this.init();
      
      try {
        const [rows] = await this.connection.execute(query, params);
        return rows;
      } catch (error) {
        console.error('MySQL all error:', error);
        throw error;
      }
    },
    
    // SQLite-like run method for MySQL
    async run(query, params = []) {
      if (!this.initialized) await this.init();
      
      try {
        const [result] = await this.connection.execute(query, params);
        return {
          lastID: result.insertId,
          changes: result.affectedRows
        };
      } catch (error) {
        console.error('MySQL run error:', error);
        throw error;
      }
    },
    
    // Close connection
    async close() {
      if (this.connection) {
        await mysqlConnection.closeConnection();
      }
    }
  };
  
} else {
  // SQLite connection with async wrapper
  const sqliteDb = require('./connection');
  
  db = {
    // Promisify SQLite get method
    get(query, params = []) {
      return new Promise((resolve, reject) => {
        sqliteDb.get(query, params, (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        });
      });
    },
    
    // Promisify SQLite all method
    all(query, params = []) {
      return new Promise((resolve, reject) => {
        sqliteDb.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    },
    
    // Promisify SQLite run method
    run(query, params = []) {
      return new Promise((resolve, reject) => {
        sqliteDb.run(query, params, function(err) {
          if (err) reject(err);
          else resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        });
      });
    },
    
    // Close SQLite connection
    close() {
      return new Promise((resolve) => {
        sqliteDb.close(() => resolve());
      });
    }
  };
}

module.exports = db;